import pool from '../config/database.js';

export const insertInvestment = async (
  { userId, itemId, casperVipId, dailyEarning, totalEarning },
  client
) => {
  const { rows } = await client.query(
    `
    INSERT INTO investments
    (user_id, item_id, caspervip_id, daily_earning, total_earning)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
    `,
    [userId, itemId, casperVipId, dailyEarning, totalEarning]
  );

  return rows[0];
};

export const getAllInvestments = async () => {
  const { rows } = await pool.query('SELECT * FROM investments');
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

// Get all investments for a specific user with item details
export const getAllInvestmentsByUserId = async (userId) => {
  const query = `
    SELECT 
      i.id,
      i.user_id,
      i.item_id,
      i.daily_earning,
      i.total_earning,
      i.created_at,
      it.itemname as "itemName",
      it.price,
      it.dailyincome as "dailyIncome",
      it.itemimage as "itemImage"
    FROM investments i
    INNER JOIN items it ON i.item_id = it.id
    WHERE i.user_id = $1
    ORDER BY i.created_at DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};

// Get all investments with user and item details (for admin)
export const getAllInvestmentsWithDetails = async () => {
  const query = `
    SELECT 
      i.id,
      i.user_id,
      i.item_id,
      i.created_at as start_date,
      u.full_name,
      it.itemname as plan_name,
      it.price as investment_amount
    FROM investments i
    INNER JOIN users u ON i.user_id = u.id
    INNER JOIN items it ON i.item_id = it.id
    ORDER BY i.created_at DESC
  `;
  const { rows } = await pool.query(query);
  return rows;
};

// Get total investments count
export const getTotalInvestmentsCount = async () => {
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM investments');
  return parseInt(rows[0].count);
};

// Get total amount invested (sum of all item prices from investments)
export const getTotalAmountInvested = async () => {
  const query = `
    SELECT COALESCE(SUM(it.price), 0) as total
    FROM investments i
    INNER JOIN items it ON i.item_id = it.id
  `;
  const { rows } = await pool.query(query);
  return parseFloat(rows[0].total) || 0;
};

// Get investment earnings history for reward history
export const getInvestmentEarningsHistory = async (userId) => {
  const query = `
    SELECT 
      i.id,
      i.created_at as date,
      i.daily_earning,
      i.total_earning,
      COALESCE(it.itemname, cv.name) as source_name,
      'investment_roi' as reward_type
    FROM investments i
    LEFT JOIN items it ON i.item_id = it.id
    LEFT JOIN casper_vip cv ON i.caspervip_id = cv.id
    WHERE i.user_id = $1
    ORDER BY i.created_at DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};
