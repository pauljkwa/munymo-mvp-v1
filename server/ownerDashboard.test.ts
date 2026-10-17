/**
 * Owner dashboard aggregation (shared/ownerDashboard.ts,
 * references/owner-dashboard-spec.md §6). Pure functions, no database.
 */
import { describe, expect, it } from "vitest";
import type { AiUsageRowLike } from "@shared/aiUsage";
import { TESTER_BOT_IDS } from "@shared/const";
import {
  WEEKDAY_CRONS,
  etDateString,
  etWallToUtc,
  nextCronOccurrences,
  summarizePipeline,
  summarizePlayers,
  type OwnerPlayerRow,
} from "@shared/ownerDashboard";

const next = (iso: string) => nextCronOccurrences(new Date(iso));
const first = (iso: string) => next(iso)[0];

describe("etWallToUtc", () => {
  it("uses -4h in summer and -5h in winter", () => {
    expect(etWallToUtc(2026, 10, 19, 8, 30).toISOString()).toBe("2026-10-19T12:30:00.000Z");
    expect(etWallToUtc(2026, 11, 2, 8, 30).toISOString()).toBe("2026-11-02T13:30:00.000Z");
  });
});

describe("etDateString", () => {
  it("is the New York date, not the UTC one", () => {
    // 01:00 UTC on the 17th is still 9 pm on the 16th in New York.
    expect(etDateString(new Date("2026-10-17T01:00:00Z"))).toBe("2026-10-16");
    expect(etDateString(new Date("2026-10-17T05:00:00Z"))).toBe("2026-10-17");
  });
});

describe("nextCronOccurrences", () => {
  it("returns one entry per weekday cron, soonest first", () => {
    const runs = next("2026-10-14T15:00:00Z"); // Wednesday 11:00 EDT
    expect(runs).toHaveLength(WEEKDAY_CRONS.length);
    const times = runs.map((r) => r.atIso);
    expect([...times].sort()).toEqual(times);
    expect(new Set(runs.map((r) => r.label)).size).toBe(WEEKDAY_CRONS.length);
  });

  it("mid-day Wednesday: today's afternoon runs first, then Thursday's morning ones", () => {
    const runs = next("2026-10-14T15:00:00Z");
    expect(runs.map((r) => [r.label, r.atIso])).toEqual([
      ["Staging", "2026-10-14T18:45:00.000Z"],
      ["Staging watchdog", "2026-10-14T19:30:00.000Z"],
      ["Post-close run", "2026-10-14T20:15:00.000Z"],
      ["Watchdog 5:15 pm", "2026-10-14T21:15:00.000Z"],
      ["Tester bots", "2026-10-14T22:00:00.000Z"],
      ["Watchdog 6:15 pm", "2026-10-14T22:15:00.000Z"],
      ["Watchdog 7:15 pm", "2026-10-14T23:15:00.000Z"],
      ["Streak-at-risk emails", "2026-10-15T12:30:00.000Z"],
      ["Lockout sweep", "2026-10-15T13:35:00.000Z"],
    ]);
  });

  it("Friday evening rolls to Monday 8:30 am", () => {
    // Friday 2026-10-16, 9 pm EDT
    expect(first("2026-10-17T01:00:00Z")).toEqual({ label: "Streak-at-risk emails", atIso: "2026-10-19T12:30:00.000Z" });
  });

  it("a Saturday rolls to Monday too, for every cron", () => {
    const runs = next("2026-10-17T16:00:00Z");
    expect(runs).toHaveLength(WEEKDAY_CRONS.length);
    for (const r of runs) expect(r.atIso.startsWith("2026-10-19T")).toBe(true);
  });

  it("Sunday rolls to Monday", () => {
    expect(first("2026-10-18T20:00:00Z").atIso).toBe("2026-10-19T12:30:00.000Z");
  });

  it("spring forward (Sunday 8 March 2026): Friday evening lands on Monday in EDT", () => {
    // Friday 6 March, 9 pm EST; Monday 9 March is already EDT (UTC-4).
    expect(first("2026-03-07T02:00:00Z").atIso).toBe("2026-03-09T12:30:00.000Z");
  });

  it("spring forward: the Friday before is still EST (UTC-5)", () => {
    // Friday 6 March, 7:00 am EST
    expect(first("2026-03-06T12:00:00Z").atIso).toBe("2026-03-06T13:30:00.000Z");
  });

  it("fall back (Sunday 1 November 2026): Friday evening lands on Monday in EST", () => {
    // Friday 30 October, 9 pm EDT; Monday 2 November is EST (UTC-5).
    expect(first("2026-10-31T01:00:00Z").atIso).toBe("2026-11-02T13:30:00.000Z");
  });

  it("fall back: Monday after the change, 7 am EST, finds 8:30 EST the same day", () => {
    expect(first("2026-11-02T12:00:00Z").atIso).toBe("2026-11-02T13:30:00.000Z");
  });

  it("is strictly after now: a run happening this very instant is not 'next'", () => {
    const atStaging = "2026-10-14T18:45:00Z";
    const runs = next(atStaging);
    expect(runs.find((r) => r.label === "Staging")?.atIso).toBe("2026-10-15T18:45:00.000Z");
    expect(runs[0].label).toBe("Staging watchdog");
  });
});

