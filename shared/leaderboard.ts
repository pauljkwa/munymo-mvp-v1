/**
 * Leaderboard ranking rules, shared by the server and the UI.
 *
 * Munymo ranks like a golf scoreboard — "standard competition ranking", the
 * 1-2-2-4 pattern. Players on the same Average Daily Score share one position,
 * and the next distinct score resumes at however many players are above it,
 * plus one. So two players tied for 2nd are both 2nd, and the next player is
 * 4th, not 3rd.
 *
 * Previously the client simply numbered the rows (`rank = i + 1`), which gave
 * tied players different positions purely by the order the database happened to
 * return them in — and the query had no secondary sort at all, so that order
 * could change between page loads.
 */

/** One row's ranking inputs. Ordering is the caller's job; see sortForLeaderboard. */
export interface RankableEntry {
  averageDailyScore: string | number;
  gamesPlayed: number;
  userId: number;
}

export function scoreOf(entry: RankableEntry): number {
  return typeof entry.averageDailyScore === "number"
    ? entry.averageDailyScore
    : parseFloat(entry.averageDailyScore);
}

/**
 * Display order within the board.
 *
 * Score decides rank; games played only decides who is LISTED first among
 * players who tie. That distinction is the point — a longer record behind the
 * same average is shown first as recognition of sustained play, but it does not
 * buy a better position. Player id is a final tiebreak so two players matching
 * on both score and games played keep a stable order instead of swapping
 * places between page loads.
 */
export function sortForLeaderboard<T extends RankableEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const diff = scoreOf(b) - scoreOf(a);
    if (diff !== 0) return diff;
    if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
    return a.userId - b.userId;
  });
}

/**
 * Competition ranks for an already-sorted list, parallel to `entries`.
 *
 * Ties are decided on the score as STORED (two decimal places), not as
 * displayed — which is why the table renders 2dp. Rendering 1dp would show two
 * players an identical "88.8" while ranking them 2nd and 3rd, and look broken.
 */
export function assignCompetitionRanks(entries: RankableEntry[]): number[] {
  const ranks: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && scoreOf(entries[i]) === scoreOf(entries[i - 1])) {
      ranks.push(ranks[i - 1]);
    } else {
      ranks.push(i + 1);
    }
  }
  return ranks;
}

/**
 * Average Daily Score as shown to players — always two decimals, matching the
 * precision ties are actually decided on.
 */
export function formatAverageScore(value: string | number): string {
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

// ─── Seasons ─────────────────────────────────────────────────────────────────
/**
 * A season is a calendar month of GAME dates. `gameDate` is already the
 * market-calendar date (America/New_York), so the month is a string slice —
 * no timezone arithmetic, and a game can never straddle two seasons.
 */
export function seasonKeyOf(gameDate: string): string {
  return gameDate.slice(0, 7);
}

/** First and last calendar day of a season, as YYYY-MM-DD, for BETWEEN queries. */
export function seasonWindow(seasonKey: string): { from: string; to: string } {
  const [y, m] = seasonKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month
  return { from: `${seasonKey}-01`, to: `${seasonKey}-${String(lastDay).padStart(2, "0")}` };
}

/**
 * The season in progress "now", in the market's calendar. Uses New York time so
 * the board rolls over when the market's month does, not when a player's
 * local midnight or UTC midnight does — a Perth player at 10 am on the 1st is
 * still in the previous season until the New York date changes.
 */
export function currentSeasonKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

export function seasonLabel(seasonKey: string): string {
  const [y, m] = seasonKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export interface SeasonRow {
  userId: number;
  points: number;
  games: number;
  average: number;
}

export interface RankedSeasonRow extends SeasonRow {
  rank: number;
  /** rank / players, as a whole percent rounded up: 1st of 10 is "Top 10%" */
  percentile: number;
}

/**
 * Season standings are ranked by TOTAL points, not average. A total rewards
 * showing up — the value of the daily rep — and a break costs nothing except
 * the points not earned, which is the same stance Away Status takes. There is
 * no qualification gate because a total is not an average: one lucky game is
 * 100 points, not a 100 average.
 *
 * Ties share a position (golf ranking). Among tied totals the higher average
 * is listed first — the same points from fewer games — then the lower user id
 * so the order is stable between loads.
 */
export function rankSeasonStandings(rows: SeasonRow[]): RankedSeasonRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.average !== a.average) return b.average - a.average;
    return a.userId - b.userId;
  });
  const n = sorted.length;
  const out: RankedSeasonRow[] = [];
  for (let i = 0; i < n; i++) {
    const rank = i > 0 && sorted[i].points === sorted[i - 1].points ? out[i - 1].rank : i + 1;
    out.push({ ...sorted[i], rank, percentile: Math.ceil((rank / n) * 100) });
  }
  return out;
}
