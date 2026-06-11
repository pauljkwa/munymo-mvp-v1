/**
 * Munymo Scoring — Pure, exportable logic functions
 * These are the canonical implementations used by routers.ts and tested directly in munymo.test.ts
 */

// ─── Score Calculation ────────────────────────────────────────────────────────
/**
 * 80/20 Daily Score model:
 *   80% — Prediction Accuracy (Final Selection matches winner)
 *   20% — Validation Accuracy (validation answer matches correct answer)
 */
export function calculateScore(
  finalSelection: "A" | "B" | null | undefined,
  winner: "A" | "B",
  validationAnswer: string | null | undefined,
  correctAnswer: string
): { predictionScore: number; validationScore: number; dailyScore: number } {
  const predictionScore = finalSelection === winner ? 80 : 0;
  const validationScore = validationAnswer === correctAnswer ? 20 : 0;
  return { predictionScore, validationScore, dailyScore: predictionScore + validationScore };
}

// ─── Lockout Enforcement ─────────────────────────────────────────────────────
/**
 * Returns whether a submission is allowed given game status and lockout deadline.
 * This is the canonical check — assertNotLocked in routers.ts uses this logic.
 */
export function checkLockout(
  status: string,
  lockoutAt: Date | null | undefined,
  now: Date
): { allowed: boolean; reason?: string } {
  if (["locked", "result_published", "cancelled"].includes(status)) {
    return { allowed: false, reason: "Game is locked or closed" };
  }
  if (lockoutAt && now >= lockoutAt) {
    return { allowed: false, reason: "Lockout deadline has passed" };
  }
  return { allowed: true };
}

// ─── Streak Computation ───────────────────────────────────────────────────────
/**
 * Computes the new streak state for a player after participating in a game.
 *
 * Rules:
 *   - Away status → streak is preserved unchanged (no update)
 *   - Missing status → treated as a gap; streak resets on next participation
 *   - Consecutive day (diffDays === 1) → streak increments
 *   - Gap of 2+ days → streak resets to 1
 *   - Cancelled / market-closed days → caller should NOT invoke this function
 *     (neutral days are handled by not calling updateStreakForPlayer at all)
 */
export function computeNewStreak(
  awayStatus: "active" | "away" | "missing",
  lastParticipationDate: string | null,
  currentStreak: number,
  longestStreak: number,
  gameDate: string
): { newCurrent: number; newLongest: number; updated: boolean } {
  // Away status: preserve streak, do not update
  if (awayStatus === "away") {
    return { newCurrent: currentStreak, newLongest: longestStreak, updated: false };
  }

  // First participation ever
  if (!lastParticipationDate) {
    const newCurrent = 1;
    return { newCurrent, newLongest: Math.max(newCurrent, longestStreak), updated: true };
  }

  const last = new Date(lastParticipationDate);
  const current = new Date(gameDate);
  const diffDays = Math.round((current.getTime() - last.getTime()) / 86400000);

  let newCurrent: number;
  if (diffDays === 1) {
    // Consecutive day
    newCurrent = currentStreak + 1;
  } else if (diffDays > 1) {
    // Gap detected (includes Missing status gap effect)
    newCurrent = 1;
  } else {
    // Same day — no change (shouldn't occur in normal flow)
    newCurrent = currentStreak;
  }

  const newLongest = Math.max(newCurrent, longestStreak);
  return { newCurrent, newLongest, updated: true };
}

// ─── Leaderboard Qualification ────────────────────────────────────────────────
/** The exact qualification threshold — never change without a documented decision. */
export const LEADERBOARD_QUALIFICATION_THRESHOLD = 20;

export function isQualified(gamesPlayed: number): boolean {
  return gamesPlayed >= LEADERBOARD_QUALIFICATION_THRESHOLD;
}

export function computeAverageDailyScore(totalScore: number, gamesPlayed: number): number {
  if (gamesPlayed === 0) return 0;
  return Math.round((totalScore / gamesPlayed) * 100) / 100;
}
