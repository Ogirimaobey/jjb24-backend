import axios from "axios";
import dotenv from "dotenv";
import { createTransaction, findTransactionByReference, updateTransactionStatus } from "../repositories/transactionRepository.js";
import { findUserById, getUserBalance } from "../repositories/userRepository.js";
dotenv.config();

const FLW_BASE_URL = process.env.FLW_BASE_URL;
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;

/** Initialize a Flutterwave payment */
export const initializePayment = async (userId, amount, email, phone) => {
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

/** Verify payment via Flutterwave webhook */
export const verifyPayment = async (reqBody, secretHashFromEnv) => {
  const flwSignature = reqBody?.headers?.["verif-hash"];
  if (!flwSignature || flwSignature !== secretHashFromEnv) {
    throw new Error("Invalid Flutterwave signature");
  }

  const event = reqBody.body;
  const { tx_ref, status } = event.data;

  const transaction = await findTransactionByReference(tx_ref);
  if (!transaction) throw new Error("Transaction not found");

  if (status === "successful") {
    await updateTransactionStatus(tx_ref, "success");
  } else if (status === "failed") {
    await updateTransactionStatus(tx_ref, "failed");
  }

  return { success: true, message: "Transaction verified" };
};

export const getBalance = async (user) => {
  const userId = user;
  try {
    const fullUser = await findUserById(userId); //find the user in db
    if (!fullUser) {
      throw new Error('User not found');
    }
    console.log('User found for balance:', fullUser.fullName);

    const balance = await getUserBalance(userId);
    if (balance === null) {
      throw new Error('User not found');
    }
    return balance; 
  } catch (error) {
    console.error('Error in getBalance:', error);
    if (error.message.includes('not found')) {
      throw new Error('User not found');
    }
    throw new Error('Failed to retrieve balance');
  }
};