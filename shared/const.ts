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
