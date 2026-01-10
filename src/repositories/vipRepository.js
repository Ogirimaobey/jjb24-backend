import pool from '../config/database.js';

// ==========================================
// 1. ADMIN VIP MANAGEMENT QUERIES
// ==========================================

/**
 * MANUAL UPLOAD: Peter adds a new VIP plan.
 * Columns: name, price, daily_earnings, duration_days, total_returns, image
 */
export const insertVipQuery = `
  INSERT INTO casper_vip (name, price, daily_earnings, duration_days, total_returns, image)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING *;
`;

/**
 * GET ALL VIPS: Peter views the list of VIP plans sorted by newest.
 */
export const getAllVipsQuery = `
  SELECT * FROM casper_vip
  ORDER BY created_at DESC;
`;

/**
 * GET SINGLE VIP: Fetch by ID for editing or details.
 */
export const getVipByIdQuery = `
  SELECT * FROM casper_vip WHERE id = $1;
`;

/**
 * MANUAL UPDATE: Peter modifies a VIP plan.
 * Uses COALESCE for the image to keep the existing one if no new file is uploaded.
 */
export const updateVipQuery = `
  UPDATE casper_vip 
  SET name = $2, 
      price = $3, 
      daily_earnings = $4, 
      duration_days = $5, 
      total_returns = $6, 
      image = COALESCE($7, image),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = $1
  RETURNING *;
`;

/**
 * MANUAL REMOVAL: Peter deletes a VIP plan from the platform.
 */
export const deleteVipQuery = `
  DELETE FROM casper_vip WHERE id = $1;
`;

// ==========================================
// 2. REPOSITORY EXPORT FUNCTIONS
// ==========================================

export const createVip = async (data, imageUrl) => {
  const { name, price, daily_earnings, duration_days, total_returns } = data;
  const { rows } = await pool.query(insertVipQuery, [
    name, 
    price, 
    daily_earnings, 
    duration_days, 
    total_returns, 
    imageUrl
  ]);
  return rows[0];
};

export const getAllVips = async () => {
  const { rows } = await pool.query(getAllVipsQuery);
  return { vips: rows };
};

export const getVipById = async (id) => {
  const { rows } = await pool.query(getVipByIdQuery, [id]);
  if (rows.length === 0) throw new Error("VIP Plan not found");
  return rows[0];
};

export const updateVip = async (id, data, imageUrl) => {
  const { name, price, daily_earnings, duration_days, total_returns } = data;
  const { rows } = await pool.query(updateVipQuery, [
    id, 
    name, 
    price, 
    daily_earnings, 
    duration_days, 
    total_returns, 
    imageUrl
  ]);
  return rows[0];
};

export const deleteVip = async (id) => {
  const result = await pool.query(deleteVipQuery, [id]);
  if (result.rowCount === 0) throw new Error("VIP Plan not found");
  return { success: true, message: "VIP Plan removed successfully from database." };
};
