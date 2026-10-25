'use strict';
const express      = require('express');
const router       = express.Router();
const multer       = require('multer');
const path         = require('path');
const fs           = require('fs');
const { protect, authorize } = require('../middleware/auth');
const Patient      = require('../models/Patient');
const Appointment  = require('../models/Appointment');
const Policy       = require('../models/Policy');
const Claim        = require('../models/Claim');
const Notification = require('../models/Notification');

let detectAnomaly        = async () => ({ ok: false });
let predictHealthScore   = async () => ({ ok: false });
let extractOcrFromBuffer = async () => ({ ok: false });
try {
  const ml = require('../services/mlService');
  if (ml.detectAnomaly)        detectAnomaly        = ml.detectAnomaly;
  if (ml.predictHealthScore)   predictHealthScore   = ml.predictHealthScore;
  if (ml.extractOcrFromBuffer) extractOcrFromBuffer = ml.extractOcrFromBuffer;
} catch {}

let audit = async () => {};
try { audit = require('../utils/audit'); } catch {}

const docDir = path.join(__dirname, '../../uploads/patient-documents');
try { fs.mkdirSync(docDir, { recursive: true }); } catch {}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

function resolvePatientDocumentPath(fileUrl) {
  const prefix = '/uploads/patient-documents/';
  if (typeof fileUrl !== 'string' || !fileUrl.startsWith(prefix)) return null;
  const root = path.resolve(docDir);
  const fullPath = path.resolve(root, path.basename(fileUrl));
  return fullPath.startsWith(`${root}${path.sep}`) ? fullPath : null;
}

const VALID_DOC_TYPES = ['lab_report', 'scan', 'prescription', 'discharge', 'insurance', 'id', 'other'];

function normalizeReminderTimes(values) {
  const items = Array.isArray(values) ? values : String(values || '').split(',');
  const normalized = items.map(value => {
    const match = String(value).trim().match(/^(\d{1,2}):([0-5]\d)$/);
    if (!match) return null;
    const hour = Number(match[1]);
    if (hour < 0 || hour > 23) return null;
    return `${String(hour).padStart(2, '0')}:${match[2]}`;
  });
  if (!normalized.length || normalized.some(value => !value)) return null;
  return [...new Set(normalized)].sort();
}

function normalizeReminderDays(values) {
  if (!Array.isArray(values)) return [];
  const days = values.map(Number);
  if (days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) return null;
  return [...new Set(days)].sort((a, b) => a - b);
}

function isValidTimeZone(timeZone) {
  try { new Intl.DateTimeFormat('en', { timeZone }).format(); return true; }
  catch { return false; }
}

function zonedDoseKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).reduce((out, part) => (out[part.type] = part.value, out), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

async function getOrCreatePatient(userId) {
  let p = await Patient.findOne({ user: userId }).populate('user', 'name email avatar phone');
  if (!p) p = await Patient.create({ user: userId });
  return p;
}

function safeDocType(raw) {
  if (!raw) return 'other';
  const lower = String(raw).toLowerCase().trim().replace(/\s+/g, '_');
  const map = {
    'lab': 'lab_report', 'lab_test': 'lab_report', 'blood_test': 'lab_report', 'test': 'lab_report', 'report': 'lab_report',
    'xray': 'scan', 'x_ray': 'scan', 'mri': 'scan', 'ct': 'scan', 'ultrasound': 'scan',
    'rx': 'prescription', 'medicine': 'prescription',
    'summary': 'discharge', 'discharge_summary': 'discharge',
    'policy': 'insurance', 'claim': 'insurance',
    'identity': 'id', 'aadhar': 'id', 'passport': 'id',
  };
  if (map[lower]) return map[lower];
  if (VALID_DOC_TYPES.includes(lower)) return lower;
  return 'other';
}

function summarizeOcr(structured = {}, raw = '') {
  const parts = [];
  if (structured.diagnosis?.length)   parts.push(`Diagnosis: ${structured.diagnosis.join(', ')}`);
  if (structured.medications?.length) parts.push(`Medications: ${structured.medications.map(m => `${m.name} ${m.dosage || ''}`).join(', ')}`);
  if (structured.lab_results?.length) {
    const abn = structured.lab_results.filter(r => ['high', 'low', 'abnormal'].includes(String(r.status || '').toLowerCase()));
    parts.push(abn.length ? `Abnormal labs: ${abn.map(r => `${r.test} ${r.value || ''}`).join(', ')}` : `${structured.lab_results.length} lab results`);
  }
  return parts.join('. ') || raw.slice(0, 400);
}

// ─────────────────────────────────────────────────────────────────────────────
//  PROFILE
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profile', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await getOrCreatePatient(req.user._id);
    res.json({ success: true, patient });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/profile', protect, authorize('patient'), async (req, res) => {
  try {
    let patient = await Patient.findOne({ user: req.user._id });
    if (!patient) {
      patient = await Patient.create({ user: req.user._id });
    }

    const allowed = [
      'dateOfBirth', 'gender', 'bloodGroup', 'allergies',
      'chronicConditions', 'currentMedications', 'emergencyContact', 'address',
    ];
    allowed.forEach(k => {
      if (req.body[k] !== undefined) patient[k] = req.body[k];
    });

    // Height and weight — explicit Number() coercion, not findOneAndUpdate
    if (req.body.height !== undefined && req.body.height !== '' && req.body.height !== null) {
      const h = Number(req.body.height);
      if (!isNaN(h) && h > 0) patient.height = h;
    }
    if (req.body.weight !== undefined && req.body.weight !== '' && req.body.weight !== null) {
      const w = Number(req.body.weight);
      if (!isNaN(w) && w > 0) patient.weight = w;
    }

    await patient.save();

    // Re-fetch to confirm values were actually written to DB
    const saved = await Patient.findOne({ user: req.user._id })
      .populate('user', 'name email avatar phone');

    res.json({ success: true, patient: saved });
  } catch (err) {
    console.error('[PUT /profile] error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  APPOINTMENTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/appointments', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await getOrCreatePatient(req.user._id);
    const appointments = await Appointment.find({ patient: patient._id })
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email avatar' } })
      .sort({ appointmentDate: -1 });
    res.json({ success: true, appointments });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});


// ─────────────────────────────────────────────────────────────────────────────
//  HEALTH PACKAGES — books directly, creates a bill, NO doctor/appointment involved
// ─────────────────────────────────────────────────────────────────────────────
router.post('/health-packages', protect, authorize('patient'), async (req, res) => {
  try {
    const { packageName, packagePrice, date, timeSlot, tests } = req.body;

    if (!packageName || !packagePrice || !date || !timeSlot?.start) {
      return res.status(400).json({ success: false, message: 'packageName, packagePrice, date and timeSlot are required' });
    }
    const price = Number(packagePrice);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ success: false, message: 'packagePrice must be a positive number' });
    }

    const patient = await getOrCreatePatient(req.user._id);

    const booking = {
      packageName,
      packagePrice: price,
      date,
      timeSlot: { start: timeSlot.start, end: timeSlot.end || '' },
      tests: Array.isArray(tests) ? tests : [],
      status: 'scheduled',
      bookedAt: new Date(),
    };
    patient.healthPackageBookings = patient.healthPackageBookings || [];
    patient.healthPackageBookings.push(booking);

    const bill = {
      description: `Health Package: ${packageName} — visit on ${date} at ${timeSlot.start}`,
      amount: price,
      status: 'pending',
      date: new Date(),
    };
    patient.bills = patient.bills || [];
    patient.bills.push(bill);

    patient.markModified('healthPackageBookings');
    patient.markModified('bills');
    await patient.save();

    try {
      await audit(req, {
        action: 'patient_health_package_book',
        targetType: 'Patient',
        targetId: patient._id,
        metadata: { packageName, price, date },
      });
    } catch {}

    res.status(201).json({
      success: true,
      booking: patient.healthPackageBookings[patient.healthPackageBookings.length - 1],
      bills: patient.bills,
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/health-packages', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id }).select('healthPackageBookings');
    res.json({ success: true, bookings: patient?.healthPackageBookings || [] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  VITALS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/vitals', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id }).select('vitals');
    if (!patient) return res.json({ success: true, vitals: [] });
    const sorted = [...(patient.vitals || [])].sort((a, b) => new Date(b.recordedAt || b.createdAt) - new Date(a.recordedAt || a.createdAt));
    res.json({ success: true, vitals: sorted });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/vitals', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await getOrCreatePatient(req.user._id);
    const reading = { recordedAt: new Date() };
    const fieldMap = {
      heart_rate: 'heartRate', heartRate: 'heartRate',
      systolic: 'systolic', diastolic: 'diastolic',
      temperature: 'temperature',
      oxygen_saturation: 'oxygenSaturation', oxygenSaturation: 'oxygenSaturation',
      glucose: 'glucose', weight: 'weight', height: 'height',
      bloodPressure: 'bloodPressure',
    };
    Object.entries(req.body).forEach(([k, v]) => {
      const mapped = fieldMap[k];
      if (mapped && v !== '' && v !== null && v !== undefined) reading[mapped] = Number(v) || v;
    });
    if (reading.systolic && reading.diastolic && !reading.bloodPressure)
      reading.bloodPressure = `${reading.systolic}/${reading.diastolic}`;
    if (reading.weight && reading.height) {
      const h = Number(reading.height) / 100;
      if (h > 0) reading.bmi = Math.round((Number(reading.weight) / (h * h)) * 10) / 10;
    }

    try {
      const mlPayload = {};
      if (reading.heartRate)        mlPayload.heart_rate        = reading.heartRate;
      if (reading.systolic)         mlPayload.systolic          = reading.systolic;
      if (reading.diastolic)        mlPayload.diastolic         = reading.diastolic;
      if (reading.temperature)      mlPayload.temperature       = reading.temperature;
      if (reading.oxygenSaturation) mlPayload.oxygen_saturation = reading.oxygenSaturation;
      if (reading.glucose)          mlPayload.glucose           = reading.glucose;
      if (Object.keys(mlPayload).length) {
        const anom = await detectAnomaly(mlPayload);
        if (anom?.ok) { reading.anomaly = !!anom.data?.is_anomaly; reading.anomalyDetails = anom.data; }
      }
    } catch {}

    patient.vitals.push(reading);

    try {
      const scoreRes = await predictHealthScore({
        age: patient.age || 30, gender: patient.gender || 'male',
        systolic: reading.systolic || 120, diastolic: reading.diastolic || 80,
        heart_rate: reading.heartRate || 75, glucose: reading.glucose || 90,
        oxygen_saturation: reading.oxygenSaturation || 98,
        conditions: patient.chronicConditions || [],
        medications_count: (patient.currentMedications || []).length,
      });
      if (scoreRes?.ok && scoreRes.data?.health_score != null) {
        patient.healthScore  = scoreRes.data.health_score;
        patient.riskLevel    = scoreRes.data.risk_level || 'low';
        patient.lastMLUpdate = new Date();
      }
    } catch {}

    patient.markModified('vitals');
    await patient.save();
    const sorted = [...patient.vitals].sort((a, b) => new Date(b.recordedAt || b.createdAt) - new Date(a.recordedAt || a.createdAt));
    res.status(201).json({ success: true, vitals: sorted, healthScore: patient.healthScore, riskLevel: patient.riskLevel, anomaly: reading.anomalyDetails });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/vitals/:readingId', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
    patient.vitals = (patient.vitals || []).filter(v => String(v._id) !== req.params.readingId);
    patient.markModified('vitals');
    await patient.save();
    const sorted = [...patient.vitals].sort((a, b) => new Date(b.recordedAt || b.createdAt) - new Date(a.recordedAt || a.createdAt));
    res.json({ success: true, vitals: sorted });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/documents', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id }).select('documents');
    res.json({ success: true, documents: patient?.documents || [] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/documents', protect, authorize('patient'), async (req, res) => {
  const multerError = await new Promise(resolve => {
    upload.single('file')(req, res, err => resolve(err || null));
  });
  if (multerError) return res.status(400).json({ success: false, message: `File upload error: ${multerError.message}` });

  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient profile not found. Please complete your profile first.' });

    const rawType   = req.body.type || 'other';
    const validType = safeDocType(rawType);

    const document = {
      name:       String(req.body.name || req.file?.originalname || 'Document').slice(0, 200),
      type:       validType,
      mimeType:   req.file?.mimetype || '',
      visibility: ['public', 'secure'].includes(req.body.visibility) ? req.body.visibility : 'secure',
      notes:      String(req.body.notes || '').slice(0, 1000),
      uploadedAt: new Date(),
      aiStatus:   'skipped',
      fileUrl:    '',
    };

    if (req.file) {
      try {
        const ext      = path.extname(req.file.originalname || '').toLowerCase();
        const baseName = path.basename(req.file.originalname || 'file', ext).replace(/[^a-zA-Z0-9\-_]/g, '_');
        const fileName = `${Date.now()}-${baseName}${ext}`;
        const filePath = path.join(docDir, fileName);
        if (!fs.existsSync(docDir)) fs.mkdirSync(docDir, { recursive: true });
        fs.writeFileSync(filePath, req.file.buffer);
        document.fileUrl = `/uploads/patient-documents/${fileName}`;
      } catch (writeErr) {
        return res.status(500).json({ success: false, message: `Could not save file to server: ${writeErr.message}` });
      }

      const ocrTypes = ['lab_report', 'prescription', 'scan', 'discharge'];
      if (ocrTypes.includes(document.type)) {
        try {
          const ocr = await extractOcrFromBuffer({ buffer: req.file.buffer, filename: req.file.originalname, contentType: req.file.mimetype });
          if (ocr?.ok && ocr.data) {
            document.extractedText  = String(ocr.data.raw_text || '').slice(0, 10000);
            document.structuredData = ocr.data.structured || {};
            document.aiSummary      = summarizeOcr(ocr.data.structured || {}, ocr.data.raw_text || '');
            document.aiStatus       = 'processed';
          }
        } catch {}
      }
    } else if (req.body.fileUrl && String(req.body.fileUrl).startsWith('http')) {
      document.fileUrl = req.body.fileUrl;
    } else {
      return res.status(400).json({ success: false, message: 'Please upload a file or provide a valid URL.' });
    }

    if (!patient.documents) patient.documents = [];
    patient.documents.push(document);
    patient.markModified('documents');
    await patient.save();

    try { await audit(req, { action: 'document_upload', targetType: 'Patient', targetId: patient._id, metadata: { type: document.type } }); } catch {}

    res.status(201).json({ success: true, documents: patient.documents, message: 'Document uploaded successfully' });
  } catch (err) {
    console.error('Document upload error:', err.message);
    res.status(500).json({
      success: false,
      message: err.name === 'ValidationError'
        ? `Validation error: ${Object.values(err.errors).map(e => e.message).join(', ')}`
        : `Upload failed: ${err.message}`,
    });
  }
});

router.delete('/documents/:docId', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
    const doc = (patient.documents || []).find(d => String(d._id) === req.params.docId);
    if (doc?.fileUrl && doc.fileUrl.startsWith('/uploads/')) {
      try {
        const filePath = path.join(__dirname, '../../', doc.fileUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {}
    }
    patient.documents = (patient.documents || []).filter(d => String(d._id) !== req.params.docId);
    patient.markModified('documents');
    await patient.save();
    res.json({ success: true, documents: patient.documents });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Stream a patient's own uploaded document through the authenticated API.
router.get('/documents/:docId/file', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id }).select('documents');
    const document = (patient?.documents || []).find(d => String(d._id) === req.params.docId);
    if (!document) return res.status(404).json({ success: false, message: 'Document not found' });
    const filePath = resolvePatientDocumentPath(document.fileUrl);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Uploaded file is no longer available' });
    }
    const safeName = String(document.name || 'medical-document').replace(/[\r\n"\\]/g, '_').slice(0, 180);
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(filePath);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not open this uploaded file' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  MEDICINE REMINDERS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/medicine-reminders', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id }).select('medicineReminders');
    res.json({ success: true, reminders: patient?.medicineReminders || [] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/medicine-reminders', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await getOrCreatePatient(req.user._id);
    const medicine = String(req.body.medicine || '').trim().slice(0, 120);
    const times = normalizeReminderTimes(req.body.times);
    const frequency = ['once_daily','twice_daily','thrice_daily','weekly','custom'].includes(req.body.frequency)
      ? req.body.frequency : null;
    const timeZone = String(req.body.timeZone || 'Asia/Kolkata');
    const daysOfWeek = normalizeReminderDays(req.body.daysOfWeek);
    if (!medicine) return res.status(400).json({ success: false, message: 'Medicine name is required' });
    if (!times) return res.status(400).json({ success: false, message: 'Enter dose times in 24-hour format, for example 08:00, 20:00.' });
    if (!frequency) return res.status(400).json({ success: false, message: 'Choose a valid reminder frequency.' });
    const expectedDoseCount = { once_daily: 1, twice_daily: 2, thrice_daily: 3 }[frequency];
    if (expectedDoseCount && times.length !== expectedDoseCount) return res.status(400).json({ success: false, message: `This frequency requires ${expectedDoseCount} dose time(s).` });
    if (!daysOfWeek || (frequency === 'weekly' && !daysOfWeek.length)) return res.status(400).json({ success: false, message: 'Choose at least one weekday for a weekly reminder.' });
    if (!isValidTimeZone(timeZone)) return res.status(400).json({ success: false, message: 'Invalid time zone.' });

    patient.medicineReminders = patient.medicineReminders || [];
    patient.medicineReminders.push({
      medicine,
      dosage: String(req.body.dosage || '').trim().slice(0, 80),
      frequency,
      times,
      daysOfWeek,
      timeZone,
      instructions: String(req.body.instructions || '').trim().slice(0, 500),
      isActive: true,
      adherenceLog: [],
    });
    patient.markModified('medicineReminders');
    await patient.save();
    res.status(201).json({ success: true, reminders: patient.medicineReminders });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/medicine-reminders/:id', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
    const rem = (patient.medicineReminders || []).find(r => String(r._id) === req.params.id);
    if (!rem) return res.status(404).json({ success: false, message: 'Reminder not found' });

    if (req.body.isActive !== undefined) rem.isActive = Boolean(req.body.isActive);
    if (req.body.medicine !== undefined) rem.medicine = String(req.body.medicine).trim().slice(0, 120);
    if (req.body.dosage !== undefined) rem.dosage = String(req.body.dosage).trim().slice(0, 80);
    if (req.body.instructions !== undefined) rem.instructions = String(req.body.instructions).trim().slice(0, 500);
    const nextFrequency = req.body.frequency ?? rem.frequency;
    if (req.body.frequency !== undefined && !['once_daily','twice_daily','thrice_daily','weekly','custom'].includes(nextFrequency)) {
      return res.status(400).json({ success: false, message: 'Choose a valid reminder frequency.' });
    }
    let nextDaysOfWeek = rem.daysOfWeek || [];
    if (req.body.daysOfWeek !== undefined) {
      nextDaysOfWeek = normalizeReminderDays(req.body.daysOfWeek);
      if (!nextDaysOfWeek) return res.status(400).json({ success: false, message: 'Choose valid weekdays for this reminder.' });
    }
    if (nextFrequency === 'weekly' && !nextDaysOfWeek.length) {
      return res.status(400).json({ success: false, message: 'Choose at least one weekday for a weekly reminder.' });
    }
    rem.frequency = nextFrequency;
    rem.daysOfWeek = nextDaysOfWeek;
    if (req.body.times !== undefined) {
      const times = normalizeReminderTimes(req.body.times);
      if (!times) return res.status(400).json({ success: false, message: 'Enter dose times in 24-hour format, for example 08:00, 20:00.' });
      rem.times = times;
    }
    const expectedDoseCount = { once_daily: 1, twice_daily: 2, thrice_daily: 3 }[rem.frequency];
    if (expectedDoseCount && rem.times.length !== expectedDoseCount) return res.status(400).json({ success: false, message: `This frequency requires ${expectedDoseCount} dose time(s).` });
    if (req.body.timeZone !== undefined) {
      if (!isValidTimeZone(req.body.timeZone)) return res.status(400).json({ success: false, message: 'Invalid time zone.' });
      rem.timeZone = req.body.timeZone;
    }
    patient.markModified('medicineReminders');
    await patient.save();
    res.json({ success: true, reminders: patient.medicineReminders });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/medicine-reminders/:id/notify-due', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id }).select('medicineReminders');
    const rem = (patient?.medicineReminders || []).find(item => String(item._id) === req.params.id);
    if (!rem || !rem.isActive) return res.status(404).json({ success: false, message: 'Active reminder not found' });

    const doseTime = String(req.body.doseTime || '');
    const scheduledFor = new Date(req.body.scheduledFor);
    if (!rem.times.includes(doseTime) || Number.isNaN(scheduledFor.getTime())) {
      return res.status(400).json({ success: false, message: 'Dose time is not part of this reminder.' });
    }
    const zone = rem.timeZone || 'Asia/Kolkata';
    const scheduledKey = zonedDoseKey(scheduledFor, zone);
    if (scheduledKey.time !== doseTime) return res.status(400).json({ success: false, message: 'Dose time does not match its scheduled date.' });
    if (rem.frequency === 'weekly') {
      const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: zone }).format(scheduledFor);
      const weekdayIndex = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(weekday);
      if (!(rem.daysOfWeek || []).includes(weekdayIndex)) return res.status(400).json({ success: false, message: 'This reminder is not scheduled for this weekday.' });
    }
    const dueAgeMinutes = (Date.now() - scheduledFor.getTime()) / 60000;
    if (dueAgeMinutes < 0 || dueAgeMinutes > 5) return res.status(400).json({ success: false, message: 'This reminder time has passed.' });
    const logged = (rem.adherenceLog || []).some(log => log.scheduledFor &&
      zonedDoseKey(log.scheduledFor, zone).date === scheduledKey.date &&
      (log.doseTime || zonedDoseKey(log.scheduledFor, zone).time) === doseTime);
    if (logged) return res.json({ success: true, created: false });

    const existing = await Notification.exists({
      recipient: req.user._id,
      type: 'medicine_reminder',
      'data.event': 'dose_due',
      'data.medicineReminder': rem._id,
      'data.scheduledFor': scheduledFor,
    });
    if (existing) return res.json({ success: true, created: false });

    const displayDate = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: zone }).format(scheduledFor);
    await Notification.create({
      recipient: req.user._id,
      type: 'medicine_reminder',
      title: `Time to take ${rem.medicine}`,
      message: `${rem.medicine}${rem.dosage ? ` (${rem.dosage})` : ''} is due today at ${doseTime}.`,
      link: '/patient/medicines',
      data: { event: 'dose_due', medicineReminder: rem._id, scheduledFor, doseTime, date: displayDate },
    });
    res.json({ success: true, created: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/medicine-reminders/:id/log', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
    const rem = (patient.medicineReminders || []).find(r => String(r._id) === req.params.id);
    if (!rem) return res.status(404).json({ success: false, message: 'Reminder not found' });

    const status = ['taken','missed','skipped'].includes(req.body.status) ? req.body.status : null;
    const doseTime = String(req.body.doseTime || '');
    const scheduledFor = new Date(req.body.scheduledFor);
    if (!status) return res.status(400).json({ success: false, message: 'Choose Taken, Missed, or Skipped.' });
    if (!rem.times.includes(doseTime) || Number.isNaN(scheduledFor.getTime())) {
      return res.status(400).json({ success: false, message: 'Dose time is not part of this reminder.' });
    }
    const zone = rem.timeZone || 'Asia/Kolkata';
    const targetKey = zonedDoseKey(scheduledFor, zone);
    if (targetKey.time !== doseTime) return res.status(400).json({ success: false, message: 'Dose time does not match its scheduled date.' });

    rem.adherenceLog = rem.adherenceLog || [];
    let entry = rem.adherenceLog.find(log => {
      if (!log.scheduledFor) return false;
      const key = zonedDoseKey(log.scheduledFor, zone);
      return key.date === targetKey.date && (log.doseTime || key.time) === doseTime;
    });
    const previousStatus = entry?.status;
    if (entry) {
      entry.status = status;
      entry.loggedAt = new Date();
    } else {
      rem.adherenceLog.push({ status, scheduledFor, doseTime, loggedAt: new Date() });
    }
    patient.markModified('medicineReminders');
    await patient.save();

    if (previousStatus !== status) {
      const displayDate = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: zone }).format(scheduledFor);
      await Notification.create({
        recipient: req.user._id,
        type: 'medicine_reminder',
        title: `${rem.medicine} dose marked ${status}`,
        message: `${rem.medicine}${rem.dosage ? ` (${rem.dosage})` : ''} for ${displayDate} at ${doseTime} was marked ${status}.`,
        link: '/patient/medicines',
        data: { medicineReminder: rem._id, scheduledFor, doseTime, status },
      });
    }
    res.json({ success: true, reminders: patient.medicineReminders });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/medicine-reminders/:id', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
    patient.medicineReminders = (patient.medicineReminders || []).filter(r => String(r._id) !== req.params.id);
    patient.markModified('medicineReminders');
    await patient.save();
    res.json({ success: true, reminders: patient.medicineReminders });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  BILLS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/bills', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id }).select('bills');
    res.json({ success: true, bills: patient?.bills || [] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/bills/:id/pay', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
    const bill = (patient.bills || []).find(b => String(b._id) === req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
    bill.status        = 'paid';
    bill.paidAt        = new Date();
    bill.paymentMethod = req.body.paymentMethod || 'online';
    bill.transactionId = req.body.transactionId || `TXN-${Date.now()}`;
    patient.markModified('bills');
    await patient.save();
    res.json({ success: true, bills: patient.bills });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POLICIES & CLAIMS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/policies', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.json({ success: true, policies: [] });
    const policies = await Policy.find({ patient: patient._id }).sort({ createdAt: -1 });
    res.json({ success: true, policies });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/claims', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.json({ success: true, claims: [] });
    const claims = await Claim.find({ patient: patient._id }).populate('policy', 'policyName policyNumber').sort({ createdAt: -1 });
    res.json({ success: true, claims });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  SOS / EMERGENCY (with rate limit)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sos', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id }).select('sosEvents');
    res.json({ success: true, events: patient?.sosEvents || [] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/sos', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id }).populate('user', 'name phone email');
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const SOS_COOLDOWN_MS = 5 * 60 * 1000;
    const lastSos = (patient.sosEvents || []).slice(-1)[0];
    if (lastSos) {
      const msSince = Date.now() - new Date(lastSos.triggeredAt).getTime();
      if (msSince < SOS_COOLDOWN_MS) {
        const remainMins = Math.ceil((SOS_COOLDOWN_MS - msSince) / 60000);
        return res.status(429).json({ success: false, message: `Please wait ${remainMins} minute(s) before sending another SOS alert.` });
      }
    }

    const { message, location } = req.body;
    const sosEvent = {
      message: message || 'Emergency SOS triggered',
      location: location || {},
      status: 'triggered',
      triggeredAt: new Date(),
      notifiedContacts: patient.emergencyContact?.phone ? [{
        name: patient.emergencyContact.name, phone: patient.emergencyContact.phone, relation: patient.emergencyContact.relation,
      }] : [],
    };
    patient.sosEvents = patient.sosEvents || [];
    patient.sosEvents.push(sosEvent);
    patient.markModified('sosEvents');
    await patient.save();

    const io  = req.app.get('io');
    const apts = await Appointment.find({ patient: patient._id, status: { $in: ['scheduled', 'confirmed'] } })
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name _id' } }).limit(5);

    for (const apt of apts) {
      const docUserId = apt.doctor?.user?._id || apt.doctor?.user;
      if (docUserId) {
        try {
          await Notification.create({
            recipient: docUserId, type: 'emergency_sos', title: `🚨 SOS from ${patient.user?.name}`,
            message: `${patient.user?.name} triggered an emergency SOS.${location?.latitude ? ` Location: ${Number(location.latitude).toFixed(4)}, ${Number(location.longitude).toFixed(4)}` : ''}`,
            link: '/doctor/patients', data: { patient: patient._id },
          });
        } catch {}
        if (io) io.to(`user:${docUserId}`).emit('patientSOS', { patientId: patient._id, patientName: patient.user?.name });
      }
    }

    res.status(201).json({ success: true, events: patient.sosEvents });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;