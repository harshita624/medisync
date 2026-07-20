'use strict';
const express     = require('express');
const router       = express.Router();
const multer      = require('multer');
const { protect } = require('../middleware/auth');
const { chat: groqChat, visionChat, isOllamaRunning } = require('../utils/groqChat');

const Chat          = require('../models/Chat');
const Patient       = require('../models/Patient');
const Doctor        = require('../models/Doctor');
const Appointment   = require('../models/Appointment');
const MedicalRecord = require('../models/MedicalRecord');
const Policy        = require('../models/Policy');
const Claim         = require('../models/Claim');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// ─────────────────────────────────────────────────────────────────────────────
//  DANA SHIVAM HOSPITAL KNOWLEDGE BASE
//  (static identity / doctor bios / packages / insurance — merged in from the
//   hospital-facing assistant prompt so the AI always has this context)
// ─────────────────────────────────────────────────────────────────────────────
const DANA_SHIVAM_KNOWLEDGE = `
━━ HOSPITAL IDENTITY ━━
Name: Dana Shivam Heart & Super Speciality Hospital
Motto: "Spirit To Care, Skill To Heal"
Location: 2, Opp. Times Square, Sector-2, Vidhyadhar Nagar, Jaipur - 302023
Phone: +91 91160 03461 | Emergency: 112
Email: danashivamhospitalit@gmail.com
Hours: 24x7 Emergency; OPD Mon–Sat

━━ 14 SPECIALITY DEPARTMENTS ━━
1. Cardiology  2. Neurology & Neurosurgery  3. Gastroenterology  4. MD Physician & ICU
5. Cardiac Surgeries  6. Urology  7. Plastic Surgery  8. Orthopedics  9. ENT
10. Physiotherapy  11. Nephrology & Dialysis  12. Critical Care Unit
13. Radiology  14. GI & Laparoscopic Surgery

━━ DOCTORS AT DANA SHIVAM ━━
1. Dr. Sunil Kumar Garssa – Director & Senior Consultant Cardiologist (MD, DM Cardiology – SGPGI Lucknow; FACC, FESC, FSCAI). 10,000+ patients treated; 4,500+ angiographies. Forbes 2021 "Leaders by Example".
2. Dr. Shalini Tomar Garssa – Director & Non-Interventional Cardiologist (MBBS, PGDHHM)
3. Dr. Rajvir Singh Garssa – Consultant Brain & Spine Surgery (MS, M.Ch – AIIMS New Delhi). 9,500+ patients; 1,500+ neurosurgeries.
4. Dr. Subhash Doot – Consultant Gastroenterologist (MD Medicine, DM Gastro)
5. Dr. C.P. Suthar – Physician, Diabetologist & Intensivist (MD Medicine, FCCS USA)
6. Dr. Deepesh Goyal – Consultant Plastic & Cosmetic Surgery (MS, MCh)
7. Dr. Vipin Barala – Consultant Plastic & Cosmetic Surgery (MS, DNB, MCh)
8. Dr. Nitin Gupta – Orthopedic Surgeon (MBBS, MS Ortho)
9. Dr. Sanju Palsania – Radiologist (MD Radio-Diagnosis)
10. Dr. Kuldeep Nehra – Neurologist

━━ HEALTH PACKAGES (book directly at /patient/health-packages) ━━
1. Basic Health Package – ₹1,500 (CBC, ESR, RBS, Urea, Creatinine, Lipid Profile, ECG, X-Ray)
2. Healthy Heart Package – ₹2,300 (ECG, ECHO, TMT, X-Ray, RBS, Lipid Profile)
3. Cardio Diabetic Package – ₹2,000 (HbA1c, 2D Echo/TMT, ECG, Lipid Profile, etc.)
4. Cardiac & Whole Body Package – ₹4,000
5. Healthy Women Package – ₹1,800 (USG, CBC, Pap Smear, TSH, etc.)
6. Arthritis Package – ₹1,100 (CRP, RA Factor, Uric Acid, X-Ray, etc.)
7. Diabetic Health Check Up Premium – ₹5,500 (Vitamin D, B12, HbA1c, USG, etc.)
8. Cardiac & Vascular Check Up – ₹5,000 (Echo Screening, Carotid Doppler, etc.)
9. Premium Whole Body Male – ₹8,300 (PSA, TMT, 2D Echo, full labs)
10. Premium Whole Body Female – ₹7,500 (Pap Smear, TMT, 2D Echo, full labs)

━━ INSURANCE PARTNERS ━━
Bajaj Allianz, HDFC Ergo, Star Health, Chola MS, Cigna TTK, Universal Sompo, ICICI Lombard, Liberty General, Health India, Amul Dairy, Mediassist India TPA, Heritage Health TPA, Bhamashah Swasthya Bima Yojana (Government), DHS General Insurance.

━━ PLATFORM FEATURES ━━
- Book appointments with any Dana Shivam doctor
- Book health packages directly without a separate appointment
- Generate QR health card for instant doctor access
- Track vitals, health score, and medical history
- AI symptom checker
- Medicine reminders with adherence tracking
- Insurance policy and claims management
- Video/phone consultations via Jitsi Meet
- Emergency SOS alert system
- Document vault for lab reports and prescriptions
`;

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}
function fmtTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
}
function fmtVitals(v) {
  if (!v) return null;
  const p = [];
  if (v.bloodPressure || (v.systolic && v.diastolic)) p.push(`BP ${v.bloodPressure || `${v.systolic}/${v.diastolic}`}`);
  if (v.heartRate)        p.push(`HR ${v.heartRate}bpm`);
  if (v.temperature)      p.push(`Temp ${v.temperature}°C`);
  if (v.oxygenSaturation) p.push(`SpO2 ${v.oxygenSaturation}%`);
  if (v.glucose)          p.push(`Glucose ${v.glucose}mg/dL`);
  if (v.weight)           p.push(`Weight ${v.weight}kg`);
  return p.join(' | ') || null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  PDF EXTRACTION — uses the lib path directly to bypass pdf-parse's
//  broken debug-mode check (require('pdf-parse') alone throws ENOENT
//  on a missing test file when called inside a function)
// ─────────────────────────────────────────────────────────────────────────────
async function extractPdfText(buffer) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return {
      ok:    true,
      text:  (data.text || '').replace(/\s+/g, ' ').trim(),
      pages: data.numpages || 0,
    };
  } catch (err) {
    if (err.code === 'ENOENT' || err.message?.includes('test/')) {
      try {
        const pdfjs = require('pdf-parse/lib/pdf-parse.js');
        const data  = await pdfjs(buffer, { max: 0 });
        return {
          ok:    true,
          text:  (data.text || '').replace(/\s+/g, ' ').trim(),
          pages: data.numpages || 0,
        };
      } catch (innerErr) {
        console.error('PDF fallback error:', innerErr.message);
        return { ok: false, error: innerErr.message };
      }
    }
    console.error('PDF extraction error:', err.message);
    return { ok: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  FILE PROCESSING — handles ALL file types
// ─────────────────────────────────────────────────────────────────────────────
async function processFile(file, userMessage, systemContext) {
  if (!file) return { text: '', usedVision: false };

  const mime     = (file.mimetype || '').toLowerCase();
  const origName = file.originalname || 'file';
  const ext      = origName.toLowerCase().split('.').pop();
  const prompt   = userMessage || 'Please analyse this file and explain everything relevant.';

  // ── IMAGES — use Groq vision model ────────────────────────────────────────
  const imageExts  = ['jpg','jpeg','png','webp','gif','bmp','tiff','heic','avif','jfif'];
  const imageMimes = ['image/jpeg','image/png','image/webp','image/gif','image/bmp','image/tiff','image/avif','image/heic'];

  if (imageMimes.includes(mime) || imageExts.includes(ext)) {
    try {
      const useMime = ['avif','heic'].includes(ext) || ['image/avif','image/heic'].includes(mime) ? 'image/jpeg' : mime;
      const description = await visionChat(
        file.buffer,
        useMime,
        `The user uploaded an image named "${origName}". ${prompt}\n\n` +
        `If this is a medical report, prescription, lab result, X-ray, scan, or any health document, ` +
        `extract ALL values, diagnoses, medications, dates and explain them clearly. ` +
        `If it is a general photo, describe what is visible in detail.`
      );
      return { text: `\n\n[IMAGE ANALYSIS: "${origName}"]\n${description}\n[END IMAGE ANALYSIS]`, usedVision: true };
    } catch (visionErr) {
      console.error('Vision error:', visionErr.message);
      return {
        text: `\n\n[Image uploaded: "${origName}" — Vision analysis failed (${visionErr.message}). Please describe what the image shows or type out any values/text from it, and I will interpret it for you.]`,
        usedVision: false,
      };
    }
  }

  // ── PDFs — extract text using the FIXED extraction function ──────────────
  if (mime === 'application/pdf' || ext === 'pdf') {
    const result = await extractPdfText(file.buffer);

    if (result.ok && result.text.length > 30) {
      return {
        text: `\n\n[PDF DOCUMENT: "${origName}" — ${result.pages} page(s)]\n${result.text.slice(0, 8000)}\n[END DOCUMENT]\n\nPlease analyse the above document content and respond to the user's request.`,
        usedVision: false,
      };
    }

    if (result.ok && result.text.length <= 30) {
      return {
        text: `\n\n[PDF uploaded: "${origName}" — this PDF contains no extractable text (likely a scanned/image-based PDF). Please type out the key values, text, or findings from the document and I will interpret them for you.]`,
        usedVision: false,
      };
    }

    return {
      text: `\n\n[PDF uploaded: "${origName}" — could not be read (${result.error || 'unknown error'}). The file may be corrupted or password-protected. Please try re-uploading or describe its contents.]`,
      usedVision: false,
    };
  }

  // ── Word Documents ────────────────────────────────────────────────────────
  if (['doc','docx'].includes(ext) || mime.includes('word') || mime.includes('officedocument')) {
    try {
      const mammoth = require('mammoth');
      const result  = await mammoth.extractRawText({ buffer: file.buffer });
      const text    = (result.value || '').trim();
      if (text.length > 10) {
        return { text: `\n\n[WORD DOCUMENT: "${origName}"]\n${text.slice(0, 6000)}\n[END DOCUMENT]`, usedVision: false };
      }
    } catch (err) {
      console.error('Word doc error:', err.message);
    }
    return { text: `\n\n[Word document uploaded: "${origName}" — could not extract text. Please paste the content directly.]`, usedVision: false };
  }

  // ── Text / CSV / JSON / Markdown ──────────────────────────────────────────
  if (['txt','csv','json','xml','html','md'].includes(ext) || mime.startsWith('text/') || mime === 'application/json') {
    try {
      const text = file.buffer.toString('utf-8').trim();
      if (text.length > 10) {
        return { text: `\n\n[FILE: "${origName}"]\n${text.slice(0, 6000)}\n[END FILE]`, usedVision: false };
      }
    } catch {}
  }

  // ── Audio / Video — acknowledge, cannot process ───────────────────────────
  if (mime.startsWith('audio/') || mime.startsWith('video/') || ['mp3','wav','mp4','avi','mov','mkv','ogg','m4a','aac','webm'].includes(ext)) {
    const kind = mime.startsWith('audio/') || ['mp3','wav','ogg','m4a','aac'].includes(ext) ? 'Audio' : 'Video';
    return {
      text: `\n\n[${kind} file uploaded: "${origName}" — I cannot process audio or video content directly. Please describe what it contains, transcribe relevant parts, or type out any information you need help with, and I will assist from there.]`,
      usedVision: false,
    };
  }

  // ── Fallback — try raw text ────────────────────────────────────────────────
  try {
    const rawText = file.buffer.toString('utf-8').trim();
    if (rawText.length > 20 && /[a-zA-Z0-9]/.test(rawText)) {
      return { text: `\n\n[FILE: "${origName}"]\n${rawText.slice(0, 4000)}\n[END FILE]`, usedVision: false };
    }
  } catch {}

  return { text: `\n\n[File uploaded: "${origName}" (${mime || ext}) — binary content, cannot extract text. Please describe what you need from this file.]`, usedVision: false };
}

// ─────────────────────────────────────────────────────────────────────────────
//  JITSI MEET LINK GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
function generateVideoLink(aptId) {
  const roomId = `HealthBridge-${String(aptId).slice(-10).toUpperCase()}`;
  return { meetingId: roomId, meetingLink: `https://meet.jit.si/${roomId}` };
}

// ─────────────────────────────────────────────────────────────────────────────
//  BOOKING ACTION EXECUTOR
// ─────────────────────────────────────────────────────────────────────────────
async function executeBooking(action, userId) {
  try {
    const patient = await Patient.findOne({ user: userId });
    if (!patient) return '❌ Could not find your patient profile.';

    const doctor = await Doctor.findById(action.doctorId).populate('user', 'name specialization');
    if (!doctor) return '❌ Doctor not found. Please try booking from the Appointments section.';

    const normalDate = String(action.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalDate)) return '❌ Invalid date format.';

    const [y, m, d_] = normalDate.split('-').map(Number);
    const [hh, mm]   = (action.slotStart || '09:00').split(':').map(Number);
    const aptDate    = new Date(y, m - 1, d_, hh, mm, 0);

    if (isNaN(aptDate.getTime())) return '❌ Invalid appointment date/time.';
    if (aptDate < new Date())     return '❌ Cannot book an appointment in the past.';

    const dayStart = new Date(y, m - 1, d_, 0, 0, 0);
    const dayEnd   = new Date(y, m - 1, d_, 23, 59, 59);
    const conflict = await Appointment.findOne({
      doctor: action.doctorId,
      'timeSlot.start': action.slotStart,
      appointmentDate: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ['scheduled', 'confirmed'] },
    });
    if (conflict) return `❌ The slot ${action.slotStart} on ${normalDate} is already taken. Please choose another time.`;

    const dateEntry = (doctor.dateAvailability || []).find(e => e.date === normalDate);
    if (dateEntry?.isOff) return `❌ Dr. ${doctor.user?.name} is off on ${fmt(aptDate)}.`;
    if (dateEntry) {
      const slotOk = (dateEntry.slots || []).some(s => s.start === action.slotStart && s.isActive);
      if (!slotOk) return `❌ Slot ${action.slotStart} is not available on that date. Please pick from the available slots listed above.`;
    } else {
      return `❌ Dr. ${doctor.user?.name} has no availability set for ${normalDate}. Please pick a date that's listed in the available slots above.`;
    }

    const aptType = action.type || 'in-person';
    const apt = await Appointment.create({
      patient:         patient._id,
      doctor:          action.doctorId,
      appointmentDate: aptDate,
      timeSlot:        { start: action.slotStart, end: action.slotEnd || '' },
      type:            aptType,
      reason:          action.reason || 'Consultation',
      status:          'scheduled',
      fee:             doctor.consultationFee || 0,
    });

    if (aptType === 'video') {
      const vid       = generateVideoLink(apt._id);
      apt.meetingId   = vid.meetingId;
      apt.meetingLink = vid.meetingLink;
      await apt.save();
    }

    await Patient.findByIdAndUpdate(patient._id, { $addToSet: { doctors: doctor._id } });

    const dateStr = aptDate.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    let msg = `✅ **Appointment booked!**\n`
      + `• Doctor: Dr. ${doctor.user?.name} (${doctor.specialization})\n`
      + `• Date: ${dateStr}\n`
      + `• Time: ${action.slotStart}${action.slotEnd ? ' – ' + action.slotEnd : ''}\n`
      + `• Type: ${aptType === 'video' ? 'Video Consultation' : aptType === 'phone' ? 'Phone Consultation' : 'In-Person Visit'}\n`
      + `• Reason: ${action.reason || 'Consultation'}\n`;

    if (aptType === 'video' && apt.meetingLink) {
      msg += `• Video Link: ${apt.meetingLink}\n`;
      msg += `\nYou can join the video call at your appointment time using the link above. No app download needed — opens directly in your browser.`;
    }
    msg += `\n\nYou can view and manage this appointment in the **Appointments** section.`;
    return msg;
  } catch (e) {
    console.error('Booking error:', e.message);
    return `❌ Booking failed: ${e.message}. Please try from the Appointments section.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SYSTEM PROMPT — static hospital knowledge + dynamic live-data instructions
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemPrompt(role, context, availableDoctors) {
  const isDoctor = role === 'doctor';

  return `You are MediSync AI — the intelligent, empathetic medical assistant for Dana Shivam Heart & Super Speciality Hospital (also referred to internally as HealthBridge Medical AI).
You have COMPLETE live data below. Use it directly. Never say you don't have data.

${DANA_SHIVAM_KNOWLEDGE}

━━ LIVE SESSION DATA ━━
${context || 'No session data loaded.'}

${!isDoctor && availableDoctors ? `\n━━ DOCTORS AVAILABLE FOR BOOKING ━━\n${availableDoctors}\n` : ''}

${isDoctor ? `
━━ DOCTOR MODE — YOU ARE A CLINICAL DECISION SUPPORT ASSISTANT, NOT THE TREATING PHYSICIAN ━━
You are supporting the doctor who is logged in. You are NOT a doctor and have no clinical licence — never speak or act as if you are the treating physician.

STRICT RULES:
- NEVER say "I diagnose", "I am prescribing", "I am treating", "my patient", or anything that implies you hold clinical authority.
- Always frame clinical output as a DRAFT for the doctor's review: "Suggested Rx for your review:", "Consider ordering...", "This pattern may indicate — please confirm clinically.", "Recommend discussing with the patient:".
- Address the doctor as "Doctor" or "you" — you are talking TO the doctor, not consulting the patient directly.
- Every prescription, diagnosis, or treatment plan is a DRAFT requiring the doctor's own examination, judgment, and signature before it is valid — say this explicitly whenever you output an Rx, SOAP note, or differential.

You can:
- Summarise patient status using data above
- Draft prescription suggestions (Rx format) using patient conditions and allergies — always labelled as a draft for the doctor to review, adjust, and sign
- Draft SOAP notes from visit history for the doctor to finalise
- Check drug interactions against current medications and flag them for the doctor's attention
- Interpret lab values and suggest investigations to consider
- Show today's queue, schedule, and appointment status from data above
- Fully analyse any attached file, image, or document the doctor uploads

You CANNOT modify your own availability schedule via chat — direct the doctor to the Schedule section for that. This is intentional: schedule changes need the calendar UI for accuracy.
` : `
━━ PATIENT MODE ━━
You help this patient. You can:
- Answer health questions using their conditions, vitals, records above
- Explain medications, appointments, and lab results
- Give health advice specific to this patient's profile
- Fully analyse any attached file, image, document, or report uploaded
- Recommend the relevant Dana Shivam specialist by name (see DOCTORS list above) based on symptoms
- Suggest a relevant health package from the list above when appropriate
- BOOK APPOINTMENTS — see instructions below
`}

${!isDoctor ? `
━━ BOOKING APPOINTMENTS ━━
You CAN book real appointments. Process:
1. Check DOCTORS AVAILABLE FOR BOOKING above for doctors with slots
2. Match patient's need to the right doctor and slot
3. Confirm with patient: "Shall I book you with Dr. X on [date] at [time]?"
4. Once patient confirms (yes/ok/sure/confirm/book it/go ahead), end your response with EXACTLY:

<<<BOOK_NOW>>>
{"doctorId":"EXACT_ID_FROM_ABOVE","date":"YYYY-MM-DD","slotStart":"HH:MM","slotEnd":"HH:MM","type":"in-person","reason":"brief reason"}
<<<END_BOOK>>>

Rules:
- Use the EXACT doctorId from the data above (the MongoDB _id string)
- date and slotStart MUST exactly match one of the "Next date" / "Available slots" entries listed for that doctor above — never invent a date or time
- type: "in-person", "video", or "phone"
- Video appointments automatically get a free Jitsi Meet video link
- ONLY include the <<<BOOK_NOW>>> block AFTER patient confirms
` : ''}

━━ FILE & DOCUMENT HANDLING ━━
When a file is attached, its content is provided to you inline below the user's message (between markers like [PDF DOCUMENT...] or [IMAGE ANALYSIS...]). Analyse it fully:
- For medical reports: extract all values, flag abnormal results, explain clinical significance
- For prescriptions: list all medications with dosage, frequency, and duration clearly labelled
- For lab reports: interpret every parameter, compare to normal ranges
- For images: describe and interpret everything relevant medically
- For any document: extract all useful information and relate it to the patient's health
- NEVER say "text extraction failed" or "I cannot view this" if document content IS present in the message — read and use it

━━ FORMATTING RULES ━━
- When listing medications, NEVER write ambiguous strings like "1 • 2 • 5 days". Instead write clearly: "Paracetamol 500mg — twice daily for 5 days" (Medicine name, dosage, frequency, duration each labelled or in clear prose)
- Use the real data above in every answer
- Be warm and conversational — like a knowledgeable friend
- Max 300 words for chat; full length for prescriptions, SOAP notes, reports
- ONLY say "Call 112 immediately" for genuine life-threatening emergencies: chest pain radiating to arm/jaw, inability to breathe, active stroke (face drooping/arm weakness/speech slurred), severe uncontrolled bleeding, seizure, overdose
- For ALL other messages (hi, okay, slots, schedule, etc.) — respond normally, no emergency language

━━ GENERAL BEHAVIOUR GUIDELINES ━━
- Always be warm, professional, and culturally sensitive for Indian patients
- For billing or insurance queries, refer them to the hospital billing desk (+91 91160 03461) or the Insurance section in the app
- Always encourage professional in-person consultation for any significant medical decision`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  DATA LOADERS
// ─────────────────────────────────────────────────────────────────────────────
async function loadPatientData(patientMongoId) {
  const today = new Date(); today.setHours(0,0,0,0);
  const tmrw  = new Date(today); tmrw.setDate(tmrw.getDate() + 1);

  const [patient, records, allApts, policies, claims] = await Promise.all([
    Patient.findById(patientMongoId).populate('user', 'name email phone'),
    MedicalRecord.find({ patient: patientMongoId })
      .populate({ path:'doctor', populate:{ path:'user', select:'name' } })
      .sort({ visitDate:-1 }).limit(10),
    Appointment.find({ patient: patientMongoId })
      .populate({ path:'doctor', populate:{ path:'user', select:'name specialization hospital' } })
      .sort({ appointmentDate:-1 }).limit(30),
    Policy.find({ patient: patientMongoId, status:'active' }).limit(3),
    Claim.find({ patient: patientMongoId }).sort({ createdAt:-1 }).limit(5),
  ]);
  if (!patient) return null;

  const upcoming  = allApts.filter(a => new Date(a.appointmentDate) >= today && ['scheduled','confirmed'].includes(a.status));
  const todayApts = allApts.filter(a => new Date(a.appointmentDate) >= today && new Date(a.appointmentDate) < tmrw);
  const cancelled = allApts.filter(a => a.status === 'cancelled').slice(0,5);
  const completed = allApts.filter(a => a.status === 'completed').slice(0,5);
  const sortedToday = [...todayApts].sort((a,b) => new Date(a.appointmentDate)-new Date(b.appointmentDate));
  const queuePos = sortedToday.findIndex(a => ['scheduled','confirmed'].includes(a.status));

  const vitalsSorted = (patient.vitals||[]).sort((a,b)=>new Date(b.recordedAt)-new Date(a.recordedAt));
  const lv = vitalsSorted[0] || {};

  // ── Medications formatted clearly (fixes "1 • 2 • 5 days" confusion) ──────
  const allMeds = [
    ...(patient.currentMedications||[]).map(m => {
      const parts = [];
      if (m.dosage)    parts.push(`Dose: ${m.dosage}`);
      if (m.frequency) parts.push(`Frequency: ${m.frequency.replace(/_/g,' ')}`);
      return `${m.name}${parts.length ? ' (' + parts.join(', ') + ')' : ''}`;
    }),
    ...records.flatMap(r => (r.prescription||[]).map(p => {
      const parts = [];
      if (p.dosage)    parts.push(`Dose: ${p.dosage}`);
      if (p.frequency) parts.push(`Frequency: ${p.frequency}`);
      if (p.duration)  parts.push(`Duration: ${p.duration}`);
      return `${p.medicine}${parts.length ? ' (' + parts.join(', ') + ')' : ''}`;
    })),
  ];
  const uniqueMeds     = [...new Set(allMeds)].slice(0,12);
  const activeReminders= (patient.medicineReminders||[]).filter(r=>r.isActive);
  const docSummaries   = (patient.documents||[]).filter(d=>d.aiSummary).slice(0,5);

  const lines = [];
  lines.push(`━━ PATIENT IDENTITY ━━`);
  lines.push(`Name: ${patient.user?.name} | ID: ${patient.patientId}`);
  lines.push(`Age: ${patient.age||'—'} | Gender: ${patient.gender||'—'} | Blood: ${patient.bloodGroup||'?'}`);
  lines.push(`Health Score: ${patient.healthScore??'—'}/100 | Risk: ${patient.riskLevel||'low'}`);
  if (patient.height && patient.weight) lines.push(`Height: ${patient.height}cm | Weight: ${patient.weight}kg | BMI: ${(patient.weight/((patient.height/100)**2)).toFixed(1)}`);

  lines.push(`\n━━ MEDICAL BACKGROUND ━━`);
  lines.push(`Conditions: ${patient.chronicConditions?.length ? patient.chronicConditions.join(', ') : 'None'}`);
  lines.push(`Allergies: ${patient.allergies?.length ? '⚠️ '+patient.allergies.join(', ') : 'No known allergies (NKDA)'}`);
  lines.push(`Medications: ${uniqueMeds.length ? uniqueMeds.join(' | ') : 'None on record'}`);
  if (patient.emergencyContact?.name) lines.push(`Emergency Contact: ${patient.emergencyContact.name} (${patient.emergencyContact.relation}) — ${patient.emergencyContact.phone}`);

  lines.push(`\n━━ VITALS ━━`);
  const vStr = fmtVitals(lv);
  if (vStr) {
    lines.push(`Latest (${fmt(lv.recordedAt)}): ${vStr}`);
    const flags=[];
    if (lv.systolic>=140||lv.diastolic>=90)  flags.push('⚠️ BP HIGH');
    if (lv.oxygenSaturation<94)               flags.push('⚠️ SpO2 LOW');
    if (lv.temperature>=38.5)                 flags.push('⚠️ FEVER');
    if (lv.glucose>200)                       flags.push('⚠️ GLUCOSE HIGH');
    if (lv.glucose&&lv.glucose<70)            flags.push('⚠️ HYPOGLYCAEMIA RISK');
    if (flags.length) lines.push(flags.join(' | '));
  } else { lines.push('No vitals recorded yet.'); }
  if (vitalsSorted.length>1) lines.push(`Previous: ${vitalsSorted.slice(1,3).map(v=>`${fmt(v.recordedAt)}: ${fmtVitals(v)||'—'}`).join(' | ')}`);

  lines.push(`\n━━ TODAY'S APPOINTMENTS (${fmt(today)}) ━━`);
  if (todayApts.length) {
    sortedToday.forEach((a,i)=>{
      const j=a.journeyStatus?` [${a.journeyStatus.toUpperCase()}]`:'';
      lines.push(`Queue #${i+1}: ${fmtTime(a.appointmentDate)} — Dr. ${a.doctor?.user?.name||'?'} (${a.doctor?.specialization||'?'}) | ${a.status}${j}`);
      if (a.type==='video'&&a.meetingLink) lines.push(`  Video: ${a.meetingLink}`);
    });
    if (queuePos>=0) lines.push(`→ Your queue position: #${queuePos+1}`);
  } else { lines.push('No appointments today.'); }

  lines.push(`\n━━ UPCOMING APPOINTMENTS ━━`);
  if (upcoming.length) {
    upcoming.slice(0,5).forEach(a=>{
      lines.push(`• ${fmt(a.appointmentDate)} at ${fmtTime(a.appointmentDate)} — Dr. ${a.doctor?.user?.name||'?'} (${a.doctor?.specialization||'?'}, ${a.doctor?.hospital||'?'}) | ${a.type} | ${a.status}`);
      if (a.reason) lines.push(`  Reason: ${a.reason}`);
      if (a.type==='video'&&a.meetingLink) lines.push(`  Video: ${a.meetingLink}`);
    });
  } else { lines.push('No upcoming appointments. I can book one for you!'); }

  if (cancelled.length) {
    lines.push(`\n━━ RECENTLY CANCELLED ━━`);
    cancelled.forEach(a=>lines.push(`• ${fmt(a.appointmentDate)} — Dr. ${a.doctor?.user?.name||'?'} | ${a.cancellationReason||'No reason given'}`));
  }
  if (completed.length) {
    lines.push(`\n━━ RECENT COMPLETED VISITS ━━`);
    completed.slice(0,3).forEach(a=>lines.push(`• ${fmt(a.appointmentDate)} — Dr. ${a.doctor?.user?.name||'?'} (${a.type})`));
  }

  lines.push(`\n━━ MEDICAL RECORDS (last ${Math.min(records.length,5)}) ━━`);
  if (records.length) {
    records.slice(0,5).forEach(r=>{
      const meds=(r.prescription||[]).map(p=>{
        const parts=[];
        if (p.dosage)    parts.push(`Dose: ${p.dosage}`);
        if (p.frequency) parts.push(`Frequency: ${p.frequency}`);
        if (p.duration)  parts.push(`Duration: ${p.duration}`);
        return `${p.medicine}${parts.length ? ' (' + parts.join(', ') + ')' : ''}`;
      }).filter(Boolean);
      lines.push(`• ${fmt(r.visitDate)}: ${r.diagnosis||r.chiefComplaint||'Consultation'} — Dr. ${r.doctor?.user?.name||'?'}`);
      if (r.symptoms?.length) lines.push(`  Symptoms: ${r.symptoms.join(', ')}`);
      if (meds.length)        lines.push(`  Prescribed: ${meds.join(' | ')}`);
      if (r.notes)            lines.push(`  Notes: ${r.notes.slice(0,120)}`);
    });
  } else { lines.push('No medical records yet.'); }

  if (activeReminders.length) {
    lines.push(`\n━━ MEDICINE REMINDERS ━━`);
    activeReminders.slice(0,8).forEach(r=>lines.push(`• ${r.medicine} ${r.dosage||''} — ${(r.frequency||'').replace(/_/g,' ')} at ${(r.times||[]).join(', ')||'time not set'}`));
  }

  if (docSummaries.length) {
    lines.push(`\n━━ UPLOADED DOCUMENTS & REPORTS ━━`);
    docSummaries.forEach(d=>lines.push(`• ${d.name} (${d.type||'document'}): ${d.aiSummary}`));
  }

  if (policies.length) {
    lines.push(`\n━━ INSURANCE ━━`);
    policies.forEach(p=>lines.push(`• ${p.policyName} | Coverage: ₹${p.coverageAmount?.toLocaleString('en-IN')} | Remaining: ₹${p.remainingCoverage?.toLocaleString('en-IN')} | Status: ${p.status}`));
  }
  if (claims.length) claims.forEach(c=>lines.push(`• ${c.claimNumber}: ₹${c.claimAmount?.toLocaleString('en-IN')} — ${c.status}`));

  const pendingBills=(patient.bills||[]).filter(b=>b.status==='pending');
  if (pendingBills.length) {
    lines.push(`\n━━ PENDING BILLS ━━`);
    pendingBills.forEach(b=>lines.push(`• ₹${b.amount?.toLocaleString('en-IN')} — ${b.description||'Medical bill'} (due ${fmt(b.date)})`));
  }

  return lines.join('\n');
}

// ── Available doctors — ONLY date-specific availability, never weekly fallback ──
async function loadAvailableDoctors() {
  try {
    const today   = new Date().toISOString().slice(0,10);
    const doctors = await Doctor.find({}).populate('user','name').select('_id doctorId specialization hospital consultationFee dateAvailability user');
    const lines   = [];
    for (const d of doctors) {
      const future = (d.dateAvailability||[]).filter(e=>e.date>=today&&!e.isOff&&(e.slots||[]).some(s=>s.isActive));
      if (!future.length) continue;
      future.sort((a,b)=>a.date.localeCompare(b.date));

      lines.push(`• Dr. ${d.user?.name} | ${d.specialization} | ${d.hospital||'?'} | Fee: ₹${d.consultationFee||0} | doctorId: ${d._id}`);

      future.slice(0, 5).forEach(entry => {
        const active    = (entry.slots||[]).filter(s=>s.isActive);
        const [y,m,day] = entry.date.split('-').map(Number);
        const dayName   = new Date(y,m-1,day).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});
        lines.push(`  - ${dayName} (${entry.date}): ${active.map(s=>s.start).join(', ')}`);
      });
    }
    return lines.length ? lines.join('\n') : 'No doctors have upcoming availability set yet. All dates may be fully booked or no schedules have been added.';
  } catch { return 'Could not load doctor availability.'; }
}

