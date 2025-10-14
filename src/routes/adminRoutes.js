import express from "express";
import { registerAdmin, loginAdmin } from "../service/adminService.js";

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

export default router;
