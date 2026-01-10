import bcrypt from 'bcryptjs'; 
import jwt from 'jsonwebtoken';
import crypto from "crypto";
import nodemailer from "nodemailer";
import pool from '../config/database.js';
import { 
 findUserByEmail, 
 findUserByPhone, 
 updateUserBalance, 
 findUserById, 
 findUserByReferralCode, 
 updateUserVerification, 
 setUserPin, 
 getUserPin
} from '../repositories/userRepository.js';
import { 
 createTransaction, 
 createReferralBonusTransaction 
} from '../repositories/transactionRepository.js';
import { getAllInvestmentsByUserId } from '../repositories/investmentRepository.js';

const JWT_SECRET = process.env.JWT_SECRET;

// --- HELPER: Generate Unique Referral Code ---
const generateReferralCode = () => {
 return `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
};

// --- HELPER: Send OTP Email ---
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

// --- FORGOT PASSWORD SERVICE ---
export const forgotPassword = async (email) => {
    const user = await findUserByEmail(email.toLowerCase().trim());
    if (!user) throw new Error("User with this email not found");

    const tempPassword = Math.random().toString(36).slice(-8); 
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);

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
        from: `"JJB24 Security" <${process.env.MAIL_USER}>`,
        to: email,
        subject: "Temporary Password - JJB24",
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #6a0dad;">Password Reset Request</h2>
                <p>We received a request to reset your password for JJB24.</p>
                <p>Your temporary login password is: <b style="font-size: 18px; color: #111;">${tempPassword}</b></p>
                <p style="background: #fff4e5; padding: 10px; border-radius: 5px; color: #663c00;">
                    <b>Important:</b> Please login immediately and change this password from your profile settings.
                </p>
                <p>If you did not request this, please secure your account immediately.</p>
            </div>
        `,
    });

    return { success: true, message: "Temporary password sent to email." };
};

