import cron from 'node-cron';
import pool from '../config/database.js';

console.log('[Scheduler] Investment Expiration Engine Started...');

// Run every midnight at 00:00
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Checking for expired investments...');
  const client = await pool.connect();

  try {
    // 1. Find investments where (Creation Date + Duration) is in the PAST
    // AND the status is still 'active'.
    const expireQuery = `
      UPDATE investments 
      SET status = 'completed' 
      WHERE status = 'active' 
      AND (created_at + (duration || ' days')::interval) < NOW()
      RETURNING id, user_id;
    `;

    const { rows } = await client.query(expireQuery);
    
    if (rows.length > 0) {
      console.log(`[Cron] SUCCESS: Expired ${rows.length} investments.`);
    } else {
      console.log('[Cron] No investments expired today.');
    }

  } catch (err) {
    console.error('[Cron Error] Failed to expire investments:', err);
  } finally {
    client.release();
  }
});
