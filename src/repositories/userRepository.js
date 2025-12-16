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


// Update user balance
export const updateUserBalance = async (userId, newBalance) => {
  try {
    const result = await pool.query(
      "UPDATE users SET balance = $1 WHERE id = $2 RETURNING *",
      [newBalance, userId]
    );

    return result;
  } catch (err) {
    // console.error(" Error updating user balance:", err.message);
    throw err;
  }
};

export const findUserById = async (userId) => {
  const query = `SELECT * FROM users WHERE id = $1`;
  const { rows } = await pool.query(query, [userId]);
  return rows[0];
};

export const findUserEmailByUserId = async (userId) => {
  const { rows } = await pool.query(
    "SELECT id, email FROM users WHERE id = $1",
    [userId]
  );

  return rows.length ? rows[0] : null;
};


export const updateUserEmail = async (userId, newEmail) => {
  const result = await pool.query(
    "UPDATE users SET email = $1 WHERE id = $2",
    [newEmail, userId]
  );

  return result.rowCount === 1;
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

// Get all users referred by a specific user (by their referral code)
export const getReferredUsers = async (referralCode) => {
  const query = `
    SELECT 
      id,
      full_name,
      phone_number,
      email,
      created_at,
      balance
    FROM users 
    WHERE referral_code_used = $1
    ORDER BY created_at DESC
  `;
  const { rows } = await pool.query(query, [referralCode]);
  return rows;
};

// Get total commission earned from referrals (based on referred users' investments)
// This calculates commission as a percentage of referred users' total investment earnings
export const getTotalReferralCommission = async (referralCode) => {
  // Get all referred users
  const referredUsers = await getReferredUsers(referralCode);
  
  if (referredUsers.length === 0) {
    return 0;
  }

  // Calculate commission from each referred user's total earnings
  // Commission rate: 5% of their daily earnings (as per the frontend display)
  const userIds = referredUsers.map(u => u.id);
  
  const query = `
    SELECT COALESCE(SUM(total_earning), 0) as total_commission
    FROM investments
    WHERE user_id = ANY($1::int[])
  `;
  
  const { rows } = await pool.query(query, [userIds]);
  const totalEarnings = parseFloat(rows[0].total_commission || 0);
  
  // Calculate 5% commission on total earnings
  const commission = totalEarnings * 0.05;
  
  return commission;
};