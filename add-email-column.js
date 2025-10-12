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
  ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
`;

const addEmailColumn = async () => {
  try {
    console.log('Altering "users" table to add email column...');
    const client = await pool.connect();
    await client.query(alterTableQuery);
    console.log('SUCCESS: "email" column added successfully.');
    client.release();
  } catch (error) {
    console.error('Error altering table:', error);
  } finally {
    await pool.end();
  }
};

addEmailColumn();