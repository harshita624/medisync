'use strict';
const bcrypt = require('bcryptjs');
const User   = require('../models/User');
const Doctor = require('../models/Doctor');

const DOCTORS = [
  {
    name:'Sunil Kumar Garssa',        email:'dr.sunil@danashivam.com',
    licenseNumber:'DS-CARD-001',      specialization:'Cardiologist',
    department:'Cardiology',          experience:25, consultationFee:800,
    bio:'Director & Senior Consultant Cardiology. Renowned interventional cardiologist specialising in radial angioplasty, complex cardiac interventions, pacemaker implantation and congenital heart disease. MD, DM (Cardiology) SGPGI-Lucknow · FACC · FESC · FSCAI.',
  },
  {
    name:'Shalini Tomar Garssa',      email:'dr.shalini@danashivam.com',
    licenseNumber:'DS-CARD-002',      specialization:'Cardiologist',
    department:'Cardiology',          experience:15, consultationFee:600,
    bio:'Director & Non-Interventional Cardiologist. Specialises in non-invasive cardiac diagnostics, echocardiography and preventive cardiology. MBBS, PGDHHM.',
  },
  {
    name:'Rajvir Singh Garssa',       email:'dr.rajvir@danashivam.com',
    licenseNumber:'DS-NEURO-001',     specialization:'Neurosurgeon',
    department:'Neurology & Neurosurgery', experience:18, consultationFee:700,
    bio:'Consultant Brain & Spine Surgery. Trained at AIIMS New Delhi. Specialises in brain tumors, spine surgery and minimally invasive neurosurgical techniques. MS, M.Ch. (AIIMS, New Delhi).',
  },
  {
    name:'Subhash Doot',              email:'dr.subhash@danashivam.com',
    licenseNumber:'DS-GASTRO-001',    specialization:'Gastroenterologist',
    department:'Gastroenterology',    experience:14, consultationFee:600,
    bio:'Consultant Gastroenterologist. Specialises in medical and surgical gastroenterology, endoscopy, liver disease and GI oncology. MD (Medicine), DM (Gastro).',
  },
  {
    name:'C.P. Suthar',               email:'dr.cpsuthar@danashivam.com',
    licenseNumber:'DS-ICU-001',       specialization:'General Physician',
    department:'MD Physician & ICU',  experience:16, consultationFee:500,
    bio:'Physician, Diabetologist & Intensivist. Specialises in critical care, diabetes management and internal medicine. MD (Medicine), FCCS (USA).',
  },
  {
    name:'Deepesh Goyal',             email:'dr.deepesh@danashivam.com',
    licenseNumber:'DS-PLASTIC-001',   specialization:'Plastic Surgeon',
    department:'Plastic Surgery',     experience:12, consultationFee:600,
    bio:'Consultant Plastic Surgery & Cosmetic Surgery. Specialises in reconstructive surgery, burn care and cosmetic procedures. M.S., MCh. (Plastic & Cosmetic Surgery).',
  },
  {
    name:'Vipin Barala',              email:'dr.vipin@danashivam.com',
    licenseNumber:'DS-PLASTIC-002',   specialization:'Plastic Surgeon',
    department:'Plastic Surgery',     experience:10, consultationFee:600,
    bio:'Consultant Plastic Surgery & Cosmetic Surgery. Expert in cosmetic and reconstructive procedures. M.S., DNB, MCh. (Plastic & Cosmetic Surgery).',
  },
  {
    name:'Nitin Gupta',               email:'dr.nitin@danashivam.com',
    licenseNumber:'DS-ORTHO-001',     specialization:'Orthopedic Surgeon',
    department:'Orthopedics',         experience:13, consultationFee:500,
    bio:'Orthopedic Surgeon specialising in joint replacement, spine surgery, sports injuries and trauma care. MBBS, MS (Ortho).',
  },
  {
    name:'Sanju Palsania',            email:'dr.sanju@danashivam.com',
    licenseNumber:'DS-RADIO-001',     specialization:'Radiologist',
    department:'Radiology',           experience:11, consultationFee:400,
    bio:'Radiologist specialising in interventional radiology, CT, MRI, X-Ray and ultrasound diagnostics. MD (Radio-Diagnosis).',
  },
  {
    name:'Kuldeep Nehra',             email:'dr.kuldeep@danashivam.com',
    licenseNumber:'DS-NEURO-002',     specialization:'Neurologist',
    department:'Neurology & Neurosurgery', experience:10, consultationFee:550,
    bio:'Neurologist specialising in stroke management, epilepsy, movement disorders and neuro-rehabilitation. MD (Neurology).',
  },
];

