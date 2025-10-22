const { Pool } = require('pg');

const pool = new Pool({
  user: 'mac',
  host: 'localhost',
  database: 'skate_winery',
  password: '',
  port: 5433,
});
const alterTableQuery = `
  ALTER TABLE items 
  ADD COLUMN IF NOT EXISTS item TEXT; `;

const addItemColumn = async () => {

  try {
    console.log('Altering "items" table to add item column...');
    const client = await pool.connect();
    await client.query(alterTableQuery);
    console.log('SUCCESS: "item" column added successfully.');
    client.release();
  } catch (error) {
    console.error('Error altering table:', error);
  } finally {
    await pool.end();
  }
}
addItemColumn();