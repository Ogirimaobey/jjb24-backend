import express from 'express';
import upload from '../middleware/upload.js';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';
import { uploadItem, getAllItems, getItemById, updateItem, deleteItem } from '../service/itemService.js';

const router = express.Router();

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

// Get all items (users can view)
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await getAllItems();
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single item by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getItemById(id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

// Admin updates an item
router.put('/:id', verifyToken, verifyAdmin, upload.single('itemImage'), async (req, res) => {
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

// Admin deletes an item
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteItem(id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

export default router;

