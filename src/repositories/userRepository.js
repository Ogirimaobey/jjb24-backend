import pool from '../config/database.js';

export const insertUser = async ({ fullName, phone, email, password, referralCode, ownReferralCode, isAdmin = false }) => {
  const q = `INSERT INTO users (full_name, phone_number, email, password_hash, referral_code_used, own_referral_code, is_admin)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *;`;
  const vals = [fullName, phone, email || null, password, referralCode || null, ownReferralCode || null, isAdmin];
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

export const updateUserBalance = async (userId, newBalance) => {
  const query = `UPDATE users SET balance = $1 WHERE id = $2 RETURNING *;`;
  const { rows } = await pool.query(query, [newBalance, userId]);
  return rows[0];
};

export const findUserById = async (userId) => {
  const query = `SELECT * FROM users WHERE id = $1`;
  const { rows } = await pool.query(query, [userId]);
  return rows[0];
};