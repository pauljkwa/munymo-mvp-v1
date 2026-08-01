/**
 * Daily Curation Agent — Claude-powered replacement for the Manus scheduled task.
 *
 * Split into two phases (2026-08-01, references/afternoon-curation-split-spec.md)
 * so the failure-prone research work happens in the US afternoon (hours of
 * retry runway) instead of racing the post-close deadline:
 *
 *   Phase A — afternoon staging, runStagingCuration(): ~14:45 ET, researches
 *     and stages tomorrow's matchup as a hidden `draft` ("in the trolley").
 *     If it never runs or fails outright, no draft exists and Phase B falls
 *     back to today's proven combined behavior automatically (golden safety
 *     property — nothing here is on the critical path for a game going live).
 *   Phase B — post-close, runDailyCuration(): ~16:15 ET, just after NASDAQ
 *     closes. If a staged draft exists for the next trading day, this is a
 *     small (~2-4 turn) results-only conversation: score today and activate
 *     the staged draft. Otherwise it's the original combined flow below.
 *
 * Original (still the Phase B fallback) flow (mirrors
 * references/daily-curation-agent-prompt.md):
 *   1. GET /api/scheduled/recent-games              → banned sectors/tickers/pairs + freshness context
 *   2. Claude scans news, discards ineligible-sector leads immediately, and calls the
 *      check_freshness tool to confirm a candidate sector + pair BEFORE researching or
 *      writing anything for it — an ineligible pick costs one cheap tool call instead
 *      of a whole rebuilt game.
 *   3. Once confirmed fresh: full research (claude-sonnet-5 + web_search) + CurationPayload JSON.
 *   4. POST /api/scheduled/daily-curation            → close today + publish tomorrow
 *   5. On HTTP 422 (freshness violation) feed the violations back to Claude and
 *      retry with a different matchup, up to MAX_SUBMIT_ATTEMPTS times. This should be
 *      rare now that step 2 pre-qualifies the candidate before any content is written.
 *
 * Auth: the POST carries the shared secret `CURATION_AGENT_SECRET` (header
 * `x-curation-secret`) — the same secret the endpoint validates. No Manus cookie.
 */

import type { Express, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env";
import { notifyOwner } from "./notification";

const MODEL = "claude-sonnet-5"; // Sonnet 5 ≈ 60% cheaper than Opus 4.8; switched 2026-07-18 to keep curation under the API spend limit
// Failsafe (2026-07-30, after an overload storm killed the night): 529
// overloaded_error is capacity trouble in ONE model's serving pool, so waiting
// harder is the wrong tool — switching pools is. After 2 failed retries of a
// turn on the primary, remaining retries run on Opus 5 (separate capacity,
// same API surface incl. web_search_20260209 + adaptive thinking; ~2.5x the
// cost, which only rare failover nights pay). Failover is sticky for the rest
// of the storm window so consecutive turns don't thrash between models —
// prompt caches are model-scoped, and each switch pays a cold cache write.
const MODEL_FALLBACK = "claude-opus-5";
const FALLBACK_STICKY_MS = 45 * 60 * 1000;
let fallbackUntil = 0; // epoch ms — while now < this, turns start on MODEL_FALLBACK
const MAX_SUBMIT_ATTEMPTS = 4; // freshness retry budget (safety net; should rarely trigger — see check_freshness)
const MAX_PAUSE_TURNS = 16; // server-tool + check_freshness loop safety cap
const MAX_OUTPUT_TOKENS = 24000; // headroom for Sonnet 5's tokenizer (~30% more tokens than Opus for the same text); streaming, so unused headroom costs nothing
// Transient-error resilience (added after the 2026-07-20 run died on a single
// mid-stream `overloaded_error` and Monday's game went unscored).
// 2026-07-30: ladder deepened after an overload storm outlasted the old
// [30s, 60s, 120s] budget and killed both run attempts. The run's real
// deadline is the next market open (many hours away), so patience is cheap:
// a turn now rides out ~18 minutes of sustained 529s before giving up, and
// the hourly watchdog re-runs (index.ts) sit above that.
const TURN_RETRY_BACKOFF_MS = [30_000, 60_000, 120_000, 300_000, 600_000];
const FULL_RUN_ATTEMPTS = 2; // whole-run retry for anything else that throws
const FULL_RUN_RETRY_DELAY_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Errors worth retrying the SAME request for: rate limits (429), server errors
 * (5xx incl. 529 overloaded), and connection drops. Mid-stream `error` SSE
 * events don't always surface as typed APIError instances — the 2026-07-20
 * failure arrived as a plain error whose message was the raw
 * `{"type":"error","error":{"type":"overloaded_error",...}}` JSON — so the
 * message text is checked too.
 *
 * Stream severance (2026-07-25, killed both run attempts that night): when the
 * connection dies MID-STREAM — after headers, while the response body is being
 * read — undici surfaces `TypeError: terminated`, not APIConnectionError (the
 * SDK only wraps request-time failures). The real network error (SocketError
 * "other side closed", ECONNRESET, …) is buried in the `cause` chain, so both
 * the chain's messages and error codes are matched below.
 */
export function isTransientApiError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (err instanceof Anthropic.APIConnectionError) return true;
  if (typeof status === "number" && (status === 429 || status >= 500)) return true;
  const parts: string[] = [];
  for (let e = err as any, depth = 0; e && depth < 5; e = e.cause, depth++) {
    parts.push(String(e?.message ?? e), String(e?.code ?? ""));
  }
  const msg = parts.join(" | ");
  return (
    msg.includes("overloaded_error") ||
    msg.includes("rate_limit_error") ||
    msg.includes("api_error") ||
    msg.includes("Connection error") ||
    msg.includes("Request timed out") ||
    msg.includes("terminated") ||
    msg.includes("Premature close") ||
    msg.includes("other side closed") ||
    msg.includes("socket hang up") ||
    msg.includes("fetch failed") ||
    msg.includes("aborted") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("EPIPE")
  );
}

