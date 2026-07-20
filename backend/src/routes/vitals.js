const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Patient = require('../models/Patient');
const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000/api';

function calcBMI(weight, height) {
  if (!weight || !height) return undefined;
  const h = height / 100;
  return Math.round((weight / (h * h)) * 10) / 10;
}

function normalizeReading(body, userId) {
  const reading = {
    heartRate: body.heartRate ?? body.heart_rate,
    systolic: body.systolic,
    diastolic: body.diastolic,
    temperature: body.temperature,
    oxygenSaturation: body.oxygenSaturation ?? body.oxygen_saturation,
    glucose: body.glucose,
    weight: body.weight,
    height: body.height,
    recordedAt: body.recordedAt || new Date(),
    recordedBy: userId,
    notes: body.notes,
  };

  for (const key of Object.keys(reading)) {
    if (reading[key] === undefined || reading[key] === '') delete reading[key];
  }

  for (const key of ['heartRate', 'systolic', 'diastolic', 'temperature', 'oxygenSaturation', 'glucose', 'weight', 'height']) {
    if (reading[key] !== undefined) {
      const parsed = Number(reading[key]);
      if (!Number.isNaN(parsed)) reading[key] = parsed;
    }
  }

  reading.bmi = calcBMI(reading.weight, reading.height);
  if (reading.systolic && reading.diastolic) reading.bloodPressure = `${reading.systolic}/${reading.diastolic}`;
  return reading;
}

router.get('/patient/vitals', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient profile not found' });

    const vitals = [...(patient.vitals || [])].sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
    res.json({ success: true, vitals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/patient/vitals', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient profile not found' });

    const reading = normalizeReading(req.body, req.user._id);
    const hasVital = ['heartRate', 'systolic', 'diastolic', 'temperature', 'oxygenSaturation', 'glucose', 'weight', 'height']
      .some(key => reading[key] !== undefined);

    if (!hasVital) {
      return res.status(400).json({ success: false, message: 'Provide at least one vital sign value' });
    }

    const anomalyPayload = {
      heart_rate: reading.heartRate,
      systolic: reading.systolic,
      diastolic: reading.diastolic,
      temperature: reading.temperature,
      oxygen_saturation: reading.oxygenSaturation,
      glucose: reading.glucose,
    };
    Object.keys(anomalyPayload).forEach(k => anomalyPayload[k] == null && delete anomalyPayload[k]);

    let anomaly = { is_anomaly: false, severity: 'normal', alerts: [] };
    try {
      const mlRes = await axios.post(`${ML_URL}/anomaly/detect`, anomalyPayload, { timeout: 5000 });
      anomaly = mlRes.data || anomaly;
    } catch {}

    reading.anomaly = !!anomaly.is_anomaly;
    reading.anomalyDetails = anomaly;

    try {
      const scorePayload = {
        age: patient.age || 30,
        gender: patient.gender || 'male',
        weight_kg: reading.weight || 70,
        height_cm: reading.height || 170,
        systolic: reading.systolic || 120,
        diastolic: reading.diastolic || 80,
        heart_rate: reading.heartRate || 75,
        glucose: reading.glucose || 90,
        oxygen_saturation: reading.oxygenSaturation || 98,
        conditions: patient.chronicConditions || [],
        medications_count: patient.currentMedications?.length || 0,
      };
      const scoreRes = await axios.post(`${ML_URL}/health-score/predict`, scorePayload, { timeout: 7000 });
      patient.healthScore = scoreRes.data.health_score;
      patient.riskLevel = scoreRes.data.risk_level;
      patient.lastMLUpdate = new Date();
      reading.mlHealthScore = scoreRes.data.health_score;
    } catch {}

    patient.vitals.push(reading);
    await patient.save();

    res.status(201).json({
      success: true,
      reading,
      anomaly,
      healthScore: patient.healthScore,
      riskLevel: patient.riskLevel,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/patient/vitals/:readingId', protect, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient profile not found' });

    patient.vitals = (patient.vitals || []).filter(v => String(v._id) !== req.params.readingId);
    patient.markModified('vitals');
    await patient.save();

    res.json({ success: true, message: 'Reading deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;