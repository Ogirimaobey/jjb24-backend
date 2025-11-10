import express from 'express';
import dotenv from 'dotenv';
import userRoutes from './src/routes/userRoute.js';
import transactionRoutes from './src/routes/transactionRoute.js';
import adminRoutes from './src/routes/adminRoutes.js';
import itemRoutes from './src/routes/itemRoutes.js';
import cors from "cors";
import cron from 'node-cron';
import investmentRoute from './src/routes/investmentRoute.js';
import { processDailyEarnings } from './src/service/investmentService.js';




dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: "*"}));

app.use('/api/users', userRoutes);
app.use('/api/payment', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/investments', investmentRoute);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Runs every 24 hours
cron.schedule('0 0 * * *', async () => {
  await processDailyEarnings();
});
