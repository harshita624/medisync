const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');
const { sendSms, sendEmail } = require('./deliveryService');

async function generateAppointmentReminders({ hoursAhead = 24 } = {}) {
  const now = new Date();
  const until = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const appointments = await Appointment.find({
    appointmentDate: { $gte: now, $lte: until },
    status: { $in: ['scheduled', 'confirmed'] },
  })
    .populate({ path: 'patient', populate: { path: 'user', select: 'name email phone' } })
    .populate({ path: 'doctor', populate: { path: 'user', select: 'name email phone' } });

  const created = [];
  for (const apt of appointments) {
    const patientUser = apt.patient?.user;
    const doctorUser = apt.doctor?.user;
    const when = apt.appointmentDate.toLocaleString('en-IN');
    const existing = await Notification.exists({
      type: 'appointment_reminder',
      'data.appointment': apt._id,
    });
    if (existing) continue;

    if (patientUser?._id) {
      created.push(await Notification.create({
        recipient: patientUser._id,
        type: 'appointment_reminder',
        title: 'Appointment reminder',
        message: `You have an appointment with Dr. ${doctorUser?.name || 'Doctor'} on ${when}.`,
        link: '/patient/appointments',
        data: { appointment: apt._id },
      }));
      await sendSms({ to: patientUser.phone, message: `HealthBridge reminder: appointment on ${when}` });
      await sendEmail({ to: patientUser.email, subject: 'HealthBridge appointment reminder', message: `Your appointment is on ${when}.` });
    }
    if (doctorUser?._id) {
      created.push(await Notification.create({
        recipient: doctorUser._id,
        type: 'appointment_reminder',
        title: 'Upcoming patient appointment',
        message: `${patientUser?.name || 'Patient'} is scheduled on ${when}.`,
        link: '/doctor/dashboard',
        data: { appointment: apt._id },
      }));
    }
  }
  return { scanned: appointments.length, created: created.length };
}

module.exports = { generateAppointmentReminders };
