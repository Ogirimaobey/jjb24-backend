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
import './createTable.js';      // Runs database checks
import './src/scheduler.js';    // Starts the Expiration Engine & PIN Logic

dotenv.config();

const app = express();
app.use(cookieParser());

// FIX 1: INCREASE LIMITS FOR IMAGE UPLOADS (PRESERVED)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// =====================================================
// --- THE FIX: ALLOW 'PATCH' (BLOCK) AND 'PUT' (EDIT) ---
// =====================================================
app.use(cors({ 
    origin: true, 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// --- 2. ROUTES ---
app.use('/api/users', userRoutes);
app.use('/api/payment', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/investments', investmentRoute);

// --- 3. REPAIR UTILITIES ---

// NEW: FIX TRANSACTIONS TABLE (Adds Receipt Column)
app.get('/fix-transactions-table', async (req, res) => {
    try {
        const client = await pool.connect();
        // This ensures the database can store the screenshot links we just set up
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_url TEXT;`);
        client.release();
        res.send(`<h1 style="color:green">✅ DATABASE UPDATED!</h1><p>The 'receipt_url' column is now active. Manual receipts will now save correctly.</p>`);
    } catch (error) {
        res.status(500).send(`<h1 style="color:red">❌ FAILED: ${error.message}</h1>`);
    }
});

app.get('/fix-vip-table', async (req, res) => {
    try {
        const client = await pool.connect();
        await client.query(`DROP TABLE IF EXISTS casper_vip CASCADE;`);
        await client.query(`
            CREATE TABLE casper_vip (
                id SERIAL PRIMARY KEY,   
                name VARCHAR(100) NOT NULL,
                price NUMERIC(10, 2) NOT NULL,
                daily_earnings NUMERIC(10, 2) NOT NULL,
                duration_days INTEGER NOT NULL,
                total_returns NUMERIC(20, 2) NOT NULL,
                image VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const seedQuery = `
          INSERT INTO casper_vip (id, name, price, daily_earnings, duration_days, total_returns, image)
          VALUES 
          (101, 'CASPERVIP1', 500000, 20000, 30, 600000, 'https://placehold.co/300x200/1a1a1a/ffffff?text=CASPERVIP1'),
          (102, 'CASPERVIP2', 1000000, 40000, 30, 1200000, 'https://placehold.co/300x200/1a1a1a/ffffff?text=CASPERVIP2'),
          (103, 'CASPER3', 2000000, 80000, 30, 2400000, 'https://placehold.co/300x200/1a1a1a/ffffff?text=CASPER3'),
          (104, 'CASPER4', 3000000, 120000, 30, 3600000, 'https://placehold.co/300x200/1a1a1a/ffffff?text=CASPER4');
        `;
        await client.query(seedQuery);
        await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 30;`);
        client.release();
        res.send(`<h1 style="color:green">✅ REPAIR SUCCESSFUL!</h1>`);
    } catch (error) {
        console.error(error);
        res.send(`<h1 style="color:red">❌ ERROR: ${error.message}</h1>`);
    }
});

// --- 4. DAILY EARNINGS PAYOUT ---
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Processing Daily Earnings...');
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
