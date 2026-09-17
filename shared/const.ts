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
