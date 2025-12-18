import pool from '../config/database.js';
import jwt from 'jsonwebtoken';
import crypto from "crypto";
import nodemailer from "nodemailer";
import { insertUser, findUserByPhone, 
  findUserByEmail, findUserById, 
  findUserByReferralCode, incrementReferralCount, updateUserEmail,
  updateUserVerification, updateUserBalance, findUserEmailByUserId,
  getReferredUsers, getTotalReferralCommission
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

  // --- THE FIX STARTS HERE ---
  // If the user exists but has NO referral code (NULL in database),
  // we generate one right now and save it.
  if (!user.own_referral_code) {
    const newCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    // Update the database directly to save the new code permanently
    await pool.query("UPDATE users SET own_referral_code = $1 WHERE id = $2", [newCode, userId]);
    
    // Update the local variable so we send it back to the frontend immediately
    user.own_referral_code = newCode;
  }
  // --- THE FIX ENDS HERE ---

  return {
    full_name: user.full_name,
    balance: user.balance || 0.0,
    phone_number: user.phone_number,      // Added so profile can show phone
    own_referral_code: user.own_referral_code // <--- THIS WAS MISSING
  };
};

// Verify User OTP
export const verifyUserOtp = async (email, otp) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("User not found");

  if (user.is_verified) return "User already verified";
  if (!user.otp_code || user.otp_code !== otp) throw new Error("Invalid OTP");

  if (new Date() > user.otp_expires_at) throw new Error("OTP expired");

  await updateUserVerification(email, true);
 
  const referralBonus = 200.0;
  const newBalance = Number(user.balance) + referralBonus;
  await updateUserBalance(user.id, newBalance);

  return {
    success: true,
    message: `OTP verified successfully! ₦${referralBonus} bonus added to your wallet.`,
    newBalance,
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
