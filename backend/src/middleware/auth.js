'use strict';
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'healthbridge-dev-secret-change-in-production';

// ── protect — verify JWT and attach req.user ──────────────────────────────────
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated — please sign in' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found — please sign in again' });
    }

    if (user.isActive === false && user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Account disabled — contact support' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired — please sign in again' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token — please sign in again' });
  }
};

// ── authorize — check role ────────────────────────────────────────────────────
exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (roles.length > 0 && !roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `This route requires role: ${roles.join(' or ')}. You are: ${req.user.role}`,
    });
  }
  next();
};