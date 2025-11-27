import axios from "axios";
import dotenv from "dotenv";
import { createTransaction, findTransactionByReference, updateTransactionStatus, createWithdrawalTransaction, getAllTransactionsByUserId, getWithdrawalTransactionsByUserId, getDepositTransactionsByUserId, getPendingWithdrawals } from "../repositories/transactionRepository.js";
import { findUserById, updateUserBalance } from "../repositories/userRepository.js";

dotenv.config();

const FLW_BASE_URL = process.env.FLW_BASE_URL;
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;

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
  const transaction = await createTransaction(userId, amount, reference);

  const payload = {
    tx_ref: reference,
    amount,
    currency: "NGN",
    redirect_url: "https://jjbwines.com/#home",
    customer: {
      email,
      phonenumber: phone,
    },
    customizations: {
      title: "JJB24 Deposit",
      description: "Wallet funding via Flutterwave",
    },
  };

  const response = await axios.post(`${FLW_BASE_URL}/payments`, payload, {
    headers: {
      Authorization: `Bearer ${FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  });
  return {
    paymentLink: response.data.data.link,
    reference,
    transaction,
  };
};

// Verify payment and update user balance
export const verifyPayment = async (event) => {
  try {
    // STEP 1: Raw webhook payload
    console.log("=== Webhook event received ===");
    console.log(JSON.stringify(event, null, 2));

    // STEP 2: Validate payload
    if (!event || !event.data) {
      console.error(" Invalid webhook payload:", event);
      return { success: false, message: "Invalid webhook payload" };
    }

    // STEP 3: Extract fields
    const { tx_ref, status, amount } = event.data;
    console.log("Extracted fields:", { tx_ref, status, amount });
    console.log("Event type:", event.event);

    // STEP 4: Transaction lookup
    const transaction = await findTransactionByReference(tx_ref);
    if (!transaction) {
      console.error(" Transaction not found for tx_ref:", tx_ref);
      return { success: false, message: "Transaction not found" };
    }
    console.log("Transaction found:", transaction);

    // STEP 5: Check event type + status
    const validSuccessEvents = [
      "successful",
      "transfer.completed",
      "payment.completed",
      "charge.completed",
      "payment.success",
      "transfer.success",
    ];

    if (validSuccessEvents.includes(status) || validSuccessEvents.includes(event.event)) {
      console.log("✅ Payment marked successful for tx_ref:", tx_ref);

      await updateTransactionStatus(tx_ref, "success");

      // STEP 6: User lookup
      const user = await findUserById(transaction.user_id);
      if (!user) {
        console.error("❌ User not found for transaction:", transaction);
        return { success: false, message: "User not found" };
      }
      console.log("User found:", user);

      // STEP 7: Balance update
      const newBalance = Number(user.balance) + Number(amount);
      console.log("Updating balance:", {
        oldBalance: user.balance,
        depositAmount: amount,
        newBalance,
      });

      await updateUserBalance(user.id, newBalance);
    } else if (status === "failed") {
      console.log("❌ Payment failed for tx_ref:", tx_ref);
      await updateTransactionStatus(tx_ref, "failed");
    } else {
      console.warn("⚠ Unhandled event/status:", { status, event: event.event });
    }

    // STEP 8: Final response
    console.log("=== Webhook processing complete for tx_ref:", tx_ref, "===");
    return { success: true, message: "Transaction verified and balance updated" };

  } catch (err) {
    console.error("❌ Webhook error:", err.message, err.stack);
    return { success: false, message: "Internal error during webhook processing" };
  }
};

// User initiates withdrawal 
export const requestWithdrawal = async (userId, amount, bankName, accountNumber, accountName) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

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

  const newBalance = Number(user.balance) - Number(amount);
  await updateUserBalance(userId, newBalance);

  return {
    message: "Withdrawal request submitted and pending approval.",
    transaction,
  };
};


// Admin approves or rejects withdrawal
export const approveWithdrawal = async (reference, approve = true) => {
  const transaction = await findTransactionByReference(reference);
  if (!transaction) throw new Error("Transaction not found");

  if (transaction.status !== "pending") throw new Error("Already proccessed");

  const user = await findUserById(transaction.user_id);
  if (!user) throw new Error("User not found");

  const bankCode = await getBankCode(transaction.bank_name);

  try {
    if (approve) {
      const payload = {
        account_bank: bankCode, 
        account_number: transaction.account_number,
        amount: transaction.amount,
        currency: "NGN",
        narration: "JJB24 Wallet Withdrawal",
        reference: transaction.reference,
      };

      try {
        const response = await axios.post(`${FLW_BASE_URL}/transfers`, payload, {
          headers: {
            Authorization: `Bearer ${FLW_SECRET_KEY}`,
          },
        });

        console.log("Flutterwave response:", response.data);

        if (response.data.status === "success") {
          await updateTransactionStatus(reference, "success");
          console.log(`Withdrawal sent to ${transaction.account_name} (${transaction.account_number})`);
        } else {
          throw new Error("Bank transfer failed at Flutterwave");
        }
      } catch (error) {
        console.error(
          "Flutterwave error:",
          error.response?.data || error.message
        );
        throw new Error(
          error.response?.data?.message || "Flutterwave transfer failed"
        );
      }
    } else {
      const refundBalance = Number(user.balance) + Number(transaction.amount);
      await updateUserBalance(user.id, refundBalance);
      await updateTransactionStatus(reference, "failed");
    }

    return {
      message: `Withdrawal ${approve ? "approved & sent" : "rejected"}`,
      transactionRef: reference,
    };
  } catch (error) {
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



//Get all transactions for a specific user
export const getUserTransactions = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  const transactions = await getAllTransactionsByUserId(userId);
  
  return {
    message: "Transactions retrieved successfully",
    transactions,
    totalCount: transactions.length
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
