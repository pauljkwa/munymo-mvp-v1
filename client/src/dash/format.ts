// Small formatting helpers for the owner dashboard. Moved from the old
// AdminCosts page (references/owner-dashboard-spec.md §7), plus the clock bits
// the Today section needs.

export const NY_TZ = "America/New_York";

export const RUN_KIND_LABELS: Record<string, string> = {
  daily_combined: "Full run",
  daily_results_only: "Results only",
  staging: "Staging",
  backfill_highlights: "Backfill",
  metric_explanation: "Metric note",
};

export const usd = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? "unpriced" : `$${n.toFixed(digits)}`;

export function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function formatWhen(value: Date | string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "2:03 pm" in the viewer's own timezone. */
export function formatClock(value: Date | string): string {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

/** "2:45 pm" on the New York clock, the timezone every scheduled run is defined in. */
export function formatNyClock(value: Date | string): string {
  return new Date(value)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: NY_TZ })
    .toLowerCase();
}

/** "3 h 12 m", "12 m", "2 d 4 h". Rounded down to the minute; under a minute reads "under 1 m". */
export function formatCountdown(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 1) return "under 1 m";
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} m`;
  return `${m} m`;
}

/** "Tue Oct 20" from a YYYY-MM-DD market date (no timezone shifting). */
export function formatGameDate(gameDate: string): string {
  const [y, m, d] = gameDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The UTC month the AI usage is bucketed by (matches monthKey in shared/aiUsage.ts). */
export function currentUtcMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function formatTotals(totals: Record<string, number>): string {
  const parts = Object.entries(totals).map(([cur, n]) => `${cur} ${n.toFixed(2)}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}