// ─── System prompt ───────────────────────────────────────────────────────────
// Adapted from references/daily-curation-agent-prompt.md for the Claude API
// (web_search tool instead of a shell/curl harness; output is a single JSON
// object which this script POSTs to the endpoint).
const SYSTEM_PROMPT = `You are the Munymo Daily Curation Agent. Munymo is a daily stock-picking game: each trading day players are shown two well-known companies and pick which one will have the higher closing % change that day.

Your job runs once per US trading day, just after NASDAQ closes. You must:
1. Determine today's winner from real closing prices.
2. Select a timely matchup for the next trading day that obeys strict freshness rules.
3. Research both companies and write all player-facing content.
4. Output ONE complete JSON object (the "CurationPayload") — nothing else.

You have a web_search tool. Use it to read today's financial news (Yahoo Finance, Reuters, CNBC, Bloomberg, MarketWatch) and to look up real closing prices and company metrics. Never invent numbers — every price, metric, and news hook must come from a real source you searched.

## Freshness rules — pre-qualify BEFORE researching or writing anything
- Sector may not repeat within 7 days.
- A company may not appear in any game within 30 days.
- A matchup pair may not repeat within 365 days.

The user message includes bannedSectors, bannedTickers, and bannedPairs — pre-computed exclusion lists covering all three rules. Treat them as hard constraints and follow this sequence:

1. Scan today's financial news for what's genuinely topical — whatever has the most buzz.
2. The MOMENT a story's sector is in bannedSectors, or its lead companies are in bannedTickers, STOP reading that thread — do not research those companies further, do not look up their prices or metrics. Move on to a different story.
3. Once you have a candidate sector and two candidate tickers that are clear of bannedSectors and bannedTickers, and the pair is not in bannedPairs, call the check_freshness tool with that exact sector and pair to confirm before doing anything else.
4. Only after check_freshness returns fresh: true should you proceed to full research (prices, metrics, debrief, written content) for that matchup. If it returns fresh: false, pick a different candidate and call check_freshness again — never write content for a candidate that hasn't been confirmed fresh.

check_freshness is a fast, deterministic check against the live database — it is authoritative. Do not skip it, and do not substitute your own reading of bannedSectors/bannedTickers/bannedPairs for it. Because those lists already steer you away from dead ends before you start reading, you should rarely need more than one or two candidates before confirming a fresh one.

## Determine today's winner
From the recent games list, find the game with status "active" or "locked" that has the EARLIEST gameDate — the one whose trading day has just concluded. Do NOT pick a game with a later/future gameDate just because it appears first in the list (the list is sorted newest-first); if more than one game is active/locked at once, the earliest-dated one is always the correct one to score. Look up both companies' opening and closing price and % change for today's session. Higher % change wins (tie → higher volume). Record companyAPerf / companyBPerf as numbers (e.g. 2.34 for +2.34%), companyAStartPrice / companyAEndPrice / companyBStartPrice / companyBEndPrice as the actual $ prices (e.g. 187.32) at today's session open and close, winnerTicker, a 2–3 sentence resultSummary, and a 3–5 paragraph hindsightSpotlight educational debrief.

## Select tomorrow's matchup
Follow the freshness pre-qualification sequence above first. Once a candidate sector + pair is confirmed fresh via check_freshness, continue only if the two companies are: genuine rivals/comparisons; widely recognised; the subject of a real investment debate; and tied to a specific news story from the last 48 hours (you must be able to name it). Avoid penny stocks, micro-caps, ETFs, and index funds. If a confirmed-fresh candidate fails these qualitative checks, pick a different one and re-confirm freshness before continuing.

While you're on the article that gave you the "buzz" signal for this matchup, keep its exact URL, headline, and publisher (e.g. Reuters, Bloomberg, CNBC, MarketWatch, Yahoo Finance) — you'll attribute it in the output. Use the single article that most directly inspired the pairing, not a generic company-profile page.

## Content to write
- pairingRationale: 2–3 sentences on why THIS matchup, TODAY, referencing the specific recent event.
- sourceUrl / sourceTitle / sourcePublisher: the exact URL, headline, and publisher of the news article that inspired this matchup (captured above) — this is credited on the game page and links back to the article, so it must be the real, specific URL you read, not a homepage or search results page.
- researchContent: 4–6 balanced, educational paragraphs (competitive landscape, performance drivers, risks/catalysts, current debate, upcoming events). Do not telegraph a winner.
- researchSummary: 3–4 short plain-English paragraphs for beginners, NO jargon (no P/E, EPS, TTM, EBITDA). What each company does in one sentence; one reason to pick each; one thing to keep in mind.
- researchMetrics: EIGHT metrics per ticker in two groups — see "researchMetrics rules" below.
- validationQuestion: one question testing a verifiable fact answerable from your research.

## researchMetrics rules
The metrics panel is a teaching surface. The game page renders it in two labelled groups so players learn the horizon distinction every day — fundamentals vs. what shapes a single session. Use these EXACT metric names (after the ticker prefix), in this order:

**"The Long Game" (fundamentals):**
- Market Cap — e.g. "$1.2T"
- P/E Ratio — TTM, e.g. "28.4"
- Revenue Growth — YoY %, e.g. "+14% YoY"
- Analyst Consensus — e.g. "Buy, avg target $520"

**"Game-Day Setup" (what shapes this session):**
- Next Earnings — the confirmed next earnings date with timing when known, e.g. "Jul 29 (after close)". Verify via web_search — NEVER guess an earnings date. If no date is confirmed, write "No confirmed date". If earnings land ON the gameDate, that is the single most important fact of the matchup — say so in pairingRationale and researchContent as well.
- Beta — 5-year monthly beta from Yahoo Finance statistics, e.g. "1.35". This tells players which stock is the bigger mover.
- Last Session Move — the company's % price change in the just-concluded session, with its explicit date, e.g. "+2.3% (Jul 17)". Use real closing data.
- vs 52-Week High — how far the latest close sits below the 52-week high, e.g. "4% below high" (or "At 52-week high").

Every value must stand alone without relative time words — anchor any date explicitly (see the no-relative-time rule below).

## Dates in player-facing content — no relative time
You are writing the night BEFORE the game day, and players read this content the next day (or later, after a weekend). Relative time words go stale and embarrass us: a company "scheduled to report earnings today" may have reported by the time anyone reads it. In pairingRationale, researchContent, researchSummary, and the validation question:
- NEVER write "today", "tomorrow", "this morning", "later this week", or similar relative phrases for scheduled or recent events.
- ALWAYS anchor events to an explicit day and date: "reports Q2 earnings on Tuesday, July 21", "announced its guidance cut on July 15".
- Double-check via web_search whether a "scheduled" event (earnings, product launch, ruling) has ALREADY happened before describing it as upcoming — if it happened, describe the outcome instead.

## Validation question type — vary it, don't default to multiple choice
Each recent game in the list you were given includes its "questionType" (may be null for older games). Look at the most recent game(s) and pick a DIFFERENT type than whatever was used last time — never repeat the immediately-previous type. Choose randomly among the other two eligible types (don't always alternate in the same fixed order; keep it unpredictable but never a repeat).

- **multiple_choice**: 4 options; correctAnswer must be the EXACT text of one option; set "options" to the array of 4 strings.
- **true_false**: a statement Claude judges as verifiably true or false from the research; correctAnswer is exactly "True" or "False"; set "options" to null.
- **yes_no**: a yes/no question about the companies/matchup; correctAnswer is exactly "Yes" or "No"; set "options" to null.

If there is no prior game (first game ever) or no questionType history, pick any of the three at random.

## Dates
- The "today" you are given is the US Eastern (market-calendar) date. ALL date reasoning happens in that calendar — never re-derive "today" from UTC or any other timezone.
- gameDate: the next valid US trading day (YYYY-MM-DD) strictly after the trading day you just scored. If you scored a Wednesday game, the next game is Thursday (unless Thursday is a holiday) — never skip a trading day.
- If this run happens BEFORE the US market opens on a trading day (e.g. a manual recovery run in the US morning), the next valid trading day is TODAY — do NOT skip to tomorrow. The game you create locks at today's 9:30 AM ET open.
- If the earliest active/locked game's gameDate is today-but-pre-close or in the future, its session has NOT concluded and there is no result to report: set "today": null and "marketClosed": true. Never report a result for a game whose trading day hasn't finished.
- lockoutAt: gameDate at 13:30:00 UTC during US DST (2nd Sun Mar – 1st Sun Nov) or 14:30:00 UTC otherwise (both = 9:30 AM ET, NASDAQ open). Full ISO 8601, e.g. 2026-07-07T13:30:00.000Z.
- If today was a US market holiday (markets closed), set "today": null and "marketClosed": true, and only create the next game.

## Output format — CRITICAL
Your FINAL message must contain ONLY the JSON object below — no markdown fences, no commentary, no explanation before or after. All research/reasoning happens in tool use and thinking; the final message is pure JSON.

{
  "marketClosed": false,
  "today": {
    "companyAPerf": <number>,
    "companyBPerf": <number>,
    "companyAStartPrice": <number>,
    "companyAEndPrice": <number>,
    "companyBStartPrice": <number>,
    "companyBEndPrice": <number>,
    "winnerTicker": "<TICKER>",
    "winningMargin": <abs(companyAPerf - companyBPerf)>,
    "resultSummary": "<2-3 sentences>",
    "hindsightSpotlight": "<3-5 paragraphs>",
    "resultSourceNote": "Closing prices sourced from Yahoo Finance on <today's date>"
  },
  "tomorrow": {
    "exchange": "NASDAQ",
    "gameDate": "<YYYY-MM-DD>",
    "sector": "<GICS sector name>",
    "companyAName": "<Full legal company name>",
    "companyATicker": "<TICKER>",
    "companyBName": "<Full legal company name>",
    "companyBTicker": "<TICKER>",
    "pairingRationale": "<2-3 sentences>",
    "sourceUrl": "<exact URL of the article that inspired this matchup>",
    "sourceTitle": "<exact headline of that article>",
    "sourcePublisher": "<publisher name, e.g. Reuters, Bloomberg, CNBC>",
    "lockoutAt": "<YYYY-MM-DDTHH:MM:SS.000Z>",
    "researchContent": "<4-6 paragraphs>",
    "researchSummary": "<3-4 plain-English paragraphs, no jargon>",
    "researchMetrics": {
      "<A ticker> Market Cap": "<value>",
      "<A ticker> P/E Ratio": "<value>",
      "<A ticker> Revenue Growth": "<+/-X% YoY>",
      "<A ticker> Analyst Consensus": "<Buy/Hold/Sell, avg target $X>",
      "<A ticker> Next Earnings": "<Mon DD (before open|after close)> or No confirmed date",
      "<A ticker> Beta": "<value>",
      "<A ticker> Last Session Move": "<+/-X.X% (Mon DD)>",
      "<A ticker> vs 52-Week High": "<X% below high>",
      "<B ticker> Market Cap": "<value>",
      "<B ticker> P/E Ratio": "<value>",
      "<B ticker> Revenue Growth": "<+/-X% YoY>",
      "<B ticker> Analyst Consensus": "<Buy/Hold/Sell, avg target $X>",
      "<B ticker> Next Earnings": "<Mon DD (before open|after close)> or No confirmed date",
      "<B ticker> Beta": "<value>",
      "<B ticker> Last Session Move": "<+/-X.X% (Mon DD)>",
      "<B ticker> vs 52-Week High": "<X% below high>"
    },
    "validationQuestion": {
      "questionType": "<multiple_choice | true_false | yes_no — see 'Validation question type' rule above>",
      "questionText": "<question text>",
      "options": ["<A>", "<B>", "<C>", "<D>"] or null,
      "correctAnswer": "<exact text of the correct option, or 'True'/'False', or 'Yes'/'No'>"
    }
  }
}

Note: "options" must be a real JSON array of 4 strings when questionType is "multiple_choice", and JSON null for "true_false" or "yes_no". Do not write literal "or null" into the output — that placeholder is only for this instruction.`;

