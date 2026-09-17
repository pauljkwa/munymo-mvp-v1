/**
 * Munymo MVP — Server-side unit tests
 * All tests import real production functions from scoring.ts and routers.ts.
 * No logic is duplicated or mirrored here.
 */
import { describe, expect, it } from "vitest";
import {
  calculateScore,
  checkLockout,
  computeNewStreak,
  computeValidationScore,
  resolveWinner,
  isQualified,
  shuffleOptionsForGame,
  computeProjectedRank,
  computeAverageDailyScore,
  LEADERBOARD_QUALIFICATION_THRESHOLD,
} from "./scoring";
import { LEADERBOARD_QUALIFICATION_GAMES } from "@shared/const";

// ─── Score Calculation ────────────────────────────────────────────────────────
describe("calculateScore — 80/20 model (production function)", () => {
  it("awards 100 when prediction correct and validation correct", () => {
    const r = calculateScore("A", "A", "Yes", "Yes");
    expect(r.predictionScore).toBe(80);
    expect(r.validationScore).toBe(20);
    expect(r.dailyScore).toBe(100);
  });

  it("awards 80 when prediction correct but validation wrong", () => {
    const r = calculateScore("A", "A", "No", "Yes");
    expect(r.predictionScore).toBe(80);
    expect(r.validationScore).toBe(0);
    expect(r.dailyScore).toBe(80);
  });

  it("awards 20 when prediction wrong but validation correct", () => {
    const r = calculateScore("B", "A", "Yes", "Yes");
    expect(r.predictionScore).toBe(0);
    expect(r.validationScore).toBe(20);
    expect(r.dailyScore).toBe(20);
  });

  it("awards 0 when both prediction and validation are wrong", () => {
    const r = calculateScore("B", "A", "No", "Yes");
    expect(r.predictionScore).toBe(0);
    expect(r.validationScore).toBe(0);
    expect(r.dailyScore).toBe(0);
  });

  it("awards 0 prediction when finalSelection is null (incomplete submission)", () => {
    const r = calculateScore(null, "A", "Yes", "Yes");
    expect(r.predictionScore).toBe(0);
    expect(r.validationScore).toBe(20);
  });

  it("awards 0 validation when validationAnswer is null", () => {
    const r = calculateScore("A", "A", null, "Yes");
    expect(r.predictionScore).toBe(80);
    expect(r.validationScore).toBe(0);
  });

  it("is case-sensitive for validation answer matching", () => {
    const r = calculateScore("A", "A", "yes", "Yes");
    expect(r.validationScore).toBe(0);
  });

  it("works correctly for company B winning", () => {
    const r = calculateScore("B", "B", "True", "True");
    expect(r.dailyScore).toBe(100);
  });

  it("applies time-decay when answerTimeMs is passed and mid-range", () => {
    const r = calculateScore("A", "A", "Yes", "Yes", 40_000);
    expect(r.validationScore).toBeGreaterThan(12);
    expect(r.validationScore).toBeLessThan(20);
  });
});

describe("computeValidationScore — time-decay (production function)", () => {
  it("returns 0 when answer is incorrect, regardless of timing", () => {
    expect(computeValidationScore(false, 1_000)).toBe(0);
    expect(computeValidationScore(false, null)).toBe(0);
  });

  it("returns full 20 when correct and no timing data (backward compatible)", () => {
    expect(computeValidationScore(true, null)).toBe(20);
    expect(computeValidationScore(true, undefined)).toBe(20);
  });

  it("returns full 20 at and below the fast threshold (15_000ms)", () => {
    expect(computeValidationScore(true, 15_000)).toBe(20);
    expect(computeValidationScore(true, 0)).toBe(20);
    expect(computeValidationScore(true, 5_000)).toBe(20);
  });

  it("returns minimum 12 at and above the slow threshold (60_000ms)", () => {
    expect(computeValidationScore(true, 60_000)).toBe(12);
    expect(computeValidationScore(true, 120_000)).toBe(12);
  });

  it("decays linearly between the fast and slow thresholds", () => {
    const midway = computeValidationScore(true, 37_500); // halfway between 15s and 60s
    expect(midway).toBeGreaterThan(12);
    expect(midway).toBeLessThan(20);
  });
});

// ─── Lockout Enforcement ─────────────────────────────────────────────────────
describe("checkLockout — server-side enforcement (production function)", () => {
  it("allows submission when game is active and before lockout", () => {
    const future = new Date(Date.now() + 3_600_000);
    expect(checkLockout("active", future, new Date()).allowed).toBe(true);
  });

  it("blocks submission when game status is 'locked'", () => {
    const r = checkLockout("locked", null, new Date());
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/locked/i);
  });

  it("blocks submission when game status is 'result_published'", () => {
    expect(checkLockout("result_published", null, new Date()).allowed).toBe(false);
  });

  it("blocks submission when game status is 'cancelled'", () => {
    expect(checkLockout("cancelled", null, new Date()).allowed).toBe(false);
  });

  it("blocks submission when lockoutAt is in the past", () => {
    const past = new Date(Date.now() - 1_000);
    const r = checkLockout("active", past, new Date());
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/deadline/i);
  });

  it("blocks submission exactly at the lockout moment (boundary — >= enforced)", () => {
    const now = new Date();
    expect(checkLockout("active", now, now).allowed).toBe(false);
  });

  it("allows submission when no lockoutAt is set", () => {
    expect(checkLockout("active", null, new Date()).allowed).toBe(true);
  });

  it("allows submission when game is active and lockoutAt is undefined", () => {
    expect(checkLockout("active", undefined, new Date()).allowed).toBe(true);
  });
});

