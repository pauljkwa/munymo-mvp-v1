/**
 * One-off: re-settle every published game on the open-to-close rule
 * (founder Decision 6, made canonical in code on 2026-09-17).
 *
 * WHY: the curation agent sometimes reported the quote-page "% change" (which
 * is measured against the PRIOR close and includes the overnight gap) instead
 * of the open-to-close move. The four open/close prices it stored were right;
 * the percentages beside them were not. Of 50 archived games, 17 disagreed and
 * 3 had the wrong winner. Paul's decision (2026-09-17): re-settle and re-score
 * rather than annotate, so no future stickler can find a contradiction.
 *
 * WHAT IT DOES, per result_published game with all four prices:
 *   1. Recompute companyAPerf / companyBPerf from the prices.
 *   2. If the winner changes: update `winner`, re-score every pick for that
 *      game (prediction 80/0 flips; validation untouched), refresh each
 *      affected player's leaderboard_stats, and prepend a settlement note to
 *      resultSummary so the narrative (which still says who "won" under the
 *      old figure) is explained rather than silently contradicted.
 *   3. If only the percentages change: update them. Scores are unaffected.
 *   4. After all games: rebuild win/lose streaks for every affected player
 *      from their full score history in game-date order. Playing streaks are
 *      untouched — participation did not change.
 *
 * Community stats (pick percentages) are untouched: picks did not change.
 * No emails or push notifications are sent.
 *
 * SAFETY: dry run by default; --apply to write. Idempotent — a second run
 * finds nothing to change.
 *
 * Usage:
 *   set -a; source .env; set +a
 *   npx tsx scripts/resettle-open-to-close.ts
 *   npx tsx scripts/resettle-open-to-close.ts --apply
 */
import "dotenv/config";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { getDb, getPicksForGame, getValidationQuestion, insertDailyScore, upsertLeaderboardStat, updateWinLoseStreak } from "../server/db";
import { dailyGames, dailyScores, streakRecords } from "../drizzle/schema";
import { calculateScore, settleFromPrices } from "../server/scoring";

const APPLY = process.argv.includes("--apply");

function settlementNote(
  tickerA: string,
  tickerB: string,
  perfA: number,
  perfB: number,
  newWinnerTicker: string
): string {
  return (
    `[Settlement note: this game was re-settled on Munymo's open-to-close rule on 2026-09-17. ` +
    `Measured from the regular-session open to the close, ${tickerA} moved ${perfA >= 0 ? "+" : ""}${perfA.toFixed(2)}% and ` +
    `${tickerB} moved ${perfB >= 0 ? "+" : ""}${perfB.toFixed(2)}%, so ${newWinnerTicker} is the winner. ` +
    `The write-up below was written using the day's change against the prior close, which includes the overnight gap.]\n\n`
  );
}

