import express from "express";
import { registerAdmin, loginAdmin, getAdminStats, getAllUsersForAdmin, getAllInvestmentsForAdmin } from "../service/adminService.js";
import upload from '../middleware/upload.js';
import { uploadItem, deleteItem, updateItem } from '../service/itemService.js';
import { createVip, getAllVips, getVipById, updateVip, deleteVip } from '../service/vipService.js';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    const response = await registerAdmin(email, password);
    res.status(201).json({ success: true, ...response });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const response = await loginAdmin(email, password);
    res.status(200).json({ success: true, ...response });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});


// Admin uploads a new item (with image)
router.post('/upload', verifyToken, verifyAdmin, upload.single('itemImage'), async (req, res) => {
  try {
    const { itemName, price, dailyIncome } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image file is required" });
    }

    const imageUrl = req.file.path; // Cloudinary URL
    const result = await uploadItem({ itemName, price, dailyIncome }, imageUrl);
    
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Admin deletes an item
router.delete('/deleteItem/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteItem(id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});


// Admin updates an item
router.put('/updateItem/:id', verifyToken, verifyAdmin, upload.single('itemImage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { itemName, price, dailyIncome } = req.body;
    const imageUrl = req.file ? req.file.path : null;
    
    const result = await updateItem(id, { itemName, price, dailyIncome }, imageUrl);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ========== CASPERVIP ROUTES ==========

// Admin creates a new CASPERVIP product
router.post('/vip/upload', verifyToken, verifyAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, price, daily_earnings, duration_days, total_returns } = req.body;
    
    if (!name || !price || !daily_earnings || !duration_days || !total_returns) {
      return res.status(400).json({ 
        success: false, 
        message: "All fields are required: name, price, daily_earnings, duration_days, total_returns" 
      });
    }

    const imageUrl = req.file ? req.file.path : null;
    const result = await createVip({ 
      name, 
      price, 
      daily_earnings, 
      duration_days, 
      total_returns 
    }, imageUrl);
    
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Admin gets all CASPERVIP products
router.get('/vip', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await getAllVips();
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin gets single CASPERVIP by ID
router.get('/vip/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getVipById(id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

// Admin updates a CASPERVIP product
router.put('/vip/:id', verifyToken, verifyAdmin, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, daily_earnings, duration_days, total_returns } = req.body;
    const imageUrl = req.file ? req.file.path : null;
    
    const result = await updateVip(id, { 
      name, 
      price, 
      daily_earnings, 
      duration_days, 
      total_returns 
    }, imageUrl);
    
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Admin deletes a CASPERVIP product
router.delete('/vip/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteVip(id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

// ========== ADMIN DASHBOARD ROUTES ==========

// Get admin dashboard stats
router.get('/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const stats = await getAdminStats();
    res.status(200).json({ success: true, ...stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all users (for admin)
router.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await getAllUsersForAdmin();
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all investments (for admin)
router.get('/investments', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const investments = await getAllInvestmentsForAdmin();
    res.status(200).json(investments);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
