import pool from '../config/database.js';

// 1. Insert User (Standard)
export const insertUser = async ({ fullName, phone, email, password, referralCode, referrerId, ownReferralCode, isAdmin = false, otpCode, otpExpiresAt}) => {
  const q = `INSERT INTO users (full_name, phone_number, email, password_hash, referral_code_used, referrer_id, own_referral_code, is_admin, otp_code, otp_expires_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *;`;
    
  const vals = [fullName, phone, email || null, password, referralCode || null, referrerId || null, ownReferralCode || null, isAdmin, otpCode, otpExpiresAt];
  const { rows } = await pool.query(q, vals);
  return rows[0];
};

export const findUserByPhone = async (phone) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE phone_number = $1', [phone]);
  return rows[0];
};

export const findUserByEmail = async (email) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0];
};

// 2. Wallet/Balance Logic
export const updateUserBalance = async (userId, newBalance, client = null) => {
  try {
    const query = client ? client.query.bind(client) : pool.query.bind(pool);
    const result = await query(
      "UPDATE users SET balance = $1 WHERE id = $2 RETURNING *",
      [newBalance, userId]
    );
    return result;
  } catch (err) {
    throw err;
  }
};

// --- TRANSACTION RECEIPT PRINTER ---
export const createTransaction = async ({ userId, amount, type, status = 'success', description = '' }) => {
  const query = `
    INSERT INTO transactions (user_id, amount, type, status, description, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [userId, amount, type, status, description]);
  return rows[0];
};

// --- FIXED: PIN MANAGEMENT (Changed transaction_pin to withdrawal_pin to match service/main.js) ---
export const setUserPin = async (userId, hashedPin) => {
  const query = `UPDATE users SET withdrawal_pin = $1 WHERE id = $2 RETURNING id`;
  const { rows } = await pool.query(query, [hashedPin, userId]);
  return rows[0];
};

export const getUserPin = async (userId) => {
  const query = `SELECT withdrawal_pin FROM users WHERE id = $1`;
  const { rows } = await pool.query(query, [userId]);
  return rows[0]?.withdrawal_pin;
};

// --- NEW: FETCH ACTIVE INVESTMENTS (For Days Left Timer) ---
export const getActiveInvestments = async (userId) => {
  // Joins investments with items table to get duration and name
  const query = `
    SELECT i.*, p.itemname, p.duration, p.dailyincome 
    FROM investments i
    JOIN items p ON i.plan_id = p.id
    WHERE i.user_id = $1 AND i.status = 'active'
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};

// --- MLM LOGIC - FIND 3 LEVELS OF UPLINES ---
export const getUplineChain = async (userId) => {
  const client = await pool.connect();
  try {
    const uplines = [];
    let currentUserId = userId;

    // Loop 3 times to find Level 1, 2, and 3
    for (let i = 0; i < 3; i++) {
      const query = `SELECT referrer_id FROM users WHERE id = $1`;
      const { rows } = await client.query(query, [currentUserId]);
      
      if (rows.length > 0 && rows[0].referrer_id) {
        const referrerId = rows[0].referrer_id;
        uplines.push(referrerId); // Add to list
        currentUserId = referrerId; // Move up to the next level
      } else {
        break; // Stop if no referrer exists
      }
    }
    return uplines; // Returns array like [Level1_ID, Level2_ID, Level3_ID]
  } finally {
    client.release();
  }
};
// --------------------------------------------------

export const findUserById = async (userId) => {
  const query = `SELECT * FROM users WHERE id = $1`;
  const { rows } = await pool.query(query, [userId]);
  return rows[0];
};

export const findUserEmailByUserId = async (userId) => {
  const { rows } = await pool.query("SELECT id, email FROM users WHERE id = $1", [userId]);
  return rows.length ? rows[0] : null;
};

export const updateUserEmail = async (userId, newEmail) => {
  const result = await pool.query("UPDATE users SET email = $1 WHERE id = $2", [newEmail, userId]);
  return result.rowCount === 1;
};

// 3. Referral Logic
export const findUserByReferralCode = async (referralCode) => {
  const query = `SELECT * FROM users WHERE own_referral_code = $1`;
  const { rows } = await pool.query(query, [referralCode]);
  return rows[0];
};

export const incrementReferralCount = async (userId) => {
  const query = `UPDATE users SET referral_count = COALESCE(referral_count, 0) + 1 WHERE id = $1 RETURNING *;`;
  const { rows } = await pool.query(query, [userId]);
  return rows[0];
};

export const updateUserVerification = async (email, verified) => {
  await pool.query(`UPDATE users SET is_verified = $1, otp_code = NULL, otp_expires_at = NULL WHERE email = $2`, [verified, email]);
};

// 4. Admin/Metrics
export const getAllUsers = async () => {
  const query = `SELECT id, full_name, phone_number, email, is_admin, balance, created_at FROM users ORDER BY created_at DESC`;
  const { rows } = await pool.query(query);
  return rows;
};

export const getTotalUsersCount = async () => {
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM users');
  return parseInt(rows[0].count);
};

export const getRecentUsers = async (limit = 10) => {
  const query = `SELECT full_name, phone_number, created_at FROM users ORDER BY created_at DESC LIMIT $1`;
  const { rows } = await pool.query(query, [limit]);
  return rows;
};

// 5. Team & Commission Logic
export const getReferredUsers = async (userId) => {
  const query = `
    SELECT id, 
           COALESCE(full_name, 'User') as full_name, 
           COALESCE(phone_number, 'N/A') as phone_number, 
           email, created_at, balance
    FROM users 
    WHERE referrer_id = $1
    ORDER BY created_at DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};

export const getTotalReferralCommission = async (userId) => {
  const query = `
    SELECT COALESCE(SUM(amount), 0) as total_commission
    FROM transactions
    WHERE user_id = $1 AND type = 'referral_bonus' AND status = 'success'
  `;
  const { rows } = await pool.query(query, [userId]);
  return parseFloat(rows[0].total_commission || 0);
};

// 6. Admin User Management
export const deleteUserById = async (userId) => {
  const query = `DELETE FROM users WHERE id = $1`;
  const result = await pool.query(query, [userId]);
  return result.rowCount === 1;
};

export const toggleAdminStatus = async (userId, status) => {
  const query = `UPDATE users SET is_admin = $1 WHERE id = $2 RETURNING *`;
  const { rows } = await pool.query(query, [status, userId]);
  return rows[0];
};
