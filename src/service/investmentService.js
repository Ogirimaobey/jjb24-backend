import pool from '../config/database.js';
import { insertInvestment, getAllInvestments, updateInvestmentEarnings, getAllInvestmentsByUserId} from '../repositories/investmentRepository.js';
import { findUserById, updateUserBalance } from '../repositories/userRepository.js';
import { getItemByIdQuery } from '../repositories/itemRepository.js';

//Create investment for User
export const createInvestment = async (userId, itemId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const user = await findUserById(userId);
    if (!user) throw new Error('User not found');

    const { rows } = await client.query(getItemByIdQuery, [itemId]);
    const item = rows[0];

    if (!item) throw new Error('Item not found');

    if (Number(user.balance) < Number(item.price)) {
      throw new Error('Insufficient balance to make this investment');
    }

    const newUserBalance = Number(user.balance) - Number(item.price);
    await updateUserBalance(user.id, newUserBalance, client);

    const dailyEarning = item.dailyincome;

    const investment = await insertInvestment(
      { userId, itemId, dailyEarning, totalEarning: 0 },
      client
    );

    await client.query('COMMIT');
    return investment;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};



// This job runs daily to add each user's dailyEarning to their balance.
export const processDailyEarnings = async () => {
  const investments = await getAllInvestments(); 

  for (const investment of investments) {
    const { id, user_id, daily_earning, total_earning } = investment;

    const user = await findUserById(user_id);
    if (!user) {
      console.warn(`User ${user_id} not found for investment ${id}`);
      continue;
    }

    const newBalance = Number(user.balance) + Number(daily_earning);
    await updateUserBalance(user.id, newBalance);

    const newTotalEarning = Number(total_earning) + Number(daily_earning);
    await updateInvestmentEarnings(id, newTotalEarning);
  }
};

// Get all investments for a user with calculations
export const getUserInvestments = async (userId) => {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const investments = await getAllInvestmentsByUserId(userId);

  // Calculate total investment amount (sum of all item prices)
  let totalInvestmentAmount = 0;
  
  // Calculate total daily income (sum of all daily_earning)
  let totalDailyIncome = 0;

  // Format investments with item details
  const formattedInvestments = investments.map(investment => {
    const investmentAmount = Number(investment.price) || 0;
    const dailyIncome = Number(investment.daily_earning) || 0;
    
    totalInvestmentAmount += investmentAmount;
    totalDailyIncome += dailyIncome;

    return {
      id: investment.id,
      itemId: investment.item_id,
      itemName: investment.itemName,
      itemImage: investment.itemImage,
      investmentAmount: investmentAmount,
      dailyIncome: dailyIncome,
      totalEarning: Number(investment.total_earning) || 0,
      createdAt: investment.created_at
    };
  });

  return {
    investments: formattedInvestments,
    totalInvestmentAmount: totalInvestmentAmount,
    totalDailyIncome: totalDailyIncome,
    totalInvestments: investments.length
  };
};


