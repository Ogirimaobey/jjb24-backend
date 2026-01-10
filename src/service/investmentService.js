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

    // UNIVERSAL MIRROR: Save standard item ID and duration
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
// 2. VIP INVESTMENT LOGIC (CHAMDOR KILLER)
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

    // UNIVERSAL MIRROR: Save VIP ID and set item_id to NULL
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
// 3. YIELD PROCESSING LOGIC (DAILY EARNINGS)
// ==========================================
/**
 * DURATION SAFEGUARD: This loop now checks if the plan has expired
 * before paying out. It automatically stops earnings at 0 days.
 */
export const processDailyEarnings = async () => {
  console.log(`[Yield Engine] Starting Daily Credit Run: ${new Date().toISOString()}`);
  
  const investments = await getAllInvestments(); 

  for (const investment of investments) {
    const { id, user_id, daily_earning, total_earning, status, end_date } = investment;
    
    // Safety check: Skip if already inactive
    if (status !== 'active') continue;

    // EXPIRATION CHECK: If current time is past the end_date, kill the plan
    if (new Date() > new Date(end_date)) {
        console.log(`[Yield Engine] Plan ${id} has expired. Marking as completed.`);
        await pool.query("UPDATE investments SET status = 'completed' WHERE id = $1", [id]);
        continue;
    }

    const user = await findUserById(user_id);
    if (!user) continue;

    const dailyYield = Number(daily_earning);
    const newBalance = Number(user.balance) + dailyYield;
    
    try {
        // 1. Credit User Wallet
        await updateUserBalance(user.id, newBalance);

        // 2. Update Investment Accumulated Earnings
        const newTotalEarning = Number(total_earning) + dailyYield;
        await updateInvestmentEarnings(id, newTotalEarning);

        // 3. Create Transaction Log for "My Rewards"
        await createInvestmentRoiTransaction(user_id, dailyYield, id);
        
        console.log(`[Yield Engine] Paid ₦${dailyYield} to User ${user_id} for Plan ${id}`);
    } catch (error) {
        console.error(`[Yield Engine] Failed to process Plan ${id}: ${error.message}`);
    }
  }
};

// ==========================================
// 4. DATA FETCH HANDSHAKE (SYNCED WITH MAIN.JS)
// ==========================================
export const getUserInvestments = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found');

  const investments = await getAllInvestmentsByUserId(userId);

  let totalInvestmentAmount = 0;
  let totalDailyIncome = 0;

  const formattedInvestments = investments.map(investment => {
    const priceValue = Number(investment.price) || 0;
    const dailyValue = Number(investment.daily_earning || 0);
    const daysRemaining = Number(investment.days_left) || 0;
    
    totalInvestmentAmount += priceValue;
    if (investment.status === 'active') {
        totalDailyIncome += dailyValue;
    }

    return {
      id: investment.id,
      // REDUNDANT SYNC: These keys match the frontend's search priority in main.js
      itemname: investment.itemname || 'Winery Plan',
      itemName: investment.itemname || 'Winery Plan', 
      
      price: priceValue,                  
      investmentAmount: priceValue,      
      amount: priceValue,                
      
      daily_earning: dailyValue,
      dailyYield: dailyValue,
      dailyIncome: dailyValue,
      
      total_earning: Number(investment.total_earning) || 0,
      totalAccumulated: Number(investment.total_earning) || 0,
      
      days_left: daysRemaining,          
      daysLeft: daysRemaining,           
      
      status: investment.status || 'active',
      start_date: investment.start_date
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

export const getUserEarningsSummary = async (userId) => {
  try {
    const investments = await getAllInvestmentsByUserId(userId);
    let todayEarnings = 0;
    let yesterdayEarnings = 0;
    let totalEarnings = 0;
    
    investments.forEach(investment => {
      const dailyEarning = Number(investment.daily_earning) || 0;
      if (investment.status === 'active') {
        todayEarnings += dailyEarning;
        yesterdayEarnings += dailyEarning;
      }
      totalEarnings += Number(investment.total_earning) || 0;
    });
    
    return { today: todayEarnings, yesterday: yesterdayEarnings, total: totalEarnings };
  } catch (error) {
    throw new Error(`Earnings Summary Error: ${error.message}`);
  }
};

export const getRewardHistory = async (userId) => {
  try {
    const user = await findUserById(userId);
    if (!user) throw new Error('User not found');

    const roiQuery = `
      SELECT t.id, t.amount, t.created_at as date, t.reference
      FROM transactions t
      WHERE t.user_id = $1 AND t.type = 'investment_roi' AND t.status = 'success'
      ORDER BY t.created_at DESC
    `;
    const roiResult = await pool.query(roiQuery, [userId]);
    
    const investmentRewards = roiResult.rows.map(row => {
      return {
        id: `roi_${row.id}`,
        date: row.date,
        amount: parseFloat(row.amount || 0),
        source: 'Winery Yield',
        type: 'investment_roi',
        description: `Daily ROI Credited`
      };
    });

    const referralQuery = `
      SELECT t.id, t.amount, t.created_at as date, t.reference, t.description
      FROM transactions t
      WHERE t.user_id = $1 AND t.type = 'referral_bonus' AND t.status = 'success'
      ORDER BY t.created_at DESC
    `;
    const referralResult = await pool.query(referralQuery, [userId]);
    
    const referralRewards = referralResult.rows.map(row => {
      return {
        id: `ref_${row.id}`,
        date: row.date,
        amount: parseFloat(row.amount || 0),
        source: `Referral Bonus`,
        type: 'referral_bonus',
        description: row.description || `Referral commission`
      };
    });

    const allRewards = [...investmentRewards, ...referralRewards].sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      rewards: allRewards,
      summary: {
        total_rewards: Math.round(allRewards.reduce((s, r) => s + r.amount, 0) * 100) / 100,
        total_count: allRewards.length
      }
    };
  } catch (error) {
    throw new Error(`Reward History Error: ${error.message}`);
  }
};
