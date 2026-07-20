const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Policy = require('../models/Policy');
const Claim = require('../models/Claim');
const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const MedicalRecord = require('../models/MedicalRecord');
const audit = require('../utils/audit');

router.use(protect);
router.use(authorize('admin'));

router.get('/dashboard', async (req, res) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [users, patients, doctors, policies, claims, appointments] = await Promise.all([
      User.countDocuments(),
      Patient.countDocuments(),
      Doctor.countDocuments(),
      Policy.countDocuments(),
      Claim.countDocuments(),
      Appointment.countDocuments(),
    ]);
    const pendingDoctors = await Doctor.countDocuments({ isVerified: false });
    const pendingInsurance = await User.countDocuments({ role: 'insurance', isVerified: false });
    const openClaims = await Claim.countDocuments({ status: { $in: ['submitted', 'under_review'] } });
    const upcomingAppointments = await Appointment.countDocuments({
      status: { $in: ['scheduled', 'confirmed'] },
      appointmentDate: { $gte: new Date() },
    });
    const [
      aiChatMessages,
      ocrProcessedPatientDocs,
      ocrFailedPatientDocs,
      recordsWithClinicalInsights,
      recordsWithPrescriptionWarnings,
      abnormalVitalsPatients,
      authFailures24h,
      disabledUsers,
      recentHighRiskPatients,
    ] = await Promise.all([
      AuditLog.countDocuments({ action: 'chat_ai_message' }),
      Patient.countDocuments({ documents: { $elemMatch: { aiStatus: 'processed' } } }),
      Patient.countDocuments({ documents: { $elemMatch: { aiStatus: 'failed' } } }),
      MedicalRecord.countDocuments({ clinicalInsights: { $exists: true, $ne: null } }),
      MedicalRecord.countDocuments({ prescriptionWarnings: { $exists: true, $ne: null } }),
      Patient.countDocuments({ vitals: { $elemMatch: { anomaly: true } } }),
      AuditLog.countDocuments({ action: { $in: ['auth_login_failed', 'auth_blocked_inactive'] }, createdAt: { $gte: since24h } }),
      User.countDocuments({ isActive: false }),
      Patient.countDocuments({ riskLevel: { $in: ['high', 'critical'] }, updatedAt: { $gte: since24h } }),
    ]);

    res.json({
      success: true,
      stats: {
        users,
        patients,
        doctors,
        policies,
        claims,
        appointments,
        pendingDoctors,
        pendingInsurance,
        openClaims,
        upcomingAppointments,
        aiChatMessages,
        ocrProcessedPatientDocs,
        ocrFailedPatientDocs,
        recordsWithClinicalInsights,
        recordsWithPrescriptionWarnings,
        abnormalVitalsPatients,
        authFailures24h,
        disabledUsers,
        recentHighRiskPatients,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/monitoring', async (req, res) => {
  try {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [aiUsage, securityEvents, appointmentFlow, claimFlow, highRiskPatients] = await Promise.all([
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: since7d }, action: { $in: ['chat_ai_message', 'patient_document_ocr', 'doctor_record_ai_enrichment', 'patient_vitals_ml_analysis'] } } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: since7d }, action: { $regex: /auth|security|access|forbidden/i } } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Appointment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Claim.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$claimAmount' } } },
        { $sort: { count: -1 } },
      ]),
      Patient.find({ riskLevel: { $in: ['high', 'critical'] } })
        .populate('user', 'name email')
        .select('patientId riskLevel healthScore updatedAt user')
        .sort({ updatedAt: -1 })
        .limit(20),
    ]);

    res.json({ success: true, aiUsage, securityEvents, appointmentFlow, claimFlow, highRiskPatients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await AuditLog.find({})
      .populate('actor', 'name email role')
      .populate({ path: 'patient', populate: { path: 'user', select: 'name email' } })
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 200);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const query = {};
    if (req.query.role) query.role = req.query.role;
    if (req.query.q) {
      const regex = new RegExp(req.query.q, 'i');
      query.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/users/:id/status', async (req, res) => {
  try {
    const allowed = {};
    if (req.body.isActive !== undefined) allowed.isActive = !!req.body.isActive;
    if (req.body.isVerified !== undefined) allowed.isVerified = !!req.body.isVerified;

    const user = await User.findByIdAndUpdate(req.params.id, allowed, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.role === 'doctor' && req.body.isVerified !== undefined) {
      await Doctor.findOneAndUpdate({ user: user._id }, { isVerified: !!req.body.isVerified });
      await Notification.create({
        recipient: user._id,
        type: 'doctor_verified',
        title: req.body.isVerified ? 'Doctor account verified' : 'Doctor verification updated',
        message: req.body.isVerified ? 'Your doctor account is verified and visible to patients.' : 'Your doctor verification status was updated.',
        link: '/doctor/dashboard',
      });
    }

    if (user.role === 'insurance' && req.body.isVerified !== undefined) {
      await Notification.create({
        recipient: user._id,
        type: 'account_verified',
        title: req.body.isVerified ? 'Insurance account verified' : 'Insurance verification updated',
        message: req.body.isVerified ? 'Your insurance account is verified.' : 'Your insurance account verification changed.',
        link: '/insurance/dashboard',
      });
    }
    await audit(req, {
      action: 'admin_user_status_update',
      targetType: 'User',
      targetId: user._id,
      metadata: allowed,
    });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
