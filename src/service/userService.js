import pool from '../config/database.js';
import jwt from 'jsonwebtoken';
import crypto from "crypto";
import nodemailer from "nodemailer";
import { insertUser, findUserByPhone, 
  findUserByEmail, findUserById, 
  findUserByReferralCode, incrementReferralCount,
  updateUserVerification, updateUserBalance
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

  if (referralCode) {
  const referrer = await findUserByReferralCode(referralCode);

  if (!referrer) throw new Error("Invalid referral code.");
  await incrementReferralCount(referrer.id);
  }

  const passwordHash = await hashPassword(password);
  const ownReferralCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  try {
  await sendOtpEmail(email, otp);

   await insertUser({
    fullName,
    phone,
    email,
    password: passwordHash,
    referralCode,
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
    // service: "gmail",
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
    { expiresIn: '7d' }
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

//Get User Wallet Balance
export const getUserBalance = async (userId) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  return {
    full_name: user.full_name,
    balance: user.balance || 0.0,
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


export const getUserProfile = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");
  // console.log("User profile fetched:", user);
  return {
    id: user.id,
    full_name: user.full_name,
    phone_number: user.phone_number,
    email: user.email,
    referral_code: user.own_referral_code
  };
};