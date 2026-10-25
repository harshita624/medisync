'use strict';
const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const Patient = require('../models/Patient');
const docDir  = path.join(__dirname, '../../uploads/patient-documents');

function resolvePatientDocumentPath(fileUrl) {
  const prefix = '/uploads/patient-documents/';
  if (typeof fileUrl !== 'string' || !fileUrl.startsWith(prefix)) return null;
  const root = path.resolve(docDir);
  const fullPath = path.resolve(root, path.basename(fileUrl));
  return fullPath.startsWith(`${root}${path.sep}`) ? fullPath : null;
}

router.get('/patient/:pid', async (req, res) => {
  try {
    const pid = String(req.params.pid || '').trim();
    if (!pid) return res.status(400).json({ success: false, message: 'Patient ID required' });

    const patient = await Patient.findOne({ patientId: pid })
      .populate('user', 'name avatar phone')
      .select('patientId user bloodGroup gender dateOfBirth height weight allergies chronicConditions currentMedications emergencyContact documents healthScore riskLevel vitals');

    if (!patient) {
      return res.status(404).json({ success: false, message: `No patient found with ID "${pid}"` });
    }

    const latestVital = [...(patient.vitals || [])]
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))[0] || null;

    const publicDocuments = (patient.documents || [])
      .filter(d => d.visibility === 'public')
      .map(d => ({
        _id: d._id,
        name: d.name,
        type: d.type,
        fileUrl: resolvePatientDocumentPath(d.fileUrl)
          ? `/api/public/patient/${encodeURIComponent(pid)}/documents/${d._id}`
          : d.fileUrl,
        aiSummary: d.aiSummary,
      }));

    let age = null;
    if (patient.dateOfBirth) {
      age = Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }

    res.json({
      success: true,
      patient: {
        patientId:          patient.patientId,
        name:               patient.user?.name,
        avatar:             patient.user?.avatar,
        bloodGroup:         patient.bloodGroup,
        gender:             patient.gender,
        age,
        height:             patient.height,
        weight:             patient.weight,
        allergies:          patient.allergies         || [],
        chronicConditions:  patient.chronicConditions || [],
        currentMedications: (patient.currentMedications || []).map(m => ({
          name: m.name, dosage: m.dosage, frequency: m.frequency,
        })),
        emergencyContact:   patient.emergencyContact  || {},
        healthScore:        patient.healthScore,
        riskLevel:          patient.riskLevel         || 'low',
        latestVital: latestVital ? {
          bloodPressure:    latestVital.bloodPressure,
          heartRate:        latestVital.heartRate,
          temperature:      latestVital.temperature,
          oxygenSaturation: latestVital.oxygenSaturation,
          glucose:          latestVital.glucose,
          recordedAt:       latestVital.recordedAt,
        } : null,
        publicDocuments,
      },
    });
  } catch (e) {
    console.error('[public/patient]', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Public-card file access is limited to documents the patient explicitly shared.
router.get('/patient/:pid/documents/:docId', async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: String(req.params.pid || '').trim() }).select('documents');
    const document = (patient?.documents || []).find(d => String(d._id) === req.params.docId && d.visibility === 'public');
    if (!document) return res.status(404).json({ success: false, message: 'Shared document not found' });
    const filePath = resolvePatientDocumentPath(document.fileUrl);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Shared file is no longer available' });
    }
    const safeName = String(document.name || 'shared-medical-document').replace(/[\r\n"\\]/g, '_').slice(0, 180);
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(filePath);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not open this shared file' });
  }
});

module.exports = router;