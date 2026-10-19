/**
 * One-off: correct the settlement of game 2550001 (EIX vs DUK, 2026-10-19).
 *
 * WHY: the 2026-10-19 post-close run spent three turns unable to find same-day
 * quotes in web_search (twice reporting "market closed"), then on its third
 * turn scored the game with the wrong Edison International prices — open
 * $55.90 / close $54.85 (-1.88%), which made DUK (-1.42%) the winner. Yahoo
 * Finance's minute bars for the regular session show EIX opened at $55.38 and
 * closed at $55.68 (+0.54%). DUK's prices ($120.99 → $119.27) were right. The
 * true winner is EIX, by 1.96 points — a decisive day, not a clear one.
 *
 * WHAT IT DOES (dry run by default; --apply to write):
 *   1. Re-settle: EIX prices, both percentages, winner A, dayKind.
 *   2. Replace resultSummary / hindsightSpotlight with a corrected write-up
 *      that ends with a dated correction note (the original text explained a
 *      fall that never happened, so a prepended note would not be enough).
 *   3. Re-score every final pick through the same scoring-v2 path
 *      closeAndScoreGame uses, refresh leaderboard stats, and rebuild the
 *      affected players' win/lose streaks from their full history.
 *   Community stats (pick percentages) are untouched — picks did not change.
 *   No emails or pushes are sent (the only participant was the Coin Flip bot).
 *
 * Usage:
 *   npx tsx scripts/correct-game-2550001.ts          # dry run
 *   npx tsx scripts/correct-game-2550001.ts --apply
 */
import "dotenv/config";
import { and, asc, eq } from "drizzle-orm";
import {
  getDb,
  getGameById,
  getPicksForGame,
  getResearchByGameId,
  getValidationQuestion,
  insertDailyScore,
  updateGame,
  updateWinLoseStreak,
  upsertLeaderboardStat,
} from "../server/db";
import { dailyGames, dailyScores, streakRecords } from "../drizzle/schema";
import { calculateScoreV2, classifyDay, objectiveSideForMetric, settleFromPrices } from "../server/scoring";
import { valuesForMetric, type MetricRow } from "../server/highlightedMetrics";
import { PRICE_TREND_LABEL } from "../shared/const";

const GAME_ID = 2550001;
const APPLY = process.argv.includes("--apply");

// Regular-session prices, Yahoo Finance chart API (1-minute bars, 2026-10-19):
// EIX 09:30 open 55.38 → 16:00 close 55.68; DUK 120.99 → 119.27.
const PRICES = { aStart: 55.38, aEnd: 55.68, bStart: 120.99, bEnd: 119.27 };

const RESULT_SUMMARY =
  "Edison International (EIX) rose from a $55.38 open to a $55.68 close, an open-to-close move of +0.54%, while Duke Energy (DUK) " +
  "slipped from $120.99 to $119.27, a -1.42% move. EIX won by 1.96 percentage points: it opened below Friday's close and " +
  "recovered through the session, while DUK gave back part of the previous week's rally.";

const HINDSIGHT_SPOTLIGHT =
  "Today was decisive: the two stocks finished 1.96 points apart. Edison International gained ground from the opening bell while " +
  "Duke Energy drifted lower, so the matchup was settled by direction, not by which utility fell less.\n\n" +
  "Edison International opened at $55.38 — below Friday's $55.93 close — and closed at $55.68, a +0.54% open-to-close move. " +
  "Remember that Munymo measures from the open, so the overnight gap down, which players could already see before picks locked, " +
  "does not count. From the first trade onward, buyers were in control: the stock traded as high as $56.45 during the day before " +
  "settling with a gain. For a name that has spent October under a cloud — wildfire-liability concerns at Southern California " +
  "Edison, a disclosed short position from Muddy Waters, and a trimmed Goldman Sachs price target — a day where the sellers were " +
  "exhausted at the open and the stock climbed from there is a classic relief move in a beaten-down stock.\n\n" +
  "Duke Energy opened at $120.99 and closed at $119.27, a -1.42% move. With no fresh company-specific headlines, the pullback " +
  "looks like routine profit-taking after the sharp rally that carried the stock from under $119 to above $121 the previous " +
  "week, alongside a broader rotation out of rate-sensitive utility names.\n\n" +
  "The lesson for players: the stock with the heavier controversy is not automatically the loser on any given day. When bad " +
  "news is already well known and a stock opens weak, the intraday path often turns on whether new sellers show up — and on this " +
  "Monday they did not. Meanwhile the 'cleaner' name, having just run up, had more recent gains to give back. Open-to-close " +
  "moves reward reading the day's positioning, not just the headlines.\n\n" +
  "[Correction, 2026-10-20: this result was first published with incorrect Edison International prices ($55.90 to $54.85) and " +
  "Duke Energy as the winner. The regular-session prices were $55.38 to $55.68, so Edison International won. Scores for this " +
  "game were recalculated.]";

