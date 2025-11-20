import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
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
// Allow multiple origins for local development
const allowedOrigins = process.env.FRONTEND_ORIGIN 
  ? process.env.FRONTEND_ORIGIN.split(',')
  : ['http://localhost:8000', 'http://localhost:8080', 'http://127.0.0.1:8000', 'http://127.0.0.1:8080', 'http://192.168.56.1:8080'];

app.use(cookieParser());
app.use(express.json());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in development
    }
  },
  credentials: true
}));

app.use('/api/users', userRoutes);
app.use('/api/payment', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/investments', investmentRoute);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Runs every 24 hours
cron.schedule('* * * * *', async () => {
  await processDailyEarnings();
});
