'use strict';
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Patient = require('../models/Patient');
const { checkSymptoms } = require('../services/mlService');

// POST /api/symptoms/check
router.post('/check', protect, async (req, res) => {
  try {
    const { symptoms, duration, gender, age, medical_history } = req.body;
    if (!symptoms?.trim()) {
      return res.status(400).json({ success: false, message: 'symptoms required' });
    }

    let patient = null;
    try {
      patient = await Patient.findOne({ user: req.user._id });
    } catch {}

    const payload = {
      symptoms: symptoms.trim(),
      duration: duration || 'not specified',
      gender: patient?.gender || gender || 'not specified',
      age: patient?.age || age || null,
      medical_history: Array.isArray(medical_history)
        ? medical_history
        : (patient?.chronicConditions || []),
    };

    const ml = await checkSymptoms(payload);
    if (!ml.ok) {
      return res.status(503).json({
        success: false,
        message: `ML symptom service unavailable: ${ml.error}`,
      });
    }

    const data = ml.data || {};
    if (!data.analysis?.possible_conditions?.length) {
      return res.status(502).json({
        success: false,
        message: 'ML symptom service returned an incomplete analysis.',
      });
    }

    res.json({
      success: true,
      extracted_entities: data.extracted_entities || {},
      analysis: data.analysis,
      model_used: data.model_used || 'HealthBridge ML',
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
