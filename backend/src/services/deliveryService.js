async function sendSms({ to, message }) {
  if (!process.env.SMS_PROVIDER || !process.env.SMS_API_KEY) {
    return { delivered: false, provider: null, reason: 'SMS provider not configured' };
  }
  return { delivered: false, provider: process.env.SMS_PROVIDER, reason: 'Provider adapter required for selected SMS service' };
}

async function sendEmail({ to, subject, message }) {
  if (!process.env.EMAIL_PROVIDER || !process.env.EMAIL_API_KEY) {
    return { delivered: false, provider: null, reason: 'Email provider not configured' };
  }
  return { delivered: false, provider: process.env.EMAIL_PROVIDER, reason: 'Provider adapter required for selected email service' };
}

module.exports = { sendSms, sendEmail };
