export const insertItemQuery = `
  INSERT INTO items (itemName, price, dailyIncome, itemImage)
  VALUES ($1, $2, $3, $4)
`;
export const getItemByIdQuery = `
  SELECT * FROM items WHERE id = $1
`;
export const getAllItemsQuery = `
  SELECT * FROM items
`;
export const updateItemQuery = `
  UPDATE items  SET itemName = $2, price = $3, dailyIncome = $4, itemImage = $5 WHERE id = $1
`;
export const deleteItemQuery = `
  DELETE FROM items WHERE id = $1
`;