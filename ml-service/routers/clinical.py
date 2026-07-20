from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from utils.clinical_engine import analyze_symptoms, format_vitals, drug_interaction_rules

router = APIRouter()

class ClinicalPacketRequest(BaseModel):
    symptoms: Optional[str] = ""
    age: Optional[int] = None
    duration: Optional[str] = "not specified"
    conditions: Optional[list[str]] = []
    medications: Optional[list[str]] = []
    recent_vitals: Optional[dict] = {}
    records: Optional[list[dict]] = []

@router.post("/packet")
async def clinical_packet(req: ClinicalPacketRequest):
    symptom_analysis = analyze_symptoms(req.symptoms or "", req.age, req.duration or "not specified", req.conditions or []) if req.symptoms else None
    vitals_text, vitals_alerts = format_vitals(req.recent_vitals or {})
    drug_risk = drug_interaction_rules(req.medications or []) if len(req.medications or []) >= 2 else {
        "interactions": [],
        "overall_risk": "unknown",
        "summary": "At least two medicines are needed for interaction screening.",
        "alternatives": [],
    }

    latest_records = []
    for record in (req.records or [])[:5]:
        latest_records.append({
            "diagnosis": record.get("diagnosis"),
            "chiefComplaint": record.get("chiefComplaint"),
            "symptoms": record.get("symptoms", []),
            "notes": record.get("notes"),
        })

    risk_flags = []
    if symptom_analysis and symptom_analysis["urgency_level"] in ["emergency", "urgent"]:
        risk_flags.append(f"Symptom triage is {symptom_analysis['urgency_level']}: {symptom_analysis['urgency_reason']}")
    risk_flags.extend(vitals_alerts)
    if drug_risk.get("overall_risk") in ["high", "medium"]:
        risk_flags.append(f"Medication interaction risk: {drug_risk.get('overall_risk')}")

    return {
        "symptom_analysis": symptom_analysis,
        "vitals": {
            "summary": vitals_text,
            "alerts": vitals_alerts,
        },
        "drug_risk": drug_risk,
        "record_summary": latest_records,
        "risk_flags": risk_flags,
        "next_best_actions": [
            "Book a doctor visit if symptoms are persistent, worsening, or affecting daily activity.",
            "Attach recent reports/documents to the patient QR packet.",
            "Repeat abnormal vitals after rest and confirm with a clinician.",
            "Review medicine interactions with a doctor or pharmacist before changing doses.",
        ],
        "model_used": "HealthBridge clinical NLP/rules + optional LLM layer",
    }
