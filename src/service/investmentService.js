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
