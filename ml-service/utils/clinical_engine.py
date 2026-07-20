"""
Rule-based clinical engine — used as fallback when Ollama is offline.
NOT hardcoded to specific conditions — uses body-system classification.
"""
import re

# ── Body-system classification ────────────────────────────────────────────────
BODY_SYSTEMS = {
    "dermatology": {
        "pattern": r"hair|skin|nail|rash|itch|acne|scalp|dandruff|pigment|wound|scar|eczema|psoriasis|fungus|wart|mole|hair.?fall|hair.?loss|alopecia",
        "specialist": "Dermatologist",
        "tests":    "CBC, Thyroid panel (TSH/T3/T4), Serum ferritin, Vitamin D, ANA",
        "care":     ["Keep area clean and moisturised", "Avoid harsh chemicals", "Eat protein-rich foods (eggs, lentils, paneer)", "Manage stress", "Drink 2–3L water daily"],
        "red_flags":["Rapidly spreading rash with fever", "Skin turning blue or grey", "Infected wound with red streaks"],
    },
    "cardiology": {
        "pattern": r"heart|palpitation|blood.?pressure|bp|hypertension|cholesterol|pulse|chest.?pain|irregular.?beat|racing.?heart",
        "specialist": "Cardiologist",
        "tests":    "ECG, Echo, Lipid profile, Troponin, BP monitoring",
        "care":     ["Monitor BP daily", "Reduce salt and saturated fats", "Exercise 30 min/day", "No smoking", "Manage stress"],
        "red_flags":["Chest pain or tightness", "Pain radiating to arm or jaw", "Sudden breathlessness", "Fainting"],
    },
    "neurology": {
        "pattern": r"headache|migraine|dizzy|vertigo|numb|tingle|memory|tremor|balance|blackout|seizure|head.?pain",
        "specialist": "Neurologist",
        "tests":    "MRI brain, CT scan, EEG, Blood glucose, Thyroid",
        "care":     ["Stay hydrated", "Regular sleep (7–9 hrs)", "Limit screen time", "Avoid known triggers"],
        "red_flags":["Thunderclap headache", "Facial drooping or arm weakness", "Speech difficulty", "Loss of consciousness"],
    },
    "respiratory": {
        "pattern": r"cough|breath|lung|wheez|asthma|bronch|throat|congestion|cold|flu|mucus|phlegm|sinus|sneeze|spo2|oxygen",
        "specialist": "Pulmonologist",
        "tests":    "Chest X-ray, Spirometry, SpO2 monitoring, Allergy panel",
        "care":     ["Stay hydrated", "Steam inhalation", "Avoid smoke and pollutants", "Elevate head while sleeping"],
        "red_flags":["SpO2 below 94%", "Severe breathlessness at rest", "Blue lips", "Breathing rate > 30/min"],
    },
    "gastroenterology": {
        "pattern": r"stomach|abdomen|nausea|vomit|diarrhea|diarrhoea|constipat|acidity|reflux|heartburn|bloat|gas|bowel|liver|jaundice",
        "specialist": "Gastroenterologist",
        "tests":    "LFT, Stool culture, H. pylori, Ultrasound abdomen",
        "care":     ["Small frequent meals", "Avoid spicy/fried food", "Drink 8+ glasses of water", "Probiotics"],
        "red_flags":["Blood in stool or vomit", "Severe acute abdominal pain", "Jaundice", "Unable to keep fluids down"],
    },
    "musculoskeletal": {
        "pattern": r"joint|bone|muscle|back|knee|shoulder|hip|neck|spine|arthritis|sprain|strain|fracture|stiffness|gout",
        "specialist": "Orthopaedic Surgeon",
        "tests":    "X-ray, MRI, Uric acid, Rheumatoid factor, Bone density",
        "care":     ["RICE: Rest, Ice, Compression, Elevation", "Physiotherapy", "Hot compress for chronic pain", "Calcium + Vitamin D"],
        "red_flags":["Deformity after injury", "Complete loss of movement", "Severe trauma", "Numbness with back pain"],
    },
    "endocrine": {
        "pattern": r"diabetes|blood.?sugar|glucose|insulin|thyroid|weight.?gain|weight.?loss|hormone|pcos|testosterone|fatigue.*thyroid",
        "specialist": "Endocrinologist",
        "tests":    "HbA1c, Fasting glucose, Thyroid panel, Hormonal profile",
        "care":     ["Monitor blood sugar regularly", "Low GI diet", "Exercise 30 min/day", "Never skip meals", "Medication adherence"],
        "red_flags":["Blood sugar < 70 or > 400 mg/dL", "Diabetic ketoacidosis", "Thyroid storm"],
    },
    "mental_health": {
        "pattern": r"anxiety|depress|stress|panic|mood|sad|hopeless|worry|fear|sleep|insomnia|burnout|mental|motivation",
        "specialist": "Psychiatrist",
        "tests":    "PHQ-9, GAD-7, Thyroid panel, Sleep study",
        "care":     ["Regular sleep schedule", "30-min outdoor walk daily", "Limit caffeine/alcohol", "Mindfulness or breathing exercises"],
        "red_flags":["Thoughts of self-harm or suicide — call 112", "Complete inability to function", "Hallucinations"],
    },
}

