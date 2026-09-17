/**
 * Gut vs Research — the insight the two-pick mechanic exists to produce.
 *
 * The FAQ promises: "Comparing your gut picks with your final picks over time
 * reveals whether research genuinely improves your judgment, and in which
 * direction." Until 2026-09-17 nothing on the site added it up; a player could
 * only see it one game at a time. This is the pure arithmetic, shared so the
 * server computes it and tests can pin it down without a database.
 *
 * Only games with a published winner and a final pick count. A gut pick that
 * was auto-submitted as the final pick counts as "kept" — the player did not
 * change their mind, whatever the reason.
 */
export interface PickOutcome {
  gameDate: string; // YYYY-MM-DD
  sector: string | null;
  gut: "A" | "B" | null;
  final: "A" | "B" | null;
  winner: "A" | "B" | null;
}

export interface SectorAccuracy {
  sector: string;
  games: number;
  correct: number;
  accuracy: number; // whole percent
}

export interface MonthAccuracy {
  month: string; // YYYY-MM
  games: number;
  correct: number;
  accuracy: number;
}

export interface GutVsResearch {
  games: number;
  gutCorrect: number;
  finalCorrect: number;
  gutAccuracy: number;
  finalAccuracy: number;
  /** games where the final pick differed from the gut pick */
  changed: number;
  /** changed, and the final pick was right (research rescued a wrong instinct) */
  changedHelped: number;
  /** changed, and the final pick was wrong (research talked you out of a right instinct) */
  changedHurt: number;
  /** changed, gut and final both wrong — can't happen with two options, kept for clarity */
  kept: number;
  /** net games research won you: helped minus hurt */
  net: number;
  /** sectors with enough games to mean something, best first */
  bySector: SectorAccuracy[];
  /** last few months, oldest first */
  byMonth: MonthAccuracy[];
}

export const SECTOR_MIN_GAMES = 3;
export const MONTHS_SHOWN = 6;

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

export function computeGutVsResearch(rows: PickOutcome[]): GutVsResearch {
  const played = rows.filter((r) => r.final && r.winner);
  const games = played.length;
  let gutCorrect = 0, finalCorrect = 0, changed = 0, changedHelped = 0, changedHurt = 0;
  const sectors = new Map<string, { games: number; correct: number }>();
  const months = new Map<string, { games: number; correct: number }>();

  for (const r of played) {
    const finalRight = r.final === r.winner;
    if (finalRight) finalCorrect++;
    if (r.gut && r.gut === r.winner) gutCorrect++;
    if (r.gut && r.gut !== r.final) {
      changed++;
      if (finalRight) changedHelped++;
      else changedHurt++;
    }
    if (r.sector) {
      const s = sectors.get(r.sector) ?? { games: 0, correct: 0 };
      s.games++;
      if (finalRight) s.correct++;
      sectors.set(r.sector, s);
    }
    const m = r.gameDate.slice(0, 7);
    const mm = months.get(m) ?? { games: 0, correct: 0 };
    mm.games++;
    if (finalRight) mm.correct++;
    months.set(m, mm);
  }

  const bySector = Array.from(sectors.entries())
    .filter(([, s]) => s.games >= SECTOR_MIN_GAMES)
    .map(([sector, s]) => ({ sector, games: s.games, correct: s.correct, accuracy: pct(s.correct, s.games) }))
    .sort((a, b) => b.accuracy - a.accuracy || b.games - a.games || a.sector.localeCompare(b.sector));

  const byMonth = Array.from(months.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-MONTHS_SHOWN)
    .map(([month, m]) => ({ month, games: m.games, correct: m.correct, accuracy: pct(m.correct, m.games) }));

  return {
    games,
    gutCorrect,
    finalCorrect,
    gutAccuracy: pct(gutCorrect, games),
    finalAccuracy: pct(finalCorrect, games),
    changed,
    changedHelped,
    changedHurt,
    kept: games - changed,
    net: changedHelped - changedHurt,
    bySector,
    byMonth,
  };
}

/**
 * One honest sentence about what the research is doing for this player.
 * Written for the dashboard card; kept here so the wording is testable and
 * the server and client cannot drift.
 */
export function describeGutVsResearch(g: GutVsResearch): string {
  if (g.games === 0) return "Play a few games and this will show whether reading the research changes your results.";
  if (g.changed === 0) {
    return `In ${g.games} ${g.games === 1 ? "game" : "games"} the research has never changed your pick. Your instinct and your final call are the same thing so far.`;
  }
  const times = `${g.changed} ${g.changed === 1 ? "time" : "times"}`;
  const base = `Research changed your pick ${times} in ${g.games} games: it helped ${g.changedHelped} and hurt ${g.changedHurt}.`;
  if (g.net > 0) return `${base} Reading is paying off — keep doing it.`;
  if (g.net < 0) return `${base} So far your first instinct has been the better guide. Worth noticing what talks you out of it.`;
  return `${base} A wash so far — a few more games will tell.`;
}
