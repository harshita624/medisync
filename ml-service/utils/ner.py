import re

def load_nlp():
    """Load best available medical NLP model."""
    try:
        import spacy
        nlp = spacy.load("en_core_sci_md")
        print("Loaded scispaCy medical model (en_core_sci_md)")
        return nlp, "scispacy"
    except OSError:
        try:
            import spacy
            nlp = spacy.load("en_core_web_sm")
            print("scispaCy not found - using en_core_web_sm (basic NLP)")
            return nlp, "basic"
        except OSError:
            print("No spaCy model found - NER disabled")
            return None, "none"

_nlp, _model_type = load_nlp()

SYMPTOM_KEYWORDS = [
    "pain", "fever", "cough", "headache", "nausea", "vomiting", "fatigue",
    "dizziness", "shortness of breath", "chest pain", "swelling", "rash",
    "itching", "bleeding", "diarrhea", "constipation", "insomnia", "anxiety",
    "depression", "weakness", "numbness", "tingling", "blurred vision",
    "hearing loss", "sore throat", "runny nose", "back pain", "joint pain",
    "muscle pain", "abdominal pain", "palpitations", "weight loss", "weight gain",
]

BODY_PARTS = [
    "head", "chest", "abdomen", "back", "neck", "shoulder", "arm", "leg",
    "knee", "ankle", "foot", "hand", "wrist", "elbow", "hip", "spine",
    "heart", "lung", "liver", "kidney", "stomach", "intestine", "brain",
]

def extract_medical_entities(text: str) -> dict:
    text_lower = text.lower()
    result = {
        "symptoms": [],
        "conditions": [],
        "drugs": [],
        "anatomy": [],
        "procedures": [],
        "raw_entities": [],
    }

    for symptom in SYMPTOM_KEYWORDS:
        if symptom in text_lower:
            result["symptoms"].append(symptom)

    for part in BODY_PARTS:
        if part in text_lower:
            result["anatomy"].append(part)

    if _nlp:
        doc = _nlp(text)
        for ent in doc.ents:
            entity = {"text": ent.text, "label": ent.label_}
            result["raw_entities"].append(entity)

            label = ent.label_.upper()
            if label in ["DISEASE", "CONDITION", "DISORDER"]:
                result["conditions"].append(ent.text)
            elif label in ["CHEMICAL", "DRUG", "MEDICATION"]:
                result["drugs"].append(ent.text)
            elif label in ["BODY_PART", "ANATOMY", "ORGAN"]:
                if ent.text.lower() not in result["anatomy"]:
                    result["anatomy"].append(ent.text)
            elif label in ["PROCEDURE", "TREATMENT"]:
                result["procedures"].append(ent.text)

    for key in result:
        if isinstance(result[key], list) and key != "raw_entities":
            result[key] = list(set(result[key]))

    return result

def extract_symptoms_from_text(text: str) -> list[str]:
    entities = extract_medical_entities(text)
    symptoms = entities["symptoms"]

    for cond in entities["conditions"]:
        if cond.lower() not in [s.lower() for s in symptoms]:
            symptoms.append(cond)

    return symptoms if symptoms else [text]

def clean_symptom_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z\s,]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text
