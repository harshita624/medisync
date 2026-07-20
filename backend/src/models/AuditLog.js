const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorRole: { type: String, enum: ['patient', 'doctor', 'insurance', 'admin'], required: true },
  action: { type: String, required: true, index: true },
  targetType: { type: String, required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  ip: String,
  userAgent: String,
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

auditLogSchema.index({ patient: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
