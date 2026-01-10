import pool from '../config/database.js';

/**
 * FIX 1: Universal Insert
 * Replicating exactly how the Service provides data.
 * DURATION FIX: Dynamically sets end_date based on the specific plan duration.
 */
export const insertInvestment = async (
  { userId, itemId, casperVipId, dailyEarning, totalEarning, duration, price }, 
  client
) => {
  // We use client for transactional safety (BEGIN/COMMIT)
  const { rows } = await client.query(
    `
    INSERT INTO investments
    (user_id, item_id, caspervip_id, daily_earning, total_earning, start_date, end_date, status, price, amount, duration)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + ($6 || ' days')::interval, 'active', $7, $7, $6)
    RETURNING *;
    `,
    [userId, itemId, casperVipId, dailyEarning, totalEarning, duration, price]
  );

  return rows[0];
};

export const getAllInvestments = async () => {
  const { rows } = await pool.query("SELECT * FROM investments WHERE status = 'active'");
  return rows;
};

export const getInvestmentById = async (investmentId) => {
  const { rows } = await pool.query('SELECT * FROM investments WHERE id = $1', [investmentId]);
  return rows[0];
};

export const updateInvestmentEarnings = async (investmentId, totalEarning) => {
  const query = `
    UPDATE investments
    SET total_earning = $2
    WHERE id = $1
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [investmentId, totalEarning]);
  return rows[0];
};

/**
 * FIX 2: Universal User Investment Fetch
 * CHAMDOR FIX: Uses CASE to strictly separate VIP products from Standard Items.
 * 8K FIX: Prioritizes 'i.amount' (actual paid price) over shop templates.
 * COUNTDOWN FIX: Live calculation using database end_date minus current time.
 */
export const getAllInvestmentsByUserId = async (userId) => {
  const query = `
    SELECT 
      i.id,
      i.user_id,
      i.item_id,
      i.caspervip_id,
      i.daily_earning,
      i.total_earning,
      i.start_date,
      i.end_date,
      i.status,
      
      -- UNIVERSAL MIRROR: PREVENTS 'CHAMDOR 1' OVERWRITING VIP NAMES
      CASE 
        WHEN i.caspervip_id IS NOT NULL THEN cv.name 
        WHEN i.item_id IS NOT NULL THEN it.itemname 
        ELSE 'Winery Plan' 
      END AS "itemname",
      
      -- UNIVERSAL MIRROR: PREVENTS '8000' OVERWRITING ACTUAL PAID AMOUNT
      COALESCE(i.amount, i.price, it.price, cv.price, 0) AS "price",
      
      -- SNAPSHOT YIELD: PREVENTS SHOP CHANGES FROM AFFECTING ACTIVE PLANS
      COALESCE(i.daily_earning, it.dailyincome, cv.daily_earnings) AS "daily_earning",
      
      -- DYNAMIC IMAGE MAPPING
      CASE 
        WHEN i.caspervip_id IS NOT NULL THEN cv.image 
        ELSE it.itemimage 
      END AS "itemimage",
      
      -- DURATION SYNC
      COALESCE(i.duration, it.duration, cv.duration_days) AS "duration",
      
      -- LIVE DATABASE-LEVEL COUNTDOWN (ACCURATE TO THE SECOND)
      GREATEST(0, EXTRACT(DAY FROM (i.end_date - CURRENT_TIMESTAMP))) AS "days_left"

    FROM investments i
    LEFT JOIN items it ON i.item_id = it.id
    LEFT JOIN casper_vip cv ON i.caspervip_id = cv.id
    WHERE i.user_id = $1
    ORDER BY i.start_date DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};

/**
 * FIX 3: Global Admin Stats
 * Accurately calculates platform liquidity based on actual transactions.
 */
export const getTotalAmountInvested = async () => {
  const query = `
    SELECT SUM(COALESCE(amount, price, 0)) as total
    FROM investments 
    WHERE status = 'active'
  `;
  const { rows } = await pool.query(query);
  return parseFloat(rows[0].total) || 0;
};

/**
 * PETER'S VIEW: Community Stats
 * Ensures Admin sees exactly what the users are seeing for support transparency.
 */
export const getAllInvestmentsWithDetails = async () => {
  const query = `
    SELECT 
      i.id,
      i.user_id,
      i.start_date,
      i.status,
      u.full_name,
      CASE 
        WHEN i.caspervip_id IS NOT NULL THEN cv.name 
        WHEN i.item_id IS NOT NULL THEN it.itemname 
        ELSE 'Plan' 
      END AS "plan_name",
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

export const getTotalInvestmentsCount = async () => {
  const { rows } = await pool.query("SELECT COUNT(*) as count FROM investments WHERE status = 'active'");
  return parseInt(rows[0].count);
};

export const getInvestmentEarningsHistory = async (userId) => {
  const query = `
    SELECT 
      i.id,
      i.start_date AS "date",
      i.daily_earning,
      i.total_earning,
      CASE 
        WHEN i.caspervip_id IS NOT NULL THEN cv.name 
        WHEN i.item_id IS NOT NULL THEN it.itemname 
        ELSE 'Investment' 
      END AS "source_name",
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
