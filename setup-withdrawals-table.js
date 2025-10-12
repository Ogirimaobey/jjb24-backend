const { Pool } = require('pg');

const pool = new Pool({
  user: 'mac',
  host: 'localhost',
  database: 'skate_winery',
  password: '',
  port: 5433,
});

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS withdrawals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount NUMERIC(10, 2) NOT NULL,
    bank_details JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

const setupDatabase = async () => {
  try {
    console.log('Connecting to the database to set up withdrawals table...');
    const client = await pool.connect();
    await client.query(createTableQuery);
    console.log('SUCCESS: "withdrawals" table created successfully.');
    client.release();
  } catch (error) {
    console.error('Error setting up the withdrawals table:', error);
  } finally {
    await pool.end();
  }
};

setupDatabase();