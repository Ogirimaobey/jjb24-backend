import express from 'express';
import { registerUser, loginUser, getUserBalance, verifyUserOtp, getUserProfile} from '../service/userService.js';
import { verifyToken } from "../middleware/authMiddleware.js";
import { getAllItems, getItemById } from '../service/itemService.js';


const router = express.Router();

// User registration
router.post('/register', async (req, res) => {
  // const { fullName, phone, email, password, referralCode } = req.body;  
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
    // console.log("Token received in router:", token);
    res.cookie('authToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'None',
    maxAge: 1000*60*30, 
});
res.json({ success: true, user });
  } 
  catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
});

// User logout
router.post('/logout', (req, res) => {
  res.clearCookie('authToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });
  res.status.apply(200).json({ success: true });
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
    res.status(200).json(result.message, result.newBalance);
  } catch (err) {
    res.status(400).json( err.message );
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
    // If middleware passes, user is auth'd—send minimal data
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
    // console.log("User profile sent:", profile);
    res.status(200).json({ success: true, profile });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;