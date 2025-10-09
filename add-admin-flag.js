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
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
`;

const addAdminFlag = async () => {
  try {
    console.log('Altering "users" table to add is_admin column...');
    const client = await pool.connect();
    await client.query(alterTableQuery);
    console.log('SUCCESS: "users" table altered successfully.');
    client.release();
  } catch (error) {
    console.error('Error altering table:', error);
  } finally {
    await pool.end();
  }
};

addAdminFlag();