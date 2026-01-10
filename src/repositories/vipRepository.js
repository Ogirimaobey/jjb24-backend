// CASPERVIP Repository - Database queries for CASPERVIP products

/**
 * Insert a new VIP product.
 * Columns: name, price, daily_earnings, duration_days, total_returns, image
 */
export const insertVipQuery = `
  INSERT INTO casper_vip (name, price, daily_earnings, duration_days, total_returns, image)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING *;
`;

/**
 * Fetch all VIP products sorted by newest first.
 */
export const getAllVipsQuery = `
  SELECT * FROM casper_vip
  ORDER BY created_at DESC;
`;

/**
 * Fetch a single VIP product by its ID.
 */
export const getVipByIdQuery = `
  SELECT * FROM casper_vip WHERE id = $1;
`;

/**
 * Update an existing VIP product.
 * Uses COALESCE for the image to keep existing one if no new image is provided.
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
 * Delete a VIP product from the database.
 */
export const deleteVipQuery = `
  DELETE FROM casper_vip WHERE id = $1;
`;
