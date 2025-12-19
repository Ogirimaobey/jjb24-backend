import pool from '../config/database.js';
import { insertInvestment, getAllInvestments, updateInvestmentEarnings, getAllInvestmentsByUserId, getInvestmentEarningsHistory} from '../repositories/investmentRepository.js';
import { findUserById, updateUserBalance, getReferredUsers, findUserByReferralCode } from '../repositories/userRepository.js';
import { getItemByIdQuery } from '../repositories/itemRepository.js';
import { getVipByIdQuery } from '../repositories/vipRepository.js';
import { createInvestmentTransaction, createReferralBonusTransaction, createInvestmentRoiTransaction } from '../repositories/transactionRepository.js';
// --- NEW IMPORT: MLM LOGIC ---
import { distributeInvestmentCommissions } from './userService.js'; 

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
      {
        userId,
        itemId: item.id,              
        casperVipId: null,        
        dailyEarning: dailyEarning,
        totalEarning: 0
      },
      client
    );

    // Create transaction record for investment
    await createInvestmentTransaction(user.id, item.price, investment.id, client);

    // --- NEW: TRIGGER 5-3-2 MLM COMMISSION ---
    // This replaces the old single-level 5% logic.
    // We do this AFTER the transaction is recorded but BEFORE committing.
    try {
        await distributeInvestmentCommissions(user.id, Number(item.price));
        console.log(`[MLM] Distributed commissions for Investment ${investment.id}`);
    } catch (commError) {
        console.error(`[MLM Error] Failed to distribute commissions: ${commError.message}`);
        // We do NOT rollback here because the investment itself was successful.
        // Commissions can be fixed manually if this fails, but we don't want to kill the user's purchase.
    }
    // ------------------------------------------

    await client.query('COMMIT');
    return investment;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};


//Create CASPERVIP investment for User
export const createVipInvestment = async (userId, vipId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await findUserById(userId);
    if (!user) throw new Error('User not found');

    const { rows } = await client.query(getVipByIdQuery, [vipId]);
    const vip = rows[0];

    console.log('VIP details from services: ', vip);

    if (!vip) throw new Error('CASPERVIP product not found');
    if (Number(user.balance) < Number(vip.price)) {
      throw new Error('Insufficient balance to make this investment');
    }
    const newUserBalance = Number(user.balance) - Number(vip.price);
    await updateUserBalance(user.id, newUserBalance, client);

    const dailyEarning = vip.daily_earnings;
    const investment = await insertInvestment(
      {
        userId,
        itemId: null,              
        casperVipId: vip.id,        
        dailyEarning: dailyEarning,
        totalEarning: 0
      },
      client
    );

    // Create transaction record for investment
    await createInvestmentTransaction(user.id, vip.price, investment.id, client);

    // --- NEW: TRIGGER 5-3-2 MLM COMMISSION ---
    try {
        await distributeInvestmentCommissions(user.id, Number(vip.price));
        console.log(`[MLM] Distributed VIP commissions for Investment ${investment.id}`);
    } catch (commError) {
        console.error(`[MLM Error] Failed to distribute VIP commissions: ${commError.message}`);
    }
    // ------------------------------------------

    await client.query('COMMIT');
    return investment;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in createVipInvestment:', err);
    throw err;
  } finally {
    client.release();
  }
};


// This runs daily to add each user's dailyEarning to their balance.
export const processDailyEarnings = async () => {
  const investments = await getAllInvestments(); 

  for (const investment of investments) {
    const { id, user_id, daily_earning, total_earning, status } = investment; // Ensure 'status' is fetched

    // --- NEW: STOP EARNING IF EXPIRED ---
    // If the scheduler marked it as 'completed', skip payment.
    if (status && status !== 'active') {
        continue;
    }
    // ------------------------------------

    const user = await findUserById(user_id);
    if (!user) {
      console.warn(`User ${user_id} not found for investment ${id}`);
      continue;
    }

    const newBalance = Number(user.balance) + Number(daily_earning);
    await updateUserBalance(user.id, newBalance);

    const newTotalEarning = Number(total_earning) + Number(daily_earning);
    await updateInvestmentEarnings(id, newTotalEarning);

    // Create transaction record for daily ROI
    await createInvestmentRoiTransaction(user_id, daily_earning, id);
    
    console.log(`[processDailyEarnings] Daily ROI credited: ₦${daily_earning} to user ${user_id} for investment ${id}`);
  }
  
  console.log(`[processDailyEarnings] ✅ Processed ${investments.length} investments`);
};

// Get all investments for a user with calculations
export const getUserInvestments = async (userId) => {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const investments = await getAllInvestmentsByUserId(userId);

  let totalInvestmentAmount = 0;
  
  let totalDailyIncome = 0;

  // Format investments with item details
  const formattedInvestments = investments.map(investment => {
    const investmentAmount = Number(investment.price) || 0;
    const dailyIncome = Number(investment.daily_earning) || 0;
    
    totalInvestmentAmount += investmentAmount;
    // Only count daily income if active
    if (investment.status === 'active' || !investment.status) {
        totalDailyIncome += dailyIncome;
    }

    return {
      id: investment.id,
      itemId: investment.item_id,
      itemName: investment.itemName,
      itemImage: investment.itemImage,
      investmentAmount: investmentAmount,
      dailyIncome: dailyIncome,
      totalEarning: Number(investment.total_earning) || 0,
      createdAt: investment.created_at,
      status: investment.status || 'active' // Return status to frontend
    };
  });

  return {
    investments: formattedInvestments,
    totalInvestmentAmount: totalInvestmentAmount,
    totalDailyIncome: totalDailyIncome,
    totalInvestments: investments.length
  };
};

