/**
 * Close the XOM vs CVX game (id=60001, date=2026-06-18)
 * XOM: Open 138.32, Close 137.81 → -0.369%
 * CVX: Open 175.64, Close 173.63 → -1.144%
 * Winner: XOM (Company A) — outperformed CVX on the day
 */
import mysql from "mysql2/promise";

const DB_URL = process.env.MUNYMO_DATABASE_URL;
if (!DB_URL) throw new Error("MUNYMO_DATABASE_URL not set");

const conn = await mysql.createConnection(DB_URL);

const GAME_ID = 60001;
const GAME_DATE = "2026-06-18";
const WINNER = "A"; // XOM
const XOM_PERF = -0.369;
const CVX_PERF = -1.144;

const resultSummary = `On June 18, 2026, both energy majors fell as oil prices declined, but Exxon Mobil (XOM) proved the more resilient of the two. XOM closed down 0.37% while Chevron (CVX) dropped 1.14%, making XOM the winner on the day. Energy sector weakness was broad-based, driven by concerns about global demand and a strengthening US dollar, but Exxon's slightly stronger balance sheet and recent production guidance gave investors more confidence to hold.`;

const hindsightSpotlight = `Both XOM and CVX fell on June 18 as crude oil prices softened on demand concerns, but XOM's relative outperformance of +0.77 percentage points over CVX was enough to determine the winner. This was a close call — both stocks moved in the same direction, and the margin was narrow. Players who picked XOM based on its stronger recent earnings trajectory and lower debt-to-equity ratio were rewarded. The key insight: in a sector-wide selloff, the company with the stronger balance sheet and more diversified revenue streams tends to hold up better.`;

const now = new Date().toISOString().slice(0, 19).replace("T", " ");
const publishedAt = now;

// 1. Update the game to result_published
await conn.query(
  `UPDATE daily_games SET
    status = 'result_published',
    winner = ?,
    companyAPerf = ?,
    companyBPerf = ?,
    resultSummary = ?,
    hindsightSpotlight = ?,
    publishedAt = ?,
    updatedAt = ?
   WHERE id = ?`,
  [WINNER, XOM_PERF, CVX_PERF, resultSummary, hindsightSpotlight, publishedAt, now, GAME_ID]
);
console.log("✅ Game", GAME_ID, "updated to result_published. Winner: XOM (A)");

// 2. Score all players who picked this game
const [picks] = await conn.query(
  `SELECT pp.id, pp.userId, pp.gutPick, pp.finalPick, pp.validationCorrect, pp.validationTimeSec,
          pp.gutMatchesFinal
   FROM player_picks pp
   WHERE pp.gameId = ? AND pp.finalPick IS NOT NULL`,
  [GAME_ID]
);

console.log(`Found ${picks.length} completed picks to score`);

for (const pick of picks) {
  const finalCorrect = pick.finalPick === WINNER;
  const gutCorrect = pick.gutPick === WINNER;

  // Scoring logic (matches server/scoring.ts)
  let baseScore = 0;
  if (finalCorrect) baseScore = 100;

  // Gut bonus: +20 if gut was also correct
  let gutBonus = 0;
  if (gutCorrect && finalCorrect) gutBonus = 20;

  // Validation bonus: +30 if correct, speed bonus up to +20
  let validationBonus = 0;
  if (pick.validationCorrect) {
    validationBonus = 30;
    // Speed bonus: full 20pts if answered in ≤5s, scaling down to 0 at 30s
    if (pick.validationTimeSec != null) {
      const speedBonus = Math.max(0, Math.round(20 * (1 - (pick.validationTimeSec - 5) / 25)));
      validationBonus += Math.min(20, speedBonus);
    }
  }

  // Consistency bonus: +10 if gut matched final and both correct
  let consistencyBonus = 0;
  if (pick.gutMatchesFinal && finalCorrect) consistencyBonus = 10;

  const totalScore = baseScore + gutBonus + validationBonus + consistencyBonus;

  // Update the pick with scores
  await conn.query(
    `UPDATE player_picks SET
      isCorrect = ?,
      gutIsCorrect = ?,
      score = ?,
      updatedAt = ?
     WHERE id = ?`,
    [finalCorrect ? 1 : 0, gutCorrect ? 1 : 0, totalScore, now, pick.id]
  );

  console.log(`  User ${pick.userId}: finalPick=${pick.finalPick} correct=${finalCorrect} score=${totalScore}`);

  // Update leaderboard_stats
  const [existing] = await conn.query(
    "SELECT * FROM leaderboard_stats WHERE userId = ?",
    [pick.userId]
  );

  if (existing.length > 0) {
    const stat = existing[0];
    const newGamesPlayed = stat.gamesPlayed + 1;
    const newCorrect = stat.correctPicks + (finalCorrect ? 1 : 0);
    const newTotalScore = stat.totalScore + totalScore;
    const newStreak = finalCorrect ? stat.currentStreak + 1 : 0;
    const newBestStreak = Math.max(stat.bestStreak, newStreak);
    const newAccuracy = Math.round((newCorrect / newGamesPlayed) * 100);

    await conn.query(
      `UPDATE leaderboard_stats SET
        gamesPlayed = ?, correctPicks = ?, totalScore = ?,
        currentStreak = ?, bestStreak = ?, accuracy = ?,
        updatedAt = ?
       WHERE userId = ?`,
      [newGamesPlayed, newCorrect, newTotalScore, newStreak, newBestStreak, newAccuracy, now, pick.userId]
    );
    console.log(`  Leaderboard updated for user ${pick.userId}: totalScore=${newTotalScore}, streak=${newStreak}`);
  } else {
    // Create new leaderboard entry
    await conn.query(
      `INSERT INTO leaderboard_stats (userId, gamesPlayed, correctPicks, totalScore, currentStreak, bestStreak, accuracy, createdAt, updatedAt)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)`,
      [pick.userId, finalCorrect ? 1 : 0, totalScore, finalCorrect ? 1 : 0, finalCorrect ? 1 : 0, finalCorrect ? 100 : 0, now, now]
    );
    console.log(`  New leaderboard entry for user ${pick.userId}`);
  }
}

// 3. Add to game_research archive if not already there
const [researchExists] = await conn.query(
  "SELECT id FROM game_research WHERE gameId = ?",
  [GAME_ID]
);

if (researchExists.length === 0) {
  await conn.query(
    `INSERT INTO game_research (gameId, content, researchMetrics, snapshotTakenAt, updatedAt)
     VALUES (?, ?, ?, ?, ?)`,
    [
      GAME_ID,
      `Exxon Mobil (XOM) vs Chevron (CVX) — June 18, 2026. Both energy majors declined on the day as oil prices softened. XOM fell 0.37% while CVX dropped 1.14%. XOM was the winner, outperforming CVX by 0.77 percentage points. The energy sector faced headwinds from demand concerns and a stronger US dollar. Exxon's more diversified downstream operations and slightly stronger balance sheet provided relative resilience.`,
      JSON.stringify({
        "XOM Open": "$138.32",
        "XOM Close": "$137.81",
        "XOM Day Change": "-0.37%",
        "CVX Open": "$175.64",
        "CVX Close": "$173.63",
        "CVX Day Change": "-1.14%",
        "Winner": "XOM (outperformed by +0.77pp)",
        "Sector": "Energy"
      }),
      now,
      now
    ]
  );
  console.log("✅ Research archive entry created for game", GAME_ID);
}

console.log("\n🎯 XOM vs CVX game closed successfully!");
console.log("   Winner: XOM (Company A) | -0.369% vs CVX -1.144%");
console.log("   Status: result_published");

await conn.end();
