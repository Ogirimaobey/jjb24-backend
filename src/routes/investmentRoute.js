import express from 'express';
import { createInvestment, getUserInvestments, createVipInvestment} from '../service/investmentService.js';
import { verifyToken } from "../middleware/authMiddleware.js";
import { getAllVips } from '../service/vipService.js';

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

// Create a new item investment for the logged-in user
router.post('/createInvestment/:itemId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    let { itemId } = req.params;
    
    itemId = Number(itemId);
    if (isNaN(itemId) || itemId <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid item ID. Expected a number, got: ${req.params.itemId}` 
      });
    }
    
    const investment = await createInvestment(userId, itemId);
    res.status(201).json({ success: true, data: investment });
  } 
  catch (error) {
    console.error("Error creating investment:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;


//Create CASPERVIP investment for users
router.post('/createVipInvestment/:vipId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    let { vipId } = req.params;

    const casperVIPInvestment = await createVipInvestment(userId, vipId);
    // console.log("Vip investment details", casperVIPInvestment)
    res.status(201).json({ success: true, data: casperVIPInvestment });
  } 
  catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

//Get CASPERVIP investment for users
router.get('/allVipInvestment', verifyToken, async (req, res) => {
  try {
    const data = await getAllVips();
    res.json(data);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
