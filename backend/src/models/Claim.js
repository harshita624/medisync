'use strict';
const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  patient:       { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  policy:        { type: mongoose.Schema.Types.ObjectId, ref: 'Policy',  required: true },
  claimNumber:   { type: String, unique: true },
  claimType:     { type: String, enum: ['hospitalization','outpatient','pharmacy','lab_test','surgery','emergency','maternity','dental','vision','other'], default: 'hospitalization' },
  claimAmount:   { type: Number, required: true },
  approvedAmount:{ type: Number, default: 0 },
  description:   String,
  hospitalName:  String,
  treatmentDate: Date,
  status:        { type: String, enum: ['draft','submitted','under_review','approved','partially_approved','rejected','paid','closed'], default: 'submitted' },
  timeline:      [{ status: String, updatedAt: { type: Date, default: Date.now }, note: String, updatedBy: mongoose.Schema.Types.ObjectId }],
  documents:     [{ name: String, fileUrl: String }],
}, { timestamps: true });

claimSchema.pre('save', async function(next) {
  if (!this.claimNumber) {
    const count = await mongoose.model('Claim').countDocuments();
    this.claimNumber = `CLM-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.models.Claim || mongoose.model('Claim', claimSchema);