const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Notification = require('../models/Notification');
const audit = require('../utils/audit');

function dayBoundsLocal(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return {
    start: new Date(y, m - 1, d, 0, 0, 0, 0),
    end: new Date(y, m - 1, d, 23, 59, 59, 999),
  };
}

function buildMeetingPayload(appointmentId, type) {
  if (type !== 'video') return {};
  const meetingId = `HB-${String(appointmentId).slice(-8).toUpperCase()}`;
  const baseUrl = process.env.VIDEO_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  return {
    meetingId,
    meetingLink: `${baseUrl.replace(/\/$/, '')}/consultation/${meetingId}`,
  };
}

router.get('/doctor/availability', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    res.json({ success: true, availability: doctor.availability || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/doctor/availability', protect, authorize('doctor'), async (req, res) => {
  try {
    const { availability } = req.body;
    if (!Array.isArray(availability)) {
      return res.status(400).json({ success: false, message: 'availability must be an array' });
    }

    const sanitized = availability.map(day => ({
      dayOfWeek: Number(day.dayOfWeek),
      slots: (day.slots || [])
        .filter(slot => slot.start && slot.end)
        .map(slot => ({
          start: String(slot.start),
          end: String(slot.end),
          isActive: slot.isActive !== false,
        })),
    })).filter(day => Number.isInteger(day.dayOfWeek) && day.dayOfWeek >= 0 && day.dayOfWeek <= 6 && day.slots.length);

    const doctor = await Doctor.findOneAndUpdate(
      { user: req.user._id },
      { $set: { availability: sanitized, isAvailable: sanitized.length > 0 } },
      { new: true }
    );

    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    await audit(req, {
      action: 'doctor_availability_update',
      targetType: 'Doctor',
      targetId: doctor._id,
      metadata: { days: sanitized.length, slots: sanitized.reduce((sum, day) => sum + day.slots.length, 0) },
    });
    res.json({ success: true, availability: doctor.availability });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/doctor/:doctorId/open-slots', protect, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'date query param required' });

    const doctor = await Doctor.findById(req.params.doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    if (!doctor.isVerified || !doctor.isAvailable) {
      return res.json({ success: true, slots: [] });
    }

    const dayOfWeek = new Date(date + 'T12:00:00').getDay();
    const dayAvail = (doctor.availability || []).find(a => a.dayOfWeek === dayOfWeek);
    if (!dayAvail?.slots?.length) return res.json({ success: true, slots: [] });

    const { start: dayStart, end: dayEnd } = dayBoundsLocal(date);
    const booked = await Appointment.find({
      doctor: req.params.doctorId,
      appointmentDate: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ['scheduled', 'confirmed'] },
    }).select('timeSlot');

    const bookedStarts = new Set(booked.map(a => a.timeSlot?.start).filter(Boolean));
    const slots = dayAvail.slots
      .filter(s => s.isActive && !bookedStarts.has(s.start))
      .map(s => ({ start: s.start, end: s.end }));

    res.json({ success: true, slots });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/appointments/book-slot', protect, authorize('patient'), async (req, res) => {
  try {
    const { doctor, date, slotStart, slotEnd, type, reason } = req.body;
    if (!doctor || !date || !slotStart || !reason) {
      return res.status(400).json({ success: false, message: 'doctor, date, slotStart and reason are required' });
    }

    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient profile not found' });

    const selectedDoctor = await Doctor.findById(doctor);
    if (!selectedDoctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    if (!selectedDoctor.isVerified || !selectedDoctor.isAvailable) {
      return res.status(400).json({ success: false, message: 'Doctor is not available for booking' });
    }

    const dayOfWeek = new Date(date + 'T12:00:00').getDay();
    const dayAvail = (selectedDoctor.availability || []).find(a => a.dayOfWeek === dayOfWeek);
    const publishedSlot = dayAvail?.slots?.find(s => s.isActive && s.start === slotStart);
    if (!publishedSlot) {
      return res.status(400).json({ success: false, message: 'Selected slot is not available' });
    }

    const { start: dayStart, end: dayEnd } = dayBoundsLocal(date);
    const conflict = await Appointment.findOne({
      doctor,
      'timeSlot.start': slotStart,
      appointmentDate: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ['scheduled', 'confirmed'] },
    });

    if (conflict) {
      return res.status(409).json({ success: false, message: 'This slot was just taken. Please choose another.' });
    }

    const [y, m, d] = date.split('-');
    const [hh, mm] = slotStart.split(':');
    const appointmentDate = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));

    const appointment = await Appointment.create({
      patient: patient._id,
      doctor,
      appointmentDate,
      timeSlot: { start: slotStart, end: slotEnd || publishedSlot.end || '' },
      type: type || 'in-person',
      reason,
      status: 'scheduled',
      fee: selectedDoctor.consultationFee || 0,
    });
    Object.assign(appointment, buildMeetingPayload(appointment._id, appointment.type));
    await appointment.save();

    await Patient.findByIdAndUpdate(patient._id, { $addToSet: { doctors: doctor } });
    await Notification.insertMany([
      {
        recipient: req.user._id,
        type: 'appointment_scheduled',
        title: 'Appointment booked',
        message: `Your appointment is booked for ${date} at ${slotStart}.`,
        link: '/patient/appointments',
        data: { appointment: appointment._id },
      },
      {
        recipient: selectedDoctor.user,
        type: 'appointment_scheduled',
        title: 'New appointment',
        message: `A patient booked ${date} at ${slotStart}.`,
        link: '/doctor/dashboard',
        data: { appointment: appointment._id },
      },
    ]);
    await audit(req, {
      action: 'patient_appointment_book_slot',
      targetType: 'Appointment',
      targetId: appointment._id,
      patient: patient._id,
      metadata: { doctor, date, slotStart, type: appointment.type },
    });

    const populated = await Appointment.findById(appointment._id)
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email avatar' } })
      .populate({ path: 'patient', populate: { path: 'user', select: 'name email avatar' } });

    res.status(201).json({ success: true, appointment: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
