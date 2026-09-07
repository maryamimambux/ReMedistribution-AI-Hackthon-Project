"""
ReMedistribution — AI Microservice
FastAPI service for OCR, Computer Vision, Chatbot, and Demand Forecasting

Production-ready architecture:
- Uses Alibaba Cloud Model Studio (DashScope) OpenAI-compatible endpoints by default
- Provider-agnostic OpenAI client makes it trivial to swap to OpenAI, Groq, or self-hosted models
- All AI features have graceful fallbacks so the app never crashes if the LLM is unavailable
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from decimal import Decimal
import uvicorn
import os
import io
import json
import base64
import sqlite3
import math
import random
import asyncio

# Third-party
from dotenv import load_dotenv
from PIL import Image
from openai import OpenAI

# Load environment variables from .env file
load_dotenv()

app = FastAPI(
    title="ReMedistribution AI Service",
    description="AI/ML microservice for medicine donation platform",
    version="2.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Configuration ─────────────────────────────────────────────────────

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
DASHSCOPE_BASE_URL = os.getenv(
    "DASHSCOPE_BASE_URL", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
)
DB_PATH = os.getenv("DB_PATH", os.path.join("..", "server", "prisma", "dev.db"))

VISION_MODEL = os.getenv("VISION_MODEL", "qwen3-vl-32b-thinking")
VISION_FALLBACK_MODEL = os.getenv("VISION_FALLBACK_MODEL", "qwen3-vl-30b-a3b-thinking")
CHAT_MODEL = os.getenv("CHAT_MODEL", "qwen-mt-flash")
CHAT_FALLBACK_MODEL = os.getenv("CHAT_FALLBACK_MODEL", "qwen3.7-plus")

# Provider-agnostic OpenAI client
client: Optional[OpenAI] = None
if DASHSCOPE_API_KEY:
    client = OpenAI(api_key=DASHSCOPE_API_KEY, base_url=DASHSCOPE_BASE_URL)


# ─── Models ────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    message: str


# ─── Helpers ───────────────────────────────────────────────────────────

def _encode_image(image_bytes: bytes, max_size: tuple = (1024, 1024), quality: int = 85) -> str:
    """Resize and encode image to base64 JPEG for LLM vision APIs."""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    img.thumbnail(max_size, Image.LANCZOS)
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=quality)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


async def _llm_chat_completion(model: str, messages: list, temperature: float = 0.2, fallback_model: Optional[str] = None) -> str:
    """Call the LLM with the given messages. Falls back to a secondary model on failure.

    The OpenAI client performs synchronous HTTP requests, so we offload it to a
    thread to avoid blocking the uvicorn event loop (keeps /api/health responsive).
    """
    if not client:
        raise RuntimeError("LLM client not configured")

    def _call(current_model: str) -> str:
        response = client.chat.completions.create(
            model=current_model,
            messages=messages,
            temperature=temperature,
            max_tokens=1024,
        )
        return response.choices[0].message.content or ""

    try:
        return await asyncio.to_thread(_call, model)
    except Exception as e:
        print(f"[LLM] {model} failed: {e}")
        if fallback_model and fallback_model != model:
            print(f"[LLM] Trying fallback model {fallback_model}")
            return await asyncio.to_thread(_call, fallback_model)
        raise


def _extract_json(text: str) -> dict:
    """Extract a JSON object from model output that may include markdown."""
    text = text.strip()
    # Try direct JSON first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip markdown fences
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

    # Find first JSON object in text
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError("No valid JSON found in model output")


# ─── Health Check ──────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service": "ReMedistribution AI Service",
        "status": "running",
        "version": "2.0.0",
        "llm_configured": bool(client),
        "endpoints": ["/api/ocr", "/api/vision", "/api/chatbot/parse", "/api/forecast"],
    }


@app.get("/api/health")
async def health():
    return {"status": "ok", "llm_configured": bool(client)}


# ─── OCR Endpoint ──────────────────────────────────────────────────────

OCR_SYSTEM_PROMPT = """You are an expert at reading medicine packaging labels from images.
You may be shown up to 3 images of the same medicine package (e.g., front label, expiry/batch side, manufacturer side).
Read ALL images and extract the most accurate value for each field.
Return ONLY a valid JSON object with this exact shape, no markdown, no explanation:
{
  "medicineName": "exact medicine name",
  "batchNumber": "batch/lot number",
  "expiryDate": "YYYY-MM or YYYY-MM-DD",
  "manufacturer": "company name",
  "dosage": "e.g. 2mg, 500mg, 10ml",
  "category": "best category from: Diabetes, Cardiovascular, Antibiotics, Pain Relief, Respiratory, Gastrointestinal, Steroids, Vitamins, Other",
  "confidence": 0.0-1.0
}
If a field is missing or unreadable across all images, use null.
Pick the best non-null value when a field appears in multiple images."""


@app.post("/api/ocr")
async def ocr_scan(
    image: Optional[UploadFile] = File(None),
    images: Optional[List[UploadFile]] = File(None),
):
    """
    Extract structured medicine-label data from one or more images using a vision-language model.
    Accepts either a single 'image' or up to 3 'images'.
    """
    try:
        if not client:
            raise RuntimeError("AI service not configured with an API key")

        files = []
        if images:
            files.extend(images)
        if image and image not in files:
            files.append(image)
        if not files:
            raise HTTPException(status_code=400, detail="No image provided")
        if len(files) > 3:
            raise HTTPException(status_code=400, detail="Maximum 3 images allowed")

        # Encode all images
        content_blocks = []
        for f in files:
            image_bytes = await f.read()
            base64_image = _encode_image(image_bytes)
            content_blocks.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}})

        content_blocks.append({"type": "text", "text": OCR_SYSTEM_PROMPT + "\n\nRead all provided medicine label images and return the structured JSON."})

        messages = [{"role": "user", "content": content_blocks}]

        content = await _llm_chat_completion(VISION_MODEL, messages, fallback_model=VISION_FALLBACK_MODEL)
        fields = _extract_json(content)

        # Normalize fields
        text = f"{fields.get('medicineName', '')} {fields.get('dosage', '')} | {fields.get('manufacturer', '')} | Batch: {fields.get('batchNumber', '')} | Exp: {fields.get('expiryDate', '')}".strip()

        return {
            "success": True,
            "data": {
                "text": text,
                "fields": {
                    "medicineName": fields.get("medicineName"),
                    "batchNumber": fields.get("batchNumber"),
                    "expiryDate": fields.get("expiryDate"),
                    "manufacturer": fields.get("manufacturer"),
                    "dosage": fields.get("dosage"),
                    "category": fields.get("category"),
                },
                "confidence": float(fields.get("confidence", 0.85)),
                "source": "qwen-vision",
                "model": VISION_MODEL,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[OCR] Error: {e}")
        # Graceful fallback
        return {
            "success": True,
            "data": {
                "text": f"OCR failed: {str(e)}",
                "fields": {
                    "medicineName": None,
                    "batchNumber": None,
                    "expiryDate": None,
                    "manufacturer": None,
                    "dosage": None,
                    "category": None,
                },
                "confidence": 0,
                "source": "fallback",
                "note": "AI service error. Please enter details manually.",
            },
        }


# ─── Computer Vision Endpoint ──────────────────────────────────────────

VISION_SYSTEM_PROMPT = """You are a quality-control assistant inspecting medicine packaging.
You may be shown up to 3 images of the same medicine package from different angles.
Assess the packaging using ALL images:
1. Is the seal intact/unbroken?
2. Is the packaging damaged (tears, dents, water damage, fading)?
3. Are there signs of tampering (re-glued, broken hologram, mismatched labels)?
4. Is the label readable?
Return ONLY a valid JSON object with this exact shape, no markdown:
{
  "sealIntact": true/false,
  "damaged": true/false,
  "tampered": true/false,
  "labelReadable": true/false,
  "confidence": 0.0-1.0,
  "flags": ["short human-readable observation 1", "observation 2"]
}
Be conservative: if you cannot clearly confirm something is safe, flag it."""


@app.post("/api/vision")
async def vision_check(
    image: Optional[UploadFile] = File(None),
    images: Optional[List[UploadFile]] = File(None),
):
    """
    Analyze medicine packaging for seal integrity, damage, and tampering.
    Accepts either a single 'image' or up to 3 'images'.
    """
    try:
        if not client:
            raise RuntimeError("AI service not configured with an API key")

        files = []
        if images:
            files.extend(images)
        if image and image not in files:
            files.append(image)
        if not files:
            raise HTTPException(status_code=400, detail="No image provided")
        if len(files) > 3:
            raise HTTPException(status_code=400, detail="Maximum 3 images allowed")

        content_blocks = []
        for f in files:
            image_bytes = await f.read()
            base64_image = _encode_image(image_bytes)
            content_blocks.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}})

        content_blocks.append({"type": "text", "text": VISION_SYSTEM_PROMPT + "\n\nInspect all provided images and return the JSON assessment."})

        messages = [{"role": "user", "content": content_blocks}]

        content = await _llm_chat_completion(VISION_MODEL, messages, fallback_model=VISION_FALLBACK_MODEL)
        result = _extract_json(content)

        return {
            "success": True,
            "data": {
                "sealIntact": bool(result.get("sealIntact", True)),
                "damaged": bool(result.get("damaged", False)),
                "tampered": bool(result.get("tampered", False)),
                "labelReadable": bool(result.get("labelReadable", True)),
                "confidence": float(result.get("confidence", 0.8)),
                "flags": result.get("flags", []),
                "source": "qwen-vision",
                "model": VISION_MODEL,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Vision] Error: {e}")
        return {
            "success": True,
            "data": {
                "sealIntact": True,
                "damaged": False,
                "tampered": False,
                "labelReadable": True,
                "confidence": 0,
                "flags": [f"Vision check failed: {str(e)}. Verify manually."],
                "source": "fallback",
                "note": "AI service error. Please verify packaging manually.",
            },
        }


# ─── Chatbot NLP Endpoint ──────────────────────────────────────────────

CHATBOT_SYSTEM_PROMPT = """You extract structured information from patient messages written in English or Urdu (Roman Urdu).
Return ONLY a valid JSON object with this exact shape, no markdown:
{
  "medicineName": "medicine name or generic category",
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "city": "city name",
  "location": "area/neighborhood if mentioned, else city",
  "quantity": integer,
  "description": "short summary of the request"
}

