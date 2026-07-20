"""
Health Score Router
POST /api/health-score/predict  → XGBoost score 0-100 + risk level
POST /api/health-score/train    → retrain model (admin only)
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os

router = APIRouter()

class HealthScoreRequest(BaseModel):
    age: int
    gender: Optional[str] = "male"
    weight_kg: Optional[float] = 70
    height_cm: Optional[float] = 170
    systolic: Optional[float] = 120
    diastolic: Optional[float] = 80
    heart_rate: Optional[float] = 75
    glucose: Optional[float] = 90
    oxygen_saturation: Optional[float] = 98
    conditions: Optional[list[str]] = []
    medications_count: Optional[int] = 0

@router.post("/predict")
async def predict_score(req: HealthScoreRequest):
    """
    Predict health score using XGBoost model.
    Returns score 0-100 and risk level.
    """
    try:
        from models.health_score_model import predict_health_score

        result = predict_health_score(req.dict())
        return {
            "success": True,
            "health_score": result["health_score"],
            "risk_level":   result["risk_level"],
            "model":        "XGBoost",
            "interpretation": {
                "70-100": "Good health",
                "50-69":  "Fair — monitor closely",
                "30-49":  "Poor — consult doctor",
                "0-29":   "Critical — immediate attention",
                "your_score": result["health_score"]
            }
        }
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail="Model not trained yet. POST to /api/health-score/train first."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/train")
async def train_model():
    """Train / retrain the XGBoost health score model."""
    try:
        from models.health_score_model import train
        train()
        return {"success": True, "message": "Health score model trained and saved."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))