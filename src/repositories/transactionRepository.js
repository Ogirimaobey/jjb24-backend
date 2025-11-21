import pool from '../config/database.js';

export const createTransaction = async (userId, amount, reference) => {
  const result = await pool.query(
    `INSERT INTO transactions (user_id, amount, reference, status)
     VALUES ($1, $2, $3, 'pending') RETURNING *`,
    [userId, amount, reference]
  );
  return result.rows[0];
};

export const createWithdrawalTransaction = async (userId, amount, reference, bankName, accountNumber, accountName) => {
  const result = await pool.query(
    `INSERT INTO transactions 
      (user_id, amount, reference, status, type, bank_name, account_number, account_name)
     VALUES ($1, $2, $3, 'pending', 'withdrawal', $4, $5, $6)
     RETURNING *`,
    [userId, amount, reference, bankName, accountNumber, accountName]
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
  const query = `
    SELECT 
      t.*,
      u.full_name,
      u.phone_number,
      u.email
    FROM transactions t
    INNER JOIN users u ON t.user_id = u.id
    WHERE t.status = 'pending' AND t.type = 'withdrawal'
    ORDER BY t.created_at DESC
  `;
  const { rows } = await pool.query(query);
  return rows;
};

export const getAllTransactionsByUserId = async (userId) => {
  const query = `
    SELECT 
      id,
      amount,
      status,
      reference,
      type,
      created_at
    FROM transactions 
    WHERE user_id = $1 
    ORDER BY created_at DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};

export const getWithdrawalTransactionsByUserId = async (userId) => {
  const query = `
    SELECT 
      id,
      amount,
      status,
      reference,
      type,
      created_at
    FROM transactions 
    WHERE user_id = $1 AND type = 'withdrawal'
    ORDER BY created_at DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};

export const getDepositTransactionsByUserId = async (userId) => {
  const query = `
    SELECT 
      id,
      amount,
      status,
      reference,
      type,
      created_at
    FROM transactions 
    WHERE user_id = $1 AND type = 'deposit'
    ORDER BY created_at DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};
