import axios from "axios";
import dotenv from "dotenv";
import { createTransaction, findTransactionByReference, updateTransactionStatus, createWithdrawal } from "../repositories/transactionRepository.js";
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
  console.log("Received event:", event.event, "Status:", status);

  const transaction = await findTransactionByReference(tx_ref);
  if (!transaction) throw new Error("Transaction not found");

   if (
    status === "successful" ||
    event.event === "transfer.completed" ||
    event.event === "payment.completed" ||
    event.event === "charge.completed" ||
    event.event === "payment.success" ||
    event.event === "transfer.success"
  ) {
    await updateTransactionStatus(tx_ref, "success");

    const user = await findUserById(transaction.user_id);
    const newBalance = Number(user.balance) + Number(amount);
    await updateUserBalance(user.id, newBalance);

    // console.log(`Wallet credited: User ${user.id} new balance = ₦${newBalance}`);
  } 

  else if (status === "failed") {
    await updateTransactionStatus(tx_ref, "failed");
  }

  return { success: true, message: "Transaction verified and balance updated" };
};

/** Place withdrawal */
// export const requestWithdrawal = async (userId, amount) => {
//   const user = await findUserById(userId);
//   if (!user) throw new Error("User not found");
//   if (user.balance < amount) throw new Error("Insufficient balance");

//   const reference = `WD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
//   const withdrawal = await createWithdrawal(userId, amount, reference);

//   const newBalance = Number(user.balance) - Number(amount);
//   await updateUserBalance(userId, newBalance);

//   return {
//     message: "Withdrawal request submitted and pending admin approval",
//     withdrawal,
//   };
// };


// User initiates withdrawal 
export const requestWithdrawal = async (userId, amount, bankName, accountNumber, accountName) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  if (Number(user.balance) < Number(amount)) {
    throw new Error("Insufficient balance");
  }

  const reference = `WD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const transaction = await createTransaction(userId, amount, reference, "pending", bankName, accountNumber, accountName);

  const newBalance = Number(user.balance) - Number(amount);
  await updateUserBalance(userId, newBalance);

  return {
    message: "Withdrawal request submitted and pending approval.",
    transaction,
  };
};

// Admin approves or rejects withdrawal
// export const approveWithdrawal = async (reference, approve = true) => {
//   const transaction = await findTransactionByReference(reference);
//   if (!transaction) throw new Error("Transaction not found");
//   if (transaction.status !== "pending") throw new Error("Transaction already processed");

//   const user = await findUserById(transaction.user_id);
//   if (!user) throw new Error("User not found");

//   const status = approve ? "success" : "failed";
//   await updateTransactionStatus(reference, status);

//   if (approve) {
//     console.log(` Withdrawal approved for User ${user.id}, amount ₦${transaction.amount}`);
//   } 
//   else {
//     const refundBalance = Number(user.balance) + Number(transaction.amount);
//     await updateUserBalance(user.id, refundBalance);
//     console.log(`Withdrawal rejected, ₦${transaction.amount} refunded to user ${user.id}`);
//   }

//   return {
//     message: `Withdrawal ${approve ? "approved" : "rejected"}`,
//     transactionRef: reference,
//   };
// };

//Admin approves or reject withdrawal
export const approveWithdrawal = async (reference, approve = true) => {
  const transaction = await findTransactionByReference(reference);
  if (!transaction) throw new Error("Transaction not found");

  if (transaction.status !== "pending") throw new Error("Already processed");

  const user = await findUserById(transaction.user_id);
  if (!user) throw new Error("User not found");

  if (approve) {
    const payload = {
      account_bank: transaction.bank_name,
      account_number: transaction.account_number,
      amount: transaction.amount,
      currency: "NGN",
      narration: "JJB24 Wallet Withdrawal",
      reference: transaction.reference,
    };

    const response = await axios.post(`${FLW_BASE_URL}/transfers`, payload, {
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
      },
    });

    if (response.data.status === "success") {
      await updateTransactionStatus(reference, "success");
      console.log(`Withdrawal sent to ${transaction.account_name} (${transaction.account_number})`);
    } else {
      throw new Error("Bank transfer failed at Flutterwave");
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
};