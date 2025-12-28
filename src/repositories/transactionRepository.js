import pool from '../config/database.js';

// UPDATED: Standard Transaction Creator (Added receipt_url support)
export const createTransaction = async (userId, amount, reference, type = 'deposit', receiptUrl = null) => {
  const result = await pool.query(
    `INSERT INTO transactions (user_id, amount, reference, status, type, receipt_url)
     VALUES ($1, $2, $3, 'success', $4, $5) RETURNING *`,
    [userId, amount, reference, type, receiptUrl]
  );
  return result.rows[0];
};

// Create transaction for investment ROI (daily earnings)
export const createInvestmentRoiTransaction = async (userId, amount, investmentId, client = null) => {
  const reference = `ROI-${investmentId}-${Date.now()}`;
  const query = client ? client.query.bind(client) : pool.query.bind(pool);
  const result = await query(
    `INSERT INTO transactions (user_id, amount, reference, status, type)
     VALUES ($1, $2, $3, 'success', 'investment_roi') RETURNING *`,
    [userId, amount, reference]
  );
  return result.rows[0];
};

// Create transaction for referral bonus
export const createReferralBonusTransaction = async (userId, amount, referredUserId, investmentId, client = null) => {
  const reference = `REF-${referredUserId}-${investmentId}-${Date.now()}`;
  const query = client ? client.query.bind(client) : pool.query.bind(pool);
  const result = await query(
    `INSERT INTO transactions (user_id, amount, reference, status, type)
     VALUES ($1, $2, $3, 'success', 'referral_bonus') RETURNING *`,
    [userId, amount, reference]
  );
  return result.rows[0];
};

// Create transaction for investment purchase
export const createInvestmentTransaction = async (userId, amount, investmentId, client = null) => {
  const reference = `INV-${investmentId}-${Date.now()}`;
  const query = client ? client.query.bind(client) : pool.query.bind(pool);
  const result = await query(
    `INSERT INTO transactions (user_id, amount, reference, status, type)
     VALUES ($1, $2, $3, 'success', 'investment') RETURNING *`,
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

export const updateTransactionStatus = async (tx_ref, status) => {
  try {
    const result = await pool.query(
      "UPDATE transactions SET status = $1 WHERE reference = $2 RETURNING *",
      [status, tx_ref]
    );

    if (result.rowCount === 0) {
      console.error(" Transaction status update failed. No rows affected for tx_ref:", tx_ref);
    } else {
      console.log(" Transaction status updated:", result.rows[0]);
    }

    return result;
  } catch (err) {
    console.error(" Error updating transaction status:", err.message);
    throw err;
  }
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

// UPDATED: Added receipt_url to history for Admin and User visibility
export const getAllTransactionsByUserId = async (userId) => {
  const query = `
    SELECT 
      id,
      amount,
      status,
      reference,
      type,
      created_at,
      bank_name,
      account_name,
      receipt_url
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

// UPDATED: Added receipt_url here too
export const getDepositTransactionsByUserId = async (userId) => {
  const query = `
    SELECT 
      id,
      amount,
      status,
      reference,
      type,
      created_at,
      receipt_url
    FROM transactions 
    WHERE user_id = $1 AND type = 'deposit'
    ORDER BY created_at DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};

// NEW: Helper specifically for the Manual Upload Feature
export const createManualDepositRecord = async (userId, amount, reference, receiptUrl) => {
  const query = `
    INSERT INTO transactions (user_id, amount, reference, status, type, receipt_url, created_at)
    VALUES ($1, $2, $3, 'pending', 'deposit', $4, NOW())
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [userId, amount, reference, receiptUrl]);
  return rows[0];
};
