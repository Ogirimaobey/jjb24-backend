import pool from '../config/database.js';

/**
 * FIX 1: Universal Insert
 * Replicating exactly how the Service provides data.
 */
export const insertInvestment = async (
  { userId, itemId, casperVipId, dailyEarning, totalEarning, duration, price }, 
  client
) => {
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
 * MIRRORED NAMES: Matches Service and Frontend exactly.
 * This pulls the actual price paid (500k) and the calculated days left.
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
      COALESCE(it.itemname, cv.name, 'Winery Plan') AS "itemname",
      COALESCE(i.price, i.amount, it.price, 0) AS "price",
      COALESCE(it.dailyincome, cv.daily_earnings, i.daily_earning) AS "daily_earning",
      COALESCE(it.itemimage, 'https://res.cloudinary.com/dja8976/image/upload/v1/default-plan.png') AS "itemimage",
      COALESCE(i.duration, it.duration, cv.duration) AS "duration",
      COALESCE(i.days_left, EXTRACT(DAY FROM (i.end_date - CURRENT_DATE))) AS "days_left"
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
 * Sums the actual volume using COALESCE for accuracy.
 */
export const getTotalAmountInvested = async () => {
  const query = `
    SELECT SUM(COALESCE(price, amount, 0)) as total
    FROM investments 
    WHERE status = 'active'
  `;
  const { rows } = await pool.query(query);
  return parseFloat(rows[0].total) || 0;
};

export const getAllInvestmentsWithDetails = async () => {
  const query = `
    SELECT 
      i.id,
      i.user_id,
      i.start_date,
      i.status,
      u.full_name,
      COALESCE(it.itemname, cv.name, 'Plan') AS "plan_name",
      COALESCE(i.price, i.amount, 0) AS "investment_amount"
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
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM investments WHERE status = \'active\'');
  return parseInt(rows[0].count);
};

export const getInvestmentEarningsHistory = async (userId) => {
  const query = `
    SELECT 
      i.id,
      i.start_date AS "date",
      i.daily_earning,
      i.total_earning,
      COALESCE(it.itemname, cv.name, 'Investment') AS "source_name",
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
