import pool from '../config/database.js';
import { insertInvestment, getAllInvestments, updateInvestmentEarnings, getAllInvestmentsByUserId, getInvestmentEarningsHistory} from '../repositories/investmentRepository.js';
import { findUserById, updateUserBalance, getReferredUsers } from '../repositories/userRepository.js';
import { getItemByIdQuery } from '../repositories/itemRepository.js';
import { getVipByIdQuery } from '../repositories/vipRepository.js';

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
    // console.log('Created CASPERVIP investment: ', investment);

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

  let totalInvestmentAmount = 0;
  
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
      
      if (investmentDate <= today) {
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
    const user = await findUserById(userId);
    if (!user) throw new Error('User not found');

    // Get investment earnings history
    const investmentEarnings = await getInvestmentEarningsHistory(userId);
    
    // Format investment earnings as reward entries
    const investmentRewards = investmentEarnings.map(inv => ({
      id: `inv_${inv.id}`,
      date: inv.date,
      amount: parseFloat(inv.total_earning || 0),
      source: inv.source_name || 'Investment',
      type: 'investment_roi',
      description: `Daily ROI from ${inv.source_name || 'Investment'}`
    }));

    // Get referral bonuses (from transactions table if type='referral' exists, or calculate)
    // For now, we'll calculate referral commission from referred users' investments
    const referralCode = user.own_referral_code;
    let referralRewards = [];
    
    if (referralCode) {
      const referredUsers = await getReferredUsers(referralCode);
      
      // Calculate referral commission entries
      // This is a simplified version - in production, you might want to track individual referral bonuses
      if (referredUsers.length > 0) {
        const userIds = referredUsers.map(u => u.id);
        const query = `
          SELECT 
            i.id,
            i.created_at as date,
            i.total_earning,
            COALESCE(it.itemname, cv.name) as source_name,
            u.full_name as referred_user_name
          FROM investments i
          LEFT JOIN items it ON i.item_id = it.id
          LEFT JOIN casper_vip cv ON i.caspervip_id = cv.id
          INNER JOIN users u ON i.user_id = u.id
          WHERE i.user_id = ANY($1::int[])
          ORDER BY i.created_at DESC
        `;
        const { rows } = await pool.query(query, [userIds]);
        
        referralRewards = rows.map(row => ({
          id: `ref_${row.id}`,
          date: row.date,
          amount: parseFloat(row.total_earning || 0) * 0.05, // 5% commission
          source: `Referral: ${row.referred_user_name}`,
          type: 'referral_bonus',
          description: `5% commission from ${row.referred_user_name}'s investment`
        }));
      }
    }

    // Combine and sort by date (newest first)
    const allRewards = [...investmentRewards, ...referralRewards].sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });

    // Calculate totals
    const totalInvestmentROI = investmentRewards.reduce((sum, r) => sum + r.amount, 0);
    const totalReferralBonus = referralRewards.reduce((sum, r) => sum + r.amount, 0);
    const totalRewards = totalInvestmentROI + totalReferralBonus;

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
    throw new Error(`Failed to fetch reward history: ${error.message}`);
  }
};


