const { Pool } = require('pg');

const pool = new Pool({
  user: 'mac',
  host: 'localhost',
  database: 'skate_winery',
  password: '',
  port: 5433,
});

const resetDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('Connecting to the database...');

    console.log('Dropping old tables (if they exist)...');
    await client.query('DROP TABLE IF EXISTS daily_tasks, withdrawals, investments, users CASCADE;');

    console.log('Creating "users" table...');
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        password_hash TEXT NOT NULL,
        referral_code_used VARCHAR(50),
        own_referral_code VARCHAR(50) UNIQUE,
        is_admin BOOLEAN DEFAULT false,
        balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('Creating "investments" table...');
    await client.query(`
      CREATE TABLE investments (
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
    `);

    console.log('Creating "daily_tasks" table...');
    await client.query(`
      CREATE TABLE daily_tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        task_date DATE NOT NULL DEFAULT CURRENT_DATE,
        tasks_completed INTEGER NOT NULL DEFAULT 0,
        UNIQUE (user_id, task_date)
      );
    `);

    console.log('Creating "withdrawals" table...');
    await client.query(`
      CREATE TABLE withdrawals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount NUMERIC(10, 2) NOT NULL,
        bank_details JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        requested_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('✅ SUCCESS: Database has been completely reset.');

  } catch (error) {
    console.error('Error during database reset:', error);
  } finally {
    client.release();
    await pool.end();
  }
};

resetDatabase();