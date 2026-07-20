from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from routers import symptom, health_score, anomaly, drug, chat, ocr, clinical

app = FastAPI(
    title="HealthBridge ML Service",
    description="ML/NLP service for symptoms, health score, anomaly detection, drug checks, OCR, and chat.",
    version="1.0.0",
)

allowed_origins = [
    os.getenv("FRONTEND_URL", "http://localhost:3003"),
    os.getenv("BACKEND_URL", "http://localhost:5000"),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(symptom.router, prefix="/api/symptom", tags=["Symptom Checker"])
app.include_router(health_score.router, prefix="/api/health-score", tags=["Health Score"])
app.include_router(anomaly.router, prefix="/api/anomaly", tags=["Anomaly Detection"])
app.include_router(drug.router, prefix="/api/drug", tags=["Drug Interaction"])
app.include_router(chat.router, prefix="/api/chat", tags=["AI Chat"])
app.include_router(ocr.router, prefix="/api/ocr", tags=["Medical OCR"])
app.include_router(clinical.router, prefix="/api/clinical", tags=["Clinical Intelligence"])

@app.get("/health")
def health():
    ollama_status = "unknown"
    try:
        from utils.ollama_client import MODEL
        ollama_status = f"configured:{MODEL}"
    except Exception:
        ollama_status = "not_configured"
    return {
        "status": "ok",
        "service": "HealthBridge ML",
        "features": ["symptom_nlp", "clinical_packet", "clinical_chat", "vitals_anomaly", "health_score", "drug_rules", "ocr"],
        "ollama": ollama_status,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)
