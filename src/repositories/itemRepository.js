const insertItemQuery = `
  INSERT INTO items (itemName, price, dailyIncome, itemImage)
  VALUES (?, ?, ?, ?)
`;