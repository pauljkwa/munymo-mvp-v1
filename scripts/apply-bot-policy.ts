/**
 * One-off: apply the tester-bot policy from references/leaderboard-seasons-spec.md.
 *
 *   1. Rename the benchmark bot (BENCHMARK_BOT_ID) to "Coin Flip" so it is
 *      declared for what it is on every public board.
 *   2. Recompute community stats for every published game with all tester
 *      bots excluded (computeAndStoreCommunityStats now filters them, but the
 *      stored rows for past games were computed with the bots in the crowd).
 *
 * The other bots are hidden by the public queries themselves; nothing about
 * their accounts changes here, and they keep playing for pipeline testing.
 *
 * SAFETY: dry run by default; --apply to write. Idempotent.
 *
 * Usage:
 *   set -a; source .env; set +a
 *   npx tsx scripts/apply-bot-policy.ts
 *   npx tsx scripts/apply-bot-policy.ts --apply
 */
import "dotenv/config";
import { asc, eq } from "drizzle-orm";
import { getDb, computeAndStoreCommunityStats } from "../server/db";
import { dailyGames, gameCommunityStats, users } from "../drizzle/schema";
import { BENCHMARK_BOT_ID, BENCHMARK_BOT_NAME, HIDDEN_BOT_IDS } from "@shared/const";

const APPLY = process.argv.includes("--apply");

async function main() {
  const db = await getDb();
  if (!db) throw new Error("No DB connection — is DATABASE_URL set?");

  const bot = (await db.select().from(users).where(eq(users.id, BENCHMARK_BOT_ID)).limit(1))[0];
  if (!bot) throw new Error(`Benchmark bot ${BENCHMARK_BOT_ID} not found`);
  console.log(`Benchmark bot ${BENCHMARK_BOT_ID}: displayName "${bot.displayName}" name "${bot.name}" → "${BENCHMARK_BOT_NAME}"`);
  console.log(`Hidden bots: ${HIDDEN_BOT_IDS.join(", ")} (filtered by the public queries; accounts untouched)`);

  const games = await db
    .select({ id: dailyGames.id, gameDate: dailyGames.gameDate })
    .from(dailyGames)
    .where(eq(dailyGames.status, "result_published"))
    .orderBy(asc(dailyGames.gameDate));
  console.log(`Published games whose community stats will be recomputed without bots: ${games.length}`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to make these changes.");
    process.exit(0);
  }

  await db.update(users).set({ displayName: BENCHMARK_BOT_NAME }).where(eq(users.id, BENCHMARK_BOT_ID));
  console.log(`Renamed bot ${BENCHMARK_BOT_ID} to "${BENCHMARK_BOT_NAME}".`);

  let changed = 0;
  for (const g of games) {
    const before = (await db.select().from(gameCommunityStats).where(eq(gameCommunityStats.gameId, g.id)).limit(1))[0];
    await computeAndStoreCommunityStats(g.id);
    const after = (await db.select().from(gameCommunityStats).where(eq(gameCommunityStats.gameId, g.id)).limit(1))[0];
    if (before?.totalParticipants !== after?.totalParticipants) {
      changed++;
      console.log(`  ${g.gameDate} id=${g.id}: participants ${before?.totalParticipants ?? "-"} → ${after?.totalParticipants}`);
    }
  }
  console.log(`\nAPPLIED. Community stats recomputed for ${games.length} games; ${changed} changed.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
