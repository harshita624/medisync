'use strict';
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'healthbridge-dev-secret-change-in-production');
const JWT_EXPIRES = process.env.JWT_EXPIRES || process.env.JWT_EXPIRE || '30d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

module.exports = function generateToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
};
