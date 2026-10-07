/**
 * Scoring v2 helpers for a game's highlighted metrics (build spec 2026-10-07).
 * Pure functions: parse the "{TICKER} {Label}" metric rows, validate Mo's four
 * highlighted labels, and look up the two values for a label.
 */
import { HIGHLIGHTED_METRIC_COUNT, PRICE_TREND_LABEL } from "@shared/const";

export interface MetricRow {
  label: string;
  value: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Splits a stored metric label into its side and un-prefixed label.
 * Handles "WDC P/E Ratio" and the older "AMD — Market Cap" / "AMD - Beta".
 */
export function splitMetricLabel(
  rawLabel: string,
  tickerA: string,
  tickerB: string
): { side: "A" | "B"; label: string } | null {
  const label = rawLabel.trim();
  for (const [side, ticker] of [["A", tickerA], ["B", tickerB]] as const) {
    if (!ticker) continue;
    const m = label.match(new RegExp(`^${escapeRe(ticker)}\\s*(?:[—–-]\\s*)?(.+)$`, "i"));
    if (m && m[1].trim()) return { side, label: m[1].trim() };
  }
  return null;
}

/** Un-prefixed labels present for both companies (case-insensitive keys, original casing kept). */
export function metricLabelsPresent(rows: MetricRow[], tickerA: string, tickerB: string): Set<string> {
  const out = new Set<string>();
  for (const r of rows) {
    const parsed = splitMetricLabel(r.label, tickerA, tickerB);
    if (parsed) out.add(parsed.label.toLowerCase());
  }
  return out;
}

/** Both companies' values for an un-prefixed label, or undefined values when absent. */
export function valuesForMetric(
  rows: MetricRow[],
  label: string,
  tickerA: string,
  tickerB: string
): { valueA?: string; valueB?: string } {
  const want = label.trim().toLowerCase();
  let valueA: string | undefined;
  let valueB: string | undefined;
  for (const r of rows) {
    const parsed = splitMetricLabel(r.label, tickerA, tickerB);
    if (!parsed || parsed.label.toLowerCase() !== want) continue;
    if (parsed.side === "A") valueA = r.value;
    else valueB = r.value;
  }
  return { valueA, valueB };
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