// ─── Streak Logic ─────────────────────────────────────────────────────────────
describe("computeNewStreak — streak rules (production function)", () => {
  it("starts streak at 1 for first participation", () => {
    const r = computeNewStreak("active", null, 0, 0, "2025-01-01");
    expect(r.newCurrent).toBe(1);
  });

  it("increments streak on consecutive day", () => {
    const r = computeNewStreak("active", "2025-01-01", 3, 5, "2025-01-02");
    expect(r.newCurrent).toBe(4);
  });

  it("resets streak to 1 when gap of 2+ days (Missing status effect)", () => {
    // 3 calendar days gap; pass missedTradingDays=2 to simulate two skipped published games
    const r = computeNewStreak("active", "2025-01-01", 5, 10, "2025-01-04", 2);
    expect(r.newCurrent).toBe(1);
    expect(r.newLongest).toBe(10); // longest preserved
  });

  it("preserves streak and advances date when Away status is set (T2)", () => {
    const r = computeNewStreak("away", "2025-01-01", 7, 7, "2025-01-03");
    expect(r.newCurrent).toBe(7);
    expect(r.newLongest).toBe(7);
  });

  it("updates longest streak when current exceeds previous longest", () => {
    const r = computeNewStreak("active", "2025-01-10", 9, 9, "2025-01-11");
    expect(r.newCurrent).toBe(10);
    expect(r.newLongest).toBe(10);
  });

  it("does not reduce longest streak when current resets", () => {
    // 9 calendar days gap; pass missedTradingDays=7 to simulate skipped published games
    const r = computeNewStreak("active", "2025-01-01", 5, 12, "2025-01-10", 7);
    expect(r.newCurrent).toBe(1);
    expect(r.newLongest).toBe(12);
  });

  it("Missing status player who participates after gap gets streak reset to 1", () => {
    // Missing status means awayStatus !== 'away', so gap logic applies normally
    // 4 calendar days gap; pass missedTradingDays=3 to simulate skipped published games
    const r = computeNewStreak("missing", "2025-01-01", 8, 8, "2025-01-05", 3);
    expect(r.newCurrent).toBe(1);
  });

  it("does not update streak for same-day duplicate (diffDays === 0)", () => {
    const r = computeNewStreak("active", "2025-01-01", 5, 5, "2025-01-01");
    expect(r.newCurrent).toBe(5); // unchanged
  });

  // ─── T1 regression tests: trading-day streak logic ───────────────────────

  it("T1: Fri→Mon with 0 missed trading days increments streak (weekend gap)", () => {
    // 2026-06-26 is Friday, 2026-06-29 is Monday — no published game between them
    const r = computeNewStreak("active", "2026-06-26", 5, 5, "2026-06-29", 0);
    expect(r.newCurrent).toBe(6);
  });

  it("T1: Mon→Wed with 1 missed trading day (Tue published game) resets streak", () => {
    // Player played Mon, skipped Tue (a published game), plays Wed
    const r = computeNewStreak("active", "2026-06-29", 5, 5, "2026-07-01", 1);
    expect(r.newCurrent).toBe(1);
  });

  it("T1: Mon→Tue consecutive (0 missed) increments streak (regression)", () => {
    const r = computeNewStreak("active", "2026-06-29", 3, 5, "2026-06-30", 0);
    expect(r.newCurrent).toBe(4);
  });

  it("T1: first participation always yields streak=1 regardless of missedTradingDays", () => {
    const r = computeNewStreak("active", null, 0, 0, "2026-06-29", 0);
    expect(r.newCurrent).toBe(1);
  });

  it("T1: same-day or earlier gameDate returns unchanged streak (guard)", () => {
    const r = computeNewStreak("active", "2026-06-29", 5, 5, "2026-06-29", 0);
    expect(r.newCurrent).toBe(5);
  });
});

// ─── T2: Away Status Protection ───────────────────────────────────────────────
describe("T2: away status — streak protected and date advances", () => {
  it("away player: streak unchanged, date advances", () => {
    const r = computeNewStreak("away", "2026-06-29", 10, 10, "2026-07-01", 1);
    expect(r.newCurrent).toBe(10);
    expect(r.newLongest).toBe(10);
  });

  it("away player returning: first active game after many away days increments (0 missed because date was advanced)", () => {
    // Simulates: player was away Mon–Fri, lastParticipationDate advanced to Fri via away logic,
    // returns Monday — missedTradingDays=0 (Fri→Mon, no published game between)
    const r = computeNewStreak("active", "2026-07-03", 10, 10, "2026-07-06", 0);
    expect(r.newCurrent).toBe(11);
  });

  it("away player: same-day call is a no-op (gameDate <= lastParticipationDate guard)", () => {
    const r = computeNewStreak("away", "2026-07-01", 5, 5, "2026-07-01", 0);
    expect(r.newCurrent).toBe(5);
  });
});

// ─── T3: Winner Resolution ────────────────────────────────────────────────────
describe("T3: resolveWinner — ticker guard + perf cross-check", () => {
  it("resolves A when winnerTicker matches company A", () => {
    const r = resolveWinner("AAPL", "MSFT", "AAPL");
    expect(r).toEqual({ winner: "A" });
  });

  it("resolves B when winnerTicker matches company B", () => {
    const r = resolveWinner("AAPL", "MSFT", "MSFT");
    expect(r).toEqual({ winner: "B" });
  });

  it("is case-insensitive on tickers", () => {
    const r = resolveWinner("AAPL", "MSFT", "aapl");
    expect(r).toEqual({ winner: "A" });
  });

  it("returns error when winnerTicker matches neither company", () => {
    const r = resolveWinner("AAPL", "MSFT", "GOOG");
    expect("error" in r).toBe(true);
  });

  it("allows winner A when perf agrees (A higher)", () => {
    const r = resolveWinner("AAPL", "MSFT", "AAPL", 3.5, 1.2);
    expect(r).toEqual({ winner: "A" });
  });

  it("allows winner B when perf agrees (B higher)", () => {
    const r = resolveWinner("AAPL", "MSFT", "MSFT", 1.2, 3.5);
    expect(r).toEqual({ winner: "B" });
  });

  it("returns error when ticker says A but perf says B", () => {
    const r = resolveWinner("AAPL", "MSFT", "AAPL", 1.2, 3.5);
    expect("error" in r).toBe(true);
  });

  it("returns error when ticker says B but perf says A", () => {
    const r = resolveWinner("AAPL", "MSFT", "MSFT", 3.5, 1.2);
    expect("error" in r).toBe(true);
  });

  it("allows on ticker alone when perf numbers are absent", () => {
    const r = resolveWinner("AAPL", "MSFT", "MSFT");
    expect(r).toEqual({ winner: "B" });
  });

  it("A wins when both perfs are equal (Decision 6: A >= B → A wins)", () => {
    const r = resolveWinner("AAPL", "MSFT", "AAPL", 2.0, 2.0);
    expect(r).toEqual({ winner: "A" });
  });
});

