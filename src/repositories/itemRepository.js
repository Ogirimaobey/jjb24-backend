import pool from '../config/database.js';

// ==========================================
// 1. ADMIN ITEM MANAGEMENT QUERIES
// ==========================================

// UPLOAD ITEM QUERY
export const insertItemQuery = `
  INSERT INTO items (itemname, price, dailyincome, itemimage, duration)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING *;
`;

// GET ALL ITEMS QUERY (For User Shop & Admin List)
export const getAllItemsQuery = `
  SELECT * FROM items ORDER BY price ASC;
`;

// GET SINGLE ITEM QUERY
export const getItemByIdQuery = `
  SELECT * FROM items WHERE id = $1;
`;

// UPDATE ITEM QUERY
export const updateItemQuery = `
  UPDATE items 
  SET itemname = $2, price = $3, dailyincome = $4, itemimage = $5, duration = $6 
  WHERE id = $1
  RETURNING *;
`;

// DELETE ITEM QUERY
export const deleteItemQuery = `
  DELETE FROM items WHERE id = $1;
`;

// ==========================================
// 2. REPOSITORY FUNCTIONS
// ==========================================

export const getAllItems = async () => {
  const { rows } = await pool.query(getAllItemsQuery);
  return rows;
};

export const getItemById = async (id) => {
  const { rows } = await pool.query(getItemByIdQuery, [id]);
  return rows[0];
};

/**
 * THE UNIVERSAL MIRROR: PULLS REAL NAMES AND PRICES
 * This stops 'Chamdor 1' from showing up for 500k plans.
 * It prioritizes 'caspervip_id' first.
 */
export const getUserActivePlansWithDetails = async (userId) => {
  const query = `
    SELECT 
      inv.id,
      inv.amount as actual_price,
      inv.daily_earning,
      inv.status,
      inv.start_date,
      inv.end_date,
      -- LOGIC: If caspervip_id is present, ignore the standard item name
      CASE 
        WHEN inv.caspervip_id IS NOT NULL THEN vip.name 
        WHEN inv.item_id IS NOT NULL THEN itm.itemname 
        ELSE 'Winery Plan' 
      END as display_name,
      -- LOGIC: Pull correct image based on specific table
      CASE 
        WHEN inv.caspervip_id IS NOT NULL THEN vip.image 
        ELSE itm.itemimage 
      END as display_image,
      -- LOGIC: Accurate countdown from database time
      GREATEST(0, EXTRACT(DAY FROM (inv.end_date - CURRENT_TIMESTAMP))) AS days_left
    FROM investments inv
    LEFT JOIN items itm ON inv.item_id = itm.id
    LEFT JOIN casper_vip vip ON inv.caspervip_id = vip.id
    WHERE inv.user_id = $1 AND inv.status = 'active'
    ORDER BY inv.start_date DESC;
  `;
  
  const { rows } = await pool.query(query, [userId]);
  return rows;
};

/**
 * ADMIN STATS: Platform Overview
 */
export const getAllPurchasesForAdmin = async () => {
  const query = `
    SELECT 
      inv.*, 
      u.full_name, 
      u.email,
      COALESCE(vip.name, itm.itemname) as product_name
    FROM investments inv
    JOIN users u ON inv.user_id = u.id
    LEFT JOIN items itm ON inv.item_id = itm.id
    LEFT JOIN casper_vip vip ON inv.caspervip_id = vip.id
    ORDER BY inv.created_at DESC
  `;
  const { rows } = await pool.query(query);
  return rows;
};
