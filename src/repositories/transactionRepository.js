import pool from '../config/database.js';

// Generic transaction creator (mainly for automated successful entries like credits)
export const createTransaction = async (userId, amount, reference, type = 'deposit', receiptUrl = null, client = null) => {
  const query = client ? client.query.bind(client) : pool.query.bind(pool);
  const result = await query(
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

// MANDATORY FOR PETER: Saves bank details for manual payout
export const createWithdrawalTransaction = async (userId, amount, reference, bankName, accountNumber, accountName, client = null) => {
  const query = client ? client.query.bind(client) : pool.query.bind(pool);
  const result = await query(
    `INSERT INTO transactions 
      (user_id, amount, reference, status, type, bank_name, account_number, account_name)
     VALUES ($1, $2, $3, 'pending', 'withdrawal', $4, $5, $6)
     RETURNING *`,
    [userId, amount, reference, bankName, accountNumber, accountName]
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

export const updateTransactionStatus = async (tx_ref, status) => {
  try {
    const result = await pool.query(
      "UPDATE transactions SET status = $1 WHERE reference = $2 RETURNING *",
      [status, tx_ref]
    );
    return result;
  } catch (err) {
    console.error(" Error updating transaction status:", err.message);
    throw err;
  }
};

// GETTER FOR PETER: Shows everything needed for manual bank transfer
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

// Logic for manual receipt uploads
export const createManualDepositRecord = async (userId, amount, reference, receiptUrl) => {
  const query = `
    INSERT INTO transactions (user_id, amount, reference, status, type, receipt_url, created_at)
    VALUES ($1, $2, $3, 'pending', 'deposit', $4, NOW())
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [userId, amount, reference, receiptUrl]);
  return rows[0];
};
