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
