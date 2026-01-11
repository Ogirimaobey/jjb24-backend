import pool from '../config/database.js';
import { insertInvestment, getAllInvestments, updateInvestmentEarnings, getAllInvestmentsByUserId, getInvestmentEarningsHistory} from '../repositories/investmentRepository.js';
import { findUserById, updateUserBalance, getReferredUsers, findUserByReferralCode } from '../repositories/userRepository.js';
import { getItemByIdQuery } from '../repositories/itemRepository.js';
import { getVipByIdQuery } from '../repositories/vipRepository.js';
import { createInvestmentTransaction, createReferralBonusTransaction, createInvestmentRoiTransaction } from '../repositories/transactionRepository.js';
import { distributeInvestmentCommissions } from './userService.js'; 

// ==========================================
// 1. STANDARD INVESTMENT LOGIC
// ==========================================
export const createInvestment = async (userId, itemId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const user = await findUserById(userId);
    if (!user) throw new Error('User not found');

    const { rows } = await client.query(getItemByIdQuery, [itemId]);
    const item = rows[0];
    if (!item) throw new Error('Item not found');

    const itemPrice = Number(item.price);
    if (Number(user.balance) < itemPrice) {
      throw new Error('Insufficient balance to make this investment');
    }

    const newUserBalance = Number(user.balance) - itemPrice;
    await updateUserBalance(user.id, newUserBalance, client);

    const investment = await insertInvestment(
      {
        userId,
        itemId: item.id,              
        casperVipId: null,        
        dailyEarning: Number(item.dailyincome),
        totalEarning: 0,
        duration: item.duration || 35,
        price: itemPrice, 
        status: 'active' 
      },
      client
    );

    await createInvestmentTransaction(user.id, itemPrice, investment.id, client);

    try {
        await distributeInvestmentCommissions(user.id, itemPrice);
    } catch (commError) {
        console.error(`[MLM Error] Commission failure: ${commError.message}`);
    }

    await client.query('COMMIT');
    return investment;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ==========================================
// 2. VIP INVESTMENT LOGIC
// ==========================================
export const createVipInvestment = async (userId, vipId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await findUserById(userId);
    if (!user) throw new Error('User not found');

    const { rows } = await client.query(getVipByIdQuery, [vipId]);
    const vip = rows[0];
    if (!vip) throw new Error('CASPERVIP product not found');

    const vipPrice = Number(vip.price);
    if (Number(user.balance) < vipPrice) {
      throw new Error('Insufficient balance to make this investment');
    }

    const newUserBalance = Number(user.balance) - vipPrice;
    await updateUserBalance(user.id, newUserBalance, client);

    const investment = await insertInvestment(
      {
        userId,
        itemId: null,              
        casperVipId: vip.id,        
        dailyEarning: Number(vip.daily_earnings),
        totalEarning: 0,
        duration: vip.duration_days || 30,
        price: vipPrice, 
        status: 'active'
      },
      client
    );

    await createInvestmentTransaction(user.id, vipPrice, investment.id, client);

    try {
        await distributeInvestmentCommissions(user.id, vipPrice);
    } catch (commError) {
        console.error(`[MLM Error] VIP Commission failure: ${commError.message}`);
    }

    await client.query('COMMIT');
    return investment;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ==========================================
// 3. YIELD PROCESSING LOGIC (THE PAYOUT ENGINE)
// ==========================================
export const processDailyEarnings = async () => {
  console.log(`[Yield Engine] Starting Daily Run: ${new Date().toISOString()}`);
  const investments = await getAllInvestments(); 

  for (const investment of investments) {
    const { id, user_id, daily_earning, total_earning, status, end_date } = investment;
    if (status !== 'active') continue;

    if (new Date() > new Date(end_date)) {
        await pool.query("UPDATE investments SET status = 'completed' WHERE id = $1", [id]);
        continue;
    }

    const user = await findUserById(user_id);
    if (!user) continue;

    const dailyYield = Number(daily_earning);
    const newBalance = Number(user.balance) + dailyYield;
    await updateUserBalance(user.id, newBalance);

    const newTotalEarning = Number(total_earning) + dailyYield;
    await updateInvestmentEarnings(id, newTotalEarning);

    await createInvestmentRoiTransaction(user_id, dailyYield, id);
  }
};

// ==========================================
// 4. DATA FETCH HANDSHAKE (ZERO NONSENSE REBUILD)
// ==========================================
export const getUserInvestments = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found');

  const investments = await getAllInvestmentsByUserId(userId);

  let totalInvestmentAmount = 0;
  let totalDailyIncome = 0;

  const formattedInvestments = investments.map(inv => {
    const displayName = inv.itemname || "Processing Asset...";
    const actualPrice = Number(inv.price || 0);
    const dailyValue = Number(inv.daily_earning || 0);
    const daysRemaining = Number(inv.days_left) || 0;
    
    totalInvestmentAmount += actualPrice;
    if (inv.status === 'active') {
        totalDailyIncome += dailyValue;
    }

    return {
      id: inv.id,
      itemName: displayName, 
      itemname: displayName,
      investmentAmount: actualPrice,      
      price: actualPrice,                
      dailyYield: dailyValue,
      daily_earning: dailyValue,
      totalAccumulated: Number(inv.total_earning) || 0,
      total_earning: Number(inv.total_earning) || 0,
      daysLeft: daysRemaining,           
      days_left: daysRemaining,           
      status: inv.status || 'active',
      start_date: inv.start_date
    };
  });

  return {
    active_investments: formattedInvestments,
    totalInvestmentAmount,
    totalDailyIncome,
    totalInvestments: investments.length,
    userBalance: Number(user.balance || 0)
  };
};

// ==========================================
// 5. MISSING EXPORTS (FIXES RENDER CRASH)
// ==========================================

export const getUserEarningsSummary = async (userId) => {
  try {
    const investments = await getAllInvestmentsByUserId(userId);
    let todayEarnings = 0;
    let totalEarnings = 0;
    
    investments.forEach(inv => {
      const daily = Number(inv.daily_earning) || 0;
      if (inv.status === 'active') {
        todayEarnings += daily;
      }
      totalEarnings += Number(inv.total_earning) || 0;
    });
    
    return { today: todayEarnings, total: totalEarnings };
  } catch (error) {
    throw new Error(`Earnings Summary Error: ${error.message}`);
  }
};

export const getRewardHistory = async (userId) => {
  try {
    const rewards = await getInvestmentEarningsHistory(userId);
    const summary = {
      total_rewards: rewards.reduce((sum, r) => sum + Number(r.daily_earning || 0), 0),
      total_count: rewards.length
    };
    return { rewards, summary };
  } catch (error) {
    throw new Error(`Reward History Error: ${error.message}`);
  }
};
