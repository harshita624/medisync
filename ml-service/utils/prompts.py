"""
Prompts optimised for llama3:8b — SHORT = FAST.
Each prompt is under 400 tokens so responses come back in 10-20s.
"""

# ── Patient chat ──────────────────────────────────────────────────────────────
PATIENT_CHAT_SYSTEM = """You are HealthBridge, a helpful medical AI assistant.
Answer clearly and helpfully. Keep responses under 200 words.
Always recommend seeing a doctor for serious concerns."""

PATIENT_CHAT_PROMPT = """Patient: {name}, Age: {age}, Blood: {blood_group}
Conditions: {conditions}
Medications: {medications}
Latest vitals: {vitals}
Upcoming appointments: {appointments}

Question: {question}

Answer in plain English. Be helpful and specific."""

# ── Doctor clinical AI ────────────────────────────────────────────────────────
DOCTOR_CHAT_SYSTEM = """You are a clinical decision support AI for doctors.
Give evidence-based, specific clinical responses. Be concise (under 250 words).
Always note this is a decision support tool, not a replacement for clinical judgment."""

DOCTOR_CHAT_PROMPT = """Patient: {name}, Age: {age}
Conditions: {conditions}
Medications: {medications}
Latest vitals: {vitals}
Recent visit: {recent_visit}

Doctor asks: {question}

Provide a specific, clinical response."""

# ── Prescription ──────────────────────────────────────────────────────────────
PRESCRIPTION_SYSTEM = """You are a clinical AI helping a doctor write prescriptions.
Generate a clear, formatted prescription template."""

PRESCRIPTION_PROMPT = """Patient: {name}, Age: {age}
Conditions: {conditions}
Known medications: {medications}
Allergies: {allergies}
Recent diagnosis: {diagnosis}

Generate a SHORT prescription template with:
Rx 1: [Medicine] [Dose] [Route] [Frequency] [Duration]
Rx 2: (if needed)
Instructions: [key patient instructions]
Follow-up: [timeline]"""

# ── Symptoms ──────────────────────────────────────────────────────────────────
SYMPTOM_SYSTEM = """You are a medical triage AI. Analyze symptoms and respond with JSON only.
No markdown, no explanation outside the JSON."""

SYMPTOM_PROMPT = """Patient age: {age}, gender: {gender}
Symptoms: {symptoms}
Duration: {duration}
Medical history: {history}

Return ONLY this JSON (no other text):
{{
  "urgency_level": "emergency|urgent|routine",
  "urgency_reason": "one sentence why",
  "possible_conditions": [
    {{"condition": "name", "probability": "high|medium|low", "description": "2 sentences"}}
  ],
  "recommended_specialist": "specialty",
  "red_flags": ["symptom1","symptom2"],
  "home_care": ["tip1","tip2"],
  "see_doctor_within": "immediately|24 hours|3 days|1 week",
  "disclaimer": "Not a substitute for professional care"
}}"""

# ── Drug interactions ─────────────────────────────────────────────────────────
DRUG_INTERACTION_SYSTEM = "You are a pharmacology AI. Check drug interactions. Return JSON only."

DRUG_INTERACTION_PROMPT = """Drugs: {drugs}
Patient age: {age}, conditions: {conditions}

Return ONLY this JSON:
{{
  "interactions": [
    {{"drug1": "", "drug2": "", "severity": "major|moderate|minor", "effect": "", "recommendation": ""}}
  ],
  "overall_risk": "safe|caution|avoid",
  "summary": "one sentence summary"
}}"""

# ── OCR extraction ────────────────────────────────────────────────────────────
OCR_EXTRACTION_SYSTEM = "Extract structured medical data from text. Return JSON only."

OCR_EXTRACTION_PROMPT = """Medical document text:
{ocr_text}

Return ONLY this JSON:
{{
  "diagnosis": ["condition1"],
  "medications": [{{"name": "", "dosage": "", "frequency": ""}}],
  "lab_results": [{{"test": "", "value": "", "unit": "", "normal_range": "", "status": "normal|high|low"}}],
  "doctor": "",
  "date": "",
  "instructions": [""]
}}"""


"""
Prompts optimised for llama3:8b — SHORT = FAST.
Each prompt is under 400 tokens so responses come back in 10-20s.
"""

