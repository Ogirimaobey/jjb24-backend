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

// =========================================================================
// SECTION 1: MANUAL DEPOSIT SYSTEM (RECEIPT UPLOAD)
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
// SECTION 2: WITHDRAWAL MANAGEMENT (MANUAL CONFIRMATION SYSTEM)
// =========================================================================

/**
 * USER ACTION: Request a payout.
 * Money is deducted from balance immediately and held in 'pending' status.
 */
export const requestWithdrawal = async (userId, amount, bankName, accountNumber, accountName) => {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");
  
  if (Number(amount) < 800) throw new Error("Minimum withdrawal amount is ₦800");
  if (Number(user.balance) < Number(amount)) throw new Error("Insufficient balance");

  const reference = `WD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const transaction = await createWithdrawalTransaction(userId, amount, reference, bankName, accountNumber, accountName);

  // Debit User Immediately
  const newBalance = Number(user.balance) - Number(amount);
  await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, userId]);

  return { message: "Withdrawal request submitted for review.", transaction };
};

/**
 * ADMIN ACTION: Confirm a manual payment.
 * Peter pays the user via bank app, then clicks 'Approve' to finalize the record.
 */
export const approveWithdrawal = async (reference) => {
  console.log(`[Manual Approval] Peter is confirming payout for: ${reference}`);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const transaction = await findTransactionByReference(reference);
    if (!transaction) throw new Error("Transaction not found in database.");
    if (transaction.status !== "pending") throw new Error("This transaction has already been processed.");

    // Update the record to success
    await client.query('UPDATE transactions SET status = $1 WHERE reference = $2', ['success', reference]);
    
    await client.query('COMMIT');
    return { 
      success: true, 
      message: "Withdrawal successfully marked as PAID in system." 
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Manual Approval Error]:`, error.message);
    throw new Error(`Approval Error: ${error.message}`);
  } finally {
    client.release();
  }
};

/**
 * ADMIN ACTION: Reject and Refund.
 * Peter denies the request and the system returns the ₦ to the user's wallet.
 */
export const rejectWithdrawal = async (reference) => {
  console.log(`[Manual Rejection] Peter is rejecting: ${reference}`);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const transaction = await findTransactionByReference(reference);
    if (!transaction) throw new Error("Transaction not found");
    if (transaction.status !== "pending") throw new Error("Transaction is no longer pending.");

    const user = await findUserById(transaction.user_id);
    if (!user) throw new Error("User not found");

    // Refund the user's balance
    const refundBalance = Number(user.balance) + Number(transaction.amount);
    await client.query('UPDATE users SET balance = $1 WHERE id = $2', [refundBalance, user.id]);
    
    // Mark transaction as failed/rejected
    await client.query('UPDATE transactions SET status = $1 WHERE reference = $2', ['failed', reference]);
    
    await client.query('COMMIT');
    return { success: true, message: `Withdrawal rejected and user refunded` };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// =========================================================================
// SECTION 3: DATA GETTERS (HISTORY & ADMIN)
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
