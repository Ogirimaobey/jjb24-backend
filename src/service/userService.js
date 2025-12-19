import pool from '../config/database.js';
import jwt from 'jsonwebtoken';
import crypto from "crypto";
import nodemailer from "nodemailer";
import { insertUser, findUserByPhone, 
  findUserByEmail, findUserById, 
  findUserByReferralCode, incrementReferralCount, updateUserEmail,
  updateUserVerification, updateUserBalance, findUserEmailByUserId,
  getReferredUsers, getTotalReferralCommission,
  createTransaction, // Receipt Printer
  getUplineChain, // MLM Logic
  setUserPin, getUserPin, getActiveInvestments // <--- NEW IMPORTS FOR PIN & DASHBOARD
 } from '../repositories/userRepository.js';
import { hashPassword, comparePasswords } from '../utils/harshpassword.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not defined in environment variables');

// Register a new user
export const registerUser = async (data) => {
  const { fullName, phone, email, password, referralCode } = data;

  const existingUserNumber = await findUserByPhone(phone);
  const existingUserEmail = email ? await findUserByEmail(email) : null;

  if (existingUserEmail) throw new Error('User with this email already exists.');
  if (existingUserNumber) throw new Error('User with this phone number already exists.');

  // FIX: Find the actual ID of the referrer to link them in the DB permanently
  let referrerId = null;
  if (referralCode) {
  const referrer = await findUserByReferralCode(referralCode);

  if (!referrer) throw new Error("Invalid referral code.");
    referrerId = referrer.id; // Store ID to create the permanent link
  await incrementReferralCount(referrer.id);
  }

  const passwordHash = await hashPassword(password);
  const ownReferralCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  try {
  await sendOtpEmail(email, otp);

    // Pass the referrerId so the repository can save it to the referrer_id column
   await insertUser({
    fullName,
    phone,
    email,
    password: passwordHash,
      referralCode, // String code typed by user
      referrerId,   // Numeric ID for database link
    ownReferralCode,
    otpCode: otp,
    otpExpiresAt:otpExpires,
  });

  return {
    message: "User registered successfully. Check your email for OTP.",
    email,
  };
} catch (err) {
  console.error("Error sending OTP:", err.message);
  throw new Error("Failed to send verification email. Please try again.");
}
};

