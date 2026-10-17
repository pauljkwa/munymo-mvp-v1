/**
 * Pure aggregation maths for the running-costs ledger (spec §6). The admin
 * procedures are thin wrappers over these so the numbers are testable without
 * a database. Browser-safe: no zod, no server imports.
 */

export const VENDOR_CATEGORIES = ["run", "build"] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

/** Vendors offered by the entry form. "Other" lets the admin type a free-text name. */
export const VENDOR_OPTIONS = [
  { name: "Railway", category: "run" },
  { name: "TiDB Cloud", category: "run" },
  { name: "Clerk", category: "run" },
  { name: "Resend", category: "run" },
  { name: "Cloudflare", category: "run" },
  { name: "Domain", category: "run" },
  { name: "Anthropic API", category: "run" },
  { name: "Claude Max plan", category: "build" },
] as const satisfies ReadonlyArray<{ name: string; category: VendorCategory }>;

/** The vendor name whose entered figure is reconciled against the computed AI spend. */
export const ANTHROPIC_VENDOR = "Anthropic API";

/** Claude Max plan is a build cost; everything else defaults to a run cost. */
export function defaultCategoryForVendor(vendor: string): VendorCategory {
  return VENDOR_OPTIONS.find((v) => v.name === vendor)?.category ?? "run";
}

type DateLike = Date | string | number;

/** The columns of ai_usage_log the aggregations read. Decimals may arrive as strings. */
export type AiUsageRowLike = {
  rowKind: string;
  runId: string;
  runKind: string;
  trigger: string;
  gameDate: string | null;
  inputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWrite5mTokens: number | null;
  cacheWrite1hTokens: number | null;
  webSearchRequests: number | null;
  failedOver: boolean;
  estimatedCostUsd: number | string | null;
  outcome: string | null;
  errorMessage: string | null;
  submitAttempts: number | null;
  durationMs: number | null;
  createdAt: DateLike;
};

export type GameDateSummary = {
  gameDate: string;
  costUsd: number;
  turns: number;
  runs: number;
  failedRuns: number;
  failoverTurns: number;
  webSearches: number;
};

export type RunSummary = {
  runId: string;
  runKind: string;
  trigger: string;
  gameDate: string | null;
  outcome: string | null;
  errorMessage: string | null;
  submitAttempts: number | null;
  durationMs: number | null;
  costUsd: number | null;
  createdAt: Date;
};

export type AiSummary = {
  monthToDateUsd: number;
  last30DaysUsd: number;
  unpricedTurns: number;
  byGameDate: GameDateSummary[];
  runs: RunSummary[];
  /** 0..1 share of input-side tokens served from cache; null when there were no turns. */
  cacheHitRate: number | null;
};

const MAX_RUN_ROWS = 40;
const MAX_GAME_DATE_ROWS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (d: DateLike): Date => (d instanceof Date ? d : new Date(d));
const toCost = (c: number | string | null | undefined): number | null =>
  c === null || c === undefined ? null : Number(c);
const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** `YYYY-MM` of a moment, in UTC (Anthropic bills in UTC). */
export function monthKey(d: DateLike): string {
  return toDate(d).toISOString().slice(0, 7);
}

/**
 * Summarises a window of ai_usage_log rows. Costs sum TURN rows only (a run
 * row's cost is already the sum of its turns). `days` is the window for the
 * per-game-day table, unpriced count and cache hit rate; month-to-date and
 * last-30-days are fixed windows, so the caller must pass rows covering the
 * longest of them.
 */
