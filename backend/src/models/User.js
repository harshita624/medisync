'use strict';
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true, select: false, minlength: 6 },
  role:       { type: String, enum: ['patient','doctor','insurance','admin'], default: 'patient' },
  avatar:     String,
  phone:      String,
  address:    String,
  googleId:   String,
  isVerified: { type: Boolean, default: false },
  isActive:   { type: Boolean, default: true  },
  lastLogin:  Date,
}, { timestamps: true });

// Auto-verify patients; doctors/insurance need admin approval
userSchema.pre('save', function(next) {
  if (this.isNew && this.role === 'patient') this.isVerified = true;
  next();
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);