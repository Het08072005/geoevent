"""
Eventbrite Persistent Cache — data/eventbrite/
-----------------------------------------------
Stores fetched Eventbrite events to disk so server restarts / page
reloads do NOT trigger repeated Eventbrite API calls.

Cache key  : "{city_slug}_{lat_4dp}_{lon_4dp}.json"
TTL        : 6 hours (configurable via EVENTBRITE_CACHE_TTL_SECONDS env var)

On a cache-hit, the stored JSON is returned directly.
On a cache-miss (or stale file), live data is fetched and then saved.
"""
import os
import re
import json
import time
import logging

logger = logging.getLogger(__name__)

# Root of the backend package → sibling to "app/"
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
EVENTBRITE_CACHE_DIR = os.path.join(_BACKEND_DIR, "data", "eventbrite")
os.makedirs(EVENTBRITE_CACHE_DIR, exist_ok=True)

# Default TTL: 48 hours.  Override with EVENTBRITE_CACHE_TTL_SECONDS in .env
EVENTBRITE_CACHE_TTL = int(os.getenv("EVENTBRITE_CACHE_TTL_SECONDS", str(48 * 3600)))


def _make_cache_key(city: str, lat: float, lon: float) -> str:
    """Produce a safe filename component from city + coordinates."""
    city_slug = re.sub(r"[^a-zA-Z0-9]", "_", city.strip().lower())
    lat_s = f"{round(lat, 4)}".replace(".", "p").replace("-", "n")
    lon_s = f"{round(lon, 4)}".replace(".", "p").replace("-", "n")
    return f"{city_slug}_{lat_s}_{lon_s}"


def _cache_filepath(city: str, lat: float, lon: float) -> str:
    key = _make_cache_key(city, lat, lon)
    return os.path.join(EVENTBRITE_CACHE_DIR, f"{key}.json")


def load_cached_events(city: str, lat: float, lon: float):
    """
    Return (events_list, cache_hit) from the on-disk cache.
    Returns (None, False) if cache doesn't exist or is expired.
    """
    fp = _cache_filepath(city, lat, lon)
    if not os.path.exists(fp):
        return None, False

    try:
        with open(fp, "r", encoding="utf-8") as f:
            data = json.load(f)

        saved_at = data.get("saved_at", 0)
        age = time.time() - saved_at

        if age > EVENTBRITE_CACHE_TTL:
            logger.info(
                f"Eventbrite cache stale ({age/3600:.1f}h old) for '{city}' — will re-fetch"
            )
            return None, False

        events = data.get("events", [])
        logger.info(
            f"Eventbrite cache HIT for '{city}': {len(events)} events "
            f"(age {age/3600:.1f}h, TTL {EVENTBRITE_CACHE_TTL/3600:.0f}h)"
        )
        return events, True

    except Exception as exc:
        logger.warning(f"Failed to read Eventbrite cache file '{fp}': {exc}")
        return None, False


def save_cached_events(city: str, lat: float, lon: float, events: list) -> None:
    """
    Persist a fresh Eventbrite events list to disk, merging with existing data safely
    so that we do not overwrite or lose previously stored details.
    """
    if not events:
        return  # Don't overwrite good cache with empty data

    fp = _cache_filepath(city, lat, lon)
    existing_events = []
    
    # Try loading existing cache to merge
    if os.path.exists(fp):
        try:
            with open(fp, "r", encoding="utf-8") as f:
                data = json.load(f)
                existing_events = data.get("events", [])
        except Exception as exc:
            logger.warning(f"Could not load existing cache for merge from '{fp}': {exc}")

    # Index existing events by ID
    existing_by_id = {}
    for ev in existing_events:
        eid = ev.get("id")
        if eid:
            existing_by_id[str(eid)] = ev

    # Merge fresh events into existing ones, updating only valid and non-empty values
    merged_events_list = list(existing_events)
    for fresh_ev in events:
        eid = str(fresh_ev.get("id"))
        if not eid:
            continue
            
        if eid in existing_by_id:
            # Merge fields safely
            stored_ev = existing_by_id[eid]
            for k, v in fresh_ev.items():
                # Overwrite/update if fresh value is valid, non-empty, and not a placeholder fallback
                if (v is not None and v != "" and v != "TBA" 
                        and v != "Eventbrite Organizer" 
                        and v != "Contact Organizer for Pricing"):
                    stored_ev[k] = v
        else:
            # New event, append
            merged_events_list.append(fresh_ev)
            existing_by_id[eid] = fresh_ev

    payload = {
        "city": city,
        "lat": lat,
        "lon": lon,
        "saved_at": time.time(),
        "event_count": len(merged_events_list),
        "events": merged_events_list,
    }
    try:
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        logger.info(f"Saved & merged {len(merged_events_list)} Eventbrite events to cache: {fp}")
    except Exception as exc:
        logger.error(f"Failed to write Eventbrite cache file '{fp}': {exc}")


def load_cached_events_ignore_ttl(city: str, lat: float, lon: float) -> list:
    """Return cached events regardless of TTL — used to seed stale-merge."""
    fp = _cache_filepath(city, lat, lon)
    if not os.path.exists(fp):
        return []
    try:
        with open(fp, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("events", [])
    except Exception:
        return []


def list_cached_cities() -> list:
    """Return a list of city names that have cached Eventbrite data."""
    cities = []
    try:
        for fname in os.listdir(EVENTBRITE_CACHE_DIR):
            if not fname.endswith(".json"):
                continue
            fp = os.path.join(EVENTBRITE_CACHE_DIR, fname)
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    data = json.load(f)
                city = data.get("city")
                if city:
                    cities.append(city)
            except Exception:
                continue
    except Exception as exc:
        logger.warning(f"Failed to list Eventbrite cache dir: {exc}")
    return cities
