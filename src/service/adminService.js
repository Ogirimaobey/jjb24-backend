import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs"; // FIXED: Changed from 'bcrypt' to 'bcryptjs'
import { insertAdmin, findAdminByEmail } from "../repositories/adminRepository.js";
import { getTotalUsersCount, getRecentUsers, getAllUsers, updateUserBalance, findUserById } from "../repositories/userRepository.js";
import { getTotalInvestmentsCount, getTotalAmountInvested, getAllInvestmentsWithDetails } from "../repositories/investmentRepository.js";
import { createAdminCreditTransaction } from "../repositories/transactionRepository.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined in environment variables");

const SALT_ROUNDS = 10;

/** Login Admin */
export const loginAdmin = async (email, password) => {
  // Normalize email input to lowercase
  const cleanEmail = email.toLowerCase().trim();
  
  console.log(`[Admin Login] Attempting login for: ${cleanEmail}`);

  const admin = await findAdminByEmail(cleanEmail);
  
  if (!admin) {
    console.error(`[Admin Login] No admin record found for email: ${cleanEmail}`);
    throw new Error("Invalid email or password");
  }

  // Compare using bcryptjs
  const isMatch = await bcrypt.compare(password, admin.password);
  
  if (!isMatch) {
    console.error(`[Admin Login] Password mismatch for admin: ${cleanEmail}`);
    throw new Error("Invalid email or password");
  }

  // Check if this admin record is actually authorized
  const isAdminFlag = admin.is_admin !== undefined ? admin.is_admin : true;

  // FIXED: Added 'is_admin: true' so the middleware recognizes this user as an admin
  const token = jwt.sign(
    { 
        id: admin.id, 
        email: admin.email, 
        role: "admin", 
        is_admin: isAdminFlag 
    },
    JWT_SECRET,
    { expiresIn: "1d" }
  );

  console.log(`[Admin Login] Success! Token generated for ID: ${admin.id}`);

  return {
    message: "Login successful",
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      is_admin: isAdminFlag
    }
  };
};

/** * Manual Credit User (Peter's Fix)
 * This function allows admins to add money to a user's wallet manually.
 */
export const manualCreditUser = async (userId, amount) => {
  try {
    // 1. Verify user exists
    const user = await findUserById(userId);
    if (!user) throw new Error("Target user not found");

    // 2. Normalize and Calculate new balance
    const creditAmount = Number(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      throw new Error("Invalid credit amount. Must be a positive number.");
    }

    const currentBalance = Number(user.balance || 0);
    const newBalance = currentBalance + creditAmount;

    // 3. Update Balance in Repository
    await updateUserBalance(userId, newBalance);

    // 4. Create Transaction Record for Ledger Clarity
    await createAdminCreditTransaction(userId, creditAmount);

    console.log(`[Admin Action] User ${userId} credited with ${creditAmount}. New balance: ${newBalance}`);

    return { 
      message: `Successfully credited ${user.full_name} with ${creditAmount}`,
      newBalance 
    };
  } catch (error) {
    console.error(`[Admin Action Error] ${error.message}`);
    throw new Error(`Failed to credit user: ${error.message}`);
  }
};

/** Get Admin Dashboard Stats */
export const getAdminStats = async () => {
  try {
    const [totalUsers, totalInvestments, totalAmountInvested, recentUsers] = await Promise.all([
      getTotalUsersCount(),
      getTotalInvestmentsCount(),
      getTotalAmountInvested(),
      getRecentUsers(10)
    ]);

    return {
      totalUsers,
      totalInvestments,
      totalAmountInvested,
      recentUsers
    };
  } catch (error) {
    throw new Error(`Failed to fetch admin stats: ${error.message}`);
  }
};

/** Get All Users (for admin) */
export const getAllUsersForAdmin = async () => {
  try {
    const users = await getAllUsers();
    return users;
  } catch (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }
};

/** Get All Investments (for admin) */
export const getAllInvestmentsForAdmin = async () => {
  try {
    const investments = await getAllInvestmentsWithDetails();
    return investments;
  } catch (error) {
    throw new Error(`Failed to fetch investments: ${error.message}`);
  }
};
