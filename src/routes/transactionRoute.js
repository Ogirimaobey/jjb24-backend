import express from 'express';
import axios from 'axios'; 
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { 
    initializePayment, 
    verifyPayment, 
    verifyTransactionManual, 
    requestWithdrawal, 
    approveWithdrawal, 
    getUserTransactions, 
    getUserWithdrawalTransactions, 
    getUserDepositTransactions,
    createManualDeposit // <--- NEW SERVICE FUNCTION
} from '../service/transactionService.js';
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { getUserBalance, verifyWithdrawalPin } from '../service/userService.js';

const router = express.Router();

// ==========================================
// 1. CONFIGURE IMAGE UPLOAD (Receipts)
// ==========================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'receipts',
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'],
  },
});

const upload = multer({ storage: storage });

// ==========================================
// 2. NEW ROUTE: MANUAL DEPOSIT (Plan B)
// ==========================================
// User uploads a screenshot -> We save it -> You confirm it later
router.post('/deposit/manual', verifyToken, upload.single('receipt'), async (req, res) => {
    try {
        console.log('[Manual Deposit] Request received.');
        const { amount } = req.body;
        const userId = req.user.id;
        const file = req.file;

        // Validation
        if (!file) {
            return res.status(400).json({ success: false, message: "Please upload the payment receipt screenshot." });
        }
        if (!amount || amount < 500) {
             return res.status(400).json({ success: false, message: "Valid amount is required (Min: 500)." });
        }

        console.log(`[Manual Deposit] User: ${userId}, Amount: ${amount}, File: ${file.path}`);

        // Call Service to Save to DB (We will add this function to Service next)
        const result = await createManualDeposit(userId, amount, file.path);

        res.status(200).json({ 
            success: true, 
            message: "Receipt submitted successfully! Admin will verify and credit your wallet shortly.", 
            data: result 
        });

    } catch (err) {
        console.error("[Manual Deposit] Error:", err.message);
        res.status(500).json({ success: false, message: "Failed to submit receipt. Please try again." });
    }
});


// ==========================================
// 3. EXISTING ROUTES (Keep these for History/Withdrawals)
// ==========================================

// User initiates payment (Flutterwave - Currently Blocked but kept for future)
router.post('/initialize', verifyToken, async (req, res) => {
  try {
    const {amount} = req.body;
    const {id: userId, email, phone } = req.user;
    const data = await initializePayment(userId, amount, email, phone);
    res.status(200).json({ success: true, message: 'Payment initialized', data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Force Check Route (Still useful for older stuck transactions)
router.post('/confirm', verifyToken, async (req, res) => {
    try {
        const { reference } = req.body;
        const result = await verifyTransactionManual(reference);
        res.status(200).json(result);
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// Webhook
router.post("/verify", async (req, res) => {
  try {
    const signature = req.headers["verif-hash"];
    const secret = process.env.FLW_SECRET_HASH;
    if (!signature || signature !== secret) return res.status(401).json({ success: false, message: "Invalid signature" });
    const data = req.body;
    await verifyPayment({ data }); 
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Get user balance
router.get('/balance/:id', verifyToken, async (req, res) => {  
  try {
    const { id } = req.params; 
    const balance = await getUserBalance(id);
    return res.json({ balance });
  } catch (err) {
     return res.status(500).json({ message: 'Server error' }); 
  }
});

// WITHDRAWAL REQUEST
router.post("/withdraw", verifyToken, async (req, res) => {
  try {
    const { amount, bank_name, account_number, account_name, pin } = req.body;
    if (!pin) return res.status(400).json({ success: false, message: "Withdrawal PIN is required" });
    await verifyWithdrawalPin(req.user.id, pin);
    const result = await requestWithdrawal(req.user.id, amount, bank_name, account_number, account_name);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Admin approves/rejects withdrawal
router.patch("/approve/:reference", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { reference } = req.params;
    const { approve } = req.body;
    const result = await approveWithdrawal(reference, approve);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// History Routes
router.get("/history", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getUserTransactions(userId);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/withdrawals", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getUserWithdrawalTransactions(userId);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/deposits", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getUserDepositTransactions(userId);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
