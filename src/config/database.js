import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pkg;

// Prioritize DB_URL (Render connection string) if available
// Otherwise use individual connection parameters
let poolConfig;

if (process.env.DB_URL) {
  // Use Render database connection string
  const dbUrl = process.env.DB_URL;
  console.log('[Database] Using DB_URL connection string');
  console.log('[Database] Host:', dbUrl.match(/@([^:]+):/)?.[1] || 'unknown');
  
  poolConfig = {
    connectionString: dbUrl,
    ssl: dbUrl.includes('dpg-') ? {
      rejectUnauthorized: false // Required for Render PostgreSQL
    } : false
  };
} else {
  // Use individual connection parameters (local database)
  console.log('[Database] Using individual connection parameters (local)');
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'jjb24db'
  };
}

const pool = new Pool(poolConfig);

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('[Database] Connection test failed:', err.message);
    console.error('[Database] Error code:', err.code);
    if (err.code === 'ENOTFOUND') {
      console.error('[Database] ⚠️  DNS resolution failed. The database hostname cannot be resolved.');
      console.error('[Database] ⚠️  This usually means:');
      console.error('[Database]    1. The database is not publicly accessible');
      console.error('[Database]    2. Your IP is not whitelisted');
      console.error('[Database]    3. Network connectivity issue');
      console.error('[Database] 💡 Solution: Check Render database settings or use local database for development');
    }
  } else {
    console.log('[Database] ✅ Connection test successful. Current time:', res.rows[0].now);
  }
});

export default pool;