// ─── summarizePipeline ────────────────────────────────────────────────────────

const NOW = new Date("2026-10-17T12:00:00Z");

function row(over: Partial<AiUsageRowLike>): AiUsageRowLike {
  return {
    rowKind: "run",
    runId: "r1",
    runKind: "daily_combined",
    trigger: "cron-1615",
    gameDate: "2026-10-16",
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
    webSearchRequests: 0,
    failedOver: false,
    estimatedCostUsd: null,
    outcome: "success",
    errorMessage: null,
    submitAttempts: 1,
    durationMs: 1000,
    createdAt: new Date("2026-10-16T20:20:00Z"),
    ...over,
  };
}

describe("summarizePipeline", () => {
  const rows: AiUsageRowLike[] = [
    row({ runKind: "staging", trigger: "cron-1445" }), // success
    row({ trigger: "cron-1615", outcome: "failed", errorMessage: "overloaded" }),
    row({ trigger: "watchdog-1715ET", outcome: "success" }), // rescue
    row({ trigger: "boot-sweep", outcome: "success", runKind: "daily_results_only" }), // rescue
    row({ trigger: "watchdog-1815ET", outcome: "failed" }), // failed watchdog is not a rescue
    row({ trigger: "cron-1530-watchdog", runKind: "staging", outcome: "skipped" }),
    row({ rowKind: "turn", failedOver: true }),
    row({ rowKind: "turn", failedOver: true, runKind: "staging" }),
    row({ rowKind: "turn", failedOver: false }),
    // Outside the window
    row({ createdAt: new Date("2026-09-10T20:00:00Z"), outcome: "failed" }),
    row({ rowKind: "turn", failedOver: true, createdAt: new Date("2026-09-10T20:00:00Z") }),
    // Not part of the nightly pipeline
    row({ runKind: "backfill_highlights", trigger: "admin-backfill", outcome: "failed" }),
    row({ rowKind: "turn", runKind: "metric_explanation", trigger: "player-request", failedOver: true }),
  ];

  const s = summarizePipeline(rows, { now: NOW });

  it("counts curation runs in the window", () => {
    expect(s.runs30d).toBe(6);
  });
  it("counts failed and skipped runs", () => {
    expect(s.failed30d).toBe(2);
    expect(s.skipped30d).toBe(1);
  });
  it("counts only successful watchdog and boot-sweep runs as rescues", () => {
    expect(s.watchdogRescues30d).toBe(2);
  });
  it("counts failover turns in the window, curation kinds only", () => {
    expect(s.failoverTurns30d).toBe(2);
  });
  it("is all zeros for no rows", () => {
    expect(summarizePipeline([], { now: NOW })).toEqual({
      runs30d: 0,
      failed30d: 0,
      failoverTurns30d: 0,
      watchdogRescues30d: 0,
      skipped30d: 0,
    });
  });
});

// ─── summarizePlayers ─────────────────────────────────────────────────────────

