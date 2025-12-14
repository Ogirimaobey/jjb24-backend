import pool from '../config/database.js';

// =======================
// 1. THE SQL QUERIES
// =======================

const insertItemQuery = `
  INSERT INTO items (itemName, price, dailyIncome, itemImage, duration)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING *;
`;

const getAllItemsQuery = `
  SELECT * FROM items ORDER BY id ASC;
`;

const getItemByIdQuery = `
  SELECT * FROM items WHERE id = $1;
`;

const updateItemQuery = `
  UPDATE items 
  SET itemName = $2, price = $3, dailyIncome = $4, itemImage = $5, duration = $6 
  WHERE id = $1
  RETURNING *;
`;

const deleteItemQuery = `
  DELETE FROM items WHERE id = $1;
`;

// =======================
// 2. THE MISSING FUNCTIONS (The Server needs these!)
// =======================

export const uploadItem = async ({ itemName, price, dailyIncome, duration }, imageUrl) => {
  // We pass 'duration' as the 5th item now
  const result = await pool.query(insertItemQuery, [itemName, price, dailyIncome, imageUrl, duration]);
  return result.rows[0];
};

export const getAllItems = async () => {
  const result = await pool.query(getAllItemsQuery);
  return { items: result.rows };
};

export const getItemById = async (id) => {
  const result = await pool.query(getItemByIdQuery, [id]);
  return result.rows[0];
};

export const updateItem = async (id, { itemName, price, dailyIncome, duration }, imageUrl) => {
  // We pass 'duration' as the 6th item (matching the $6 in the query above)
  const result = await pool.query(updateItemQuery, [id, itemName, price, dailyIncome, imageUrl, duration]);
  return result.rows[0];
};

export const deleteItem = async (id) => {
  const result = await pool.query(deleteItemQuery, [id]);
  return result.rows[0];
};
