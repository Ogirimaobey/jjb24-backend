import axios from "axios";
import dotenv from "dotenv";
import { createTransaction, findTransactionByReference, updateTransactionStatus, createWithdrawalTransaction, getAllTransactionsByUserId, getWithdrawalTransactionsByUserId, getDepositTransactionsByUserId, getPendingWithdrawals } from "../repositories/transactionRepository.js";
import { findUserById, updateUserBalance } from "../repositories/userRepository.js";
import { getAllInvestmentsByUserId } from "../repositories/investmentRepository.js";

dotenv.config();

const FLW_BASE_URL = process.env.FLW_BASE_URL;
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
const FLW_PUBLIC_KEY = process.env.FLW_PUBLIC_KEY;
// Simple cache to avoid fetching every time
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

  // Get user's full name for customer details
  const customerName = user.full_name || email.split('@')[0] || 'Customer';

  const payload = {
    tx_ref: reference,
    amount,
    currency: "NGN",
    redirect_url: "https://jjbwines.com/#home",
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
    console.log('[initializePayment] Amount:', amount, 'Reference:', reference);
    console.log('[initializePayment] Payload:', JSON.stringify(payload, null, 2));

  const response = await axios.post(`${FLW_BASE_URL}/payments`, payload, {
    headers: {
      Authorization: `Bearer ${FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  });
  console.log("[initializePayment] Flutterwave response status:", response.status);
    console.log("[initializePayment] Flutterwave response data:", JSON.stringify(response.data, null, 2));

    if (!response.data || !response.data.data || !response.data.data.link) {
      console.error('[initializePayment] Invalid response from Flutterwave:', response.data);
      throw new Error("Failed to generate payment link. Please try again.");
    }

    const paymentLink = response.data.data.link;
    console.log("[initializePayment] ✅ Payment link generated successfully:");
    console.log("[initializePayment] Payment Link:", paymentLink);
    console.log("[initializePayment] Payment Status:", response.data.status);
    console.log("[initializePayment] Payment Message:", response.data.message);
  return {
      paymentLink: paymentLink,
    reference,
    transaction,
  };
  } catch (error) {
    console.error('[initializePayment] Flutterwave API error:');
    console.error('[initializePayment] Error message:', error.message);
    console.error('[initializePayment] Error response:', error.response?.data);
    console.error('[initializePayment] Error status:', error.response?.status);
    
    if (error.response?.status === 401) {
      throw new Error("Invalid payment gateway credentials. Please contact support.");
    } else if (error.response?.status === 400) {
      const errorMsg = error.response?.data?.message || "Invalid payment request. Please check your details.";
      throw new Error(errorMsg);
    } else if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else {
      throw new Error(`Payment initialization failed: ${error.message}`);
  }
  }
};

// Verify payment and update user balance
export const verifyPayment = async (event) => {
  const { tx_ref, status, amount } = event.data; // amount here comes from the bank

  const transaction = await findTransactionByReference(tx_ref);
  if (!transaction) throw new Error("Transaction not found");

  // ============================================================
  // --- CRITICAL SECURITY FIX: PREVENT DOUBLE CREDITING ---
  // ============================================================
  if (transaction.status === 'success') {
      console.log(`[verifyPayment] Security Check: Transaction ${tx_ref} was ALREADY processed. Blocking duplicate credit.`);
      return { success: true, message: "Transaction already successful (Duplicate blocked)" };
  }
  // ============================================================

   if (
    status === "successful" ||
    event.event === "transfer.completed" ||
    event.event === "payment.completed" ||
    event.event === "charge.completed" ||
    event.event === "payment.success" ||
    event.event === "transfer.success"
  ) {
    console.log(`[verifyPayment] Processing Success for ${tx_ref}`);

    // --- NEW SECURITY CHECK: AMOUNT MATCHING ---
    const paidAmount = Number(amount);
    const expectedAmount = Number(transaction.amount);

    if (paidAmount < expectedAmount) {
        console.error(`[Fraud Alert] User paid ₦${paidAmount} but expected ₦${expectedAmount}. Blocking credit.`);
        await updateTransactionStatus(tx_ref, "failed"); 
        return { success: false, message: "Amount mismatch: Payment declined." };
    }
    // -------------------------------------------

    await updateTransactionStatus(tx_ref, "success");

    const user = await findUserById(transaction.user_id);
    if (!user) {
        console.error(`[verifyPayment] User not found for transaction ${tx_ref}`);
        return { success: false, message: "User not found" };
    }

    // SAFE MATH: Use the trusted expectedAmount for the balance update
    const newBalance = Number(user.balance) + expectedAmount;
    
    console.log(`[verifyPayment] Updating Balance for ${user.email}. Old: ${user.balance}, New: ${newBalance}`);
    
    await updateUserBalance(user.id, newBalance);
  } 
  else if (status === "failed") {
    await updateTransactionStatus(tx_ref, "failed");
  }

  return { success: true, message: "Transaction verified and balance updated" };
};

// User initiates withdrawal 
export const requestWithdrawal = async (userId, amount, bankName, accountNumber, accountName) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  // --- NEW: Enforce Minimum Withdrawal of 800 ---
  if (Number(amount) < 800) {
    throw new Error("Minimum withdrawal amount is ₦800");
  }
  // ----------------------------------------------

  if (Number(user.balance) < Number(amount)) {
    throw new Error("Insufficient balance");
  }

  const reference = `WD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const transaction = await createWithdrawalTransaction(
    userId,
    amount,
    reference,
    bankName,
    accountNumber,
    accountName
  );
  // console.log("Created withdrawal transaction:", transaction);

  const newBalance = Number(user.balance) - Number(amount);
  await updateUserBalance(userId, newBalance);

  return {
    message: "Withdrawal request submitted and pending approval.",
    transaction,
  };
};



// Admin approves or rejects withdrawal
export const approveWithdrawal = async (reference, approve = true) => {
  console.log(`[approveWithdrawal] Starting withdrawal ${approve ? 'approval' : 'rejection'} for reference: ${reference}`);
  
  try {
    const transaction = await findTransactionByReference(reference);
    if (!transaction) {
      console.error(`[approveWithdrawal] Transaction not found: ${reference}`);
      throw new Error("Transaction not found");
    }

    console.log(`[approveWithdrawal] Transaction found:`, {
      id: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      bank_name: transaction.bank_name,
      account_number: transaction.account_number
    });

    if (transaction.status !== "pending") {
      console.error(`[approveWithdrawal] Transaction already processed. Status: ${transaction.status}`);
      throw new Error("Already processed");
    }

  const user = await findUserById(transaction.user_id);
    if (!user) {
      console.error(`[approveWithdrawal] User not found: ${transaction.user_id}`);
      throw new Error("User not found");
    }

    if (approve) {
      console.log(`[approveWithdrawal] Processing approval...`);
      
      // Get bank code with error handling
      let bankCode;
      try {
        bankCode = await getBankCode(transaction.bank_name);
        console.log(`[approveWithdrawal] Bank code retrieved: ${bankCode} for ${transaction.bank_name}`);
      } catch (bankError) {
        console.error(`[approveWithdrawal] Failed to get bank code:`, bankError.message);
        throw new Error(`Failed to get bank code: ${bankError.message}`);
      }

      // Calculate net payout (amount - 9%)
      const grossAmount = Number(transaction.amount);
      const netAmount = Math.round(grossAmount * 0.91 * 100) / 100; // Round to 2 decimal places
      console.log(`[approveWithdrawal] Gross amount: ₦${grossAmount}, Net payout: ₦${netAmount} (9% fee deducted)`);

      const payload = {
        account_bank: bankCode, 
        account_number: transaction.account_number,
        amount: netAmount, // Use net amount (after 9% deduction)
        currency: "NGN",
        narration: "JJB24 Wallet Withdrawal",
        reference: transaction.reference,
      };

      console.log(`[approveWithdrawal] Flutterwave payload:`, payload);

      try {
        const response = await axios.post(`${FLW_BASE_URL}/transfers`, payload, {
          headers: {
            Authorization: `Bearer ${FLW_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        });

        console.log("[approveWithdrawal] Flutterwave response:", JSON.stringify(response.data, null, 2));

        if (response.data.status === "success") {
          await updateTransactionStatus(reference, "success");
          console.log(`[approveWithdrawal] ✅ Withdrawal approved and sent to ${transaction.account_name} (${transaction.account_number})`);
          return {
            message: `Withdrawal approved & sent. Net payout: ₦${netAmount.toLocaleString()}`,
            transactionRef: reference,
            grossAmount: grossAmount,
            netAmount: netAmount,
          };
        } else {
          console.error("[approveWithdrawal] Flutterwave returned non-success status:", response.data);
          const errorMsg = response.data.message || "Bank transfer failed at Flutterwave";
          throw new Error(errorMsg);
        }
      } catch (error) {
        console.error("[approveWithdrawal] Flutterwave API error:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          statusText: error.response?.statusText
        });
        
        const errorMessage = error.response?.data?.message || error.message || "Flutterwave transfer failed";
        
        // Provide specific guidance for common Flutterwave errors
        let detailedError = errorMessage;
        if (errorMessage.toLowerCase().includes("cannot be processed") || 
            errorMessage.toLowerCase().includes("contact your account administrator")) {
          console.error("[approveWithdrawal] ⚠️ FLUTTERWAVE ACCOUNT CONFIGURATION ISSUE DETECTED");
          console.error("[approveWithdrawal] This error typically means:");
          console.error("[approveWithdrawal] 1. IP Whitelisting: Server IP not whitelisted in Flutterwave dashboard");
          console.error("[approveWithdrawal] 2. Account Verification: KYC/Compliance not fully approved");
          console.error("[approveWithdrawal] 3. Transfer Permissions: Bank transfers not enabled for account");
          console.error("[approveWithdrawal] 4. Insufficient Balance: Flutterwave account balance too low");
          console.error("[approveWithdrawal] Transfer Details:", {
            amount: netAmount,
            bank: transaction.bank_name,
            bankCode: bankCode,
            accountNumber: transaction.account_number,
            reference: transaction.reference
          });
          
          detailedError = `${errorMessage}. Please check Flutterwave dashboard: IP whitelist, account verification (KYC), transfer permissions, and account balance. Contact Flutterwave support (hi@flutterwavego.com) if issue persists.`;
        }
        
        throw new Error(detailedError);
      }
    } else {
      console.log(`[approveWithdrawal] Processing rejection...`);
      const refundBalance = Number(user.balance) + Number(transaction.amount);
      await updateUserBalance(user.id, refundBalance);
      await updateTransactionStatus(reference, "failed");
      console.log(`[approveWithdrawal] ✅ Withdrawal rejected. Balance refunded to user.`);

    return {
        message: `Withdrawal rejected`,
      transactionRef: reference,
    };
    }
  } catch (error) {
    console.error(`[approveWithdrawal] Error processing withdrawal:`, error);
    throw new Error(`Error processing withdrawal: ${error.message}`);
  }
};


//Convert bank name to bank code using Flutterwave API
const getBankCode = async (bankName) => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  if (Object.keys(bankCodeCache).length === 0 || now - lastFetched > oneDay) {
    const response = await axios.get(`${FLW_BASE_URL}/banks/NG`, {
      headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` },
    });

    bankCodeCache = {};
    response.data.data.forEach((bank) => {
      bankCodeCache[bank.name.toLowerCase()] = bank.code;
    });
    lastFetched = now;
  }

  let code = bankCodeCache[bankName.toLowerCase()];
  if (!code) {
    const matchedBank = Object.keys(bankCodeCache).find((name) =>
      name.includes(bankName.toLowerCase())
    );
    if (matchedBank) code = bankCodeCache[matchedBank];
  }

  if (!code) throw new Error(`Bank code not found for: ${bankName}`);
  return code;
};



//Get all transactions for a specific user (unified history including investments, ROI, and referral bonuses)
export const getUserTransactions = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  // Get all transactions (deposits, withdrawals, investments, ROI, referral bonuses)
  const transactions = await getAllTransactionsByUserId(userId);
   
  // Format transactions with readable descriptions
  const formattedTransactions = transactions.map(tx => {
    let description = '';
    let activityType = tx.type;
    
    switch(tx.type) {
      case 'deposit':
        description = `Deposit of ₦${Number(tx.amount).toLocaleString()}`;
        break;
      case 'withdrawal':
        description = `Withdrawal of ₦${Number(tx.amount).toLocaleString()}${tx.status === 'pending' ? ' (Pending)' : tx.status === 'success' ? ' (Approved)' : ' (Failed)'}`;
        break;
      case 'investment':
        description = `Investment of ₦${Number(tx.amount).toLocaleString()}`;
        break;
      case 'investment_roi':
        description = `Daily Investment ROI: ₦${Number(tx.amount).toLocaleString()}`;
        activityType = 'earning';
        break;
      case 'referral_bonus':
        description = `Referral Commission: ₦${Number(tx.amount).toLocaleString()}`;
        activityType = 'earning';
        break;
      default:
        description = `${tx.type}: ₦${Number(tx.amount).toLocaleString()}`;
    }
    
    return {
      ...tx,
      amount: Number(tx.amount),
      description,
      activityType,
      date: tx.created_at
    };
  });
   
  return {
    message: "Transactions retrieved successfully",
    transactions: formattedTransactions,
    totalCount: formattedTransactions.length
  };
};

//Get withdrawal transactions for a specific user
export const getUserWithdrawalTransactions = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  const transactions = await getWithdrawalTransactionsByUserId(userId);
   
  return {
    message: "Withdrawal transactions retrieved successfully",
    transactions,
    totalCount: transactions.length
  };
};

//Get deposit transactions for a specific user
export const getUserDepositTransactions = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  const transactions = await getDepositTransactionsByUserId(userId);
   
  return {
    message: "Deposit transactions retrieved successfully",
    transactions,
    totalCount: transactions.length
  };
};

// Get pending withdrawals for admin
export const getPendingWithdrawalsForAdmin = async () => {
  const withdrawals = await getPendingWithdrawals();
  return {
    message: "Pending withdrawals retrieved successfully",
    withdrawals,
    totalCount: withdrawals.length
  };
};
