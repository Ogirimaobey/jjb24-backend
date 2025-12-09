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
