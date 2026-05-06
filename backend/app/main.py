from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from collections import defaultdict
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
from app.services.event_sources import event_sources_service
from app.services.serpapi_search import serpapi_service

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

# ── DISABLED: Google Search API (Kept for future implementation) ────────────────
# Google Custom Search API requires:
# 1. Custom Search Engine ID (cx) configuration
# 2. API enablement in Google Cloud Console
# To enable: Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX in .env
# For now, using event sources directory approach (Step 1 of event discovery workflow)
# GOOGLE_SEARCH_API_KEY = os.getenv("GOOGLE_SEARCH_API")
# GOOGLE_SEARCH_CX = os.getenv("GOOGLE_SEARCH_CX")

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
    """
    Search for locations using Geoapify geocoding API.
    Returns formatted address, lat, lon, and city information.
    """
    if not text or text.strip() == "":
        return {"status": "success", "results": []}
    
    if not GEOAPIFY_API_KEY:
        logger.error("GEOAPIFY_API_KEY not configured")
        return {"status": "error", "message": "Location search not available", "results": []}

    url = "https://api.geoapify.com/v1/geocode/autocomplete"
    params = {"text": text, "apiKey": GEOAPIFY_API_KEY}

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            results = []
            for feature in data.get("features", []):
                props = feature["properties"]
                result = {
                    "name": props.get("formatted"),
                    "lat": props.get("lat"),
                    "lon": props.get("lon"),
                    "address": props.get("address_line2"),
                    "city": props.get("city")
                }
                # Validate required fields
                if result.get("name") and result.get("lat") and result.get("lon"):
                    results.append(result)
            
            logger.info(f"Search for '{text}' returned {len(results)} results")
            return {"status": "success", "results": results}
        except httpx.HTTPError as e:
            logger.error(f"Geoapify API Error: {e}")
            return {"status": "error", "message": "Location search failed", "results": []}
        except Exception as e:
            logger.error(f"Search Error: {e}")
            return {"status": "error", "message": "An unexpected error occurred", "results": []}

@app.get("/api/nearby-venues")
async def get_nearby_venues(lat: float, lon: float, radius: float = 5000, city: str = "Palo Alto", category: str = "", date_keyword: str = "", price: str = "", format: str = ""):
    """
    Get nearby venues/events. Currently returns ONLY Eventbrite events.
    All events are validated to have required fields before being returned.
    """
    venues = []

    try:
        # Fetch Real Eventbrite Events ONLY
        eventbrite_events = search_eventbrite_events(city, lat, lon, radius)
        
        if eventbrite_events:
            # Validate each event has required fields
            for event in eventbrite_events:
                try:
                    # Ensure all critical fields exist
                    if all(k in event for k in ["name", "lat", "lon", "price", "date"]):
                        venues.append(event)
                except (KeyError, TypeError):
                    logger.warning(f"Skipped malformed event: {event}")
                    continue

        # Sort by distance
        venues.sort(key=lambda x: x.get("distance", 999999))
        
        logger.info(f"Returning {len(venues)} validated venues from Eventbrite")
        return {"status": "success", "venues": venues[:30]}
    except Exception as e:
        logger.error(f"Get nearby venues error: {e}")
        return {"status": "error", "message": "Failed to fetch nearby venues", "venues": []}

@app.get("/api/analytics")
async def get_analytics(store_name: str, lat: float, lon: float):
    """
    Get AI-powered business impact analytics using Gemini.
    This endpoint is ONLY called when user explicitly requests it via the 'Generate' button.
    Returns meaningful error messages if Gemini is unavailable.
    """
    try:
        if not store_name or not lat or not lon:
            raise HTTPException(status_code=400, detail="store_name, lat, and lon parameters are required")
        
        # Validate coordinates are reasonable
        if lat < -90 or lat > 90 or lon < -180 or lon > 180:
            raise HTTPException(status_code=400, detail="Invalid coordinates")
        
        res = await get_nearby_venues(lat, lon, 1000, "")
        venues = res.get("venues", [])
        
        if not venues:
            return {
                "status": "success",
                "analytics": {
                    "error": "No nearby events found",
                    "summary": "No events found within 1km radius. Cannot generate impact analysis.",
                    "analytics": {"conversion_potential": "0%", "visibility_score": "0%", "event_synergy": "0%"},
                    "individual_events": [],
                    "popular_items": []
                }
            }
        
        analytics = await analyze_business_impact(store_name, f"{lat},{lon}", venues)
        return {"status": "success", "analytics": analytics}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analytics Service Error: {e}")
        return {
            "status": "error",
            "analytics": {
                "error": "AI analysis failed",
                "summary": "An error occurred while generating the impact report. Please try again.",
                "analytics": {"conversion_potential": "0%", "visibility_score": "0%", "event_synergy": "0%"},
                "individual_events": [],
                "popular_items": []
            }
        }