async function rebuildWinLoseStreaks(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number) {
  const rows = await db
    .select({ predictionScore: dailyScores.predictionScore, gameDate: dailyGames.gameDate })
    .from(dailyScores)
    .innerJoin(dailyGames, eq(dailyScores.gameId, dailyGames.id))
    .where(and(eq(dailyScores.userId, userId), eq(dailyGames.status, "result_published")))
    .orderBy(asc(dailyGames.gameDate), asc(dailyScores.gameId));
  let win = 0, lose = 0, longestWin = 0;
  for (const r of rows) {
    if (r.predictionScore > 0) { win += 1; lose = 0; longestWin = Math.max(longestWin, win); }
    else { lose += 1; win = 0; }
  }
  const [before] = await db.select().from(streakRecords).where(eq(streakRecords.userId, userId)).limit(1);
  return { before, after: { win, longestWin, lose } };
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("No DB connection — is DATABASE_URL set?");
  const game = await getGameById(GAME_ID);
  if (!game) throw new Error(`Game ${GAME_ID} not found`);
  if (game.companyATicker !== "EIX" || game.companyBTicker !== "DUK" || game.gameDate !== "2026-10-19") {
    throw new Error(`Game ${GAME_ID} is not EIX vs DUK on 2026-10-19 — refusing`);
  }
  console.log(`Game ${GAME_ID} ${game.companyATicker}/${game.companyBTicker} ${game.gameDate}: status=${game.status} winner=${game.winner} ` +
    `A ${game.companyAStartPrice}→${game.companyAEndPrice} (${game.companyAPerf}%)  B ${game.companyBStartPrice}→${game.companyBEndPrice} (${game.companyBPerf}%) dayKind=${game.dayKind}`);

  const settled = settleFromPrices({
    tickerA: "EIX", tickerB: "DUK", winnerTicker: "EIX",
    companyAPerf: null, companyBPerf: null,
    companyAStartPrice: PRICES.aStart, companyAEndPrice: PRICES.aEnd,
    companyBStartPrice: PRICES.bStart, companyBEndPrice: PRICES.bEnd,
  });
  if ("error" in settled) throw new Error(settled.error);
  const dayKind = classifyDay(settled.companyAPerf!, settled.companyBPerf!);
  console.log(`→ corrected: winner ${settled.winner} (EIX)  A ${PRICES.aStart}→${PRICES.aEnd} (${settled.companyAPerf}%)  B ${PRICES.bStart}→${PRICES.bEnd} (${settled.companyBPerf}%)  dayKind=${dayKind}`);
  if (settled.winner !== "A") throw new Error("Expected EIX (A) to win on the corrected prices");

  // Re-score through the same v2 path closeAndScoreGame uses.
  const question = await getValidationQuestion(GAME_ID);
  const research = await getResearchByGameId(GAME_ID);
  const metricRows = (research?.metricsSnapshot ?? research?.researchMetrics ?? []) as MetricRow[];
  const picks = await getPicksForGame(GAME_ID);
  const plan: Array<{ userId: number; predictionScore: number; validationScore: number; reasonScore: number; confidenceScore: number }> = [];
  for (const pick of picks) {
    if (!pick.finalSelection) continue;
    let objectiveSide: "A" | "B" | null = null;
    if (pick.reasonMetric && pick.reasonMetric.toLowerCase() !== PRICE_TREND_LABEL.toLowerCase()) {
      const { valueA, valueB } = valuesForMetric(metricRows, pick.reasonMetric, game.companyATicker, game.companyBTicker);
      objectiveSide = objectiveSideForMetric(pick.reasonMetric, valueA, valueB);
    }
    const s = calculateScoreV2({
      finalSelection: pick.finalSelection,
      winner: settled.winner,
      reasonMetric: pick.reasonMetric,
      reasonSide: pick.reasonSide,
      objectiveSide,
      confidence: pick.confidence,
      validationAnswer: pick.validationAnswer,
      correctAnswer: question?.correctAnswer ?? "",
    });
    plan.push({ userId: pick.userId, ...s });
    console.log(`  user ${pick.userId}: pick ${pick.finalSelection}, reason ${pick.reasonMetric}/${pick.reasonSide}, confidence ${pick.confidence} → ` +
      `call ${s.predictionScore} + reason ${s.reasonScore} + confidence ${s.confidenceScore} + check ${s.validationScore} = ${s.totalScore}`);
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply.");
    process.exit(0);
  }

  await updateGame(GAME_ID, {
    winner: settled.winner,
    dayKind,
    companyAPerf: String(settled.companyAPerf),
    companyBPerf: String(settled.companyBPerf),
    companyAStartPrice: String(PRICES.aStart),
    companyAEndPrice: String(PRICES.aEnd),
    companyBStartPrice: String(PRICES.bStart),
    companyBEndPrice: String(PRICES.bEnd),
    resultSummary: RESULT_SUMMARY,
    hindsightSpotlight: HINDSIGHT_SPOTLIGHT,
  });
  console.log("Game row corrected.");
  for (const p of plan) {
    await insertDailyScore(p.userId, GAME_ID, p.predictionScore, p.validationScore, p.reasonScore, p.confidenceScore);
    await upsertLeaderboardStat(p.userId);
    const { before, after } = await rebuildWinLoseStreaks(db, p.userId);
    await updateWinLoseStreak(p.userId, after.win, after.longestWin, after.lose);
    console.log(`  user ${p.userId}: score re-written; streaks win ${before?.currentWinStreak}→${after.win}, longestWin ${before?.longestWinStreak}→${after.longestWin}, lose ${before?.currentLoseStreak}→${after.lose}`);
  }
  console.log("\nAPPLIED.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
