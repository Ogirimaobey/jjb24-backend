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
// 3. YIELD PROCESSING LOGIC
// ==========================================
export const processDailyEarnings = async () => {
  console.log(`[Yield Engine] Starting Daily Run: ${new Date().toISOString()}`);
  const investments = await getAllInvestments(); 

  for (const investment of investments) {
    const { id, user_id, daily_earning, total_earning, status, end_date } = investment;
    if (status !== 'active') continue;

    // EXPIRATION CHECK: If current time is past the end_date, kill the plan
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
// 4. DATA FETCH HANDSHAKE (MIRROR LOGIC)
// ==========================================
export const getUserInvestments = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found');

  const investments = await getAllInvestmentsByUserId(userId);

  let totalInvestmentAmount = 0;
  let totalDailyIncome = 0;

  const formattedInvestments = investments.map(inv => {
    // FORCE MIRROR DATA: Prioritize names and prices from the database row
    const displayName = inv.itemname || inv.itemName || 'Winery Plan';
    const actualPrice = Number(inv.price || inv.amount || 0);
    const dailyValue = Number(inv.daily_earning || 0);
    const daysRemaining = Number(inv.days_left) || 0;
    
    totalInvestmentAmount += actualPrice;
    if (inv.status === 'active') {
        totalDailyIncome += dailyValue;
    }

    return {
      id: inv.id,
      itemname: displayName,
      itemName: displayName, 
      
      price: actualPrice,                  
      investmentAmount: actualPrice,      
      amount: actualPrice,                
      
      daily_earning: dailyValue,
      dailyYield: dailyValue,
      
      total_earning: Number(inv.total_earning) || 0,
      totalAccumulated: Number(inv.total_earning) || 0,
      
      days_left: daysRemaining,          
      daysLeft: daysRemaining,           
      
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

export const getUserEarningsSummary = async (userId) => {
  try {
    const investments = await getAllInvestmentsByUserId(userId);
    let todayEarnings = 0;
    let yesterdayEarnings = 0;
    let totalEarnings = 0;
    
    investments.forEach(inv => {
      const daily = Number(inv.daily_earning) || 0;
      if (inv.status === 'active') {
        todayEarnings += daily;
        yesterdayEarnings += daily;
      }
      totalEarnings += Number(inv.total_earning) || 0;
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
    
    const referralRewards = referralResult.rows.map(row => ({
        id: `ref_${row.id}`,
        date: row.date,
        amount: parseFloat(row.amount || 0),
        source: `Referral Bonus`,
        type: 'referral_bonus',
        description: row.description || `Referral commission`
    }));

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
