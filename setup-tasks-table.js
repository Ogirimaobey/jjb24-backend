const { Pool } = require('pg');

const pool = new Pool({
  user: 'mac',
  host: 'localhost',
  database: 'skate_winery',
  password: '',
  port: 5433,
});

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS daily_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    task_date DATE NOT NULL DEFAULT CURRENT_DATE,
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, task_date)
  );
`;

const setupDatabase = async () => {
  try {
    console.log('Connecting to the database to set up daily_tasks table...');
    const client = await pool.connect();
    await client.query(createTableQuery);
    console.log('SUCCESS: "daily_tasks" table created successfully (or already existed).');
    client.release();
  } catch (error) {
    console.error('Error setting up the daily_tasks table:', error);
  } finally {
    await pool.end();
  }
};

setupDatabase();