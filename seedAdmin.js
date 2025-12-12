import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { insertAdmin, findAdminByEmail } from "./src/repositories/adminRepository.js";

dotenv.config(); 

const SALT_ROUNDS = 10;

export const permanentAdmin = async () => {
  try {
    const email = process.env.ADMIN_EMAIL;
    const plainPassword = process.env.ADMIN_PASSWORD;

    if (!email || !plainPassword) {
      throw new Error("ADMIN_EMAIL or ADMIN_PASSWORD not set in env");
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