// ─── Leaderboard Qualification ────────────────────────────────────────────────
describe("Leaderboard qualification — 20-game threshold (production constants)", () => {
  it("threshold constant is exactly 10", () => {
    expect(LEADERBOARD_QUALIFICATION_THRESHOLD).toBe(10);
  });

  it("reads from the shared constant, so client and server cannot drift", () => {
    expect(LEADERBOARD_QUALIFICATION_THRESHOLD).toBe(LEADERBOARD_QUALIFICATION_GAMES);
  });

  it("is not qualified one game short", () => {
    expect(isQualified(9)).toBe(false);
  });

  it("is qualified with exactly the threshold", () => {
    expect(isQualified(10)).toBe(true);
  });

  it("is qualified with more than the threshold", () => {
    expect(isQualified(35)).toBe(true);
  });

  it("computes average daily score correctly", () => {
    expect(computeAverageDailyScore(1800, 20)).toBe(90);
  });

  it("returns 0 average when no games played", () => {
    expect(computeAverageDailyScore(0, 0)).toBe(0);
  });

  it("rounds average to 2 decimal places", () => {
    expect(computeAverageDailyScore(100, 3)).toBe(33.33);
  });
});

// ─── Public Player Name ───────────────────────────────────────────────────────
// The leaderboard used to select users.name directly, so players saw each
// other's real full name from Clerk instead of the handle they chose on
// /profile. Both leaderboard queries now map through publicPlayerName, which
// falls back to an abbreviated "Paul K" rather than the full name.
import { publicPlayerName, abbreviatePlayerName } from "./db";

describe("abbreviatePlayerName — first name + last initial", () => {
  it("abbreviates a normal two-part name", () => {
    expect(abbreviatePlayerName("Paul Kennedy")).toBe("Paul K");
  });

  it("takes the initial from the surname, not the middle name", () => {
    expect(abbreviatePlayerName("Jane Quinn Smith")).toBe("Jane S");
  });

  it("leaves a single-token name alone", () => {
    expect(abbreviatePlayerName("Prince")).toBe("Prince");
  });

  it("uppercases a lowercase surname initial", () => {
    expect(abbreviatePlayerName("paul kennedy")).toBe("Paul K");
  });

  it("keeps a hyphenated first name intact", () => {
    expect(abbreviatePlayerName("Mary-Jane Watson")).toBe("Mary-Jane W");
  });

  it("preserves internal capitals rather than title-casing", () => {
    expect(abbreviatePlayerName("McDonald Smith")).toBe("McDonald S");
    expect(abbreviatePlayerName("de Souza Silva")).toBe("De S");
  });

  it("ignores a generational suffix", () => {
    expect(abbreviatePlayerName("Paul Kennedy Jr")).toBe("Paul K");
    expect(abbreviatePlayerName("Paul Kennedy Jr.")).toBe("Paul K");
    expect(abbreviatePlayerName("Paul Kennedy III")).toBe("Paul K");
  });

  it("ignores a professional suffix", () => {
    expect(abbreviatePlayerName("Jane Smith MD")).toBe("Jane S");
  });

  it("collapses stray whitespace", () => {
    expect(abbreviatePlayerName("  Paul   Kennedy  ")).toBe("Paul K");
  });

  it("returns null for a null, empty, or whitespace-only name", () => {
    expect(abbreviatePlayerName(null)).toBeNull();
    expect(abbreviatePlayerName("")).toBeNull();
    expect(abbreviatePlayerName("   ")).toBeNull();
  });

  it("never returns the full surname", () => {
    expect(abbreviatePlayerName("Paul Kennedy")).not.toContain("Kennedy");
  });
});

describe("publicPlayerName — leaderboard shows the chosen display name", () => {
  it("prefers the chosen display name over the real name", () => {
    expect(publicPlayerName({ displayName: "MarketMaven", name: "Jane Q. Smith" })).toBe(
      "MarketMaven"
    );
  });

  it("uses the display name verbatim, never abbreviating a chosen handle", () => {
    expect(publicPlayerName({ displayName: "Market Maven", name: "Jane Smith" })).toBe(
      "Market Maven"
    );
  });

  it("falls back to an abbreviated real name when no display name is set", () => {
    expect(publicPlayerName({ displayName: null, name: "Jane Quinn Smith" })).toBe("Jane S");
  });

  it("returns null for an erased account so the client renders Anonymous", () => {
    expect(publicPlayerName({ displayName: null, name: null })).toBeNull();
  });

  it("never leaks the real name once a display name exists", () => {
    const row = { displayName: "Anon42", name: "Paul Kennedy" };
    expect(publicPlayerName(row)).not.toContain("Kennedy");
  });

  it("never leaks the full surname when falling back to the real name", () => {
    const row = { displayName: null, name: "Paul Kennedy" };
    expect(publicPlayerName(row)).toBe("Paul K");
    expect(publicPlayerName(row)).not.toContain("Kennedy");
  });
});

// ─── Admin away-status mirror ─────────────────────────────────────────────────
// streak_records.awayStatus is canonical (the streak engine reads it) and
// users.awayStatus is a display mirror that /profile reads. The player's own
// toggle wrote both; the ADMIN toggle wrote only the canonical field, so an
// admin-set "away" left the player's own profile still showing "Active".
// setAwayStatus now mirrors, matching the player path.
import { readFileSync } from "fs";

describe("setAwayStatus — keeps users.awayStatus in sync", () => {
  const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf-8");
  const fn = dbSource.slice(
    dbSource.indexOf("export async function setAwayStatus("),
    dbSource.indexOf("export async function getPlayersForAdmin(")
  );

  it("writes the canonical streak_records field", () => {
    expect(fn).toContain("update(streakRecords)");
    expect(fn).toContain("awayStatus: status");
  });

  it("also mirrors to users.awayStatus", () => {
    expect(fn).toContain("update(users)");
    expect(fn).toContain('awayStatus: status === "away"');
  });

  it("maps only 'away' to true — 'active' and 'missing' both clear the mirror", () => {
    const mirror = (status: string) => status === "away";
    expect(mirror("away")).toBe(true);
    expect(mirror("active")).toBe(false);
    expect(mirror("missing")).toBe(false);
  });
});