# ── Red flag detector ─────────────────────────────────────────────────────────
EMERGENCY_PATTERNS = re.compile(
    r"chest.?pain|cannot.?breathe|seizure|stroke|unconscious|severe.?bleed|overdose|suicidal|heart.?attack|paralys",
    re.IGNORECASE
)

def detected_red_flags(text: str) -> bool:
    return bool(EMERGENCY_PATTERNS.search(text or ""))

def detect_body_system(text: str) -> str | None:
    t = (text or "").lower()
    for name, data in BODY_SYSTEMS.items():
        if re.search(data["pattern"], t, re.IGNORECASE):
            return name
    return None

def format_vitals(v: dict) -> str:
    if not v:
        return "not recorded"
    parts = []
    if v.get("bloodPressure") or (v.get("systolic") and v.get("diastolic")):
        parts.append(f"BP {v.get('bloodPressure') or str(v['systolic'])+'/'+str(v['diastolic'])}")
    if v.get("heartRate"):        parts.append(f"HR {v['heartRate']}bpm")
    if v.get("temperature"):      parts.append(f"Temp {v['temperature']}°C")
    if v.get("oxygenSaturation"): parts.append(f"SpO2 {v['oxygenSaturation']}%")
    if v.get("glucose"):          parts.append(f"Glucose {v['glucose']}mg/dL")
    return " | ".join(parts) or "not recorded"


# ── Drug interaction rules (fallback for drug.py) ─────────────────────────────
KNOWN_INTERACTIONS = [
    {
        "drugs": {"warfarin", "aspirin"},
        "severity": "high",
        "effect": "Increased bleeding risk — both inhibit clotting via different mechanisms.",
    },
    {
        "drugs": {"warfarin", "ibuprofen"},
        "severity": "high",
        "effect": "NSAIDs potentiate warfarin anticoagulation and cause GI bleeding risk.",
    },
    {
        "drugs": {"metformin", "contrast"},
        "severity": "high",
        "effect": "Contrast dye can cause acute kidney injury, raising metformin-induced lactic acidosis risk.",
    },
    {
        "drugs": {"ssri", "tramadol"},
        "severity": "high",
        "effect": "Serotonin syndrome risk — both increase serotonergic activity.",
    },
    {
        "drugs": {"ace inhibitor", "potassium"},
        "severity": "moderate",
        "effect": "ACE inhibitors reduce potassium excretion; supplementation risks hyperkalaemia.",
    },
    {
        "drugs": {"statin", "clarithromycin"},
        "severity": "moderate",
        "effect": "Macrolide antibiotics inhibit CYP3A4, raising statin levels and myopathy risk.",
    },
    {
        "drugs": {"statin", "erythromycin"},
        "severity": "moderate",
        "effect": "Same CYP3A4 inhibition as clarithromycin — elevated statin exposure.",
    },
    {
        "drugs": {"aspirin", "ibuprofen"},
        "severity": "moderate",
        "effect": "Ibuprofen may block aspirin's antiplatelet effect when taken together.",
    },
    {
        "drugs": {"lisinopril", "spironolactone"},
        "severity": "moderate",
        "effect": "Both raise potassium — combination increases hyperkalaemia risk.",
    },
    {
        "drugs": {"digoxin", "amiodarone"},
        "severity": "high",
        "effect": "Amiodarone inhibits digoxin clearance, raising toxicity risk.",
    },
]

