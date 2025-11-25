import express from 'express';
import { initializePayment, verifyPayment, requestWithdrawal, approveWithdrawal, getUserTransactions, getUserWithdrawalTransactions, getUserDepositTransactions } from '../service/transactionService.js';
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { getUserBalance } from '../service/userService.js';

const router = express.Router();

// User initiates payment
router.post('/initialize', verifyToken, async (req, res) => {
  try {
    console.log('[Payment Route] ===== PAYMENT INITIALIZATION REQUEST =====');
    console.log('[Payment Route] Request body:', req.body);
    console.log('[Payment Route] User from token:', { id: req.user.id, email: req.user.email, phone: req.user.phone });
    
    const {amount} = req.body;
    const {id: userId, email, phone } = req.user;
    
    console.log('[Payment Route] Initializing payment for:', { userId, amount, email, phone });
    
    const data = await initializePayment(userId, amount, email, phone);
    
    console.log('[Payment Route] ✅ Payment initialized successfully');
    console.log('[Payment Route] Payment link:', data.paymentLink);
    
    res.status(200).json({
      success: true,
      message: 'Payment initialized',
      data,
    });
  } catch (err) {
    console.error('[Payment Route] ❌ Payment initialization failed:');
    console.error('[Payment Route] Error:', err.message);
    console.error('[Payment Route] Stack:', err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Flutterwave webhook to verify payment
router.post("/verify", async (req, res) => {
  try {
    console.log("Webhook received:", req.body);
    const result = await verifyPayment(req, process.env.FLW_SECRET_HASH);
    res.status(200).json(result);

  } 
  catch (err) {
    console.error("Webhook error:", err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

// Get user balance
router.get('/balance/:id',verifyToken, async (req, res) => {  
  try {
    const userId = req.params;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID missing' });}
    console.log(`Fetching balance for user ID: ${userId}`);  
    const balance = await getUserBalance(userId);
    return res.json({ balance });
  } catch (err) {
    console.error(`Balance fetch failed for user ${req.params || 'unknown'}:`, err); 
     return res.status(500).json({ message: 'Server error' }); }
}
);

//withdrawal request by user
router.post("/withdraw", verifyToken, async (req, res) => {
  try {
    const { amount, bank_name, account_number, account_name } = req.body;
    const result = await requestWithdrawal(req.user.id, amount, bank_name, account_number, account_name);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});


//Admin approves/rejects withdrawal
router.patch("/approve/:reference",verifyToken, verifyAdmin, async (req, res) => {
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
