"""
Medical OCR Router
Pipeline:
  1. Tesseract extracts raw text from image/PDF
  2. LLaMA3 parses raw text into structured medical data
     (medications, diagnoses, lab results, doctor info)
"""
import json
import os
import re
import pytesseract
from PIL import Image
from fastapi import APIRouter, HTTPException, UploadFile, File
from io import BytesIO

from utils.ollama_client import ask_llama_json
from utils.prompts import OCR_EXTRACTION_SYSTEM, OCR_EXTRACTION_PROMPT

router = APIRouter()

# Set tesseract path from env
tesseract_cmd = os.getenv("TESSERACT_CMD", "/usr/bin/tesseract")
pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

def extract_text_from_image(image_bytes: bytes) -> str:
    """Run Tesseract OCR on image bytes."""
    image = Image.open(BytesIO(image_bytes))
    # Preprocess: convert to grayscale for better OCR
    image = image.convert("L")
    text = pytesseract.image_to_string(image, config="--psm 6")
    return text.strip()

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF — try direct text first, then OCR."""
    try:
        import pdfplumber
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
            if text.strip():
                return text.strip()
    except Exception:
        pass

    # Fallback: render PDF pages as images → OCR
    try:
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(pdf_bytes, dpi=200)
        all_text = []
        for img in images:
            img = img.convert("L")
            all_text.append(pytesseract.image_to_string(img, config="--psm 6"))
        return "\n".join(all_text).strip()
    except Exception as e:
        raise Exception(f"PDF OCR failed: {str(e)}")


@router.post("/extract")
async def extract_medical_document(file: UploadFile = File(...)):
    """
    Upload a prescription / lab report / discharge summary.
    Returns structured medical data extracted by OCR + LLaMA3.
    POST /api/ocr/extract
    """
    content_type = file.content_type or ""
    file_bytes   = await file.read()

    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")

    # Step 1 — OCR
    try:
        if "pdf" in content_type or file.filename.endswith(".pdf"):
            raw_text = extract_text_from_pdf(file_bytes)
        elif any(t in content_type for t in ["image", "jpeg", "jpg", "png"]):
            raw_text = extract_text_from_image(file_bytes)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Upload image or PDF.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")

    if not raw_text or len(raw_text) < 20:
        raise HTTPException(status_code=422, detail="Could not extract text from document. Check image quality.")

    # Step 2 — LLaMA3 structured extraction
    prompt = OCR_EXTRACTION_PROMPT.format(ocr_text=raw_text[:3000])  # limit context

    try:
        raw_json = ask_llama_json(prompt, system=OCR_EXTRACTION_SYSTEM)
        try:
            structured = json.loads(raw_json)
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', raw_json, re.DOTALL)
            structured = json.loads(match.group()) if match else {}
    except Exception as e:
        structured = {"error": str(e)}

    return {
        "success":    True,
        "raw_text":   raw_text,
        "structured": structured,
        "char_count": len(raw_text),
        "model_used": "Tesseract OCR + LLaMA3"
    }


@router.post("/text-extract")
async def extract_from_text(data: dict):
    """
    Already have OCR text? Send it directly for LLaMA3 extraction.
    POST /api/ocr/text-extract
    Body: { text: "..." }
    """
    text = data.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="text field required")

    prompt = OCR_EXTRACTION_PROMPT.format(ocr_text=text[:3000])
    try:
        raw_json  = ask_llama_json(prompt, system=OCR_EXTRACTION_SYSTEM)
        structured = json.loads(raw_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"success": True, "structured": structured}