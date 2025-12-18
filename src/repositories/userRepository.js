import pool from '../config/database.js';

// 1. FIXED: Added referrer_id to the insert logic (10 values total)
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

// 4. Admin/Metrics (This is the 50+ lines I restored)
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

// 5. FIXED: Team & Commission Logic (Now using Referrer ID)
export const getReferredUsers = async (userId) => {
  const query = `
    SELECT id, full_name, phone_number, email, created_at, balance
    FROM users 
    WHERE referrer_id = $1
    ORDER BY created_at DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
};

export const getTotalReferralCommission = async (userId) => {
  const referredUsers = await getReferredUsers(userId);
  if (referredUsers.length === 0) return 0;
  const userIds = referredUsers.map(u => u.id);
  const query = `SELECT COALESCE(SUM(total_earning), 0) as total_commission FROM investments WHERE user_id = ANY($1::int[])`;
  const { rows } = await pool.query(query, [userIds]);
  const totalEarnings = parseFloat(rows[0].total_commission || 0);
  return totalEarnings * 0.05;
};

// 6. Admin User Management (RESTORED)
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
