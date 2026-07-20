'use strict';
const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET  || 'healthbridge-dev-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '30d';

module.exports = function generateToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
};