Rules:
- If the message is in Urdu/Roman Urdu, translate/extract meaning into English values.
- Urgency mapping: "fauri", "fori", "emergency", "urgent", "critical", "dying", "asap", "immediately" → CRITICAL. "jalde", "jaldi", "need soon", "running out" → HIGH. "can wait", "no rush", "baad mein" → LOW. Default MEDIUM.
- Common cities: Karachi, Lahore, Islamabad, Rawalpindi, Peshawar, Quetta, Faisalabad, Multan, Sialkot, Gujranwala, Hyderabad.
- If medicine name is unclear, use the closest generic category (e.g. "diabetes medicine", "blood pressure medicine").
- Quantity default is 1."""


@app.post("/api/chatbot/parse")
async def chatbot_parse(msg: ChatMessage):
    """
    Parse free-text (Urdu/English) patient description into structured fields.
    """
    try:
        if not client:
            raise RuntimeError("AI service not configured with an API key")

        # Alibaba Qwen models do not support the "system" role via the OpenAI-compatible endpoint
        messages = [
            {
                "role": "user",
                "content": CHATBOT_SYSTEM_PROMPT + f"\n\nExtract from this message:\n\"{msg.message}\"",
            },
        ]

        content = await _llm_chat_completion(CHAT_MODEL, messages, fallback_model=CHAT_FALLBACK_MODEL)
        parsed = _extract_json(content)

        return {
            "success": True,
            "data": {
                "medicineName": parsed.get("medicineName") or "Unknown",
                "urgency": parsed.get("urgency", "MEDIUM").upper(),
                "city": parsed.get("city"),
                "location": parsed.get("location") or parsed.get("city"),
                "quantity": int(parsed.get("quantity", 1)) if parsed.get("quantity") else 1,
                "description": parsed.get("description", ""),
                "source": "qwen-chat",
                "model": CHAT_MODEL,
            },
        }
    except Exception as e:
        print(f"[Chatbot] Error: {e}")
        # Return fallback structure so backend can still create a request
        return {
            "success": True,
            "data": {
                "medicineName": "Unknown",
                "urgency": "MEDIUM",
                "city": None,
                "location": None,
                "quantity": 1,
                "description": "",
                "source": "fallback",
                "note": f"AI service error: {str(e)}. Please use the form instead.",
            },
        }


# ─── Demand Forecasting Endpoint ──────────────────────────────────────

CATEGORY_MAP = {
    "diabetes": "Diabetes",
    "cardiovascular": "Cardiovascular",
    "antibiotics": "Antibiotics",
    "pain relief": "Pain Relief",
    "respiratory": "Respiratory",
    "gastrointestinal": "Gastrointestinal",
    "steroids": "Steroids",
    "vitamins": "Vitamins",
}

DEFAULT_CATEGORIES = ["Diabetes", "Cardiovascular", "Antibiotics", "Pain Relief", "Respiratory", "Gastrointestinal", "Steroids"]
DEFAULT_CITIES = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Peshawar", "Quetta"]


def _resolve_category(name: Optional[str]) -> str:
    if not name:
        return "Other"
    key = name.lower()
    for k, v in CATEGORY_MAP.items():
        if k in key:
            return v
    return name


def _month_key(dt: datetime) -> str:
    return dt.strftime("%Y-%m")


def _parse_datetime(value) -> datetime:
    """Parse a Prisma SQLite DateTime value (INTEGER ms-since-epoch or ISO string)."""
    if value is None:
        return datetime.now()
    if isinstance(value, int):
        # Prisma SQLite stores DateTime as INTEGER milliseconds
        return datetime.fromtimestamp(value / 1000)
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return datetime.now()


def _linear_regression(xs: list, ys: list) -> tuple:
    """Pure-Python least-squares linear regression. Returns (slope, intercept)."""
    n = len(xs)
    if n == 0:
        return 0.0, 0.0
    if n == 1:
        return 0.0, ys[0]
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    denominator = sum((x - mean_x) ** 2 for x in xs)
    if denominator == 0:
        return 0.0, mean_y
    slope = numerator / denominator
    intercept = mean_y - slope * mean_x
    return slope, intercept


def _build_forecast(months: int = 6, city_filter: Optional[str] = None, category_filter: Optional[str] = None):
    """
    Build demand forecast from real PatientRequest and Donation history in SQLite.
    Falls back to simulated seasonal data if the DB is empty or unreadable.
    """
    forecast_data = []
    now = datetime.now()

    # Determine months to predict
    future_months = []
    for m in range(1, months + 1):
        d = now + timedelta(days=30 * m)
        future_months.append(d.strftime("%Y-%m"))

    # Historical monthly demand: aggregate PatientRequest quantity + count by city/category
    history = {}  # {(city, category, month): {requests: int, quantity: int}}
    donation_history = {}  # {(city, category, month): {donations: int, quantity: int}}

    db_path = os.path.abspath(DB_PATH)
    if not os.path.exists(db_path):
        print(f"[Forecast] Database not found at {db_path}, using fallback")
        return _simulated_forecast(months, city_filter, category_filter)

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Build medicine name -> category mapping
        cursor.execute("SELECT name, category FROM medicines")
        medicine_category = {row["name"]: row["category"] for row in cursor.fetchall()}

        # Patient requests
        cursor.execute(
            """
            SELECT city, medicineName, quantity, createdAt
            FROM patient_requests
            WHERE createdAt IS NOT NULL
            """
        )
        for row in cursor.fetchall():
            city = row["city"] or "Unknown"
            medicine_name = row["medicineName"] or ""
            category = medicine_category.get(medicine_name) or _resolve_category(medicine_name)
            qty = int(row["quantity"]) if row["quantity"] else 1
            created = _parse_datetime(row["createdAt"])
            month = _month_key(created)
            key = (city, category, month)
            history.setdefault(key, {"requests": 0, "quantity": 0})
            history[key]["requests"] += 1
            history[key]["quantity"] += qty

        # Donations (join with medicines to get category)
        cursor.execute(
            """
            SELECT d.centerId, m.category AS medicineCategory, d.quantity, d.createdAt
            FROM donations d
            LEFT JOIN medicines m ON d.medicineId = m.id
            WHERE d.createdAt IS NOT NULL
            """
        )
        for row in cursor.fetchall():
            category = row["medicineCategory"] or _resolve_category(row["medicineCategory"]) or "Other"
            qty = int(row["quantity"]) if row["quantity"] else 1
            created = _parse_datetime(row["createdAt"])
            month = _month_key(created)
            # Resolve centerId to city
            center_id = row["centerId"]
            city = None
            if center_id:
                c = cursor.execute("SELECT city FROM collection_centers WHERE id = ?", (center_id,)).fetchone()
                city = c["city"] if c else None
            if not city:
                city = "Unknown"
            key = (city, category, month)
            donation_history.setdefault(key, {"donations": 0, "quantity": 0})
            donation_history[key]["donations"] += 1
            donation_history[key]["quantity"] += qty

        conn.close()
    except Exception as e:
        print(f"[Forecast] DB read error: {e}")
        return _simulated_forecast(months, city_filter, category_filter)

    # If no historical data at all, fall back
    if not history:
        return _simulated_forecast(months, city_filter, category_filter)

    # Determine city/category grid
    if city_filter and category_filter:
        cities = [city_filter]
        categories = [category_filter]
    elif city_filter:
        cities = [city_filter]
        categories = sorted({k[1] for k in history.keys()}) or DEFAULT_CATEGORIES
    elif category_filter:
        cities = sorted({k[0] for k in history.keys()}) or DEFAULT_CITIES
        categories = [category_filter]
    else:
        cities = sorted({k[0] for k in history.keys()}) or DEFAULT_CITIES
        categories = sorted({k[1] for k in history.keys()}) or DEFAULT_CATEGORIES

    # Build per-series forecast
    for city in cities:
        for category in categories:
            series = []
            # Sort historical months
            months_in_history = sorted({k[2] for k in history.keys() if k[0] == city and k[1] == category})
            if not months_in_history:
                # Use global average for this category across all cities
                months_in_history = sorted({k[2] for k in history.keys() if k[1] == category})

            for idx, month in enumerate(months_in_history):
                key = (city, category, month)
                req = history.get(key, {"requests": 0, "quantity": 0})
                # Demand signal = number of requests weighted by quantity
                value = req["requests"] + req["quantity"] * 0.5
                series.append((idx, value))

            if len(series) >= 3:
                slope, intercept = _linear_regression([x[0] for x in series], [x[1] for x in series])
                last_idx = len(series) - 1
                # Add seasonal adjustment based on month-of-year averages
                month_averages = {}
                for _, month in enumerate(months_in_history):
                    key = (city, category, month)
                    req = history.get(key, {"requests": 0, "quantity": 0})
                    mo = int(month.split("-")[1])
                    month_averages.setdefault(mo, []).append(req["requests"] + req["quantity"] * 0.5)
                seasonal_factors = {mo: sum(vals) / len(vals) for mo, vals in month_averages.items()}
                overall_avg = sum(v for _, v in series) / len(series)

                for i, month in enumerate(future_months):
                    trend = intercept + slope * (last_idx + i + 1)
                    mo = int(month.split("-")[1])
                    seasonal = seasonal_factors.get(mo, overall_avg)
                    # Blend trend and seasonality
                    predicted = max(0, round(0.6 * trend + 0.4 * seasonal))
                    forecast_data.append({
                        "city": city,
                        "category": category,
                        "month": month,
                        "predicted": predicted,
                        "confidence": round(min(0.95, 0.5 + 0.1 * len(series)), 2),
                    })
            elif len(series) >= 1:
                # Limited history — use historical average + small growth
                values = [v for _, v in series]
                avg = sum(values) / len(values)
                for i, month in enumerate(future_months):
                    predicted = max(0, round(avg * (1 + 0.02 * (i + 1))))
                    forecast_data.append({
                        "city": city,
                        "category": category,
                        "month": month,
                        "predicted": predicted,
                        "confidence": 0.6,
                    })
            else:
                # No data for this city/category pair
                for i, month in enumerate(future_months):
                    forecast_data.append({
                        "city": city,
                        "category": category,
                        "month": month,
                        "predicted": 0,
                        "confidence": 0.5,
                    })

    return {
        "forecast": forecast_data,
        "source": "ml-forecast",
        "note": "Forecast trained on real donation and patient-request history using linear regression.",
    }


def _simulated_forecast(months: int = 6, city: Optional[str] = None, category: Optional[str] = None):
    """Seasonal fallback used when no historical data exists."""
    base_demand = {
        "Diabetes": 450,
        "Cardiovascular": 380,
        "Antibiotics": 520,
        "Pain Relief": 600,
        "Respiratory": 280,
        "Gastrointestinal": 350,
        "Steroids": 150,
    }
    seasonal = {
        "Diabetes":       [1.0, 1.0, 1.1, 1.0, 0.9, 0.9, 1.0, 1.0, 1.1, 1.1, 1.2, 1.3],
        "Cardiovascular": [1.2, 1.1, 1.0, 0.9, 0.9, 0.8, 0.9, 0.9, 1.0, 1.0, 1.1, 1.2],
        "Antibiotics":    [1.3, 1.2, 1.1, 0.9, 0.8, 0.7, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4],
        "Pain Relief":    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.1, 1.1],
        "Respiratory":    [1.4, 1.3, 1.1, 0.8, 0.7, 0.6, 0.6, 0.7, 0.8, 1.0, 1.2, 1.5],
        "Gastrointestinal":[0.9, 0.9, 1.0, 1.1, 1.2, 1.3, 1.3, 1.2, 1.1, 1.0, 0.9, 0.9],
        "Steroids":       [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    }
    now = datetime.now()
    categories = [category] if category else list(base_demand.keys())
    cities = [city] if city else ["Lahore", "Karachi", "Islamabad"]

    forecast_data = []
    for c in cities:
        city_factor = {"Lahore": 1.1, "Karachi": 1.2, "Islamabad": 0.9}.get(c, 1.0)
        for cat in categories:
            base = base_demand.get(cat, 300)
            factors = seasonal.get(cat, [1.0] * 12)
            for m in range(months):
                month_date = now + timedelta(days=30 * m)
                month_idx = month_date.month - 1
                factor = factors[month_idx]
                predicted = int(base * factor * city_factor + random.randint(-20, 20))
                forecast_data.append({
                    "city": c,
                    "category": cat,
                    "month": month_date.strftime("%Y-%m"),
                    "predicted": max(0, predicted),
                    "confidence": round(random.uniform(0.72, 0.92), 2),
                })

    return {
        "forecast": forecast_data,
        "source": "simulation",
        "note": "Not enough historical data. Showing simulated seasonal forecast.",
    }


@app.get("/api/forecast")
async def demand_forecast(
    city: Optional[str] = None,
    category: Optional[str] = None,
    months: int = 6,
):
    """
    Generate demand forecast for medicine categories by city.
    Uses real donation and patient-request history when available.
    """
    try:
        result = _build_forecast(months=months, city_filter=city, category_filter=category)
        return {
            "success": True,
            "data": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
