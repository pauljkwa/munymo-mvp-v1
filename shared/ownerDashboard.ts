/**
 * Pure aggregation for the owner dashboard (references/owner-dashboard-spec.md
 * §6). Everything here works on plain rows and a clock passed in by the caller,
 * so the numbers are testable without a database. Browser-safe: no zod, no
 * server imports.
 */
import { TESTER_BOT_IDS } from "./const";
import type { AiUsageRowLike } from "./aiUsage";

const MARKET_TZ = "America/New_York";
const DAY_MS = 24 * 60 * 60 * 1000;

type DateLike = Date | string | number;
const toDate = (d: DateLike): Date => (d instanceof Date ? d : new Date(d));

// ─── Eastern-time helpers ─────────────────────────────────────────────────────

const etFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MARKET_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type EtParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function etParts(at: Date): EtParts {
  const out: Record<string, number> = {};
  for (const p of etFormatter.formatToParts(at)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as EtParts;
}

/** Milliseconds Eastern time is ahead of UTC at an instant (negative: -4h in summer, -5h in winter). */
function etOffsetMs(at: Date): number {
  const p = etParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The UTC instant at which Eastern wall clocks read the given date and time. */
export function etWallToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes: the offset at the guess can differ from the offset at the real
  // instant when the wall time sits next to a clock change.
  const first = guess - etOffsetMs(new Date(guess));
  const second = guess - etOffsetMs(new Date(first));
  return new Date(second);
}

/** Today's date (YYYY-MM-DD) in the market's timezone. */
export function etDateString(now: Date = new Date()): string {
  const p = etParts(now);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// ─── Scheduled runs ───────────────────────────────────────────────────────────

export type CronSlot = { label: string; hour: number; minute: number };

/**
 * The weekday (Mon-Fri) crons in server/_core/index.ts, all in America/New_York.
 * Keep in step with that file: there is no shared source because node-cron
 * takes its expressions as literals.
 */
export const WEEKDAY_CRONS: readonly CronSlot[] = [
  { label: "Streak-at-risk emails", hour: 8, minute: 30 },
  { label: "Lockout sweep", hour: 9, minute: 35 },
  { label: "Staging", hour: 14, minute: 45 },
  { label: "Staging watchdog", hour: 15, minute: 30 },
  { label: "Post-close run", hour: 16, minute: 15 },
  { label: "Watchdog 5:15 pm", hour: 17, minute: 15 },
  { label: "Tester bots", hour: 18, minute: 0 },
  { label: "Watchdog 6:15 pm", hour: 18, minute: 15 },
  { label: "Watchdog 7:15 pm", hour: 19, minute: 15 },
];

export type NextRun = { label: string; atIso: string };

/**
 * The next occurrence of every weekday cron strictly after `now`, soonest first.
 * Weekends roll to Monday and the Eastern clock change is handled by
 * etWallToUtc. Exchange holidays are not known here: the watchdogs are no-ops
 * on a healthy day and the dashboard labels them as scheduled, not guaranteed.
 */
export function nextCronOccurrences(now: Date): NextRun[] {
  const today = etParts(now);
  const found = new Map<string, Date>();
  for (let offset = 0; offset <= 7 && found.size < WEEKDAY_CRONS.length; offset++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    for (const slot of WEEKDAY_CRONS) {
      if (found.has(slot.label)) continue;
      const at = etWallToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), slot.hour, slot.minute);
      if (at.getTime() > now.getTime()) found.set(slot.label, at);
    }
  }
  return Array.from(found.entries())
    .map(([label, at]) => ({ label, atIso: at.toISOString() }))
    .sort((a, b) => (a.atIso < b.atIso ? -1 : a.atIso > b.atIso ? 1 : 0));
}

// ─── Pipeline health ──────────────────────────────────────────────────────────

/** The run kinds that make up the nightly curation pipeline (backfill and metric notes are not it). */
const CURATION_RUN_KINDS = new Set(["daily_combined", "daily_results_only", "staging"]);

export type PipelineSummary = {
  runs30d: number;
  failed30d: number;
  failoverTurns30d: number;
  watchdogRescues30d: number;
  skipped30d: number;
};

/**
 * Curation pipeline counts over the last `days` (default 30) of ai_usage_log
 * rows. A watchdog rescue is a successful run started by a watchdog slot or
 * the boot sweep, i.e. the 4:15 pm run did not finish the job on its own.
 */
