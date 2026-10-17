/**
 * Archive backfill for Scoring v2 highlighted metrics (practice-v2 spec, 2026-10-12).
 *
 * Asks Mo (same client + model as curation, no web search) to choose the four
 * highlighted metrics for an already-published game from its stored panel.
 * The rules text is sliced out of the curation SYSTEM_PROMPT at runtime so the
 * two can never drift.
 */
import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env";
import { MODEL, SYSTEM_PROMPT } from "./curationAgent";
import { recordAiTurn, type AiRunContext } from "./aiUsage";
import {
  splitMetricLabel,
  valuesForMetric,
  validateHighlightedMetrics,
  type MetricRow,
} from "../highlightedMetrics";
import { PRICE_TREND_LABEL } from "@shared/const";

const RULES_HEADING = "## highlightedMetrics rules";

/** The exact rules section from the curation prompt (heading to next "## "). */
export function extractHighlightRules(prompt: string = SYSTEM_PROMPT): string {
  const start = prompt.indexOf(RULES_HEADING);
  if (start === -1) throw new Error(`Prompt anchor not found: ${RULES_HEADING}`);
  const next = prompt.indexOf("\n## ", start + RULES_HEADING.length);
  return (next === -1 ? prompt.slice(start) : prompt.slice(start, next)).trim();
}

/**
 * Labels (original casing) present for BOTH companies with differing values.
 * "Price trend" is excluded: archived-game chart data isn't passed to Mo here.
 */
export function usableMetricLabels(rows: MetricRow[], tickerA: string, tickerB: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const parsed = splitMetricLabel(r.label, tickerA, tickerB);
    if (!parsed) continue;
    const lower = parsed.label.toLowerCase();
    if (seen.has(lower) || lower === PRICE_TREND_LABEL.toLowerCase()) continue;
    seen.add(lower);
    const { valueA, valueB } = valuesForMetric(rows, parsed.label, tickerA, tickerB);
    if (valueA === undefined || valueB === undefined) continue;
    if (valueA.trim().toLowerCase() === valueB.trim().toLowerCase()) continue;
    out.push(parsed.label);
  }
  return out;
}

export function buildBackfillSystemPrompt(): string {
  return [
    "You are Mo, Munymo's curation agent. You are re-reading an ALREADY PLAYED matchup from its stored metrics panel and choosing which four metrics to highlight for players.",
    "",
    extractHighlightRules(),
    "",
    "For this task, do NOT choose \"Price trend\" (no chart data is supplied). Choose only from the labels listed in the user message, using the exact label text.",
    'Reply with ONLY a JSON object: {"highlightedMetrics":["...","...","...","..."]} - no fences, no commentary.',
  ].join("\n");
}

let client: Anthropic | null = null;

/** One Mo call for one game. Returns the validated four labels, or null if Mo's answer failed validation. */
export async function chooseHighlightsForGame(game: {
  companyAName: string;
  companyATicker: string;
  companyBName: string;
  companyBTicker: string;
}, rows: MetricRow[],
// Running-costs ledger: the batch's context (one runId per button press) and
// this call's 1-based position in the batch. Optional so tests/tools can call without it.
usage?: { ctx: AiRunContext; turnIndex: number }): Promise<string[] | null> {
  client ??= new Anthropic({ apiKey: ENV.anthropicApiKey, timeout: 2 * 60 * 1000 });
  const usable = usableMetricLabels(rows, game.companyATicker, game.companyBTicker);
  const lines = usable.map((lower) => {
    const { valueA, valueB } = valuesForMetric(rows, lower, game.companyATicker, game.companyBTicker);
    return `- ${lower}: ${game.companyATicker} = ${valueA} | ${game.companyBTicker} = ${valueB}`;
  });
  const userText =
    `Company A: ${game.companyAName} (${game.companyATicker})\nCompany B: ${game.companyBName} (${game.companyBTicker})\n\n` +
    `Candidate metrics (use these exact labels):\n${lines.join("\n")}`;
  const startedAt = Date.now();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: [{ type: "text", text: buildBackfillSystemPrompt(), cache_control: { type: "ephemeral", ttl: "1h" } }],
    messages: [{ role: "user", content: userText }],
  });
  // Logged before parsing: a call whose answer fails validation still cost money.
  if (usage) {
    await recordAiTurn(usage.ctx, {
      model: MODEL,
      turnIndex: usage.turnIndex,
      usage: msg.usage,
      stopReason: msg.stop_reason,
      retries: 0,
      failedOver: false,
      durationMs: Date.now() - startedAt,
    });
  }
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  return validateHighlightedMetrics(parsed?.highlightedMetrics, rows, game.companyATicker, game.companyBTicker, "backfill-highlights");
}
