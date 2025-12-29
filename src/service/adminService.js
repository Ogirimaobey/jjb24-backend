import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs"; // FIXED: Changed from 'bcrypt' to 'bcryptjs'
import { insertAdmin, findAdminByEmail } from "../repositories/adminRepository.js";
import { getTotalUsersCount, getRecentUsers, getAllUsers } from "../repositories/userRepository.js";
import { getTotalInvestmentsCount, getTotalAmountInvested, getAllInvestmentsWithDetails } from "../repositories/investmentRepository.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined in environment variables");

const SALT_ROUNDS = 10;

/**Login Admin */
export const loginAdmin = async (email, password) => {
  const admin = await findAdminByEmail(email);
  if (!admin) throw new Error("Invalid email or password");

  // Compare using bcryptjs
  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) throw new Error("Invalid email or password");

  // FIXED: Added 'is_admin: true' so the middleware recognizes this user as an admin
  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: "admin", is_admin: true },
    JWT_SECRET,
    { expiresIn: "1d" }
  );

  return {
    message: "Login successful",
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      is_admin: true
    }
  };
};

/**Get Admin Dashboard Stats */
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

/**Get All Users (for admin) */
export const getAllUsersForAdmin = async () => {
  try {
    const users = await getAllUsers();
    return users;
  } catch (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }
};

/**Get All Investments (for admin) */
export const getAllInvestmentsForAdmin = async () => {
  try {
    const investments = await getAllInvestmentsWithDetails();
    return investments;
  } catch (error) {
    throw new Error(`Failed to fetch investments: ${error.message}`);
  }
};
