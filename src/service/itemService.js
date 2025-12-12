import pool from '../config/database.js';
import { insertItemQuery, getAllItemsQuery, getItemByIdQuery, updateItemQuery, deleteItemQuery } from '../repositories/itemRepository.js';

// Admin uploads/creates a new item
export const uploadItem = async (itemData, imageUrl) => {
  const { itemName, price, dailyIncome, duration } = itemData;

  if (!itemName || !price || !dailyIncome || !imageUrl) {
    throw new Error("All fields are required: itemName, price, dailyIncome, and image");
  }

  // Default duration to 30 days if not provided
  const itemDuration = duration ? parseInt(duration) : 30;

  const values = [itemName, price, dailyIncome, imageUrl, itemDuration];
  const { rows } = await pool.query(insertItemQuery, values);

  return {
    message: "Item uploaded successfully",
    item: rows[0]
  };
};

// Get all items (for users to view)
export const getAllItems = async () => {
  const { rows } = await pool.query(getAllItemsQuery);

  return {
    message: "Items retrieved successfully",
    items: rows,
    totalCount: rows.length
  };
};

// Get single item by ID
export const getItemById = async (itemId) => {
  const { rows } = await pool.query(getItemByIdQuery, [itemId]);

  if (rows.length === 0) {
    throw new Error("Item not found");
  }

  return {
    message: "Item retrieved successfully",
    item: rows[0]
  };
};

// Admin updates an item
export const updateItem = async (itemId, itemData, imageUrl) => {
  const { itemName, price, dailyIncome, duration } = itemData;

  // Check if item exists
  const existingItem = await pool.query(getItemByIdQuery, [itemId]);
  if (existingItem.rows.length === 0) {
    throw new Error("Item not found");
  }

  // Use existing image if no new image provided
  const finalImageUrl = imageUrl || existingItem.rows[0].itemimage;
  // Use existing duration if not provided, default to 30
  const itemDuration = duration ? parseInt(duration) : (existingItem.rows[0].duration || 30);

  const values = [itemId, itemName, price, dailyIncome, finalImageUrl, itemDuration];
  const { rows } = await pool.query(updateItemQuery, values);

  return {
    message: "Item updated successfully",
    item: rows[0]
  };
};

// Admin deletes an item
export const deleteItem = async (itemId) => {
  const existingItem = await pool.query(getItemByIdQuery, [itemId]);
  if (existingItem.rows.length === 0) {
    throw new Error("Item not found");
  }

  await pool.query(deleteItemQuery, [itemId]);

  return {
    message: "Item deleted successfully"
  };
};
