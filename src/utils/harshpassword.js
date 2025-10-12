// const bcrypt = require('bcrypt');
// const jwt = require('jsonwebtoken');

// const saltRounds = 10;
// const JWT_SECRET = 'your_super_secret_jwt_key_that_is_long_and_random';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export const hashPassword = async (plainPassword) => {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
};

export const comparePasswords = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};
