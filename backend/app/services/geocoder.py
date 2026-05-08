"""
Geocoding service for converting event addresses to lat/lon coordinates.
Uses Geoapify geocoding API with persistent file-based cache.
"""
import os
import json
import logging
import httpx
import threading
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY", "")

GEOCODE_CACHE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data", "geocode_cache.json"
)

# Global in-memory cache and thread lock to optimize performance
_GEOCODE_CACHE = None
_CACHE_LOCK = threading.Lock()

def _load_cache() -> dict:
    if os.path.exists(GEOCODE_CACHE_PATH):
        try:
            with open(GEOCODE_CACHE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read geocode cache from disk: {e}")
    return {}

def _get_cache() -> dict:
    global _GEOCODE_CACHE
    if _GEOCODE_CACHE is None:
        with _CACHE_LOCK:
            if _GEOCODE_CACHE is None:
                _GEOCODE_CACHE = _load_cache()
    return _GEOCODE_CACHE

def _save_cache(cache: dict):
    os.makedirs(os.path.dirname(GEOCODE_CACHE_PATH), exist_ok=True)
    try:
        with open(GEOCODE_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save geocode cache: {e}")

def geocode_address(address: str) -> Optional[Tuple[float, float]]:
    """
    Geocode an address string to (lat, lon) using Geoapify.
    Results are cached in memory and persisted to disk to avoid redundant API calls.
    Returns None if geocoding fails.
    """
    if not address or not address.strip():
        return None
    
    # Proactive Safety Check: Do not call the Geoapify API for dummy/TBA placeholders
    addr_upper = address.upper().strip()
    if 'TBA' in addr_upper or 'UNKNOWN' in addr_upper or addr_upper in ('VENUE', 'DATE', 'ADDRESS'):
        return None

    cache_key = address.strip().lower()
    cache = _get_cache()

    # Check memory cache first (lightning fast!)
    with _CACHE_LOCK:
        if cache_key in cache:
            entry = cache[cache_key]
            if entry and isinstance(entry, list) and len(entry) == 2:
                return (entry[0], entry[1])
            return None  # Previously failed, cached as null to prevent retries

    if not GEOAPIFY_API_KEY:
        return None

    # Call Geoapify geocoding API
    try:
        with httpx.Client(timeout=8.0) as client:
            response = client.get(
                "https://api.geoapify.com/v1/geocode/search",
                params={"text": address, "apiKey": GEOAPIFY_API_KEY, "limit": 1}
            )
            response.raise_for_status()
            data = response.json()
            features = data.get("features", [])
            if features:
                coords = features[0]["properties"]
                lat = coords.get("lat")
                lon = coords.get("lon")
                if lat and lon:
                    with _CACHE_LOCK:
                        cache[cache_key] = [lat, lon]
                        _save_cache(cache)
                    logger.info(f"Geocoded '{address}' -> ({lat}, {lon})")
                    return (lat, lon)
    except Exception as e:
        logger.warning(f"Geocoding failed for '{address}': {e}")

    # Cache the failure so we don't retry and waste API credits
    with _CACHE_LOCK:
        cache[cache_key] = None
        _save_cache(cache)
    return None
