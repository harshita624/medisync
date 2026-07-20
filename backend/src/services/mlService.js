'use strict';
/**
 * HealthBridge ML Service Client
 * Calls the Python FastAPI ML service when available.
 * Gracefully degrades with sensible defaults when ML service is offline.
 */
const axios    = require('axios');
const FormData = require('form-data');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000/api';
const SHORT  = 10000;  // 10s for fast endpoints
const LONG   = 30000;  // 30s for OCR / heavy endpoints

// ── Helper ────────────────────────────────────────────────────────────────────
async function mlPost(path, data, timeout = SHORT, isForm = false) {
  try {
    const cfg = { timeout };
    if (isForm) cfg.headers = data.getHeaders?.() || {};
    const res = await axios.post(`${ML_URL}${path}`, data, cfg);
    return { ok: true, data: res.data };
  } catch (e) {
    const msg = e.code === 'ECONNREFUSED'
      ? 'ML service not running'
      : e.response?.data?.detail || e.message;
    return { ok: false, error: msg };
  }
}

// ── Anomaly Detection ─────────────────────────────────────────────────────────
// Calls /api/anomaly/detect with vitals readings
// Falls back to rule-based flagging so vitals still get saved
async function detectAnomaly({ heart_rate, systolic, diastolic, temperature, oxygen_saturation, glucose } = {}) {
  const result = await mlPost('/anomaly/detect', { heart_rate, systolic, diastolic, temperature, oxygen_saturation, glucose });
  if (result.ok) return result;

  // Rule-based fallback — flag obviously abnormal values
  const alerts = [];
  if (systolic  >= 140 || diastolic >= 90)  alerts.push('blood_pressure');
  if (oxygen_saturation && oxygen_saturation < 94) alerts.push('oxygen_saturation');
  if (temperature && temperature >= 38.5)   alerts.push('temperature');
  if (glucose   && (glucose < 70 || glucose > 200)) alerts.push('glucose');
  if (heart_rate && (heart_rate < 50 || heart_rate > 110)) alerts.push('heart_rate');

  return {
    ok: true,
    data: {
      is_anomaly:      alerts.length > 0,
      anomalous_vitals:alerts,
      confidence:      alerts.length > 0 ? 0.85 : 0.1,
      source:          'rule_based_fallback',
    },
  };
}

// ── Health Score Prediction ───────────────────────────────────────────────────
async function predictHealthScore({ age, gender, systolic, diastolic, heart_rate, glucose, oxygen_saturation, conditions = [], medications_count = 0 } = {}) {
  const result = await mlPost('/health-score/predict', { age, gender, systolic, diastolic, heart_rate, glucose, oxygen_saturation, conditions, medications_count });
  if (result.ok) return result;

  // Rule-based health score fallback
  let score = 80;
  let risk  = 'low';

  if (systolic >= 140 || diastolic >= 90)           score -= 15;
  if (oxygen_saturation && oxygen_saturation < 94)  score -= 20;
  if (glucose && (glucose < 70 || glucose > 200))   score -= 10;
  if (temperature && temperature >= 38.5)           score -= 8;
  if (conditions.length > 2)                        score -= (conditions.length - 2) * 5;
  if (medications_count > 5)                        score -= 5;

  score = Math.max(10, Math.min(100, score));
  if (score < 50) risk = 'high';
  else if (score < 65) risk = 'medium';

  return {
    ok: true,
    data: { health_score: Math.round(score), risk_level: risk, source: 'rule_based_fallback' },
  };
}

// ── Clinical Packet Builder ───────────────────────────────────────────────────
async function buildClinicalPacket({ symptoms, age, duration, conditions, medications, recent_vitals } = {}) {
  const result = await mlPost('/clinical/packet', { symptoms, age, duration, conditions, medications, recent_vitals });
  if (result.ok) return result;
  // Return empty clinical insights — better than crashing
  return {
    ok: true,
    data: {
      risk_flags:      [],
      clinical_notes:  'Clinical AI unavailable — please assess manually.',
      recommendations: [],
      source:          'fallback',
    },
  };
}

// ── Drug Interaction Check ────────────────────────────────────────────────────
async function checkDrugInteractions({ drugs = [], age, conditions = [] } = {}) {
  if (drugs.length < 2) return { ok: true, data: { interactions: [], overall_risk: 'safe', summary: 'Single drug — no interactions to check.' } };

  const result = await mlPost('/drug/interactions', { drugs, age, conditions });
  if (result.ok) return result;

  return {
    ok: true,
    data: {
      interactions:  [],
      overall_risk:  'unknown',
      summary:       'Drug interaction check unavailable. Review manually.',
      source:        'fallback',
    },
  };
}

// ── OCR Document Extraction ───────────────────────────────────────────────────
async function extractOcrFromBuffer({ buffer, filename, contentType }) {
  try {
    const form = new FormData();
    form.append('file', buffer, { filename: filename || 'document', contentType: contentType || 'application/octet-stream' });
    const result = await mlPost('/ocr/extract', form, LONG, true);
    return result;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Symptom Check ─────────────────────────────────────────────────────────────
async function checkSymptoms({ symptoms, age, gender, duration, medical_history = [] } = {}) {
  return mlPost('/symptom/check', { symptoms, age, gender, duration, medical_history });
}

module.exports = {
  detectAnomaly,
  predictHealthScore,
  buildClinicalPacket,
  checkDrugInteractions,
  extractOcrFromBuffer,
  checkSymptoms,
};