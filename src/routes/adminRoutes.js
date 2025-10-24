import express from "express";
import { registerAdmin, loginAdmin } from "../service/adminService.js";
import upload from '../middleware/upload.js';
import { uploadItem, deleteItem, updateItem } from '../service/itemService.js';
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

export default router;
