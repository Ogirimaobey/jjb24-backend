import pool from '../config/database.js';
import { insertInvestment, getAllInvestments, updateInvestmentEarnings, getAllInvestmentsByUserId, getInvestmentEarningsHistory} from '../repositories/investmentRepository.js';
import { findUserById, updateUserBalance, getReferredUsers, findUserByReferralCode } from '../repositories/userRepository.js';
import { getItemByIdQuery } from '../repositories/itemRepository.js';
import { getVipByIdQuery } from '../repositories/vipRepository.js';
import { createInvestmentTransaction, createReferralBonusTransaction, createInvestmentRoiTransaction } from '../repositories/transactionRepository.js';
import { distributeInvestmentCommissions } from './userService.js'; 

// Create investment for User (Standard Items)
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

    const investment = await insertInvestment(
      {
        userId,
        itemId: item.id,              
        casperVipId: null,        
        dailyEarning: item.dailyincome,
        totalEarning: 0,
        duration: item.duration || 35,
        price: item.price, 
        status: 'active' 
      },
      client
    );

    await createInvestmentTransaction(user.id, item.price, investment.id, client);

    try {
        await distributeInvestmentCommissions(user.id, Number(item.price));
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

// Create CASPERVIP investment for User
export const createVipInvestment = async (userId, vipId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await findUserById(userId);
    if (!user) throw new Error('User not found');

    const { rows } = await client.query(getVipByIdQuery, [vipId]);
    const vip = rows[0];
    if (!vip) throw new Error('CASPERVIP product not found');

    if (Number(user.balance) < Number(vip.price)) {
      throw new Error('Insufficient balance to make this investment');
    }
    const newUserBalance = Number(user.balance) - Number(vip.price);
    await updateUserBalance(user.id, newUserBalance, client);

    const investment = await insertInvestment(
      {
        userId,
        itemId: null,              
        casperVipId: vip.id,        
        dailyEarning: vip.daily_earnings,
        totalEarning: 0,
        duration: vip.duration || 35,
        price: vip.price, 
        status: 'active'
      },
      client
    );

    await createInvestmentTransaction(user.id, vip.price, investment.id, client);

    try {
        await distributeInvestmentCommissions(user.id, Number(vip.price));
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

// Process daily earnings logic
export const processDailyEarnings = async () => {
  const investments = await getAllInvestments(); 

  for (const investment of investments) {
    const { id, user_id, daily_earning, total_earning, status } = investment;
    if (status && status !== 'active') continue;

    const user = await findUserById(user_id);
    if (!user) continue;

    const newBalance = Number(user.balance) + Number(daily_earning);
    await updateUserBalance(user.id, newBalance);

    const newTotalEarning = Number(total_earning) + Number(daily_earning);
    await updateInvestmentEarnings(id, newTotalEarning);

    await createInvestmentRoiTransaction(user_id, daily_earning, id);
  }
};

/**
 * FIXED USER INVESTMENTS FETCH
 * Mirroring keys to ensure Frontend never sees 'null' or '8k'
 */
export const getUserInvestments = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found');

  const investments = await getAllInvestmentsByUserId(userId);

  let totalInvestmentAmount = 0;
  let totalDailyIncome = 0;

  const formattedInvestments = investments.map(investment => {
    // Force values to numbers from Repository columns
    const priceValue = Number(investment.price) || 0;
    const dailyValue = Number(investment.daily_earning || investment.dailyincome) || 0;
    const daysRemaining = (investment.days_left !== undefined && investment.days_left !== null) ? Number(investment.days_left) : 0;
    
    totalInvestmentAmount += priceValue;
    if (investment.status === 'active') {
        totalDailyIncome += dailyValue;
    }

    return {
      id: investment.id,
      // REDUNDANT KEYS: Ensuring Frontend handshake never fails
      itemname: investment.itemname || 'Winery Plan',
      itemName: investment.itemname || 'Winery Plan', 
      
      price: priceValue,                 // The 500k fix
      investmentAmount: priceValue,      // Fallback key
      amount: priceValue,                // Fallback key
      
      daily_earning: dailyValue,
      dailyYield: dailyValue,
      dailyIncome: dailyValue,
      
      total_earning: Number(investment.total_earning) || 0,
      totalAccumulated: Number(investment.total_earning) || 0,
      
      days_left: daysRemaining,          // The null fix
      daysLeft: daysRemaining,           // Fallback key
      
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
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
    
    const investmentIds = roiResult.rows.map(row => {
      const match = row.reference.match(/ROI-(\d+)-/);
      return match ? parseInt(match[1]) : null;
    }).filter(id => id !== null);
    
    let sourceMap = {};
    if (investmentIds.length > 0) {
      const sourceQuery = `
        SELECT i.id, COALESCE(it.itemname, cv.name) as source_name
        FROM investments i
        LEFT JOIN items it ON i.item_id = it.id
        LEFT JOIN casper_vip cv ON i.caspervip_id = cv.id
        WHERE i.id = ANY($1::int[])
      `;
      const sourceResult = await pool.query(sourceQuery, [investmentIds]);
      sourceResult.rows.forEach(row => {
        sourceMap[row.id] = row.source_name || 'Investment';
      });
    }
    
    const investmentRewards = roiResult.rows.map(row => {
      const investmentId = row.reference.match(/ROI-(\d+)-/)?.[1];
      const sourceName = investmentId ? sourceMap[parseInt(investmentId)] : 'Investment';
      return {
        id: `roi_${row.id}`,
        date: row.date,
        amount: parseFloat(row.amount || 0),
        source: sourceName,
        type: 'investment_roi',
        description: `Daily ROI from ${sourceName}`
      };
    });

    const referralQuery = `
      SELECT t.id, t.amount, t.created_at as date, t.reference
      FROM transactions t
      WHERE t.user_id = $1 AND t.type = 'referral_bonus' AND t.status = 'success'
      ORDER BY t.created_at DESC
    `;
    const referralResult = await pool.query(referralQuery, [userId]);
    
    const referralRewards = referralResult.rows.map(row => {
      const match = row.reference ? row.reference.match(/REF-(\d+)-/) : null;
      const referredUserId = match ? parseInt(match[1]) : null;
      
      return {
        id: `ref_${row.id}`,
        date: row.date,
        amount: parseFloat(row.amount || 0),
        source: `Referral Bonus`,
        type: 'referral_bonus',
        description: row.description || `Referral commission`,
        referred_user_id: referredUserId
      };
    });
    
    const referredUserIds = referralRewards.map(r => r.referred_user_id).filter(id => id !== null);
    if (referredUserIds.length > 0) {
      const userQuery = `SELECT id, full_name FROM users WHERE id = ANY($1::int[])`;
      const userResult = await pool.query(userQuery, [referredUserIds]);
      const userMap = {};
      userResult.rows.forEach(u => { userMap[u.id] = u.full_name; });
      
      referralRewards.forEach(r => {
        if (r.referred_user_id && userMap[r.referred_user_id]) {
          r.source = `Referral: ${userMap[r.referred_user_id]}`;
        }
      });
    }

    const allRewards = [...investmentRewards, ...referralRewards].sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      rewards: allRewards,
      summary: {
        total_investment_roi: Math.round(investmentRewards.reduce((s, r) => s + r.amount, 0) * 100) / 100,
        total_referral_bonus: Math.round(referralRewards.reduce((s, r) => s + r.amount, 0) * 100) / 100,
        total_rewards: Math.round(allRewards.reduce((s, r) => s + r.amount, 0) * 100) / 100,
        total_count: allRewards.length
      }
    };
  } catch (error) {
    throw new Error(`Reward History Error: ${error.message}`);
  }
};
