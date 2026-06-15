import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT id, clerkId, email, role, createdAt FROM users ORDER BY createdAt DESC');
console.log(JSON.stringify(rows, null, 2));
await conn.end();
