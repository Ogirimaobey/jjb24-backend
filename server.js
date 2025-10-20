// // --- IMPORTS ---
// const express = require('express');
// const cors = require('cors');
// const { Pool } = require('pg');
// const bcrypt = require('bcrypt');
// const jwt = require('jsonwebtoken');

// // --- SETUP ---
// const app = express();
// const PORT = 3000;
// const saltRounds = 10;
// const JWT_SECRET = 'your_super_secret_jwt_key_that_is_long_and_random';

// // --- JJB24 PRODUCT DATA ---
// const jobPlans = {
//     'SW1': { id: 'SW1', name: '4th STREET', price: 8000, daily_income: 400, tasks: 2, duration: 35, image: 'https://i.postimg.cc/RVmDbNMg/image.png' },
//     'SW2': { id: 'SW2', name: 'CARLO ROSSI', price: 15000, daily_income: 800, tasks: 2, duration: 35, image: 'https://i.postimg.cc/Bb4RD6b1/image.png' },
//     'SW3': { id: 'SW3', name: 'ANDRE', price: 40000, daily_income: 1600, tasks: 5, duration: 40, image: 'https://i.postimg.cc/jdjFrB7C/image.png' },
//     'SW4': { id: 'SW4', name: 'VODKA', price: 80000, daily_income: 3200, tasks: 7, duration: 40, image: 'https://i.postimg.cc/Dzcr0wV3/image.png' },
//     'SW5': { id: 'SW5', name: 'CHAMDOR', price: 120000, daily_income: 3800, tasks: 10, duration: 50, image: 'https://i.postimg.cc/SR97y7kf/image.png' },
//     'SW6': { id: 'SW6', name: 'SANDEMAN RUBY', price: 150000, daily_income: 4400, tasks: 10, duration: 50, image: 'https://i.postimg.cc/90PR8xWz/image.png' },
//     'SW7': { id: 'SW7', name: 'ASCONI AGOR', price: 200000, daily_income: 4900, tasks: 10, duration: 60, image: 'https://i.postimg.cc/rFFw2yj9/image.png' },
//     'SW8': { id: 'SW8', name: 'IRISH CREAM', price: 300000, daily_income: 6000, tasks: 10, duration: 90, image: 'https://i.postimg.cc/KYXbjmPd/image.png' },
//     'SW9': { id: 'SW9', name: 'GLENFFIDDICH', price: 400000, daily_income: 7800, tasks: 10, duration: 90, image: 'https://i.postimg.cc/tgdKgWC9/image.png' },
//     'SW10': { id: 'SW10', name: 'MATTEL', price: 500000, daily_income: 9800, tasks: 10, duration: 90, image: 'https://i.postimg.cc/NMzpGjTk/image.png' },
// };
// const vipPlans = {
//     'VIP1': { id: 'VIP1', name: 'CASPER VIP 1', price: 500000, total_return: 600000, duration: 30, image: '' },
//     'VIP2': { id: 'VIP2', name: 'CASPER VIP 2', price: 1000000, total_return: 1200000, duration: 30, image: '' },
//     'VIP3': { id: 'VIP3', name: 'CASPER VIP 3', price: 2000000, total_return: 2400000, duration: 30, image: '' },
//     'VIP4': { id: 'VIP4', name: 'CASPER VIP 4', price: 3000000, total_return: 3600000, duration: 30, image: '' },
// };
// const allPlans = { ...jobPlans, ...vipPlans };

// // --- DATABASE CONNECTION ---
// const pool = new Pool({ user: 'mac', host: 'localhost', database: 'skate_winery', password: '', port: 5433, });
// pool.connect((err) => { if (err) { console.error('Error acquiring client', err.stack); } else { console.log('Successfully connected to the PostgreSQL database!'); } });

// // --- MIDDLEWARE & AUTH ---
// app.use((req, res, next) => { res.setHeader('Access-Control-Allow-Private-Network', 'true'); next(); });
// app.use(cors());
// app.use(express.json());
// const authenticateToken = (req, res, next) => {
//     const authHeader = req.headers['authorization'];
//     const token = authHeader && authHeader.split(' ')[1];
//     if (token == null) return res.sendStatus(401);
//     jwt.verify(token, JWT_SECRET, (err, user) => {
//         if (err) return res.sendStatus(403);
//         req.user = user;
//         next();
//     });
// };
// const authenticateAdmin = (req, res, next) => {
//     const authHeader = req.headers['authorization'];
//     const token = authHeader && authHeader.split(' ')[1];
//     if (token == null) return res.sendStatus(401);
//     jwt.verify(token, JWT_SECRET, (err, user) => {
//         if (err || !user.isAdmin) {
//             return res.sendStatus(403);
//         }
//         req.user = user;
//         next();
//     });
// };

