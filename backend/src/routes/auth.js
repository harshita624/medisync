'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');

// FIX: the GoogleStrategy used to be defined inline in this file AND
// separately in config/passport.js. Two `passport.use(new GoogleStrategy(...))`
// calls register under the same strategy name ('google'), so the second one
// to load silently replaces the first — whichever this file's require()
// order put last won, and the other's logic (including role handling) never
// ran. The strategy now lives in exactly one place: config/passport.js,
// required once from server.js before any routes are mounted. This file only
// uses `passport.authenticate('google', ...)`, it doesn't define the strategy.
require('../config/passport');

const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const generateToken = require('../utils/generateToken');
const audit = require('../utils/audit');

const ROLE_LABELS = {
  patient: 'Patient',
  doctor: 'Doctor',
  insurance: 'Insurance Provider',
};

// ── POST /api/auth/register ───────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      specialization,
      hospital,
      licenseNumber,
      department,
      phone,
      companyName,
      insuranceLicense,
    } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedName = String(name || '').trim();
    const normalizedRole = String(role || 'patient').trim().toLowerCase();

    if (!normalizedName || !normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    if (!['patient', 'doctor', 'insurance'].includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role',
      });
    }

    const exists = await User.findOne({
      email: normalizedEmail,
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: normalizedRole,
      // FIX: phone was collected on the register form for doctor/insurance
      // but never saved anywhere (not here, not on the Doctor sub-document).
      // Save it on the User record for every role.
      phone: phone || '',
      isVerified: normalizedRole === 'patient',
    });

    // Create role-specific profile.
    if (user.role === 'patient') {
      await Patient.create({
        user: user._id,
      });
    }

    if (user.role === 'doctor') {
      await Doctor.create({
        user: user._id,
        specialization: specialization || 'General Physician',
        hospital:
          hospital ||
          'Dana Shivam Heart & Super Speciality Hospital',
        licenseNumber: licenseNumber || '',
        department: department || '',
        isVerified: false,
        isAvailable: false,
      });
    }

    // FIX: registering as 'insurance' created a bare User with no profile
    // at all — companyName/insuranceLicense were collected on the frontend
    // and then silently dropped, because there was no matching branch here
    // and no Insurance model wired up. There's no Insurance model in the
    // files you shared, so this can't be fully fixed without it — for now
    // this at least stops it from failing silently unnoticed:
    if (user.role === 'insurance' && (!companyName || !insuranceLicense)) {
      console.warn(
        `[REGISTER] insurance user ${user._id} created without ` +
          'companyName/insuranceLicense — no Insurance model exists yet ' +
          'to persist them.'
      );
    }

    const token = generateToken(user._id);

    await audit(req, {
      action: 'user_register',
      targetType: 'User',
      targetId: user._id,
      metadata: {
        role: user.role,
      },
    });

    return res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('[REGISTER ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Registration failed',
    });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();

    const password = String(req.body.password || '');

    const selectedRole = req.body.role
      ? String(req.body.role).trim().toLowerCase()
      : null;

    // Validate input.
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user using normalized email.
    const user = await User.findOne({
      email,
    }).select('+password');

    if (!user) {
      console.log(`[LOGIN] User not found: ${email}`);

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Google-created accounts may not have a usable password.
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message:
          'This account does not have a password. Please use Google Sign-In.',
      });
    }

    // Compare entered password with stored bcrypt hash.
    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      console.log(`[LOGIN] Password mismatch: ${email}`);

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Normalize database role.
    const actualRole = String(user.role || 'patient')
      .trim()
      .toLowerCase();

    // Check selected role only if frontend sends one.
    if (selectedRole && selectedRole !== actualRole) {
      const actualLabel =
        ROLE_LABELS[actualRole] || actualRole;

      return res.status(403).json({
        success: false,
        message: `This email is registered as a ${actualLabel} account. Please select the "${actualLabel}" tab and sign in again.`,
      });
    }

    // Generate JWT.
    const token = generateToken(user._id);

    // Update last login.
    user.lastLogin = new Date();
    await user.save();

    // Audit login.
    await audit(req, {
      action: 'user_login',
      targetType: 'User',
      targetId: user._id,
    });

    console.log(
      `[LOGIN] Successful login: ${email} (${actualRole})`
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: actualRole,
        isVerified: user.isVerified,
        avatar: user.avatar,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error('[LOGIN ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
    });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error('[GET ME ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
    });
  }
});

// ── PUT /api/auth/update-profile ──────────────────────────────────────────────

router.put('/update-profile', protect, async (req, res) => {
  try {
    const allowed = [
      'name',
      'phone',
      'avatar',
      'address',
    ];

    const updates = {};

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('[UPDATE PROFILE ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
});

// ── PUT /api/auth/change-password ─────────────────────────────────────────────

router.put('/change-password', protect, async (req, res) => {
  try {
    const {
      currentPassword,
      newPassword,
    } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message:
          'Current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          'New password must be at least 6 characters',
      });
    }

    const user = await User.findById(req.user._id)
      .select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message:
          'This account does not have a password. Please set a password first.',
      });
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);

    await user.save();

    return res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('[CHANGE PASSWORD ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to change password',
    });
  }
});

// ── Google OAuth routes ───────────────────────────────────────────────────────

router.get(
  '/google',
  (req, res, next) => {
    // FIX: the frontend calls /api/auth/google?role=doctor (see LoginPage's
    // handleGoogle), but that ?role= was never read here, so it never made
    // it into the OAuth round-trip. passport-google-oauth20 round-trips
    // whatever you pass as `state` — Google hands it straight back on the
    // callback as req.query.state, which is exactly what config/passport.js
    // reads to decide the role for a new signup. Without this, every Google
    // signup fell back to the strategy's default ('patient').
    const role = ['patient', 'doctor', 'insurance'].includes(
      String(req.query.role || '').toLowerCase()
    )
      ? String(req.query.role).toLowerCase()
      : 'patient';

    passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false,
      state: role,
    })(req, res, next);
  }
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${
      process.env.FRONTEND_URL || 'http://localhost:3000'
    }/login?error=oauth_failed`,
  }),
  async (req, res) => {
    try {
      const token = generateToken(req.user._id);

      return res.redirect(
        `${
          process.env.FRONTEND_URL || 'http://localhost:3000'
        }/auth/callback?token=${token}`
      );
    } catch (error) {
      console.error('[GOOGLE CALLBACK ERROR]', error);

      return res.redirect(
        `${
          process.env.FRONTEND_URL || 'http://localhost:3000'
        }/login?error=oauth_failed`
      );
    }
  }
);

module.exports = router;