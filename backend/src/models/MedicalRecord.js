'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;

const prescriptionSchema = new Schema({
  medicine:     String,
  dosage:       String,
  frequency:    String,
  duration:     String,
  instructions: String,
}, { _id: true });

const documentSchema = new Schema({
  name:          String,
  fileUrl:       String,
  type:          { type: String, default: 'other' },
  uploadedBy:    Schema.Types.ObjectId,
  aiStatus:      String,
  aiSummary:     String,
  extractedText: String,
  structuredData:Schema.Types.Mixed,
}, { _id: true });

const medicalRecordSchema = new Schema({
  patient:   { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  doctor:    { type: Schema.Types.ObjectId, ref: 'Doctor',  index: true },

  visitDate: { type: Date, default: Date.now },
  visitType: {
    type:    String,
    enum:    ['consultation','follow-up','emergency','routine','surgery','teleconsult'],
    default: 'consultation',
  },

  chiefComplaint: String,
  diagnosis:      String,
  symptoms:       [String],
  notes:          String,

  vitals: {
    bloodPressure:    String,
    pulse:            Number,
    temperature:      Number,
    weight:           Number,
    height:           Number,
    oxygenSaturation: Number,
  },

  prescription:   [prescriptionSchema],
  documents:      [documentSchema],
  labReports:     [documentSchema],

  followUpRequired: { type: Boolean, default: false },
  followUpDate:     Date,

  // ML outputs
  prescriptionWarnings: Schema.Types.Mixed,
  clinicalInsights:     Schema.Types.Mixed,
  differentialDiagnosis:Schema.Types.Mixed,
  examination:          Schema.Types.Mixed,
  treatmentPlan:        String,
}, { timestamps: true });

medicalRecordSchema.index({ patient: 1, visitDate: -1 });

module.exports = mongoose.models.MedicalRecord || mongoose.model('MedicalRecord', medicalRecordSchema);