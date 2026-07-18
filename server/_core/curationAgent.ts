/**
 * Daily Curation Agent — Claude-powered replacement for the Manus scheduled task.
 *
 * Runs once per US trading day (Mon–Fri) at ~20:15 UTC (4:15 AM Perth), just
 * after NASDAQ closes. Driven by an internal node-cron in `index.ts` (same
 * pattern as the tester agent); also exposed as a manually-triggerable HTTP
 * endpoint for testing.
 *
 * Flow (mirrors references/daily-curation-agent-prompt.md):
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
const MAX_SUBMIT_ATTEMPTS = 4; // freshness retry budget (safety net; should rarely trigger — see check_freshness)
const MAX_PAUSE_TURNS = 16; // server-tool + check_freshness loop safety cap
const MAX_OUTPUT_TOKENS = 24000; // headroom for Sonnet 5's tokenizer (~30% more tokens than Opus for the same text); streaming, so unused headroom costs nothing

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
- researchMetrics: for each ticker — Market Cap, P/E Ratio, Revenue Growth, EPS (TTM), 52-Week Range, Analyst Consensus (with avg target).
- validationQuestion: one question testing a verifiable fact answerable from your research.

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
- gameDate: the next valid US trading day (YYYY-MM-DD). Skip weekends and US market holidays.
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
      "<A ticker> Revenue Growth": "<value>",
      "<A ticker> EPS (TTM)": "<value>",
      "<A ticker> 52-Week Range": "<low> – <high>",
      "<A ticker> Analyst Consensus": "<Buy/Hold/Sell, avg target $X>",
      "<B ticker> Market Cap": "<value>",
      "<B ticker> P/E Ratio": "<value>",
      "<B ticker> Revenue Growth": "<value>",
      "<B ticker> EPS (TTM)": "<value>",
      "<B ticker> 52-Week Range": "<low> – <high>",
      "<B ticker> Analyst Consensus": "<Buy/Hold/Sell, avg target $X>"
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

// ─── Recent games (freshness context) ────────────────────────────────────────
async function fetchRecentGames(): Promise<string> {
  const url = `${ENV.curationBaseUrl}/api/scheduled/recent-games`;
  const res = await fetch(url);
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
  containerRef: { id: string | undefined }
): Promise<Anthropic.Message> {
  const tools = [
    { type: "web_search_20260209", name: "web_search", max_uses: 15 } as unknown as Anthropic.ToolUnion,
    CHECK_FRESHNESS_TOOL,
  ];

  for (let i = 0; i < MAX_PAUSE_TURNS; i++) {
    // Stream instead of awaiting one long-lived response. Non-streaming
    // requests get severed at ~15 minutes by a layer outside our control
    // regardless of the client timeout (observed two nights running,
    // 2026-07-07/08: "Request timed out" at ~904s even with a 25-minute
    // client timeout configured). Streaming keeps bytes flowing for the
    // whole research turn, so nothing sees an idle connection to kill.
    // Prompt caching: the loop re-sends the whole growing conversation every
    // turn, so cached prefix reads (~10% of normal input price) are where most
    // of a run's cost goes away. Breakpoint 1 on the system prompt caches the
    // tools+system prefix for the entire run; the top-level cache_control
    // auto-places a breakpoint at the end of the current history each turn.
    // 1h TTL (not the 5m default) because a single research turn can stream
    // for longer than 5 minutes, which would let the entry expire mid-run.
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      thinking: { type: "adaptive" },
      cache_control: { type: "ephemeral", ttl: "1h" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral", ttl: "1h" } }],
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
    const response = await stream.finalMessage();
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

// ─── Main entry point ────────────────────────────────────────────────────────
export async function runDailyCuration(): Promise<void> {
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

  try {
    const recentGames = await fetchRecentGames();
    const todayUtc = new Date().toISOString().slice(0, 10);

    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content:
          `Today's date (UTC) is ${todayUtc}. Run the full daily curation now.\n\n` +
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
      const finalMessage = await research(client, messages, containerRef);
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
  } catch (err: any) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const msg = err?.message ?? String(err);
    console.error("[curation-agent] Error:", msg);
    try {
      await notifyOwner({
        title: "❌ Daily curation FAILED",
        content: `Claude curation agent failed after ${elapsed}s: ${msg}\n\nPlease run End of Day manually before 9:00 PM Perth time.`,
      });
    } catch {
      /* notification best-effort */
    }
  }
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
