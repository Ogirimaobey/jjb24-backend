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
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

const createTableAdmin = `
  CREATE TABLE IF NOT EXISTS admin (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT true
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
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    daily_earning NUMERIC DEFAULT 0,
    total_earning NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const alterTableInvestments = `
  ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS caspervip_id INTEGER;

  ALTER TABLE investments
  DROP CONSTRAINT IF EXISTS investments_caspervip_id_fkey, 
  ADD CONSTRAINT investments_caspervip_id_fkey
  FOREIGN KEY (caspervip_id)
  REFERENCES casper_vip(id)
  ON DELETE CASCADE;

  ALTER TABLE investments
  DROP CONSTRAINT IF EXISTS investments_only_one_product_check, 
  ADD CONSTRAINT investments_only_one_product_check
  CHECK (
    (item_id IS NOT NULL AND caspervip_id IS NULL)
    OR
    (item_id IS NULL AND caspervip_id IS NOT NULL)
  );
`;

const alterTableUsers = `
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email VARCHAR(100) UNIQUE,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS balance NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_code_used VARCHAR(50), 
  ADD COLUMN IF NOT EXISTS own_referral_code VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10),  
  ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP,
  DROP COLUMN IF EXISTS type;
`;

const alterTableTransactions = `
  ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS type VARCHAR(20) CHECK (type IN ('deposit', 'withdrawal')) DEFAULT 'deposit',
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS account_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS account_name VARCHAR(100);
`;

const createItemTable = `
  CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    itemName VARCHAR(100) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    dailyIncome NUMERIC(10, 2) NOT NULL,
    itemImage VARCHAR(255) NOT NULL
  );
`;

const alterTableItems = `
  ALTER TABLE items 
  ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 30;
`;

const createVipTable = `
  CREATE TABLE IF NOT EXISTS casper_vip (
    id SERIAL PRIMARY KEY,   
    name VARCHAR(100) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    daily_earnings NUMERIC(10, 2) NOT NULL,
    duration_days INTEGER NOT NULL,
    total_returns NUMERIC(20, 2) NOT NULL,
    image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// --- [NEW] SEED VIP DATA ---
// This inserts the products automatically so the investment buttons work immediately.
const seedVipProducts = `
  INSERT INTO casper_vip (id, name, price, daily_earnings, duration_days, total_returns, image)
  VALUES 
  (101, 'CASPERVIP1', 500000, 20000, 30, 600000, 'https://placehold.co/300x200/1a1a1a/ffffff?text=CASPERVIP1'),
  (102, 'CASPERVIP2', 1000000, 40000, 30, 1200000, 'https://placehold.co/300x200/1a1a1a/ffffff?text=CASPERVIP2'),
  (103, 'CASPER3', 2000000, 80000, 30, 2400000, 'https://placehold.co/300x200/1a1a1a/ffffff?text=CASPER3'),
  (104, 'CASPER4', 3000000, 120000, 30, 3600000, 'https://placehold.co/300x200/1a1a1a/ffffff?text=CASPER4')
  ON CONFLICT (id) DO NOTHING;
`;
// ---------------------------

const setupDatabase = async () => {
  try {
    console.log('Connecting to the database to set up tables...');
    const client = await pool.connect();

    await client.query(createUserTable);
    await client.query(createTableAdmin);
    await client.query(alterTableUsers);
    await client.query(createTransactionsTable);
    await client.query(alterTableTransactions);
    await client.query(createDailyTaskTable);
    
    // Items (Regular)
    await client.query(createItemTable);
    await client.query(alterTableItems);
    
    // VIP & Investments
    await client.query(createVipTable);
    await client.query(createInvestmentTable);
    await client.query(alterTableInvestments);
    
    console.log('Tables created/verified.');

    // --- RUN SEEDING ---
    console.log('Seeding VIP Products...');
    await client.query(seedVipProducts);
    console.log('SUCCESS: VIP Products 101-104 ensured.');
    // -------------------

    client.release();

  } catch (error) {
    console.error('Error setting up the database:', error);
  }
  // Note: We do NOT call pool.end() here because this script runs on server startup
  // and the pool needs to remain open for the application to use
};

setupDatabase();
