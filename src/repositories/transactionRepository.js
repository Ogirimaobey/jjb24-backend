import pool from '../config/database.js';

export const createTransaction = async (userId, amount, reference) => {
  const result = await pool.query(
    `INSERT INTO transactions (user_id, amount, reference, status)
     VALUES ($1, $2, $3, 'pending') RETURNING *`,
    [userId, amount, reference]
  );
  return result.rows[0];
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