export function summarizeTurns(
  rows: AiUsageRowLike[],
  opts: { now?: Date; days?: number } = {}
): AiSummary {
  const now = opts.now ?? new Date();
  const days = opts.days ?? 30;
  const windowStart = now.getTime() - days * DAY_MS;
  const last30Start = now.getTime() - 30 * DAY_MS;
  const currentMonth = monthKey(now);

  let monthToDate = 0;
  let last30 = 0;
  let unpriced = 0;
  let cacheRead = 0;
  let inputSide = 0;
  const byDate = new Map<string, GameDateSummary>();
  const entry = (gameDate: string): GameDateSummary => {
    let e = byDate.get(gameDate);
    if (!e) {
      e = { gameDate, costUsd: 0, turns: 0, runs: 0, failedRuns: 0, failoverTurns: 0, webSearches: 0 };
      byDate.set(gameDate, e);
    }
    return e;
  };
  const runRows: Array<{ row: AiUsageRowLike; at: Date }> = [];

  for (const row of rows) {
    const at = toDate(row.createdAt);
    const t = at.getTime();
    const cost = toCost(row.estimatedCostUsd);

    if (row.rowKind === "turn") {
      if (cost !== null) {
        if (monthKey(at) === currentMonth) monthToDate += cost;
        if (t >= last30Start) last30 += cost;
      }
      if (t < windowStart) continue;
      if (cost === null) unpriced++;
      cacheRead += row.cacheReadTokens ?? 0;
      inputSide +=
        (row.cacheReadTokens ?? 0) +
        (row.inputTokens ?? 0) +
        (row.cacheWrite5mTokens ?? 0) +
        (row.cacheWrite1hTokens ?? 0);
      if (row.gameDate) {
        const e = entry(row.gameDate);
        e.turns++;
        if (cost !== null) e.costUsd += cost;
        if (row.failedOver) e.failoverTurns++;
        e.webSearches += row.webSearchRequests ?? 0;
      }
    } else if (row.rowKind === "run") {
      runRows.push({ row, at });
      if (t >= windowStart && row.gameDate) {
        const e = entry(row.gameDate);
        e.runs++;
        if (row.outcome === "failed") e.failedRuns++;
      }
    }
  }

  const byGameDate = Array.from(byDate.values())
    .map((e) => ({ ...e, costUsd: round6(e.costUsd) }))
    .sort((a, b) => (a.gameDate < b.gameDate ? 1 : a.gameDate > b.gameDate ? -1 : 0))
    .slice(0, MAX_GAME_DATE_ROWS);

  const runs: RunSummary[] = runRows
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, MAX_RUN_ROWS)
    .map(({ row, at }) => ({
      runId: row.runId,
      runKind: row.runKind,
      trigger: row.trigger,
      gameDate: row.gameDate,
      outcome: row.outcome,
      errorMessage: row.errorMessage,
      submitAttempts: row.submitAttempts,
      durationMs: row.durationMs,
      costUsd: toCost(row.estimatedCostUsd),
      createdAt: at,
    }));

  return {
    monthToDateUsd: round6(monthToDate),
    last30DaysUsd: round6(last30),
    unpricedTurns: unpriced,
    byGameDate,
    runs,
    cacheHitRate: inputSide > 0 ? cacheRead / inputSide : null,
  };
}

/** Computed AI spend per UTC month (turn rows only), for reconciling against the Anthropic invoice. */
export function aiCostByMonth(
  rows: Array<Pick<AiUsageRowLike, "rowKind" | "estimatedCostUsd" | "createdAt">>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (row.rowKind !== "turn") continue;
    const cost = toCost(row.estimatedCostUsd);
    if (cost === null) continue;
    const key = monthKey(row.createdAt);
    out[key] = (out[key] ?? 0) + cost;
  }
  for (const k of Object.keys(out)) out[k] = round6(out[k]);
  return out;
}

export type VendorCostRowLike = {
  id: number;
  month: string;
  vendor: string;
  category: string;
  amount: number | string;
  currency: string;
  note: string | null;
};

export type VendorMonth<R extends VendorCostRowLike = VendorCostRowLike> = {
  month: string;
  entries: R[];
  /** Per category, per currency — no conversion is attempted. */
  totals: { run: Record<string, number>; build: Record<string, number> };
  /** AI spend computed from ai_usage_log for this month (null when nothing was logged). */
  computedAnthropicUsd: number | null;
  /** What was entered for the "Anthropic API" vendor in USD (null when not entered). */
  enteredAnthropicUsd: number | null;
};

/**
 * Groups ledger rows by month (newest first), with run/build totals per
 * currency and the computed Anthropic figure beside the entered one.
 */
export function groupVendorCosts<R extends VendorCostRowLike>(
  rows: R[],
  aiByMonth: Record<string, number> = {}
): VendorMonth<R>[] {
  const months = new Set<string>([...rows.map((r) => r.month), ...Object.keys(aiByMonth)]);
  return Array.from(months)
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((month) => {
      const entries = rows
        .filter((r) => r.month === month)
        .sort((a, b) => (a.vendor < b.vendor ? -1 : a.vendor > b.vendor ? 1 : 0));
      const totals: VendorMonth["totals"] = { run: {}, build: {} };
      let enteredAnthropic: number | null = null;
      for (const r of entries) {
        const bucket = r.category === "build" ? totals.build : totals.run;
        bucket[r.currency] = round2((bucket[r.currency] ?? 0) + Number(r.amount));
        if (r.vendor === ANTHROPIC_VENDOR && r.currency === "USD") {
          enteredAnthropic = round2((enteredAnthropic ?? 0) + Number(r.amount));
        }
      }
      return {
        month,
        entries,
        totals,
        computedAnthropicUsd: aiByMonth[month] ?? null,
        enteredAnthropicUsd: enteredAnthropic,
      };
    });
}
