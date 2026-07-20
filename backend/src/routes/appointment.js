'use strict';
const express      = require('express');
const router       = express.Router();
const { protect }  = require('../middleware/auth');
const Appointment  = require('../models/Appointment');
const Doctor       = require('../models/Doctor');
const Patient      = require('../models/Patient');
const Notification = require('../models/Notification');
const audit        = require('../utils/audit');

// ── Helpers ───────────────────────────────────────────────────────────────────
function dayBounds(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  return {
    start: new Date(y, m - 1, d,  0,  0,  0,   0),
    end:   new Date(y, m - 1, d, 23, 59, 59, 999),
  };
}

// ── THE FIX: consistent function name used everywhere ─────────────────────────
function buildMeetingPayload(aptId) {
  const roomId      = `HealthBridge-${String(aptId).slice(-10).toUpperCase()}`;
  const meetingLink = `https://meet.jit.si/${roomId}`;
  return { meetingId: roomId, meetingLink, platform: 'jitsi' };
}

async function ensurePatient(userId) {
  let p = await Patient.findOne({ user: userId });
  if (!p) p = await Patient.create({ user: userId });
  return p;
}

async function notifyBoth(patientUserId, doctorUserId, aptId, patientMsg, doctorMsg) {
  const docs = [];
  if (patientUserId) docs.push({
    recipient: patientUserId, type: 'appointment_scheduled',
    title: 'Appointment confirmed', message: patientMsg,
    link: '/patient/appointments', data: { appointment: aptId },
  });
  if (doctorUserId) docs.push({
    recipient: doctorUserId, type: 'appointment_scheduled',
    title: 'New appointment', message: doctorMsg,
    link: '/doctor/appointments', data: { appointment: aptId },
  });
  if (docs.length) await Notification.insertMany(docs).catch(() => {});
}

const POPULATE = [
  { path: 'doctor',  populate: { path: 'user', select: 'name email avatar phone' } },
  { path: 'patient', populate: { path: 'user', select: 'name email avatar phone' } },
];

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/appointments
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { doctor: doctorId, appointmentDate, timeSlot, type, reason } = req.body;
    if (!doctorId || !appointmentDate) {
      return res.status(400).json({ success: false, message: 'doctor and appointmentDate are required' });
    }

    const [doctorDoc, patient] = await Promise.all([
      Doctor.findById(doctorId).populate('user', 'name email _id'),
      ensurePatient(req.user._id),
    ]);
    if (!doctorDoc) return res.status(404).json({ success: false, message: 'Doctor not found' });

    if (timeSlot?.start) {
      const bounds   = dayBounds(appointmentDate);
      const conflict = await Appointment.findOne({
        doctor: doctorId, 'timeSlot.start': timeSlot.start,
        appointmentDate: { $gte: bounds.start, $lte: bounds.end },
        status: { $in: ['scheduled', 'confirmed'] },
      });
      if (conflict) return res.status(409).json({ success: false, message: 'That slot was just booked. Please choose another time.' });
    }

    const apt = await Appointment.create({
      patient:         patient._id,
      doctor:          doctorId,
      appointmentDate: new Date(appointmentDate),
      timeSlot:        timeSlot || {},
      type:            type    || 'in-person',
      reason:          reason  || 'General consultation',
      status:          'scheduled',
      fee:             doctorDoc.consultationFee || 0,
    });

    // ── FIXED: was calling buildMeetingLink (undefined) ────────────────────
    if (type === 'video') {
      const meeting   = buildMeetingPayload(apt._id);
      apt.meetingId   = meeting.meetingId;
      apt.meetingLink = meeting.meetingLink;
      await apt.save();
    }

    await Patient.findByIdAndUpdate(patient._id, { $addToSet: { doctors: doctorId } });

    const doctorUserId = doctorDoc.user?._id || doctorDoc.user;
    await notifyBoth(
      req.user._id, doctorUserId, apt._id,
      `Appointment confirmed with Dr. ${doctorDoc.user?.name} on ${new Date(appointmentDate).toLocaleDateString('en-IN')}.`,
      `New appointment from ${req.user.name}.`,
    );

    const io = req.app.get('io');
    if (io && doctorUserId) io.to(`user:${doctorUserId}`).emit('appointmentNew', { appointmentId: apt._id });

    await audit(req, { action: 'appointment_book', targetType: 'Appointment', targetId: apt._id, metadata: { doctorId, type } });

    const populated = await Appointment.findById(apt._id).populate(POPULATE);
    res.status(201).json({ success: true, appointment: populated });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/appointments/book-slot
