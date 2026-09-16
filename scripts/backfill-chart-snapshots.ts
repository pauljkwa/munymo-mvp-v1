/**
 * Backfill archived price charts for already-published games.
 *
 * Going forward, `closeAndScoreGame` captures a chart snapshot at publish time.
 * Games published before that existed have none, so their practice pages show
 * no chart. This fills them in from historical daily data.
 *
 * SAFETY:
 *  - Dry run by default; pass --apply to write.
 *  - Only ever writes `game_research.chartSnapshot`. Nothing else is touched.
 *  - Candles are truncated to end the day BEFORE each game's date by the same
 *    tested function the live capture path uses, so a backfilled chart can no
 *    more reveal a result than a freshly captured one.
 *  - Skips games that already have a snapshot unless --force is passed.
 *  - Rate-limited between games: the free market-data tier is easily tripped,
 *    and a burst of failures would leave a half-filled archive.
 *
 * Usage:
 *   npx tsx scripts/backfill-chart-snapshots.ts            # dry run
 *   npx tsx scripts/backfill-chart-snapshots.ts --apply
 *   npx tsx scripts/backfill-chart-snapshots.ts --apply --limit 5
 */
import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import { getDb, getChartSnapshot } from "../server/db";
import { dailyGames } from "../drizzle/schema";
import { captureChartSnapshot } from "../server/routers";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

/** Free market-data tiers rate-limit aggressively; be a good citizen. */
const DELAY_MS = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const db = await getDb();
  if (!db) throw new Error("No DB connection — is DATABASE_URL set?");

  const games = await db
    .select({
      id: dailyGames.id,
      gameDate: dailyGames.gameDate,
      a: dailyGames.companyATicker,
      b: dailyGames.companyBTicker,
    })
    .from(dailyGames)
    .where(eq(dailyGames.status, "result_published"))
    .orderBy(desc(dailyGames.gameDate));

  const todo: typeof games = [];
  for (const g of games) {
    const existing = await getChartSnapshot(g.id);
    if (existing && !FORCE) continue;
    todo.push(g);
    if (todo.length >= LIMIT) break;
  }

  console.log(`Published games: ${games.length}`);
  console.log(`Needing a snapshot: ${todo.length}${FORCE ? " (--force: including existing)" : ""}\n`);

  if (todo.length === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  for (const g of todo) {
    console.log(`  ${g.gameDate}  ${g.a} vs ${g.b}  (id ${g.id})`);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply.`);
    console.log(`At ~${DELAY_MS / 1000}s between games this will take about ` +
      `${Math.ceil((todo.length * DELAY_MS) / 60000)} min.`);
    process.exit(0);
  }

  let ok = 0;
  let failed = 0;
  for (const g of todo) {
    try {
      const res = await captureChartSnapshot(g.id);
      if (res.ok) {
        ok++;
        const counts = Object.entries(res.counts ?? {})
          .map(([t, n]) => `${t}:${n}`)
          .join(" ");
        console.log(`  ✓ ${g.gameDate} ${g.a}/${g.b} — ${counts} candles`);
      } else {
        failed++;
        console.log(`  ✗ ${g.gameDate} ${g.a}/${g.b} — ${res.reason}`);
      }
    } catch (err) {
      failed++;
      console.log(`  ✗ ${g.gameDate} ${g.a}/${g.b} — ${String(err).slice(0, 120)}`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nDone. ${ok} captured, ${failed} failed.`);
  if (failed > 0) {
    console.log("Failures are safe to retry — the script skips games that already have one.");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
