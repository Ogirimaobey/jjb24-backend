import dotenv from "dotenv";
import bcrypt from "bcryptjs"; // CHANGED FROM 'bcrypt' TO 'bcryptjs'
import { insertAdmin, findAdminByEmail } from "./src/repositories/adminRepository.js";

dotenv.config(); 

const SALT_ROUNDS = 10;

export const permanentAdmin = async () => {
  try {
    // We use the env variables, but add a fallback to prevent the "Not set in env" error from stopping the server
    const email = process.env.ADMIN_EMAIL || 'admin@jjb24.com';
    const plainPassword = process.env.ADMIN_PASSWORD || 'admin1234';

    if (!email || !plainPassword) {
      console.warn("[seedAdmin] ADMIN_EMAIL or ADMIN_PASSWORD not set. Using defaults.");
    }

    const existingAdmin = await findAdminByEmail(email);
    if (existingAdmin) {
      console.log("Permanent admin already exists. Skipping creation.");
      return;
    }

    const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

    await insertAdmin({
      email,
      password: hashedPassword,
      isAdmin: true
    });

    console.log("Permanent admin created successfully.");

  } catch (err) {
    console.error("Error creating permanent admin:", err.message);
  }
};
