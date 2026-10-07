export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/**
 * Live games a player must complete before they appear on the ranked
 * leaderboard. Shared so the server's qualification logic and every piece of UI
 * that counts down to it read the SAME number — it was previously hardcoded as
 * a literal 20 in five separate places in the client, which would silently
 * disagree with the server the moment the threshold changed.
 *
 * Archived practice games deliberately do not count toward this.
 */
export const LEADERBOARD_QUALIFICATION_GAMES = 10;

/**
 * Synthetic tester accounts. They play every game at random (see
 * server/_core/testerAgent.ts) to exercise the scoring pipeline daily.
 *
 * Exactly one of them is shown publicly, as the "Coin Flip" benchmark: because
 * it picks at random, it is the honest yardstick for "is my score luck?". The
 * rest are hidden from every public board and none of them count toward
 * community stats — five bots with human names were most of the "crowd".
 * Paul's decision (2026-09-17): declare them for what they are, retire the
 * hidden ones once real players have qualified to replace them.
 */
export const TESTER_BOT_IDS = [870002, 870004, 870006, 870008, 870010, 870012] as const;
export const BENCHMARK_BOT_ID = 870002;
export const BENCHMARK_BOT_NAME = "Coin Flip";
export const HIDDEN_BOT_IDS: number[] = TESTER_BOT_IDS.filter((id) => id !== BENCHMARK_BOT_ID);

/** Below this many players a "Top N%" figure reads as a joke, so the UI shows rank only. */
export const PERCENTILE_MIN_PLAYERS = 20;

// ─── Scoring v2 (Paul's decision 2026-10-07; see references/scoring-homework-findings-2026-10-07.md) ───

/**
 * The four components of a daily score. Deliberately a single adjustable
 * object: Paul intends to ask beta testers about the weighting, so nothing
 * else in the code may carry its own copy of these numbers. They must sum
 * to 100 (asserted in server/scoring.ts).
 *
 *   call    — final pick matches the open-to-close winner
 *   reason  — "your reason": one of Mo's four highlighted metrics plus the
 *             company the player says it favors; marked on consistency with
 *             the final pick, never against the market result
 *   conf    — confidence on the final pick, via the published table below
 *   check   — reading check: the validation question, right or wrong, untimed
 */
export const SCORE_WEIGHTS = { call: 40, reason: 25, conf: 20, check: 15 } as const;

export type ConfidenceLevel = "tossup" | "leaning" | "confident";

/**
 * Confidence table as fractions of SCORE_WEIGHTS.conf: [if right, if wrong].
 * At 20 points: Toss-up 14/14, Leaning 18/10, Confident 20/4. Shaped so that
 * honesty is the best policy (Toss-up wins below ~62% sure, Confident above
 * ~75%) and a toss-up day never punishes saying so. Coin Flip declares tossup.
 */
export const CONFIDENCE_TABLE: Record<ConfidenceLevel, readonly [number, number]> = {
  tossup: [0.7, 0.7],
  leaning: [0.9, 0.5],
  confident: [1.0, 0.2],
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  tossup: "Toss-up",
  leaning: "Leaning",
  confident: "Confident",
};

/** Label the player picks when their reason is the price chart rather than a metric. */
export const PRICE_TREND_LABEL = "Price trend";

/** Exactly this many metrics are highlighted each day for the "your reason" step. */
export const HIGHLIGHTED_METRIC_COUNT = 4;

/**
 * Day classification by the distance between the two open-to-close moves,
 * in percentage points. Chosen from the archive (77 games to 2026-10-06):
 * median margin 1.30, 16% of days inside 0.25, 29% inside 0.5.
 */
export const DAY_KIND_COIN_TOSS_MARGIN_PCT_POINTS = 0.25;
export const DAY_KIND_CLEAR_MARGIN_PCT_POINTS = 1.0;
export type DayKind = "coin_toss" | "clear" | "decisive";