// ─────────────────────────────────────────────────────────────────────────────
router.post('/book-slot', protect, async (req, res) => {
  try {
    const { doctor: doctorId, date, slotStart, slotEnd, type, reason } = req.body;

    if (!doctorId)  return res.status(400).json({ success: false, message: 'doctor is required' });
    if (!date)      return res.status(400).json({ success: false, message: 'date is required (YYYY-MM-DD)' });
    if (!slotStart) return res.status(400).json({ success: false, message: 'slotStart is required (HH:MM)' });

    const normalDate = String(date).slice(0, 10);
    const bounds     = dayBounds(normalDate);

    const conflict = await Appointment.findOne({
      doctor: doctorId, 'timeSlot.start': slotStart,
      appointmentDate: { $gte: bounds.start, $lte: bounds.end },
      status: { $in: ['scheduled', 'confirmed'] },
    });
    if (conflict) return res.status(409).json({ success: false, message: 'This slot was just booked. Please pick a different time.' });

    const [doctorDoc, patient] = await Promise.all([
      Doctor.findById(doctorId).populate('user', 'name email _id'),
      ensurePatient(req.user._id),
    ]);
    if (!doctorDoc) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const [y, m, d_] = normalDate.split('-').map(Number);
    const [hh, mm]   = slotStart.split(':').map(Number);
    const appointmentDate = new Date(y, m - 1, d_, hh, mm, 0);

    const apt = await Appointment.create({
      patient:         patient._id,
      doctor:          doctorId,
      appointmentDate,
      timeSlot:        { start: slotStart, end: slotEnd || '' },
      type:            type   || 'in-person',
      reason:          reason || 'Consultation',
      status:          'scheduled',
      fee:             doctorDoc.consultationFee || 0,
    });

    // ── FIXED: was calling buildMeetingLink (undefined) ────────────────────
    if (type === 'video') {
      const meeting   = buildMeetingPayload(apt._id);
      apt.meetingId   = meeting.meetingId;
      apt.meetingLink = meeting.meetingLink;
      await apt.save();
    }

    await Patient.findByIdAndUpdate(patient._id, { $addToSet: { doctors: doctorId } });

    const doctorUserId = doctorDoc.user?._id || doctorDoc.user;
    await notifyBoth(
      req.user._id, doctorUserId, apt._id,
      `Appointment booked with Dr. ${doctorDoc.user?.name} on ${new Date(appointmentDate).toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' })} at ${slotStart}.`,
      `${req.user.name} booked a slot on ${normalDate} at ${slotStart}.`,
    );

    const io = req.app.get('io');
    if (io && doctorUserId) io.to(`user:${doctorUserId}`).emit('appointmentNew', { appointmentId: apt._id });

    await audit(req, { action: 'appointment_book_slot', targetType: 'Appointment', targetId: apt._id, metadata: { doctorId, date: normalDate, slotStart, type } });

    const populated = await Appointment.findById(apt._id).populate(POPULATE);
    res.status(201).json({ success: true, appointment: populated });
  } catch (e) {
    console.error('book-slot error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/appointments/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const patient = req.user.role === 'patient' ? await Patient.findOne({ user: req.user._id }) : null;
    const filter  = { _id: req.params.id, ...(patient ? { patient: patient._id } : {}) };
    const apt     = await Appointment.findOne(filter).populate(POPULATE);

    if (!apt) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (['completed', 'cancelled'].includes(apt.status))
      return res.status(400).json({ success: false, message: `Cannot cancel a ${apt.status} appointment` });

    apt.status             = 'cancelled';
    apt.cancelledBy        = req.user._id;
    apt.cancelledAt        = new Date();
    apt.cancellationReason = req.body.reason || 'Cancelled by patient';
    await apt.save();

    const doctorUserId = apt.doctor?.user?._id || apt.doctor?.user;
    if (doctorUserId) {
      await Notification.create({
        recipient: doctorUserId, type: 'appointment_cancelled', title: 'Appointment cancelled',
        message:   `${req.user.name} cancelled the appointment on ${new Date(apt.appointmentDate).toLocaleDateString('en-IN')}.`,
        link:      '/doctor/appointments', data: { appointment: apt._id },
      }).catch(() => {});
    }

    const io = req.app.get('io');
    if (io && doctorUserId) io.to(`user:${doctorUserId}`).emit('appointmentCancelled', { appointmentId: apt._id });

    res.json({ success: true, appointment: apt });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/appointments/meeting/:meetingId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/meeting/:meetingId', protect, async (req, res) => {
  try {
    const apt = await Appointment.findOne({ meetingId: req.params.meetingId }).populate(POPULATE);
    if (!apt) return res.status(404).json({ success: false, message: 'Consultation room not found' });

    const patient = await Patient.findOne({ user: req.user._id });
    const doctor  = await Doctor.findOne({ user: req.user._id });
    const ok = (patient && String(apt.patient?._id) === String(patient._id))
            || (doctor  && String(apt.doctor?._id)  === String(doctor._id))
            || req.user.role === 'admin';
    if (!ok) return res.status(403).json({ success: false, message: 'Access denied' });

    res.json({ success: true, appointment: apt });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/meeting/:meetingId/messages', protect, async (req, res) => {
  try {
    const apt = await Appointment.findOne({ meetingId: req.params.meetingId })
      .select('consultationMessages')
      .populate('consultationMessages.sender', 'name avatar role');
    if (!apt) return res.status(404).json({ success: false, message: 'Room not found' });
    res.json({ success: true, messages: apt.consultationMessages || [] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/meeting/:meetingId/messages', protect, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'message is required' });

    const apt = await Appointment.findOneAndUpdate(
      { meetingId: req.params.meetingId },
      { $push: { consultationMessages: { sender: req.user._id, senderRole: req.user.role, message: message.trim(), createdAt: new Date() } } },
      { new: true },
    ).populate('consultationMessages.sender', 'name avatar');

    if (!apt) return res.status(404).json({ success: false, message: 'Room not found' });

    const io = req.app.get('io');
    if (io) io.to(`meeting:${req.params.meetingId}`).emit('consultationMessage', { meetingId: req.params.meetingId });

    res.json({ success: true, messages: apt.consultationMessages || [] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;