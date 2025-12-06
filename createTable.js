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
  ADD CONSTRAINT investments_caspervip_id_fkey
  FOREIGN KEY (caspervip_id)
  REFERENCES casper_vip(id)
  ON DELETE CASCADE;

  ALTER TABLE investments
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
`
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



const setupDatabase = async () => {
  try {
    console.log('Connecting to the database to set up table...');
    console.log('Creating tables...');
    const client = await pool.connect();

    await client.query(createUserTable);
    console.log('SUCCESS: "users" table created successfully (or already existed).');
    await client.query(createTableAdmin);
    console.log('SUCCESS: "admin" table created successfully (or already existed).');
    await client.query(alterTableUsers);
    console.log('SUCCESS: "users" table altered successfully (if needed).');
    await client.query(createTransactionsTable);
    console.log('SUCCESS: "transactions" table created successfully (or already existed).');
    await client.query(alterTableTransactions);
    console.log('SUCCESS: "transactions" table altered successfully (if needed).');
    await client.query(createDailyTaskTable);
    console.log('SUCCESS: "daily_tasks" table created successfully (or already existed).');
    await client.query(createItemTable);
    console.log('SUCCESS: "items" table created successfully (or already existed).');
    await client.query(createVipTable);
    console.log('SUCCESS: "casper_vip" table created successfully (or already existed).');
    await client.query(createInvestmentTable);
    console.log('SUCCESS: "investments" table created successfully (or already existed).');
    await client.query(alterTableInvestments);
    console.log('SUCCESS: "investments" table altered successfully (if needed).');
    
    client.release();
    console.log('Tables created/verified.');


  } catch (error) {
    console.error('Error setting up the database:', error);
  } finally {
    await pool.end();
  }
};

setupDatabase();