// Get user earnings summary (today, yesterday, total)
export const getUserEarningsSummary = async (userId) => {
  try {
    const investments = await getAllInvestmentsByUserId(userId);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let todayEarnings = 0;
    let yesterdayEarnings = 0;
    let totalEarnings = 0;
    
    investments.forEach(investment => {
      const investmentDate = new Date(investment.created_at);
      const dailyEarning = Number(investment.daily_earning) || 0;
      const totalEarning = Number(investment.total_earning) || 0;
      
      // Note: This estimation assumes earnings happen regardless of status for past calculations
      // Ideally, we should query the transaction table for exact historical earnings
      
      if (investmentDate <= today && (investment.status === 'active' || !investment.status)) {
        todayEarnings += dailyEarning;
      }
      
      if (investmentDate <= yesterday) {
        yesterdayEarnings += dailyEarning;
      }
      
      totalEarnings += totalEarning;
    });
    
    return {
      today: todayEarnings,
      yesterday: yesterdayEarnings,
      total: totalEarnings
    };
  } catch (error) {
    throw new Error(`Failed to fetch earnings summary: ${error.message}`);
  }
};

// Get unified reward history combining investment ROI and referral bonuses
export const getRewardHistory = async (userId) => {
  try {
    console.log(`[getRewardHistory] Fetching reward history for user ${userId}`);
    const user = await findUserById(userId);
    if (!user) throw new Error('User not found');

    // Get investment ROI from transactions table (type = 'investment_roi')
    const roiQuery = `
      SELECT 
        t.id,
        t.amount,
        t.created_at as date,
        t.reference
      FROM transactions t
      WHERE t.user_id = $1 AND t.type = 'investment_roi' AND t.status = 'success'
      ORDER BY t.created_at DESC
    `;
    const roiResult = await pool.query(roiQuery, [userId]);
    console.log(`[getRewardHistory] Found ${roiResult.rows.length} ROI transactions`);
    
    // Get investment details for source names
    const investmentIds = roiResult.rows.map(row => {
      const match = row.reference.match(/ROI-(\d+)-/);
      return match ? parseInt(match[1]) : null;
    }).filter(id => id !== null);
    
    let sourceMap = {};
    if (investmentIds.length > 0) {
      const sourceQuery = `
        SELECT 
          i.id,
          COALESCE(it.itemname, cv.name) as source_name
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

    // Get referral bonuses from transactions table (type = 'referral_bonus')
    const referralQuery = `
      SELECT 
        t.id,
        t.amount,
        t.created_at as date,
        t.reference
      FROM transactions t
      WHERE t.user_id = $1 AND t.type = 'referral_bonus' AND t.status = 'success'
      ORDER BY t.created_at DESC
    `;
    const referralResult = await pool.query(referralQuery, [userId]);
    console.log(`[getRewardHistory] Found ${referralResult.rows.length} referral bonus transactions`);
    
    // Get referred user names from reference pattern REF-{userId}-{investmentId}-{timestamp}
    // Updated Logic: We now check 'description' field too because the new MLM logic saves descriptions like "Level 1 Commission..."
    const referralRewards = referralResult.rows.map(row => {
      // Try to parse from reference first (Legacy)
      const match = row.reference ? row.reference.match(/REF-(\d+)-/) : null;
      const referredUserId = match ? parseInt(match[1]) : null;
      
      return {
        id: `ref_${row.id}`,
        date: row.date,
        amount: parseFloat(row.amount || 0),
        source: `Referral Bonus`,
        type: 'referral_bonus',
        description: row.description || `Referral commission`, // Use stored description if available
        referred_user_id: referredUserId
      };
    });
    
    // Fetch referred user names if needed (Legacy Support)
    const referredUserIds = referralRewards.map(r => r.referred_user_id).filter(id => id !== null);
    if (referredUserIds.length > 0) {
      const userQuery = `SELECT id, full_name FROM users WHERE id = ANY($1::int[])`;
      const userResult = await pool.query(userQuery, [referredUserIds]);
      const userMap = {};
      userResult.rows.forEach(u => { userMap[u.id] = u.full_name; });
      
      referralRewards.forEach(r => {
        if (r.referred_user_id && userMap[r.referred_user_id]) {
          r.source = `Referral: ${userMap[r.referred_user_id]}`;
          if (!r.description || r.description === 'Referral commission') {
             r.description = `Referral commission from ${userMap[r.referred_user_id]}`;
          }
        }
      });
    }

    // Combine and sort by date (newest first)
    const allRewards = [...investmentRewards, ...referralRewards].sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });

    // Calculate totals
    const totalInvestmentROI = investmentRewards.reduce((sum, r) => sum + r.amount, 0);
    const totalReferralBonus = referralRewards.reduce((sum, r) => sum + r.amount, 0);
    const totalRewards = totalInvestmentROI + totalReferralBonus;

    console.log(`[getRewardHistory] Total rewards: ${allRewards.length}, ROI: ₦${totalInvestmentROI}, Referral: ₦${totalReferralBonus}`);

    return {
      rewards: allRewards,
      summary: {
        total_investment_roi: Math.round(totalInvestmentROI * 100) / 100,
        total_referral_bonus: Math.round(totalReferralBonus * 100) / 100,
        total_rewards: Math.round(totalRewards * 100) / 100,
        total_count: allRewards.length
      }
    };
  } catch (error) {
    console.error(`[getRewardHistory] Error:`, error);
    throw new Error(`Failed to fetch reward history: ${error.message}`);
  }
};
