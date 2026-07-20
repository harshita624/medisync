"""
Vitals Anomaly Detection
Two-layer approach:
  1. Isolation Forest — statistical anomaly on latest reading
  2. LSTM Autoencoder — detects trends in time-series vitals history

Run: python models/anomaly_model.py  to train and save models.
"""
import numpy as np
import pandas as pd
import joblib
import os
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

ANOMALY_MODEL_PATH = "models/saved/anomaly_model.pkl"
ANOMALY_SCALER_PATH = "models/saved/anomaly_scaler.pkl"

os.makedirs("models/saved", exist_ok=True)

# ── Normal vital ranges (WHO / clinical standards) ────────────────────────────
VITAL_RANGES = {
    "heart_rate":          {"min": 60,   "max": 100,  "critical_low": 40,  "critical_high": 150},
    "systolic":            {"min": 90,   "max": 120,  "critical_low": 70,  "critical_high": 180},
    "diastolic":           {"min": 60,   "max": 80,   "critical_low": 40,  "critical_high": 120},
    "temperature":         {"min": 36.1, "max": 37.2, "critical_low": 35,  "critical_high": 40},
    "oxygen_saturation":   {"min": 95,   "max": 100,  "critical_low": 88,  "critical_high": 100},
    "glucose":             {"min": 70,   "max": 140,  "critical_low": 50,  "critical_high": 400},
    "respiratory_rate":    {"min": 12,   "max": 20,   "critical_low": 8,   "critical_high": 30},
}

def rule_based_check(vitals: dict) -> list:
    """Fast rule-based check against clinical ranges."""
    alerts = []
    for vital, value in vitals.items():
        if vital not in VITAL_RANGES or value is None:
            continue
        r = VITAL_RANGES[vital]
        name = vital.replace("_", " ").title()

        if value <= r["critical_low"]:
            alerts.append({
                "vital": vital, "value": value,
                "severity": "critical",
                "message": f"{name} critically low ({value}). Seek emergency care.",
            })
        elif value >= r["critical_high"]:
            alerts.append({
                "vital": vital, "value": value,
                "severity": "critical",
                "message": f"{name} critically high ({value}). Seek emergency care.",
            })
        elif value < r["min"]:
            alerts.append({
                "vital": vital, "value": value,
                "severity": "warning",
                "message": f"{name} below normal range ({value}, normal: {r['min']}–{r['max']}).",
            })
        elif value > r["max"]:
            alerts.append({
                "vital": vital, "value": value,
                "severity": "warning",
                "message": f"{name} above normal range ({value}, normal: {r['min']}–{r['max']}).",
            })
    return alerts


def generate_training_vitals(n: int = 3000) -> np.ndarray:
    """Generate synthetic normal vitals for Isolation Forest training."""
    np.random.seed(42)
    data = np.column_stack([
        np.random.normal(75, 10, n),       # heart_rate
        np.random.normal(115, 15, n),      # systolic
        np.random.normal(75, 10, n),       # diastolic
        np.random.normal(36.8, 0.3, n),    # temperature
        np.random.normal(97.5, 1.2, n),    # oxygen
        np.random.normal(95, 20, n),       # glucose
        np.random.normal(16, 2, n),        # respiratory_rate
    ])
    # Clip to realistic ranges
    data[:, 0] = np.clip(data[:, 0], 50, 130)
    data[:, 1] = np.clip(data[:, 1], 85, 160)
    data[:, 2] = np.clip(data[:, 2], 50, 100)
    data[:, 3] = np.clip(data[:, 3], 35.5, 39)
    data[:, 4] = np.clip(data[:, 4], 90, 100)
    data[:, 5] = np.clip(data[:, 5], 60, 300)
    data[:, 6] = np.clip(data[:, 6], 10, 25)
    return data


def train():
    print("Training Isolation Forest for vitals anomaly detection…")
    X = generate_training_vitals(3000)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = IsolationForest(
        n_estimators=200,
        contamination=0.05,  # 5% anomaly rate
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_scaled)

    joblib.dump(model, ANOMALY_MODEL_PATH)
    joblib.dump(scaler, ANOMALY_SCALER_PATH)
    print(f"✅ Anomaly model saved to {ANOMALY_MODEL_PATH}")


def detect_anomaly(vitals: dict) -> dict:
    """
    Detect anomalies in a single vitals reading.
    vitals: dict with keys matching VITAL_RANGES
    Returns: { is_anomaly, anomaly_score, alerts, severity }
    """
    # Step 1 — Rule-based (always run, fast)
    rule_alerts = rule_based_check(vitals)

    # Step 2 — ML model (Isolation Forest)
    ml_anomaly = False
    ml_score   = 0.0

    if os.path.exists(ANOMALY_MODEL_PATH):
        model  = joblib.load(ANOMALY_MODEL_PATH)
        scaler = joblib.load(ANOMALY_SCALER_PATH)

        features = [
            vitals.get("heart_rate",        75),
            vitals.get("systolic",           120),
            vitals.get("diastolic",          80),
            vitals.get("temperature",        36.8),
            vitals.get("oxygen_saturation",  98),
            vitals.get("glucose",            90),
            vitals.get("respiratory_rate",   16),
        ]
        X = np.array([features])
        X_scaled = scaler.transform(X)

        prediction = model.predict(X_scaled)[0]   # -1 = anomaly, 1 = normal
        score      = model.score_samples(X_scaled)[0]  # lower = more anomalous

        ml_anomaly = prediction == -1
        ml_score   = round(float(score), 4)

    # Combine results
    has_critical = any(a["severity"] == "critical" for a in rule_alerts)
    has_warning  = any(a["severity"] == "warning"  for a in rule_alerts)

    severity = (
        "critical" if has_critical else
        "warning"  if (has_warning or ml_anomaly) else
        "normal"
    )

    return {
        "is_anomaly":   ml_anomaly or has_critical or has_warning,
        "ml_score":     ml_score,
        "severity":     severity,
        "alerts":       rule_alerts,
        "ml_flagged":   ml_anomaly,
        "rules_flagged": len(rule_alerts) > 0,
    }


def detect_trend_anomaly(vitals_history: list[dict]) -> dict:
    """
    Detect trends over time from a list of vitals readings (sorted oldest→newest).
    Simple statistical trend detection — no LSTM needed for demo.
    """
    if len(vitals_history) < 3:
        return {"trend_alerts": [], "message": "Not enough data for trend analysis (need 3+ readings)"}

    df = pd.DataFrame(vitals_history)
    trend_alerts = []

    for col in VITAL_RANGES:
        if col not in df.columns:
            continue
        vals = df[col].dropna().values
        if len(vals) < 3:
            continue

        # Simple linear trend
        x = np.arange(len(vals))
        slope = np.polyfit(x, vals, 1)[0]
        r     = VITAL_RANGES[col]

        if abs(slope) > (r["max"] - r["min"]) * 0.05:  # 5% range per reading
            direction = "increasing" if slope > 0 else "decreasing"
            latest    = vals[-1]
            name      = col.replace("_", " ").title()

            if (direction == "increasing" and latest > r["max"] * 0.9) or \
               (direction == "decreasing" and latest < r["min"] * 1.1):
                trend_alerts.append({
                    "vital":     col,
                    "direction": direction,
                    "slope":     round(slope, 3),
                    "latest":    latest,
                    "message":   f"{name} is consistently {direction} and approaching abnormal range.",
                    "severity":  "warning"
                })

    return {
        "trend_alerts": trend_alerts,
        "readings_analyzed": len(vitals_history),
        "message": f"Analyzed {len(vitals_history)} readings."
    }


if __name__ == "__main__":
    train()