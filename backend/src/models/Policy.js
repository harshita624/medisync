'use strict';
const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  patient:          { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  insuranceCompany: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  policyName:       String,
  policyNumber:     { type: String, unique: true, sparse: true },
  policyType:       { type: String, enum: ['health','life','accident','critical_illness','maternity','dental','vision','other'], default: 'health' },
  coverageAmount:   { type: Number, default: 0 },
  remainingCoverage:{ type: Number, default: 0 },
  premiumAmount:    Number,
  premiumFrequency: { type: String, enum: ['monthly','quarterly','annually'], default: 'annually' },
  startDate:        Date,
  endDate:          Date,
  status:           { type: String, enum: ['active','expired','cancelled','pending'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.models.Policy || mongoose.model('Policy', policySchema);