def drug_interaction_rules(drugs: list[str]) -> dict:
    """
    Rule-based drug interaction checker — fallback when LLaMA is offline.
    Checks the provided drug list against KNOWN_INTERACTIONS.

    Parameters
    ----------
    drugs : list of drug name strings (case-insensitive)

    Returns
    -------
    dict with keys: interactions, overall_risk, summary
    """
    drugs_lower = {d.lower() for d in drugs}
    found = []

    for rule in KNOWN_INTERACTIONS:
        pair = list(rule["drugs"])
        match_a = any(pair[0] in d for d in drugs_lower)
        match_b = any(pair[1] in d for d in drugs_lower)
        if match_a and match_b:
            found.append({
                "drug_pair": list(rule["drugs"]),
                "severity":  rule["severity"],
                "effect":    rule["effect"],
            })

    if not found:
        return {
            "interactions": [],
            "overall_risk": "low",
            "summary": "No known interactions detected by rule-based engine. Verify with a pharmacist.",
        }

    severities = {r["severity"] for r in found}
    overall = "high" if "high" in severities else "moderate" if "moderate" in severities else "low"
    summary_lines = [f"• {r['drug_pair'][0]} + {r['drug_pair'][1]}: {r['effect']}" for r in found]

    return {
        "interactions": found,
        "overall_risk": overall,
        "summary":      "\n".join(summary_lines),
    }


