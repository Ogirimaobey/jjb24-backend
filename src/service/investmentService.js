import { createInvestmentRecord, getAllInvestmentsQuery, updateInvestmentEarningsQuery} from '../repositories/investmentRepository.js';
import { findUserById, updateUserBalance } from '../repositories/userRepository.js';
import { findItemById } from '../repositories/itemRepository.js';

//Create investment for User
export const createInvestment = async (userId, itemId) => {
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found');
  console.log('Found user details:', user);

  const item = await findItemById(itemId);
  if (!item) throw new Error('Item not found');
  console.log('Found item details:', item);

  if (Number(user.balance) < Number(item.price)) {
    throw new Error('Insufficient balance to make this investment');
  }

  const newUserBalance = Number(user.balance) - Number(item.price);
  await updateUserBalance(user.id, newUserBalance);
  console.log(`Deducted ${item.price} from user ${userId}. New balance: ${newUserBalance}`);

  const dailyEarning = item.dailyIncome;

  const investment = await createInvestmentRecord(userId, itemId, dailyEarning, 0);

  return investment;
};



// This job runs daily to add each user's dailyEarning to their balance.
export const processDailyEarnings = async () => {
  console.log("Running daily earnings processor...");

  const { rows: investments } = await pool.query(getAllInvestmentsQuery);
  console.log(`Found ${investments.length} active investments.`);

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
    await pool.query(updateInvestmentEarningsQuery, [id, newTotalEarning]);

    console.log(
      `Updated user ${user.id} balance: ${newBalance}, investment ${id} total earning: ${newTotalEarning}`
    );
  }

  console.log("Daily earnings processing completed!");
};
