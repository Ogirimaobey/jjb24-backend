import axios from "axios";
import dotenv from "dotenv";
import { createTransaction, findTransactionByReference, updateTransactionStatus, createWithdrawal, getUserTransactions as getUserTransactionsFromRepo } from "../repositories/transactionRepository.js";
import { findUserById, updateUserBalance } from "../repositories/userRepository.js";


dotenv.config();

const FLW_BASE_URL = process.env.FLW_BASE_URL;
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;

/** Initialize a Flutterwave payment */
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
    redirect_url: "https://flutterwave.com/ng/",
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

// Verify payment via Flutterwave webhook
export const verifyPayment = async (req, secretHashFromEnv) => {
  const flwSignature = req.headers["verif-hash"];
  if (!flwSignature || flwSignature !== secretHashFromEnv) {
    throw new Error("Invalid Flutterwave signature");
  }

  const event = req.body;
  const { tx_ref, status, amount } = event.data;

  const transaction = await findTransactionByReference(tx_ref);
  if (!transaction) throw new Error("Transaction not found");

  if (status === "successful") {
    await updateTransactionStatus(tx_ref, "success");

    const user = await findUserById(transaction.user_id);
    const newBalance = Number(user.balance) + Number(amount);
    await updateUserBalance(user.id, newBalance);

    console.log(`💰 Wallet credited: User ${user.id} new balance = ₦${newBalance}`);
  } 

  else if (status === "failed") {
    await updateTransactionStatus(tx_ref, "failed");
  }

  return { success: true, message: "Transaction verified and balance updated" };
};

/** Place withdrawal */
export const requestWithdrawal = async (userId, amount) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");
  if (user.balance < amount) throw new Error("Insufficient balance");

  const reference = `WD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const withdrawal = await createWithdrawal(userId, amount, reference);

  const newBalance = Number(user.balance) - Number(amount);
  await updateUserBalance(userId, newBalance);

  return {
    message: "Withdrawal request submitted and pending admin approval",
    withdrawal,
  };
};

// Admin approves or rejects withdrawal
export const approveWithdrawal = async (reference, approve = true) => {
  const transaction = await findTransactionByReference(reference);
  if (!transaction) throw new Error("Transaction not found");
  if (transaction.status !== "pending") throw new Error("Transaction already processed");

  const user = await findUserById(transaction.user_id);
  if (!user) throw new Error("User not found");

  const status = approve ? "success" : "failed";
  await updateTransactionStatus(reference, status);

  if (approve) {
    console.log(` Withdrawal approved for User ${user.id}, amount ₦${transaction.amount}`);
  } 
  else {
    const refundBalance = Number(user.balance) + Number(transaction.amount);
    await updateUserBalance(user.id, refundBalance);
    console.log(`Withdrawal rejected, ₦${transaction.amount} refunded to user ${user.id}`);
  }

  return {
    message: `Withdrawal ${approve ? "approved" : "rejected"}`,
    transactionRef: reference,
  };
};

export const getUserTransactions = async (userId) => {
  const transactions = await getUserTransactionsFromRepo(userId);
  return {
    success: true,
    transactions,
    count: transactions.length
  };
};
