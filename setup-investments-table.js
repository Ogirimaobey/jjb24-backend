const { Pool } = require('pg');

const pool = new Pool({
  user: 'mac',
  host: 'localhost',
  database: 'skate_winery',
  password: '',
  port: 5433,
});

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS investments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    plan_id VARCHAR(10) NOT NULL,
    plan_name VARCHAR(100) NOT NULL,
    investment_amount NUMERIC(10, 2) NOT NULL,
    daily_revenue NUMERIC(10, 2) NOT NULL,
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
  );
`;

const setupDatabase = async () => {
  try {
    console.log('Connecting to the database to set up investments table...');
    const client = await pool.connect();
    await client.query(createTableQuery);
    console.log('SUCCESS: "investments" table created successfully (or already existed).');
    client.release();
  } catch (error) {
    console.error('Error setting up the investments table:', error);
  } finally {
    await pool.end();
  }
};

setupDatabase();