'use strict';
const mongoose = require('mongoose');

// Lazy load to avoid circular deps
let AuditLog;
function getModel() {
  if (!AuditLog) {
    const schema = new mongoose.Schema({
      action:    { type: String, required: true },
      actor:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      actorRole: String,
      targetType:String,
      targetId:  mongoose.Schema.Types.ObjectId,
      patient:   { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
      metadata:  mongoose.Schema.Types.Mixed,
      ip:        String,
      userAgent: String,
    }, { timestamps: true });
    AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', schema);
  }
  return AuditLog;
}

module.exports = async function audit(req, payload = {}) {
  try {
    const Model = getModel();
    await Model.create({
      action:    payload.action    || 'unknown',
      actor:     req.user?._id,
      actorRole: req.user?.role,
      targetType:payload.targetType,
      targetId:  payload.targetId,
      patient:   payload.patient,
      metadata:  payload.metadata || {},
      ip:        req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    });
  } catch {}  // audit failures must never break the main flow
};