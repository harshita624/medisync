'use strict';
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: [
      'appointment_scheduled','appointment_cancelled','appointment_completed',
      'record_added','qr_scanned','health_alert','emergency_sos',
      'claim_update','policy_update','general',
    ],
    default: 'general',
  },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  link:    String,
  data:    mongoose.Schema.Types.Mixed,
  isRead:  { type: Boolean, default: false, index: true },
  readAt:  Date,
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1  });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);