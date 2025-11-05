
export const insertInvestmentQuery = `
  INSERT INTO investments (user_id, item_id, daily_earning, total_earning)
  VALUES ($1, $2, $3, $4)
  RETURNING *;
`;

export const getAllInvestmentsQuery = `
  SELECT * FROM investments;
`;

export const getInvestmentByIdQuery = `
  SELECT * FROM investments WHERE id = $1;
`;

export const getInvestmentByUserAndItemQuery = `
  SELECT * FROM investments WHERE user_id = $1 AND item_id = $2;
`;

export const updateInvestmentEarningsQuery = `
  UPDATE investments
  SET daily_earning = $2, total_earning = $3
  WHERE id = $1
  RETURNING *;
`;

export const deleteInvestmentQuery = `
  DELETE FROM investments WHERE id = $1;
`;