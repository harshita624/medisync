'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;

const healthPackageBookingSchema = new Schema({
  packageName:  { type: String, required: true },
  packagePrice: { type: Number, required: true },
  date:         { type: String, required: true }, // 'YYYY-MM-DD'
  timeSlot:     { start: String, end: String },
  tests:        [String],
  status:       { type: String, enum: ['scheduled','completed','cancelled'], default: 'scheduled' },
  bookedAt:     { type: Date, default: Date.now },
}, { _id: true });

const vitalSchema = new Schema({
  bloodPressure:     String,
  systolic:          Number,
  diastolic:         Number,
  heartRate:         Number,
  temperature:       Number,
  oxygenSaturation:  Number,
  glucose:           Number,
  weight:            Number,
  height:            Number,
  bmi:               Number,
  recordedAt:        { type: Date, default: Date.now },
  anomaly:           Boolean,
  anomalyDetails:    Schema.Types.Mixed,
}, { _id: true });

const documentSchema = new Schema({
  name:          String,
  fileUrl:       String,
  type:          { type: String, enum: ['lab_report','scan','prescription','discharge','insurance','id','other'], default: 'other' },
  visibility:    { type: String, enum: ['public','secure'], default: 'secure' },
  notes:         String,
  uploadedAt:    { type: Date, default: Date.now },
  uploadedBy:    Schema.Types.ObjectId,
  aiStatus:      { type: String, enum: ['pending','processed','failed','skipped'], default: 'skipped' },
  aiSummary:     String,
  aiError:       String,
  extractedText: String,
  structuredData:Schema.Types.Mixed,
}, { _id: true });

const medicineReminderSchema = new Schema({
  medicine:     { type: String, required: true },
  dosage:       String,
  frequency:    { type: String, enum: ['once_daily','twice_daily','thrice_daily','weekly','custom'], default: 'once_daily' },
  times:        [String],
  instructions: String,
  isActive:     { type: Boolean, default: true },
  adherenceLog: [{
    status:       { type: String, enum: ['taken','missed','skipped'], default: 'taken' },
    scheduledFor: Date,
    loggedAt:     { type: Date, default: Date.now },
  }],
  createdAt:    { type: Date, default: Date.now },
}, { _id: true });

const billSchema = new Schema({
  description:   String,
  amount:        { type: Number, required: true },
  date:          { type: Date, default: Date.now },
  status:        { type: String, enum: ['pending','paid','overdue','cancelled'], default: 'pending' },
  paidAt:        Date,
  paymentMethod: String,
  transactionId: String,
  generatedBy:   Schema.Types.ObjectId,
}, { _id: true });

const sosEventSchema = new Schema({
  message:          String,
  location:         {
    latitude:  Number,
    longitude: Number,
    accuracy:  Number,
    address:   String,
  },
  status: {
    type: String,
    enum: ['triggered', 'active', 'acknowledged', 'closed', 'resolved'],
    default: 'triggered',
  },
  triggeredAt:      { type: Date, default: Date.now },
  notifiedContacts: [{ name: String, phone: String, relation: String }],
}, { _id: true });

const patientSchema = new Schema({
  user:              { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  patientId:         { type: String, unique: true },

  dateOfBirth:       Date,
  gender:            { type: String, enum: ['male','female','other','prefer_not_to_say'] },
  bloodGroup:        { type: String, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown'], default: 'Unknown' },
  height:            Number,
  weight:            Number,

  // address as Mixed so it accepts both String and Object { country, city, etc. }
  address:           Schema.Types.Mixed,

  allergies:         [String],
  chronicConditions: [String],
  currentMedications:[{
    name:      String,
    dosage:    String,
    frequency: String,
    startDate: Date,
  }],

  emergencyContact: {
    name:     String,
    phone:    String,
    relation: String,
  },

  healthScore:    { type: Number, min: 0, max: 100 },
  riskLevel:      { type: String, enum: ['low','medium','high','critical'], default: 'low' },
  lastMLUpdate:   Date,

  qrToken:        String,
  qrTokenExpires: Date,
  qrGeneratedAt:  Date,
  qrScans:        [{ scannedBy: Schema.Types.ObjectId, scannedAt: Date, doctorName: String }],

  vitals:                 [vitalSchema],
  documents:              [documentSchema],
  medicineReminders:      [medicineReminderSchema],
  bills:                  [billSchema],
  sosEvents:              [sosEventSchema],
  healthPackageBookings:  [healthPackageBookingSchema],

  doctors:   [{ type: Schema.Types.ObjectId, ref: 'Doctor' }],
  policies:  [{ type: Schema.Types.ObjectId, ref: 'Policy' }],

}, { timestamps: true });

patientSchema.pre('save', async function(next) {
  if (!this.patientId) {
    const count = await mongoose.model('Patient').countDocuments();
    this.patientId = `PAT-${String(count + 1).padStart(6, '0')}${Math.random().toString(36).slice(-2).toUpperCase()}`;
  }
  next();
});

patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const diff = Date.now() - new Date(this.dateOfBirth).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
});

patientSchema.set('toJSON',   { virtuals: true });
patientSchema.set('toObject', { virtuals: true });

module.exports = mongoose.models.Patient || mongoose.model('Patient', patientSchema);