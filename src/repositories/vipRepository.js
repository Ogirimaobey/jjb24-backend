// CASPERVIP Repository - Database queries for CASPERVIP products

export const insertVipQuery = `
  INSERT INTO casper_vip (name, price, daily_earnings, duration_days, total_returns, image)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING *;
`;

export const getAllVipsQuery = `
  SELECT * FROM casper_vip
  ORDER BY created_at DESC;
`;

export const getVipByIdQuery = `
  SELECT * FROM casper_vip WHERE id = $1;
`;

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

export const deleteVipQuery = `
  DELETE FROM casper_vip WHERE id = $1;
`;

