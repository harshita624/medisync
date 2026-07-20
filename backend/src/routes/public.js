'use strict';
const express = require('express');
const router  = express.Router();
const Patient = require('../models/Patient');

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
      .map(d => ({ name: d.name, type: d.type, fileUrl: d.fileUrl, aiSummary: d.aiSummary }));

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

module.exports = router;