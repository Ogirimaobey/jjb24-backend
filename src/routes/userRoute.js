import express from 'express';
import jwt from 'jsonwebtoken';
import {
  registerUser,
  loginUser,
  getUserBalance,
  editUserEmail,
  verifyUserOtp,
  getUserProfile,
  getUserReferralData,
  setWithdrawalPin,
  getUserDashboardData,
  adminFundUser,
  changeUserPassword,
  resetWithdrawalPin,
  getAllUsers,
  updateUserStatus,
  adminUpdateUser,
  forgotPassword 
} from '../service/userService.js';
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { getAllItems, getItemById } from '../service/itemService.js';
import { getUserEarningsSummary, getRewardHistory } from '../service/investmentService.js';

const router = express.Router();

// ==========================================
// --- AUTHENTICATION & REGISTRATION ---
// ==========================================

// User registration
router.post('/register', async (req, res) => {
  try {
    const user = await registerUser(req.body);
    res.status(201).json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// User login (Standard User & Peter Admin)
router.post('/login', async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    const { token, user } = await loginUser({ email, phone, password });

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'None',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
    res.json({ success: true, token, user });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
});

// Forgot Password Request
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await forgotPassword(email);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// User logout
router.post('/logout', (req, res) => {
  res.clearCookie('authToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });
  res.status(200).json({ success: true });
});

// ==========================================
// --- USER ACCOUNT & WALLET ---
// ==========================================

// Get User Wallet Balance
router.get("/balance", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const balance = await getUserBalance(userId);
    res.status(200).json({ success: true, balance });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get User Profile details
router.get('/user_profile', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await getUserProfile(userId);
    res.status(200).json({ success: true, profile });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Edit User Email
router.put('/edit-email', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { newEmail } = req.body;
    const result = await editUserEmail(userId, newEmail);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// --- SECURITY & PIN MANAGEMENT ---
// ==========================================

// Create a new 4-digit security PIN
router.post('/set-pin', verifyToken, async (req, res) => {
  try {
    const { pin } = req.body;
    const result = await setWithdrawalPin(req.user.id, pin);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update an existing security PIN
router.post('/reset-pin', verifyToken, async (req, res) => {
  try {
    const { newPin } = req.body;
    const result = await resetWithdrawalPin(req.user.id, newPin);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update account login password
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const result = await changeUserPassword(req.user.id, oldPassword, newPassword);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// --- INVESTMENTS & DASHBOARD ---
// ==========================================

// Get Dashboard Data (Universal Mirror: IDs, Price, Days Left)
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const dashboardData = await getUserDashboardData(userId);
    res.status(200).json({ success: true, ...dashboardData });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Verify registration OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const result = await verifyUserOtp(email, otp);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// View all available shop plans
router.get('/allItems', verifyToken, async (req, res) => {
  try {
    const result = await getAllItems();
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// View single shop plan details
router.get('/item/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getItemById(id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

// Basic Auth Check
router.get('/check-auth', verifyToken, (req, res) => {
  res.json({
    success: true,
    user: { id: req.user.id }
  });
});

// ==========================================
// --- TEAM & EARNINGS ---
// ==========================================

// Get calculation of total yields and earnings
router.get('/earnings-summary', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const earnings = await getUserEarningsSummary(userId);
    res.status(200).json({ success: true, ...earnings });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// View 3-level team members
router.get('/referrals', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const referralData = await getUserReferralData(userId);
    res.status(200).json({ success: true, ...referralData });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Alternative endpoint for team viewing
router.get('/team', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const referralData = await getUserReferralData(userId);
    res.status(200).json({ success: true, ...referralData });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Unified list of all bonuses and yields
router.get('/reward-history', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const rewardHistory = await getRewardHistory(userId);
    res.status(200).json({ success: true, ...rewardHistory });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// --- ADMIN MANAGEMENT ROUTES ---
// ==========================================

// Admin: Manually fund a specific user's wallet
router.post('/admin/fund', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { email, amount } = req.body;
    if (!email || !amount) {
      return res.status(400).json({ success: false, message: "Email and Amount are required" });
    }
    const result = await adminFundUser(email, amount);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Admin: View all registered users in the platform
router.get('/admin/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Suspend or Block a specific user account
router.patch('/admin/users/:id/status', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const result = await updateUserStatus(id, status, reason);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Admin: Update sensitive user data fields
router.put('/admin/users/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const result = await adminUpdateUser(id, updateData);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
