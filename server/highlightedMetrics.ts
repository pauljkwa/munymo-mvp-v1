/**
 * Scoring v2 helpers for a game's highlighted metrics (build spec 2026-10-07).
 * Pure functions: parse the "{TICKER} {Label}" metric rows, validate Mo's four
 * highlighted labels, and look up the two values for a label.
 */
import { HIGHLIGHTED_METRIC_COUNT, PRICE_TREND_LABEL } from "@shared/const";
import { calculateScoreV2 } from "./scoring";
import {
  splitMetricLabel,
  valuesForMetric,
  objectiveSideForMetric,
  type MetricRow,
} from "@shared/metricValues";

export { splitMetricLabel, valuesForMetric, type MetricRow };
import type { ConfidenceLevel } from "@shared/const";

/** Un-prefixed labels present for both companies (case-insensitive keys, original casing kept). */
export function metricLabelsPresent(rows: MetricRow[], tickerA: string, tickerB: string): Set<string> {
  const out = new Set<string>();
  for (const r of rows) {
    const parsed = splitMetricLabel(r.label, tickerA, tickerB);
    if (parsed) out.add(parsed.label.toLowerCase());
  }
  return out;
}

/**
 * Validates Mo's highlightedMetrics: exactly four distinct strings, each
 * either "Price trend" or a label present in the panel metrics. Returns the
 * cleaned list, or null (with a console warning) on any failure — the game
 * then runs the legacy scoring path for that day, which is safe.
 */
export function validateHighlightedMetrics(
  raw: unknown,
  rows: MetricRow[],
  tickerA: string,
  tickerB: string,
  context = "highlightedMetrics"
): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw) || raw.some((x) => typeof x !== "string")) {
    console.warn(`[${context}] not an array of strings — storing null (game runs legacy scoring).`);
    return null;
  }
  const cleaned = (raw as string[]).map((x) => x.trim());
  if (cleaned.length !== HIGHLIGHTED_METRIC_COUNT || new Set(cleaned.map((x) => x.toLowerCase())).size !== cleaned.length) {
    console.warn(`[${context}] need exactly ${HIGHLIGHTED_METRIC_COUNT} distinct labels, got ${JSON.stringify(raw)} — storing null.`);
    return null;
  }
  const present = metricLabelsPresent(rows, tickerA, tickerB);
  const bad = cleaned.filter((l) => l.toLowerCase() !== PRICE_TREND_LABEL.toLowerCase() && !present.has(l.toLowerCase()));
  if (bad.length > 0) {
    console.warn(`[${context}] labels not found in the metrics panel: ${JSON.stringify(bad)} — storing null (game runs legacy scoring).`);
    return null;
  }
  return cleaned.map((l) => (l.toLowerCase() === PRICE_TREND_LABEL.toLowerCase() ? PRICE_TREND_LABEL : l));
}

/** Longest stored per-metric sentence. The prompt asks for under 300; this is the hard cap. */
export const METRIC_NOTE_MAX_CHARS = 400;

/**
 * Mo's per-metric notes (staging) and debrief (settlement). Keeps only the
 * entries whose key matches one of the game's highlighted labels
 * (case-insensitive, trimmed), re-keyed to the stored label spelling, values
 * trimmed and capped at 400 chars. Returns null when the input is not an object
 * or nothing matches. Never throws; a bad notes object must never block a
 * curation run.
 */
export function resolveMetricNotes(
  raw: unknown,
  highlighted: string[] | null,
  context: string
): Record<string, string> | null {
  try {
    if (!highlighted || highlighted.length === 0) return null;
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
    const byLower = new Map(highlighted.map((l) => [l.trim().toLowerCase(), l]));
    const out: Record<string, string> = {};
    const dropped: string[] = [];
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const label = byLower.get(key.trim().toLowerCase());
      const text = typeof value === "string" ? value.trim().slice(0, METRIC_NOTE_MAX_CHARS) : "";
      if (!label || !text) {
        dropped.push(key);
        continue;
      }
      out[label] = text;
    }
    if (dropped.length > 0) {
      console.warn(`[${context}] metric notes dropped (no matching highlighted label, or empty): ${JSON.stringify(dropped)}`);
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch (err) {
    console.warn(`[${context}] metric notes could not be read — storing null:`, err);
    return null;
  }
}

/**
 * The HIGHLIGHTED METRICS block appended to the settlement user message, so Mo
 * writes `highlightedMetricDebrief` against exactly the stored labels, values and
 * its own pre-open notes. Returns "" for a game without highlights.
 */
export function describeHighlightedMetricsForAgent(
  game: {
    companyATicker: string;
    companyBTicker: string;
    highlightedMetrics: string[] | null;
    highlightedMetricNotes?: Record<string, string> | null;
  },
  researchRows: MetricRow[]
): string {
  const highlights = game.highlightedMetrics;
  if (!highlights || highlights.length === 0) return "";
  const lines = highlights.map((label) => {
    let shown: string;
    if (label.trim().toLowerCase() === PRICE_TREND_LABEL.toLowerCase()) {
      shown = "(the 20-session chart)";
    } else {
      const { valueA, valueB } = valuesForMetric(researchRows, label, game.companyATicker, game.companyBTicker);
      shown = `${game.companyATicker} ${valueA ?? "n/a"} | ${game.companyBTicker} ${valueB ?? "n/a"}`;
    }
    const note = game.highlightedMetricNotes?.[label];
    return `- ${label}: ${shown}${note ? ` — Mo's pre-open note: "${note}"` : ""}`;
  });
  return `HIGHLIGHTED METRICS for the concluded game (write highlightedMetricDebrief with exactly these keys):\n${lines.join("\n")}`;
}

/**
 * Practice-mode v2 scoring (practice spec 2026-10-12). Pure: resolves the
 * objective side of the chosen reason metric exactly as live settlement does,
 * then scores with calculateScoreV2.
 */
export function scorePracticeV2(input: {
  finalSelection: "A" | "B";
  winner: "A" | "B";
  reasonMetric?: string | null;
  reasonSide?: "A" | "B" | null;
  confidence?: ConfidenceLevel | null;
  validationAnswer?: string | null;
  correctAnswer: string;
  metricRows: MetricRow[];
  tickerA: string;
  tickerB: string;
}) {
  let objectiveSide: "A" | "B" | null = null;
  if (input.reasonMetric && input.reasonMetric.toLowerCase() !== PRICE_TREND_LABEL.toLowerCase()) {
    const { valueA, valueB } = valuesForMetric(input.metricRows, input.reasonMetric, input.tickerA, input.tickerB);
    objectiveSide = objectiveSideForMetric(input.reasonMetric, valueA, valueB);
  }
  return calculateScoreV2({
    finalSelection: input.finalSelection,
    winner: input.winner,
    reasonMetric: input.reasonMetric,
    reasonSide: input.reasonSide,
    objectiveSide,
    confidence: input.confidence,
    validationAnswer: input.validationAnswer,
    correctAnswer: input.correctAnswer,
  });
}
