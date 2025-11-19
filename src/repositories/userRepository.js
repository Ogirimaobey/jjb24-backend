import pool from '../config/database.js';

export const insertUser = async ({ fullName, phone, email, password, referralCode, ownReferralCode, isAdmin = false, otpCode, otpExpiresAt}) => {
  const q = `INSERT INTO users (full_name, phone_number, email, password_hash, referral_code_used, own_referral_code, is_admin, otp_code, otp_expires_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7, $8, $9) RETURNING *;`;
  const vals = [fullName, phone, email || null, password, referralCode || null, ownReferralCode || null, isAdmin, otpCode, otpExpiresAt];
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

export const updateUserBalance = async (userId, newBalance, client = pool) => {
  const query = `
    UPDATE users
    SET balance = $1
    WHERE id = $2
    RETURNING *;
  `;
  const { rows } = await client.query(query, [newBalance, userId]);
  return rows[0];
};


export const findUserById = async (userId) => {
  const query = `SELECT * FROM users WHERE id = $1`;
  const { rows } = await pool.query(query, [userId]);
  return rows[0];
};

export const findUserByReferralCode = async (referralCode) => {
  const query = `SELECT * FROM users WHERE own_referral_code = $1`;
  const { rows } = await pool.query(query, [referralCode]);
  return rows[0];
};

export const incrementReferralCount = async (userId) => {
  const query = `
    UPDATE users 
    SET referral_count = COALESCE(referral_count, 0) + 1 
    WHERE id = $1
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows[0];
};

export const updateUserVerification = async (email, verified) => {
  await pool.query(
    `UPDATE users SET is_verified = $1, otp_code = NULL, otp_expires_at = NULL WHERE email = $2`,
    [verified, email]
  );
};

// Get all users (for admin)
export const getAllUsers = async () => {
  const query = `SELECT id, full_name, phone_number, email, is_admin, created_at FROM users ORDER BY created_at DESC`;
  const { rows } = await pool.query(query);
  return rows;
};

// Get total users count
export const getTotalUsersCount = async () => {
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM users');
  return parseInt(rows[0].count);
};

// Get recent users (last 10)
export const getRecentUsers = async (limit = 10) => {
  const query = `SELECT full_name, phone_number, created_at FROM users ORDER BY created_at DESC LIMIT $1`;
  const { rows } = await pool.query(query, [limit]);
  return rows;
};

// export const updateUserBalance = async (userId, newBalance) => {
//   const query = `UPDATE users SET balance = $1 WHERE id = $2 RETURNING *;`;
//   const { rows } = await pool.query(query, [newBalance, userId]);
//   return rows[0];
// };