const HOSPITAL = 'Dana Shivam Heart & Super Speciality Hospital';

function generateAvailability() {
  const result = [];
  const today  = new Date();
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() === 0) continue;           // skip Sundays
    const dateStr   = d.toISOString().slice(0, 10);
    const isHalfDay = d.getDay() === 6;       // Saturday = half day
    const slots     = [];
    // Morning 09:00–13:00
    for (let h = 9; h < 13; h++) {
      for (let m = 0; m < 60; m += 30) {
        const s = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        const e = m === 30
          ? `${String(h+1).padStart(2,'0')}:00`
          : `${String(h).padStart(2,'0')}:30`;
        slots.push({ start: s, end: e, isActive: true });
      }
    }
    // Afternoon 14:00–17:00 weekdays only
    if (!isHalfDay) {
      for (let h = 14; h < 17; h++) {
        for (let m = 0; m < 60; m += 30) {
          const s = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
          const e = m === 30
            ? `${String(h+1).padStart(2,'0')}:00`
            : `${String(h).padStart(2,'0')}:30`;
          slots.push({ start: s, end: e, isActive: true });
        }
      }
    }
    result.push({ date: dateStr, isOff: false, slots });
  }
  return result;
}

async function seedDanaShivamDoctors() {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const doc of DOCTORS) {
    try {
      let user = await User.findOne({ email: doc.email });

      // ── Create user if not exists ────────────────────────────────────────
      if (!user) {
        const hashed = await bcrypt.hash('DanaShivam@2025', 12);
        user = await User.create({
          name:       doc.name,
          email:      doc.email,
          password:   hashed,
          role:       'doctor',
          isVerified: true,
        });
      }

      // ── Create or update Doctor record ───────────────────────────────────
      const existingDoctor = await Doctor.findOne({ user: user._id });

      if (existingDoctor) {
        // Update licenseNumber and availability if missing
        let changed = false;
        if (!existingDoctor.licenseNumber) {
          existingDoctor.licenseNumber = doc.licenseNumber;
          changed = true;
        }
        if (!existingDoctor.dateAvailability?.length) {
          existingDoctor.dateAvailability = generateAvailability();
          changed = true;
        }
        if (!existingDoctor.isVerified) {
          existingDoctor.isVerified  = true;
          existingDoctor.isAvailable = true;
          changed = true;
        }
        if (changed) {
          await existingDoctor.save();
          updated++;
          console.log(`🔄 [Seed] Updated Dr. ${doc.name}`);
        } else {
          skipped++;
        }
        continue;
      }

      // Create new Doctor record
      await Doctor.create({
        user:             user._id,
        specialization:   doc.specialization,
        hospital:         HOSPITAL,
        department:       doc.department,
        bio:              doc.bio,
        experience:       doc.experience,
        consultationFee:  doc.consultationFee,
        languages:        ['English', 'Hindi'],
        licenseNumber:    doc.licenseNumber,
        isVerified:       true,
        isAvailable:      true,
        dateAvailability: generateAvailability(),
      });

      created++;
      console.log(`✅ [Seed] Created Dr. ${doc.name}`);

    } catch (err) {
      console.error(`❌ [Seed] Failed Dr. ${doc.name}:`, err.message);
    }
  }

  const total = created + updated + skipped;
  if (total > 0) {
    console.log(`\n🏥 Dana Shivam seed — ${created} created, ${updated} updated, ${skipped} unchanged.`);
    if (created > 0) console.log(`   Doctor login password: DanaShivam@2025`);
  }
}

module.exports = seedDanaShivamDoctors;