const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const MedicalRecord = require('../models/MedicalRecord');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Claim = require('../models/Claim');

router.get('/', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.json({ success: true, records: [] });

    const records = await MedicalRecord.find({ patient: patient._id })
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name avatar email' } })
      .sort({ visitDate: -1 });

    res.json({ success: true, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id)
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name avatar email' } })
      .populate({ path: 'patient', populate: { path: 'user', select: 'name email' } });

    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ user: req.user._id });
      if (!patient || String(record.patient._id) !== String(patient._id)) {
        return res.status(403).json({ success: false, message: 'Not allowed to access this record' });
      }
    }
    if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ user: req.user._id });
      const hasAccess = doctor && (
        String(record.doctor?._id || record.doctor) === String(doctor._id) ||
        await Appointment.exists({
          doctor: doctor._id,
          patient: record.patient._id || record.patient,
          status: { $in: ['scheduled', 'confirmed', 'completed'] },
        })
      );
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Not allowed to access this record' });
      }
    }
    if (req.user.role === 'insurance') {
      const claimAccess = await Claim.exists({ medicalRecord: record._id, insuranceCompany: req.user._id });
      if (!claimAccess) {
        return res.status(403).json({ success: false, message: 'Insurance access requires a linked claim' });
      }
    }
    if (!['patient', 'doctor', 'admin', 'insurance'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not allowed to access this record' });
    }

    res.json({ success: true, record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
