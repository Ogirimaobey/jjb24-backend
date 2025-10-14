import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { insertAdmin, findAdminByEmail } from "../repositories/adminRepository.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined in environment variables");

const SALT_ROUNDS = 10;

/**Register Admin */
export const registerAdmin = async (email, password) => {
  const existingAdmin = await findAdminByEmail(email);
  if (existingAdmin) throw new Error("Admin with this email already exists");

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const admin = await insertAdmin({
    email,
    password: hashedPassword,
    isAdmin: true
  });

  return {
    message: "Admin registered successfully",
    admin: {
      id: admin.id,
      email: admin.email,
      is_admin: admin.is_admin
    }
  };
};

/**Login Admin */
export const loginAdmin = async (email, password) => {
  const admin = await findAdminByEmail(email);
  if (!admin) throw new Error("Invalid email or password");

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) throw new Error("Invalid email or password");

  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: "admin" },
    JWT_SECRET,
    { expiresIn: "1d" }
  );

  return {
    message: "Login successful",
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      is_admin: admin.is_admin
    }
  };
};
