from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
import json
import logging
from dotenv import load_dotenv
from typing import List, Optional
from math import sin, cos, sqrt, atan2, radians
from app.services.gemini_service import analyze_business_impact

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(title="GeoEvents AI Business API", version="1.0.0")

# Production Ready CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")

def load_dummy_events():
    try:
        path = os.path.join(os.path.dirname(__file__), "..", "dummy_events.json")
        if os.path.exists(path):
            with open(path, "r") as f:
                return json.load(f)
        logger.warning("dummy_events.json not found, using empty list")
        return []
    except Exception as e:
        logger.error(f"Error loading dummy events: {e}")
        return []

DUMMY_EVENTS = load_dummy_events()

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371e3
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi/2)**2 + cos(phi1)*cos(phi2)*sin(dlambda/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

@app.get("/")
async def root():
    return {"status": "online", "api": "Business Analytics Active", "env": os.getenv("ENV", "development")}

@app.get("/api/search")
async def search_location(text: str = Query(None)):
    if not text: return {"status": "success", "results": []}
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
                    "name": props.get("formatted"),
                    "lat": props.get("lat"),
                    "lon": props.get("lon"),
                    "address": props.get("address_line2"),
                    "city": props.get("city")
                })
            return {"status": "success", "results": results}
        except Exception as e:
            logger.error(f"Search API Error: {e}")
            return {"status": "error", "message": str(e)}

@app.get("/api/nearby-venues")
async def get_nearby_venues(lat: float, lon: float, radius: float = 1000):
    if not GEOAPIFY_API_KEY:
        raise HTTPException(status_code=500, detail="GEOAPIFY_API_KEY not configured")

    categories = "entertainment,sport.stadium,entertainment.cinema,adult.nightclub,entertainment.culture"
    venues = []
    
    async with httpx.AsyncClient() as client:
        try:
            filter_val = f"circle:{lon:.6f},{lat:.6f},{int(radius)}"
            url = "https://api.geoapify.com/v2/places"
            params = {"categories": categories, "filter": filter_val, "limit": 20, "apiKey": GEOAPIFY_API_KEY}
            response = await client.get(url, params=params, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                for feature in data.get("features", []):
                    props = feature["properties"]
                    venues.append({
                        "name": props.get("name") or props.get("street") or "Venue",
                        "lat": props.get("lat"), "lon": props.get("lon"),
                        "address": props.get("address_line2"),
                        "category": props.get("categories", ["entertainment"])[0],
                        "distance": props.get("distance") or 0,
                        "type": "Live Venue"
                    })
        except Exception as e:
            logger.error(f"Geoapify Places Error: {e}")

    # Injection for local simulation
    # Using relative offset logic for demo consistency
    palo_alto_lat, palo_alto_lon = 37.444, -122.159
    for event in DUMMY_EVENTS:
        offset_lat, offset_lon = event["lat"] - palo_alto_lat, event["lon"] - palo_alto_lon
        new_lat, new_lon = lat + offset_lat, lon + offset_lon
        dist = calculate_distance(lat, lon, new_lat, new_lon)
        if dist <= radius + 500:
            if not any(v["name"] == event["name"] for v in venues):
                venues.append({
                    **event, "lat": new_lat, "lon": new_lon,
                    "address": f"Near {event['address'].split(',')[-1].strip()}",
                    "distance": round(dist), "is_dummy": True
                })

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
