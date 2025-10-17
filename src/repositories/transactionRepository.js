import pool from '../config/database.js';

export const createTransaction = async (userId, amount, reference) => {
  const result = await pool.query(
    `INSERT INTO transactions (user_id, amount, reference, status)
     VALUES ($1, $2, $3, 'pending') RETURNING *`,
    [userId, amount, reference]
  );
  return result.rows[0];
};

export const findTransactionByUserId = async (user_Id) => {
  const query = `SELECT * FROM transactions WHERE user_Id = $1`;
  const { rows } = await pool.query(query, [user_Id]);
  return rows[0];
};

export const findTransactionByReference = async (reference) => {
  const result = await pool.query(
    'SELECT * FROM transactions WHERE reference = $1',
    [reference]
  );
  return result.rows[0];
};

export const updateTransactionStatus = async (reference, status) => {
  await pool.query(
    'UPDATE transactions SET status = $1 WHERE reference = $2',
    [status, reference]
  );
};

export const createWithdrawal = async (userId, amount, reference) => {
  const query = `
    INSERT INTO transactions (user_id, amount, reference, status, type)
    VALUES ($1, $2, $3, 'pending', 'withdrawal')
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [userId, amount, reference]);
  return rows[0];
};

export const getPendingWithdrawals = async () => {
  const query = `SELECT * FROM transactions WHERE status = 'pending' AND type = 'withdrawal'`;
  const { rows } = await pool.query(query);
  return rows;
};

export const getUserTransactions = async (userId) => {
  const query = `
    SELECT * FROM transactions 
    WHERE user_id = $1 
    ORDER BY created_at DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};