async function rebuildWinLoseStreaks(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number) {
  const rows = await db
    .select({ predictionScore: dailyScores.predictionScore, gameDate: dailyGames.gameDate, gameId: dailyScores.gameId })
    .from(dailyScores)
    .innerJoin(dailyGames, eq(dailyScores.gameId, dailyGames.id))
    .where(and(eq(dailyScores.userId, userId), eq(dailyGames.status, "result_published")))
    .orderBy(asc(dailyGames.gameDate), asc(dailyScores.gameId));

  let win = 0, lose = 0, longestWin = 0;
  for (const r of rows) {
    if (r.predictionScore > 0) { win += 1; lose = 0; longestWin = Math.max(longestWin, win); }
    else { lose += 1; win = 0; }
  }
  const existing = await db.select().from(streakRecords).where(eq(streakRecords.userId, userId)).limit(1);
  const before = existing[0];
  return {
    before: before ? { win: before.currentWinStreak, longestWin: before.longestWinStreak, lose: before.currentLoseStreak } : null,
    after: { win, longestWin, lose },
  };
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("No DB connection — is DATABASE_URL set?");

  const games = await db
    .select()
    .from(dailyGames)
    .where(
      and(
        eq(dailyGames.status, "result_published"),
        isNotNull(dailyGames.companyAStartPrice),
        isNotNull(dailyGames.companyAEndPrice),
        isNotNull(dailyGames.companyBStartPrice),
        isNotNull(dailyGames.companyBEndPrice)
      )
    )
    .orderBy(asc(dailyGames.gameDate));

  console.log(`Published games with all four prices: ${games.length}\n`);

  const perfOnly: typeof games = [];
  const flips: Array<{ game: (typeof games)[number]; perfA: number; perfB: number; newWinner: "A" | "B" }> = [];
  const affectedUsers = new Set<number>();

  for (const g of games) {
    const settled = settleFromPrices({
      tickerA: g.companyATicker,
      tickerB: g.companyBTicker,
      winnerTicker: g.winner === "A" ? g.companyATicker : g.winner === "B" ? g.companyBTicker : null,
      companyAPerf: g.companyAPerf != null ? Number(g.companyAPerf) : null,
      companyBPerf: g.companyBPerf != null ? Number(g.companyBPerf) : null,
      companyAStartPrice: Number(g.companyAStartPrice),
      companyAEndPrice: Number(g.companyAEndPrice),
      companyBStartPrice: Number(g.companyBStartPrice),
      companyBEndPrice: Number(g.companyBEndPrice),
    });
    if ("error" in settled) {
      console.log(`  SKIP id=${g.id} ${g.gameDate} ${g.companyATicker}/${g.companyBTicker}: ${settled.error}`);
      continue;
    }
    if (!settled.derivedFromPrices) continue;
    const perfChanged =
      Number(g.companyAPerf) !== settled.companyAPerf || Number(g.companyBPerf) !== settled.companyBPerf;
    const winnerChanged = g.winner !== settled.winner;
    if (!perfChanged && !winnerChanged) continue;

    const tag = winnerChanged ? "WINNER FLIPS" : "perf only";
    console.log(
      `  id=${g.id} ${g.gameDate} ${g.companyATicker}/${g.companyBTicker}  stored ${g.companyAPerf}/${g.companyBPerf} winner ${g.winner}` +
        `  →  ${settled.companyAPerf}/${settled.companyBPerf} winner ${settled.winner}   [${tag}]`
    );
    if (winnerChanged) flips.push({ game: g, perfA: settled.companyAPerf!, perfB: settled.companyBPerf!, newWinner: settled.winner });
    else perfOnly.push({ ...g, companyAPerf: String(settled.companyAPerf), companyBPerf: String(settled.companyBPerf) });
  }

  console.log(`\nPercentage-only corrections: ${perfOnly.length}`);
  console.log(`Winner flips (re-score):      ${flips.length}`);

  if (!APPLY) {
    for (const f of flips) {
      const picks = await getPicksForGame(f.game.id);
      const scored = picks.filter((p) => p.finalSelection);
      console.log(`  flip id=${f.game.id}: ${scored.length} scored pick(s) would be re-scored — users ${scored.map((p) => p.userId).join(", ")}`);
    }
    console.log("\nDRY RUN — nothing written. Re-run with --apply to make these changes.");
    process.exit(0);
  }

  // 1. Percentage-only corrections
  for (const g of perfOnly) {
    await db.update(dailyGames).set({ companyAPerf: g.companyAPerf, companyBPerf: g.companyBPerf }).where(eq(dailyGames.id, g.id));
  }
  console.log(`\nUpdated percentages on ${perfOnly.length} game(s).`);

  // 2. Winner flips
  for (const f of flips) {
    const g = f.game;
    const newWinnerTicker = f.newWinner === "A" ? g.companyATicker : g.companyBTicker;
    const note = settlementNote(g.companyATicker, g.companyBTicker, f.perfA, f.perfB, newWinnerTicker);
    const alreadyNoted = (g.resultSummary ?? "").startsWith("[Settlement note:");
    await db
      .update(dailyGames)
      .set({
        winner: f.newWinner,
        companyAPerf: String(f.perfA),
        companyBPerf: String(f.perfB),
        resultSummary: alreadyNoted ? g.resultSummary : note + (g.resultSummary ?? ""),
      })
      .where(eq(dailyGames.id, g.id));

    const question = await getValidationQuestion(g.id);
    const picks = await getPicksForGame(g.id);
    let rescored = 0;
    for (const p of picks) {
      if (!p.finalSelection) continue;
      const { predictionScore, validationScore } = calculateScore(
        p.finalSelection,
        f.newWinner,
        p.validationAnswer,
        question?.correctAnswer ?? "",
        p.validationAnswerTimeMs
      );
      await insertDailyScore(p.userId, g.id, predictionScore, validationScore);
      await upsertLeaderboardStat(p.userId);
      affectedUsers.add(p.userId);
      rescored++;
    }
    console.log(`Re-settled id=${g.id} ${g.gameDate}: winner ${g.winner} → ${f.newWinner} (${newWinnerTicker}); ${rescored} pick(s) re-scored.`);
  }

  // 3. Rebuild win/lose streaks for affected players
  for (const userId of affectedUsers) {
    const { before, after } = await rebuildWinLoseStreaks(db, userId);
    await updateWinLoseStreak(userId, after.win, after.longestWin, after.lose);
    console.log(
      `Streaks user ${userId}: win ${before?.win ?? "?"}→${after.win}, longestWin ${before?.longestWin ?? "?"}→${after.longestWin}, lose ${before?.lose ?? "?"}→${after.lose}`
    );
  }

  console.log("\nAPPLIED.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