// ─── Validation Question Answer Position ──────────────────────────────────────
// The curation agent reliably writes the correct answer first, so a player
// could take the full 20% validation score without reading the research.
// Shuffling server-side removes the signal whatever the agent produces; it is
// safe because scoring compares answer TEXT, never index.
describe("shuffleOptionsForGame", () => {
  const opts = ["correct answer", "distractor 1", "distractor 2", "distractor 3"];

  it("keeps exactly the same options, just reordered", () => {
    const out = shuffleOptionsForGame(opts, 1770001);
    expect(out).toHaveLength(opts.length);
    expect([...out].sort()).toEqual([...opts].sort());
  });

  it("is stable for a game — a reload must not move options mid-answer", () => {
    const a = shuffleOptionsForGame(opts, 1770001);
    const b = shuffleOptionsForGame(opts, 1770001);
    expect(a).toEqual(b);
  });

  it("orders differently across games, so position carries no signal", () => {
    const orders = new Set(
      [1, 2, 3, 30001, 150001, 870001, 1770001].map((id) =>
        shuffleOptionsForGame(opts, id).join("|")
      )
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("does not leave the correct answer pinned to position 0 across games", () => {
    const ids = Array.from({ length: 60 }, (_, i) => (i + 1) * 30001);
    const firstIsCorrect = ids.filter(
      (id) => shuffleOptionsForGame(opts, id)[0] === "correct answer"
    ).length;
    // Would be 60 without the shuffle. Allow generous slack for chance.
    expect(firstIsCorrect).toBeLessThan(35);
  });

  it("does not mutate the array it was given", () => {
    const original = [...opts];
    shuffleOptionsForGame(opts, 42);
    expect(opts).toEqual(original);
  });

  it("handles 0 and 1 option without throwing", () => {
    expect(shuffleOptionsForGame([], 1)).toEqual([]);
    expect(shuffleOptionsForGame(["only"], 1)).toEqual(["only"]);
  });
});

// ─── Practice Projected Rank ──────────────────────────────────────────────────
// Shown to the player as "your practice average would place you Nth" — a
// hypothetical, never stored, and never feeding the real leaderboard.
describe("computeProjectedRank", () => {
  const live = [92.5, 88.0, 85.0, 70.25];

  it("places an average above everyone at first", () => {
    expect(computeProjectedRank(99, live, 5)).toBe(1);
  });

  it("places an average below everyone last", () => {
    expect(computeProjectedRank(10, live, 5)).toBe(live.length + 1);
  });

  it("slots into the middle correctly", () => {
    expect(computeProjectedRank(86, live, 5)).toBe(3);
  });

  it("uses competition ranking — a tie takes the better position", () => {
    // Tying the 88.0 in second place shows 2nd, not 3rd.
    expect(computeProjectedRank(88.0, live, 5)).toBe(2);
  });

  it("returns null when no practice games are completed", () => {
    expect(computeProjectedRank(0, live, 0)).toBeNull();
    expect(computeProjectedRank(95, live, 0)).toBeNull();
  });

  it("ranks first when the live board is empty", () => {
    expect(computeProjectedRank(50, [], 3)).toBe(1);
  });
});

// ─── Chart Snapshot Truncation ────────────────────────────────────────────────
// THE safety property of archived charts: a candle dated on the game day IS
// the result — its open versus close is exactly what the player is being asked
// to predict. Nothing at or after the game date may ever reach a practice
// player, so this is enforced in a pure, tested function rather than by a UI
// rule someone could later loosen.
import { truncateCandlesBeforeGameDate, candlesAsOf } from "./db";

const day = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / 1000);
const bar = (d: string) => ({ time: day(d), open: 1, high: 2, low: 0.5, close: 1.5 });

describe("truncateCandlesBeforeGameDate", () => {
  const gameDate = "2026-09-11";

  it("drops the game day itself — that candle is the answer", () => {
    const out = truncateCandlesBeforeGameDate(
      [bar("2026-09-09"), bar("2026-09-10"), bar("2026-09-11")],
      gameDate
    );
    expect(out.map((c) => c.time)).toEqual([day("2026-09-09"), day("2026-09-10")]);
  });

  it("drops anything AFTER the game day too", () => {
    const out = truncateCandlesBeforeGameDate(
      [bar("2026-09-10"), bar("2026-09-11"), bar("2026-09-12"), bar("2026-10-01")],
      gameDate
    );
    expect(out).toHaveLength(1);
    expect(out[0].time).toBe(day("2026-09-10"));
  });

  it("keeps history before the game day", () => {
    const out = truncateCandlesBeforeGameDate(
      [bar("2026-06-01"), bar("2026-07-01"), bar("2026-08-01")],
      gameDate
    );
    expect(out).toHaveLength(3);
  });

  it("returns ascending order regardless of input order", () => {
    const out = truncateCandlesBeforeGameDate(
      [bar("2026-09-10"), bar("2026-08-01"), bar("2026-09-01")],
      gameDate
    );
    expect(out.map((c) => c.time)).toEqual([day("2026-08-01"), day("2026-09-01"), day("2026-09-10")]);
  });

  it("caps history length, keeping the most recent", () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      bar(`2026-0${1 + Math.floor(i / 28)}-${String((i % 28) + 1).padStart(2, "0")}`)
    );
    const out = truncateCandlesBeforeGameDate(many, gameDate, 10);
    expect(out).toHaveLength(10);
    // The kept window must be the latest ones.
    expect(out[out.length - 1].time).toBe(Math.max(...many.map((c) => c.time)));
  });

  it("returns empty when every candle is on or after the game date", () => {
    expect(truncateCandlesBeforeGameDate([bar("2026-09-11"), bar("2026-09-12")], gameDate)).toEqual([]);
  });

  it("returns empty rather than throwing on a malformed game date", () => {
    expect(truncateCandlesBeforeGameDate([bar("2026-09-01")], "not-a-date")).toEqual([]);
  });
});

describe("candlesAsOf", () => {
  it("reports the date of the last candle", () => {
    expect(candlesAsOf([bar("2026-09-01"), bar("2026-09-10")])).toBe("2026-09-10");
  });

  it("returns null for no candles", () => {
    expect(candlesAsOf([])).toBeNull();
  });
});

// ─── Auth Logout ──────────────────────────────────────────────────────────────
// Since switching to Clerk, logout is handled client-side by Clerk's signOut().
// The server procedure is a no-op stub for API compatibility.
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser2 = NonNullable<TrpcContext["user"]>;

