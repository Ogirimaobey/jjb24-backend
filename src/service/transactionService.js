import axios from "axios";
import dotenv from "dotenv";
import pool from '../config/database.js'; // Direct Database Access for speed and safety
import { 
    createTransaction, 
    findTransactionByReference, 
    updateTransactionStatus, 
    createWithdrawalTransaction, 
    getAllTransactionsByUserId, 
    getWithdrawalTransactionsByUserId, 
    getDepositTransactionsByUserId, 
    getPendingWithdrawals  
} from "../repositories/transactionRepository.js";
import { findUserById } from "../repositories/userRepository.js"; 
import { getAllInvestmentsByUserId } from "../repositories/investmentRepository.js";

dotenv.config();

const FLW_BASE_URL = process.env.FLW_BASE_URL;
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
const FLW_PUBLIC_KEY = process.env.FLW_PUBLIC_KEY;

// Cache for bank codes to prevent repeated API calls
let bankCodeCache = {};
let lastFetched = 0;

// =========================================================================
// SECTION 1: MANUAL DEPOSIT SYSTEM (PLAN B - RECEIPT UPLOAD)
// =========================================================================

export const createManualDeposit = async (userId, amount, receiptUrl) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found.");

  const reference = `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const query = `
    INSERT INTO transactions (user_id, amount, type, status, reference, receipt_url, created_at)
    VALUES ($1, $2, 'deposit', 'pending', $3, $4, NOW())
    RETURNING *
  `;

  try {
    const { rows } = await pool.query(query, [userId, amount, reference, receiptUrl]);
    return rows[0];
  } catch (error) {
    console.error("[Manual Deposit] Database Insert Error:", error.message);
    
    if (error.message.includes('receipt_url') || error.code === '42703') {
        console.warn("[Manual Deposit] 'receipt_url' column missing. Saving without image.");
        const fallbackQuery = `INSERT INTO transactions (user_id, amount, type, status, reference, created_at) VALUES ($1, $2, 'deposit', 'pending', $3, NOW()) RETURNING *`;
        const { rows } = await pool.query(fallbackQuery, [userId, amount, reference]);
        return rows[0];
    }
    throw error;
  }
};

// =========================================================================
// SECTION 2: AUTOMATED PAYMENT SYSTEM (PLAN A - FLUTTERWAVE)
// =========================================================================

export const initializePayment = async (userId, amount, email, phone) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found.");

  if (user.email !== email) {
    throw new Error("Email does not match your registered account.");
  }

  const reference = `TX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const transaction = await createTransaction(userId, amount, reference, 'deposit');

  const customerName = user.full_name || email.split('@')[0] || 'Customer';

  const payload = {
    tx_ref: reference,
    amount,
    currency: "NGN",
    redirect_url: "https://jjb24-backend-1.onrender.com/api/payment/verify-redirect", 
    customer: { 
        email, 
        phonenumber: phone, 
        name: customerName 
    },
    customizations: { 
        title: "JJB24 Deposit", 
        description: "Wallet funding via Flutterwave" 
    },
  };

  try {
    console.log('[initializePayment] Initializing payment with Flutterwave...');
    const response = await axios.post(`${FLW_BASE_URL}/payments`, payload, {
      headers: { Authorization: `Bearer ${FLW_SECRET_KEY}`, "Content-Type": "application/json" },
    });

    if (!response.data || !response.data.data || !response.data.data.link) {
      throw new Error("Failed to generate payment link.");
    }

    return { paymentLink: response.data.data.link, reference, transaction };
  } catch (error) {
    console.error('[initializePayment] Error:', error.message);
    throw new Error(`Payment initialization failed: ${error.message}`);
  }
};

