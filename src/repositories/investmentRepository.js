import pool from '../config/database.js';

// --- FIX 1: ADD STATUS AND USE START_DATE ---
export const insertInvestment = async (
  { userId, itemId, casperVipId, dailyEarning, totalEarning, duration }, 
  client
) => {
  const safeDuration = duration || 30;

  // We add 'active' as the default status here
  const { rows } = await client.query(
    `
    INSERT INTO investments
    (user_id, item_id, caspervip_id, daily_earning, total_earning, start_date, end_date, status)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + ($6 || ' days')::interval, 'active')
    RETURNING *;
    `,
    [userId, itemId, casperVipId, dailyEarning, totalEarning, safeDuration]
  );

  return rows[0];
};

export const getAllInvestments = async () => {
  // Only get active ones for the background earnings processor
  const { rows } = await pool.query("SELECT * FROM investments WHERE status = 'active'");
  return rows;
};

export const getInvestmentById = async (investmentId) => {
  const { rows } = await pool.query('SELECT * FROM investments WHERE id = $1', [investmentId]);
  return rows[0];
};

export const getInvestmentByUserAndItem = async (userId, itemId) => {
  const { rows } = await pool.query(
    'SELECT * FROM investments WHERE user_id = $1 AND item_id = $2',
    [userId, itemId]
  );
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

export const deleteInvestment = async (investmentId) => {
  await pool.query('DELETE FROM investments WHERE id = $1', [investmentId]);
};

// --- FIX 2: REMOVED CREATED_AT (WHICH NO LONGER EXISTS) ---
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
      it.itemname as "itemName",
      it.price,
      it.dailyincome as "dailyIncome",
      it.itemimage as "itemImage",
      EXTRACT(DAY FROM (i.end_date - i.start_date)) as duration
    FROM investments i
    LEFT JOIN items it ON i.item_id = it.id
    WHERE i.user_id = $1
    ORDER BY i.start_date DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};

// --- FIX 3: ADMIN VIEW UPDATED ---
export const getAllInvestmentsWithDetails = async () => {
  const query = `
    SELECT 
      i.id,
      i.user_id,
      i.item_id,
      i.start_date,
      i.status,
      u.full_name,
      COALESCE(it.itemname, cv.name) as plan_name,
      COALESCE(it.price, cv.price) as investment_amount
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
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM investments');
  return parseInt(rows[0].count);
};

export const getTotalAmountInvested = async () => {
  const query = `
    SELECT COALESCE(SUM(COALESCE(it.price, cv.price)), 0) as total
    FROM investments i
    LEFT JOIN items it ON i.item_id = it.id
    LEFT JOIN casper_vip cv ON i.caspervip_id = cv.id
  `;
  const { rows } = await pool.query(query);
  return parseFloat(rows[0].total) || 0;
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
