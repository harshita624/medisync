const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const generateToken = require('../utils/generateToken');
const { validationResult } = require('express-validator');

const sendToken = (user, statusCode, res) => {
  const token = generateToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id:         user._id,
      name:       user.name,
      email:      user.email,
      role:       user.role,
      avatar:     user.avatar,
      isVerified: user.isVerified,
      companyName: user.companyName || null,
    }
  });
};

exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const {
      name, email, password, role, phone,
      // doctor
      specialization, licenseNumber, hospital,
      // insurance
      companyName, insuranceLicense,
    } = req.body;

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ success: false, message: 'Email already registered' });

    // ── Validate role-specific required fields before creating user ──
    if (role === 'doctor') {
      if (!specialization || !licenseNumber)
        return res.status(400).json({ success: false, message: 'Specialization and license number are required for doctors' });
    }

    if (role === 'insurance') {
      if (!companyName || !insuranceLicense)
        return res.status(400).json({ success: false, message: 'Company name and insurance license are required' });
    }

    // ── Create user ──
    const user = await User.create({ name, email, password, role, phone });

    // ── Create role-specific profile ──
    if (role === 'patient') {
      await Patient.create({ user: user._id });
    }

    if (role === 'doctor') {
      await Doctor.create({
        user:           user._id,
        specialization,
        licenseNumber,
        hospital:       hospital || '',
        isVerified:     false, // requires admin approval
      });
    }

    if (role === 'insurance') {
      // Store on user document — add companyName/insuranceLicense to User model if not there
      user.companyName      = companyName;
      user.insuranceLicense = insuranceLicense;
    }

    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    sendToken(user, 201, res);
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    if (!user.isActive)
      return res.status(401).json({ success: false, message: 'Account has been deactivated' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    sendToken(user, 200, res);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ 
      success: true, 
      data: { user }  // ← wrap in data{} to match frontend res.data.user
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, avatar },
      { new: true, runValidators: true }
    );
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, oldPassword, newPassword } = req.body;
    const passToCheck = currentPassword || oldPassword;

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.matchPassword(passToCheck);

    if (!isMatch)
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();
    sendToken(user, 200, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.logout = (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
};