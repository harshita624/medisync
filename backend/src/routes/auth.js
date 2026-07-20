'use strict';
const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const passport   = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { protect }= require('../middleware/auth');
const User       = require('../models/User');
const Doctor     = require('../models/Doctor');
const Patient    = require('../models/Patient');
const generateToken = require('../utils/generateToken');
const audit      = require('../utils/audit');

const ROLE_LABELS = {
  patient:   'Patient',
  doctor:    'Doctor',
  insurance: 'Insurance Provider',
};

// ── Google OAuth ──────────────────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  `${process.env.API_URL || 'http://localhost:5000'}/api/auth/google/callback`,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ email: profile.emails[0].value });
      if (!user) {
        user = await User.create({
          name:     profile.displayName,
          email:    profile.emails[0].value,
          avatar:   profile.photos[0]?.value,
          googleId: profile.id,
          password: await bcrypt.hash(require('crypto').randomBytes(20).toString('hex'), 10),
          role:     'patient',
          isVerified: true,
        });
        await Patient.create({ user: user._id });
      }
      done(null, user);
    } catch (e) { done(e); }
  }));
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, specialization, hospital, licenseNumber, department } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'name, email and password are required' });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    if (!['patient','doctor','insurance'].includes(role || 'patient'))
      return res.status(400).json({ success: false, message: 'Invalid role' });

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ success: false, message: 'An account with this email already exists' });

    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({
      name:       name.trim(),
      email:      email.toLowerCase().trim(),
      password:   hashed,
      role:       role || 'patient',
      isVerified: role === 'patient',
    });

    if (user.role === 'patient') {
      await Patient.create({ user: user._id });
    } else if (user.role === 'doctor') {
      await Doctor.create({
        user:          user._id,
        specialization:specialization || 'General Physician',
        hospital:      hospital || 'Dana Shivam Heart & Super Speciality Hospital',
        licenseNumber: licenseNumber || '',
        department:    department || '',
        isVerified:    false,
        isAvailable:   false,
      });
    }

    const token = generateToken(user._id);
    await audit(req, { action: 'user_register', targetType: 'User', targetId: user._id, metadata: { role: user.role } });

    res.status(201).json({
      success: true,
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, isVerified: user.isVerified, avatar: user.avatar },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password, role: selectedRole } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    // ── ROLE MISMATCH CHECK ────────────────────────────────────────────────────
    // If the frontend sent a selectedRole and it doesn't match the DB role, reject.
    // This prevents a doctor's email from logging in via the Patient tab.
    if (selectedRole && selectedRole !== user.role) {
      const actualLabel   = ROLE_LABELS[user.role]   || user.role;
      const selectedLabel = ROLE_LABELS[selectedRole] || selectedRole;
      return res.status(403).json({
        success: false,
        message: `This email is registered as a ${actualLabel} account. Please select the "${actualLabel}" tab and sign in again.`,
      });
    }

    const token = generateToken(user._id);
    user.lastLogin = new Date();
    await user.save();

    await audit(req, { action: 'user_login', targetType: 'User', targetId: user._id });

    res.json({
      success: true,
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, isVerified: user.isVerified, avatar: user.avatar, phone: user.phone },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: { user } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── PUT /api/auth/update-profile ──────────────────────────────────────────────
router.put('/update-profile', protect, async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'avatar', 'address'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── PUT /api/auth/change-password ─────────────────────────────────────────────
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });

    const user  = await User.findById(req.user._id).select('+password');
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Google OAuth routes ───────────────────────────────────────────────────────
router.get('/google', passport.authenticate('google', { scope: ['profile','email'], session: false }));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed` }),
  async (req, res) => {
    try {
      const token = generateToken(req.user._id);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`);
    } catch (e) {
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`);
    }
  }
);

module.exports = router;