// // --- API ENDPOINTS ---
// app.post('/api/register', async (req, res) => {
//   const { fullName, phone, password, referralCode } = req.body;
//   if (!fullName || !phone || !password) { return res.status(400).json({ message: 'Please provide all required fields.' }); }
//   try {
//     const passwordHash = await bcrypt.hash(password, saltRounds);
//     const ownReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
//     const insertQuery = `INSERT INTO users (full_name, phone_number, password_hash, referral_code_used, own_referral_code) VALUES ($1, $2, $3, $4, $5) RETURNING id;`;
//     const values = [fullName, phone, passwordHash, referralCode, ownReferralCode];
//     await pool.query(insertQuery, values);
//     res.status(201).json({ message: 'User registered successfully!' });
//   } catch (error) {
//     if (error.code === '23505') { return res.status(409).json({ message: 'This phone number is already registered.' }); }
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   }
// });

// app.post('/api/login', async (req, res) => {
//     const { phone, password } = req.body;
//     if (!phone || !password) { return res.status(400).json({ message: 'Please provide phone and password.' }); }
//     try {
//         const result = await pool.query('SELECT * FROM users WHERE phone_number = $1', [phone]);
//         if (result.rows.length === 0) { return res.status(401).json({ message: 'Invalid credentials.' }); }
//         const user = result.rows[0];
//         const isMatch = await bcrypt.compare(password, user.password_hash);
//         if (!isMatch) { return res.status(401).json({ message: 'Invalid credentials.' }); }
//         const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
//         res.status(200).json({ message: 'Login successful!', token });
//     } catch (error) { res.status(500).json({ message: 'An internal server error occurred.' }); }
// });

// app.get('/api/dashboard', authenticateToken, async (req, res) => {
//     try {
//         const userResult = await pool.query('SELECT id, full_name, phone_number, own_referral_code FROM users WHERE id = $1', [req.user.userId]);
//         if (userResult.rows.length === 0) { return res.status(404).json({ message: 'User not found.' }); }
//         const investmentsResult = await pool.query('SELECT * FROM investments WHERE user_id = $1 ORDER BY start_date DESC', [req.user.userId]);
//         res.status(200).json({ user: userResult.rows[0], plans: Object.values(jobPlans), investments: investmentsResult.rows });
//     } catch (error) { res.status(500).json({ message: 'An internal server error occurred.' }); }
// });

// app.get('/api/promotions', authenticateToken, (req, res) => {
//     res.status(200).json(Object.values(vipPlans));
// });

// app.post('/api/invest', authenticateToken, async (req, res) => {
//     const { planId } = req.body;
//     const userId = req.user.userId;
//     const plan = allPlans[planId];
//     if (!plan) { return res.status(404).json({ message: 'Investment plan not found.' }); }
//     try {
//         const startDate = new Date();
//         const endDate = new Date();
//         endDate.setDate(startDate.getDate() + plan.duration);
//         const insertQuery = `INSERT INTO investments (user_id, plan_id, plan_name, investment_amount, daily_revenue, end_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`;
//         const values = [userId, planId, plan.name, plan.price, plan.daily_income || 0, endDate];
//         await pool.query(insertQuery, values);
//         res.status(201).json({ message: `Successfully invested in ${plan.name}!` });
//     } catch (error) { res.status(500).json({ message: 'An internal server error occurred.' }); }
// });

// app.get('/api/tasks', authenticateToken, async (req, res) => {
//     const userId = req.user.userId;
//     try {
//         const investmentRes = await pool.query('SELECT * FROM investments WHERE user_id = $1 AND is_active = true ORDER BY start_date DESC LIMIT 1', [userId]);
//         if (investmentRes.rows.length === 0) { return res.status(200).json({ tasksRequired: 0, tasksCompleted: 0 }); }
//         const currentPlanId = investmentRes.rows[0].plan_id;
//         const tasksRequired = jobPlans[currentPlanId] ? jobPlans[currentPlanId].tasks : 0;
//         let tasksTodayRes = await pool.query('SELECT * FROM daily_tasks WHERE user_id = $1 AND task_date = CURRENT_DATE', [userId]);
//         if (tasksTodayRes.rows.length === 0) {
//             await pool.query('INSERT INTO daily_tasks (user_id) VALUES ($1)', [userId]);
//             tasksTodayRes = await pool.query('SELECT * FROM daily_tasks WHERE user_id = $1 AND task_date = CURRENT_DATE', [userId]);
//         }
//         res.status(200).json({ tasksRequired, tasksCompleted: tasksTodayRes.rows[0].tasks_completed });
//     } catch (error) { res.status(500).json({ message: 'An internal server error occurred.' }); }
// });

