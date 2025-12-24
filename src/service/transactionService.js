import axios from "axios";
import dotenv from "dotenv";
import pool from '../config/database.js'; // ADDED: Direct Database Access
import { createTransaction, findTransactionByReference, updateTransactionStatus, createWithdrawalTransaction, getAllTransactionsByUserId, getWithdrawalTransactionsByUserId, getDepositTransactionsByUserId, getPendingWithdrawals } from "../repositories/transactionRepository.js";
import { findUserById } from "../repositories/userRepository.js"; 
import { getAllInvestmentsByUserId } from "../repositories/investmentRepository.js";

dotenv.config();

const FLW_BASE_URL = process.env.FLW_BASE_URL;
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
const FLW_PUBLIC_KEY = process.env.FLW_PUBLIC_KEY;
let bankCodeCache = {};
let lastFetched = 0;

// Initialize a Flutterwave payment
export const initializePayment = async (userId, amount, email, phone) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found.");

  if (user.email !== email) {
    throw new Error("Email does not match your registered account.");
  }

  const reference = `TX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const transaction = await createTransaction(userId, amount, reference, 'deposit');

  const customerName = user.full_name || email.split('@')[0] || 'Customer';

  // --- UPDATED: Redirect to Backend Auto-Verify Route ---
  const payload = {
    tx_ref: reference,
    amount,
    currency: "NGN",
    redirect_url: "https://jjb24-backend.onrender.com/api/payment/verify-redirect", // Forces check on return
    customer: {
      email,
      phonenumber: phone,
      name: customerName, 
    },
    customizations: {
      title: "JJB24 Deposit",
      description: "Wallet funding via Flutterwave",
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

// ============================================================
// --- NEW: FORCE CHECK ENGINE (The "Outside the Box" Fix) ---
// ============================================================
export const verifyTransactionManual = async (reference) => {
    console.log(`[ForceCheck] Starting verification for ${reference}...`);

    // 1. Check local DB status first
    const transaction = await findTransactionByReference(reference);
    if (!transaction) throw new Error("Transaction reference not found in our records.");
    
    if (transaction.status === 'success') {
        return { success: true, message: "Transaction already confirmed." };
    }

    // 2. ASK FLUTTERWAVE DIRECTLY (Bypassing Webhook)
    try {
        const response = await axios.get(`${FLW_BASE_URL}/transactions/verify_by_reference?tx_ref=${reference}`, {
            headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` }
        });

        const flwData = response.data.data;

        // 3. Check if Flutterwave says it's successful
        // We also check Amount >= Expected Amount to prevent fraud
        if (flwData.status === "successful" && flwData.amount >= Number(transaction.amount)) {
            
            console.log(`[ForceCheck] Flutterwave Confirmed! Crediting User...`);
            
            // A. Mark DB as Success
            await updateTransactionStatus(reference, "success");

            // B. Direct SQL Balance Update (The Bulletproof Way)
            const user = await findUserById(transaction.user_id);
            const newBalance = Number(user.balance) + Number(transaction.amount); 
            
            await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, user.id]);
            
            console.log(`[ForceCheck] User ${user.email} Credited. New Balance: ₦${newBalance}`);
            return { success: true, message: "Payment Verified & Wallet Funded!" };

        } else {
            console.log(`[ForceCheck] Payment not successful yet. Status: ${flwData.status}`);
            return { success: false, message: "Payment not successful or pending." };
        }

    } catch (error) {
        console.error("[ForceCheck] Error contacting Flutterwave:", error.message);
        throw new Error("Could not verify payment status with bank.");
    }
};

// Verify payment (Webhook) - Kept as backup listener
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

    // --- FRAUD CHECK ---
    const paidAmount = Number(amount);
    const expectedAmount = Number(transaction.amount);

    if (paidAmount < expectedAmount) {
        console.error(`[Fraud Alert] User paid ₦${paidAmount} but expected ₦${expectedAmount}. Blocking credit.`);
        await updateTransactionStatus(tx_ref, "failed"); 
        return { success: false, message: "Amount mismatch: Payment declined." };
    }

    // A. Mark as Success
    await updateTransactionStatus(tx_ref, "success");

    // B. Find User
    const user = await findUserById(transaction.user_id);
    if (!user) {
        console.error(`[verifyPayment] User not found for transaction ${tx_ref}`);
        return { success: false, message: "User not found" };
    }

    // C. Force Update Balance (Direct SQL)
    const newBalance = Number(user.balance) + expectedAmount;
    console.log(`[verifyPayment] FORCING DB UPDATE: User ${user.email} | New Balance: ₦${newBalance}`);

    await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, user.id]);
  } 
  else if (status === "failed") {
    await updateTransactionStatus(tx_ref, "failed");
  }

  return { success: true, message: "Transaction verified" };
};

