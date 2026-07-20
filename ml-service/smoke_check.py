from utils.clinical_engine import analyze_symptoms, clinical_chat_reply, drug_interaction_rules

symptoms = analyze_symptoms("fever and headache for two days")
assert symptoms["possible_conditions"], "symptom engine returned no conditions"
assert symptoms["suggested_tests"], "symptom engine returned no tests"

intent, reply = clinical_chat_reply(
    "review my blood pressure",
    patient_name="Patient",
    recent_vitals={"systolic": 150, "diastolic": 95},
)
assert intent == "vitals", "chat engine did not classify vitals"
assert "BP" in reply, "chat engine did not include BP"

drug = drug_interaction_rules(["aspirin", "warfarin"])
assert drug["overall_risk"] == "high", "drug engine missed major interaction"

print("HealthBridge ML smoke check passed.")
