// src/repositories/itemRepository.js
import pool from '../config/database.js';

// 1. UPLOAD ITEM QUERY
// We add 'RETURNING *' to get the data back immediately
export const insertItemQuery = `
  INSERT INTO items (itemName, price, dailyIncome, itemImage, duration)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING *;
`;

// 2. GET ALL ITEMS QUERY
export const getAllItemsQuery = `
  SELECT * FROM items ORDER BY id ASC;
`;

// 3. GET SINGLE ITEM QUERY
export const getItemByIdQuery = `
  SELECT * FROM items WHERE id = $1;
`;

// 4. UPDATE ITEM QUERY
// We add 'RETURNING *' so the update is confirmed to the Admin
export const updateItemQuery = `
  UPDATE items 
  SET itemName = $2, price = $3, dailyIncome = $4, itemImage = $5, duration = $6 
  WHERE id = $1
  RETURNING *;
`;

// 5. DELETE ITEM QUERY
export const deleteItemQuery = `
  DELETE FROM items WHERE id = $1;
`;