# ── analyze_symptoms — public API (imported by routers/symptom.py) ─────────────
def analyze_symptoms(
    symptoms: str,
    age: int = None,
    duration: str = "not specified",
    medical_history: list = None,
) -> dict:
    """
    Body-system-aware symptom analysis used by routers/symptom.py.

    Parameters
    ----------
    symptoms        : raw symptom description from the user
    age             : patient age (optional) — used for risk escalation
    duration        : how long symptoms have been present (optional)
    medical_history : list of known conditions (optional)

    Returns
    -------
    dict with keys:
        possible_conditions, urgency_level, urgency_reason,
        see_doctor_within, recommended_specialist,
        suggested_tests, home_care, red_flags, disclaimer
    """
    if medical_history is None:
        medical_history = []

    text = (symptoms or "").lower()

    # ── Emergency fast-exit ───────────────────────────────────────────────────
    if detected_red_flags(symptoms):
        return {
            "possible_conditions": [
                {
                    "condition": "Possible medical emergency",
                    "probability": "high",
                    "description": (
                        "Symptoms include emergency warning signs requiring immediate care. "
                        "Do not wait — call emergency services now."
                    ),
                }
            ],
            "urgency_level":          "emergency",
            "urgency_reason":         "Emergency signs detected — immediate care required.",
            "see_doctor_within":      "immediately",
            "recommended_specialist": "Emergency physician",
            "suggested_tests":        ["ECG", "Full blood panel", "CT / imaging as indicated"],
            "home_care":              ["Call 112 or go to the nearest ER immediately."],
            "red_flags": [
                "Chest pain", "Difficulty breathing",
                "Unconsciousness", "Severe bleeding",
            ],
            "disclaimer": "Informational only — not a substitute for professional medical advice.",
        }

    # ── Detect primary body system ─────────────────────────────────────────────
    system_name = detect_body_system(symptoms)

    if system_name:
        sys_data = BODY_SYSTEMS[system_name]

        conditions = [
            {
                "condition": f"{system_name.replace('_', ' ').title()} related condition",
                "probability": "medium",
                "description": (
                    f"Symptoms suggest involvement of the {system_name.replace('_', ' ')} system. "
                    "A clinical evaluation is recommended to confirm the diagnosis."
                ),
            }
        ]

        tests      = [t.strip() for t in sys_data["tests"].split(",")]
        home_care  = list(sys_data["care"])
        specialist = sys_data["specialist"]
        red_flags  = list(sys_data["red_flags"])

        # ── Default urgency ───────────────────────────────────────────────────
        urgency        = "routine"
        urgency_reason = "Symptoms appear non-urgent based on available information."
        see_within     = "within 1 week"

        # ── Age-based risk escalation ─────────────────────────────────────────
        if age is not None and (age >= 65 or age <= 5):
            urgency        = "urgent"
            urgency_reason = "Age group warrants prompt medical evaluation."
            see_within     = "within 24 hours"

        # ── Duration-based escalation ─────────────────────────────────────────
        if duration and re.search(
            r"\b(\d+\s*(week|month|year)|chronic|persist|ongoing)\b",
            duration or "",
            re.IGNORECASE,
        ):
            urgency        = "urgent"
            urgency_reason = "Prolonged symptom duration warrants clinical evaluation."
            see_within     = "within 48 hours"

        # ── Red-flag keyword match inside the symptom text ────────────────────
        for flag in red_flags:
            keywords = re.sub(r"[^a-z\s]", "", flag.lower()).split()
            meaningful = [w for w in keywords if len(w) > 3]
            if meaningful and any(w in text for w in meaningful):
                urgency        = "urgent"
                urgency_reason = f"Possible red-flag sign present: {flag}"
                see_within     = "within 24 hours"
                break

        # ── Medical history cross-check ────────────────────────────────────────
        high_risk_conditions = {
            "diabetes", "heart disease", "hypertension", "cancer", "copd",
            "asthma", "immunocompromised", "hiv", "kidney disease",
        }
        history_lower = {h.lower() for h in medical_history}
        if history_lower & high_risk_conditions and urgency == "routine":
            urgency        = "urgent"
            urgency_reason = (
                "Pre-existing conditions elevate risk — earlier evaluation recommended."
            )
            see_within = "within 48 hours"

        return {
            "possible_conditions":    conditions,
            "urgency_level":          urgency,
            "urgency_reason":         urgency_reason,
            "see_doctor_within":      see_within,
            "recommended_specialist": specialist,
            "suggested_tests":        tests,
            "home_care":              home_care,
            "red_flags":              red_flags,
            "disclaimer": "Informational only — not a substitute for professional medical advice.",
        }

    # ── No body system matched — safe generic fallback ────────────────────────
    return {
        "possible_conditions": [
            {
                "condition": "Non-specific symptom pattern",
                "probability": "low",
                "description": (
                    "The description is too broad for body-system classification. "
                    "Please include location, severity, duration, triggers, and associated symptoms."
                ),
            }
        ],
        "urgency_level":          "routine",
        "urgency_reason":         "No emergency or body-system pattern detected in current input.",
        "see_doctor_within":      "as needed",
        "recommended_specialist": "General physician",
        "suggested_tests":        ["Physical examination", "Basic blood panel (CBC, CMP)"],
        "home_care": [
            "Rest and monitor symptoms closely.",
            "Stay hydrated — aim for 2–3 L water daily.",
            "Seek care promptly if symptoms worsen or new ones appear.",
        ],
        "red_flags": [
            "Chest pain or tightness",
            "Severe difficulty breathing",
            "Loss of consciousness",
            "Uncontrolled bleeding",
        ],
        "disclaimer": "Informational only — not a substitute for professional medical advice.",
    }