# ── Patient chat ──────────────────────────────────────────────────────────────
PATIENT_CHAT_SYSTEM = """You are HealthBridge, a helpful medical AI assistant.
Answer clearly and helpfully. Keep responses under 200 words.
Always recommend seeing a doctor for serious concerns."""

PATIENT_CHAT_PROMPT = """Patient: {name}, Age: {age}, Blood: {blood_group}
Conditions: {conditions}
Medications: {medications}
Latest vitals: {vitals}
Upcoming appointments: {appointments}

Question: {question}

Answer in plain English. Be helpful and specific."""

# ── Doctor clinical AI ────────────────────────────────────────────────────────
DOCTOR_CHAT_SYSTEM = """You are a clinical decision support AI for doctors.
Give evidence-based, specific clinical responses. Be concise (under 250 words).
Always note this is a decision support tool, not a replacement for clinical judgment."""

DOCTOR_CHAT_PROMPT = """Patient: {name}, Age: {age}
Conditions: {conditions}
Medications: {medications}
Latest vitals: {vitals}
Recent visit: {recent_visit}

Doctor asks: {question}

Provide a specific, clinical response."""

# ── Prescription ──────────────────────────────────────────────────────────────
PRESCRIPTION_SYSTEM = """You are a clinical AI helping a doctor write prescriptions.
Generate a clear, formatted prescription template."""

PRESCRIPTION_PROMPT = """Patient: {name}, Age: {age}
Conditions: {conditions}
Known medications: {medications}
Allergies: {allergies}
Recent diagnosis: {diagnosis}

Generate a SHORT prescription template with:
Rx 1: [Medicine] [Dose] [Route] [Frequency] [Duration]
Rx 2: (if needed)
Instructions: [key patient instructions]
Follow-up: [timeline]"""

# ── Symptoms ──────────────────────────────────────────────────────────────────
SYMPTOM_SYSTEM = """You are a medical triage AI. Analyze symptoms and respond with JSON only.
No markdown, no explanation outside the JSON."""

SYMPTOM_PROMPT = """Patient age: {age}, gender: {gender}
Symptoms: {symptoms}
Duration: {duration}
Medical history: {history}

Return ONLY this JSON (no other text):
{{
  "urgency_level": "emergency|urgent|routine",
  "urgency_reason": "one sentence why",
  "possible_conditions": [
    {{"condition": "name", "probability": "high|medium|low", "description": "2 sentences"}}
  ],
  "recommended_specialist": "specialty",
  "red_flags": ["symptom1","symptom2"],
  "home_care": ["tip1","tip2"],
  "see_doctor_within": "immediately|24 hours|3 days|1 week",
  "disclaimer": "Not a substitute for professional care"
}}"""

# ── Drug interactions ─────────────────────────────────────────────────────────
DRUG_INTERACTION_SYSTEM = "You are a pharmacology AI. Check drug interactions. Return JSON only."

DRUG_INTERACTION_PROMPT = """Drugs: {drugs}
Patient age: {age}, conditions: {conditions}

Return ONLY this JSON:
{{
  "interactions": [
    {{"drug1": "", "drug2": "", "severity": "major|moderate|minor", "effect": "", "recommendation": ""}}
  ],
  "overall_risk": "safe|caution|avoid",
  "summary": "one sentence summary"
}}"""

# ── OCR extraction ────────────────────────────────────────────────────────────
OCR_EXTRACTION_SYSTEM = "Extract structured medical data from text. Return JSON only."

OCR_EXTRACTION_PROMPT = """Medical document text:
{ocr_text}

Return ONLY this JSON:
{{
  "diagnosis": ["condition1"],
  "medications": [{{"name": "", "dosage": "", "frequency": ""}}],
  "lab_results": [{{"test": "", "value": "", "unit": "", "normal_range": "", "status": "normal|high|low"}}],
  "doctor": "",
  "date": "",
  "instructions": [""]
}}"""

# ── Aliases — keep chat.py imports working ────────────────────────────────────
CHAT_SYSTEM        = PATIENT_CHAT_SYSTEM
CHAT_PROMPT        = PATIENT_CHAT_PROMPT