import json
import re
import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from typing import Optional

from utils.ner import clean_symptom_text, SYMPTOM_KEYWORDS, BODY_PARTS
from utils.prompts import SYMPTOM_SYSTEM, SYMPTOM_PROMPT
from utils.clinical_engine import analyze_symptoms

router = APIRouter()
_executor = ThreadPoolExecutor(max_workers=2)

class SymptomRequest(BaseModel):
    symptoms: str
    age: Optional[int] = None
    gender: Optional[str] = "not specified"
    duration: Optional[str] = "not specified"
    medical_history: Optional[list[str]] = []

class SymptomResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    extracted_entities: dict
    analysis: dict
    model_used: str = "LLaMA3 + scispaCy"

def extract_json(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise

def rule_triage(symptoms: str, age: Optional[int] = None) -> dict:
    strong = analyze_symptoms(symptoms, age=age)
    text = (symptoms or "").lower()
    emergency_terms = [
        "chest pain", "can't breathe", "cannot breathe", "shortness of breath",
        "unconscious", "seizure", "stroke", "face droop", "severe bleeding",
        "blue lips", "suicidal", "poison", "overdose",
    ]
    urgent_terms = [
        "high fever", "fever", "severe pain", "persistent vomiting", "dehydration",
        "blood", "dizziness", "fainting", "infection", "wheezing",
    ]

    conditions = []
    tests = []
    home_care = ["Rest and stay hydrated.", "Monitor symptoms and temperature.", "Seek medical care sooner if symptoms worsen."]
    specialist = "General physician"

    if "headache" in text or "migraine" in text:
        conditions.extend([
            {"condition": "Tension headache or migraine", "probability": "medium", "description": "Headache without emergency signs is commonly related to stress, dehydration, sleep loss, eye strain, migraine, or viral illness."},
            {"condition": "Sinus or viral illness", "probability": "low", "description": "Headache with fever, congestion, sore throat, or body ache may be infection-related."},
        ])
        tests.extend(["Blood pressure check", "Temperature check", "Vision/sinus review if recurrent"])
        home_care.extend(["Rest in a quiet room.", "Avoid dehydration and skipped meals."])
    if "fever" in text or "temperature" in text:
        conditions.extend([
            {"condition": "Viral fever or acute infection", "probability": "medium", "description": "Fever commonly occurs with viral illness, throat infection, urinary infection, dengue/malaria in endemic areas, or other infections."},
            {"condition": "Inflammatory illness", "probability": "low", "description": "Persistent fever needs examination and basic lab testing."},
        ])
        tests.extend(["CBC", "CRP", "Malaria/dengue testing if locally relevant", "Urine test if burning urination"])
        home_care.extend(["Record temperature every 6-8 hours.", "Use fever medicine only as prescribed or per local medical advice."])
    if "cough" in text or "sore throat" in text or "cold" in text:
        conditions.extend([
            {"condition": "Upper respiratory infection", "probability": "medium", "description": "Cough, cold, sore throat, and mild fever often suggest a respiratory infection."},
            {"condition": "Bronchitis or asthma flare", "probability": "low", "description": "Wheezing, breathlessness, or persistent cough needs clinical review."},
        ])
        tests.extend(["Pulse oximetry", "Chest exam", "COVID/flu test if exposure or outbreak"])
    if "stomach" in text or "vomit" in text or "diarrhea" in text or "nausea" in text:
        conditions.extend([
            {"condition": "Gastroenteritis or food-related illness", "probability": "medium", "description": "Vomiting, diarrhea, abdominal pain, and nausea often relate to infection, food intolerance, or gastritis."},
        ])
        tests.extend(["Hydration assessment", "Stool/urine tests if persistent", "Electrolytes if severe vomiting/diarrhea"])
        home_care.extend(["Use oral rehydration solution.", "Avoid oily/spicy food until improving."])
    if not conditions:
        conditions.append({
            "condition": "Non-specific symptom pattern",
            "probability": "low",
            "description": "The symptom description is too broad for a specific pattern. Add location, severity, duration, triggers, fever, medicines taken, and associated symptoms.",
        })

    if any(term in text for term in emergency_terms):
        return {
            "urgency": "emergency",
            "reason": "Your symptoms include possible emergency warning signs.",
            "call_emergency": True,
            "see_doctor_within": "immediately",
            "specialist": "Emergency physician",
            "conditions": strong["possible_conditions"],
            "suggested_tests": strong["suggested_tests"],
            "home_care": ["Call 112 or go to emergency care now."],
        }

    if any(term in text for term in urgent_terms) or (age is not None and age >= 65 and "fever" in text):
        return {
            "urgency": "urgent",
            "reason": "Your symptoms should be assessed by a doctor soon.",
            "call_emergency": False,
            "see_doctor_within": "24 hours",
            "specialist": strong["recommended_specialist"],
            "conditions": strong["possible_conditions"],
            "suggested_tests": strong["suggested_tests"],
            "home_care": strong["home_care"],
        }

    return {
        "urgency": strong["urgency_level"],
        "reason": strong["urgency_reason"],
        "call_emergency": strong["urgency_level"] == "emergency",
        "see_doctor_within": strong["see_doctor_within"],
        "specialist": strong["recommended_specialist"],
        "conditions": strong["possible_conditions"],
        "suggested_tests": strong["suggested_tests"],
        "home_care": strong["home_care"],
    }

def analysis_from_quick(quick: dict) -> dict:
    return {
        "possible_conditions": quick.get("conditions", []),
        "urgency_level": quick.get("urgency", "routine"),
        "urgency_reason": quick.get("reason", ""),
        "recommended_specialist": quick.get("specialist", "General physician"),
        "red_flags": ["Chest pain", "Difficulty breathing", "Confusion", "Fainting", "Severe bleeding"],
        "suggested_tests": quick.get("suggested_tests", []),
        "home_care": quick.get("home_care", []),
        "disclaimer": "This is informational only and does not replace professional medical advice.",
    }

def call_with_timeout(fn, timeout_seconds: int = 12):
    future = _executor.submit(fn)
    return future.result(timeout=timeout_seconds)

def fast_entities(text: str) -> dict:
    lower = (text or "").lower()
    return {
        "symptoms": sorted({s for s in SYMPTOM_KEYWORDS if s in lower}),
        "conditions": [],
        "drugs": [],
        "anatomy": sorted({p for p in BODY_PARTS if p in lower}),
        "procedures": [],
        "raw_entities": [],
    }

@router.post("/check", response_model=SymptomResponse)
async def check_symptoms(req: SymptomRequest):
    try:
        cleaned = clean_symptom_text(req.symptoms)
        entities = fast_entities(cleaned or req.symptoms)
        history_str = ", ".join(req.medical_history) if req.medical_history else "None"

        rule_analysis = analyze_symptoms(req.symptoms, req.age, req.duration, req.medical_history)

        if os.getenv("ENABLE_LLM_SYMPTOM", "false").lower() not in ["1", "true", "yes"]:
            analysis = rule_analysis
        else:
            try:
                from utils.ollama_client import ask_llama_json
                prompt = SYMPTOM_PROMPT.format(
                    age=req.age or "unknown",
                    gender=req.gender,
                    symptoms=req.symptoms,
                    duration=req.duration,
                    history=history_str,
                )
                raw_response = call_with_timeout(lambda: ask_llama_json(prompt, system=SYMPTOM_SYSTEM), 4)
                analysis = extract_json(raw_response)
                if not analysis.get("possible_conditions"):
                    analysis["possible_conditions"] = rule_analysis["possible_conditions"]
                if not analysis.get("suggested_tests"):
                    analysis["suggested_tests"] = rule_analysis["suggested_tests"]
                if not analysis.get("home_care"):
                    analysis["home_care"] = rule_analysis["home_care"]
            except (Exception, TimeoutError):
                analysis = rule_analysis

        return SymptomResponse(
            extracted_entities=entities,
            analysis=analysis,
            model_used="HealthBridge clinical NLP + optional LLaMA",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Symptom check failed: {str(e)}")

@router.post("/quick")
async def quick_triage(req: SymptomRequest):
    try:
        return rule_triage(req.symptoms, req.age)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ner")
async def extract_entities(data: dict):
    text = data.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="text field required")
    return extract_medical_entities(text)
