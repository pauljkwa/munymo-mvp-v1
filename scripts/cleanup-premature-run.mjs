/**
 * Cleanup script: removes premature curation run from 2026-06-23 20:22 UTC
 *
 * Actions:
 * 1. Delete game 120001 (KO vs PEP, 2026-06-24) — created prematurely
 * 2. Delete game_research for game 120001
 * 3. Delete daily_scores for game 90001 (NFLX vs DIS) — scored with intraday prices
 * 4. Reset game 90001 status back to 'locked', clear winner/result fields
 * 5. Reset player_picks for game 90001 — clear isLocked so picks remain but game re-opens
 *
 * Player picks (gutSelection, finalSelection, validationAnswer) are PRESERVED.
 * Only scoring results and the premature next game are removed.
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.MUNYMO_DATABASE_URL || process.env.DATABASE_URL);

try {
  console.log('Starting cleanup...');

  // 1. Delete game_research for tomorrow's premature game (120001)
  const [r1] = await conn.execute('DELETE FROM game_research WHERE gameId = 120001');
  console.log(`Deleted ${r1.affectedRows} game_research row(s) for game 120001`);

  // 2. Delete tomorrow's premature game entirely (120001)
  const [r2] = await conn.execute('DELETE FROM daily_games WHERE id = 120001');
  console.log(`Deleted ${r2.affectedRows} daily_games row(s) for game 120001 (KO vs PEP)`);

  // 3. Delete daily_scores for today's game (90001) — scored with intraday prices
  const [r3] = await conn.execute('DELETE FROM daily_scores WHERE gameId = 90001');
  console.log(`Deleted ${r3.affectedRows} daily_scores row(s) for game 90001`);

  // 4. Reset game 90001 back to 'locked' — clear winner, result fields, publishedAt
  const [r4] = await conn.execute(`
    UPDATE daily_games 
    SET 
      status = 'locked',
      winner = NULL,
      resultCommentary = NULL,
      resultSummary = NULL,
      hindsightSpotlight = NULL,
      companyAPerf = NULL,
      companyBPerf = NULL,
      publishedAt = NULL
    WHERE id = 90001
  `);
  console.log(`Reset ${r4.affectedRows} daily_games row(s) for game 90001 (NFLX vs DIS) to locked`);

  // 5. Verify final state
  const [game90001] = await conn.execute('SELECT id, gameDate, status, winner, companyATicker, companyBTicker FROM daily_games WHERE id = 90001');
  const [game120001] = await conn.execute('SELECT id FROM daily_games WHERE id = 120001');
  const [scoresLeft] = await conn.execute('SELECT COUNT(*) as cnt FROM daily_scores WHERE gameId = 90001');

  console.log('\n--- Final state ---');
  console.log('Game 90001:', JSON.stringify(game90001[0]));
  console.log('Game 120001 exists:', game120001.length > 0 ? 'YES (problem!)' : 'NO (deleted OK)');
  console.log('daily_scores for 90001:', scoresLeft[0].cnt, '(should be 0)');
  console.log('\nCleanup complete. Cron will re-run at 21:30 UTC tonight.');

} finally {
  await conn.end();
}
