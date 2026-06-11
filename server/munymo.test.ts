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
  isQualified,
  computeAverageDailyScore,
  LEADERBOARD_QUALIFICATION_THRESHOLD,
} from "./scoring";

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
    expect(r.updated).toBe(true);
  });

  it("increments streak on consecutive day", () => {
    const r = computeNewStreak("active", "2025-01-01", 3, 5, "2025-01-02");
    expect(r.newCurrent).toBe(4);
  });

  it("resets streak to 1 when gap of 2+ days (Missing status effect)", () => {
    const r = computeNewStreak("active", "2025-01-01", 5, 10, "2025-01-04");
    expect(r.newCurrent).toBe(1);
    expect(r.newLongest).toBe(10); // longest preserved
  });

  it("preserves streak without updating when Away status is set", () => {
    const r = computeNewStreak("away", "2025-01-01", 7, 7, "2025-01-03");
    expect(r.newCurrent).toBe(7);
    expect(r.updated).toBe(false);
  });

  it("updates longest streak when current exceeds previous longest", () => {
    const r = computeNewStreak("active", "2025-01-10", 9, 9, "2025-01-11");
    expect(r.newCurrent).toBe(10);
    expect(r.newLongest).toBe(10);
  });

  it("does not reduce longest streak when current resets", () => {
    const r = computeNewStreak("active", "2025-01-01", 5, 12, "2025-01-10");
    expect(r.newCurrent).toBe(1);
    expect(r.newLongest).toBe(12);
  });

  it("Missing status player who participates after gap gets streak reset to 1", () => {
    // Missing status means awayStatus !== 'away', so gap logic applies normally
    const r = computeNewStreak("missing", "2025-01-01", 8, 8, "2025-01-05");
    expect(r.newCurrent).toBe(1);
    expect(r.updated).toBe(true);
  });

  it("does not update streak for same-day duplicate (diffDays === 0)", () => {
    const r = computeNewStreak("active", "2025-01-01", 5, 5, "2025-01-01");
    expect(r.newCurrent).toBe(5); // unchanged
  });
});

// ─── Leaderboard Qualification ────────────────────────────────────────────────
describe("Leaderboard qualification — 20-game threshold (production constants)", () => {
  it("threshold constant is exactly 20", () => {
    expect(LEADERBOARD_QUALIFICATION_THRESHOLD).toBe(20);
  });

  it("is not qualified with 19 games", () => {
    expect(isQualified(19)).toBe(false);
  });

  it("is qualified with exactly 20 games", () => {
    expect(isQualified(20)).toBe(true);
  });

  it("is qualified with more than 20 games", () => {
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

// ─── Auth Logout ──────────────────────────────────────────────────────────────
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = { name: string; options: Record<string, unknown> };
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});
