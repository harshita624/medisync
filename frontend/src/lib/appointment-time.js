const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ROOM_EARLY_JOIN_MS = 30 * 60 * 1000;
const ROOM_LATE_JOIN_MS = 2 * 60 * 60 * 1000;

function istDateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function istInstant(parts, hour, minute) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute) - IST_OFFSET_MS);
}

export function getAppointmentRoomWindow(appointment) {
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

export function isAppointmentRoomExpired(appointment, now = new Date()) {
  const window = getAppointmentRoomWindow(appointment);
  return !window || now.getTime() > window.expiresAt.getTime();
}

export function isAppointmentRoomOpen(appointment, now = new Date()) {
  if (!appointment || !["scheduled", "confirmed", "in-consultation"].includes(appointment.status)) return false;
  const window = getAppointmentRoomWindow(appointment);
  return !!window && now >= window.opensAt && now <= window.expiresAt;
}
