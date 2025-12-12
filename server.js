import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import userRoutes from './src/routes/userRoute.js';
import transactionRoutes from './src/routes/transactionRoute.js';
import adminRoutes from './src/routes/adminRoutes.js';
import itemRoutes from './src/routes/itemRoutes.js';
import investmentRoute from './src/routes/investmentRoute.js';
import cors from "cors";
import cron from 'node-cron';
import { processDailyEarnings } from './src/service/investmentService.js';
import { permanentAdmin } from "./seedAdmin.js";
import pool from './src/config/database.js'; // Import Pool for the Magic Fix

// Import Database Setup
import './createTable.js'; 

dotenv.config();

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

app.use('/api/users', userRoutes);
app.use('/api/payment', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/investments', investmentRoute);

// --- 🚨 MAGIC FIX ROUTE (RUN THIS ONCE) ---
app.get('/fix-vip', async (req, res) => {
    try {
        const seedQuery = `
          INSERT INTO casper_vip (id, name, price, daily_earnings, duration_days, total_returns, image)
          VALUES 
          (101, 'CASPERVIP1', 500000, 20000, 30, 600000, 'https://placehold.co/300x200/1a1a1a/ffffff?text=CASPERVIP1'),
          (102, 'CASPERVIP2', 1000000, 40000, 30, 1200000, 'https://placehold.co/300x200/1a1a1a/ffffff?text=CASPERVIP2'),
          (103, 'CASPER3', 2000000, 80000, 30, 2400000, 'https://placehold.co/300x200/1a1a1a/ffffff?text=CASPER3'),
          (104, 'CASPER4', 3000000, 120000, 30, 3600000, 'https://placehold.co/300x200/1a1a1a/ffffff?text=CASPER4')
          ON CONFLICT (id) DO NOTHING;
        `;
        await pool.query(seedQuery);
        res.send("<h1>✅ SUCCESS! VIP Products 101-104 have been created.</h1><p>You can now go back to the app and click Invest.</p>");
    } catch (error) {
        res.send(`<h1>❌ ERROR</h1><p>${error.message}</p>`);
    }
});
// ------------------------------------------

cron.schedule('0 0 * * *', async () => {
  await processDailyEarnings();
});

const startServer = async () => {
  await permanentAdmin();   
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
