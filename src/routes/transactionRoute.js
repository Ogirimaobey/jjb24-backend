import express from 'express';
import { initializePayment, verifyPayment, requestWithdrawal, approveWithdrawal, getUserTransactions, getUserWithdrawalTransactions, getUserDepositTransactions } from '../service/transactionService.js';
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { getUserBalance, verifyWithdrawalPin } from '../service/userService.js'; // <--- IMPORT PIN VERIFIER

const router = express.Router();

// User initiates payment
router.post('/initialize', verifyToken, async (req, res) => {
  try {
    console.log('[Payment Route] ===== PAYMENT INITIALIZATION REQUEST =====');
    const {amount} = req.body;
    const {id: userId, email, phone } = req.user;
    
    console.log('[Payment Route] Initializing payment for:', { userId, amount });
    
    const data = await initializePayment(userId, amount, email, phone);
    
    res.status(200).json({
      success: true,
      message: 'Payment initialized',
      data,
    });
  } catch (err) {
    console.error('[Payment Route] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});


router.post("/verify", async (req, res) => {
  try {
    const signature = req.headers["verif-hash"];
    const secret = process.env.FLW_SECRET_HASH;

    if (!signature || signature !== secret) {
      return res.status(401).json({ success: false, message: "Invalid signature" });
    }

    const data = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    const result = await verifyPayment(data);
    return res.status(200).json(result);

  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});


// Get user balance (FIXED BUG HERE)
router.get('/balance/:id', verifyToken, async (req, res) => {  
  try {
    // FIX: Destructure 'id' from params. 
    // Previous code 'const userId = req.params' returned an object, causing DB error.
    const { id } = req.params; 
    
    if (!id) {
      return res.status(400).json({ message: 'User ID missing' });
    }
    
    const balance = await getUserBalance(id);
    return res.json({ balance });
  } catch (err) {
     return res.status(500).json({ message: 'Server error' }); 
  }
});

// --- UPDATED: WITHDRAWAL REQUEST (NOW CHECKS PIN) ---
router.post("/withdraw", verifyToken, async (req, res) => {
  try {
    const { amount, bank_name, account_number, account_name, pin } = req.body;

    // 1. Validate PIN Input
    if (!pin) {
        return res.status(400).json({ success: false, message: "Withdrawal PIN is required" });
    }

    // 2. Verify PIN against Database
    // If this fails, it throws an error and jumps to 'catch'
    await verifyWithdrawalPin(req.user.id, pin);

    // 3. Proceed with Withdrawal
    const result = await requestWithdrawal(req.user.id, amount, bank_name, account_number, account_name);
    res.status(200).json({ success: true, ...result });

  } catch (err) {
    // This catches "Incorrect PIN" errors too
    res.status(400).json({ success: false, message: err.message });
  }
});
// ----------------------------------------------------


//Admin approves/rejects withdrawal
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


// Get all transactions for the current logged-in user
router.get("/history", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getUserTransactions(userId);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get withdrawal transactions for the current logged-in user
router.get("/withdrawals", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getUserWithdrawalTransactions(userId);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get deposit transactions for the current logged-in user
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
