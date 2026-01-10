import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import pool from "./src/config/database.js";
import { findUserByEmail } from "./src/repositories/userRepository.js";

dotenv.config(); 

const SALT_ROUNDS = 10;

export const permanentAdmin = async () => {
  try {
    // 1. Use the actual Peter/Josh admin email
    const email = 'peterweistley@gmail.com';
    // 2. We use the password we agreed on
    const plainPassword = 'Peter@2026';

    console.log(`[seedAdmin] Checking if ${email} is an admin...`);

    const user = await findUserByEmail(email);

    if (user) {
      // If he exists but isn't an admin, promote him
      if (!user.is_admin) {
        await pool.query('UPDATE users SET is_admin = true WHERE email = $1', [email]);
        console.log(`[seedAdmin] User ${email} promoted to Admin.`);
      }
      
      // Update his password to the official one to ensure no mismatch
      const newHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
      await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [newHash, email]);
      console.log(`[seedAdmin] Password sync complete for ${email}.`);
      
    } else {
      // If he doesn't exist at all (unlikely), create him
      const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);
      const query = `
        INSERT INTO users (full_name, email, phone_number, password_hash, is_admin, balance)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      await pool.query(query, ['Admin Josh', email, '09039917010', hashedPassword, true, 0]);
      console.log("[seedAdmin] Permanent admin created from scratch.");
    }

  } catch (err) {
    console.error("Error in permanentAdmin sync:", err.message);
  }
};
