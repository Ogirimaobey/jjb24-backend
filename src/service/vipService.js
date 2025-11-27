import pool from '../config/database.js';
import { 
  insertVipQuery, 
  getAllVipsQuery, 
  getVipByIdQuery, 
  updateVipQuery, 
  deleteVipQuery 
} from '../repositories/vipRepository.js';

// Admin creates a new CASPERVIP product
export const createVip = async (vipData, imageUrl) => {
  const { name, price, daily_earnings, duration_days, total_returns } = vipData;

  if (!name || !price || !daily_earnings || !duration_days || !total_returns) {
    throw new Error("All fields are required: name, price, daily_earnings, duration_days, and total_returns");
  }

  const values = [name, price, daily_earnings, duration_days, total_returns, imageUrl || null];
  const { rows } = await pool.query(insertVipQuery, values);

  return {
    message: "CASPERVIP created successfully",
    vip: rows[0]
  };
};

// Get all CASPERVIP products
export const getAllVips = async () => {
  const { rows } = await pool.query(getAllVipsQuery);

  return {
    message: "CASPERVIP products retrieved successfully",
    vips: rows,
    totalCount: rows.length
  };
};

// Get single CASPERVIP by ID
export const getVipById = async (vipId) => {
  const { rows } = await pool.query(getVipByIdQuery, [vipId]);

  if (rows.length === 0) {
    throw new Error("CASPERVIP not found");
  }

  return {
    message: "CASPERVIP retrieved successfully",
    vip: rows[0]
  };
};

// Admin updates a CASPERVIP product
export const updateVip = async (vipId, vipData, imageUrl) => {
  const { name, price, daily_earnings, duration_days, total_returns } = vipData;

  const existingVip = await pool.query(getVipByIdQuery, [vipId]);
  if (existingVip.rows.length === 0) {
    throw new Error("CASPERVIP not found");
  }

  const finalImageUrl = imageUrl || existingVip.rows[0].image;

  const values = [vipId, name, price, daily_earnings, duration_days, total_returns, finalImageUrl];
  const { rows } = await pool.query(updateVipQuery, values);

  return {
    message: "CASPERVIP updated successfully",
    vip: rows[0]
  };
};

// Admin deletes a CASPERVIP product
export const deleteVip = async (vipId) => {
  const existingVip = await pool.query(getVipByIdQuery, [vipId]);
  if (existingVip.rows.length === 0) {
    throw new Error("CASPERVIP not found");
  }

  await pool.query(deleteVipQuery, [vipId]);

  return {
    message: "CASPERVIP deleted successfully"
  };
};

