"""
Health Score ML Model — XGBoost
Trains on patient vitals + demographics to output a 0–100 health score.

Run this script once to train and save the model:
  python models/health_score_model.py

Then the router loads the saved .pkl file for inference.
"""
import numpy as np
import pandas as pd
import joblib
import os
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import xgboost as xgb

MODEL_PATH   = "models/saved/health_score_model.pkl"
SCALER_PATH  = "models/saved/scaler.pkl"

os.makedirs("models/saved", exist_ok=True)

# ── Feature Engineering ───────────────────────────────────────────────────────

def compute_bmi(weight_kg: float, height_cm: float) -> float:
    if height_cm <= 0: return 0
    h = height_cm / 100
    return round(weight_kg / (h * h), 1)

def blood_pressure_score(systolic: float, diastolic: float) -> float:
    """Higher = worse. Returns penalty 0-30."""
    if systolic < 120 and diastolic < 80:   return 0    # Normal
    if systolic < 130 and diastolic < 80:   return 5    # Elevated
    if systolic < 140 or diastolic < 90:    return 12   # Stage 1 hypertension
    if systolic >= 180 or diastolic >= 120: return 30   # Crisis
    return 20                                            # Stage 2

def heart_rate_score(bpm: float) -> float:
    """Penalty for abnormal heart rate."""
    if 60 <= bpm <= 100: return 0
    if 50 <= bpm < 60 or 100 < bpm <= 110: return 5
    if bpm < 40 or bpm > 150: return 25
    return 15

def glucose_score(mg_dl: float) -> float:
    """Fasting glucose penalty."""
    if 70 <= mg_dl <= 99:  return 0   # Normal
    if 100 <= mg_dl <= 125: return 10  # Pre-diabetic
    if mg_dl >= 126:        return 25  # Diabetic range
    if mg_dl < 70:          return 20  # Hypoglycemia
    return 0

def oxygen_score(spo2: float) -> float:
    if spo2 >= 98:   return 0
    if spo2 >= 95:   return 5
    if spo2 >= 90:   return 20
    return 35

def bmi_score(bmi: float) -> float:
    if 18.5 <= bmi <= 24.9: return 0
    if 25.0 <= bmi <= 29.9: return 8
    if bmi >= 30:            return 18
    if bmi < 18.5:           return 10
    return 0

CONDITION_WEIGHTS = {
    "diabetes":          15,
    "hypertension":      12,
    "heart disease":     20,
    "asthma":            8,
    "copd":              15,
    "cancer":            25,
    "kidney disease":    18,
    "liver disease":     18,
    "stroke":            20,
    "obesity":           10,
}

def conditions_penalty(conditions: list) -> float:
    total = sum(CONDITION_WEIGHTS.get(c.lower(), 5) for c in conditions)
    return min(total, 40)  # cap at 40

def build_features(patient: dict) -> np.ndarray:
    """
    Convert patient data dict to feature vector.
    patient keys: age, gender, weight_kg, height_cm, systolic, diastolic,
                  heart_rate, glucose, oxygen_saturation, conditions (list),
                  allergies (list), medications_count
    """
    age              = patient.get("age", 30)
    gender           = 1 if patient.get("gender", "male").lower() == "female" else 0
    weight           = patient.get("weight_kg", 70)
    height           = patient.get("height_cm", 170)
    systolic         = patient.get("systolic", 120)
    diastolic        = patient.get("diastolic", 80)
    heart_rate       = patient.get("heart_rate", 75)
    glucose          = patient.get("glucose", 90)
    oxygen           = patient.get("oxygen_saturation", 98)
    conditions       = patient.get("conditions", [])
    medications_count = patient.get("medications_count", 0)

    bmi = compute_bmi(weight, height)

    features = [
        age,
        gender,
        bmi,
        systolic,
        diastolic,
        heart_rate,
        glucose,
        oxygen,
        blood_pressure_score(systolic, diastolic),
        heart_rate_score(heart_rate),
        glucose_score(glucose),
        oxygen_score(oxygen),
        bmi_score(bmi),
        conditions_penalty(conditions),
        len(conditions),
        medications_count,
        1 if age > 60 else 0,   # senior flag
        1 if age < 18 else 0,   # minor flag
    ]
    return np.array(features, dtype=np.float32)

# ── Synthetic training data ───────────────────────────────────────────────────

