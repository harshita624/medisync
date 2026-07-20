'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema({
  sender:     { type: Schema.Types.ObjectId, ref: 'User' },
  senderRole: String,
  message:    { type: String, required: true },
  createdAt:  { type: Date, default: Date.now },
}, { _id: true });

const appointmentSchema = new Schema({
  patient:    { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  doctor:     { type: Schema.Types.ObjectId, ref: 'Doctor',  required: true, index: true },

  appointmentDate: { type: Date, required: true },
  timeSlot:        { start: String, end: String },

  type:   { type: String, enum: ['in-person','video','phone'], default: 'in-person' },
  reason: String,
  notes:  String,
  fee:    { type: Number, default: 0 },

  status: {
    type:    String,
    enum:    ['scheduled','confirmed','completed','cancelled','no-show','in-consultation'],
    default: 'scheduled',
    index:   true,
  },

  journeyStatus: {
    type: String,
    enum: ['waiting','in-consultation','lab','pharmacy','billing','admission','discharge'],
  },

  // Video consultation
  meetingId:   String,
  meetingLink: String,

  // Cancellation
  cancelledBy:        { type: Schema.Types.ObjectId, ref: 'User' },
  cancelledAt:        Date,
  cancellationReason: String,

  // In-room chat
  consultationMessages: [messageSchema],
}, { timestamps: true });

// Index for common queries
appointmentSchema.index({ patient: 1, appointmentDate: -1 });
appointmentSchema.index({ doctor:  1, appointmentDate: -1 });
appointmentSchema.index({ meetingId: 1 });

module.exports = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema);