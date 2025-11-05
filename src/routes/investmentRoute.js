import { createInvestment } from '../services/investmentService.js';

const router = express.Router();

export const createInvestmentController = async (req, res) => {
  try {
    const { userId, itemId } = req.body;
    const investment = await createInvestment(userId, itemId);
    res.status(201).json({ success: true, data: investment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