// --- REGISTER USER ---
export const registerUser = async (data) => {
 const client = await pool.connect();
 try {
  await client.query('BEGIN');

  const { fullName, phone, email, password, referralCode } = data;

  const cleanEmail = email.toLowerCase().trim();
  const existingEmail = await findUserByEmail(cleanEmail);
  if (existingEmail) throw new Error('Email already registered');
  
  const existingPhone = await findUserByPhone(phone.trim());
  if (existingPhone) throw new Error('Phone number already registered');

  let referrerId = null;
  if (referralCode && referralCode.trim() !== "") {
    const referrer = await findUserByReferralCode(referralCode.trim());
    if (referrer) {
      referrerId = referrer.id;
      await client.query('UPDATE users SET referral_count = COALESCE(referral_count, 0) + 1 WHERE id = $1', [referrerId]);
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const ownCode = generateReferralCode();
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  try {
    await sendOtpEmail(cleanEmail, otp);
  } catch (emailErr) {
    console.error("Failed to send email, but proceeding with registration:", emailErr);
  }

  const queryText = `
    INSERT INTO users (full_name, email, phone_number, password_hash, balance, referrer_id, own_referral_code, referral_count, otp_code, otp_expires_at, is_verified)
    VALUES ($1, $2, $3, $4, 0, $5, $6, 0, $7, $8, FALSE)
    RETURNING *;
  `;
  const { rows } = await client.query(queryText, [fullName, cleanEmail, phone.trim(), passwordHash, referrerId, ownCode, otp, otpExpires]);
  const newUser = rows[0];

  await client.query('COMMIT');
  
  return {
    message: "User registered successfully. Check your email for OTP.",
    email: cleanEmail,
    userId: newUser.id
  };

 } catch (error) {
  await client.query('ROLLBACK');
  throw error;
 } finally {
  client.release();
 }
};

// --- VERIFY OTP ---
export const verifyUserOtp = async (email, otp) => {
 const user = await findUserByEmail(email.toLowerCase().trim());
 if (!user) throw new Error("User not found");

 if (user.is_verified) return { success: true, message: "User already verified" };
 if (!user.otp_code || user.otp_code !== otp) throw new Error("Invalid OTP");
 if (new Date() > new Date(user.otp_expires_at)) throw new Error("OTP expired");

 await updateUserVerification(user.email, true);

 const welcomeBonus = 200.0;
 const newBalance = Number(user.balance) + welcomeBonus;
 await updateUserBalance(user.id, newBalance);
 
 await createTransaction({
      userId: user.id, 
      amount: welcomeBonus, 
      type: 'welcome_bonus',
      status: 'success',
      description: 'Welcome Bonus'
 });

 return {
  success: true,
  message: `OTP verified! ₦${welcomeBonus} welcome bonus added.`,
  newBalance,
 };
};

// --- UPDATED LOGIN USER (IDENTIFIER HANDSHAKE FIXED) ---
export const loginUser = async ({ email, phone, password }) => {
 let user;
 
 // 1. Find User by Email or Phone with normalization
 if (email && email.trim() !== "") {
     user = await findUserByEmail(email.toLowerCase().trim());
 } 
 
 if (!user && phone && phone.trim() !== "") {
     user = await findUserByPhone(phone.trim());
 }

 // 2. Validate user existence
 if (!user) {
     console.error(`[Login] User not found for: ${email || phone}`);
     throw new Error('Invalid credentials');
 }

 // 3. Block check
 if (user.is_blocked || user.account_status === 'suspended' || user.account_status === 'blocked') {
     throw new Error(`Account ${user.account_status || 'blocked'}: ${user.block_reason || 'Contact Support'}`);
 }

 // 4. Password Check
 const isMatch = await bcrypt.compare(password, user.password_hash);
 if (!isMatch) {
     console.error(`[Login] Password mismatch for: ${user.email}`);
     throw new Error('Invalid credentials');
 }

 // 5. Token Generation (Includes is_admin flag for frontend safety)
 const userRole = user.is_admin ? 'admin' : (user.role || 'user');
 const token = jwt.sign(
     { id: user.id, email: user.email, role: userRole, is_admin: user.is_admin }, 
     process.env.JWT_SECRET, 
     { expiresIn: '7d' }
 );
 
 return { 
     success: true,
     token, 
     user: { 
         id: user.id, 
         name: user.full_name, 
         email: user.email, 
         role: userRole, 
         is_admin: user.is_admin 
     } 
 };
};

// --- GET BALANCE ---
export const getUserBalance = async (userId) => {
 const user = await findUserById(userId);
 if (!user) throw new Error('User not found');
 
 if (!user.own_referral_code) {
  const newCode = generateReferralCode();
  await pool.query("UPDATE users SET own_referral_code = $1 WHERE id = $2", [newCode, userId]);
  user.own_referral_code = newCode;
 }

 return { 
  balance: Number(user.balance), 
  full_name: user.full_name,
  own_referral_code: user.own_referral_code,
  phone_number: user.phone_number,
  has_pin: user.withdrawal_pin ? true : false
 };
};

// --- SET WITHDRAWAL PIN ---
export const setWithdrawalPin = async (userId, rawPin) => {
 if (!/^\d{4}$/.test(rawPin)) throw new Error("PIN must be exactly 4 digits");
 const hashedPin = await bcrypt.hash(rawPin, 10);
 await setUserPin(userId, hashedPin);
 return { success: true, message: "Security PIN set successfully" };
};

// --- RESET WITHDRAWAL PIN ---
export const resetWithdrawalPin = async (userId, newPin) => {
  if (!/^\d{4}$/.test(newPin)) throw new Error("New PIN must be exactly 4 digits");
  const hashedPin = await bcrypt.hash(newPin, 10);
  await pool.query('UPDATE users SET withdrawal_pin = $1 WHERE id = $2', [hashedPin, userId]);
  return { success: true, message: "Withdrawal PIN has been reset successfully" };
};

// --- CHANGE LOGIN PASSWORD ---
export const changeUserPassword = async (userId, oldPassword, newPassword) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
  if (!isMatch) throw new Error("Current password is incorrect");

  const newHash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

  return { success: true, message: "Login password updated successfully" };
};

// --- VERIFY WITHDRAWAL PIN ---
export const verifyWithdrawalPin = async (userId, rawPin) => {
 const storedHash = await getUserPin(userId);
 if (!storedHash) throw new Error("Please set a withdrawal PIN first.");
 
 const isMatch = await bcrypt.compare(rawPin, storedHash);
 if (!isMatch) throw new Error("Incorrect Transaction PIN");
 return true;
};

// --- MLM COMMISSION LOGIC ---
export const distributeInvestmentCommissions = async (investorId, amount) => {
 const client = await pool.connect();
 try {
  const userRes = await client.query('SELECT referrer_id FROM users WHERE id = $1', [investorId]);
  const parentId = userRes.rows[0]?.referrer_id;

  if (parentId) {
    const comm1 = amount * 0.05;
    await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [comm1, parentId]);
    await createReferralBonusTransaction(parentId, comm1, investorId, null, client);

    const parentRes = await client.query('SELECT referrer_id FROM users WHERE id = $1', [parentId]);
    const grandParentId = parentRes.rows[0]?.referrer_id;

    if (grandParentId) {
      const comm2 = amount * 0.03;
      await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [comm2, grandParentId]);
      const ref2 = `REF-L2-${grandParentId}-${Date.now()}`;
      await client.query(
        `INSERT INTO transactions (user_id, amount, type, reference, status, description) VALUES ($1, $2, 'referral_bonus', $3, 'success', 'Level 2 Commission')`,
        [grandParentId, comm2, ref2]
      );

      const grandParentRes = await client.query('SELECT referrer_id FROM users WHERE id = $1', [grandParentId]);
      const greatGrandParentId = grandParentRes.rows[0]?.referrer_id;

      if (greatGrandParentId) {
        const comm3 = amount * 0.02;
        await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [comm3, greatGrandParentId]);
        const ref3 = `REF-L3-${greatGrandParentId}-${Date.now()}`;
        await client.query(
          `INSERT INTO transactions (user_id, amount, type, reference, status, description) VALUES ($1, $2, 'referral_bonus', $3, 'success', 'Level 3 Commission')`,
          [greatGrandParentId, comm3, ref3]
        );
      }
    }
  }
 } catch (e) {
  console.error('[MLM Error]', e);
 } finally {
  client.release();
 }
};

