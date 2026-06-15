import { createConnection } from "mysql2/promise";

const conn = await createConnection(process.env.DATABASE_URL);

console.log("\n========== DAILY GAMES ==========");
const [games] = await conn.query("SELECT * FROM daily_games");
for (const g of games) {
  console.log(`\nGame ID: ${g.id}`);
  console.log(`  Date: ${g.gameDate} | Status: ${g.status} | Exchange: ${g.exchange}`);
  console.log(`  Company A: ${g.companyATicker} (${g.companyAName})`);
  console.log(`  Company B: ${g.companyBTicker} (${g.companyBName})`);
  console.log(`  Lockout: ${g.lockoutAt}`);
  console.log(`  Winner: ${g.winner ?? "(not set yet)"}`);
  console.log(`  Company A perf: ${g.companyAPerformance ?? "(not set yet)"}%`);
  console.log(`  Company B perf: ${g.companyBPerformance ?? "(not set yet)"}%`);
  console.log(`  Result summary: ${g.resultSummary ?? "(not set yet)"}`);
}

console.log("\n========== GAME RESEARCH ==========");
const [research] = await conn.query(`
  SELECT id, gameId,
    content IS NOT NULL as hasNarrative,
    JSON_LENGTH(researchMetrics) as metricCount,
    researchSnapshot IS NOT NULL as hasSnapshot,
    metricsSnapshot IS NOT NULL as hasMetricsSnapshot,
    snapshotTakenAt
  FROM game_research
`);
console.table(research);

console.log("\n========== VALIDATION QUESTIONS ==========");
const [questions] = await conn.query("SELECT id, gameId, questionText, questionType, correctAnswer, options FROM validation_questions");
for (const q of questions) {
  console.log(`\nGame ${q.gameId}: ${q.questionText}`);
  console.log(`  Type: ${q.questionType} | Correct: ${q.correctAnswer}`);
  try {
    const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
    console.log(`  Options: ${JSON.stringify(opts)}`);
  } catch { console.log(`  Options: ${q.options}`); }
}

console.log("\n========== PLAYER PICKS ==========");
const [picks] = await conn.query(`
  SELECT pp.id, u.email, pp.gameId, pp.gutSelection, pp.finalSelection,
         pp.validationAnswer, pp.validationAnswerTimeMs, pp.isLocked,
         pp.gutSubmittedAt, pp.finalSubmittedAt, pp.validationSubmittedAt
  FROM player_picks pp
  JOIN users u ON u.id = pp.userId
  ORDER BY pp.id DESC
`);
console.table(picks);

console.log("\n========== DAILY SCORES ==========");
const [scores] = await conn.query("SELECT * FROM daily_scores ORDER BY id DESC");
if (scores.length === 0) {
  console.log("  (empty — scores are calculated when results are published)");
} else {
  console.table(scores);
}

console.log("\n========== STREAK RECORDS ==========");
const [streaks] = await conn.query(`
  SELECT sr.userId, u.email, sr.currentStreak, sr.longestStreak,
         sr.lastParticipationDate, sr.awayStatus
  FROM streak_records sr
  JOIN users u ON u.id = sr.userId
  ORDER BY sr.id DESC
`);
if (streaks.length === 0) {
  console.log("  (empty)");
} else {
  console.table(streaks);
}

console.log("\n========== LEADERBOARD STATS ==========");
const [lb] = await conn.query("SELECT * FROM leaderboard_stats ORDER BY id DESC");
if (lb.length === 0) {
  console.log("  (empty — populated when results are published)");
} else {
  console.table(lb);
}

await conn.end();
console.log("\n========== AUDIT COMPLETE ==========");
