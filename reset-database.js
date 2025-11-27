// import pool from "./src/config/database.js";

// const resetTables = async () => {
//   try {
//     await pool.query("TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;");
//     await pool.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE;");
//     await pool.query("TRUNCATE TABLE daily_tasks RESTART IDENTITY CASCADE;");
//     await pool.query("TRUNCATE TABLE investments RESTART IDENTITY CASCADE;");
//     console.log("All tables has been cleared successfully.");
//     process.exit(0);
//   } catch (error) {
//     console.error("Error clearing tables:", error.message);
//     process.exit(1);
//   }
// };

// resetTables();


import pool from "./src/config/database.js";

const resetTables = async () => {
  try {
    await pool.query("TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;");
    await pool.query("TRUNCATE TABLE daily_tasks RESTART IDENTITY CASCADE;");
    await pool.query("TRUNCATE TABLE investments RESTART IDENTITY CASCADE;");

    await pool.query(`
      DELETE FROM users
      WHERE email <> 'olaleyebabatun@gmail.com';
    `);

    await pool.query(`
      SELECT setval(
        pg_get_serial_sequence('users', 'id'),
        COALESCE((SELECT MAX(id) FROM users), 1),
        true
      );
    `);

    console.log("Database reset successfully — except user Babatunde.");
    process.exit(0);
  } catch (error) {
    console.error("Error resetting database:", error.message);
    process.exit(1);
  }
};

resetTables();
