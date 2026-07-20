"""
Train all ML models in one shot.
Run from ml-service root:
  python training/train_all.py
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time

def section(title):
    print(f"\n{'='*50}")
    print(f"  {title}")
    print('='*50)

if __name__ == "__main__":
    start = time.time()

    section("1/2 — Health Score Model (XGBoost)")
    from models.health_score_model import train as train_health
    train_health()

    section("2/2 — Anomaly Detection Model (Isolation Forest)")
    from models.anomaly_model import train as train_anomaly
    train_anomaly()

    elapsed = round(time.time() - start, 1)
    print(f"\n✅ All models trained in {elapsed}s")
    print("📁 Saved to models/saved/")
    print("\nNow start the server:")
    print("  uvicorn main:app --reload --port 8000")