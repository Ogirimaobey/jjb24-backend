import pool from '../config/database.js';

// --- FIX 1: USE DATABASE COLUMNS DIRECTLY ---
export const insertInvestment = async (
  { userId, itemId, casperVipId, dailyEarning, totalEarning, duration, price }, 
  client
) => {
  const safeDuration = duration || 30;
  const safePrice = price || 0;

  const { rows } = await client.query(
    `
    INSERT INTO investments
    (user_id, item_id, caspervip_id, daily_earning, total_earning, start_date, end_date, status, price, amount, duration)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + ($6 || ' days')::interval, 'active', $7, $7, $6)
    RETURNING *;
    `,
    [userId, itemId, casperVipId, dailyEarning, totalEarning, safeDuration, safePrice]
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

// --- FIX 2: PULL REAL AMOUNT AND DAYS LEFT ---
export const getAllInvestmentsByUserId = async (userId) => {
  const query = `
    SELECT 
      i.id,
      i.user_id,
      i.item_id,
      i.daily_earning,
      i.total_earning,
      i.start_date,
      i.end_date,
      i.status,
      it.itemname as "itemname",
      COALESCE(i.price, i.amount, it.price) as "price", -- FIX: Uses investment price, not shop price
      COALESCE(i.price, i.amount, it.price) as "amount", -- FIX: For UI compatibility
      it.dailyincome as "dailyIncome",
      it.itemimage as "itemimage",
      COALESCE(i.duration, 35) as duration,
      EXTRACT(DAY FROM (i.end_date - CURRENT_DATE)) as "days_left" -- FIX: Real remaining days
    FROM investments i
    LEFT JOIN items it ON i.item_id = it.id
    WHERE i.user_id = $1
    ORDER BY i.start_date DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};

// --- FIX 3: ADMIN TOTAL VOLUME FIX ---
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
      COALESCE(it.itemname, cv.name) as plan_name,
      i.price as investment_amount
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
      i.start_date as date,
      i.daily_earning,
      i.total_earning,
      COALESCE(it.itemname, cv.name) as source_name,
      'investment_roi' as reward_type
    FROM investments i
    LEFT JOIN items it ON i.item_id = it.id
    LEFT JOIN casper_vip cv ON i.caspervip_id = cv.id
    WHERE i.user_id = $1
    ORDER BY i.start_date DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};
