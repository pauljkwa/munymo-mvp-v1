/**
 * Munymo Scoring — Pure, exportable logic functions
 * These are the canonical implementations used by routers.ts and tested directly in munymo.test.ts
 */

// ─── Score Calculation ────────────────────────────────────────────────────────

/**
 * Time-decay modifier for the validation score.
 * Full 20 points if answered within FAST_THRESHOLD_MS.
 * Linearly decays to MIN_VALIDATION_SCORE between FAST and SLOW thresholds.
 * Minimum MIN_VALIDATION_SCORE if answered at or beyond SLOW_THRESHOLD_MS.
 * If no timing data, full 20 points (backward compatible).
 */
export const VALIDATION_FAST_THRESHOLD_MS = 15_000; // 15 seconds → full 20
export const VALIDATION_SLOW_THRESHOLD_MS = 60_000; // 60 seconds → minimum
export const VALIDATION_MAX_SCORE = 20;
export const VALIDATION_MIN_SCORE = 12;

export function computeValidationScore(
  isCorrect: boolean,
  answerTimeMs: number | null | undefined
): number {
  if (!isCorrect) return 0;
  if (answerTimeMs == null || answerTimeMs <= 0) return VALIDATION_MAX_SCORE;
  if (answerTimeMs <= VALIDATION_FAST_THRESHOLD_MS) return VALIDATION_MAX_SCORE;
  if (answerTimeMs >= VALIDATION_SLOW_THRESHOLD_MS) return VALIDATION_MIN_SCORE;
  // Linear decay between fast and slow thresholds
  const range = VALIDATION_SLOW_THRESHOLD_MS - VALIDATION_FAST_THRESHOLD_MS;
  const elapsed = answerTimeMs - VALIDATION_FAST_THRESHOLD_MS;
  const scoreRange = VALIDATION_MAX_SCORE - VALIDATION_MIN_SCORE;
  return Math.round(VALIDATION_MAX_SCORE - (elapsed / range) * scoreRange);
}

/**
 * 80/20 Daily Score model:
 *   80% — Prediction Accuracy (Final Selection matches winner)
 *   20% — Validation Accuracy (correct answer) with time-decay modifier
 *
 * answerTimeMs: milliseconds from question display to answer submission.
 *   Pass null/undefined for backward compatibility (no time decay applied).
 */
export function calculateScore(
  finalSelection: "A" | "B" | null | undefined,
  winner: "A" | "B",
  validationAnswer: string | null | undefined,
  correctAnswer: string,
  answerTimeMs?: number | null
): { predictionScore: number; validationScore: number; dailyScore: number } {
  const predictionScore = finalSelection === winner ? 80 : 0;
  const isCorrect = validationAnswer === correctAnswer;
  const validationScore = computeValidationScore(isCorrect, answerTimeMs);
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
