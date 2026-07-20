'use strict';
const express       = require('express');
const router        = express.Router();
const fs            = require('fs');
const path          = require('path');
const multer        = require('multer');
const { protect, authorize } = require('../middleware/auth');
const Doctor        = require('../models/Doctor');
const Patient       = require('../models/Patient');
const Appointment   = require('../models/Appointment');
const MedicalRecord = require('../models/MedicalRecord');
const Notification  = require('../models/Notification');
const User          = require('../models/User');
const audit         = require('../utils/audit');

// Safe import for ML service
let buildClinicalPacket   = async () => ({ ok: false });
let checkDrugInteractions = async () => ({ ok: false });
let extractOcrFromBuffer  = async () => ({ ok: false });
try {
  const ml = require('../services/mlService');
  if (ml.buildClinicalPacket)   buildClinicalPacket   = ml.buildClinicalPacket;
  if (ml.checkDrugInteractions) checkDrugInteractions = ml.checkDrugInteractions;
  if (ml.extractOcrFromBuffer)  extractOcrFromBuffer  = ml.extractOcrFromBuffer;
} catch {}

require('../models/Policy');

const recordUploadDir = path.join(__dirname, '../../uploads/medical-records');
fs.mkdirSync(recordUploadDir, { recursive: true });

const recordUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, recordUploadDir),
    filename:    (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildMeetingPayload(appointmentId, type) {
  if (type !== 'video') return {};
  const meetingId = `HealthBridge-${String(appointmentId).slice(-10).toUpperCase()}`;
  return { meetingId, meetingLink: `https://meet.jit.si/${meetingId}` };
}

function summarizeDoc(structured = {}, raw = '') {
  const parts = [];
  if (structured.diagnosis?.length)    parts.push(`Diagnosis: ${structured.diagnosis.join(', ')}`);
  if (structured.medications?.length)  parts.push(`Medications: ${structured.medications.map(m=>`${m.name} ${m.dosage||''}`).join(', ')}`);
  if (structured.lab_results?.length) {
    const abn = structured.lab_results.filter(r=>['high','low','abnormal'].includes(String(r.status||'').toLowerCase()));
    parts.push(abn.length ? `Abnormal: ${abn.map(r=>`${r.test} ${r.value||''}`).join(', ')}` : `${structured.lab_results.length} lab results`);
  }
  return parts.join('. ') || raw.slice(0, 500);
}

async function doctorHasPatientAccess(userId, patientId) {
  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) return { ok: false };
  const aptAccess = await Appointment.exists({ doctor: doctor._id, patient: patientId, status: { $in: ['scheduled','confirmed','completed'] } });
  const qrAccess  = await Patient.exists({ _id: patientId, doctors: doctor._id });
  return { ok: !!aptAccess || !!qrAccess, doctor };
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/doctor/all — public doctor list
// ─────────────────────────────────────────────────────────────────────────────
router.get('/all', protect, async (req, res) => {
  try {
    const doctors = await Doctor.find({})
      .populate('user', 'name email avatar phone')
      .select('doctorId specialization hospital consultationFee rating totalReviews isAvailable isVerified availability dateAvailability bio experience languages');

    const today    = new Date().toISOString().slice(0, 10);
    const enriched = doctors.map(d => {
      const obj   = d.toObject();
      const future = (obj.dateAvailability || []).filter(e => !e.isOff && e.date >= today && (e.slots||[]).some(s=>s.isActive));
      future.sort((a,b) => a.date.localeCompare(b.date));
      obj.hasUpcomingSlots  = future.length > 0;
      obj.nextAvailableDate = future[0]?.date || null;
      return obj;
    });

    res.json({ success: true, doctors: enriched });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/doctor/profile
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profile', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id }).populate('user', 'name email avatar phone');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    res.json({ success: true, doctor });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/profile', protect, authorize('doctor'), async (req, res) => {
  try {
    const allowed = ['bio','experience','languages','hospital','department','consultationFee','qualifications'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const doctor = await Doctor.findOneAndUpdate({ user: req.user._id }, updates, { new: true }).populate('user', 'name email avatar phone');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    res.json({ success: true, doctor });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/doctor/scan-patient?pid=PAT-XXXXXXXX
//  *** MUST be before any /:doctorId routes ***
//  Called by doctor scan page after scanning patient QR code
// ─────────────────────────────────────────────────────────────────────────────
router.get('/scan-patient', protect, authorize('doctor'), async (req, res) => {
  try {
    let rawPid = String(req.query.pid || '').trim();

    if (!rawPid) {
      return res.status(400).json({ success: false, message: 'pid query param is required' });
    }

    // ── Strip full URL down to just the patient ID ────────────────────────────
    // QR codes often encode the full page URL, e.g.:
    //   https://domain.ngrok-free.app/patient-card/PAT-54F5CD76?ngrok-skip-browser-warning=true
    // We only want: PAT-54F5CD76
    if (rawPid.startsWith('http://') || rawPid.startsWith('https://')) {
      try {
        const url      = new URL(rawPid);
        const segments = url.pathname.split('/').filter(Boolean);
        rawPid = segments[segments.length - 1] || rawPid;
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid URL in pid parameter' });
      }
    }

    // Strip any leftover query string that may have bled past URL parsing
    rawPid = rawPid.split('?')[0].trim();

    console.log('[scan-patient] Resolved patient ID:', rawPid);

    // 1. Exact match on patientId field
    let patient = await Patient.findOne({ patientId: rawPid })
      .populate('user', 'name email avatar phone');

    // 2. Case-insensitive match
    if (!patient) {
      patient = await Patient.findOne({
        patientId: { $regex: new RegExp(`^${rawPid}$`, 'i') },
      }).populate('user', 'name email avatar phone');
    }

    // 3. MongoDB _id fallback (in case QR encodes _id instead of patientId)
    if (!patient && /^[a-f\d]{24}$/i.test(rawPid)) {
      patient = await Patient.findById(rawPid)
        .populate('user', 'name email avatar phone');
    }

    if (!patient) {
      const existing = await Patient.find({}).select('patientId').limit(20);
      console.log('[scan-patient] Not found. Existing patientIds:', existing.map(p => p.patientId));
      return res.status(404).json({
        success:    false,
        message:    `Patient "${rawPid}" not found. Make sure the QR code is up to date.`,
        resolvedId: rawPid,
      });
    }

    console.log('[scan-patient] Found:', patient.patientId, patient.user?.name);

    const [records, appointments] = await Promise.all([
      MedicalRecord.find({ patient: patient._id })
        .populate({ path: 'doctor', populate: { path: 'user', select: 'name specialization' } })
        .sort({ visitDate: -1 })
        .limit(15),
      Appointment.find({ patient: patient._id })
        .populate({ path: 'doctor', populate: { path: 'user', select: 'name specialization' } })
        .sort({ appointmentDate: -1 })
        .limit(10),
    ]);

    // Auto-link doctor ↔ patient
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (doctor) {
      await Patient.findByIdAndUpdate(patient._id, { $addToSet: { doctors: doctor._id } });
    }

    try {
      await audit(req, {
        action:     'qr_scan',
        targetType: 'Patient',
        targetId:   patient._id,
        patient:    patient._id,
        metadata:   { pid: rawPid, doctorId: doctor?._id },
      });
    } catch {}

    res.json({
      success:      true,
      patient,
      records,
      appointments,
      vitals:    patient.vitals    || [],
      documents: patient.documents || [],
    });
  } catch (e) {
    console.error('[scan-patient] Error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/doctor/patients
// ─────────────────────────────────────────────────────────────────────────────
router.get('/patients', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) return res.json({ success: true, patients: [] });
    const aptPatients = await Appointment.find({ doctor: doctor._id, status: { $in: ['scheduled','confirmed','completed'] } }).distinct('patient');
    const patients = await Patient.find({ $or: [{ _id: { $in: aptPatients } }, { doctors: doctor._id }] })
      .populate('user', 'name email phone avatar').sort({ updatedAt: -1 });
    res.json({ success: true, patients });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/doctor/appointments
// ─────────────────────────────────────────────────────────────────────────────
router.get('/appointments', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) return res.json({ success: true, appointments: [] });
    const appointments = await Appointment.find({ doctor: doctor._id })
      .populate({ path: 'patient', populate: { path: 'user', select: 'name email avatar phone' } })
      .sort({ appointmentDate: -1 });
    res.json({ success: true, appointments });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/doctor/queue/today
// ─────────────────────────────────────────────────────────────────────────────
router.get('/queue/today', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) return res.json({ success: true, queue: [], stats: {} });

    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(),  0,  0,  0,   0);
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const queue = await Appointment.find({ doctor: doctor._id, appointmentDate: { $gte: start, $lte: end } })
      .populate({ path: 'patient', populate: { path: 'user', select: 'name email phone avatar' } })
      .sort({ appointmentDate: 1 });

    const stats = {
      total:     queue.length,
      waiting:   queue.filter(a => a.status === 'scheduled').length,
      confirmed: queue.filter(a => a.status === 'confirmed').length,
      completed: queue.filter(a => a.status === 'completed').length,
      cancelled: queue.filter(a => a.status === 'cancelled').length,
      remaining: queue.filter(a => ['scheduled','confirmed'].includes(a.status)).length,
    };

    const done  = stats.completed;
    const queueWithPos = queue.map((apt, i) => ({
      ...apt.toObject(),
      queuePosition:    i - done + 1 > 0 ? i - done + 1 : null,
      estimatedWaitMin: i - done + 1 > 0 ? (i - done + 1) * 15   : 0,
    }));

    res.json({ success: true, queue: queueWithPos, stats });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/doctor/appointments/:id/status
// ─────────────────────────────────────────────────────────────────────────────
router.put('/appointments/:id/status', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctor  = await Doctor.findOne({ user: req.user._id });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const allowed = ['confirmed','completed','cancelled','no-show','in-consultation'];
    const { status, notes } = req.body;
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    const appointment = await Appointment.findOne({ _id: req.params.id, doctor: doctor._id })
      .populate({ path: 'patient', populate: { path: 'user', select: 'name email _id' } });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    appointment.status = status;
    if (['confirmed','completed'].includes(status) && appointment.type === 'video' && !appointment.meetingLink) {
      Object.assign(appointment, buildMeetingPayload(appointment._id, appointment.type));
    }
    if (notes) appointment.notes = notes;
    if (status === 'cancelled') {
      appointment.cancelledBy        = req.user._id;
      appointment.cancelledAt        = new Date();
      appointment.cancellationReason = notes || 'Cancelled by doctor';
    }
    await appointment.save();

    const patientUserId = appointment.patient?.user?._id || appointment.patient?.user;
    if (patientUserId) {
      await Notification.create({
        recipient: patientUserId,
        type:      status === 'cancelled' ? 'appointment_cancelled' : 'appointment_scheduled',
        title:     `Appointment ${status.replace(/-/g,' ')}`,
        message:   `Your appointment with Dr. ${req.user.name} has been ${status.replace(/-/g,' ')}.`,
        link:      '/patient/appointments',
        data:      { appointment: appointment._id },
      }).catch(() => {});
    }

    res.json({ success: true, appointment });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Availability routes (legacy weekly + date-specific)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/availability', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    res.json({ success: true, availability: doctor.availability || [] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/availability', protect, authorize('doctor'), async (req, res) => {
  try {
    const { availability } = req.body;
    if (!Array.isArray(availability)) return res.status(400).json({ success: false, message: 'availability must be an array' });
    const sanitized = availability
      .map(day => ({
        dayOfWeek: Number(day.dayOfWeek),
        slots: (day.slots || []).filter(s => s.start && s.end).map(s => ({ start: String(s.start), end: String(s.end), isActive: s.isActive !== false })),
      }))
      .filter(d => Number.isInteger(d.dayOfWeek) && d.dayOfWeek >= 0 && d.dayOfWeek <= 6 && d.slots.length);
    const doctor = await Doctor.findOneAndUpdate({ user: req.user._id }, { $set: { availability: sanitized } }, { new: true });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    res.json({ success: true, availability: doctor.availability });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/date-availability', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id }).select('dateAvailability weeklyDefaults');
    res.json({ success: true, dateAvailability: doctor?.dateAvailability || [], weeklyDefaults: doctor?.weeklyDefaults || [] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/date-availability/:date', protect, authorize('doctor'), async (req, res) => {
  try {
    const { date } = req.params;
    const { slots, isOff } = req.body;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ success: false, message: 'Date must be YYYY-MM-DD' });

    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    doctor.dateAvailability = (doctor.dateAvailability || []).filter(d => d.date !== date);
    if (slots?.length || isOff) {
      doctor.dateAvailability.push({ date, isOff: !!isOff, slots: isOff ? [] : (slots || []) });
    }
    const today = new Date().toISOString().slice(0, 10);
    doctor.isAvailable = (doctor.dateAvailability || []).some(e => e.date >= today && !e.isOff && (e.slots||[]).some(s=>s.isActive));
    await doctor.save();
    res.json({ success: true, dateAvailability: doctor.dateAvailability });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/date-availability/:date', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    doctor.dateAvailability = (doctor.dateAvailability || []).filter(d => d.date !== req.params.date);
    await doctor.save();
    res.json({ success: true, dateAvailability: doctor.dateAvailability });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/weekly-defaults', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctor = await Doctor.findOneAndUpdate(
      { user: req.user._id },
      { weeklyDefaults: req.body.weeklyDefaults || [] },
      { new: true }
    );
    res.json({ success: true, weeklyDefaults: doctor?.weeklyDefaults || [] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/doctor/:doctorId/open-slots?date=YYYY-MM-DD
//  Only uses dateAvailability — never falls back to weekly schedule
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:doctorId/open-slots', protect, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'date query param required (YYYY-MM-DD)' });

    const normalizedDate = String(date).slice(0, 10);
    const doctor = await Doctor.findById(req.params.doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const dateEntry = (doctor.dateAvailability || []).find(d => d.date === normalizedDate);
    if (!dateEntry)     return res.json({ success: true, slots: [], date: normalizedDate, reason: 'No availability set for this date' });
    if (dateEntry.isOff) return res.json({ success: true, slots: [], date: normalizedDate, reason: 'Doctor is off on this date' });

    const activeSlots = (dateEntry.slots || []).filter(s => s.isActive);
    if (!activeSlots.length) return res.json({ success: true, slots: [], date: normalizedDate, reason: 'No active slots' });

    const [y, m, d_] = normalizedDate.split('-').map(Number);
    const dayStart   = new Date(y, m - 1, d_,  0,  0,  0,   0);
    const dayEnd     = new Date(y, m - 1, d_, 23, 59, 59, 999);

    const booked = await Appointment.find({
      doctor:          doctor._id,
      appointmentDate: { $gte: dayStart, $lte: dayEnd },
      status:          { $in: ['scheduled', 'confirmed'] },
    }).select('timeSlot');

    const bookedStarts   = new Set(booked.map(a => a.timeSlot?.start).filter(Boolean));
    const availableSlots = activeSlots.filter(s => !bookedStarts.has(s.start));

    res.json({ success: true, slots: availableSlots, date: normalizedDate, total: activeSlots.length, available: availableSlots.length, booked: booked.length });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/doctor/:doctorId/available-dates
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:doctorId/available-dates', protect, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.doctorId).select('dateAvailability');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    const today = new Date().toISOString().slice(0, 10);
    const dates = (doctor.dateAvailability || [])
      .filter(d => d.date >= today && !d.isOff && (d.slots||[]).some(s=>s.isActive))
      .map(d => ({ date: d.date, slots: (d.slots||[]).filter(s=>s.isActive).length }))
      .sort((a,b) => a.date.localeCompare(b.date));
    res.json({ success: true, dates });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/doctor/patient-context/:patientId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/patient-context/:patientId', protect, authorize('doctor'), async (req, res) => {
  try {
    const { ok } = await doctorHasPatientAccess(req.user._id, req.params.patientId);
    if (!ok) return res.status(403).json({ success: false, message: 'Patient access requires an appointment connection.' });

    const patient = await Patient.findById(req.params.patientId).populate('user', 'name email avatar phone');
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const [records, appointments] = await Promise.all([
      MedicalRecord.find({ patient: patient._id })
        .populate({ path: 'doctor', populate: { path: 'user', select: 'name email avatar' } })
        .sort({ visitDate: -1 }),
      Appointment.find({ patient: patient._id })
        .populate({ path: 'doctor', populate: { path: 'user', select: 'name email avatar' } })
        .sort({ appointmentDate: -1 }),
    ]);

    const recordDocuments = records.flatMap(r => [...(r.documents||[]), ...(r.labReports||[])]);
    const documents = [
      ...(patient.documents || []).map(d => ({ ...(d.toObject?.() || d), source: 'patient' })),
      ...recordDocuments.map(d => ({ ...(d.toObject?.() || d), source: 'record' })),
    ];

    await audit(req, { action: 'doctor_patient_context_view', targetType: 'Patient', targetId: patient._id, patient: patient._id });
    res.json({ success: true, patient, records, documents, vitals: patient.vitals || [], appointments, policies: patient.policies || [] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/patient-records/:patientId', protect, authorize('doctor'), async (req, res) => {
  try {
    const { ok } = await doctorHasPatientAccess(req.user._id, req.params.patientId);
    if (!ok) return res.status(403).json({ success: false, message: 'Patient access requires an appointment connection.' });
    const records = await MedicalRecord.find({ patient: req.params.patientId })
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email avatar' } })
      .sort({ visitDate: -1 });
    res.json({ success: true, records });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/doctor/resources
// ─────────────────────────────────────────────────────────────────────────────
router.get('/resources', protect, authorize('doctor'), async (req, res) => {
  try {
    const today      = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(),  0,  0,  0);
    const todayEnd   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const [todayApts, totalPatients, highRisk] = await Promise.all([
      Appointment.countDocuments({ appointmentDate: { $gte: todayStart, $lte: todayEnd }, status: { $in: ['scheduled','confirmed'] } }),
      Patient.countDocuments(),
      Patient.countDocuments({ riskLevel: { $in: ['high','critical'] } }),
    ]);

    res.json({
      success: true,
      resources: {
        opd:                { label: 'OPD Today',       value: todayApts,     status: todayApts > 50 ? 'busy' : 'available' },
        beds:               { label: 'Beds',            total: 100,           occupied: Math.min(highRisk * 3, 85) },
        icu:                { label: 'ICU',             total: 20,            occupied: Math.min(Math.floor(highRisk / 2), 18) },
        highRiskPatients:   highRisk,
        totalPatients,
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/doctor/appointments/:id/journey
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/appointments/:id/journey', protect, authorize('doctor'), async (req, res) => {
  try {
    const { journeyStatus, notes } = req.body;
    const valid = ['waiting','in-consultation','lab','pharmacy','billing','admission','discharge'];
    if (!valid.includes(journeyStatus)) return res.status(400).json({ success: false, message: 'Invalid journey status' });

    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const appointment = await Appointment.findOne({ _id: req.params.id, doctor: doctor._id })
      .populate({ path: 'patient', populate: { path: 'user', select: 'name email _id' } });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    appointment.journeyStatus = journeyStatus;
    if (notes) appointment.notes = (appointment.notes ? appointment.notes + '\n' : '') + notes;
    if (journeyStatus === 'discharge')       appointment.status = 'completed';
    if (journeyStatus === 'in-consultation') appointment.status = 'confirmed';
    await appointment.save();

    const patientUserId = appointment.patient?.user?._id || appointment.patient?.user;
    const msgs = {
      'waiting':        'You are in the waiting queue.',
      'in-consultation':'The doctor is ready to see you.',
      'lab':            'Please proceed to the laboratory.',
      'pharmacy':       'Please collect your medicines from the pharmacy.',
      'billing':        'Please proceed to the billing counter.',
      'discharge':      'Your consultation is complete. Discharge summary will be available shortly.',
    };
    if (patientUserId && msgs[journeyStatus]) {
      await Notification.create({ recipient: patientUserId, type: 'general', title: 'Status Update', message: msgs[journeyStatus], link: '/patient/appointments', data: { appointment: appointment._id } }).catch(() => {});
    }

    res.json({ success: true, appointment });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/doctor/records
// ─────────────────────────────────────────────────────────────────────────────
router.post('/records', protect, authorize('doctor'), recordUpload.single('file'), async (req, res) => {
  try {
    const { patient } = req.body;
    if (!patient) return res.status(400).json({ success: false, message: 'patient is required' });

    const { ok, doctor } = await doctorHasPatientAccess(req.user._id, patient);
    if (!ok) return res.status(403).json({ success: false, message: 'You can only add records for connected patients.' });

    const body = { ...req.body };
    if (typeof body.symptoms     === 'string') { try { const p=JSON.parse(body.symptoms);     body.symptoms     = Array.isArray(p)?p:body.symptoms.split(',').map(s=>s.trim()).filter(Boolean); } catch { body.symptoms=[]; } }
    if (typeof body.prescription === 'string') { try { body.prescription = JSON.parse(body.prescription); } catch { body.prescription=[]; } }
    if (typeof body.documents    === 'string') { try { body.documents    = JSON.parse(body.documents);    } catch { body.documents=[];    } }
    body.followUpRequired = body.followUpRequired===true||body.followUpRequired==='true';
    if (!body.followUpDate) delete body.followUpDate;

    if (req.file) {
      const document = {
        name:     body.documentName || req.file.originalname,
        fileUrl:  `/uploads/medical-records/${req.file.filename}`,
        type:     body.documentType || 'other',
        uploadedBy: req.user._id,
        aiStatus: 'skipped',
      };
      const dest = document.type === 'lab_report' ? 'labReports' : 'documents';
      body[dest] = [...(body[dest] || []), document];
    }

    delete body.file; delete body.documentName; delete body.documentType;

    const record = await MedicalRecord.create({ ...body, doctor: doctor._id });

    const patientProfile = await Patient.findById(patient);
    if (patientProfile) {
      await Notification.create({
        recipient: patientProfile.user,
        type:      'record_added',
        title:     'New medical record added',
        message:   `Dr. ${req.user.name} added a record: ${body.diagnosis || 'Consultation'}`,
        link:      '/patient/records',
        data:      { record: record._id },
      }).catch(() => {});
    }

    await audit(req, { action: 'doctor_record_create', targetType: 'MedicalRecord', targetId: record._id, patient, metadata: { diagnosis: record.diagnosis } });
    res.status(201).json({ success: true, record });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;