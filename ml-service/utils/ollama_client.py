"""
Unified LLM client.
- Local development: uses Ollama (llama3:8b)
- Production (Render): falls back to Groq API automatically when Ollama is not running
"""
import os, time, json, requests

# ── Config ────────────────────────────────────────────────────────────────────
OLLAMA_URL  = os.getenv("OLLAMA_URL",    "http://localhost:11434")
MODEL       = os.getenv("OLLAMA_MODEL",  "llama3:8b")
TIMEOUT     = int(os.getenv("OLLAMA_TIMEOUT", "90"))
GROQ_KEY    = os.getenv("GROQ_API_KEY",  "")
GROQ_MODEL  = os.getenv("GROQ_MODEL",    "llama-3.1-8b-instant")
GROQ_URL    = "https://api.groq.com/openai/v1/chat/completions"

# ── Check if Ollama is available ──────────────────────────────────────────────
def ping_ollama() -> bool:
    try:
        r    = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        tags = r.json().get("models", [])
        return any(MODEL.split(":")[0] in m.get("name", "") for m in tags)
    except Exception:
        return False

_OLLAMA_AVAILABLE = ping_ollama()

if _OLLAMA_AVAILABLE:
    print(f"✅ Ollama available — using local model ({MODEL})")
else:
    if GROQ_KEY:
        print(f"⚠️  Ollama not running — falling back to Groq API ({GROQ_MODEL})")
    else:
        print("❌ Ollama not running AND no GROQ_API_KEY set — LLM calls will fail")

# ── Warmup (only if Ollama is running) ───────────────────────────────────────
def _warmup():
    if not _OLLAMA_AVAILABLE:
        return
    try:
        requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": MODEL, "prompt": "hi", "stream": False},
            timeout=120,
        )
        print(f"✅ Ollama warmed up ({MODEL})")
    except Exception as e:
        print(f"⚠️  Ollama warmup failed: {e}")

# ── Groq fallback ─────────────────────────────────────────────────────────────
def _ask_groq(
    prompt:      str,
    system:      str   = "",
    temperature: float = 0.1,
    max_tokens:  int   = 500,
) -> str:
    if not GROQ_KEY:
        raise Exception(
            "Groq API key not set. Add GROQ_API_KEY to your environment variables."
        )

    messages = []
    if system:
        messages.append({"role": "system", "content": system[:2000]})
    messages.append({"role": "user", "content": prompt[:4000]})

    response = requests.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {GROQ_KEY}",
            "Content-Type":  "application/json",
        },
        json={
            "model":       GROQ_MODEL,
            "messages":    messages,
            "temperature": temperature,
            "max_tokens":  max_tokens,
        },
        timeout=30,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"].strip()
    if not content:
        raise Exception("Empty response from Groq")
    return content

# ── Ollama call ───────────────────────────────────────────────────────────────
def _ask_ollama(
    prompt:      str,
    system:      str   = "",
    temperature: float = 0.1,
    max_tokens:  int   = 500,
) -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system[:800]})
    messages.append({"role": "user", "content": prompt[:1500]})

    for attempt in range(2):
        try:
            r = requests.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model":    MODEL,
                    "messages": messages,
                    "stream":   False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                        "top_p":       0.9,
                        "num_ctx":     2048,
                        "stop":        ["<|eot_id|>", "<|end|>", "Human:", "User:"],
                    },
                },
                timeout=TIMEOUT,
            )
            r.raise_for_status()
            content = (r.json().get("message", {}).get("content") or "").strip()
            if content and len(content) > 10:
                return content
            raise ValueError("Empty response from Ollama")

        except requests.exceptions.Timeout:
            if attempt == 0:
                time.sleep(2)
                continue
            raise Exception("Ollama timeout")

        except requests.exceptions.ConnectionError:
            raise Exception("Ollama not running")

        except Exception as e:
            if attempt == 0:
                time.sleep(1)
                continue
            raise Exception(f"Ollama error: {e}")

    raise Exception("Ollama failed after 2 attempts")

# ── Main public functions (same names as before — routers need no changes) ────
def ask_llama(
    prompt:      str,
    system:      str   = "",
    temperature: float = 0.1,
    max_tokens:  int   = 500,
) -> str:
    """
    Try Ollama first. If not available, fall back to Groq.
    Raises Exception on total failure so callers can handle gracefully.
    """
    if _OLLAMA_AVAILABLE:
        try:
            return _ask_ollama(prompt, system, temperature, max_tokens)
        except Exception as ollama_err:
            print(f"⚠️  Ollama failed ({ollama_err}) — trying Groq fallback")

    # Groq fallback
    return _ask_groq(prompt, system, temperature, max_tokens)


def ask_llama_json(
    prompt:      str,
    system:      str   = "",
    temperature: float = 0.1,
    max_tokens:  int   = 600,
) -> str:
    """
    Ask LLM and return valid JSON string.
    Strips markdown fences if the model wraps output in ```json ... ```.
    Raises Exception on failure — callers should catch and return a fallback dict.
    """
    json_system = (
        (system + "\n" if system else "") +
        "You must respond with valid JSON only. "
        "No explanation, no markdown, no code fences. Just raw JSON."
    )

    raw = ask_llama(
        prompt,
        system=json_system,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    # Strip markdown fences the model sometimes adds despite instructions
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()

    # Validate it is actually JSON
    try:
        json.loads(cleaned)
    except ValueError:
        raise Exception(f"LLM returned non-JSON: {cleaned[:200]}")

    return cleaned


# Warmup on import (only runs if Ollama is available)
_warmup()