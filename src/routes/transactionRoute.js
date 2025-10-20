import express from 'express';
import { initializePayment, verifyPayment, requestWithdrawal, approveWithdrawal, getUserTransactions } from '../service/transactionService.js';
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// User initiates payment
router.post('/initialize', verifyToken, async (req, res) => {
  try {
    const { userId, amount, email, name } = req.body;
    const data = await initializePayment(userId, amount, email, name);
    res.status(200).json({
      success: true,
      message: 'Payment initialized',
      data,
    });
  } catch (err) {
    console.error(err);
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

//User initiates withdrawal
router.post("/withdraw", verifyToken, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;
    const result = await requestWithdrawal(userId, amount);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

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

export default router;