// Helper function to send OTP email
const sendOtpEmail = async (to, otp) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"JJB24" <${process.env.MAIL_USER}>`,
    to,
    subject: "Verify Your Email - JJB24",
    html: `<p>Your verification code is <b>${otp}</b>. It expires in 10 minutes.</p>`,
  });
};

// Login user and return JWT token
export const loginUser = async (data) => {
  const { phone, email, password } = data;

  if ((!phone && !email) || !password) {
    throw new Error('Please provide either phone or email, and password.');
  }

  let user = null;
  if (phone) {
    user = await findUserByPhone(phone);
  } else if (email) {
    user = await findUserByEmail(email);
  }

  if (!user) {
    throw new Error('Invalid credentials. User not found.');
  }

  const isPasswordCorrect = await comparePasswords(password, user.password_hash);
  if (!isPasswordCorrect) {
    throw new Error('Invalid credentials. Wrong password.');
  }

  const token = jwt.sign(
    { id: user.id, phone: user.phone_number, email: user.email, is_admin: user.is_admin },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  return {
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      phone_number: user.phone_number,
      email: user.email,
      is_admin: user.is_admin,
    },
  };
};

// Get User Wallet Balance (FIXED & SELF-HEALING)
export const getUserBalance = async (userId) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Self-Heal: Generate code if missing
  if (!user.own_referral_code) {
    const newCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await pool.query("UPDATE users SET own_referral_code = $1 WHERE id = $2", [newCode, userId]);
    user.own_referral_code = newCode;
  }

  return {
    full_name: user.full_name,
    balance: user.balance || 0.0,
    phone_number: user.phone_number,
    own_referral_code: user.own_referral_code 
  };
};

// Verify User OTP (UPDATED: Hybrid Model ₦200 for User, ₦100 for Referrer + RECEIPTS)
export const verifyUserOtp = async (email, otp) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("User not found");

  if (user.is_verified) return "User already verified";
  if (!user.otp_code || user.otp_code !== otp) throw new Error("Invalid OTP");

  if (new Date() > user.otp_expires_at) throw new Error("OTP expired");

  // 1. Mark User as Verified
  await updateUserVerification(email, true);

  // 2. Pay the New User (Referee) - ₦200
  const welcomeBonus = 200.0;
  const newBalance = Number(user.balance) + welcomeBonus;
  await updateUserBalance(user.id, newBalance);
  
  // --- CREATE RECEIPT FOR NEW USER ---
  await createTransaction({
      userId: user.id,
      amount: welcomeBonus,
      type: 'welcome_bonus',
      description: 'Registration Bonus',
      status: 'success'
  });
  
  console.log(`[Bonus] User ${user.id} verified. Earned ₦${welcomeBonus}`);

  // 3. Pay the Referrer - ₦100 (If they exist)
  if (user.referrer_id) {
    try {
      const referrer = await findUserById(user.referrer_id);
      if (referrer) {
        const referralBonus = 100.0; // The Instant ₦100 Reward
        const referrerNewBalance = Number(referrer.balance) + referralBonus;
        
        // Update Referrer Balance
        await updateUserBalance(referrer.id, referrerNewBalance);

        // --- CREATE RECEIPT FOR REFERRER (Fixes the 0 Commission Display) ---
        await createTransaction({
            userId: referrer.id,
            amount: referralBonus,
            type: 'referral_bonus',
            description: `Referral Bonus for ${user.full_name}`,
            status: 'success'
        });
        
        console.log(`[Bonus] Referrer ${referrer.id} earned ₦${referralBonus} for inviting User ${user.id}`);
      }
    } catch (err) {
      console.error("[Bonus Error] Failed to pay referrer:", err.message);
      // We do not fail the verification just because the referrer bonus failed
    }
  }

  return {
    success: true,
    message: `OTP verified successfully! ₦${welcomeBonus} bonus added to your wallet.`,
    newBalance,
  };
};

// --- NEW FUNCTION: 5-3-2 MLM INVESTMENT COMMISSION ENGINE ---
// This function must be called inside the Investment Controller when a user invests.
export const distributeInvestmentCommissions = async (investorId, investmentAmount) => {
  console.log(`[MLM] Processing commissions for investment of ₦${investmentAmount} by User ${investorId}`);
  
  // 1. Get the upline chain (up to 3 levels)
  const uplines = await getUplineChain(investorId); // Returns [Level1, Level2, Level3]
  
  // 2. Define Percentages: Level 1 (5%), Level 2 (3%), Level 3 (2%)
  const percentages = [0.05, 0.03, 0.02];

  // 3. Loop through uplines and pay them
  for (let i = 0; i < uplines.length; i++) {
    const referrerId = uplines[i];
    const percentage = percentages[i];
    const commissionAmount = investmentAmount * percentage;

    if (commissionAmount > 0) {
      try {
        const referrer = await findUserById(referrerId);
        if (referrer) {
          // A. Add Money to Wallet
          const newBalance = Number(referrer.balance) + commissionAmount;
          await updateUserBalance(referrer.id, newBalance);

          // B. Print Receipt (Transaction Record)
          await createTransaction({
            userId: referrer.id,
            amount: commissionAmount,
            type: 'referral_bonus', // Keep type consistent so it shows on Team Page
            description: `Level ${i + 1} Commission (${percentage * 100}%) from investment by User ${investorId}`,
            status: 'success'
          });

          console.log(`[MLM] Paid Level ${i + 1} commission: ₦${commissionAmount} to User ${referrer.id}`);
        }
      } catch (err) {
        console.error(`[MLM Error] Failed to pay Level ${i + 1} upline:`, err.message);
      }
    }
  }
  
  return { success: true, message: "Commissions distributed" };
};

// --- NEW: CREATE OR UPDATE WITHDRAWAL PIN ---
export const setWithdrawalPin = async (userId, rawPin) => {
  if (!/^\d{4}$/.test(rawPin)) throw new Error("PIN must be exactly 4 digits");
  const hashedPin = await hashPassword(rawPin);
  await setUserPin(userId, hashedPin);
  return { success: true, message: "Transaction PIN set successfully." };
};

// --- NEW: VERIFY PIN DURING WITHDRAWAL ---
export const verifyWithdrawalPin = async (userId, rawPin) => {
  const storedHash = await getUserPin(userId);
  if (!storedHash) throw new Error("Please set a withdrawal PIN first.");
  
  const isMatch = await comparePasswords(rawPin, storedHash);
  if (!isMatch) throw new Error("Incorrect Transaction PIN.");
  return true;
};

// --- NEW: GET DASHBOARD DATA (Includes Active Investments & Days Left) ---
export const getUserDashboardData = async (userId) => {
  const balanceData = await getUserBalance(userId);
  
  // Get active investments to calculate expiration
  const activeInvestments = await getActiveInvestments(userId);
  
  const investmentsWithTimer = activeInvestments.map(inv => {
    const startDate = new Date(inv.created_at);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + inv.duration);
    
    const now = new Date();
    const timeDiff = endDate - now;
    const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    return {
      ...inv,
      days_left: daysLeft > 0 ? daysLeft : 0,
      status: daysLeft > 0 ? 'active' : 'expired'
    };
  });

  return {
    balance: balanceData.balance,
    full_name: balanceData.full_name,
    active_investments: investmentsWithTimer
  };
};

//Edit user email
export const editUserEmail = async (userId, newEmail) => {
  try {
    const user = await findUserEmailByUserId(userId);
    if (!user) throw new Error("User not found");

    if (user.email === newEmail) {
      throw new Error("New email is the same as the current email");
    }

    if(!newEmail.includes("@")){
      throw new Error("Invalid email! format email must contain '@' symbol");
    }
    await updateUserEmail(userId, newEmail);
    return { success: true, message: "Email updated successfully", newEmail: newEmail, oldEmail: user.email};
  } catch (err) {
    console.error("Error updating email:", err.message);
    throw err;
  }
};


export const getUserProfile = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");
  return {
    id: user.id,
    full_name: user.full_name,
    phone_number: user.phone_number,
    email: user.email,
    referral_code: user.own_referral_code
  };
};

// Get referral/team data for a user
export const getUserReferralData = async (userId) => {
  console.log(`[getUserReferralData] Fetching referral data for user ${userId}`);
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  console.log(`[getUserReferralData] User found: ${user.full_name}, Referral code: ${user.own_referral_code}`);

  const referralCode = user.own_referral_code;
  if (!referralCode) {
    console.log(`[getUserReferralData] No referral code found for user ${userId}`);
    return {
      total_commission: 0,
      team_count: 0,
      team_list: []
    };
  }

  // Get all referred users using ID link (Much faster and more reliable)
  const referredUsers = await getReferredUsers(user.id);
  console.log(`[getUserReferralData] Found ${referredUsers.length} referred users`);
   
  // Calculate total commission from transactions table (more accurate than calculating from investments)
  // This pulls actual commission transactions instead of calculating from investment totals
  const commissionQuery = `
    SELECT COALESCE(SUM(amount), 0) as total_commission
    FROM transactions
    WHERE user_id = $1 AND type = 'referral_bonus' AND status = 'success'
  `;
  const { rows: commissionRows } = await pool.query(commissionQuery, [userId]);
  const totalCommission = parseFloat(commissionRows[0]?.total_commission || 0);
  console.log(`[getUserReferralData] Total commission from transactions: ₦${totalCommission}`);

  // Format team list exactly as Sahil defined
  const teamList = referredUsers.map(u => ({
    name: u.full_name,
    phone: u.phone_number,
    email: u.email || 'N/A',
    joined_date: u.created_at,
    balance: parseFloat(u.balance || 0)
  }));

  console.log(`[getUserReferralData] Returning data: team_count=${referredUsers.length}, total_commission=₦${totalCommission}`);

  return {
    total_commission: Math.round(totalCommission * 100) / 100, // Round to 2 decimal places
    team_count: referredUsers.length,
    team_list: teamList
  };
};
