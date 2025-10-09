import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'jjb24db',
  password: 'Ol@leye1998', // replace this
  port: 5432,
});

console.log('Connecting to the database to set up table...');

try {
  const res = await pool.query('SELECT NOW()');
  console.log('✅ Connected! Current time:', res.rows[0].now);
} catch (err) {
  console.error('❌ DB connection failed:', err);
} finally {
  await pool.end();
}
