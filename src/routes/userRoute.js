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
  // --- NEW IMPORTS FOR ADMIN PANEL ---
  getAllUsers,      // To list all users
  updateUserStatus, // To Block/Suspend
  adminUpdateUser   // To Edit User details
} from '../service/userService.js';
import { verifyToken } from "../middleware/authMiddleware.js";
import { getAllItems, getItemById } from '../service/itemService.js';
import { getUserEarningsSummary, getRewardHistory } from '../service/investmentService.js';


const router = express.Router();

// User registration
router.post('/register', async (req, res) => {
  try {
    const user = await registerUser(req.body);
    res.status(201).json({ success: true, user });
  } 
  catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { token, user } = await loginUser(req.body);
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'None',
      maxAge: 1000 * 60 * 60 * 24 * 7, 
    });
    res.json({ success: true, token, user });
  } 
  catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
});

// User logout
router.post('/logout', (req, res) => {
  res.clearCookie('authToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });
  res.status(200).json({ success: true });
});


// Get User Wallet Balance
router.get("/balance", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id; 
    const balance = await getUserBalance(userId);
    res.status(200).json({success: true, balance});
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// --- NEW: SET WITHDRAWAL PIN ---
router.post('/set-pin', verifyToken, async (req, res) => {
  try {
    const { pin } = req.body;
    // req.user.id comes from the verifyToken middleware
    const result = await setWithdrawalPin(req.user.id, pin);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// --- NEW: GET DASHBOARD DATA (Balance + Active Investments with Days Left) ---
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const dashboardData = await getUserDashboardData(userId);
    res.status(200).json({ success: true, ...dashboardData });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});


// Verify User OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const result = await verifyUserOtp(email, otp);
    res.status(200).json(result); 
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


// Get all items (users can view)
router.get('/allItems', verifyToken, async (req, res) => {
  try {
    const result = await getAllItems();
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// Get single item by ID
router.get('/item/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getItemById(id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

//Cookies -Authentication
router.get('/check-auth', verifyToken, (req, res) => {
    res.json({ 
        success: true, 
        user: { username: req.user.userId }  
    });
});

//Get User Profile
router.get('/user_profile', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await getUserProfile(userId);
    res.status(200).json({ success: true, profile });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});


// Get user earnings summary (today, yesterday, total)
router.get('/earnings-summary', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const earnings = await getUserEarningsSummary(userId);
    res.status(200).json({ success: true, ...earnings });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
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
    console.log("error message", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get user referral/team data
router.get('/referrals', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`[GET /api/users/referrals] User ID: ${userId}`);
    const referralData = await getUserReferralData(userId);
    res.status(200).json({ success: true, ...referralData });
  } catch (error) {
    console.error('[GET /api/users/referrals] Error fetching referral data:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Alternative endpoint name for team
router.get('/team', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const referralData = await getUserReferralData(userId);
    res.status(200).json({ success: true, ...referralData });
  } catch (error) {
    console.error('Error fetching team data:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get unified reward history (investment ROI + referral bonuses)
router.get('/reward-history', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`[GET /api/users/reward-history] User ID: ${userId}`);
    const rewardHistory = await getRewardHistory(userId);
    res.status(200).json({ success: true, ...rewardHistory });
  } catch (error) {
    console.error('[GET /api/users/reward-history] Error fetching reward history:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// --- NEW: ADMIN FUND WALLET (Owner Feature) ---
router.post('/admin/fund', async (req, res) => {
  try {
    const { email, amount } = req.body;
    
    // Simple validation
    if (!email || !amount) {
      return res.status(400).json({ success: false, message: "Email and Amount are required" });
    }

    const result = await adminFundUser(email, amount);
    res.status(200).json(result);
    
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// --- NEW: ADMIN MANAGE USERS ---

// 1. Get All Users (Table View)
router.get('/admin/users', async (req, res) => {
  try {
    // This function will be in userService.js
    const users = await getAllUsers();
    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Suspend/Block User (Status Change)
router.patch('/admin/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body; // status: 'active', 'suspended', 'blocked'
    
    // This function will be in userService.js
    const result = await updateUserStatus(id, status, reason);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 3. Edit User (Admin updates name/email/phone)
router.put('/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body; // { full_name, email, phone_number }
    
    // This function will be in userService.js
    const result = await adminUpdateUser(id, updateData);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
