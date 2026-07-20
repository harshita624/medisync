"""
HealthBridge AI Chat Router — Powered by Ollama (LLaMA3)
Full patient context injection, conversation memory, intelligent fallback
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
import re

from utils.ollama_client import ask_llama
from utils.prompts import (
    CHAT_SYSTEM, CHAT_PROMPT, DOCTOR_CHAT_PROMPT,
    PRESCRIPTION_SYSTEM, PRESCRIPTION_PROMPT,
)
from utils.clinical_engine import (
    clinical_chat_reply, detected_red_flags,
    format_vitals, analyze_symptoms,
)

router = APIRouter()
_executor = ThreadPoolExecutor(max_workers=4)


# ─── Request / Response Models ────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    voice_mode: Optional[bool] = False
    role: Optional[str] = "patient"
    patient_name: Optional[str] = "Patient"
    patient_age: Optional[int] = None
    blood_group: Optional[str] = "Unknown"
    conditions: Optional[List[str]] = []
    medications: Optional[List[str]] = []
    recent_vitals: Optional[dict] = {}
    medical_records: Optional[List[dict]] = []
    documents: Optional[List[dict]] = []
    appointments: Optional[List[dict]] = []
    medicine_reminders: Optional[List[dict]] = []
    health_score: Optional[float] = None
    risk_level: Optional[str] = "low"
    allergies: Optional[List[str]] = []

class ChatResponse(BaseModel):
    reply: str
    intent: str
    voice_reply: str
    model: str = "LLaMA3-Ollama"


# ─── Intent Classifier ────────────────────────────────────────────────────────

def classify_intent(message: str) -> str:
    msg = (message or "").lower()
    if any(w in msg for w in [
        "emergency", "chest pain", "can't breathe", "cannot breathe",
        "unconscious", "seizure", "stroke", "severe bleeding", "collapse",
        "overdose", "suicidal", "heart attack",
    ]):
        return "emergency"
    if any(w in msg for w in ["vital", "bp", "blood pressure", "heart rate", "pulse",
                               "temperature", "oxygen", "spo2", "glucose", "sugar"]):
        return "vitals"
    if any(w in msg for w in ["symptom", "pain", "fever", "cough", "headache",
                               "nausea", "dizzy", "ache", "hurt", "feel sick", "unwell"]):
        return "symptom_inquiry"
    if any(w in msg for w in ["medicine", "drug", "medication", "tablet", "dose",
                               "pill", "prescription", "remind", "reminder"]):
        return "medication_inquiry"
    if any(w in msg for w in ["appointment", "book", "schedule", "doctor",
                               "visit", "slot", "reschedule", "cancel appointment"]):
        return "appointment"
    if any(w in msg for w in ["report", "result", "test", "lab", "record",
                               "document", "scan", "xray", "summary", "upload"]):
        return "report_inquiry"
    if any(w in msg for w in ["insurance", "policy", "claim", "coverage", "premium"]):
        return "insurance"
    if any(w in msg for w in ["soap", "differential", "ddx", "diagnos",
                               "interaction", "contraindication"]):
        return "clinical_support"
    if re.search(r"prescri|prescription|rx|medicine.?for|write.?rx", msg):
        return "prescription"
    if any(w in msg for w in ["summary", "summarize", "overview", "profile",
                               "history", "everything about", "tell me about"]):
        return "summary"
    if re.match(r"^(hi|hello|hey|good\s*(morning|afternoon|evening)|thanks|bye)[\s!.,]*$", msg):
        return "greeting"
    return "general"


# ─── Context Builder ──────────────────────────────────────────────────────────

def build_context_string(req: ChatRequest) -> str:
    lines = []
    name = req.patient_name or "Patient"

    # Demographics
    demo = [f"Name: {name}"]
    if req.patient_age:
        demo.append(f"Age: {req.patient_age}")
    demo.append(f"Blood group: {req.blood_group or 'Unknown'}")
    demo.append(f"Risk level: {req.risk_level or 'low'}")
    if req.health_score is not None:
        demo.append(f"Health score: {req.health_score}/100")
    lines.append(" | ".join(demo))

    # Conditions & Allergies
    if req.conditions:
        lines.append(f"Chronic conditions: {', '.join(req.conditions)}")
    if req.allergies:
        lines.append(f"⚠️ ALLERGIES: {', '.join(req.allergies)}")

    # Medications
    if req.medications:
        med_list = [m for m in req.medications if m.strip()]
        if med_list:
            lines.append(f"Current medications: {', '.join(med_list[:12])}")

    # Latest Vitals — format_vitals returns a plain string
    if req.recent_vitals and any(v is not None for v in req.recent_vitals.values()):
        vitals_str = format_vitals(req.recent_vitals)
        if vitals_str and "not recorded" not in vitals_str.lower():
            lines.append(f"Latest vitals: {vitals_str}")

    # Medical Records
    if req.medical_records:
        latest = req.medical_records[0]
        parts = []
        if latest.get("diagnosis"):
            parts.append(f"Diagnosis: {latest['diagnosis']}")
        if latest.get("chiefComplaint"):
            parts.append(f"Complaint: {latest['chiefComplaint']}")
        if latest.get("symptoms"):
            syms = latest["symptoms"]
            if isinstance(syms, list) and syms:
                parts.append(f"Symptoms: {', '.join(syms[:6])}")
        if latest.get("prescription"):
            rx = latest["prescription"]
            if isinstance(rx, list) and rx:
                meds = [p.get("medicine", "") for p in rx[:4] if p.get("medicine")]
                if meds:
                    parts.append(f"Prescribed: {', '.join(meds)}")
        if latest.get("date"):
            parts.append(f"Date: {str(latest['date'])[:10]}")
        if parts:
            lines.append(f"Latest visit: {' | '.join(parts)}")
        if len(req.medical_records) > 1:
            lines.append(f"Total medical records: {len(req.medical_records)}")

    # Documents with AI Summaries
    docs_with_summary = [
        d for d in (req.documents or [])
        if d.get("aiSummary") and d.get("name")
    ]
    if docs_with_summary:
        lines.append("Documents / reports with AI analysis:")
        for d in docs_with_summary[:4]:
            lines.append(f"  • {d['name']} ({d.get('type', 'other')}): {d['aiSummary']}")
    elif req.documents:
        lines.append(f"Documents uploaded: {len(req.documents)} (no AI summaries yet)")

    # Appointments
    if req.appointments:
        upcoming = [
            a for a in req.appointments
            if a.get("status") in ["scheduled", "confirmed"]
        ]
        if upcoming:
            a = upcoming[0]
            date_str = str(a.get("date", ""))[:10]
            doctor   = a.get("doctor", "Doctor")
            apt_type = a.get("type", "in-person")
            lines.append(
                f"Next appointment: {date_str} with Dr. {doctor} "
                f"({apt_type}, {a.get('status', '')})"
            )
            if len(upcoming) > 1:
                lines.append(f"Total upcoming appointments: {len(upcoming)}")

    # Medicine Reminders
    active_reminders = [r for r in (req.medicine_reminders or []) if r.get("isActive")]
    if active_reminders:
        reminder_parts = []
        for r in active_reminders[:5]:
            parts = [r.get("medicine", "")]
            if r.get("dosage"):
                parts.append(r["dosage"])
            if r.get("frequency"):
                parts.append(r["frequency"].replace("_", " "))
            reminder_parts.append(" ".join(filter(None, parts)))
        lines.append(f"Active medicine reminders: {', '.join(reminder_parts)}")

    return "\n".join(lines) if lines else "No patient data available in this session."


# ─── Helpers ──────────────────────────────────────────────────────────────────

def shorten_for_voice(text: str, max_sentences: int = 3) -> str:
    sentences = text.replace("\n", ". ").replace("  ", " ").split(". ")
    sentences = [s.strip() for s in sentences if s.strip()]
    short = ". ".join(sentences[:max_sentences])
    if short and not short.endswith("."):
        short += "."
    return short or text[:280]


def call_llm_with_timeout(prompt: str, system: str, seconds: int = 20) -> str:
    future = _executor.submit(
        lambda: ask_llama(prompt, system=system, temperature=0.2)
    )
    return future.result(timeout=seconds)


def intelligent_fallback(message: str, context: str, intent: str, name: str) -> str:
    if intent == "emergency":
        return (
            "🚨 This sounds like a medical emergency. "
            "Call 112 immediately or go to the nearest emergency room. Do not wait."
        )
    if intent == "vitals":
        vitals_line = next((l for l in context.split("\n") if "Latest vitals:" in l), None)
        if vitals_line:
            return (
                f"Here are your latest recorded vitals:\n"
                f"{vitals_line.replace('Latest vitals: ', '')}\n\n"
                f"Next: Log a new reading in Vitals Tracker to track trends, "
                f"or ask your doctor to review these values."
            )
        return (
            f"No recent vitals found for {name}. "
            f"Next: Go to Vitals Tracker and log a new reading."
        )
    if intent == "medication_inquiry":
        meds_line = next((l for l in context.split("\n") if "medications:" in l.lower()), None)
        if meds_line:
            return (
                f"Your current medications:\n{meds_line}\n\n"
                f"Next: Check My Medicines for reminder times and dosage details, "
                f"or ask your doctor before changing any medication."
            )
        return (
            f"No medications are recorded for {name} yet. "
            f"Next: Add your medications in My Medicines or ask your doctor to update the prescription."
        )
    if intent == "appointment":
        apt_line = next((l for l in context.split("\n") if "appointment" in l.lower()), None)
        if apt_line:
            return f"{apt_line}\n\nNext: Go to Appointments to book, reschedule or cancel."
        return "Next: Go to Appointments to book a new appointment with your preferred doctor."
    if intent in ("summary", "general"):
        summary_lines = [l for l in context.split("\n") if l.strip()][:8]
        if summary_lines:
            return (
                f"Health summary for {name}:\n" +
                "\n".join(summary_lines) +
                "\n\nNext: Ask a specific question about symptoms, medications, vitals or appointments."
            )
    return (
        f"I can help {name} with vitals, medications, appointments, symptoms and medical records. "
        f"The AI model is processing — please try again in a moment. "
        f"For emergencies, call 112 immediately."
    )


# ─── Intents that never need Ollama ───────────────────────────────────────────
_RULES_ONLY_INTENTS = frozenset({
    "emergency", "greeting", "vitals", "appointment",
    "soap", "ddx", "clinical_support", "summary",
})


# ─── Ollama Prompt Builder ────────────────────────────────────────────────────

def build_ollama_prompt(
    req: ChatRequest,
    context: str,
    history_str: str,
    intent: str,
    is_doctor: bool,
) -> tuple[str, str]:
    system = CHAT_SYSTEM
    if req.voice_mode:
        system += (
            "\n\nVOICE MODE: Respond in exactly 2-3 short sentences. "
            "Speak naturally as if talking aloud. No markdown, no bullet points, no lists."
        )

    # Prescription — dedicated tightly-scoped prompt
    if intent == "prescription" and is_doctor:
        latest = (req.medical_records or [{}])[0]
        prompt = PRESCRIPTION_PROMPT.format(
            name       = req.patient_name or "Patient",
            age        = req.patient_age  or "—",
            conditions = ", ".join(req.conditions  or ["none"]),
            medications= ", ".join(req.medications or ["none"]),
            allergies  = ", ".join(req.allergies   or ["none"]),
            diagnosis  = latest.get("diagnosis")   or "[not specified]",
        )
        return PRESCRIPTION_SYSTEM, prompt

    # Doctor vs patient prompt — both use {context}/{history}/{question} fields
    if is_doctor:
        vitals_str = format_vitals(req.recent_vitals or {})
        recent_visit = ""
        if req.medical_records:
            rv = req.medical_records[0]
            recent_visit = rv.get("chiefComplaint") or rv.get("diagnosis") or ""

        prompt = DOCTOR_CHAT_PROMPT.format(
            name         = req.patient_name or "Patient",
            age          = req.patient_age  or "—",
            conditions   = ", ".join(req.conditions  or ["none"]),
            medications  = ", ".join(req.medications or ["none"]),
            vitals       = vitals_str,
            recent_visit = recent_visit or "none",
            question     = req.message,
        )
        return system, prompt

    # Patient prompt
    vitals_str = format_vitals(req.recent_vitals or {})
    upcoming_apts = [
        a for a in (req.appointments or [])
        if a.get("status") in ["scheduled", "confirmed"]
    ]
    apt_str = (
        f"{str(upcoming_apts[0].get('date',''))[:10]} with Dr. {upcoming_apts[0].get('doctor','')}"
        if upcoming_apts else "none"
    )

    prompt = CHAT_PROMPT.format(
        name        = req.patient_name  or "Patient",
        age         = req.patient_age   or "—",
        blood_group = req.blood_group   or "Unknown",
        conditions  = ", ".join(req.conditions  or ["none"]),
        medications = ", ".join(req.medications or ["none"]),
        vitals      = vitals_str,
        appointments= apt_str,
        question    = req.message,
    )
    return system, prompt


# ─── Main Chat Endpoint ───────────────────────────────────────────────────────

@router.post("/message", response_model=ChatResponse)
async def chat(req: ChatRequest):
    try:
        # 1. Emergency check — always fast
        if detected_red_flags(req.message or ""):
            reply = (
                "🚨 This sounds like a medical emergency. "
                "Call 112 immediately or go to the nearest emergency room. "
                "Do not wait."
            )
            return ChatResponse(reply=reply, intent="emergency", voice_reply=reply)

        # 2. Classify intent
        intent    = classify_intent(req.message)
        name      = req.patient_name or "Patient"
        is_doctor = (req.role or "patient").lower() == "doctor"

        # 3. Build patient_data dict for clinical engine
        patient_data = {
            "name":         name,
            "age":          req.patient_age,
            "blood_group":  req.blood_group,
            "conditions":   req.conditions   or [],
            "medications":  req.medications  or [],
            "allergies":    req.allergies    or [],
            "vitals":       req.recent_vitals or {},
            "appointments": req.appointments or [],
            "documents":    req.documents    or [],
            "risk_level":   req.risk_level,
            "health_score": req.health_score,
            "recent_visit": (
                (req.medical_records[0].get("chiefComplaint") or
                 req.medical_records[0].get("diagnosis", ""))
                if req.medical_records else ""
            ),
        }

        # 4. Clinical engine — instant rule-based response
        engine_intent, engine_reply = clinical_chat_reply(
            req.message,
            patient_data=patient_data,
            is_doctor=is_doctor,
        )

        # 5. Skip Ollama for intents the rules engine handles perfectly
        effective_intent = engine_intent or intent
        if effective_intent in _RULES_ONLY_INTENTS and engine_reply:
            voice_reply = shorten_for_voice(engine_reply)
            return ChatResponse(
                reply=engine_reply,
                intent=effective_intent,
                voice_reply=voice_reply,
                model="HealthBridge-Rules",
            )

        # 6. Build full context string for LLaMA3
        context = build_context_string(req)

        # 7. Build conversation history (last 8 messages)
        history_str = ""
        for hist_msg in (req.history or [])[-8:]:
            role_label = "Patient" if hist_msg.role == "user" else "HealthBridge AI"
            content    = str(hist_msg.content or "").strip()[:800]
            if content:
                history_str += f"{role_label}: {content}\n"

        # 8. Build Ollama prompt
        system, prompt = build_ollama_prompt(req, context, history_str, intent, is_doctor)

        # 9. Try LLaMA3 via Ollama (20 second timeout)
        reply         = engine_reply or ""
        llm_succeeded = False
        try:
            llm_reply = call_llm_with_timeout(prompt, system=system, seconds=20)
            if llm_reply and len(llm_reply.strip()) > 15:
                reply         = llm_reply.strip()
                llm_succeeded = True
        except FuturesTimeoutError:
            reply = engine_reply or intelligent_fallback(req.message, context, intent, name)
        except Exception:
            reply = engine_reply or intelligent_fallback(req.message, context, intent, name)

        voice_reply = shorten_for_voice(reply, max_sentences=2) if not req.voice_mode else reply

        return ChatResponse(
            reply=reply,
            intent=effective_intent,
            voice_reply=voice_reply,
            model="LLaMA3-Ollama" if llm_succeeded else "HealthBridge-Rules",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat service error: {str(e)}")


@router.post("/voice", response_model=ChatResponse)
async def voice_chat(req: ChatRequest):
    """Voice-optimised endpoint — shorter responses."""
    req.voice_mode = True
    return await chat(req)