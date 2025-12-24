import express from 'express';
import axios from 'axios'; 
import { 
    initializePayment, 
    verifyPayment, 
    verifyTransactionManual, // ADDED: The Force Check Tool
    requestWithdrawal, 
    approveWithdrawal, 
    getUserTransactions, 
    getUserWithdrawalTransactions, 
    getUserDepositTransactions 
} from '../service/transactionService.js';
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { getUserBalance, verifyWithdrawalPin } from '../service/userService.js';

const router = express.Router();

// User initiates payment
router.post('/initialize', verifyToken, async (req, res) => {
  try {
    console.log('[Payment Route] ===== PAYMENT INITIALIZATION REQUEST =====');
    const {amount} = req.body;
    const {id: userId, email, phone } = req.user;
    const data = await initializePayment(userId, amount, email, phone);
    res.status(200).json({ success: true, message: 'Payment initialized', data });
  } catch (err) {
    console.error('[Payment Route] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// --- ADDED: FORCE CHECK ROUTES (The "Outside the Box" Fix) ---
// ============================================================

// 1. MANUAL CONFIRM (Frontend or Admin calls this to force an update)
router.post('/confirm', verifyToken, async (req, res) => {
    try {
        const { reference } = req.body;
        if (!reference) return res.status(400).json({success: false, message: "Reference required"});

        console.log(`[Manual Verify] User ${req.user.id} forcing check for ${reference}`);
        
        // This calls the Force Check Engine in the Service
        const result = await verifyTransactionManual(reference);
        
        res.status(200).json(result);
    } catch (err) {
        console.error('[Manual Verify] Error:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
});

// 2. AUTO-REDIRECT (Flutterwave sends user here immediately after payment)
router.get('/verify-redirect', async (req, res) => {
    const { tx_ref, status } = req.query;
    
    // As users land here, we INSTANTLY check the bank
    if (status === 'successful' || status === 'completed') {
        try {
            console.log(`[Auto-Verify] User returned from bank. Checking ${tx_ref}...`);
            await verifyTransactionManual(tx_ref);
        } catch (e) {
            console.error("[Auto-Verify] Background check failed (user will still see success if webhook worked):", e.message);
        }
    }
    
    // Send them back to your Dashboard
    res.redirect('https://jjbwines.com/#home?payment=verified'); 
});
// ============================================================


// WEBHOOK (Kept as a Backup Listener)
router.post("/verify", async (req, res) => {
  try {
    // 1. Validate Secret Hash
    const signature = req.headers["verif-hash"];
    const secret = process.env.FLW_SECRET_HASH;

    if (!signature || signature !== secret) {
      return res.status(401).json({ success: false, message: "Invalid signature" });
    }

    const data = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    const transactionId = data.id;

    console.log(`[Webhook] Received verification for TX ID: ${transactionId}`);

    // 2. SERVER-TO-SERVER VERIFICATION
    try {
        const flwSecretKey = process.env.FLW_SECRET_KEY;
        
        const response = await axios.get(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
            headers: { 'Authorization': `Bearer ${flwSecretKey}` }
        });

        const verifyResponse = response.data;

        if (verifyResponse.status === 'success' && verifyResponse.data.status === 'successful') {
            // 3. Double Check Amount
            if (verifyResponse.data.amount < data.amount) {
                 console.error('[Fraud Alert] Amount mismatch via Webhook');
                 return res.status(400).json({ success: false, message: "Amount mismatch" });
            }

            // 4. Process
            console.log(`[Webhook] Verified Successfully. Crediting user...`);
            const result = await verifyPayment(data); // Calls Service Logic
            return res.status(200).json(result);
        } else {
            console.warn(`[Webhook] Verification Failed. Status: ${verifyResponse.data?.status}`);
            return res.status(400).json({ success: false, message: "Transaction verification failed" });
        }

    } catch (apiError) {
        console.error('[Webhook] Error contacting Flutterwave:', apiError.message);
        return res.status(500).json({ success: false, message: "Verification API error" });
    }

  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});


// Get user balance
router.get('/balance/:id', verifyToken, async (req, res) => {  
  try {
    const { id } = req.params; 
    if (!id) return res.status(400).json({ message: 'User ID missing' });
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
