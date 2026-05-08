from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from collections import defaultdict
from datetime import datetime
from typing import Optional
import httpx
import os
import json
import logging
import uvicorn
import threading
from dotenv import load_dotenv
from math import sin, cos, sqrt, atan2, radians

# ── CRITICAL: load_dotenv FIRST so all os.getenv() calls in imported modules see the values
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.ERROR, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)
logging.getLogger("uvicorn.error").disabled = True
logging.getLogger("uvicorn.access").disabled = True

# ── Gemini ─────────────────────────────────────────────────────────────────────
from google import genai

from app.services.eventbrite import search_eventbrite_events
from app.services.ticketmaster import search_ticketmaster_events
from app.services.event_sources import event_sources_service
from app.services.serpapi_search import serpapi_service
from app.services.eventbrite_cache import load_cached_events, save_cached_events, load_cached_events_ignore_ttl
from app.services.ticketmaster_cache import load_cached_ticketmaster_events, save_cached_ticketmaster_events, load_cached_ticketmaster_events_ignore_ttl
from app.services.weather_cache import load_cached_weather, save_cached_weather
from app.services.recent_searches import get_recent_searches, add_recent_search, clear_recent_searches
from app.services.scraper_service import scraper_service
from app.services.geocoder import geocode_address
from app.services.event_discovery_pipeline import event_discovery_service
from app.services.organizer_extractor import organizer_extractor, enrich_events_with_organizers
from app.services.realtime_discovery import realtime_discovery

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


def run_decoupled_background_task(func, *args, **kwargs):
    """
    Runs a synchronous background task in an independent daemon thread,
    preventing anyio.exceptions.CancelledError if the HTTP connection closes.
    """
    thread = threading.Thread(target=func, args=args, kwargs=kwargs, daemon=True)
    thread.start()


