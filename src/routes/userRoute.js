import express from 'express';
import { registerUser, loginUser, getUserBalance, verifyUserOtp } from '../service/userService.js';
import { verifyToken } from "../middleware/authMiddleware.js";


const router = express.Router();

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

router.post('/login', async (req, res) => {
  try {
    const result = await loginUser(req.body);
    res.json({ success: true, ...result });
  } 
  catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
});

router.get("/balance", verifyToken, async (req, res) => {
  try {
    const data = await getUserBalance(req.user.id);
    res.status(200).json({ success: true, balance: data.balance });
  } 
  catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const result = await verifyUserOtp(email, otp);
    res.status(200).json({ success: true, message: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;