// ─── Derived prompts (Phase A staging, Phase B results-only) ────────────────
// Both variants are built by SLICING SYSTEM_PROMPT at its section headings —
// never hand-copied — so every shared section (identity, the web_search tool
// paragraph, freshness pre-qualification + banned lists, "Select tomorrow's
// matchup" through "Dates" incl. the market-calendar rule, "Determine today's
// winner", and the `today`/`tomorrow` output field lists) can only ever say
// one thing across all three prompts: edit SYSTEM_PROMPT once and every
// derived prompt picks it up. SYSTEM_PROMPT itself is never touched by this —
// the full combined run's prompt is byte-identical to before this split.

/** Returns the substring from the first `{` at or after `fromIndex` through
 *  its matching `}`, counting nesting depth. Used to lift the `today`/`tomorrow`
 *  output-field blocks out of SYSTEM_PROMPT's JSON template intact. */
function extractBalancedBlock(text: string, fromIndex: number): string {
  const start = text.indexOf("{", fromIndex);
  if (start === -1) throw new Error("extractBalancedBlock: no opening brace found");
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error("extractBalancedBlock: unbalanced braces");
}

/** Finds `needle` in `text` or throws — fails loudly at module load if
 *  SYSTEM_PROMPT's structure ever changes out from under these slice points,
 *  instead of silently deriving a broken staging/results-only prompt. */
function requireIndex(text: string, needle: string): number {
  const idx = text.indexOf(needle);
  if (idx === -1) throw new Error(`Prompt anchor not found: ${JSON.stringify(needle)} — SYSTEM_PROMPT structure changed`);
  return idx;
}

const jobOverviewIdx = requireIndex(SYSTEM_PROMPT, "Your job runs once per US trading day");
const webSearchIdx = requireIndex(SYSTEM_PROMPT, "You have a web_search tool");
const freshnessRulesIdx = requireIndex(SYSTEM_PROMPT, "## Freshness rules");
const determineWinnerIdx = requireIndex(SYSTEM_PROMPT, "## Determine today's winner");
const selectTomorrowIdx = requireIndex(SYSTEM_PROMPT, "## Select tomorrow's matchup");
const outputFormatIdx = requireIndex(SYSTEM_PROMPT, "## Output format — CRITICAL");

