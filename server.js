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
import './createTable.js';      // Runs database schema checks/updates
import './src/scheduler.js';    // Starts the Expiration Engine & PIN Logic

dotenv.config();

const app = express();
app.use(cookieParser());

// Increase limits for image uploads (receipts/profiles)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// =====================================================
// --- CORS POLICY: ALLOW ADMIN PATCH/PUT METHODS ---
// =====================================================
app.use(cors({ 
    origin: true, 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// --- 2. THE NUCLEAR REPAIR ROUTE (ROOT LEVEL) ---
// Visit this once: https://jjb24-backend-1.onrender.com/repair-truth
app.get('/repair-truth', async (req, res) => {
    try {
        const client = await pool.connect();
        console.log("[Repair] Starting Database Truth Sync for User 322...");

        // 1. Force fix the 150k Vodka Plan (Fixes name/price loop)
        await client.query(`
            UPDATE investments 
            SET price = 150000, 
                amount = 150000, 
                daily_earning = 7500, 
                duration = 50 
            WHERE user_id = 322 AND (price = 8000 OR price IS NULL OR item_id = 24);
        `);

        // 2. Force fix the 15k Algor Plan
        await client.query(`
            UPDATE investments 
            SET price = 15000, 
                amount = 15000, 
                daily_earning = 750, 
                duration = 35 
            WHERE user_id = 322 AND item_id = 21;
        `);

        // 3. Ensure receipt storage exists
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_url TEXT;`);

        client.release();
        res.send(`
            <body style="background:#111; color:#0f0; font-family:monospace; padding:50px; text-align:center;">
                <h1 style="font-size:3rem;">🚀 SYSTEM REPAIRED</h1>
                <p style="color:#fff; font-size:1.2rem;">Database truth sync for 150,000 and 15,000 plans successful.</p>
                <p style="color:#aaa;">Refresh your mobile dashboard now.</p>
            </body>
        `);
    } catch (error) {
        res.status(500).send(`<h1 style="color:red">❌ SYNC FAILED: ${error.message}</h1>`);
    }
});

// --- 3. STANDARD API ROUTES ---
app.use('/api/users', userRoutes);
app.use('/api/payment', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/investments', investmentRoute);

// --- 4. LEGACY REPAIR UTILITIES ---
app.get('/fix-vip-table', async (req, res) => {
    try {
        const client = await pool.connect();
        await client.query(`DROP TABLE IF EXISTS casper_vip CASCADE;`);
        await client.query(`
            CREATE TABLE casper_vip (
                id SERIAL PRIMARY KEY,   
                name VARCHAR(100) NOT NULL,
                price NUMERIC(15, 2) NOT NULL,
                daily_earnings NUMERIC(15, 2) NOT NULL,
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
          (104, 'CASPER4', 3000000, 120000, 30, 3600000, 'https://placehold.co/300x200/1a1a1a/ffffff?text=CASPER4')
          ON CONFLICT (id) DO NOTHING;
        `;
        await client.query(seedQuery);
        await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 30;`);
        client.release();
        res.send(`<h1 style="color:green">✅ VIP REPAIR SUCCESSFUL!</h1>`);
    } catch (error) {
        res.send(`<h1 style="color:red">❌ ERROR: ${error.message}</h1>`);
    }
});

// --- 5. DAILY YIELD ENGINE ---
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Triggering Daily Yields...');
  await processDailyEarnings();
});

// --- 6. SERVER STARTUP ---
const startServer = async () => {
  await permanentAdmin();     
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();
