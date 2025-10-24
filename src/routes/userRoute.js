import express from 'express';
import { registerUser, loginUser, getUserBalance, verifyUserOtp } from '../service/userService.js';
import { verifyToken } from "../middleware/authMiddleware.js";
import { getAllItems, getItemById } from '../service/itemService.js';


const router = express.Router();

// User registration
router.post('/register', async (req, res) => {
  const { fullName, phone, email, password, referralCode } = req.body;  
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
    const result = await loginUser(req.body);
    res.json({ success: true, ...result });
  } 
  catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
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


// Verify User OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const result = await verifyUserOtp(email, otp);
    res.status(200).json({ success: true, message: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
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

export default router;