const day = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

function player(id: number, over: Partial<OwnerPlayerRow> = {}): OwnerPlayerRow {
  return {
    id,
    name: `Player ${id}`,
    displayName: null,
    createdAt: day(100),
    lastSignedIn: day(100),
    emailOptIn: true,
    pushOptIn: true,
    awayStatus: "active",
    currentStreak: 0,
    ...over,
  };
}

describe("summarizePlayers", () => {
  const bot = TESTER_BOT_IDS[0];
  const users: OwnerPlayerRow[] = [
    player(1, { createdAt: day(2), lastSignedIn: day(1), currentStreak: 12, name: "Alice Anders", displayName: "Alice A." }),
    player(2, { createdAt: day(20), lastSignedIn: day(3), currentStreak: 3, awayStatus: "away", emailOptIn: false }),
    player(3, { createdAt: day(60), lastSignedIn: day(40), awayStatus: "missing", pushOptIn: false }),
    player(4, { createdAt: day(60), lastSignedIn: day(9), currentStreak: null, awayStatus: null }),
    // Bots: every one of these would distort every number if it leaked through
    player(bot, { createdAt: day(1), lastSignedIn: day(0), currentStreak: 99, awayStatus: "away" }),
    player(TESTER_BOT_IDS[1], { createdAt: day(5), lastSignedIn: day(0), currentStreak: 50 }),
  ];
  const picks = [
    { userId: 1, lastPickAt: day(1) }, // active 7 and 30
    { userId: 2, lastPickAt: day(10) }, // active 30 only
    { userId: 3, lastPickAt: day(45) }, // churned
    { userId: bot, lastPickAt: day(0) }, // bot: must not count
    { userId: TESTER_BOT_IDS[1], lastPickAt: day(60) }, // bot: must not count as churned
  ];
  const pushSubscriptionUserIds = [1, 1, 2, bot, bot, bot];

  const s = summarizePlayers({ users, picks, pushSubscriptionUserIds, now: NOW });

  it("excludes tester bots from the totals", () => {
    expect(s.total).toBe(4);
  });
  it("counts new players by sign-up date", () => {
    expect(s.new7d).toBe(1);
    expect(s.new30d).toBe(2);
  });
  it("counts active players by picks, not sign-ins", () => {
    expect(s.active7d).toBe(1);
    expect(s.active30d).toBe(2);
    expect(s.signedIn7d).toBe(2);
  });
  it("counts churned players: picked once, nothing in 30 days, bots excluded", () => {
    expect(s.churned).toBe(1);
  });
  it("counts push users and devices without the bots' devices", () => {
    expect(s.pushUsers).toBe(2);
    expect(s.pushDevices).toBe(3);
  });
  it("counts opt-ins and away statuses", () => {
    expect(s.emailOptIn).toBe(3);
    expect(s.pushOptIn).toBe(3);
    expect(s.away).toBe(1);
    expect(s.missing).toBe(1);
  });
  it("lists the longest streaks with bots left out", () => {
    expect(s.topStreaks).toEqual([
      { name: "Alice A.", streak: 12 },
      { name: "Player 2", streak: 3 },
    ]);
  });
  it("uses the supplied public-name function", () => {
    const t = summarizePlayers({ users, picks, pushSubscriptionUserIds, now: NOW, nameOf: (r) => `pub:${r.displayName ?? r.name}` });
    expect(t.topStreaks[0].name).toBe("pub:Alice A.");
  });
  it("caps the streak list at five", () => {
    const many = Array.from({ length: 8 }, (_, i) => player(100 + i, { currentStreak: 10 + i }));
    const t = summarizePlayers({ users: many, picks: [], pushSubscriptionUserIds: [], now: NOW });
    expect(t.topStreaks.map((p) => p.streak)).toEqual([17, 16, 15, 14, 13]);
  });
  it("handles an empty site", () => {
    const t = summarizePlayers({ users: [], picks: [], pushSubscriptionUserIds: [], now: NOW });
    expect(t.total).toBe(0);
    expect(t.topStreaks).toEqual([]);
    expect(t.churned).toBe(0);
  });
});
