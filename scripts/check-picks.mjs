import { createConnection } from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
const conn = await createConnection(DB_URL);

console.log("=== Users columns ===");
const [cols] = await conn.query("DESCRIBE users");
console.table(cols);

console.log("\n=== Users (most recent first) ===");
const [users] = await conn.query("SELECT * FROM users ORDER BY id DESC LIMIT 10");
console.table(users);

console.log("\n=== Player Picks columns ===");
const [pickCols] = await conn.query("DESCRIBE player_picks");
console.table(pickCols);

console.log("\n=== Player Picks (most recent first) ===");
const [picks] = await conn.query("SELECT * FROM player_picks ORDER BY id DESC LIMIT 20");
console.table(picks);

await conn.end();
