import express from 'express';
import { createInvestment } from '../service/investmentService.js';
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post('/createInvestment', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.body;
    const investment = await createInvestment(userId, itemId);
    res.status(201).json({ success: true, data: investment });
  } 
  catch (error) {
    console.error("Error creating investment:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