const IDENTITY = SYSTEM_PROMPT.slice(0, jobOverviewIdx);
const WEB_SEARCH_PARAGRAPH = SYSTEM_PROMPT.slice(webSearchIdx, freshnessRulesIdx);
const FRESHNESS_AND_BANNED_LISTS_SECTION = SYSTEM_PROMPT.slice(freshnessRulesIdx, determineWinnerIdx);
const DETERMINE_WINNER_SECTION = SYSTEM_PROMPT.slice(determineWinnerIdx, selectTomorrowIdx);
const SELECT_TOMORROW_THROUGH_DATES_SECTION = SYSTEM_PROMPT.slice(selectTomorrowIdx, outputFormatIdx);

const fullOutputFormat = SYSTEM_PROMPT.slice(outputFormatIdx);
const OUTPUT_FORMAT_HEADING_AND_INTRO = fullOutputFormat.slice(0, requireIndex(fullOutputFormat, "{"));
const TODAY_OUTPUT_BLOCK = extractBalancedBlock(fullOutputFormat, requireIndex(fullOutputFormat, '"today": {'));
const TOMORROW_OUTPUT_BLOCK = extractBalancedBlock(fullOutputFormat, requireIndex(fullOutputFormat, '"tomorrow": {'));

/**
 * Phase A: research-only. Removes "Determine today's winner" (there's no
 * close to score mid-afternoon — today's game is still in play) and reduces
 * the output to the `tomorrow` block alone. Everything else — freshness
 * pre-qualification, banned lists, content rules, US-English, the full Dates
 * section incl. the market-calendar rule — is reused verbatim via the slices
 * above, per the build spec.
 */
const STAGING_SYSTEM_PROMPT =
  IDENTITY +
  `Your job runs once per US trading day, in the afternoon while that trading day's session is still open — this ` +
  `is the RESEARCH-ONLY half of curation. You must:\n` +
  `1. Select a timely matchup for the next trading day that obeys strict freshness rules.\n` +
  `2. Research both companies and write all player-facing content.\n` +
  `3. Output ONE complete JSON object (the "CurationPayload") — nothing else.\n\n` +
  WEB_SEARCH_PARAGRAPH +
  FRESHNESS_AND_BANNED_LISTS_SECTION +
  SELECT_TOMORROW_THROUGH_DATES_SECTION +
  OUTPUT_FORMAT_HEADING_AND_INTRO +
  `{\n  "tomorrow": ${TOMORROW_OUTPUT_BLOCK}\n}\n\n` +
  `Note: "options" must be a real JSON array of 4 strings when questionType is "multiple_choice", and JSON null for "true_false" or "yes_no". Do not write literal "or null" into the output — that placeholder is only for this instruction.`;

/**
 * Phase B fast path: a draft already exists for the next trading day (Phase A
 * staged it), so this run only scores today — no new matchup, no freshness.
 * Keeps "Determine today's winner" verbatim (the content rules the build spec
 * asks to preserve) and reduces the output to the `today` block plus the
 * `stagedGameId` the run is told to echo back.
 */
const RESULTS_ONLY_SYSTEM_PROMPT =
  IDENTITY +
  `Your job runs just after NASDAQ closes. Tomorrow's game has already been staged in advance — this is the ` +
  `RESULTS-ONLY half of curation. You must:\n` +
  `1. Determine today's winner from real closing prices.\n` +
  `2. Output ONE complete JSON object (the "CurationPayload") — nothing else.\n\n` +
  WEB_SEARCH_PARAGRAPH +
  DETERMINE_WINNER_SECTION +
  OUTPUT_FORMAT_HEADING_AND_INTRO +
  `The user message tells you the ID of the already-staged next game as "stagedGameId" — echo that exact number ` +
  `back unchanged; do not invent or look up a different one.\n\n` +
  `{\n  "marketClosed": false,\n  "stagedGameId": <the exact number given to you in the user message>,\n  "today": ${TODAY_OUTPUT_BLOCK}\n}\n\n` +
  `If today was a US market holiday, or the earliest active/locked game's session hasn't concluded yet, set "marketClosed": true and "today": null instead — never invent a result.`;

// ─── Recent games (freshness context) ────────────────────────────────────────
async function fetchRecentGames(): Promise<string> {
  const url = `${ENV.curationBaseUrl}/api/scheduled/recent-games`;
  const res = await fetch(url, { headers: { "x-curation-secret": ENV.curationAgentSecret } });
  if (!res.ok) {
    throw new Error(`recent-games returned HTTP ${res.status}`);
  }
  return await res.text();
}

// ─── check_freshness tool (candidate pre-qualification) ─────────────────────
// Cheap, deterministic check the agent calls BEFORE researching or writing
// content for a candidate — so an ineligible pick costs one fast round trip
// instead of a whole rebuilt game. See scheduledCuration.ts's checkFreshness().
const CHECK_FRESHNESS_TOOL = {
  name: "check_freshness",
  description:
    "Check whether a candidate sector and two tickers satisfy all freshness rules (7-day sector, 30-day company, 365-day pair) against the live database. Call this the moment you have a candidate — BEFORE researching prices/metrics or writing any content for it.",
  input_schema: {
    type: "object",
    properties: {
      sector: { type: "string", description: "GICS sector name of the candidate matchup" },
      companyATicker: { type: "string" },
      companyBTicker: { type: "string" },
    },
    required: ["sector", "companyATicker", "companyBTicker"],
  },
} as unknown as Anthropic.ToolUnion;

async function callCheckFreshness(
  sector: string,
  companyATicker: string,
  companyBTicker: string
): Promise<{ fresh: boolean; violations: string[] }> {
  const url = `${ENV.curationBaseUrl}/api/scheduled/check-freshness`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-curation-secret": ENV.curationAgentSecret,
    },
    body: JSON.stringify({ sector, companyATicker, companyBTicker }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { fresh: false, violations: [`check-freshness endpoint returned HTTP ${res.status}: ${JSON.stringify(body)}`] };
  }
  return { fresh: !!body.fresh, violations: body.violations ?? [] };
}

// ─── Claude research loop ────────────────────────────────────────────────────
/**
 * Runs ONE assistant turn, retrying transient API failures (overloaded/rate
 * limit/5xx/connection drop) with backoff. Safe to retry wholesale: `messages`
 * is only appended to by the caller AFTER a turn completes, so a failed turn
 * leaves the conversation exactly as it was before the request.
 *
 * Stream instead of awaiting one long-lived response. Non-streaming
 * requests get severed at ~15 minutes by a layer outside our control
 * regardless of the client timeout (observed two nights running,
 * 2026-07-07/08: "Request timed out" at ~904s even with a 25-minute
 * client timeout configured). Streaming keeps bytes flowing for the
 * whole research turn, so nothing sees an idle connection to kill.
 * Prompt caching: the loop re-sends the whole growing conversation every
 * turn, so cached prefix reads (~10% of normal input price) are where most
 * of a run's cost goes away. Breakpoint 1 on the system prompt caches the
 * tools+system prefix for the entire run; the top-level cache_control
 * auto-places a breakpoint at the end of the current history each turn.
 * 1h TTL (not the 5m default) because a single research turn can stream
 * for longer than 5 minutes, which would let the entry expire mid-run.
 */
