import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('=== daily_games ===');
const [games] = await conn.execute(
  'SELECT id, gameDate, status, companyAName, companyATicker, companyBName, companyBTicker, createdAt FROM daily_games ORDER BY createdAt DESC'
);
console.log(JSON.stringify(games, null, 2));

console.log('\n=== game_research ===');
const [research] = await conn.execute(
  'SELECT id, gameId, createdAt FROM game_research ORDER BY createdAt DESC'
);
console.log(JSON.stringify(research, null, 2));

console.log('\n=== validation_questions ===');
const [vqs] = await conn.execute(
  'SELECT id, gameId, createdAt FROM validation_questions ORDER BY createdAt DESC'
);
console.log(JSON.stringify(vqs, null, 2));

console.log('\n=== daily_scores ===');
const [scores] = await conn.execute(
  'SELECT id, gameId, userId, createdAt FROM daily_scores ORDER BY createdAt DESC LIMIT 10'
);
console.log(JSON.stringify(scores, null, 2));

await conn.end();