# ── Event Sources Routes (Step 1: Source Directory) ────────────────────────────
@app.get("/api/event-sources/all")
async def get_all_event_sources():
    """Get all event sources sorted by priority."""
    try:
        sources = event_sources_service.get_all_sources()
        return {
            "status": "success",
            "total": len(sources),
            "sources": sources
        }
    except Exception as e:
        logger.error(f"Event Sources Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch event sources")

@app.get("/api/event-sources/search")
async def search_event_sources(location: str = Query(None), radius_km: float = Query(25)):
    """
    Search event sources by location and radius.
    
    Query Parameters:
    - location: Location name (e.g., "Palo Alto")
    - radius_km: Search radius in kilometers (default: 25)
    """
    try:
        if not location:
            sources = event_sources_service.get_all_sources()
        else:
            sources = event_sources_service.search_sources_by_location(location, radius_km)
        
        return {
            "status": "success",
            "location": location,
            "radius_km": radius_km,
            "total": len(sources),
            "sources": sources
        }
    except Exception as e:
        logger.error(f"Event Sources Search Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to search event sources")

@app.get("/api/event-sources/category")
async def get_sources_by_category(category: str = Query(None)):
    """Get event sources filtered by category."""
    try:
        if not category:
            grouped = event_sources_service.get_sources_by_category_group()
            return {
                "status": "success",
                "categories": list(grouped.keys()),
                "sources_by_category": grouped
            }
        else:
            sources = event_sources_service.search_sources_by_category(category)
            return {
                "status": "success",
                "category": category,
                "total": len(sources),
                "sources": sources
            }
    except Exception as e:
        logger.error(f"Event Sources Category Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch sources by category")

@app.get("/api/event-sources/locations")
async def get_supported_locations():
    """Get all supported location names for searching."""
    try:
        locations = event_sources_service.get_supported_locations()
        return {
            "status": "success",
            "locations": locations
        }
    except Exception as e:
        logger.error(f"Event Sources Locations Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch supported locations")

@app.get("/api/event-sources/priority")
async def get_priority_sources(min_priority: int = Query(4)):
    """Get high-priority event sources only."""
    try:
        sources = event_sources_service.get_priority_sources(min_priority)
        return {
            "status": "success",
            "priority_level": min_priority,
            "total": len(sources),
            "sources": sources
        }
    except Exception as e:
        logger.error(f"Event Sources Priority Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch priority sources")

@app.get("/api/event-sources/api-accessible")
async def get_api_accessible_sources():
    """Get sources with API or RSS access for automation."""
    try:
        sources = event_sources_service.get_api_accessible_sources()
        return {
            "status": "success",
            "total": len(sources),
            "sources": sources
        }
    except Exception as e:
        logger.error(f"Event Sources API Access Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch API-accessible sources")

# ── SerpAPI Event Source Discovery Routes ──────────────────────────────────────
@app.get("/api/search-event-websites")
async def search_event_websites(location: str = Query(...)):
    """
    Search for ALL event websites in a given location using SerpAPI.
    
    Query Parameters:
    - location: Location name (e.g., "Palo Alto, CA")
    
    Returns: List of websites where events are posted for that location
    """
    try:
        if not location or location.strip() == "":
            raise HTTPException(status_code=400, detail="Location parameter required")
        
        result = await serpapi_service.search_event_sources(location)
        return result
    except Exception as e:
        logger.error(f"SerpAPI Search Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to search event websites")

@app.get("/api/event-websites-by-category")
async def get_event_websites_by_category(location: str = Query(...)):
    """
    Get event websites grouped by category for a location.
    
    Query Parameters:
    - location: Location name (e.g., "Palo Alto, CA")
    
    Returns: Websites organized by source type (Government, Platforms, etc.)
    """
    try:
        if not location or location.strip() == "":
            raise HTTPException(status_code=400, detail="Location parameter required")
        
        result = await serpapi_service.search_event_sources(location)
        
        if result["status"] == "success":
            websites = result.get("websites", [])
            
            # Group by category
            grouped = {}
            for website in websites:
                category = website.get("category", "Other")
                if category not in grouped:
                    grouped[category] = []
                grouped[category].append(website)
            
            # Sort categories by priority
            for category in grouped:
                grouped[category].sort(key=lambda x: -x.get("priority", 0))
            
            return {
                "status": "success",
                "location": location,
                "total_sources": len(websites),
                "categories": list(grouped.keys()),
                "websites_by_category": grouped
            }
        else:
            return result
            
    except Exception as e:
        logger.error(f"Category Search Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to categorize event websites")