// User initiates withdrawal 
export const requestWithdrawal = async (userId, amount, bankName, accountNumber, accountName) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  if (Number(amount) < 800) throw new Error("Minimum withdrawal amount is ₦800");
  if (Number(user.balance) < Number(amount)) throw new Error("Insufficient balance");

  const reference = `WD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const transaction = await createWithdrawalTransaction(
    userId, amount, reference, bankName, accountNumber, accountName
  );

  // Direct SQL Update
  const newBalance = Number(user.balance) - Number(amount);
  await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, userId]);

  return { message: "Withdrawal request submitted.", transaction };
};

// Admin approves or rejects withdrawal
export const approveWithdrawal = async (reference, approve = true) => {
  console.log(`[approveWithdrawal] Processing ${reference} (Approve: ${approve})`);
  
  try {
    const transaction = await findTransactionByReference(reference);
    if (!transaction) throw new Error("Transaction not found");
    if (transaction.status !== "pending") throw new Error("Already processed");

    const user = await findUserById(transaction.user_id);
    if (!user) throw new Error("User not found");

    if (approve) {
      let bankCode;
      try {
        bankCode = await getBankCode(transaction.bank_name);
      } catch (bankError) {
        throw new Error(`Failed to get bank code: ${bankError.message}`);
      }

      const grossAmount = Number(transaction.amount);
      const netAmount = Math.round(grossAmount * 0.91 * 100) / 100; 

      const payload = {
        account_bank: bankCode, 
        account_number: transaction.account_number,
        amount: netAmount,
        currency: "NGN",
        narration: "JJB24 Wallet Withdrawal",
        reference: transaction.reference,
      };

      try {
        const response = await axios.post(`${FLW_BASE_URL}/transfers`, payload, {
          headers: { Authorization: `Bearer ${FLW_SECRET_KEY}`, "Content-Type": "application/json" },
        });

        if (response.data.status === "success") {
          await updateTransactionStatus(reference, "success");
          return {
            message: `Withdrawal approved & sent. Net payout: ₦${netAmount.toLocaleString()}`,
            transactionRef: reference,
            grossAmount: grossAmount,
            netAmount: netAmount,
          };
        } else {
          throw new Error(response.data.message || "Transfer failed");
        }
      } catch (error) {
        throw new Error(error.response?.data?.message || error.message || "Flutterwave transfer failed");
      }
    } else {
      // Refund Logic (Direct SQL)
      const refundBalance = Number(user.balance) + Number(transaction.amount);
      await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [refundBalance, user.id]);
      
      await updateTransactionStatus(reference, "failed");
      return { message: `Withdrawal rejected`, transactionRef: reference };
    }
  } catch (error) {
    console.error(`[approveWithdrawal] Error:`, error);
    throw new Error(`Error processing withdrawal: ${error.message}`);
  }
};

const getBankCode = async (bankName) => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  if (Object.keys(bankCodeCache).length === 0 || now - lastFetched > oneDay) {
    const response = await axios.get(`${FLW_BASE_URL}/banks/NG`, {
      headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` },
    });
    bankCodeCache = {};
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

export const getUserTransactions = async (userId) => {
  const transactions = await getAllTransactionsByUserId(userId);
  const formattedTransactions = transactions.map(tx => {
    let description = '';
    let activityType = tx.type;
    switch(tx.type) {
      case 'deposit': description = `Deposit of ₦${Number(tx.amount).toLocaleString()}`; break;
      case 'withdrawal': description = `Withdrawal of ₦${Number(tx.amount).toLocaleString()}${tx.status === 'pending' ? ' (Pending)' : tx.status === 'success' ? ' (Approved)' : ' (Failed)'}`; break;
      case 'investment': description = `Investment of ₦${Number(tx.amount).toLocaleString()}`; break;
      case 'investment_roi': description = `Daily Investment ROI: ₦${Number(tx.amount).toLocaleString()}`; activityType = 'earning'; break;
      case 'referral_bonus': description = `Referral Commission: ₦${Number(tx.amount).toLocaleString()}`; activityType = 'earning'; break;
      default: description = `${tx.type}: ₦${Number(tx.amount).toLocaleString()}`;
    }
    return { ...tx, amount: Number(tx.amount), description, activityType, date: tx.created_at };
  });
  return { message: "Transactions retrieved successfully", transactions: formattedTransactions, totalCount: formattedTransactions.length };
};

export const getUserWithdrawalTransactions = async (userId) => {
  const transactions = await getWithdrawalTransactionsByUserId(userId);
  return { message: "Withdrawal transactions retrieved successfully", transactions, totalCount: transactions.length };
};

export const getUserDepositTransactions = async (userId) => {
  const transactions = await getDepositTransactionsByUserId(userId);
  return { message: "Deposit transactions retrieved successfully", transactions, totalCount: transactions.length };
};

export const getPendingWithdrawalsForAdmin = async () => {
  const withdrawals = await getPendingWithdrawals();
  return { message: "Pending withdrawals retrieved successfully", withdrawals, totalCount: withdrawals.length };
};
