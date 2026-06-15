import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Promote the new Clerk account (id 133, clerkId user_3F9ttlYqC6BZXXwB7uslc3FX1MK) to admin
const [result] = await conn.execute(
  "UPDATE users SET role = 'admin' WHERE id = 133"
);
console.log('Rows updated:', result.affectedRows);

// Verify
const [rows] = await conn.execute('SELECT id, clerkId, email, role FROM users WHERE id = 133');
console.log('Updated user:', JSON.stringify(rows, null, 2));

await conn.end();