def generate_training_data(n: int = 5000) -> pd.DataFrame:
    """
    Generate synthetic training data with realistic health patterns.
    In production: replace with MIMIC-III or real anonymised data.
    """
    np.random.seed(42)
    rows = []

    for _ in range(n):
        age       = np.random.randint(5, 90)
        gender    = np.random.randint(0, 2)
        bmi       = np.random.normal(26, 5)
        bmi       = max(12, min(50, bmi))
        systolic  = np.random.normal(125, 20)
        diastolic = np.random.normal(82, 12)
        hr        = np.random.normal(75, 15)
        glucose   = np.random.normal(100, 30)
        oxygen    = np.random.normal(97, 2)
        oxygen    = min(100, max(85, oxygen))
        n_conds   = np.random.choice([0,0,0,1,1,2,3], p=[0.4,0.2,0.1,0.1,0.1,0.05,0.05])
        meds      = n_conds + np.random.randint(0, 3)

        # Compute penalty-based score (ground truth)
        bp_pen  = blood_pressure_score(systolic, diastolic)
        hr_pen  = heart_rate_score(hr)
        gluc_pen = glucose_score(glucose)
        oxy_pen = oxygen_score(oxygen)
        bmi_pen = bmi_score(bmi)
        age_pen = min(age * 0.3, 20)
        cond_pen = n_conds * 10

        score = 100 - bp_pen - hr_pen - gluc_pen - oxy_pen - bmi_pen - age_pen - cond_pen
        score = max(5, min(100, score + np.random.normal(0, 3)))  # add noise

        rows.append({
            "age": age, "gender": gender, "bmi": bmi,
            "systolic": systolic, "diastolic": diastolic,
            "heart_rate": hr, "glucose": glucose, "oxygen": oxygen,
            "bp_penalty": bp_pen, "hr_penalty": hr_pen,
            "glucose_penalty": gluc_pen, "oxygen_penalty": oxy_pen,
            "bmi_penalty": bmi_pen, "conditions_penalty": cond_pen,
            "n_conditions": n_conds, "medications": meds,
            "is_senior": int(age > 60), "is_minor": int(age < 18),
            "health_score": score
        })

    return pd.DataFrame(rows)

# ── Train ─────────────────────────────────────────────────────────────────────

def train():
    print("Generating training data…")
    df = generate_training_data(5000)

    feature_cols = [c for c in df.columns if c != "health_score"]
    X = df[feature_cols].values
    y = df["health_score"].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test  = scaler.transform(X_test)

    print("Training XGBoost model…")
    model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        verbosity=0
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    r2  = r2_score(y_test, preds)
    print(f"✅ MAE: {mae:.2f} | R²: {r2:.4f}")

    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print(f"✅ Model saved to {MODEL_PATH}")
    print(f"✅ Scaler saved to {SCALER_PATH}")


# ── Inference helper ──────────────────────────────────────────────────────────

def predict_health_score(patient: dict) -> dict:
    """
    Load saved model and predict health score for one patient.
    Returns score (0-100) and risk level.
    """
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model not found at {MODEL_PATH}. Run training first.")

    model  = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)

    features = build_features(patient).reshape(1, -1)

    # Match feature count (18 engineered features)
    # Build full feature vector matching training columns
    age       = patient.get("age", 30)
    gender    = 1 if patient.get("gender", "male").lower() == "female" else 0
    weight    = patient.get("weight_kg", 70)
    height    = patient.get("height_cm", 170)
    systolic  = patient.get("systolic", 120)
    diastolic = patient.get("diastolic", 80)
    hr        = patient.get("heart_rate", 75)
    glucose   = patient.get("glucose", 90)
    oxygen    = patient.get("oxygen_saturation", 98)
    conditions = patient.get("conditions", [])
    meds      = patient.get("medications_count", 0)
    bmi       = compute_bmi(weight, height)

    X = np.array([[
        age, gender, bmi, systolic, diastolic, hr, glucose, oxygen,
        blood_pressure_score(systolic, diastolic),
        heart_rate_score(hr),
        glucose_score(glucose),
        oxygen_score(oxygen),
        bmi_score(bmi),
        conditions_penalty(conditions),
        len(conditions),
        meds,
        int(age > 60),
        int(age < 18),
    ]], dtype=np.float32)

    X_scaled = scaler.transform(X)
    score = float(model.predict(X_scaled)[0])
    score = max(0, min(100, round(score, 1)))

    risk = (
        "critical" if score < 30 else
        "high"     if score < 50 else
        "medium"   if score < 70 else
        "low"
    )

    return {"health_score": score, "risk_level": risk}


if __name__ == "__main__":
    train()