"""
Drug Interaction Checker
Two-layer approach:
  1. OpenFDA API (free, no key) — real FDA drug interaction data
  2. LLaMA3 — explains interactions in clinical context
"""
import httpx
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from utils.ollama_client import ask_llama_json
from utils.prompts import DRUG_INTERACTION_SYSTEM, DRUG_INTERACTION_PROMPT
from utils.clinical_engine import drug_interaction_rules

router = APIRouter()
OPENFDA_URL = "https://api.fda.gov/drug"

class DrugCheckRequest(BaseModel):
    drugs: list[str]
    age: Optional[int] = None
    conditions: Optional[list[str]] = []

async def query_openfda(drug_name: str) -> dict:
    """Query OpenFDA for drug adverse events and interactions."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            url = f"{OPENFDA_URL}/event.json"
            params = {
                "search": f'patient.drug.medicinalproduct:"{drug_name}"',
                "limit": 5
            }
            res = await client.get(url, params=params)
            if res.status_code == 200:
                data = res.json()
                return {"found": True, "results": data.get("results", [])[:3]}
    except Exception:
        pass
    return {"found": False, "results": []}

async def get_drug_label(drug_name: str) -> dict:
    """Get FDA drug label — includes warnings and interactions."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            url = f"{OPENFDA_URL}/label.json"
            params = {"search": f'openfda.generic_name:"{drug_name}"', "limit": 1}
            res = await client.get(url, params=params)
            if res.status_code == 200:
                data = res.json()
                results = data.get("results", [])
                if results:
                    label = results[0]
                    return {
                        "found":             True,
                        "warnings":          label.get("warnings", [])[:2],
                        "interactions":      label.get("drug_interactions", [])[:2],
                        "contraindications": label.get("contraindications", [])[:1],
                    }
    except Exception:
        pass
    return {"found": False}


@router.post("/check")
async def check_interactions(req: DrugCheckRequest):
    """
    Check drug interactions.
    POST /api/drug/check
    Body: { drugs: ["aspirin", "warfarin"], age: 65, conditions: ["hypertension"] }
    """
    if len(req.drugs) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 drugs to check interactions")

    # Step 1 — OpenFDA labels for each drug
    fda_data = {}
    for drug in req.drugs[:5]:
        fda_data[drug] = await get_drug_label(drug)

    # Step 2 — LLaMA3 interaction analysis
    drugs_str      = ", ".join(req.drugs)
    conditions_str = ", ".join(req.conditions) if req.conditions else "None"

    prompt = DRUG_INTERACTION_PROMPT.format(
        drugs=drugs_str,
        age=req.age or "unknown",
        conditions=conditions_str,
    )

    rule_analysis = drug_interaction_rules(req.drugs)
    try:
        raw = ask_llama_json(prompt, system=DRUG_INTERACTION_SYSTEM)
        try:
            llm_analysis = json.loads(raw)
        except json.JSONDecodeError:
            import re
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            llm_analysis = json.loads(match.group()) if match else {"error": "Parse failed"}
    except Exception as e:
        llm_analysis = {**rule_analysis, "llm_error": str(e)}

    if not llm_analysis.get("interactions") and rule_analysis.get("interactions"):
        llm_analysis["interactions"] = rule_analysis["interactions"]
        llm_analysis["overall_risk"] = rule_analysis["overall_risk"]
        llm_analysis["summary"]      = rule_analysis["summary"]

    return {
        "drugs_checked": req.drugs,
        "fda_data":      fda_data,
        "llm_analysis":  llm_analysis,
        "disclaimer":    "This is a clinical decision support tool. Always verify with a pharmacist or physician.",
        "model_used":    "OpenFDA + LLaMA3 + HealthBridge clinical rules"
    }


@router.get("/info/{drug_name}")
async def drug_info(drug_name: str):
    """
    Get FDA label info for a single drug.
    GET /api/drug/info/aspirin
    """
    label  = await get_drug_label(drug_name)
    events = await query_openfda(drug_name)
    return {
        "drug":   drug_name,
        "label":  label,
        "events": events,
    }