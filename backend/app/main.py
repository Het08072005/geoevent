from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
import json
import logging
import uvicorn
from dotenv import load_dotenv
from math import sin, cos, sqrt, atan2, radians

# ── CRITICAL: load_dotenv FIRST so all os.getenv() calls in imported modules see the values
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Gemini ─────────────────────────────────────────────────────────────────────
from google import genai

from app.services.eventbrite import search_eventbrite_events

# ── FastAPI App ────────────────────────────────────────────────────────────────
app = FastAPI(title="GeoEvents AI Business API", version="1.0.0")

# Production Ready CORS
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_raw.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")
GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY")

# ── Gemini Client ──────────────────────────────────────────────────────────────
gemini_client = None
if GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        logger.info("Gemini client initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Gemini client: {e}")
else:
    logger.warning("GEMINI_API_KEY not set — AI analytics disabled.")

# ── Helpers ────────────────────────────────────────────────────────────────────


def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371e3
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi   = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))

# ── Gemini Analysis ────────────────────────────────────────────────────────────
# Model preference list — tries each in order until one works
GEMINI_MODELS = [
    "gemini-3-flash-preview"
]

async def analyze_business_impact(store_name, location_name, nearby_events):
    if not gemini_client:
        return {
            "error": "Gemini API key not configured",
            "summary": "AI analytics unavailable — GEMINI_API_KEY missing.",
            "analytics": {"conversion_potential": "0%", "visibility_score": "0%", "event_synergy": "0%"},
            "individual_events": [],
            "popular_items": []
        }

    prompt = f"""
    You are a Senior Retail Sales Impact Analyst.
    Analyze the business '{store_name}' at '{location_name}'.

    NEARBY EVENTS DATA (within 1km):
    {json.dumps(nearby_events[:5], indent=2)}

    LOGIC FOR CALCULATION:
    - Sports Events: 0.5% - 1% conversion rate for footfall.
    - College/Cultural Events: 3% - 5% conversion rate for footfall.
    - Other/Generic Events: 1% - 2% conversion rate.

    YOUR TASK:
    Provide a granular retail impact breakdown. Be precise, short, and data-driven.

    GENERATE A JSON RESPONSE WITH THIS EXACT STRUCTURE:
    {{
      "store_info": {{
        "name": "{store_name}",
        "event_count": {len(nearby_events[:5])}
      }},
      "individual_events": [
        {{
          "name": "Event Name",
          "segment": "Specific demographic (e.g., 'Sports fans (18-40)')",
          "footfall": "Calculated range (e.g., '300-500 customers')",
          "behavior": "One-sentence buying behavior",
          "distance": "Distance in meters"
        }}
      ],
      "combined_analysis": {{
        "composition": [
          {{ "label": "Segment Name", "value": 65, "trend": "+12%" }},
          {{ "label": "Other Segment", "value": 35, "trend": "+5%" }}
        ],
        "total_footfall": "Total calculated range (e.g., '380-650 customers')",
        "peak_window": "Specific time sync (e.g., '4PM-8PM')",
        "operational_rec": "Strategic advice (e.g., 'Increase staffing, promote combos')",
        "summary": "One sharp executive sentence on the #1 impact."
      }},
      "popular_items": [
        {{ "item": "Item 1", "who_buys": "Segment", "upsell_tip": "One short tip" }},
        {{ "item": "Item 2", "who_buys": "Segment", "upsell_tip": "One short tip" }},
        {{ "item": "Item 3", "who_buys": "Segment", "upsell_tip": "One short tip" }},
        {{ "item": "Item 4", "who_buys": "Segment", "upsell_tip": "One short tip" }},
        {{ "item": "Item 5", "who_buys": "Segment", "upsell_tip": "One short tip" }},
        {{ "item": "Item 6", "who_buys": "Segment", "upsell_tip": "One short tip" }}
      ],
      "analytics": {{
        "conversion_potential": "X%",
        "visibility_score": "X%",
        "event_synergy": "X%"
      }}
    }}

    Rules:
    - Descriptions MUST be one sentence.
    - Footfall MUST be a range based on the logic above.
    - Return ONLY the JSON object. No markdown fences.
    """

    last_error = None
    for model_name in GEMINI_MODELS:
        try:
            logger.info(f"Trying Gemini model: {model_name}")
            response = gemini_client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            text = response.text.strip()

            # Robust JSON cleaning
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()

            data = json.loads(text)
            logger.info(f"Gemini success with model: {model_name}")
            return data

        except Exception as e:
            last_error = e
            logger.warning(f"Model {model_name} failed: {e}")
            continue

    logger.error(f"All Gemini models failed. Last error: {last_error}")
    return {
        "error": "AI analysis temporarily unavailable",
        "summary": "All Gemini models failed. Check API key and quota.",
        "analytics": {"conversion_potential": "0%", "visibility_score": "0%", "event_synergy": "0%"},
        "individual_events": [],
        "popular_items": []
    }

# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "status": "online",
        "api": "GeoEvents Business Analytics",
        "env": os.getenv("ENV", "development"),
        "gemini": "ready" if gemini_client else "disabled (no API key)"
    }

@app.get("/api/search")
async def search_location(text: str = Query(None)):
    if not text:
        return {"status": "success", "results": []}
    if not GEOAPIFY_API_KEY:
        raise HTTPException(status_code=500, detail="GEOAPIFY_API_KEY not configured")

    url = "https://api.geoapify.com/v1/geocode/search"
    params = {"text": text, "apiKey": GEOAPIFY_API_KEY}

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            results = []
            for feature in data.get("features", []):
                props = feature["properties"]
                results.append({
                    "name":    props.get("formatted"),
                    "lat":     props.get("lat"),
                    "lon":     props.get("lon"),
                    "address": props.get("address_line2"),
                    "city":    props.get("city")
                })
            return {"status": "success", "results": results}
        except Exception as e:
            logger.error(f"Search API Error: {e}")
            return {"status": "error", "message": str(e)}

@app.get("/api/nearby-venues")
async def get_nearby_venues(lat: float, lon: float, radius: float = 5000, city: str = "Palo Alto", category: str = "", date_keyword: str = "", price: str = "", format: str = ""):
    venues = []

    # Fetch Real Eventbrite Events
    eventbrite_events = search_eventbrite_events(city, lat, lon, radius)
    
    if eventbrite_events:
        # Use real events
        venues.extend(eventbrite_events)

    venues.sort(key=lambda x: x.get("distance", 999999))
    return {"status": "success", "venues": venues[:30]}

@app.get("/api/analytics")
async def get_analytics(store_name: str, lat: float, lon: float):
    try:
        res = await get_nearby_venues(lat, lon, 1000)
        venues = res.get("venues", [])
        analytics = await analyze_business_impact(store_name, f"{lat},{lon}", venues)
        return {"status": "success", "analytics": analytics}
    except Exception as e:
        logger.error(f"Analytics Service Error: {e}")
        raise HTTPException(status_code=500, detail="AI Analysis failed")

# ── Entry Point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    host  = os.getenv("HOST", "0.0.0.0")
    port  = int(os.getenv("PORT", 8000))
    debug = os.getenv("ENV", "development") != "production"
    logger.info(f"Starting GeoEvents API on {host}:{port} (debug={debug})")
    uvicorn.run("app.main:app", host=host, port=port, reload=debug)
