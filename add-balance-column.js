const { Pool } = require('pg');

const pool = new Pool({
  user: 'mac',
  host: 'localhost',
  database: 'skate_winery',
  password: '',
  port: 5433,
});

const alterTableQuery = `
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
`;

const addBalanceColumn = async () => {
  try {
    console.log('Altering "users" table to add balance column...');
    const client = await pool.connect();
    await client.query(alterTableQuery);
    console.log('SUCCESS: "balance" column added successfully.');
    client.release();
  } catch (error) {
    console.error('Error altering table:', error);
  } finally {
    await pool.end();
  }
};

addBalanceColumn();