import express from 'express';
import { createInvestment, getUserInvestments } from '../service/investmentService.js';
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all investments for the logged-in user
router.get('/allInvestment', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getUserInvestments(userId);
    res.status(200).json({ 
      success: true, 
      ...result 
    });
  } 
  catch (error) {
    console.error("Error fetching investments:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/createInvestment/:itemId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const investment = await createInvestment(userId, itemId);
    res.status(201).json({ success: true, data: investment });
  } 
  catch (error) {
    console.error("Error creating investment:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
