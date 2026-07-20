'use strict';
const express      = require('express');
const router       = express.Router();
const crypto       = require('crypto');
const { protect }  = require('../middleware/auth');
const Patient      = require('../models/Patient');
const Doctor       = require('../models/Doctor');
const Appointment  = require('../models/Appointment');
const MedicalRecord= require('../models/MedicalRecord');
const Notification = require('../models/Notification');
const audit        = require('../utils/audit');

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
    if (roles.length && !roles.includes(req.user.role))
      return res.status(403).json({ success: false, message: `This route requires role: ${roles.join(' or ')}` });
    next();
  };
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function buildQrUrl(token, patientId) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/doctor/scan?token=${encodeURIComponent(token)}&patientId=${encodeURIComponent(patientId)}`;
}

async function buildFullPacket(patient) {
  const [records, appointments] = await Promise.all([
    MedicalRecord.find({ patient: patient._id })
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email avatar' } })
      .sort({ visitDate: -1 })
      .limit(20),
    Appointment.find({ patient: patient._id })
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email avatar' } })
      .sort({ appointmentDate: -1 })
      .limit(10),
  ]);

  const recordDocs = records.flatMap(r => [
    ...(r.documents  || []).map(d => ({ ...d.toObject?.() || d, source: 'record' })),
    ...(r.labReports || []).map(d => ({ ...d.toObject?.() || d, source: 'record', type: d.type || 'lab_report' })),
  ]);
  const vaultDocs = (patient.documents || []).map(d => ({ ...d.toObject?.() || d, source: 'patient' }));
  const allDocs   = [...vaultDocs, ...recordDocs];

  const prescriptions = records.flatMap(r =>
    (r.prescription || []).map(p => ({ ...p, visitDate: r.visitDate, doctor: r.doctor?.user?.name }))
  );

  const vitals = [...(patient.vitals || [])].sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));

  return {
    patient: {
      ...patient.toObject(),
      age:               patient.age,
      bloodGroup:        patient.bloodGroup,
      gender:            patient.gender,
      allergies:         patient.allergies || [],
      chronicConditions: patient.chronicConditions || [],
      healthScore:       patient.healthScore,
      riskLevel:         patient.riskLevel,
    },
    records,
    documents:       allDocs,
    secureDocuments: vaultDocs.filter(d => d.visibility === 'secure'),
    vitals,
    appointments,
    prescriptions,
    packetSummary: {
      recordsCount:       records.length,
      documentsCount:     allDocs.length,
      vitalsCount:        vitals.length,
      prescriptionsCount: prescriptions.length,
      bloodGroup:         patient.bloodGroup || 'Unknown',
      riskLevel:          patient.riskLevel  || 'low',
      healthScore:        patient.healthScore,
    },
    emergency: {
      bloodGroup:         patient.bloodGroup || 'Unknown',
      allergies:          patient.allergies  || [],
      chronicConditions:  patient.chronicConditions || [],
      emergencyContact:   patient.emergencyContact  || {},
      currentMedications: (patient.currentMedications || []).slice(0, 10),
      riskLevel:          patient.riskLevel || 'low',
      healthScore:        patient.healthScore,
    },
  };
}

// ── POST /api/qr/generate ─────────────────────────────────────────────────────
router.post('/generate', protect, authorize('patient'), async (req, res) => {
  try {
    let patient = await Patient.findOne({ user: req.user._id }).populate('user', 'name email avatar');
    if (!patient) patient = await Patient.create({ user: req.user._id });

    const token     = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    patient.qrToken        = token;
    patient.qrTokenExpires = expiresAt;
    patient.qrGeneratedAt  = new Date();
    await patient.save();

    const [recordCount] = await Promise.all([MedicalRecord.countDocuments({ patient: patient._id })]);
    const docs = (patient.documents || []).length;

    await audit(req, { action: 'qr_generate', targetType: 'Patient', targetId: patient._id });

    res.json({
      success:   true,
      qrToken:   token,
      patientId: patient.patientId || String(patient._id),
      expiresAt,
      qrUrl:     buildQrUrl(token, patient.patientId || String(patient._id)),
      packetSummary: {
        recordsCount:       recordCount,
        documentsCount:     docs,
        vitalsCount:        (patient.vitals || []).length,
        prescriptionsCount: 0,
        bloodGroup:         patient.bloodGroup || 'Unknown',
        riskLevel:          patient.riskLevel  || 'low',
        healthScore:        patient.healthScore,
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── GET /api/qr/my ────────────────────────────────────────────────────────────
router.get('/my', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id }).populate('user', 'name email avatar');
    if (!patient || !patient.qrToken) return res.json({ success: true, qrToken: null, patientId: null });

    const expired = patient.qrTokenExpires && new Date(patient.qrTokenExpires) < new Date();
    if (expired) return res.json({ success: true, qrToken: null, patientId: null, expired: true });

    const recordCount = await MedicalRecord.countDocuments({ patient: patient._id });
    const prescCount  = await MedicalRecord.aggregate([
      { $match: { patient: patient._id } },
      { $project: { count: { $size: { $ifNull: ['$prescription', []] } } } },
      { $group: { _id: null, total: { $sum: '$count' } } },
    ]);

    const docs = await Patient.findById(patient._id).select('documents');

    res.json({
      success:   true,
      qrToken:   patient.qrToken,
      patientId: patient.patientId || String(patient._id),
      expiresAt: patient.qrTokenExpires,
      qrUrl:     buildQrUrl(patient.qrToken, patient.patientId || String(patient._id)),
      documents: (docs?.documents || []).filter(d => d.fileUrl),
      packetSummary: {
        recordsCount:       recordCount,
        documentsCount:     (docs?.documents || []).length,
        vitalsCount:        (patient.vitals || []).length,
        prescriptionsCount: prescCount[0]?.total || 0,
        bloodGroup:         patient.bloodGroup || 'Unknown',
        riskLevel:          patient.riskLevel  || 'low',
        healthScore:        patient.healthScore,
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── POST /api/qr/scan — used by doctor app/dashboard ─────────────────────────
// Accepts token from request body OR from query string (when QR opens a URL)
router.post('/scan', protect, authorize('doctor'), async (req, res) => {
  try {
    const token = (req.body.token || req.query.token || '').trim();
    if (!token) return res.status(400).json({ success: false, message: 'token is required' });

    const patient = await Patient.findOne({ qrToken: token }).populate('user', 'name email avatar phone');
    if (!patient) return res.status(404).json({ success: false, message: 'Invalid or expired QR code. Ask the patient to generate a new one.' });

    if (patient.qrTokenExpires && new Date(patient.qrTokenExpires) < new Date())
      return res.status(401).json({ success: false, message: 'This QR code has expired. Ask the patient to regenerate it.' });

    const doctor = await Doctor.findOne({ user: req.user._id });
    if (doctor) {
      await Patient.findByIdAndUpdate(patient._id, { $addToSet: { doctors: doctor._id } });
    }

    patient.qrScans = patient.qrScans || [];
    patient.qrScans.push({ scannedBy: req.user._id, scannedAt: new Date(), doctorName: req.user.name });
    patient.markModified('qrScans');

    // Save without triggering full validation on address/sosEvents
    await Patient.findByIdAndUpdate(
      patient._id,
      {
        $push: { qrScans: { scannedBy: req.user._id, scannedAt: new Date(), doctorName: req.user.name } },
        $addToSet: doctor ? { doctors: doctor._id } : {},
      }
    );

    await Notification.create({
      recipient: patient.user._id || patient.user,
      type:      'qr_scanned',
      title:     'QR code scanned',
      message:   `Dr. ${req.user.name} scanned your QR code and accessed your medical packet.`,
      link:      '/patient/qr',
    }).catch(() => {});

    const packet = await buildFullPacket(patient);

    await audit(req, {
      action:     'qr_scan',
      targetType: 'Patient',
      targetId:   patient._id,
      metadata:   { scannedByDoctor: req.user._id },
    }).catch(() => {});

    res.json({ success: true, ...packet });
  } catch (e) {
    console.error('QR scan error:', e.message, e.stack);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── GET /api/qr/scan — called when doctor opens QR URL in browser ─────────────
// The QR URL opens /doctor/scan?token=xxx in the frontend.
// This GET endpoint lets the frontend fetch the packet using the token.
router.get('/scan', protect, authorize('doctor'), async (req, res) => {
  try {
    const token = (req.query.token || '').trim();
    if (!token) return res.status(400).json({ success: false, message: 'token is required' });

    const patient = await Patient.findOne({ qrToken: token }).populate('user', 'name email avatar phone');
    if (!patient) return res.status(404).json({ success: false, message: 'Invalid or expired QR code.' });

    if (patient.qrTokenExpires && new Date(patient.qrTokenExpires) < new Date())
      return res.status(401).json({ success: false, message: 'QR code has expired.' });

    const doctor = await Doctor.findOne({ user: req.user._id });

    await Patient.findByIdAndUpdate(
      patient._id,
      {
        $push:    { qrScans: { scannedBy: req.user._id, scannedAt: new Date(), doctorName: req.user.name } },
        $addToSet: doctor ? { doctors: doctor._id } : {},
      }
    );

    await Notification.create({
      recipient: patient.user._id || patient.user,
      type:      'qr_scanned',
      title:     'QR code scanned',
      message:   `Dr. ${req.user.name} accessed your medical records via QR code.`,
      link:      '/patient/qr',
    }).catch(() => {});

    const packet = await buildFullPacket(patient);
    res.json({ success: true, ...packet });
  } catch (e) {
    console.error('QR GET scan error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── GET /api/qr/scan-history ──────────────────────────────────────────────────
router.get('/scan-history', protect, authorize('doctor'), async (req, res) => {
  try {
    const patients = await Patient.find({ 'qrScans.scannedBy': req.user._id })
      .populate('user', 'name email avatar')
      .select('user patientId qrScans bloodGroup riskLevel healthScore')
      .limit(20);
    res.json({ success: true, patients });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;