# ── Prescription template builder ─────────────────────────────────────────────
def build_prescription_template(patient_data: dict) -> str:
    name      = patient_data.get("name",       "Patient")
    age       = patient_data.get("age",        "—")
    conditions= patient_data.get("conditions", [])
    meds      = patient_data.get("medications",[])
    allergies = patient_data.get("allergies",  [])
    vitals    = patient_data.get("vitals",     {})
    diagnosis = patient_data.get("diagnosis",  "")

    allergy_note = f"⚠️ ALLERGIES: {', '.join(allergies)}" if allergies else "No known drug allergies"

    return f"""**PRESCRIPTION TEMPLATE — {name}**
Date: _{vitals.get('recordedAt','today')}_
Patient: {name} | Age: {age}
{allergy_note}

**Diagnosis:** {diagnosis or '[Enter diagnosis]'}

**Rx:**
1. [Medicine name] — [dose]mg — [route: oral/IV] — [frequency: OD/BD/TDS] — [duration: 5 days]
2. [Medicine name] — [dose]mg — [route] — [frequency] — [duration]
3. [Medicine name] — [dose]mg — [route] — [frequency] — PRN (as needed)

**Current medications** (check for interactions):
{chr(10).join(f'• {m}' for m in meds[:5]) if meds else '• None recorded'}

**Instructions:**
- Take all medicines with food unless specified
- Complete full course of antibiotics
- Return immediately if symptoms worsen
- [Add specific instructions]

**Follow-up:** [Date/timeline]

Dr. _______________________
Sign & Stamp"""


# ── SOAP note builder ─────────────────────────────────────────────────────────
def build_soap_note(patient_data: dict) -> str:
    name       = patient_data.get("name",       "Patient")
    age        = patient_data.get("age",        "—")
    conditions = patient_data.get("conditions", [])
    meds       = patient_data.get("medications",[])
    vitals     = patient_data.get("vitals",     {})
    vstr       = format_vitals(vitals)
    visit      = patient_data.get("recent_visit","")

    return f"""**SOAP NOTE — {name}**

**S — Subjective**
Chief complaint: {visit or '[Enter presenting complaint]'}
Duration: [enter]  |  Severity: [mild/moderate/severe]
Associated symptoms: [enter]
History: {', '.join(conditions) if conditions else 'No significant history'}
Allergies: {', '.join(patient_data.get('allergies',[])) or 'NKDA'}

**O — Objective**
Vitals: {vstr}
General: [enter appearance]
Systemic examination: [enter findings]
Current meds: {', '.join(meds[:5]) if meds else 'None'}

**A — Assessment**
Primary diagnosis: [enter]
Differential: [enter]
Severity: [mild/moderate/severe]

**P — Plan**
- Investigations: [enter]
- Medications: [complete Rx section]
- Patient education: [enter]
- Lifestyle modifications: [enter]
- Follow-up: [enter timeline]
- Referral: [enter if needed]"""