// app.post('/api/tasks/complete', authenticateToken, async (req, res) => {
//     const userId = req.user.userId;
//     try {
//         const investmentRes = await pool.query('SELECT * FROM investments WHERE user_id = $1 AND is_active = true ORDER BY start_date DESC LIMIT 1', [userId]);
//         if (investmentRes.rows.length === 0) { return res.status(400).json({ message: 'No active investment plan.' }); }
//         const currentPlanId = investmentRes.rows[0].plan_id;
//         const tasksRequired = jobPlans[currentPlanId] ? jobPlans[currentPlanId].tasks : 0;
//         const tasksTodayRes = await pool.query('SELECT * FROM daily_tasks WHERE user_id = $1 AND task_date = CURRENT_DATE', [userId]);
//         if (tasksTodayRes.rows.length === 0) { return res.status(400).json({ message: 'No task record for today.' }); }
//         const tasksCompleted = tasksTodayRes.rows[0].tasks_completed;
//         if (tasksCompleted >= tasksRequired) { return res.status(400).json({ message: 'All tasks for today are completed.' }); }
//         const newTasksCompleted = tasksCompleted + 1;
//         await pool.query('UPDATE daily_tasks SET tasks_completed = $1 WHERE user_id = $2 AND task_date = CURRENT_DATE', [newTasksCompleted, userId]);
//         res.status(200).json({ message: 'Task completed!', tasksRequired, tasksCompleted: newTasksCompleted });
//     } catch (error) { res.status(500).json({ message: 'An internal server error occurred.' }); }
// });

// app.post('/api/admin/login', async (req, res) => {
//     const { phone, password } = req.body;
//     if (!phone || !password) { return res.status(400).json({ message: 'Please provide credentials.' }); }
//     try {
//         const result = await pool.query('SELECT * FROM users WHERE phone_number = $1', [phone]);
//         if (result.rows.length === 0) { return res.status(401).json({ message: 'Invalid credentials.' }); }
//         const user = result.rows[0];
//         if (!user.is_admin) { return res.status(403).json({ message: 'Access Forbidden.' }); }
//         const isMatch = await bcrypt.compare(password, user.password_hash);
//         if (!isMatch) { return res.status(401).json({ message: 'Invalid credentials.' }); }
//         const token = jwt.sign({ userId: user.id, isAdmin: true }, JWT_SECRET, { expiresIn: '1h' });
//         res.status(200).json({ message: 'Admin login successful!', token });
//     } catch (error) { res.status(500).json({ message: 'An internal server error occurred.' }); }
// });

// app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
//     try {
//         const userCount = await pool.query('SELECT COUNT(*) FROM users;');
//         const investmentCount = await pool.query('SELECT COUNT(*) FROM investments;');
//         const totalInvested = await pool.query('SELECT SUM(investment_amount) FROM investments;');
//         const recentUsers = await pool.query('SELECT full_name, phone_number, created_at FROM users ORDER BY created_at DESC LIMIT 5;');
//         const stats = {
//             totalUsers: userCount.rows[0].count,
//             totalInvestments: investmentCount.rows[0].count,
//             totalAmountInvested: totalInvested.rows[0].sum || 0,
//             recentUsers: recentUsers.rows
//         };
//         res.status(200).json(stats);
//     } catch (error) { res.status(500).json({ message: 'An internal server error occurred.' }); }
// });

// app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
//     try {
//         const result = await pool.query('SELECT id, full_name, phone_number, created_at FROM users ORDER BY created_at DESC');
//         res.status(200).json(result.rows);
//     } catch (error) { res.status(500).json({ message: 'An internal server error occurred.' }); }
// });

// // --- SERVER START ---
// app.listen(PORT, () => {
//   console.log(`Server is running successfully on port ${PORT}`);
// });




import express from 'express';
import dotenv from 'dotenv';
import userRoutes from './src/routes/userRoute.js';
import transactionRoutes from './src/routes/transactionRoute.js';
import adminRoutes from './src/routes/adminRoutes.js';


dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/payment', transactionRoutes);
app.use('/api/admin', adminRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