@app.get("/api/event-sources/cached-searches")
async def get_cached_searches():
    """Get a list of all cached search locations from the JSON files in cache directory."""
    try:
        from app.services.serpapi_search import CACHE_DIR
        import glob
        parent_dir = os.path.dirname(CACHE_DIR)
        dirs_to_scan = [CACHE_DIR, os.path.join(parent_dir, ".cache")]
        
        files = []
        for d in dirs_to_scan:
            if os.path.exists(d):
                files.extend(glob.glob(os.path.join(d, "*.json")))
                
        cached_locations = []
        for file in files:
            try:
                with open(file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    loc = data.get("location")
                    if loc:
                        cached_locations.append(loc)
                    else:
                        base = os.path.basename(file)
                        name_without_ext = os.path.splitext(base)[0]
                        reconstructed = name_without_ext.replace("__", ", ").replace("_", " ").title()
                        cached_locations.append(reconstructed)
            except Exception as e:
                logger.error(f"Failed to read cache file {file}: {e}")
        # Return unique and sorted locations
        unique_locations = sorted(list(set(cached_locations)))
        return {
            "status": "success",
            "searches": unique_locations
        }
    except Exception as e:
        logger.error(f"Error listing cached searches: {e}")
        return {"status": "error", "message": str(e)}



# ── Weather Endpoint ───────────────────────────────────────────────────────────
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY", "")
_weather_cache: dict = {}  # key: "lat,lon" -> {"data": ..., "ts": float}
WEATHER_CACHE_TTL = 600  # 10 minutes

EMPTY_WEATHER = {"status": "error", "daily": []}

@app.get("/api/weather")
async def get_weather(lat: float = Query(...), lon: float = Query(...)):
    import time
    cache_key = f"{round(lat,4)},{round(lon,4)}"
    now = time.time()
    cached = _weather_cache.get(cache_key)
    if cached and (now - cached["ts"]) < WEATHER_CACHE_TTL:
        return cached["data"]

    if not WEATHER_API_KEY:
        return EMPTY_WEATHER

    url = (
        f"https://api.openweathermap.org/data/2.5/forecast"
        f"?lat={lat}&lon={lon}&units=metric&appid={WEATHER_API_KEY}"
    )
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(url)
    except Exception as exc:
        logger.warning(f"OpenWeather request failed ({type(exc).__name__}) — using mock")
        return EMPTY_WEATHER
    if resp.status_code != 200:
        logger.warning(f"OpenWeather API returned {resp.status_code} — using mock")
        return EMPTY_WEATHER

    # Group 3-hour slots by date → one daily summary per day
    slots = resp.json().get("list", [])
    by_day: dict = defaultdict(list)
    for slot in slots:
        by_day[slot["dt_txt"][:10]].append(slot)

    daily = []
    for day_key in sorted(by_day.keys())[:7]:
        day_slots = by_day[day_key]
        temps = [s["main"]["temp"] for s in day_slots]
        pops  = [s.get("pop", 0) for s in day_slots]
        rep   = next((s for s in day_slots if "12:00" in s["dt_txt"]), day_slots[-1])
        daily.append({
            "dt": rep["dt"],  # real Unix timestamp from API
            "temp_max": round(max(temps)),
            "temp_min": round(min(temps)),
            "description": rep["weather"][0]["description"] if rep.get("weather") else "",
            "pop": round(max(pops) * 100),
        })
    logger.info(f"Weather: {len(daily)} days fetched for ({lat},{lon})")

    result = {"status": "success", "daily": daily}
    _weather_cache[cache_key] = {"data": result, "ts": now}
    return result


# ── Entry Point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    host  = os.getenv("HOST", "0.0.0.0")
    port  = int(os.getenv("PORT", 8000))
    debug = os.getenv("ENV", "development") != "production"
    logger.info(f"Starting GeoEvents API on {host}:{port} (debug={debug})")
    uvicorn.run("app.main:app", host=host, port=port, reload=debug)