function createAuthContext2(): { ctx: TrpcContext } {
  const user: AuthenticatedUser2 = {
    id: 1,
    clerkId: "user_test_456",
    openId: null,
    email: "test@example.com",
    name: "Test User",
    displayName: null,
    loginMethod: "clerk",
    role: "user",
    tier: "free",
    awayStatus: false,
    awayStatusUntil: null,
    deactivated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return { ctx };
}

describe("auth.logout", () => {
  it("returns success (logout is handled client-side by Clerk)", async () => {
    const { ctx } = createAuthContext2();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});

// ─── Account Erasure (right to erasure) ───────────────────────────────────────

import { getTableColumns } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { ERASED_USER_FIELDS } from "./db";

/**
 * Columns on `users` that hold no personal data and so survive erasure.
 * Everything NOT listed here must be cleared by ERASED_USER_FIELDS — that is
 * what the first test below enforces, so adding a personal column to the table
 * and forgetting to erase it fails the build rather than leaking quietly.
 */
const NON_PERSONAL_USER_COLUMNS = [
  "id",             // opaque integer — the anonymous handle game history hangs off
  "role",
  "tier",
  "awayStatus",
  "awayStatusUntil",
  "deactivated",    // set by erasure, asserted separately below
  "emailOptIn",     // set by erasure, asserted separately below
  "pushOptIn",      // set by erasure, asserted separately below
  "createdAt",
  "updatedAt",
  "lastSignedIn",
];

describe("ERASED_USER_FIELDS — covers every personal column on users", () => {
  it("nulls every users column not explicitly marked non-personal", () => {
    const allColumns = Object.keys(getTableColumns(users));
    const mustBeErased = allColumns.filter(c => !NON_PERSONAL_USER_COLUMNS.includes(c));

    // Guard against the allowlist drifting out of sync with the table.
    expect(mustBeErased.length).toBeGreaterThan(0);

    for (const column of mustBeErased) {
      expect(ERASED_USER_FIELDS).toHaveProperty(column);
      expect(ERASED_USER_FIELDS[column as keyof typeof ERASED_USER_FIELDS]).toBeNull();
    }
  });

  it("clears the identity fields that let someone sign back in", () => {
    expect(ERASED_USER_FIELDS.clerkId).toBeNull();
    expect(ERASED_USER_FIELDS.openId).toBeNull();
    expect(ERASED_USER_FIELDS.deactivated).toBe(true);
  });

  it("clears direct contact details", () => {
    expect(ERASED_USER_FIELDS.email).toBeNull();
    expect(ERASED_USER_FIELDS.name).toBeNull();
    expect(ERASED_USER_FIELDS.displayName).toBeNull();
  });

  it("revokes notification opt-ins so nothing is sent to an erased account", () => {
    expect(ERASED_USER_FIELDS.emailOptIn).toBe(false);
    expect(ERASED_USER_FIELDS.pushOptIn).toBe(false);
  });

  it("does not touch columns needed to keep game history anonymous but intact", () => {
    // Erasing these would break scoring/leaderboard history for no privacy gain.
    expect(ERASED_USER_FIELDS).not.toHaveProperty("id");
    expect(ERASED_USER_FIELDS).not.toHaveProperty("tier");
    expect(ERASED_USER_FIELDS).not.toHaveProperty("createdAt");
  });
});

describe("dashboard.deleteAccount — never reports success it didn't achieve", () => {
  /**
   * The whole safety argument for erasure rests on this: if any step fails, the
   * user must be told, not handed a false "deleted!". In the test environment
   * there is no database, so eraseUserPersonalData throws — and the mutation
   * must surface that rather than swallow it and return success.
   *
   * clerkId is nulled here so the Clerk call is skipped and the database step
   * is the one under test.
   */
  it("throws rather than returning success when the erasure step fails", async () => {
    const { ctx } = createAuthContext2();
    const ctxWithoutClerk: TrpcContext = {
      ...ctx,
      user: { ...ctx.user!, clerkId: null },
    };
    const caller = appRouter.createCaller(ctxWithoutClerk);

    await expect(caller.dashboard.deleteAccount({ confirm: true })).rejects.toThrow(/error clearing your data/);
  });

  it("rejects a call that does not explicitly confirm", async () => {
    const { ctx } = createAuthContext2();
    const caller = appRouter.createCaller(ctx);

    // @ts-expect-error — confirm: false is intentionally invalid input
    await expect(caller.dashboard.deleteAccount({ confirm: false })).rejects.toThrow();
  });
});

// ─── isTransientApiError — retry classification for the curation agent ───────
import { isTransientApiError } from "./_core/curationAgent";

describe("isTransientApiError — curation-agent retry classification", () => {
  /*
   * Regression for 2026-07-25: both nightly run attempts died on undici's
   * `TypeError: terminated` (connection severed mid-stream). "terminated" was
   * not classified as transient, so the cheap per-turn retry never fired and
   * the night ended unscored. Mid-stream severance must be retryable.
   */
  it("classifies undici mid-stream 'terminated' as transient (2026-07-25 failure)", () => {
    expect(isTransientApiError(new TypeError("terminated"))).toBe(true);
  });

  it("finds the real network error buried in the cause chain", () => {
    const socketErr = Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" });
    expect(isTransientApiError(new TypeError("fetch failed", { cause: socketErr }))).toBe(true);
    const reset = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
    expect(isTransientApiError(new TypeError("terminated", { cause: reset }))).toBe(true);
  });

  it("keeps the 2026-07-20 mid-stream overloaded_error transient", () => {
    expect(
      isTransientApiError(new Error('{"type":"error","error":{"type":"overloaded_error"}}'))
    ).toBe(true);
  });

  it("treats 429/5xx statuses as transient", () => {
    expect(isTransientApiError(Object.assign(new Error("x"), { status: 429 }))).toBe(true);
    expect(isTransientApiError(Object.assign(new Error("x"), { status: 529 }))).toBe(true);
  });

  it("does NOT retry genuine agent failures (bad payload, auth, 4xx)", () => {
    expect(isTransientApiError(new Error("Could not parse CurationPayload JSON from Claude's response"))).toBe(false);
    expect(isTransientApiError(Object.assign(new Error("invalid_request_error"), { status: 400 }))).toBe(false);
    expect(isTransientApiError(new Error("authentication_error: invalid x-api-key"))).toBe(false);
  });
});

// ─── isGameSessionConcluded — watchdog outstanding-work time gate ────────────
import { isGameSessionConcluded } from "./_core/curationAgent";

describe("isGameSessionConcluded — watchdog time gate (America/New_York)", () => {
  // July = EDT (UTC-4). A concluded session means the watchdog may score it;
  // an open or future session must NEVER trigger the agent mid-market.
  it("yesterday's game is always concluded", () => {
    expect(isGameSessionConcluded("2026-07-29", new Date("2026-07-30T12:00:00Z"))).toBe(true);
  });

  it("today's game is NOT concluded while the market is open (15:00 ET)", () => {
    expect(isGameSessionConcluded("2026-07-29", new Date("2026-07-29T19:00:00Z"))).toBe(false);
  });

  it("today's game is concluded after 16:10 ET", () => {
    expect(isGameSessionConcluded("2026-07-29", new Date("2026-07-29T20:30:00Z"))).toBe(true);
  });

  it("late evening ET still counts as the same trading day (21:00 ET)", () => {
    expect(isGameSessionConcluded("2026-07-29", new Date("2026-07-30T01:00:00Z"))).toBe(true);
  });

  it("tomorrow's queued game is never concluded — even past midnight UTC", () => {
    // 01:00 UTC Jul 30 is still 21:00 ET Jul 29: the Jul 30 game hasn't run.
    expect(isGameSessionConcluded("2026-07-30", new Date("2026-07-30T01:00:00Z"))).toBe(false);
  });

  it("handles winter time (EST, UTC-5) — 16:20 ET concluded, 16:00 ET not", () => {
    expect(isGameSessionConcluded("2026-01-15", new Date("2026-01-15T21:20:00Z"))).toBe(true);
    expect(isGameSessionConcluded("2026-01-15", new Date("2026-01-15T21:00:00Z"))).toBe(false);
  });
});

// ─── expectedLockoutIso — server-computed lockout (audit finding M2) ─────────
import { expectedLockoutIso } from "./_core/scheduledCuration";

describe("expectedLockoutIso — 9:30 AM America/New_York, DST-safe", () => {
  it("summer (EDT): 9:30 ET = 13:30 UTC", () => {
    expect(expectedLockoutIso("2026-07-31")).toBe("2026-07-31T13:30:00.000Z");
  });

  it("winter (EST): 9:30 ET = 14:30 UTC", () => {
    expect(expectedLockoutIso("2026-01-15")).toBe("2026-01-15T14:30:00.000Z");
  });

  it("handles the spring-forward Monday (2026-03-09, EDT)", () => {
    expect(expectedLockoutIso("2026-03-09")).toBe("2026-03-09T13:30:00.000Z");
  });

  it("handles the fall-back Monday (2026-11-02, EST)", () => {
    expect(expectedLockoutIso("2026-11-02")).toBe("2026-11-02T14:30:00.000Z");
  });
});

// ─── isStagingWindowOpen — afternoon staging watchdog time gate ──────────────
// Pure time-gate half of stagingOutstanding (mirrors the isGameSessionConcluded
// / curationWorkOutstanding split): stagingOutstanding additionally checks the
// database for an existing draft/active/locked game, which isn't reachable
// without one (same reason curationWorkOutstanding itself isn't unit-tested
// directly) — this covers the "yes IF no draft" half via the pure gate.
import { isStagingWindowOpen } from "./_core/curationAgent";

describe("isStagingWindowOpen — afternoon staging watchdog time gate (America/New_York)", () => {
  it("14:30 ET: before the window — no", () => {
    expect(isStagingWindowOpen(new Date("2026-07-29T18:30:00Z"))).toBe(false);
  });

  it("14:45 ET: window opens (boundary inclusive) — yes-if-no-draft", () => {
    expect(isStagingWindowOpen(new Date("2026-07-29T18:45:00Z"))).toBe(true);
  });

  it("15:00 ET: mid-window — yes-if-no-draft", () => {
    expect(isStagingWindowOpen(new Date("2026-07-29T19:00:00Z"))).toBe(true);
  });

  it("16:00 ET: window closes (boundary inclusive) — yes-if-no-draft", () => {
    expect(isStagingWindowOpen(new Date("2026-07-29T20:00:00Z"))).toBe(true);
  });

  it("16:01 ET: just past the window — no", () => {
    expect(isStagingWindowOpen(new Date("2026-07-29T20:01:00Z"))).toBe(false);
  });

  it("16:30 ET: well past the window — no", () => {
    expect(isStagingWindowOpen(new Date("2026-07-29T20:30:00Z"))).toBe(false);
  });

  it("weekend (Saturday) at 15:00 ET — no, even inside the time-of-day window", () => {
    expect(isStagingWindowOpen(new Date("2026-08-01T19:00:00Z"))).toBe(false);
  });

  it("weekday (Monday) at 15:00 ET — yes-if-no-draft", () => {
    expect(isStagingWindowOpen(new Date("2026-08-03T19:00:00Z"))).toBe(true);
  });

  it("handles winter time (EST, UTC-5): 15:00 ET is 20:00 UTC in January", () => {
    expect(isStagingWindowOpen(new Date("2026-01-15T20:00:00Z"))).toBe(true);
    // Same UTC instant would be a different (earlier) ET time in summer —
    // confirms DST is actually accounted for, not a fixed UTC offset.
    expect(isStagingWindowOpen(new Date("2026-01-15T18:30:00Z"))).toBe(false); // 13:30 ET in EST
  });
});

// ─── validateStagedGameActivation — Phase B endOfDay activation guard ────────
import { validateStagedGameActivation } from "./routers";

describe("validateStagedGameActivation — endOfDay's activateStagedGameId validation", () => {
  it("CONFLICTs when the staged game is missing", () => {
    const r = validateStagedGameActivation(undefined, "2026-07-29");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/not found/i);
  });

  it("CONFLICTs when the staged game is not a draft", () => {
    const r = validateStagedGameActivation({ id: 5, status: "active", gameDate: "2026-07-31" }, "2026-07-29");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/not 'draft'/);
  });

  it("CONFLICTs when the staged game is dated on or before the reference date", () => {
    const sameDate = validateStagedGameActivation({ id: 5, status: "draft", gameDate: "2026-07-29" }, "2026-07-29");
    expect(sameDate.ok).toBe(false);
    const earlier = validateStagedGameActivation({ id: 5, status: "draft", gameDate: "2026-07-28" }, "2026-07-29");
    expect(earlier.ok).toBe(false);
  });

  it("activates (ok:true) a draft dated strictly after the reference date", () => {
    const r = validateStagedGameActivation({ id: 5, status: "draft", gameDate: "2026-07-31" }, "2026-07-29");
    expect(r).toEqual({ ok: true });
  });
});

describe("admin.endOfDay — activateStagedGameId (createCaller pattern)", () => {
  /**
   * No database in the test environment (see dashboard.deleteAccount above),
   * so getGameById always returns undefined — this exercises the SAME "missing
   * staged game" CONFLICT path validateStagedGameActivation covers in
   * isolation above, but end-to-end through the real tRPC procedure.
   */
  it("CONFLICTs when activateStagedGameId references a game that can't be found", async () => {
    const { ctx } = createAuthContext2();
    const adminCtx: TrpcContext = { ...ctx, user: { ...ctx.user!, role: "admin" } };
    const caller = appRouter.createCaller(adminCtx);

    await expect(
      caller.admin.endOfDay({
        activateStagedGameId: 999,
      } as Parameters<typeof caller.admin.endOfDay>[0])
    ).rejects.toThrow(/not found/i);
  });

  it("rejects when neither activateStagedGameId nor nextGameDate is provided", async () => {
    const { ctx } = createAuthContext2();
    const adminCtx: TrpcContext = { ...ctx, user: { ...ctx.user!, role: "admin" } };
    const caller = appRouter.createCaller(adminCtx);

    // @ts-expect-error — intentionally omitting both required-one-of fields
    await expect(caller.admin.endOfDay({})).rejects.toThrow();
  });
});

// ─── classifyCurationPayload — Phase B payload routing ───────────────────────
import { classifyCurationPayload } from "./_core/scheduledCuration";

describe("classifyCurationPayload — results-only payload skips freshness; legacy payload unaffected", () => {
  it("routes a results-only payload (stagedGameId set) to 'results-only', regardless of tomorrow", () => {
    expect(classifyCurationPayload({ stagedGameId: 42 })).toBe("results-only");
    // stagedGameId takes priority even if a stray tomorrow block is present —
    // results-only never runs the freshness/tomorrow machinery either way.
    expect(classifyCurationPayload({ stagedGameId: 42, tomorrow: { gameDate: "2026-07-31" } })).toBe("results-only");
  });

  it("routes a legacy payload (tomorrow set, no stagedGameId) to 'legacy' — unaffected by the split", () => {
    expect(classifyCurationPayload({ tomorrow: { gameDate: "2026-07-31" } })).toBe("legacy");
  });

  it("routes a payload with neither field to 'invalid'", () => {
    expect(classifyCurationPayload({})).toBe("invalid");
  });
});

// ─── Leaderboard Competition Ranking ──────────────────────────────────────────
// Golf-style: equal scores share a position and the next distinct score skips
// the numbers consumed by the tie. Previously the client just numbered rows
// (rank = i + 1), so tied players got different positions purely from the order
// the database happened to return — and the query had no secondary sort, so
// that order could change between page loads.
import {
  assignCompetitionRanks,
  sortForLeaderboard,
  formatAverageScore,
} from "@shared/leaderboard";

const entry = (score: string, gamesPlayed: number, userId: number) => ({
  averageDailyScore: score,
  gamesPlayed,
  userId,
});

describe("assignCompetitionRanks — 1-2-2-4", () => {
  it("gives tied players the same position and skips the consumed number", () => {
    const rows = [
      entry("92.50", 40, 1),
      entry("88.00", 35, 2),
      entry("88.00", 22, 3),
      entry("85.00", 30, 4),
    ];
    expect(assignCompetitionRanks(rows)).toEqual([1, 2, 2, 4]);
  });

  it("handles a three-way tie at the top — no 2nd or 3rd awarded", () => {
    const rows = [
      entry("90.00", 30, 1),
      entry("90.00", 25, 2),
      entry("90.00", 20, 3),
      entry("80.00", 40, 4),
    ];
    expect(assignCompetitionRanks(rows)).toEqual([1, 1, 1, 4]);
  });

  it("numbers sequentially when nobody ties", () => {
    const rows = [entry("90.00", 1, 1), entry("80.00", 1, 2), entry("70.00", 1, 3)];
    expect(assignCompetitionRanks(rows)).toEqual([1, 2, 3]);
  });

  it("treats scores as equal on stored 2dp precision, not rounded display", () => {
    // 88.75 and 88.84 both render "88.8" at 1dp — they are NOT tied, which is
    // why the table shows two decimals.
    const rows = [entry("88.84", 10, 1), entry("88.75", 10, 2)];
    expect(assignCompetitionRanks(rows)).toEqual([1, 2]);
  });

  it("returns an empty array for an empty board", () => {
    expect(assignCompetitionRanks([])).toEqual([]);
  });
});

describe("sortForLeaderboard — games played orders ties, never outranks", () => {
  it("lists the player with more games first when scores are level", () => {
    const sorted = sortForLeaderboard([
      entry("88.00", 22, 3),
      entry("88.00", 35, 2),
    ]);
    expect(sorted.map((e) => e.userId)).toEqual([2, 3]);
    // Both still share the position — order changed, rank did not.
    expect(assignCompetitionRanks(sorted)).toEqual([1, 1]);
  });

  it("never lets more games beat a higher score", () => {
    const sorted = sortForLeaderboard([
      entry("70.00", 500, 9),
      entry("90.00", 11, 1),
    ]);
    expect(sorted[0].userId).toBe(1);
  });

  it("is stable for players matching on both score and games played", () => {
    const rows = [entry("80.00", 10, 7), entry("80.00", 10, 4)];
    expect(sortForLeaderboard(rows).map((e) => e.userId)).toEqual([4, 7]);
    expect(sortForLeaderboard([...rows].reverse()).map((e) => e.userId)).toEqual([4, 7]);
  });
});

describe("formatAverageScore", () => {
  it("always renders two decimals", () => {
    expect(formatAverageScore("88.5")).toBe("88.50");
    expect(formatAverageScore("0")).toBe("0.00");
    expect(formatAverageScore(92.456)).toBe("92.46");
  });

  it("degrades to 0.00 rather than NaN", () => {
    expect(formatAverageScore("not a number")).toBe("0.00");
  });
});

// ─── Settlement from prices (open-to-close, Decision 6) ──────────────────────
import { settleFromPrices, openToClosePerf } from "./scoring";

describe("openToClosePerf", () => {
  it("measures the move from open to close, rounded to 2dp", () => {
    expect(openToClosePerf(100, 101.234)).toBe(1.23);
    expect(openToClosePerf(80.28, 80.79)).toBe(0.64);
    expect(openToClosePerf(140.9, 138.75)).toBe(-1.53);
  });
});

describe("settleFromPrices — prices are canonical", () => {
  const base = { tickerA: "NVDA", tickerB: "AVGO" };

  it("derives perf and winner from the four prices", () => {
    const r = settleFromPrices({
      ...base,
      winnerTicker: "NVDA",
      companyAPerf: 0.55,
      companyBPerf: 0.52,
      companyAStartPrice: 194.48,
      companyAEndPrice: 195.55,
      companyBStartPrice: 371.34,
      companyBEndPrice: 373.28,
    });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.derivedFromPrices).toBe(true);
    expect(r.companyAPerf).toBe(0.55);
    expect(r.companyBPerf).toBe(0.52);
    expect(r.winner).toBe("A");
    expect(r.warnings).toEqual([]);
  });

  it("overrides the agent's prior-close percentages AND its winner, with warnings (the 2026-07-06 case)", () => {
    const r = settleFromPrices({
      ...base,
      winnerTicker: "AVGO",
      companyAPerf: 0.37,
      companyBPerf: 3.55,
      companyAStartPrice: 194.48,
      companyAEndPrice: 195.55,
      companyBStartPrice: 371.34,
      companyBEndPrice: 373.28,
    });
    if ("error" in r) throw new Error(r.error);
    expect(r.winner).toBe("A");
    expect(r.companyAPerf).toBe(0.55);
    expect(r.companyBPerf).toBe(0.52);
    expect(r.warnings.length).toBe(3);
    expect(r.warnings.some((w) => w.includes("winner overridden"))).toBe(true);
  });

  it("does not warn when the agent's figures are within tolerance", () => {
    const r = settleFromPrices({
      ...base,
      winnerTicker: "NVDA",
      companyAPerf: 0.6, // 0.05 off
      companyBPerf: 0.5,
      companyAStartPrice: 194.48,
      companyAEndPrice: 195.55,
      companyBStartPrice: 371.34,
      companyBEndPrice: 373.28,
    });
    if ("error" in r) throw new Error(r.error);
    expect(r.warnings).toEqual([]);
  });

  it("a tie goes to company A", () => {
    const r = settleFromPrices({
      ...base,
      companyAStartPrice: 100, companyAEndPrice: 101,
      companyBStartPrice: 200, companyBEndPrice: 202,
    });
    if ("error" in r) throw new Error(r.error);
    expect(r.winner).toBe("A");
  });

  it("refuses to settle on an implausible move (a wrong price)", () => {
    const r = settleFromPrices({
      ...base,
      winnerTicker: "NVDA",
      companyAStartPrice: 19.448, // decimal slip
      companyAEndPrice: 195.55,
      companyBStartPrice: 371.34,
      companyBEndPrice: 373.28,
    });
    expect("error" in r).toBe(true);
  });

  it("falls back to ticker + agent perf when any price is missing", () => {
    const r = settleFromPrices({
      ...base,
      winnerTicker: "AVGO",
      companyAPerf: 0.37,
      companyBPerf: 3.55,
      companyAStartPrice: 194.48,
      companyAEndPrice: 195.55,
      // B prices absent
    });
    if ("error" in r) throw new Error(r.error);
    expect(r.derivedFromPrices).toBe(false);
    expect(r.winner).toBe("B");
    expect(r.companyBPerf).toBe(3.55);
    expect(r.warnings.length).toBe(1);
  });

  it("with no prices and no winnerTicker it errors rather than guessing", () => {
    const r = settleFromPrices({ ...base, companyAPerf: 1, companyBPerf: 2 });
    expect("error" in r).toBe(true);
  });

  it("treats zero and negative prices as missing", () => {
    const r = settleFromPrices({
      ...base,
      winnerTicker: "NVDA",
      companyAStartPrice: 0, companyAEndPrice: 195.55,
      companyBStartPrice: 371.34, companyBEndPrice: 373.28,
    });
    if ("error" in r) throw new Error(r.error);
    expect(r.derivedFromPrices).toBe(false);
  });
});

