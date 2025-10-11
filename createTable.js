import pool from './src/config/database.js';

const createUserTable = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash TEXT NOT NULL,
    referral_code_used VARCHAR(50),
    own_referral_code VARCHAR(50) UNIQUE,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

const createTransactionsTable = `
  CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'success', 'failed')) DEFAULT 'pending',
    reference VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

const createDailyTaskTable = `
  CREATE TABLE IF NOT EXISTS daily_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    task_date DATE NOT NULL DEFAULT CURRENT_DATE,
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, task_date)
  );
`;


const createInvestmentTable = `
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
    console.log('Connecting to the database to set up table...');
    console.log('Creating tables...');

    const client = await pool.connect();

    await client.query(createUserTable);
    console.log('SUCCESS: "users" table created successfully (or already existed).');
    await client.query(createTransactionsTable);
    console.log('SUCCESS: "transactions" table created successfully (or already existed).');
    await client.query(createDailyTaskTable);
    console.log('SUCCESS: "daily_tasks" table created successfully (or already existed).');
    await client.query(createInvestmentTable);
    console.log('SUCCESS: "investments" table created successfully (or already existed).');

    client.release();
    console.log('Tables created/verified.');


  } catch (error) {
    console.error('Error setting up the database:', error);
  } finally {
    await pool.end();
  }
};

setupDatabase();