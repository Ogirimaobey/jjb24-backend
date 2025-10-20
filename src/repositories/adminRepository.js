import pool from "../config/database.js";

export const insertAdmin = async ({ email, password, isAdmin = true }) => {
  const query = `
    INSERT INTO admin (email, password, is_admin)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [email, password, isAdmin]);
  return rows[0];
};

export const findAdminByEmail = async (email) => {
  const query = `SELECT * FROM admin WHERE email = $1`;
  const { rows } = await pool.query(query, [email]);
  return rows[0];
};
