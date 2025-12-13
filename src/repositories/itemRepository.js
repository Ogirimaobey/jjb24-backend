import pool from '../config/database.js';

// ADMIN: Upload a new item
// FIX: Added 'RETURNING *' so the backend receives the new product data
export const insertItemQuery = `
  INSERT INTO items (itemName, price, dailyIncome, itemImage, duration)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING *;
`;

// USER & ADMIN: Get a single item
export const getItemByIdQuery = `
  SELECT * FROM items WHERE id = $1;
`;

// USER: Get All Items for the Homepage
// 'SELECT *' automatically fetches the 'duration' column
export const getAllItemsQuery = `
  SELECT * FROM items ORDER BY id ASC;
`;

// ADMIN: Update an Item
// FIX: Added 'RETURNING *' so the Admin Panel sees the update instantly
export const updateItemQuery = `
  UPDATE items 
  SET itemName = $2, price = $3, dailyIncome = $4, itemImage = $5, duration = $6 
  WHERE id = $1
  RETURNING *;
`;

// ADMIN: Delete an Item
export const deleteItemQuery = `
  DELETE FROM items WHERE id = $1;
`;
