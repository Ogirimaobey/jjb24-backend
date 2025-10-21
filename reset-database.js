import pool from "./src/config/database.js";

const resetTables = async () => {
  try {
    await pool.query("TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;");
    await pool.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE;");
    await pool.query("TRUNCATE TABLE daily_tasks RESTART IDENTITY CASCADE;");
    await pool.query("TRUNCATE TABLE investments RESTART IDENTITY CASCADE;");
    console.log("All tables has been cleared successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error clearing tables:", error.message);
    process.exit(1);
  }
};

resetTables();
