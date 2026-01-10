import cron from 'node-cron';
// FIX: Using the correct relative path for the database config
import pool from './config/database.js'; 

console.log('[Scheduler] Investment Expiration Engine Started...');

// Run every midnight at 00:00
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Checking for expired investments...');
  const client = await pool.connect();

  try {
    // UPDATED: Changed created_at to start_date 
    // This query finds active investments that have passed their duration and marks them 'completed'
    const expireQuery = `
      UPDATE investments 
      SET status = 'completed' 
      WHERE status = 'active' 
      AND (start_date + (duration || ' days')::interval) < NOW()
      RETURNING id, user_id;
    `;

    const { rows } = await client.query(expireQuery);
    
    if (rows.length > 0) {
      console.log(`[Cron] SUCCESS: Expired ${rows.length} investments.`);
      // Optional: You could add a notification trigger here later
    } else {
      console.log('[Cron] No investments expired today.');
    }

  } catch (err) {
    console.error('[Cron Error] Failed to expire investments:', err);
  } finally {
    client.release();
  }
});