# ── Main clinical reply function ──────────────────────────────────────────────
def clinical_chat_reply(message: str, patient_data: dict, is_doctor: bool = False) -> tuple[str, str]:
    """
    Returns (intent_type, response_text).
    intent_type: 'prescription'|'soap'|'ddx'|'drug_check'|'symptom'|'vitals'|'general'
    """
    msg = (message or "").lower()
    name = patient_data.get("name", "Patient")

    # ── Emergency ──────────────────────────────────────────────────────────
    if detected_red_flags(message):
        return ("emergency",
            "🚨 Emergency signs detected. Call 112 immediately or go to the nearest ER.")

    # ── Prescription request (DOCTOR) ──────────────────────────────────────
    if is_doctor and re.search(r"prescri|prescription|rx|medicine.?for|drug.?for|give.?medicine|write.?rx", msg):
        return ("prescription", build_prescription_template(patient_data))

    # ── SOAP note ──────────────────────────────────────────────────────────
    if re.search(r"soap|soap.?note|clinical.?note|consultation.?note", msg):
        return ("soap", build_soap_note(patient_data))

    # ── Differential diagnosis ─────────────────────────────────────────────
    if re.search(r"differential|ddx|diagnos", msg):
        conds = patient_data.get("conditions", [])
        meds  = patient_data.get("medications",[])
        vstr  = format_vitals(patient_data.get("vitals",{}))
        return ("ddx", f"""**Differential Diagnosis Framework — {name}**

Patient context:
- Conditions: {', '.join(conds) if conds else 'none'}
- Medications: {', '.join(meds[:5]) if meds else 'none'}
- Vitals: {vstr}

To generate accurate differentials, describe:
1. Chief complaint and duration
2. Onset (sudden/gradual)
3. Location and radiation
4. Aggravating and relieving factors
5. Associated symptoms

Then I'll generate a structured differential list.""")

    # ── Drug check ────────────────────────────────────────────────────────
    if re.search(r"drug.?inter|drug.?safe|medication.?inter|contraindic|safe.?to.?give", msg):
        allergies = patient_data.get("allergies",[])
        meds      = patient_data.get("medications",[])
        return ("drug_check", f"""**Drug Safety Check — {name}**

{"⚠️ ALLERGIES: " + ', '.join(allergies) if allergies else "✅ No recorded allergies"}

Current medications ({len(meds)}):
{chr(10).join(f'• {m}' for m in meds[:8]) if meds else '• None on record'}

Common interactions to check:
- Warfarin + NSAIDs → bleeding risk
- ACE inhibitors + K+ supplements → hyperkalaemia
- Statins + macrolides → myopathy
- SSRIs + tramadol → serotonin syndrome
- Metformin + contrast dye → renal risk

Specify the new drug and I'll check it against current medications.""")

    # ── Lab report ────────────────────────────────────────────────────────
    if re.search(r"lab.?report|lab.?result|blood.?test|interpret|abnormal.*result", msg):
        docs = patient_data.get("documents", [])
        lab_docs = [d for d in docs if d.get("type") == "lab_report" and d.get("aiSummary")]
        if lab_docs:
            lines = "\n".join(f"• **{d.get('name','Lab')}**: {d['aiSummary']}" for d in lab_docs[:3])
            return ("lab", f"**Lab Reports for {name}:**\n\n{lines}\n\nAttach the report file for detailed value-by-value analysis.")
        return ("lab", f"""**Lab Interpretation for {name}:**

No lab reports with AI analysis found yet.

**Key reference ranges:**
- Haemoglobin: 12–17 g/dL | WBC: 4–11 × 10³/µL
- Fasting glucose: 70–100 mg/dL | HbA1c: <5.7%
- TSH: 0.4–4.0 mIU/L | Creatinine: 0.6–1.2 mg/dL
- Sodium: 136–145 | Potassium: 3.5–5.1 mEq/L

Attach the lab report PDF or image for instant AI extraction and interpretation.""")

    # ── Patient vitals query ──────────────────────────────────────────────
    if re.search(r"vital|bp|blood.?pressure|sugar|oxygen|spo2|glucose|temp|heart.?rate", msg):
        vstr  = format_vitals(patient_data.get("vitals",{}))
        v     = patient_data.get("vitals",{})
        alerts = []
        if v.get("systolic", 0) >= 140 or v.get("diastolic", 0) >= 90: alerts.append("⚠️ BP HIGH")
        if v.get("oxygenSaturation") and v["oxygenSaturation"] < 94:   alerts.append("⚠️ SpO2 LOW")
        if v.get("temperature") and v["temperature"] >= 38.5:          alerts.append("⚠️ FEVER")
        if v.get("glucose") and (v["glucose"] > 180 or v["glucose"] < 70): alerts.append("⚠️ GLUCOSE ABNORMAL")
        alert_str = "\n".join(alerts) if alerts else "✅ No critical values"
        return ("vitals", f"**Latest vitals — {name}:**\n{vstr}\n\n{alert_str}")

    # ── Appointment / queue ───────────────────────────────────────────────
    if re.search(r"appointment|queue|book|schedule|waiting|next.?visit", msg):
        apts = patient_data.get("appointments", [])
        upcoming = [a for a in apts if a.get("status") in ["scheduled","confirmed"]]
        if upcoming:
            lines = "\n".join(
                f"• {a.get('date','?')} with Dr. {a.get('doctor','?')} ({a.get('type','in-person')})"
                for a in upcoming[:3]
            )
            return ("appointment", f"**Upcoming appointments for {name}:**\n{lines}\n\nFor live queue position, check the Appointments section.")
        return ("appointment", f"No upcoming appointments found for {name}.\n\nSay **'Book appointment with [specialty] doctor'** to book one.")

    # ── Patient summary ───────────────────────────────────────────────────
    if re.search(r"summary|overview|how.?is.?the.?patient|patient.?status|about.?patient|tell.*about|everything.*about", msg):
        conds = patient_data.get("conditions",[])
        meds  = patient_data.get("medications",[])
        vstr  = format_vitals(patient_data.get("vitals",{}))
        visit = patient_data.get("recent_visit","")
        return ("summary", f"""**Clinical Summary — {name}**
Age: {patient_data.get('age','—')} | Blood: {patient_data.get('blood_group','—')} | Risk: {patient_data.get('risk_level','low')} | Score: {patient_data.get('health_score','not calculated')}/100
Conditions: {', '.join(conds) if conds else 'None documented'}
Medications: {', '.join(meds[:5]) if meds else 'None documented'}
Latest vitals: {vstr}
{"Latest visit: " + visit if visit else ""}
{"Documents: " + ', '.join(d.get('name','') for d in patient_data.get('documents',[])[:3]) if patient_data.get('documents') else ""}
Next: Document assessment, check abnormal vitals/labs, verify medication safety.""")

    # ── Body system symptom query ─────────────────────────────────────────
    system_name = detect_body_system(message)
    if system_name:
        sys_data = BODY_SYSTEMS[system_name]
        conds    = patient_data.get("conditions",[])
        ctx      = f"\n_(Considering: {', '.join(conds[:3])})_" if conds else ""
        return (system_name, f"""Regarding {name}'s concern:{ctx}

**⚠️ Seek emergency care if:**
{chr(10).join(f'• {r}' for r in sys_data['red_flags'])}

**What to do now:**
{chr(10).join(f'• {c}' for c in sys_data['care'])}

**Tests to discuss:** {sys_data['tests']}

**Recommended specialist:** {sys_data['specialist']}

Say **"Book appointment with {sys_data['specialist']}"** to schedule a visit.""")

    # ── Greeting ──────────────────────────────────────────────────────────
    if re.search(r"^(hi|hello|hey|good\s*(morning|afternoon|evening)|thanks|bye)[\s!.,]*$", msg):
        greeting = "Good morning" if "morning" in msg else "Good afternoon" if "afternoon" in msg else "Hello"
        if is_doctor:
            return ("greeting", f"{greeting} Doctor! Patient context for {name} is loaded. Ask me for a SOAP note, prescription, differential, drug check, or lab interpretation.")
        return ("greeting", f"{greeting} {name}! I'm your HealthBridge health assistant. Ask me about symptoms, appointments, vitals, medications, or anything health-related.")

    # ── General fallback ─────────────────────────────────────────────────
    if is_doctor:
        return ("general", f"""I can help you with {name}'s care. Try:

- **"Make a prescription for {name}"** — generates Rx template
- **"Write a SOAP note"** — structured clinical documentation
- **"Check drug interactions"** — reviews current medications
- **"Interpret the lab report"** — explains results
- **"Give me a differential"** — based on presenting symptoms
- **"How is the patient?"** — full clinical summary

What would you like to do?""")

    return ("general", f"""I can help with your health, {name}. Try asking:

- *"I have [symptom] for [duration]"* — symptom assessment
- *"Book appointment with [doctor type]"* — appointment booking
- *"What are my vitals?"* — latest readings
- *"Explain my lab report"* — report interpretation
- *"What medicines am I on?"* — medication review

What would you like to know?""")