export const verifyTransactionManual = async (reference) => {
    console.log(`[ForceCheck] Starting verification for ${reference}...`);
    
    const transaction = await findTransactionByReference(reference);
    if (!transaction) throw new Error("Transaction reference not found in our records.");
    
    if (transaction.status === 'success') {
        return { success: true, message: "Transaction already confirmed." };
    }

    try {
        const response = await axios.get(`${FLW_BASE_URL}/transactions/verify_by_reference?tx_ref=${reference}`, {
            headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` }
        });

        const flwData = response.data.data;

        if (flwData.status === "successful" && flwData.amount >= Number(transaction.amount)) {
            console.log(`[ForceCheck] Confirmed! Crediting User...`);
            
            await updateTransactionStatus(reference, "success");

            const user = await findUserById(transaction.user_id);
            const newBalance = Number(user.balance) + Number(transaction.amount); 
            
            await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, user.id]);
            
            console.log(`[ForceCheck] User ${user.email} Credited. New Balance: ₦${newBalance}`);
            return { success: true, message: "Payment Verified & Wallet Funded!" };

        } else {
            console.log(`[ForceCheck] Payment status is: ${flwData.status}`);
            return { success: false, message: "Payment not successful or pending." };
        }

    } catch (error) {
        console.error("[ForceCheck] Error contacting Flutterwave:", error.message);
        throw new Error("Could not verify payment status with bank.");
    }
};

export const verifyPayment = async (event) => {
  const { tx_ref, status, amount } = event.data; 

  const transaction = await findTransactionByReference(tx_ref);
  if (!transaction) throw new Error("Transaction not found");

  if (transaction.status === 'success') {
      console.log(`[verifyPayment] Blocked Duplicate: Transaction ${tx_ref} is already successful.`);
      return { success: true, message: "Transaction already successful" };
  }

   if (status === "successful" || event.event === "charge.completed") {
    console.log(`[verifyPayment] Processing Success for ${tx_ref}`);

    const paidAmount = Number(amount);
    const expectedAmount = Number(transaction.amount);

    if (paidAmount < expectedAmount) {
        console.error(`[Fraud Alert] User paid ₦${paidAmount} but expected ₦${expectedAmount}. Blocking credit.`);
        await updateTransactionStatus(tx_ref, "failed"); 
        return { success: false, message: "Amount mismatch: Payment declined." };
    }

    await updateTransactionStatus(tx_ref, "success");

    const user = await findUserById(transaction.user_id);
    if (!user) {
        console.error(`[verifyPayment] User not found for transaction ${tx_ref}`);
        return { success: false, message: "User not found" };
    }

    const newBalance = Number(user.balance) + expectedAmount;
    await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, user.id]);
  } 
  else if (status === "failed") {
    await updateTransactionStatus(tx_ref, "failed");
  }

  return { success: true, message: "Transaction verified" };
};

// =========================================================================
// SECTION 3: WITHDRAWAL MANAGEMENT (PETER'S APPROVAL SYSTEM)
// =========================================================================

export const requestWithdrawal = async (userId, amount, bankName, accountNumber, accountName) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");
  
  if (Number(amount) < 800) throw new Error("Minimum withdrawal amount is ₦800");
  if (Number(user.balance) < Number(amount)) throw new Error("Insufficient balance");

  const reference = `WD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const transaction = await createWithdrawalTransaction(userId, amount, reference, bankName, accountNumber, accountName);

  const newBalance = Number(user.balance) - Number(amount);
  await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, userId]);

  return { message: "Withdrawal request submitted.", transaction };
};

/**
 * FIX: Process Withdrawal with Fee Calculation and Status Security
 */
export const approveWithdrawal = async (reference) => {
  console.log(`[approveWithdrawal] Peter is approving: ${reference}`);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const transaction = await findTransactionByReference(reference);
    if (!transaction) throw new Error("Transaction not found");
    if (transaction.status !== "pending") throw new Error("This withdrawal has already been processed.");

    const user = await findUserById(transaction.user_id);
    if (!user) throw new Error("User associated with this withdrawal not found.");

    // 1. Get Bank Code for Flutterwave
    let bankCode = await getBankCode(transaction.bank_name);

    // 2. Calculate Payout (9% Platform Fee)
    // Using Math.floor to ensure we send a clean number to the API
    const grossAmount = Number(transaction.amount);
    const netAmount = Math.floor(grossAmount * 0.91); 

    const payload = {
      account_bank: bankCode, 
      account_number: transaction.account_number,
      amount: netAmount,
      currency: "NGN",
      narration: "JJB24 Wallet Payout",
      reference: transaction.reference,
    };

    // 3. Automated Payout via Flutterwave
    const response = await axios.post(`${FLW_BASE_URL}/transfers`, payload, {
        headers: { Authorization: `Bearer ${FLW_SECRET_KEY}`, "Content-Type": "application/json" },
    });

    if (response.data.status === "success") {
        await client.query('UPDATE transactions SET status = $1 WHERE reference = $2', ['success', reference]);
        await client.query('COMMIT');
        return { 
          success: true,
          message: `Withdrawal approved & sent. Net: ₦${netAmount}`, 
          transactionRef: reference 
        };
    } else {
        throw new Error(response.data.message || "Flutterwave Transfer failed");
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[approveWithdrawal Error]:`, error.message);
    throw new Error(`Processing Error: ${error.message}`);
  } finally {
    client.release();
  }
};

/**
 * FIX: Reject Withdrawal and Refund User
 */
export const rejectWithdrawal = async (reference) => {
  console.log(`[rejectWithdrawal] Peter is rejecting: ${reference}`);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const transaction = await findTransactionByReference(reference);
    if (!transaction) throw new Error("Transaction not found");
    if (transaction.status !== "pending") throw new Error("Already processed");

    const user = await findUserById(transaction.user_id);
    if (!user) throw new Error("User not found");

    // Refund the user's balance
    const refundBalance = Number(user.balance) + Number(transaction.amount);
    await client.query('UPDATE users SET balance = $1 WHERE id = $2', [refundBalance, user.id]);
    
    // Mark transaction as failed/rejected
    await client.query('UPDATE transactions SET status = $1 WHERE reference = $2', ['failed', reference]);
    
    await client.query('COMMIT');
    return { success: true, message: `Withdrawal rejected & user refunded`, transactionRef: reference };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const getBankCode = async (bankName) => {
  const now = Date.now();
  if (Object.keys(bankCodeCache).length === 0 || now - lastFetched > 86400000) {
    const response = await axios.get(`${FLW_BASE_URL}/banks/NG`, { headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` } });
    response.data.data.forEach((bank) => { bankCodeCache[bank.name.toLowerCase()] = bank.code; });
    lastFetched = now;
  }
  
  let code = bankCodeCache[bankName.toLowerCase()];
  if (!code) {
    const matchedBank = Object.keys(bankCodeCache).find((name) => name.includes(bankName.toLowerCase()));
    if (matchedBank) code = bankCodeCache[matchedBank];
  }
  
  if (!code) throw new Error(`Bank code not found for: ${bankName}`);
  return code;
};

