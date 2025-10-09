const { Pool } = require('pg');

// This configuration should be the same as in your server.js
const pool = new Pool({
  user: 'mac',
  host: 'localhost',
  database: 'skate_winery',
  password: '',
  port: 5433,
});

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    referral_code_used VARCHAR(50),
    own_referral_code VARCHAR(50) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

const setupDatabase = async () => {
  try {
    console.log('Connecting to the database to set up table...');
    const client = await pool.connect();
    await client.query(createTableQuery);
    console.log('SUCCESS: "users" table created successfully (or already existed).');
    client.release();
  } catch (error) {
    console.error('Error setting up the database:', error);
  } finally {
    await pool.end();
  }
};

setupDatabase();