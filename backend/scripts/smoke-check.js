const fs = require('fs');
const path = require('path');

const required = [
  'src/routes/auth.js',
  'src/routes/patient.js',
  'src/routes/doctor.js',
  'src/routes/qr.js',
  'src/routes/chat.js',
  'src/routes/appointment.js',
  'src/routes/appointmentSlots.js',
  'src/routes/claim.js',
  'src/routes/insurance.js',
  'src/routes/admin.js',
  'src/routes/notification.js',
  'src/models/AuditLog.js',
  'src/services/reminderService.js',
];

const missing = required.filter(file => !fs.existsSync(path.join(__dirname, '..', file)));
if (missing.length) {
  console.error('Missing production modules:', missing);
  process.exit(1);
}

for (const file of required) {
  require(path.join(__dirname, '..', file));
}

console.log('HealthBridge backend smoke check passed.');
