/**
 * Pure metric-panel helpers shared by the server (scoring, curation) and the
 * client (results pages), so the "Numbers favored" chip can never disagree with
 * the reason score. Moved out of server/scoring.ts and server/highlightedMetrics.ts
 * unchanged; both still re-export them.
 */

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
 * Objective direction for a highlighted metric, from the two panel values.
 * Returns the side the numbers favor, or null when the metric has no safe
 * direction (P/E, beta, market cap, last move, distance from high, earnings
 * date, analyst consensus when both ratings match). Only Revenue Growth
 * qualifies today; "faster is stronger" is the one reading nobody argues with.
 */
export function objectiveSideForMetric(
  label: string,
  valueA: string | undefined,
  valueB: string | undefined
): "A" | "B" | null {
  if (!/revenue growth/i.test(label) || !valueA || !valueB) return null;
  const pct = (v: string) => {
    const m = v.replace(/,/g, "").match(/([+-]?\d+(?:\.\d+)?)\s*%/);
    return m ? parseFloat(m[1]) : null;
  };
  const a = pct(valueA), b = pct(valueB);
  if (a == null || b == null || a === b) return null;
  return a > b ? "A" : "B";
}
