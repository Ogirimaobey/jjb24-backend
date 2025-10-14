import jwt from 'jsonwebtoken';
import { insertUser, findUserByPhone, findUserByEmail, findUserById } from '../repositories/userRepository.js';
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

  const passwordHash = await hashPassword(password);
  const ownReferralCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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