// ─── Seasons (shared/leaderboard) ────────────────────────────────────────────
import {
  seasonKeyOf,
  seasonWindow,
  currentSeasonKey,
  seasonLabel,
  rankSeasonStandings,
} from "@shared/leaderboard";

describe("season helpers", () => {
  it("season key is the game date's month", () => {
    expect(seasonKeyOf("2026-09-17")).toBe("2026-09");
  });

  it("season window covers the whole month, including 30/31/28-day months", () => {
    expect(seasonWindow("2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(seasonWindow("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(seasonWindow("2027-02")).toEqual({ from: "2027-02-01", to: "2027-02-28" });
    expect(seasonWindow("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("current season follows New York's calendar, not UTC", () => {
    // 2026-10-01 02:00 UTC is still 2026-09-30 22:00 in New York
    expect(currentSeasonKey(new Date("2026-10-01T02:00:00Z"))).toBe("2026-09");
    expect(currentSeasonKey(new Date("2026-10-01T05:00:00Z"))).toBe("2026-10");
  });

  it("labels a season in US English", () => {
    expect(seasonLabel("2026-09")).toBe("September 2026");
  });
});

describe("rankSeasonStandings — total points, golf ties, percentiles", () => {
  const rows = [
    { userId: 3, points: 300, games: 5, average: 60 },
    { userId: 1, points: 412, games: 9, average: 45.78 },
    { userId: 2, points: 300, games: 4, average: 75 },
    { userId: 4, points: 120, games: 3, average: 40 },
  ];

  it("ranks by total points, not average", () => {
    const r = rankSeasonStandings(rows);
    expect(r.map((x) => x.userId)).toEqual([1, 2, 3, 4]);
    expect(r[0].rank).toBe(1);
  });

  it("ties share a position and the next rank skips (1-2-2-4)", () => {
    const r = rankSeasonStandings(rows);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 2, 4]);
  });

  it("among tied totals the higher average is listed first", () => {
    const r = rankSeasonStandings(rows);
    expect(r[1].userId).toBe(2); // 300 pts from 4 games
    expect(r[2].userId).toBe(3); // 300 pts from 5 games
  });

  it("percentile is rank over players, rounded up", () => {
    const r = rankSeasonStandings(rows);
    expect(r[0].percentile).toBe(25);
    expect(r[3].percentile).toBe(100);
  });

  it("handles an empty board", () => {
    expect(rankSeasonStandings([])).toEqual([]);
  });
});