async function runTurnWithRetry(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  tools: Anthropic.ToolUnion[],
  containerRef: { id: string | undefined },
  // Parametrized (2026-08-01) so the SAME retry ladder + model failover serves
  // all three conversation types (full combined, Phase A staging, Phase B
  // results-only) — only the system prompt text differs per caller.
  systemPrompt: string
): Promise<Anthropic.Message> {
  for (let retry = 0; ; retry++) {
    // Model failover: retries 0-1 stay on the primary (blips resolve in
    // seconds); from retry 2 the pool is genuinely struggling — switch to the
    // fallback and stay there for the storm window.
    const useFallback = Date.now() < fallbackUntil || retry >= 2;
    if (retry >= 2 && Date.now() >= fallbackUntil) {
      fallbackUntil = Date.now() + FALLBACK_STICKY_MS;
      console.warn(`[curation-agent] Primary model failing repeatedly — failing over to ${MODEL_FALLBACK} for ${FALLBACK_STICKY_MS / 60000} min`);
    }
    try {
      const stream = client.messages.stream({
        model: useFallback ? MODEL_FALLBACK : MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        thinking: { type: "adaptive" },
        cache_control: { type: "ephemeral", ttl: "1h" },
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral", ttl: "1h" } }],
        tools,
        messages,
        ...(containerRef.id ? { container: containerRef.id } : {}),
      });
      // The container id is delivered on the raw `message_delta` stream event at
      // the END of the turn (the container doesn't exist yet at `message_start`).
      // The SDK's stream accumulator copies stop_reason/usage from that event but
      // NOT `delta.container` (verified in MessageStream.mjs), so
      // finalMessage().container is always null under streaming — it must be
      // captured from the raw event or it is silently lost.
      stream.on("streamEvent", (event) => {
        if (event.type === "message_delta" && event.delta.container?.id) {
          containerRef.id = event.delta.container.id;
        }
      });
      return await stream.finalMessage();
    } catch (err: any) {
      if (retry >= TURN_RETRY_BACKOFF_MS.length || !isTransientApiError(err)) throw err;
      const delayMs = TURN_RETRY_BACKOFF_MS[retry];
      console.warn(
        `[curation-agent] Transient API error — retrying turn in ${delayMs / 1000}s ` +
          `(retry ${retry + 1}/${TURN_RETRY_BACKOFF_MS.length}): ${err?.message ?? err}`
      );
      await sleep(delayMs);
    }
  }
}

/**
 * Runs Claude turns to completion — driving the server-side web_search loop
 * (handling `pause_turn`) and the check_freshness client tool (handling
 * `tool_use`), appending every assistant turn (and tool result) to `messages`.
 * Returns the final assistant message so the caller can read its text.
 */
async function research(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  // Shared across every attempt in runDailyCuration's retry loop, not just this
  // call — messages (the conversation history) persists across retries, and the
  // container id has to keep pace with it or the API 400s on the retry's first
  // request. See containerRef comment at the call site for the full story.
  containerRef: { id: string | undefined },
  // Which of the three conversation types this run is (full combined,
  // Phase A staging, Phase B results-only) — everything else about the
  // research loop (tools, retry/failover, pause_turn/tool_use handling) is
  // identical across all three.
  systemPrompt: string
): Promise<Anthropic.Message> {
  const tools = [
    { type: "web_search_20260209", name: "web_search", max_uses: 15 } as unknown as Anthropic.ToolUnion,
    CHECK_FRESHNESS_TOOL,
  ];

  for (let i = 0; i < MAX_PAUSE_TURNS; i++) {
    const response = await runTurnWithRetry(client, messages, tools, containerRef, systemPrompt);
    // Cache verification: cache_read should be large (and input small) on every
    // turn after the first. All-zero cache fields across a run = a silent
    // invalidator crept into the prefix.
    const u = response.usage;
    console.log(
      `[curation-agent] turn ${i + 1}: input=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} ` +
        `cache_write=${u.cache_creation_input_tokens ?? 0} output=${u.output_tokens}`
    );
    messages.push({ role: "assistant", content: response.content });
    if (response.container?.id) containerRef.id = response.container.id;

    if (response.stop_reason === "pause_turn") continue;

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use" && block.name === "check_freshness") {
          const input = block.input as { sector: string; companyATicker: string; companyBTicker: string };
          const result = await callCheckFreshness(input.sector, input.companyATicker, input.companyBTicker);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
        }
      }
      if (toolResults.length > 0) {
        messages.push({ role: "user", content: toolResults });
        continue;
      }
    }

    return response;
  }
  throw new Error(`Exceeded ${MAX_PAUSE_TURNS} agent turns without completing`);
}

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Parse the CurationPayload JSON out of Claude's final text, tolerating stray fences. */
function parsePayload(text: string): unknown | null {
  const attempts: string[] = [text];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) attempts.push(fence[1].trim());
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) attempts.push(text.slice(first, last + 1));
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try next */
    }
  }
  return null;
}