# ── Gemini Analysis ────────────────────────────────────────────────────────────
# Model preference list — tries each in order until one works
GEMINI_MODELS = [
    "gemini-2.5-flash-preview-04-17",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
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

def background_enrich_cached_events(city: str, lat: float, lon: float, cached_events: list):
    """Enriches cached Eventbrite events asynchronously in the background so it never blocks the API thread."""
    from app.services.eventbrite import _scrape_public_event_page
    needs_save = False
    logger.info(f"Starting background enrichment for {len(cached_events)} cached events in city '{city}'")
    for e in cached_events:
        # Prevent repeating enrichment if already attempted
        if e.get("is_enriched"):
            continue

        has_tba_attendance = (e.get("attendance") == "TBA" or not e.get("attendance"))
        has_generic_price = (e.get("price") in ["Paid Event", "Not Available", None, ""])
        if (has_tba_attendance or has_generic_price) and e.get("url"):
            try:
                logger.info(f"Background enriching cached event '{e.get('name')}' via scraping...")
                scraped = _scrape_public_event_page(e.get("url"))
                if scraped.get("price") and has_generic_price:
                    e["price"] = scraped["price"]
                    e["is_paid"] = True
                if scraped.get("attendance") and has_tba_attendance:
                    e["attendance"] = scraped["attendance"]
                
                # Mark as enriched so we don't attempt redundant scraping again
                e["is_enriched"] = True
                needs_save = True
            except Exception as ex:
                logger.warning(f"Failed background enrichment for event '{e.get('name')}': {ex}")
                # Mark as attempted/enriched anyway to prevent infinite retry loops
                e["is_enriched"] = True
                needs_save = True
    
    if needs_save:
        try:
            logger.info(f"Saving enriched cached events back to disk for '{city}'")
            save_cached_events(city, lat, lon, cached_events)
        except Exception as ex:
            logger.error(f"Failed to save enriched cached events back to disk: {ex}")

@app.get("/api/nearby-venues")
async def get_nearby_venues(
    lat: float, 
    lon: float, 
    background_tasks: BackgroundTasks, 
    radius: float = 5000, 
    city: str = "Palo Alto", 
    category: str = "", 
    date_keyword: str = "", 
    price: str = "", 
    format: str = ""
):
    """
    Get nearby venues/events from Eventbrite.
    Results are persisted to data/eventbrite/ and served from disk on repeat calls
    within the cache TTL (default 6 hours), avoiding redundant API calls.
    """
    venues = []

    try:
        # ── Step 1: Try the on-disk Eventbrite cache first ──────────────────────
        cached_events, cache_hit = load_cached_events(city, lat, lon)
        if cache_hit and cached_events:
            logger.info(f"Serving {len(cached_events)} Eventbrite events from disk cache for '{city}'")
            
            # Enrich any loaded events asynchronously in the background so we return the cache instantly!
            run_decoupled_background_task(
                background_enrich_cached_events,
                city, lat, lon, cached_events
            )
            
            venues.extend(cached_events)

        else:
            # ── Step 2: Fetch fresh from Eventbrite API ──────────────────────────────
            # Load stale events as base so we never return fewer events than before
            stale_events = load_cached_events_ignore_ttl(city, lat, lon)
            stale_by_id = {str(e.get("id")): e for e in stale_events if e.get("id")}

            eventbrite_events = search_eventbrite_events(city, lat, lon, radius)
            fresh_ids = set()
            if eventbrite_events:
                for event in eventbrite_events:
                    try:
                        if all(k in event for k in ["name", "lat", "lon", "price", "date"]):
                            venues.append(event)
                            fresh_ids.add(str(event.get("id", "")))
                    except (KeyError, TypeError):
                        logger.warning(f"Skipped malformed event: {event}")
                        continue

            # Merge in stale events that weren't in the fresh results
            for eid, ev in stale_by_id.items():
                if eid not in fresh_ids:
                    venues.append(ev)

            if stale_events:
                logger.info(f"Merged stale({len(stale_events)}) + fresh({len(fresh_ids)}) Eventbrite events for '{city}'")

            # ── Step 3: Persist to disk so next reload is instant ────────────────────
            if venues:
                save_cached_events(city, lat, lon, venues)

        # ── Step 1.1: Try the on-disk Ticketmaster cache first ──────────────────
        tm_venues = []
        tm_cached_events, tm_cache_hit = load_cached_ticketmaster_events(city, lat, lon)
        if tm_cache_hit and tm_cached_events:
            logger.info(f"Serving {len(tm_cached_events)} Ticketmaster events from disk cache for '{city}'")
            tm_venues.extend(tm_cached_events)
        else:
            # ── Step 2.1: Fetch fresh from Ticketmaster API ─────────────────────────
            tm_stale_events = load_cached_ticketmaster_events_ignore_ttl(city, lat, lon)
            tm_stale_by_id = {str(e.get("id")): e for e in tm_stale_events if e.get("id")}

            tm_events = search_ticketmaster_events(city, lat, lon, radius)
            tm_fresh_ids = set()
            if tm_events:
                for event in tm_events:
                    try:
                        if all(k in event for k in ["name", "lat", "lon", "price", "date"]):
                            tm_venues.append(event)
                            tm_fresh_ids.add(str(event.get("id", "")))
                    except (KeyError, TypeError):
                        logger.warning(f"Skipped malformed Ticketmaster event: {event}")
                        continue

            # Merge in stale Ticketmaster events that weren't in the fresh results
            for eid, ev in tm_stale_by_id.items():
                if eid not in tm_fresh_ids:
                    tm_venues.append(ev)

            # ── Step 3.1: Persist to disk so next reload is instant ─────────────────
            if tm_venues:
                save_cached_ticketmaster_events(city, lat, lon, tm_venues)

        # Merge Ticketmaster venues with Eventbrite venues
        venues.extend(tm_venues)

        # ── Merge Normalized Scraped Events ────────────────────────────
        # Try exact city key first, then fallback to first word before comma
        # (handles mismatch between "Palo Alto, CA" saved vs "Palo Alto" looked up)
        scraped_events = scraper_service.get_cached_normalized_events(city)
        city_short = city.split(",")[0].strip()
        if not scraped_events:
            if city_short != city:
                scraped_events = scraper_service.get_cached_normalized_events(city_short)

        # Filter out any Eventbrite events that may have been scraped previously
        # (Eventbrite is handled exclusively by eventbrite.py — no duplicates)
        if scraped_events:
            scraped_events = [
                e for e in scraped_events
                if "eventbrite.com" not in (e.get("url") or "").lower()
                and "eventbrite.com" not in (e.get("source_domain") or "").lower()
            ]

        # ─── DATE FILTERING FOR SCRAPED EVENTS: Next 7 days only ───
        if scraped_events:
            from datetime import datetime, timedelta
            now = datetime.now()
            seven_days_later = now + timedelta(days=7)
            filtered_scraped = []
            for ev in scraped_events:
                event_date_str = ev.get("date") or ""
                try:
                    # Try ISO format parsing
                    if event_date_str:
                        event_date = datetime.fromisoformat(event_date_str.replace('Z', '+00:00').split('+')[0].split('T')[0])
                        if now.date() <= event_date.date() <= seven_days_later.date():
                            filtered_scraped.append(ev)
                        else:
                            logger.debug(f"Scraped event skipped: outside 7-day window: {ev.get('name')}")
                    else:
                        # If no date, include it anyway
                        filtered_scraped.append(ev)
                except (ValueError, AttributeError):
                    # If date parsing fails, include the event anyway
                    filtered_scraped.append(ev)
            
            scraped_events = filtered_scraped
            logger.info(f"After date filtering: {len(scraped_events)} scraped events within next 7 days")

        if scraped_events:
            logger.info(f"Loaded {len(scraped_events)} non-Eventbrite scraped events for {city}")
            geocoded_count = 0
            needs_save = False
            for ev in scraped_events:
                # Add source domain for frontend display
                if ev.get("url") and not ev.get("source_domain"):
                    try:
                        from urllib.parse import urlparse
                        ev["source_domain"] = urlparse(ev["url"]).hostname.replace("www.", "")
                        needs_save = True
                    except Exception:
                        ev["source_domain"] = "web"

                # Geocode each event individually if lat/lon missing
                if not ev.get("lat") or not ev.get("lon"):
                    addr = ev.get("address") or ev.get("venue_name") or ""
                    coords = None
                    if addr:
                        coords = geocode_address(addr)
                        if coords:
                            ev["lat"] = coords[0]
                            ev["lon"] = coords[1]
                            geocoded_count += 1
                            needs_save = True
                    
                    if not coords:
                        # Use stable, deterministic offset from query's lat/lon so they appear on the map nearby
                        import hashlib
                        h = hashlib.md5((ev.get("name") or "").encode('utf-8')).hexdigest()
                        val1 = int(h[:8], 16)
                        val2 = int(h[8:16], 16)
                        # Distribute between -0.006 and +0.006 degrees (approx 0.4 miles radius)
                        offset_lat = ((val1 % 12000) - 6000) / 1000000.0
                        offset_lon = ((val2 % 12000) - 6000) / 1000000.0
                        ev["lat"] = lat + offset_lat
                        ev["lon"] = lon + offset_lon
                        ev["is_approx_location"] = True
                        needs_save = True

                # Calculate real distance using actual coordinates
                if ev.get("lat") and ev.get("lon"):
                    ev["distance"] = calculate_distance(lat, lon, ev["lat"], ev["lon"])
                else:
                    # No coordinates available at all — mark as unknown distance
                    ev["distance"] = None

            if needs_save:
                if geocoded_count > 0:
                    logger.info(f"Geocoded {geocoded_count} scraped events with real coordinates")
                logger.info("Saving enriched/geocoded scraped events back to disk cache to prevent redundant work")
                save_key = city_short if city_short != city else city
                fp = os.path.join(
                    os.path.dirname(os.path.dirname(__file__)), "data", "normalized_events",
                    f"{save_key.lower().replace(' ', '_')}_events.json"
                )
                try:
                    with open(fp, "w", encoding="utf-8") as f:
                        json.dump(scraped_events, f, indent=2, ensure_ascii=False)
                except Exception as e:
                    logger.warning(f"Failed to persist geocoded events: {e}")

            venues.extend(scraped_events)

        # Apply radius filter — but be lenient with events that don't have distance info
        # Events without coordinates should be included (they were geocoded or from meetup/allevents which are reliable)
        filtered = []
        for e in venues:
            dist = e.get("distance")
            # Include: events without distance info, OR events within radius
            if dist is None or dist <= radius:
                filtered.append(e)
        
        # Sort by distance (unknown distances go to end)
        filtered.sort(key=lambda x: x.get("distance") if x.get("distance") is not None else float('inf'))
        
        # Determine source label
        source_label = "cache" if (cache_hit or tm_cache_hit) else "live"
        if scraped_events:
            source_label += "+scraped"

        # Return all events (no hard cap) — frontend handles display limits
        eb_count = len([e for e in filtered if e.get('source') == 'Eventbrite'])
        tm_count = len([e for e in filtered if e.get('source') == 'Ticketmaster'])
        scr_count = len([e for e in filtered if e.get('source') == 'Scraper'])
        logger.info(f"Returning {len(filtered)} total events for '{city}' (Eventbrite: {eb_count}, Ticketmaster: {tm_count}, Scraped: {scr_count})")
        return {"status": "success", "venues": filtered, "source": source_label}
    except Exception as e:
        logger.error(f"Get nearby venues error: {e}")
        # Attempt to serve stale cache as fallback even if TTL expired
        stale_eb = load_cached_events_ignore_ttl(city, lat, lon)
        stale_tm = load_cached_ticketmaster_events_ignore_ttl(city, lat, lon)
        stale = (stale_eb or []) + (stale_tm or [])
        if stale:
            logger.warning(f"Serving stale Eventbrite/Ticketmaster cache as fallback for '{city}'")
            return {"status": "success", "venues": stale, "source": "stale_cache"}
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
    Also records the search in the persistent recent-searches store.
    """
    try:
        if not location or location.strip() == "":
            raise HTTPException(status_code=400, detail="Location parameter required")

        result = await serpapi_service.search_event_sources(location)

        # Persist this search in the backend recent-searches store
        if result.get("status") == "success":
            add_recent_search(location.strip())

        return result
    except Exception as e:
        logger.error(f"SerpAPI Search Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to search event websites")

@app.get("/api/event-websites-by-category")
async def get_event_websites_by_category(location: str = Query(...), lat: float = Query(None), lon: float = Query(None), background_tasks: BackgroundTasks = None):
    """
    Get event websites grouped by category for a location.
    Also records the search in the persistent recent-searches store.
    Triggers background scraping of discovered websites.
    """
    try:
        if not location or location.strip() == "":
            raise HTTPException(status_code=400, detail="Location parameter required")

        result = await serpapi_service.search_event_sources(location)

        if result.get("status") != "success":
            logger.warning(f"Event websites category search returned error for '{location}': {result.get('message')}")
            return {
                "status": "error",
                "message": result.get("message", "Failed to fetch event websites"),
                "location": location,
                "total_sources": 0,
                "categories": [],
                "websites_by_category": {}
            }

        websites = result.get("websites", [])
        if not isinstance(websites, list):
            websites = []

        # Record in persistent recent-searches store
        add_recent_search(location.strip())

        # Trigger background scraping only if no fresh normalized events cache exists for this city
        if websites:
            # Extract clean city name so events are saved as e.g. "palo_alto_events.json"
            # matching what get_nearby_venues() loads (avoids "855_el_camino_real" mismatch)
            from app.services.serpapi_search import _extract_city_from_location
            city_key = _extract_city_from_location(location)
            
            # Check if cache exists and is fresh (e.g., less than 24 hours old)
            import time
            from app.services.scraper_service import NORMALIZED_DIR
            cache_file = os.path.join(NORMALIZED_DIR, f"{city_key.lower().replace(' ', '_')}_events.json")
            cache_exists_and_fresh = False
            if os.path.exists(cache_file):
                try:
                    mtime = os.path.getmtime(cache_file)
                    if (time.time() - mtime) < 86400:  # 24 hours
                        cache_exists_and_fresh = True
                        logger.info(f"Skipping background scraping for '{city_key}' — cached normalized events are fresh (age: {round((time.time() - mtime) / 3600, 1)}h)")
                except Exception:
                    pass
            
            if not cache_exists_and_fresh:
                sorted_sites = sorted(websites, key=lambda w: -w.get("priority", 0))
                urls = [w.get("url") for w in sorted_sites[:15] if w.get("url")]
                logger.info(f"Starting background scraping for '{city_key}' (no fresh cache found)")
                run_decoupled_background_task(scraper_service.process_sources_sync, city_key, urls, lat, lon)

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
            "websites_by_category": grouped,
        }

    except Exception as e:
        logger.error(f"Category Search Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to categorize event websites")

@app.get("/api/event-sources/cached-searches")
async def get_cached_searches():
    """
    Return the persistent recent-searches list (most-recent first).
    Backed by data/searches/recent_searches.json — survives server restarts.
    """
    try:
        searches = get_recent_searches()
        return {"status": "success", "searches": searches}
    except Exception as e:
        logger.error(f"Error fetching recent searches: {e}")
        return {"status": "error", "message": str(e), "searches": []}


@app.post("/api/event-sources/add-search")
async def add_search(location: str = Query(...)):
    """
    Explicitly add a location to the persistent recent-searches list.
    Called by the frontend whenever a successful search is performed.
    """
    try:
        if not location or not location.strip():
            raise HTTPException(status_code=400, detail="location is required")
        updated = add_recent_search(location.strip())
        return {"status": "success", "searches": updated}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding recent search: {e}")
        raise HTTPException(status_code=500, detail="Failed to add search")


@app.delete("/api/event-sources/clear-searches")
async def clear_searches():
    """Clear all recent searches (admin utility)."""
    try:
        clear_recent_searches()
        return {"status": "success", "searches": []}
    except Exception as e:
        logger.error(f"Error clearing recent searches: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear searches")



@app.get("/api/scraped-events")
async def get_scraped_events(city: str = Query(...)):
    """
    Return cached scraped events for a city (populated in background after SerpAPI search).
    Tries exact city key first, then resolves full search location from recent searches,
    and extracts the actual geocoded city name.
    """
    try:
        # 1. Try exact city key
        events = scraper_service.get_cached_normalized_events(city)
        
        # 2. Try matching city string to full search locations from recent searches to get actual city
        if not events:
            clean_city = city.strip().lower()
            from app.services.serpapi_search import _extract_city_from_location
            
            recent_locs = get_recent_searches()
            for loc in recent_locs:
                if loc.lower().strip().startswith(clean_city) or clean_city in loc.lower():
                    # Extract real city name from full location, e.g. "San Francisco" or "East Orange"
                    real_city = _extract_city_from_location(loc)
                    if real_city and real_city.lower() != city.lower():
                        logger.info(f"Resolved city query '{city}' to real city '{real_city}' via recent searches")
                        events = scraper_service.get_cached_normalized_events(real_city)
                        if events:
                            break
                            
        # 3. Fallback: split by comma if not found
        if not events:
            city_short = city.split(",")[0].strip()
            if city_short != city:
                events = scraper_service.get_cached_normalized_events(city_short)
                
        return {"status": "success", "city": city, "count": len(events), "events": events}
    except Exception as e:
        logger.error(f"Scraped events error: {e}")
        return {"status": "error", "city": city, "count": 0, "events": []}


# ── NEW: Real-Time Event Discovery Pipeline Endpoint ─────────────────────────
@app.get("/api/discover-events-live")
async def discover_events_live(
    location: str = Query(...),
    lat: float = Query(None),
    lon: float = Query(None),
    background_tasks: BackgroundTasks = None
):
    """
    REAL-TIME Event Discovery Pipeline — No Hardcoded Data.
    
    Runs complete 3-step workflow in background:
    1. Discover event sources for location using SerpAPI
    2. Scrape events from discovered sources
    3. Extract organizer contact information
    
    Returns immediately with status, then progressively updates in background.
    Frontend can poll /api/scraped-events?city=... to get updated events.
    
    Query Parameters:
    - location: Location name (e.g., "Palo Alto, CA", "Denver, CO")
    - lat: Optional latitude (if known)
    - lon: Optional longitude (if known)
    """
    
    if not location or location.strip() == "":
        raise HTTPException(status_code=400, detail="location parameter is required")
    
    logger.info(f"\n{'='*70}")
    logger.info(f"🔥 LIVE EVENT DISCOVERY INITIATED: {location}")
    logger.info(f"{'='*70}")
    
    # Clean up location
    location = location.strip()
    
    # Extract city name for storage (removes state/country)
    city_key = location.split(",")[0].strip() if "," in location else location
    
    # Trigger background pipeline completely decoupled from client connection to prevent CancelledError
    import asyncio
    asyncio.create_task(
        _run_discovery_pipeline_background(
            location,
            city_key,
            lat,
            lon
        )
    )
    
    logger.info(f"✅ Discovery pipeline scheduled for background execution")
    logger.info(f"   Location: {location}")
    logger.info(f"   Storage key: {city_key}")
    logger.info(f"   Check /api/scraped-events?city={city_key} for updates")
    
    # Add to recent searches
    add_recent_search(location.strip())
    
    return {
        "status": "success",
        "message": f"Event discovery pipeline started for {location}",
        "location": location,
        "city_key": city_key,
        "note": f"Check /api/scraped-events?city={city_key} to see discovered events as they're processed",
        "steps": [
            "Step 1: Discovering event sources...",
            "Step 2: Scraping events...",
            "Step 3: Extracting organizer info..."
        ]
    }


async def _run_discovery_pipeline_background(
    location: str,
    city_key: str,
    lat: Optional[float] = None,
    lon: Optional[float] = None
):
    """
    Background task: Run complete event discovery pipeline.
    Logs all steps to console for monitoring.
    """
    try:
        logger.info(f"\n{'='*70}")
        logger.info(f"📍 EVENT DISCOVERY PIPELINE STARTING")
        logger.info(f"{'='*70}")
        logger.info(f"Location: {location}")
        logger.info(f"Storage Key: {city_key}")
        if lat and lon:
            logger.info(f"Coordinates: ({lat:.4f}, {lon:.4f})")
        logger.info(f"Timestamp: {datetime.now().isoformat()}")
        
        # Run the complete 3-step pipeline
        result = await event_discovery_service.run_full_pipeline(location, lat, lon)
        
        if result.get("status") == "success":
            # Get discovered sources
            sources = result.get("step_1", {}).get("all_sources", [])
            logger.info(f"\n✅ Pipeline Complete!")
            logger.info(f"   Sources Discovered: {result.get('step_1', {}).get('source_count', 0)}")
            logger.info(f"   Steps Completed: {result.get('steps_completed', 0)}/3")
            
            # Now scrape the sources in background
            if sources:
                logger.info(f"\n📰 STARTING SCRAPING PHASE")
                logger.info(f"{'='*70}")
                logger.info(f"Scraping {len(sources)} sources for events...")
                
                # Extract URLs from sources
                source_urls = [s.get("url") for s in sources if s.get("url")]
                
                # Trigger the scraper service
                await scraper_service.process_sources(city_key, source_urls, lat, lon)
                
                logger.info(f"\n✅ SCRAPING COMPLETE")
                logger.info(f"{'='*70}")
                logger.info(f"Events saved for location: {city_key}")
                logger.info(f"Retrieve with: /api/scraped-events?city={city_key}")
            else:
                logger.warning("No sources to scrape")
        
        else:
            logger.error(f"❌ Pipeline failed: {result.get('error', 'Unknown error')}")
            
    except Exception as e:
        logger.error(f"\n❌ DISCOVERY PIPELINE ERROR: {e}", exc_info=True)


# ── NEW REAL-TIME EVENT SEARCH ENDPOINT ────────────────────────────────────────
# This endpoint performs live event discovery with NO caching
# Returns fresh data discovered in real-time from event calendar websites
@app.get("/api/search-events")
async def search_events_realtime(location: str = Query(...)):
    """
    REAL-TIME EVENT DISCOVERY FOR ANY LOCATION
    
    Complete 3-Step Workflow:
    1. Discover event calendar websites using SerpAPI
    2. Scrape events from those websites using Scrapling  
    3. Extract organizer information
    
    Returns: Fresh events discovered in real-time (NO caching)
    
    Query Parameters:
    - location: Location name (e.g., "Palo Alto, CA", "Denver, CO", "New York, NY")
    
    Console Output: Full visibility into discovery process with detailed logging
    """
    
    if not location or location.strip() == "":
        raise HTTPException(status_code=400, detail="location parameter is required")
    
    try:
        # Add to recent searches
        add_recent_search(location.strip())
        
        # Run real-time discovery pipeline (with full console logging)
        result = await realtime_discovery.discover_and_scrape(location)
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Real-time search error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Event discovery failed: {str(e)}"
        )


# ── Weather Endpoint ───────────────────────────────────────────────────────────
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY", "")
_weather_cache: dict = {}  # in-memory: key "lat,lon" -> {"data": ..., "ts": float}
WEATHER_MEM_CACHE_TTL = 600  # 10 minutes (in-memory layer)

EMPTY_WEATHER = {"status": "error", "daily": []}

@app.get("/api/weather")
async def get_weather(lat: float = Query(...), lon: float = Query(...)):
    import time
    cache_key = f"{round(lat,4)},{round(lon,4)}"
    now = time.time()

    # ── Layer 1: In-memory cache (fast, expires in 10 min) ──────────────────────
    mem_cached = _weather_cache.get(cache_key)
    if mem_cached and (now - mem_cached["ts"]) < WEATHER_MEM_CACHE_TTL:
        logger.info(f"Weather served from in-memory cache for ({lat},{lon})")
        return mem_cached["data"]

    # ── Layer 2: On-disk file cache (persists across restarts) ──────────────────
    file_payload, file_hit = load_cached_weather(lat, lon)
    if file_hit and file_payload:
        # Warm the in-memory cache from disk so future in-process hits are fast
        _weather_cache[cache_key] = {"data": file_payload, "ts": now}
        return file_payload

    # ── Layer 3: Live API fetch ─────────────────────────────────────────────────
    if not WEATHER_API_KEY:
        stale, _ = load_cached_weather(lat, lon, ignore_expiry=True)
        return stale if stale else EMPTY_WEATHER

    url = (
        f"https://api.openweathermap.org/data/2.5/forecast"
        f"?lat={lat}&lon={lon}&units=metric&appid={WEATHER_API_KEY}"
    )
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(url)
    except Exception as exc:
        logger.warning(f"OpenWeather request failed ({type(exc).__name__}) — using fallback")
        # Return stale file cache as fallback rather than empty response
        stale, _ = load_cached_weather(lat, lon, ignore_expiry=True)
        return stale if stale else EMPTY_WEATHER

    if resp.status_code != 200:
        logger.warning(f"OpenWeather API returned {resp.status_code} — using fallback")
        stale, _ = load_cached_weather(lat, lon, ignore_expiry=True)
        return stale if stale else EMPTY_WEATHER

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
        t_max = round(max(temps))
        t_min = round(min(temps))
        # Single-slot days (last day of 5-day forecast) have no real spread —
        # subtract a typical 8°C diurnal range to produce a realistic minimum.
        if t_min >= t_max:
            t_min = t_max - 8
        daily.append({
            "dt": rep["dt"],  # real Unix timestamp from API
            "temp_max": t_max,
            "temp_min": t_min,
            "description": rep["weather"][0]["description"] if rep.get("weather") else "",
            "pop": round(max(pops) * 100),
        })
    logger.info(f"Weather: {len(daily)} days fetched live for ({lat},{lon})")

    result = {"status": "success", "daily": daily}

    # Automatically roll and pad the newly fetched live forecast to exactly 7 days
    from app.services.weather_cache import roll_and_pad_weather_payload
    padded_result, _ = roll_and_pad_weather_payload(result, now)

    # Persist to in-memory AND disk so next server restart serves from cache
    _weather_cache[cache_key] = {"data": padded_result, "ts": now}
    save_cached_weather(lat, lon, padded_result)

    return padded_result


# ── Entry Point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    host  = os.getenv("HOST", "0.0.0.0")
    port  = int(os.getenv("PORT", 8000))
    debug = os.getenv("ENV", "development") != "production"
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=debug,
        access_log=False,
        log_level="error"
    )
