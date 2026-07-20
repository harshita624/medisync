from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import numpy as np

router = APIRouter()


class VitalsRequest(BaseModel):
    heart_rate: Optional[float] = None
    systolic: Optional[float] = None
    diastolic: Optional[float] = None
    temperature: Optional[float] = None
    oxygen_saturation: Optional[float] = None
    glucose: Optional[float] = None
    respiratory_rate: Optional[float] = None


class TrendRequest(BaseModel):
    vitals_history: list[dict]


def convert_numpy(obj):
    """Recursively convert numpy types to native Python so FastAPI can serialize them."""
    if isinstance(obj, np.bool_):    return bool(obj)
    if isinstance(obj, np.integer):  return int(obj)
    if isinstance(obj, np.floating): return float(obj)
    if isinstance(obj, np.ndarray):  return obj.tolist()
    if isinstance(obj, dict):        return {k: convert_numpy(v) for k, v in obj.items()}
    if isinstance(obj, list):        return [convert_numpy(i) for i in obj]
    return obj


@router.post("/detect")
async def detect(req: VitalsRequest):
    try:
        from models.anomaly_model import detect_anomaly
        vitals = {k: v for k, v in req.model_dump().items() if v is not None}
        result = detect_anomaly(vitals)
        return convert_numpy(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trend")
async def trend(req: TrendRequest):
    try:
        from models.anomaly_model import detect_trend_anomaly
        result = detect_trend_anomaly(req.vitals_history)
        return convert_numpy(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/train")
async def train():
    try:
        from models.anomaly_model import train as train_model
        train_model()
        return {"success": True, "message": "Anomaly model trained."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))