// ─── POST to the daily-curation endpoint ─────────────────────────────────────
async function submitCuration(payload: unknown): Promise<{ status: number; body: any }> {
  const url = `${ENV.curationBaseUrl}/api/scheduled/daily-curation`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-curation-secret": ENV.curationAgentSecret,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// ─── POST to the stage-game endpoint (Phase A) ───────────────────────────────
async function submitStaging(payload: unknown): Promise<{ status: number; body: any }> {
  const url = `${ENV.curationBaseUrl}/api/scheduled/stage-game`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-curation-secret": ENV.curationAgentSecret,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

/**
 * Shared freshness-retry submission loop for the two NEW conversation types
 * (Phase A staging, Phase B results-only): research → parse → submit → on a
 * 422 freshness rejection, feed the violations back and retry with a
 * different matchup, up to MAX_SUBMIT_ATTEMPTS times. Mirrors the loop
 * inside attemptDailyCuration's legacy path exactly (same shape, same
 * retry semantics) without a third hand-duplicated copy, since both new
 * paths share it verbatim — only the system prompt, opening message, and
 * submit endpoint differ per caller.
 */
async function researchAndSubmitWithRetry(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  submit: (payload: unknown) => Promise<{ status: number; body: any }>,
  logPrefix: string
): Promise<{ status: number; body: any; attempt: number }> {
  const containerRef: { id: string | undefined } = { id: undefined };
  for (let attempt = 1; attempt <= MAX_SUBMIT_ATTEMPTS; attempt++) {
    const finalMessage = await research(client, messages, containerRef, systemPrompt);
    const text = extractText(finalMessage);
    const payload = parsePayload(text);

    if (!payload) {
      throw new Error(`Could not parse CurationPayload JSON from Claude's response (attempt ${attempt}).`);
    }

    const { status, body } = await submit(payload);

    if (status === 200) return { status, body, attempt };

    if (status === 422) {
      const violations = body?.violations ?? body?.detail ?? body?.error ?? "unknown";
      console.warn(`${logPrefix} Attempt ${attempt} rejected (422):`, violations);
      messages.push({
        role: "user",
        content:
          `The submission was REJECTED with HTTP 422. Reason: ${JSON.stringify(violations)}.\n` +
          `Choose a DIFFERENT matchup that satisfies all freshness rules (re-check the recent games list), ` +
          `and output the full corrected CurationPayload JSON again — only JSON.`,
      });
      continue; // retry
    }

    // Any other status is a hard failure.
    throw new Error(`${logPrefix} endpoint returned HTTP ${status}: ${JSON.stringify(body)}`);
  }

  throw new Error(`Exhausted ${MAX_SUBMIT_ATTEMPTS} attempts without a 200 response (freshness).`);
}

// ─── Main entry point ────────────────────────────────────────────────────────
// One run at a time: the nightly cron, the /api/scheduled/run-curation
// endpoint, the admin "Run Curation Now" button, AND the afternoon staging
// run all funnel through this ONE flag — a staging run and a full post-close
// run must never overlap (they'd race to read/write the same staged draft).
let runInFlight = false;
export function isCurationRunInFlight(): boolean {
  return runInFlight;
}

/** How a run should report failure: watchdog re-runs are still scheduled after
 *  a non-final attempt, so its failure email is a calm "no action needed" note
 *  instead of the manual-recovery alarm. */
export type CurationRunOptions = { finalAttempt?: boolean };

/** Shared in-flight guard for runDailyCuration/runStagingCuration — both
 *  check/set the SAME module-level runInFlight flag above. */
async function withCurationLock(label: string, fn: () => Promise<void>): Promise<void> {
  if (runInFlight) {
    console.warn(`[${label}] Run already in flight — skipping duplicate trigger`);
    return;
  }
  runInFlight = true;
  try {
    await fn();
  } finally {
    runInFlight = false;
  }
}

export async function runDailyCuration(opts: CurationRunOptions = {}): Promise<void> {
  await withCurationLock("curation-agent", () => runDailyCurationInner(opts.finalAttempt ?? true));
}

/** Phase A entry point — the 14:45 ET cron and the 15:30 ET staging watchdog
 *  both funnel through here. Shares runDailyCuration's in-flight guard,
 *  retry ladder, and model failover; see runStagingCurationInner. */
export async function runStagingCuration(opts: CurationRunOptions = {}): Promise<void> {
  await withCurationLock("curation-staging", () => runStagingCurationInner(opts.finalAttempt ?? true));
}

/**
 * "The trading day's EOD work is not done yet": the earliest active/locked
 * game has already concluded (its market session is over) but has no published
 * result. This is exactly the state the agent's close-and-curate run fixes.
 * A game whose session is still open (or hasn't started) is NOT outstanding —
 * triggering the agent mid-session would have it hunting for closing prices
 * that don't exist yet.
 */
export async function curationWorkOutstanding(): Promise<boolean> {
  const { getActiveOrUpcomingGame } = await import("../db");
  const game = await getActiveOrUpcomingGame();
  if (!game?.gameDate) return false;
  return isGameSessionConcluded(game.gameDate);
}

/** Pure, testable core of the outstanding check: has the US market session for
 *  `gameDate` (YYYY-MM-DD, ET trading day) ended? True from 16:10 ET on the
 *  game's own date, and for any earlier date. Intl handles DST. */
export function isGameSessionConcluded(gameDate: string, now: Date = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  // en-CA yields "YYYY-MM-DD, HH:mm" — both halves compare lexicographically.
  const [dateEt, timeEt] = fmt.format(now).split(", ");
  if (gameDate < dateEt) return true;
  if (gameDate > dateEt) return false;
  return timeEt >= "16:10";
}

/**
 * Watchdog entry point (hourly evening re-checks + the boot sweep in
 * index.ts): runs the agent ONLY if concluded-but-unscored work exists, so
 * firing it when everything is fine — or on a market holiday — is a free
 * no-op. This is what makes the pipeline self-healing: an overload storm, a
 * crashed run, or a deploy that killed the agent mid-run all get retried
 * automatically until the work is done, without anyone reading email.
 */
export async function runCurationIfOutstanding(trigger: string, opts: CurationRunOptions = {}): Promise<void> {
  if (runInFlight) {
    console.log(`[curation-watchdog] (${trigger}) run already in flight — standing down`);
    return;
  }
  let outstanding: boolean;
  try {
    outstanding = await curationWorkOutstanding();
  } catch (err) {
    console.error(`[curation-watchdog] (${trigger}) outstanding-check failed:`, err);
    return;
  }
  if (!outstanding) {
    console.log(`[curation-watchdog] (${trigger}) no outstanding EOD work — nothing to do`);
    return;
  }
  console.log(`[curation-watchdog] (${trigger}) concluded game is unscored — starting curation run`);
  await runDailyCuration(opts);
}

/** Pure time-gate for the 15:30 ET staging watchdog: true only during the
 *  afternoon staging window (14:45–16:00 ET) on a weekday, mirroring
 *  isGameSessionConcluded's pure/testable shape. A stray invocation outside
 *  that window is a safe no-op rather than staging a game at the wrong time.
 *  Does NOT check the database — see stagingOutstanding below, which
 *  combines this with a DB lookup (mirrors the isGameSessionConcluded /
 *  curationWorkOutstanding split). */
export function isStagingWindowOpen(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  if (weekday === "Sat" || weekday === "Sun") return false;
  const timeEt = `${hour}:${minute}`;
  return timeEt >= "14:45" && timeEt <= "16:00";
}

/**
 * Staging watchdog entry point (the 15:30 ET cron in index.ts): true only
 * when the afternoon window is open AND no draft/active/locked game exists
 * yet for a date after today(ET) — i.e. Phase A hasn't staged anything (or
 * failed) and there's still time to. Deliberately NOT wired into the boot
 * sweep or evening watchdogs (spec Section 5): after close, the Phase B
 * legacy fallback owns recovery, not staging.
 */
export async function stagingOutstanding(): Promise<boolean> {
  if (!isStagingWindowOpen()) return false;
  const { getAnyGameAfter } = await import("../db");
  const todayEt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const existing = await getAnyGameAfter(todayEt);
  return !existing;
}

async function runDailyCurationInner(finalAttempt: boolean): Promise<void> {
  if (!ENV.anthropicApiKey) {
    console.error("[curation-agent] ANTHROPIC_API_KEY not set — skipping");
    await notifyOwner({
      title: "❌ Daily curation FAILED",
      content: "ANTHROPIC_API_KEY is not configured. Run End of Day manually before 9:00 PM Perth time.",
    });
    return;
  }
  if (!ENV.curationAgentSecret) {
    console.error("[curation-agent] CURATION_AGENT_SECRET not set — skipping");
    await notifyOwner({
      title: "❌ Daily curation FAILED",
      content: "CURATION_AGENT_SECRET is not configured, so the agent cannot authenticate to the endpoint. Run End of Day manually.",
    });
    return;
  }

  const startTime = Date.now();
  const client = new Anthropic({ apiKey: ENV.anthropicApiKey, timeout: 25 * 60 * 1000 });

  // Whole-run retry: transient errors inside a research turn are already
  // retried in place (runTurnWithRetry), but anything else that throws —
  // recent-games fetch failure, unparseable payload, an error that outlived
  // its per-turn budget — gets one more attempt from scratch after a pause,
  // instead of leaving the day's game unscored until someone reads the
  // failure email (2026-07-20: one overloaded_error killed the night's run).
  let lastError: unknown;
  for (let runAttempt = 1; runAttempt <= FULL_RUN_ATTEMPTS; runAttempt++) {
    try {
      await attemptDailyCuration(client, startTime);
      return;
    } catch (err) {
      lastError = err;
      const msg = (err as any)?.message ?? String(err);
      console.error(`[curation-agent] Run attempt ${runAttempt}/${FULL_RUN_ATTEMPTS} failed:`, msg);
      if (runAttempt < FULL_RUN_ATTEMPTS) {
        console.log(`[curation-agent] Retrying full run in ${FULL_RUN_RETRY_DELAY_MS / 60000} min…`);
        await sleep(FULL_RUN_RETRY_DELAY_MS);
      }
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const msg = (lastError as any)?.message ?? String(lastError);
  try {
    if (finalAttempt) {
      await notifyOwner({
        title: "❌ Daily curation FAILED",
        content:
          `Claude curation agent failed after ${elapsed}s (${FULL_RUN_ATTEMPTS} attempts): ${msg}\n\n` +
          `All automatic retries for today are exhausted. Open munymo.com/admin and click ` +
          `"Run Curation Now" before 9:00 PM Perth time.`,
      });
    } else {
      await notifyOwner({
        title: "⚠️ Daily curation attempt failed — auto-retry scheduled",
        content:
          `Claude curation agent failed after ${elapsed}s (${FULL_RUN_ATTEMPTS} attempts): ${msg}\n\n` +
          `No action needed: the watchdog re-runs curation every hour until the game is scored ` +
          `(next checks at 17:15, 18:15, and 19:15 New York time). You'll get the usual ✅ email ` +
          `when a retry succeeds, or a ❌ email if the final attempt also fails.`,
      });
    }
  } catch {
    /* notification best-effort */
  }
}

/** One full curation attempt: fetch context → research → submit (with freshness retries). Throws on failure. */
async function attemptDailyCuration(client: Anthropic, startTime: number): Promise<void> {
  const recentGames = await fetchRecentGames();
  // The agent must reason in the MARKET's calendar. UTC rolls to "tomorrow" at
  // 8 PM New York — every evening watchdog/boot-sweep recovery run lands after
  // that rollover, and on 2026-07-29 the agent was told "today is 07-30" at
  // 20:05 ET Wednesday, scored Wednesday correctly, then queued FRIDAY's game
  // and skipped Thursday entirely (caught within the hour; game re-dated).
  const todayEt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

  // ── Phase B pre-check: has Phase A already staged tomorrow's game? ──
  // If so, this run only needs to score today and activate it — a small
  // (~2-4 turn) results-only conversation instead of full matchup research.
  // No staged draft (staging never ran, failed outright, or this is a
  // recovery run with nothing staged) → fall through to today's proven
  // combined behavior below, unchanged (golden safety property).
  const { getStagedDraftGameAfter } = await import("../db");
  const stagedDraft = await getStagedDraftGameAfter(todayEt);
  if (stagedDraft) {
    await attemptResultsOnlyCuration(client, startTime, recentGames, todayEt, stagedDraft);
    return;
  }

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        `Today's date (US Eastern — the market's trading date) is ${todayEt}. Run the full daily curation now.\n\n` +
        `Recent games, freshness rules, and pre-computed exclusion lists (bannedSectors, bannedTickers, bannedPairs) ` +
        `from /api/scheduled/recent-games:\n${recentGames}\n\n` +
        `Follow the freshness pre-qualification sequence from your system prompt: scan news, abandon any thread whose ` +
        `sector/companies are banned immediately, then call check_freshness to confirm your candidate BEFORE researching ` +
        `prices or writing content. Once confirmed, research today's result and tomorrow's matchup using web_search, ` +
        `then output the single CurationPayload JSON object as your final message.`,
    },
  ];

  // Persists across retry attempts — messages (the conversation history) does
  // too, and a retry's first request must keep resending whatever container
  // id the conversation has already touched, or it 400s immediately.
  const containerRef: { id: string | undefined } = { id: undefined };

  for (let attempt = 1; attempt <= MAX_SUBMIT_ATTEMPTS; attempt++) {
    const finalMessage = await research(client, messages, containerRef, SYSTEM_PROMPT);
    const text = extractText(finalMessage);
    const payload = parsePayload(text);

    if (!payload) {
      throw new Error(`Could not parse CurationPayload JSON from Claude's response (attempt ${attempt}).`);
    }

    const { status, body } = await submitCuration(payload);

    if (status === 200) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[curation-agent] Success in ${elapsed}s (attempt ${attempt}). nextGameId=${body?.nextGameId}`);
      // The endpoint already sends a success notification; nothing more to do.
      return;
    }

    if (status === 422) {
      const violations = body?.violations ?? body?.detail ?? body?.error ?? "unknown";
      console.warn(`[curation-agent] Attempt ${attempt} rejected (422):`, violations);
      messages.push({
        role: "user",
        content:
          `The submission was REJECTED with HTTP 422. Reason: ${JSON.stringify(violations)}.\n` +
          `Choose a DIFFERENT matchup that satisfies all freshness rules (re-check the recent games list), ` +
          `keep the same today/result block, and output the full corrected CurationPayload JSON again — only JSON.`,
      });
      continue; // retry
    }

    // Any other status is a hard failure.
    throw new Error(`daily-curation endpoint returned HTTP ${status}: ${JSON.stringify(body)}`);
  }

  throw new Error(`Exhausted ${MAX_SUBMIT_ATTEMPTS} attempts without a 200 response (freshness).`);
}

/**
 * Phase B fast path: a draft already exists for the next trading day, so
 * this run only scores today — no new matchup, no freshness (the SAME
 * research()/retry/failover machinery attemptDailyCuration's legacy path
 * uses, via the shared researchAndSubmitWithRetry loop, just with the
 * results-only system prompt and a smaller opening message).
 */
async function attemptResultsOnlyCuration(
  client: Anthropic,
  startTime: number,
  recentGames: string,
  todayEt: string,
  stagedDraft: { id: number; companyATicker: string; companyBTicker: string; gameDate: string }
): Promise<void> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        `Today's date (US Eastern — the market's trading date) is ${todayEt}. Tomorrow's game was already staged ` +
        `this afternoon, so run the RESULTS-ONLY half of curation: score today's result only, then activate the ` +
        `already-staged game — do not research or propose a new matchup.\n\n` +
        `Staged game: stagedGameId=${stagedDraft.id} (${stagedDraft.companyATicker} vs ${stagedDraft.companyBTicker}, ` +
        `${stagedDraft.gameDate}). Echo this exact stagedGameId back in your output.\n\n` +
        `Recent games, for finding the concluded game to score, from /api/scheduled/recent-games:\n${recentGames}\n\n` +
        `Determine today's winner using web_search for real closing prices, then output the single CurationPayload ` +
        `JSON object as your final message.`,
    },
  ];

  const { attempt, body } = await researchAndSubmitWithRetry(
    client,
    messages,
    RESULTS_ONLY_SYSTEM_PROMPT,
    submitCuration,
    "[curation-agent-results-only]"
  );
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[curation-agent] Results-only success in ${elapsed}s (attempt ${attempt}). stagedGameId=${stagedDraft.id}, nextGameId=${body?.nextGameId}`);
  // The endpoint already sends a success notification; nothing more to do.
}

// ─── Phase A: afternoon staging run ──────────────────────────────────────────
async function runStagingCurationInner(finalAttempt: boolean): Promise<void> {
  if (!ENV.anthropicApiKey || !ENV.curationAgentSecret) {
    const reason = !ENV.anthropicApiKey ? "ANTHROPIC_API_KEY not set" : "CURATION_AGENT_SECRET not set";
    console.error(`[curation-staging] ${reason} — skipping`);
    await notifyOwner({
      title: "⚠️ Afternoon staging skipped",
      content: `${reason}, so the afternoon staging run could not authenticate. No action needed — the post-close run will fall back to today's combined curation.`,
    });
    return;
  }

  const startTime = Date.now();
  const client = new Anthropic({ apiKey: ENV.anthropicApiKey, timeout: 25 * 60 * 1000 });

  // Same whole-run retry ladder as runDailyCurationInner (FULL_RUN_ATTEMPTS,
  // FULL_RUN_RETRY_DELAY_MS) — transient errors inside a research turn are
  // already retried in place (runTurnWithRetry); this catches anything else
  // that throws (recent-games fetch failure, unparseable payload, ...).
  let lastError: unknown;
  for (let runAttempt = 1; runAttempt <= FULL_RUN_ATTEMPTS; runAttempt++) {
    try {
      await attemptStagingCuration(client, startTime);
      return;
    } catch (err) {
      lastError = err;
      const msg = (err as any)?.message ?? String(err);
      console.error(`[curation-staging] Run attempt ${runAttempt}/${FULL_RUN_ATTEMPTS} failed:`, msg);
      if (runAttempt < FULL_RUN_ATTEMPTS) {
        console.log(`[curation-staging] Retrying full run in ${FULL_RUN_RETRY_DELAY_MS / 60000} min…`);
        await sleep(FULL_RUN_RETRY_DELAY_MS);
      }
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const msg = (lastError as any)?.message ?? String(lastError);
  // Staging failures are NEVER the alarming ❌ email — the post-close run's
  // proven legacy path is the fallback (golden safety property), so this is
  // always the calm ⚠️ note, whether or not the 15:30 watchdog will retry.
  try {
    await notifyOwner({
      title: finalAttempt
        ? "⚠️ Afternoon staging failed — post-close run will fall back to combined curation"
        : "⚠️ Afternoon staging attempt failed — retry scheduled",
      content:
        `Afternoon staging failed after ${elapsed}s (${FULL_RUN_ATTEMPTS} attempts): ${msg}\n\n` +
        (finalAttempt
          ? `Staging failed — the post-close run will fall back to combined curation; no action needed.`
          : `No action needed: the 15:30 ET staging watchdog will retry. If it also fails, the post-close run still falls back to combined curation automatically.`),
    });
  } catch {
    /* notification best-effort */
  }
}

/** One full staging attempt: fetch context → research tomorrow's matchup only → submit (with freshness retries). Throws on failure. */
async function attemptStagingCuration(client: Anthropic, startTime: number): Promise<void> {
  const recentGames = await fetchRecentGames();
  const todayEt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        `Today's date (US Eastern — the market's trading date) is ${todayEt}. It is the afternoon and the market ` +
        `is still open — run the afternoon STAGING half of curation: research and stage the NEXT trading day's ` +
        `matchup only. Do not attempt to determine a winner for today; today's game is still in play.\n\n` +
        `Your system prompt's "Dates" section says gameDate is "the next valid trading day strictly after the ` +
        `trading day you just scored" — for this staging run, read that as the next valid US trading day strictly ` +
        `after today (${todayEt}); you are not scoring anything this run. Never propose today itself.\n\n` +
        `Recent games, freshness rules, and pre-computed exclusion lists (bannedSectors, bannedTickers, bannedPairs) ` +
        `from /api/scheduled/recent-games:\n${recentGames}\n\n` +
        `Follow the freshness pre-qualification sequence from your system prompt: scan news, abandon any thread whose ` +
        `sector/companies are banned immediately, then call check_freshness to confirm your candidate BEFORE researching ` +
        `prices or writing content. Once confirmed, research the matchup using web_search, then output the single ` +
        `CurationPayload JSON object (the "tomorrow" block only) as your final message.`,
    },
  ];

  const { attempt, body } = await researchAndSubmitWithRetry(
    client,
    messages,
    STAGING_SYSTEM_PROMPT,
    submitStaging,
    "[curation-staging]"
  );
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[curation-staging] Success in ${elapsed}s (attempt ${attempt}). stagedGameId=${body?.stagedGameId}`);
  // The endpoint already sends a success notification; nothing more to do.
}

// ─── HTTP trigger (manual) ───────────────────────────────────────────────────
async function runCurationHandler(req: Request, res: Response) {
  const provided = req.headers["x-curation-secret"] ?? req.query["secret"];
  if (!ENV.curationAgentSecret || provided !== ENV.curationAgentSecret) {
    return res.status(403).json({ error: "Forbidden" });
  }
  // Fire-and-forget: the agent can run for several minutes; don't hold the request open.
  runDailyCuration().catch((err) => console.error("[curation-agent] Background run error:", err));
  return res.json({ ok: true, started: true });
}

export function registerCurationAgent(app: Express) {
  app.post("/api/scheduled/run-curation", runCurationHandler);
}
