import pool from '../config/database.js';

/**
 * REBUILD 1: Strict Database Insert
 */
export const insertInvestment = async (
  { userId, itemId, casperVipId, dailyEarning, totalEarning, duration, price }, 
  client
) => {
  const { rows } = await client.query(
    `
    INSERT INTO investments
    (user_id, item_id, caspervip_id, daily_earning, total_earning, start_date, end_date, status, price, amount, duration, days_left)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + ($6 || ' days')::interval, 'active', $7, $7, $6, $6)
    RETURNING *;
    `,
    [userId, itemId, casperVipId, dailyEarning, totalEarning, duration, price]
  );
  return rows[0];
};

/**
 * REBUILD 2: Universal User Investment Fetch (THE TRUTH LAYER)
 * Corrected: Column name is 'caspervip_id' (No underscore)
 */
export const getAllInvestmentsByUserId = async (userId) => {
  const query = `
    SELECT 
      i.id,
      i.user_id,
      i.item_id,
      i.caspervip_id,
      i.start_date,
      i.end_date,
      i.status,
      
      -- STRICT NAME MAPPING
      COALESCE(cv.name, it.itemname) AS "itemname",
      
      -- STRICT PRICE MAPPING
      COALESCE(i.amount, i.price, 0) AS "price",
      
      -- STRICT YIELD MAPPING
      COALESCE(i.daily_earning, 0) AS "daily_earning",
      
      -- IMAGE MAPPING
      CASE 
        WHEN i.caspervip_id IS NOT NULL THEN cv.image 
        ELSE it.itemimage 
      END AS "itemimage",
      
      i.duration,
      i.total_earning,
      
      -- REAL-TIME COUNTDOWN
      GREATEST(0, EXTRACT(DAY FROM (i.end_date - CURRENT_TIMESTAMP))) AS "days_left"

    FROM investments i
    LEFT JOIN items it ON i.item_id = it.id
    LEFT JOIN casper_vip cv ON i.caspervip_id = cv.id
    WHERE i.user_id = $1 AND i.status = 'active'
    ORDER BY i.start_date DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};

// --- Standard Utility Functions ---

export const getAllInvestments = async () => {
  const { rows } = await pool.query("SELECT * FROM investments WHERE status = 'active'");
  return rows;
};

export const getInvestmentById = async (investmentId) => {
  const { rows } = await pool.query('SELECT * FROM investments WHERE id = $1', [investmentId]);
  return rows[0];
};

export const updateInvestmentEarnings = async (investmentId, totalEarning) => {
  const query = `UPDATE investments SET total_earning = $2 WHERE id = $1 RETURNING *;`;
  const { rows } = await pool.query(query, [investmentId, totalEarning]);
  return rows[0];
};

/**
 * ADMIN: Community Stats Sync
 */
export const getAllInvestmentsWithDetails = async () => {
  const query = `
    SELECT 
      i.id,
      i.user_id,
      i.start_date,
      i.status,
      u.full_name,
      COALESCE(cv.name, it.itemname) AS "plan_name",
      COALESCE(i.amount, i.price, 0) AS "investment_amount",
      GREATEST(0, EXTRACT(DAY FROM (i.end_date - CURRENT_TIMESTAMP))) AS "days_remaining"
    FROM investments i
    INNER JOIN users u ON i.user_id = u.id
    LEFT JOIN items it ON i.item_id = it.id
    LEFT JOIN casper_vip cv ON i.caspervip_id = cv.id
    ORDER BY i.start_date DESC
  `;
  const { rows } = await pool.query(query);
  return rows;
};

export const getTotalAmountInvested = async () => {
  const query = `SELECT SUM(COALESCE(amount, price, 0)) as total FROM investments WHERE status = 'active'`;
  const { rows } = await pool.query(query);
  return parseFloat(rows[0].total) || 0;
};

export const getTotalInvestmentsCount = async () => {
  const { rows } = await pool.query("SELECT COUNT(*) as count FROM investments WHERE status = 'active'");
  return parseInt(rows[0].count);
};

/**
 * FIX: Re-adding the missing export required by investmentService.js
 * Corrected: Column name is 'caspervip_id'
 */
export const getInvestmentEarningsHistory = async (userId) => {
  const query = `
    SELECT 
      i.id,
      i.start_date AS "date",
      i.daily_earning,
      i.total_earning,
      COALESCE(cv.name, it.itemname, 'Investment') AS "source_name",
      'investment_roi' AS "reward_type"
    FROM investments i
    LEFT JOIN items it ON i.item_id = it.id
    LEFT JOIN casper_vip cv ON i.caspervip_id = cv.id
    WHERE i.user_id = $1
    ORDER BY i.start_date DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};
