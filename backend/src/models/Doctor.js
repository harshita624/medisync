'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;

const slotSchema = new Schema({
  start:    { type: String, required: true },
  end:      { type: String, required: true },
  isActive: { type: Boolean, default: true },
}, { _id: false });

const dateAvailabilitySchema = new Schema({
  date:  { type: String, required: true }, // 'YYYY-MM-DD'
  isOff: { type: Boolean, default: false },
  slots: [slotSchema],
}, { _id: false });

const weeklySlotSchema = new Schema({
  dayOfWeek: { type: Number, min: 0, max: 6 }, // 0=Sun
  slots:     [slotSchema],
}, { _id: false });

const doctorSchema = new Schema({
  user:           { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  doctorId:       { type: String, unique: true, sparse: true },

  specialization: { type: String, default: 'General Physician' },
  hospital:       { type: String, default: '' },
  department:     { type: String, default: '' },

  // ── THE FIX ──────────────────────────────────────────────────────────────
  // sparse: true means MongoDB only indexes documents WHERE licenseNumber
  // is set (non-null/non-undefined). Documents with null licenseNumber
  // are excluded from the index entirely — so multiple nulls are allowed.
  // Without sparse: true, every null counts as a value and the unique
  // constraint fires the E11000 error.
  licenseNumber: { type: String, unique: true, sparse: true },

  bio:            { type: String, default: '' },
  experience:     { type: Number, default: 0 },
  qualifications: [String],
  languages:      { type: [String], default: ['English', 'Hindi'] },

  consultationFee: { type: Number, default: 0 },
  rating:          { type: Number, default: 0, min: 0, max: 5 },
  totalReviews:    { type: Number, default: 0 },

  isVerified:  { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: false },

  // Legacy weekly schedule (kept for backward compat)
  availability:   [weeklySlotSchema],
  weeklyDefaults: [weeklySlotSchema],

  // Date-specific availability (used by booking system)
  dateAvailability: [dateAvailabilitySchema],

}, { timestamps: true });

// Auto-generate doctorId before first save
doctorSchema.pre('save', async function (next) {
  if (!this.doctorId) {
    try {
      const count = await mongoose.model('Doctor').countDocuments();
      this.doctorId = `DR-${String(count + 1).padStart(6, '0')}${Math.random().toString(36).slice(-2).toUpperCase()}`;
    } catch {}
  }
  next();
});

module.exports = mongoose.models.Doctor || mongoose.model('Doctor', doctorSchema);