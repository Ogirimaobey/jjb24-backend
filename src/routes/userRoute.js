import express from 'express';
import { registerUser, loginUser } from '../service/userService.js';

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

export default router;