export function summarizePipeline(
  rows: AiUsageRowLike[],
  opts: { now?: Date; days?: number } = {}
): PipelineSummary {
  const now = opts.now ?? new Date();
  const since = now.getTime() - (opts.days ?? 30) * DAY_MS;
  const out: PipelineSummary = { runs30d: 0, failed30d: 0, failoverTurns30d: 0, watchdogRescues30d: 0, skipped30d: 0 };

  for (const row of rows) {
    if (toDate(row.createdAt).getTime() < since) continue;
    if (row.rowKind === "turn") {
      if (CURATION_RUN_KINDS.has(row.runKind) && row.failedOver) out.failoverTurns30d++;
    } else if (row.rowKind === "run" && CURATION_RUN_KINDS.has(row.runKind)) {
      out.runs30d++;
      if (row.outcome === "failed") out.failed30d++;
      if (row.outcome === "skipped") out.skipped30d++;
      if (row.outcome === "success" && (row.trigger.startsWith("watchdog-") || row.trigger === "boot-sweep")) {
        out.watchdogRescues30d++;
      }
    }
  }
  return out;
}

// ─── Players ──────────────────────────────────────────────────────────────────

const BOT_IDS = new Set<number>(TESTER_BOT_IDS);

export type OwnerPlayerRow = {
  id: number;
  name: string | null;
  displayName: string | null;
  createdAt: DateLike;
  lastSignedIn: DateLike;
  emailOptIn: boolean;
  pushOptIn: boolean;
  /** streak_records.awayStatus; null when the player has no streak row yet. */
  awayStatus: string | null;
  currentStreak: number | null;
};

/** One row per player who has ever picked: the newest player_picks.createdAt. */
export type OwnerPickActivity = { userId: number; lastPickAt: DateLike };

export type PlayersSummary = {
  total: number;
  new7d: number;
  new30d: number;
  active7d: number;
  active30d: number;
  signedIn7d: number;
  pushUsers: number;
  pushDevices: number;
  emailOptIn: number;
  pushOptIn: number;
  away: number;
  missing: number;
  topStreaks: Array<{ name: string; streak: number }>;
  churned: number;
};

const TOP_STREAKS = 5;

/**
 * Player numbers for the dashboard. Tester bots are dropped from every input
 * here, whatever the caller fetched. "Active" means made a pick (not signed
 * in); "churned" means picked at least once but not in the last 30 days.
 */
export function summarizePlayers(input: {
  users: OwnerPlayerRow[];
  picks: OwnerPickActivity[];
  /** One entry per registered push device (a user with two devices appears twice). */
  pushSubscriptionUserIds: number[];
  now?: Date;
  /** Public-safe display name; the router passes publicPlayerName. */
  nameOf?: (row: { displayName: string | null; name: string | null }) => string | null;
}): PlayersSummary {
  const now = (input.now ?? new Date()).getTime();
  const d7 = now - 7 * DAY_MS;
  const d30 = now - 30 * DAY_MS;
  const nameOf = input.nameOf ?? ((r) => r.displayName ?? r.name);

  const users = input.users.filter((u) => !BOT_IDS.has(u.id));
  const picks = input.picks.filter((p) => !BOT_IDS.has(p.userId));
  const devices = input.pushSubscriptionUserIds.filter((id) => !BOT_IDS.has(id));

  const out: PlayersSummary = {
    total: users.length,
    new7d: 0,
    new30d: 0,
    active7d: 0,
    active30d: 0,
    signedIn7d: 0,
    pushUsers: new Set(devices).size,
    pushDevices: devices.length,
    emailOptIn: 0,
    pushOptIn: 0,
    away: 0,
    missing: 0,
    topStreaks: [],
    churned: 0,
  };

  for (const u of users) {
    const created = toDate(u.createdAt).getTime();
    if (created >= d7) out.new7d++;
    if (created >= d30) out.new30d++;
    if (toDate(u.lastSignedIn).getTime() >= d7) out.signedIn7d++;
    if (u.emailOptIn) out.emailOptIn++;
    if (u.pushOptIn) out.pushOptIn++;
    if (u.awayStatus === "away") out.away++;
    if (u.awayStatus === "missing") out.missing++;
  }

  for (const p of picks) {
    const last = toDate(p.lastPickAt).getTime();
    if (last >= d7) out.active7d++;
    if (last >= d30) out.active30d++;
    else out.churned++;
  }

  out.topStreaks = users
    .filter((u) => (u.currentStreak ?? 0) > 0)
    .sort((a, b) => (b.currentStreak ?? 0) - (a.currentStreak ?? 0) || a.id - b.id)
    .slice(0, TOP_STREAKS)
    .map((u) => ({ name: nameOf(u) ?? "Player", streak: u.currentStreak ?? 0 }));

  return out;
}
