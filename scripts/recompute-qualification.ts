/**
 * One-off: recompute `leaderboard_stats.qualificationStatus` after the
 * qualification threshold changed from 20 games to 10.
 *
 * WHY THIS IS NEEDED: qualificationStatus is STORED, not computed at read time.
 * `upsertLeaderboardStat()` only rewrites it when a player next plays, and
 * `getLeaderboard()` filters on the stored value. So a dormant player who now
 * qualifies at 10 games stays invisible on the leaderboard indefinitely —
 * the threshold change silently does nothing for them.
 *
 * SAFETY:
 *  - Dry run by default. Pass --apply to write.
 *  - Only ever touches `qualificationStatus`, and only on rows where the stored
 *    value disagrees with isQualified(gamesPlayed). Scores, games played and
 *    averages are never recalculated or modified.
 *  - Reads the threshold from the shared constant, so it cannot drift from
 *    what the app itself enforces.
 *
 * Usage (dry run, then apply):
 *   npx tsx scripts/recompute-qualification.ts
 *   npx tsx scripts/recompute-qualification.ts --apply
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { leaderboardStats, users } from "../drizzle/schema";
import { isQualified, LEADERBOARD_QUALIFICATION_THRESHOLD } from "../server/scoring";

const APPLY = process.argv.includes("--apply");

async function main() {
  const db = await getDb();
  if (!db) throw new Error("No DB connection — is DATABASE_URL set?");

  const rows = await db
    .select({
      userId: leaderboardStats.userId,
      gamesPlayed: leaderboardStats.gamesPlayed,
      averageDailyScore: leaderboardStats.averageDailyScore,
      stored: leaderboardStats.qualificationStatus,
      name: users.name,
      displayName: users.displayName,
    })
    .from(leaderboardStats)
    .leftJoin(users, eq(users.id, leaderboardStats.userId));

  const changes = rows
    .map((r) => {
      const correct = isQualified(r.gamesPlayed) ? "qualified" : "pending";
      return { ...r, correct };
    })
    .filter((r) => r.correct !== r.stored);

  console.log(`Threshold in force: ${LEADERBOARD_QUALIFICATION_THRESHOLD} games`);
  console.log(`leaderboard_stats rows scanned: ${rows.length}`);
  console.log(`Rows whose stored status disagrees: ${changes.length}\n`);

  if (changes.length === 0) {
    console.log("Nothing to change.");
    process.exit(0);
  }

  for (const c of changes) {
    const who = c.displayName || c.name || `user ${c.userId}`;
    console.log(
      `  userId=${c.userId}  ${who}  games=${c.gamesPlayed}  avg=${c.averageDailyScore}  ` +
        `${c.stored} → ${c.correct}`
    );
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to make these changes.");
    process.exit(0);
  }

  let updated = 0;
  for (const c of changes) {
    await db
      .update(leaderboardStats)
      .set({ qualificationStatus: c.correct as "qualified" | "pending" })
      .where(eq(leaderboardStats.userId, c.userId));
    updated++;
  }

  console.log(`\nAPPLIED — ${updated} row(s) updated.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
