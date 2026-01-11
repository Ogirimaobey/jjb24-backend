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
import pool from './src/config/database.js';

// --- 1. AUTO-SETUP & SCHEDULER ---
import './createTable.js';      
import './src/scheduler.js';    

dotenv.config();
const app = express();
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors({ 
    origin: true, 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// =====================================================
// --- THE TRUTH REPAIR ROUTE (ROOT LEVEL) ---
// Visit: https://jjb24-backend-1.onrender.com/repair-truth
// =====================================================
app.get('/repair-truth', async (req, res) => {
    try {
        const client = await pool.connect();
        
        // FIX VODKA (Targeting your specific User ID 322)
        await client.query(`
            UPDATE investments 
            SET price = 150000, 
                amount = 150000, 
                daily_earning = 7500, 
                duration = 50 
            WHERE user_id = 322 AND (price = 8000 OR price IS NULL OR item_id = 24);
        `);

        // FIX ALGOR (Targeting your specific User ID 322)
        await client.query(`
            UPDATE investments 
            SET price = 15000, 
                amount = 15000, 
                daily_earning = 750, 
                duration = 35 
            WHERE user_id = 322 AND item_id = 21;
        `);

        client.release();
        res.status(200).send(`
            <div style="background:#000; color:#0f0; padding:50px; text-align:center; font-family:sans-serif;">
                <h1 style="font-size:3rem;">🚀 DATABASE REPAIRED</h1>
                <p style="color:#fff; font-size:1.5rem;">Your ₦150k and ₦15k plans have been forced into the database.</p>
                <p style="color:#aaa;">Refresh your My Plans page now.</p>
            </div>
        `);
    } catch (error) {
        res.status(500).send("SQL ERROR: " + error.message);
    }
});

// --- 2. STANDARD ROUTES ---
app.use('/api/users', userRoutes);
app.use('/api/payment', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/investments', investmentRoute);

// --- 3. DAILY EARNINGS ---
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
