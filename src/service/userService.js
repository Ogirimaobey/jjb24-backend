import jwt from 'jsonwebtoken';
import crypto from "crypto";
import nodemailer from "nodemailer";
import { insertUser, findUserByPhone, findUserByEmail, findUserById, findUserByReferralCode, incrementReferralCount } from '../repositories/userRepository.js';
import { hashPassword, comparePasswords } from '../utils/harshpassword.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not defined in environment variables');
// console.log('JWT_SECRET loaded:', JWT_SECRET);


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

//   // Generate OTP
//   const otp = crypto.randomInt(100000, 999999).toString();
//   const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

//   const newUser = await insertUser({
//     fullName,
//     phone,
//     email,
//     password: passwordHash,
//     referralCode,
//     ownReferralCode,
//     otp_code: otp,
//     otp_expires_at: otpExpires,
//   });

//   await sendOtpEmail(email, otp);

//   return {
//     message: "User registered successfully. Check your email for OTP.",
//     email,
//   };
// };

// const sendOtpEmail = async (to, otp) => {
//   const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: process.env.MAIL_USER,
//       pass: process.env.MAIL_PASS,
//     },
//   });

//   await transporter.sendMail({
//     from: `"JJB24" <${process.env.MAIL_USER}>`,
//     to,
//     subject: "Verify Your Email - JJB24",
//     html: `<p>Your verification code is <b>${otp}</b>. It expires in 10 minutes.</p>`,
//   });
// };



  const newUser = await insertUser({
    fullName,
    phone,
    email,
    password: passwordHash,
    referralCode,
    ownReferralCode,
  });

  return {
    id: newUser.id,
    full_name: newUser.full_name,
    phone_number: newUser.phone_number,
    email: newUser.email,
    own_referral_code: newUser.own_referral_code,
  };
};


// Helper function to send OTP email
const sendOtpEmail = async (to, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
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

//Get User Wallet Balance
export const getUserBalance = async (userId) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  return {
    id: user.id,
    full_name: user.full_name,
    balance: user.balance || 0.0,
  };
};

