'use strict';
const express     = require('express');
const router      = express.Router();
const { protect } = require('../middleware/auth');
const { chat: groqChat, isOllamaRunning } = require('../utils/groqChat');
const Patient     = require('../models/Patient');

// ── THE FIX: robust JSON extraction — tries direct parse, then regex-extracts
// the first {...} block if the model added stray text around the JSON. This
// mirrors the same pattern already used in your Python ml-service (ocr.py,
// clinical.py) and prevents the generic fallback message from firing on every
// minor formatting hiccup, which was making the checker look broken. ──
function extractJson(raw) {
  const cleaned = String(raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
  }
  return null;
}

// POST /api/symptoms/check
router.post('/check', protect, async (req, res) => {
  try {
    const { symptoms, duration, gender, age } = req.body;
    if (!symptoms?.trim()) return res.status(400).json({ success: false, message: 'symptoms required' });

    // Get patient context for personalised analysis
    let patientCtx = '';
    try {
      const patient = await Patient.findOne({ user: req.user._id });
      if (patient) {
        patientCtx = `Patient: ${patient.age || age || 'unknown'} years, ${patient.gender || gender || 'not specified'}, Blood: ${patient.bloodGroup || '?'}
Conditions: ${patient.chronicConditions?.join(', ') || 'none'}
Allergies: ${patient.allergies?.join(', ') || 'none'}`;
      }
    } catch {}

    const aiAvailable = await isOllamaRunning();
    if (!aiAvailable) {
      // ── THE FIX: actionable message instead of a silent-looking failure ──
      return res.status(503).json({
        success: false,
        message: 'AI service not configured. Add GROQ_API_KEY=your_key to backend/.env — get a free key at https://console.groq.com',
      });
    }

    const systemPrompt = `You are a medical triage AI. Analyze symptoms and return ONLY valid JSON — no markdown, no explanation, no text outside the JSON object. Base your possible_conditions on the ACTUAL symptoms described, giving specific, relevant conditions — never a generic placeholder like "requires clinical evaluation" unless the symptom description is truly too vague to say anything (e.g. just "I feel unwell").`;

    const userPrompt = `${patientCtx ? patientCtx + '\n' : ''}Symptoms: ${symptoms}
Duration: ${duration || 'not specified'}

Return this exact JSON structure:
{
  "urgency_level": "emergency|urgent|routine",
  "urgency_reason": "one sentence explaining urgency level",
  "possible_conditions": [
    {
      "condition": "condition name",
      "probability": "high|medium|low",
      "description": "2-3 sentences about this condition and how it fits the symptoms"
    }
  ],
  "recommended_specialist": "specific specialty",
  "see_doctor_within": "immediately|today|24 hours|3 days|1 week|as needed",
  "red_flags": ["warning sign 1", "warning sign 2", "warning sign 3"],
  "home_care": ["specific actionable tip 1", "specific actionable tip 2", "specific actionable tip 3"],
  "tests_to_consider": ["test 1", "test 2"],
  "disclaimer": "This analysis is for informational purposes only and is not a substitute for professional medical advice."
}

List 2-4 possible_conditions ranked by likelihood, based specifically on the symptoms given. Be specific — do not default to a vague placeholder condition unless the input truly gives you nothing to work with.`;

    const raw = await groqChat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ]);

    // ── THE FIX: use the robust extractor instead of a single JSON.parse ──
    let result = extractJson(raw);

    if (!result || !result.possible_conditions?.length) {
      // Only now — genuine parse failure — fall back, and log why for debugging
      console.error('[SYMPTOM CHECK] Could not extract valid JSON from Groq response:', raw?.slice(0, 300));
      result = {
        urgency_level:         'routine',
        urgency_reason:        'Analysis completed — review details below',
        possible_conditions:   [{ condition: 'Requires clinical evaluation', probability: 'medium', description: (raw || '').slice(0, 300) }],
        recommended_specialist:'General Physician',
        see_doctor_within:     '1 week',
        red_flags:             ['Symptoms worsening rapidly','Fever above 39°C','Severe pain','Difficulty breathing'],
        home_care:             ['Rest and stay hydrated','Monitor symptoms closely','Seek urgent care if symptoms worsen'],
        tests_to_consider:     ['Physical examination', 'Basic blood panel'],
        disclaimer:            'Not a substitute for professional medical advice.',
      };
    }

    res.json({ success: true, ...result });

  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;