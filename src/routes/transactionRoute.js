import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { 
    requestWithdrawal, 
    approveWithdrawal, 
    rejectWithdrawal,
    getUserTransactions, 
    getUserWithdrawalTransactions, 
    getUserDepositTransactions,
    createManualDeposit 
} from '../service/transactionService.js';
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { getUserBalance, verifyWithdrawalPin } from '../service/userService.js';
import pool from '../config/database.js';

const router = express.Router();

// ==========================================
// 1. CONFIGURE IMAGE UPLOAD (Cloudinary)
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
// 2. MANUAL DEPOSIT ROUTES (USER SIDE)
// ==========================================

// User submits a screenshot of their transfer
router.post('/deposit/manual', verifyToken, upload.single('receipt'), async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.user.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: "Please upload the payment receipt screenshot." });
        }
        
        if (!amount || Number(amount) < 500) {
             return res.status(400).json({ success: false, message: "Valid amount is required (Min: ₦500)." });
        }

        const result = await createManualDeposit(userId, amount, file.path);

        res.status(200).json({ 
            success: true, 
            message: "Receipt submitted! Peter will verify and credit your wallet shortly.", 
            data: result 
        });

    } catch (err) {
        console.error("[Manual Deposit] Error:", err.message);
        res.status(500).json({ success: false, message: "Failed to submit receipt." });
    }
});

// ==========================================
// 3. MANUAL WITHDRAWAL ROUTES (USER SIDE)
// ==========================================

// User requests a payout to their bank
router.post("/withdraw", verifyToken, async (req, res) => {
  try {
    const { amount, bank_name, account_number, account_name, pin } = req.body;
    
    if (!pin) return res.status(400).json({ success: false, message: "Withdrawal PIN is required" });
    
    // Validate Transaction PIN before proceeding
    await verifyWithdrawalPin(req.user.id, pin);
    
    const result = await requestWithdrawal(req.user.id, amount, bank_name, account_number, account_name);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ==========================================
// 4. ADMIN MANAGEMENT ROUTES (PETER SIDE)
// ==========================================

// Admin fetches all pending receipt uploads
router.get('/deposits/pending', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const query = `
            SELECT t.*, u.email, u.full_name 
            FROM transactions t 
            JOIN users u ON t.user_id = u.id 
            WHERE t.receipt_url IS NOT NULL AND t.status = 'pending'
            ORDER BY t.created_at DESC
        `;
        const { rows } = await pool.query(query);
        res.status(200).json({ success: true, deposits: rows });
    } catch (err) {
        console.error("[Admin Pending Deposits] Error:", err.message);
        res.status(500).json({ success: false, message: "Failed to fetch pending deposits." });
    }
});

/**
 * PETER ACTION: Approve or Reject Withdrawal
 * This route is now purely manual logic (No Flutterwave)
 */
router.post("/approve/:reference", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { reference } = req.params;
    const { approve } = req.body; // Boolean from Frontend

    let result;
    if (approve) {
        result = await approveWithdrawal(reference);
    } else {
        result = await rejectWithdrawal(reference);
    }

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ==========================================
// 5. TRANSACTION HISTORY ROUTES
// ==========================================

// Unified history for the home screen
router.get("/history", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getUserTransactions(userId);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Filtered withdrawal records
router.get("/withdrawals", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getUserWithdrawalTransactions(userId);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Filtered deposit records
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