// =========================================================================
// SECTION 4: DATA GETTERS (HISTORY & ADMIN)
// =========================================================================

export const getUserTransactions = async (userId) => {
  const transactions = await getAllTransactionsByUserId(userId);
  const formattedTransactions = transactions.map(tx => {
    let description = '';
    let activityType = tx.type;
    const cleanAmount = Number(tx.amount);

    switch(tx.type) {
      case 'deposit': 
        description = tx.status === 'pending' ? `Pending Deposit: ₦${cleanAmount.toLocaleString()}` : `Deposit: ₦${cleanAmount.toLocaleString()}`;
        break;
      case 'withdrawal': 
        description = `Withdrawal: ₦${cleanAmount.toLocaleString()} (${tx.status})`;
        break;
      case 'investment': 
        description = `Plan Activation: ₦${cleanAmount.toLocaleString()}`;
        break;
      case 'investment_roi': 
        description = `Daily Yield: ₦${cleanAmount.toLocaleString()}`;
        activityType = 'earning'; 
        break;
      case 'referral_bonus': 
        description = `Community Bonus: ₦${cleanAmount.toLocaleString()}`;
        activityType = 'earning'; 
        break;
      default: 
        description = `${tx.type}: ₦${cleanAmount.toLocaleString()}`;
    }
    return { ...tx, amount: cleanAmount, description, activityType, date: tx.created_at };
  });
  return { success: true, transactions: formattedTransactions, totalCount: formattedTransactions.length };
};

export const getUserWithdrawalTransactions = async (userId) => {
  const transactions = await getWithdrawalTransactionsByUserId(userId);
  return { success: true, transactions, totalCount: transactions.length };
};

export const getUserDepositTransactions = async (userId) => {
  const transactions = await getDepositTransactionsByUserId(userId);
  return { success: true, transactions, totalCount: transactions.length };
};

export const getPendingWithdrawalsForAdmin = async () => {
  const withdrawals = await getPendingWithdrawals();
  return { success: true, withdrawals, totalCount: withdrawals.length };
};