async function loadDoctorContext(doctorUserId, selectedPatientId) {
  const today = new Date(); today.setHours(0,0,0,0);
  const tmrw  = new Date(today); tmrw.setDate(tmrw.getDate() + 1);

  const doctor = await Doctor.findOne({ user: doctorUserId }).populate('user','name email');
  if (!doctor) return 'Doctor profile not found.';

  const doctorApts = await Appointment.find({ doctor: doctor._id })
    .populate({ path:'patient', populate:{ path:'user', select:'name phone' } })
    .sort({ appointmentDate:1 });

  const todayQueue = doctorApts.filter(a=>new Date(a.appointmentDate)>=today&&new Date(a.appointmentDate)<tmrw);
  const upcoming   = doctorApts.filter(a=>new Date(a.appointmentDate)>=tmrw&&['scheduled','confirmed'].includes(a.status)).slice(0,15);
  const cancelled  = doctorApts.filter(a=>a.status==='cancelled').slice(0,5);

  const lines = [];
  lines.push(`━━ YOUR PROFILE ━━`);
  lines.push(`Dr. ${doctor.user?.name} | ${doctor.specialization||'—'} | ${doctor.hospital||'—'}`);

  lines.push(`\n━━ TODAY'S QUEUE (${today.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}) ━━`);
  if (todayQueue.length) {
    const stats = {
      total:    todayQueue.length,
      waiting:  todayQueue.filter(a=>['scheduled','confirmed'].includes(a.status)&&!a.journeyStatus).length,
      inRoom:   todayQueue.filter(a=>a.journeyStatus==='in-consultation').length,
      done:     todayQueue.filter(a=>a.status==='completed').length,
      cancelled:todayQueue.filter(a=>a.status==='cancelled').length,
    };
    lines.push(`Total: ${stats.total} | Waiting: ${stats.waiting} | In consultation: ${stats.inRoom} | Done: ${stats.done} | Cancelled: ${stats.cancelled}`);
    todayQueue.forEach((a,i)=>{
      const j=a.journeyStatus?` [${a.journeyStatus.toUpperCase()}]`:'';
      lines.push(`  ${i+1}. ${fmtTime(a.appointmentDate)} — ${a.patient?.user?.name||'?'} | ${a.type} | ${a.status}${j}`);
      if (a.reason) lines.push(`     Reason: ${a.reason}`);
      if (a.type==='video'&&a.meetingLink) lines.push(`     Video: ${a.meetingLink}`);
    });
  } else { lines.push('No appointments today.'); }

  if (upcoming.length) {
    lines.push(`\n━━ UPCOMING APPOINTMENTS ━━`);
    upcoming.forEach(a=>lines.push(`• ${fmt(a.appointmentDate)} ${fmtTime(a.appointmentDate)} — ${a.patient?.user?.name||'?'} | ${a.type} | ${a.status}`));
  }

  if (cancelled.length) {
    lines.push(`\n━━ RECENTLY CANCELLED ━━`);
    cancelled.forEach(a=>lines.push(`• ${fmt(a.appointmentDate)} — ${a.patient?.user?.name||'?'} | ${a.cancellationReason||'No reason'}`));
  }

  const todayStr  = new Date().toISOString().slice(0,10);
  const dateAvail = (doctor.dateAvailability||[]).filter(d=>d.date>=todayStr).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,30);

  lines.push(`\n━━ YOUR AVAILABILITY SCHEDULE ━━`);
  if (dateAvail.length) {
    dateAvail.forEach(d=>{
      const [y,m,day]=d.date.split('-').map(Number);
      const dayName=new Date(y,m-1,day).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});
      if (d.isOff) { lines.push(`• ${dayName} (${d.date}): OFF`); }
      else {
        const active=(d.slots||[]).filter(s=>s.isActive);
        lines.push(`• ${dayName} (${d.date}): ${active.map(s=>`${s.start}–${s.end}`).join(', ')} (${active.length} slots)`);
      }
    });
  } else { lines.push('No date-specific availability set yet. Go to Schedule section to add dates.'); }

  let patientSection = '\n━━ NO PATIENT SELECTED ━━\nSelect a patient from the sidebar for full clinical data.';
  if (selectedPatientId) {
    try {
      const patData = await loadPatientData(selectedPatientId);
      if (patData) patientSection = `\n\n${'━'.repeat(50)}\nSELECTED PATIENT — FULL CLINICAL DATA\n${'━'.repeat(50)}\n${patData}`;
    } catch {}
  }

  return lines.join('\n') + patientSection;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SESSION ROUTES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sessions', protect, async (req, res) => {
  try {
    const sessions = await Chat.find({ user: req.user._id }).sort({ updatedAt:-1 }).limit(50).select('title role createdAt updatedAt');
    res.json({ success: true, sessions });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/session', protect, async (req, res) => {
  try {
    const chat = await Chat.create({ user: req.user._id, role: req.user.role, title: 'New Chat', messages: [] });
    res.status(201).json({ success: true, chat });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/session/:id', protect, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, user: req.user._id });
    if (!chat) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, chat });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/session/:id', protect, async (req, res) => {
  try {
    await Chat.deleteOne({ _id: req.params.id, user: req.user._id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /message — MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
router.post('/message', protect, upload.single('file'), async (req, res) => {
  try {
    const { message = '', sessionId, patientId } = req.body;
    const file     = req.file;
    const userRole = req.user.role;

    if (!message.trim() && !file) {
      return res.status(400).json({ success: false, message: 'Message or file is required' });
    }

    let chat = sessionId ? await Chat.findOne({ _id: sessionId, user: req.user._id }) : null;
    if (!chat) {
      chat = await Chat.create({ user: req.user._id, role: userRole, title: 'New Chat', messages: [] });
    }

    // ── Build full context ────────────────────────────────────────────────
    let fullContext = '';
    let availableDoctors = '';
    try {
      if (userRole === 'patient') {
        const patient = await Patient.findOne({ user: req.user._id });
        if (patient) fullContext = await loadPatientData(patient._id);
        availableDoctors = await loadAvailableDoctors();
      } else if (userRole === 'doctor') {
        fullContext = await loadDoctorContext(req.user._id, patientId || null);
      }
    } catch (ctxErr) {
      console.error('Context error:', ctxErr.message);
    }

    const systemPrompt = buildSystemPrompt(userRole, fullContext, userRole === 'patient' ? availableDoctors : null);

    // ── Process attached file ─────────────────────────────────────────────
    let fileResult = { text: '', usedVision: false };
    if (file) {
      fileResult = await processFile(file, message.trim(), systemPrompt);
    }

    // ── Build user message content ─────────────────────────────────────────
    const userContent = message.trim()
      ? `${message.trim()}${fileResult.text}`
      : fileResult.text || `[File: ${file?.originalname}]`;

    // ── Save user message ─────────────────────────────────────────────────
    chat.messages.push({ role:'user', content: userContent, fileName: file?.originalname, createdAt: new Date() });
    if (chat.messages.length === 1) {
      chat.title = message.trim().slice(0,50) || file?.originalname || 'Chat';
    }

    // ── Build Groq messages ───────────────────────────────────────────────
    const history = chat.messages
      .slice(-11, -1)
      .filter(m => ['user','assistant'].includes(m.role))
      .map(m => ({ role: m.role, content: m.content }));

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user',   content: userContent },
    ];

    // ── Call Groq ───────────────────────────────────────────────────────────
    let reply = '';
    const aiAvailable = await isOllamaRunning();

    if (aiAvailable) {
      try {
        reply = await groqChat(groqMessages);
      } catch (err) {
        console.error('Groq error:', err.message);
        reply = `AI error: ${err.message}. Please check GROQ_API_KEY in your backend .env file.`;
      }
    } else {
      reply = `AI not configured. Add GROQ_API_KEY=your_key to backend/.env — get a free key at https://console.groq.com`;
    }

    // ── Execute booking if AI included action block ───────────────────────
    const bookingMatch = reply.match(/<<<BOOK_NOW>>>([\s\S]*?)<<<END_BOOK>>>/);
    if (bookingMatch && userRole === 'patient') {
      try {
        const action = JSON.parse(bookingMatch[1].trim());
        const result = await executeBooking(action, req.user._id);
        reply = reply.replace(/<<<BOOK_NOW>>>([\s\S]*?)<<<END_BOOK>>>/, result);
      } catch (parseErr) {
        reply = reply.replace(/<<<BOOK_NOW>>>([\s\S]*?)<<<END_BOOK>>>/, '');
        console.error('Booking parse error:', parseErr.message);
      }
    }

    reply = reply.trim();

    chat.messages.push({ role:'assistant', content: reply, createdAt: new Date() });
    await chat.save();

    res.json({ success: true, chat, reply });

  } catch (e) {
    console.error('Chat error:', e.message, e.stack);
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;