// --- GET TEAM DATA ---
export const getUserReferralData = async (userId) => {
 const client = await pool.connect();
 try {
  const user = await findUserById(userId);
  if(!user) throw new Error("User not found");

  const commQuery = `
    SELECT SUM(amount) as total 
    FROM transactions 
    WHERE user_id = $1 AND type = 'referral_bonus' AND status = 'success'
  `;
  const commRes = await client.query(commQuery, [userId]);
  const totalCommission = parseFloat(commRes.rows[0].total || 0);

  const teamQuery = `
    SELECT id, full_name as name, created_at as joined_date, balance
    FROM users 
    WHERE referrer_id = $1 
    ORDER BY created_at DESC
  `;
  const teamRes = await client.query(teamQuery, [userId]);

  return {
    total_commission: totalCommission,
    team_count: teamRes.rows.length,
    team_list: teamRes.rows
  };
 } finally {
  client.release();
 }
};

// --- GET DASHBOARD DATA ---
export const getUserDashboardData = async (userId) => {
 const investments = await getAllInvestmentsByUserId(userId);
 const activeInvestments = investments.map(inv => {
  const created = new Date(inv.created_at);
  const now = new Date();
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  const duration = inv.duration || 30;
  const daysLeft = Math.max(0, duration - diffDays);
  
  let status = inv.status || 'active';
  if (daysLeft === 0 && status === 'active') status = 'completed';

  return {
    id: inv.id,
    itemname: inv.itemName,
    daily_earning: inv.daily_earning,
    total_earning: inv.total_earning,
    price: inv.price,
    days_left: daysLeft,
    status: status
  };
 }).filter(i => i.status === 'active');

 return { active_investments: activeInvestments };
};

// --- Edit Email ---
export const editUserEmail = async (userId, newEmail) => {
 if (!newEmail.includes("@")) throw new Error("Invalid email");
 await pool.query('UPDATE users SET email = $1 WHERE id = $2', [newEmail.toLowerCase().trim(), userId]);
 return { success: true };
};

// --- Get Profile ---
export const getUserProfile = async (userId) => {
 const user = await findUserById(userId);
 return user;
};

// --- ADMIN FUNDING FUNCTION ---
export const adminFundUser = async (email, amount) => {
   const user = await findUserByEmail(email.toLowerCase().trim());
   if (!user) throw new Error("User email not found");

   const newBalance = Number(user.balance) + Number(amount);
   await updateUserBalance(user.id, newBalance);

   await createTransaction({
       userId: user.id,
       amount: amount,
       type: 'admin_credit',
       status: 'success',
       description: 'Funded by Admin'
   });

   return { success: true, newBalance };
};

// --- GET ALL USERS ---
export const getAllUsers = async () => {
   const userQuery = `SELECT * FROM users ORDER BY created_at DESC`;
   const { rows: users } = await pool.query(userQuery);

   const depositQuery = `
       SELECT user_id, SUM(amount) as total, MAX(receipt_url) as latest_receipt
       FROM transactions 
       WHERE type = 'deposit' AND status = 'success' 
       GROUP BY user_id
   `;
   const { rows: deposits } = await pool.query(depositQuery);

   const depositMap = {};
   deposits.forEach(d => { 
       depositMap[d.user_id] = { 
           total: Number(d.total), 
           receipt: d.latest_receipt 
       }; 
   });

   const usersWithDeposits = users.map(user => ({
       ...user,
       total_deposited: depositMap[user.id]?.total || 0,
       receipt_url: depositMap[user.id]?.receipt || null
   }));

   return usersWithDeposits;
};

// --- BLOCK / SUSPEND USER ---
export const updateUserStatus = async (userId, status, reason) => {
   let isBlocked = false;
   if (status === 'suspended' || status === 'blocked') {
       isBlocked = true;
   }

   const query = `
       UPDATE users 
       SET account_status = $2, is_blocked = $3, block_reason = $4
       WHERE id = $1
       RETURNING id, full_name, account_status, is_blocked;
   `;
   
   const { rows } = await pool.query(query, [userId, status, isBlocked, reason]);
   if (rows.length === 0) throw new Error("User not found");
   
   return { success: true, user: rows[0] };
};

// --- ADMIN EDIT USER ---
export const adminUpdateUser = async (userId, updateData) => {
   const { full_name, email, phone_number, balance } = updateData;
   
   const query = `
       UPDATE users 
       SET 
           full_name = COALESCE($2, full_name),
           email = COALESCE($3, email),
           phone_number = COALESCE($4, phone_number),
           balance = COALESCE($5, balance)
       WHERE id = $1
       RETURNING id, full_name, email, phone_number, balance;
   `;
   
   const { rows } = await pool.query(query, [userId, full_name, email ? email.toLowerCase().trim() : null, phone_number, balance]);
   if (rows.length === 0) throw new Error("User not found");
   
   return { success: true, user: rows[0] };
};
