import express from 'express';
import { initializePayment, verifyPayment } from '../service/transactionService.js';

const router = express.Router();

router.post('/initialize', async (req, res) => {
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

// router.post('/verify', async (req, res) => {
//   try {
//     await verifyPayment(req.body);
//     res.status(200).send('Webhook received');
//   } 
//   catch (err) {
//     console.error(err);
//     res.status(400).send(err.message);
//   }
// });

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
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const balance = await getBalance(userId);
    return res.json({ balance });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
});


export default router;