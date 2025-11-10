import pool from '../config/database.js';

export const insertInvestment = async ({ userId, itemId, dailyEarning, totalEarning }, client = pool) => {
  const query = `
    INSERT INTO investments (user_id, item_id, daily_earning, total_earning)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const values = [userId, itemId, dailyEarning, totalEarning];
  const { rows } = await client.query(query, values);
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
