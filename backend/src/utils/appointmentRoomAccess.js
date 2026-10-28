const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ROOM_EARLY_JOIN_MS = 30 * 60 * 1000;
const ROOM_LATE_JOIN_MS = 2 * 60 * 60 * 1000;

function istDateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function istInstant(parts, hour, minute) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute) - IST_OFFSET_MS);
}

function getRoomWindow(appointment) {
  const appointmentDate = new Date(appointment?.appointmentDate);
  if (Number.isNaN(appointmentDate.getTime())) return null;
  const parts = istDateParts(appointmentDate);
  if (!parts) return null;

  const slotStart = parseClock(appointment?.timeSlot?.start);
  let start;
  let expiresAt;
  if (slotStart) {
    start = istInstant(parts, slotStart.hour, slotStart.minute);
    expiresAt = new Date(start.getTime() + ROOM_LATE_JOIN_MS);
  } else {
    start = appointmentDate;
    const isDateOnly = appointmentDate.getUTCHours() === 0
      && appointmentDate.getUTCMinutes() === 0
      && appointmentDate.getUTCSeconds() === 0;
    if (isDateOnly) {
      expiresAt = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1) - IST_OFFSET_MS - 1);
      start = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - IST_OFFSET_MS);
    } else {
      expiresAt = new Date(start.getTime() + ROOM_LATE_JOIN_MS);
    }
  }

  return { start, opensAt: new Date(start.getTime() - ROOM_EARLY_JOIN_MS), expiresAt };
}

function roomAccessError(appointment, now = new Date()) {
  if (appointment?.type !== 'video') {
    return { status: 409, message: 'This appointment does not have a video room.' };
  }
  if (!['scheduled', 'confirmed', 'in-consultation'].includes(appointment.status)) {
    return { status: 410, message: 'This appointment is no longer active.' };
  }
  const window = getRoomWindow(appointment);
  if (!window) return { status: 410, message: 'This appointment has an invalid schedule.' };
  if (now < window.opensAt) return { status: 425, message: 'The consultation room opens 30 minutes before the appointment.' };
  if (now > window.expiresAt) return { status: 410, message: 'This appointment has expired. Its consultation room is closed.' };
  return null;
}

module.exports = { roomAccessError };
