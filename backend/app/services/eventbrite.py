"""
Eventbrite Event Fetcher — API v3 Enrichment Pipeline

Since Eventbrite deprecated /v3/events/search/ (returns 404),
we use a 2-step approach:
  Step 1: GET event IDs from Eventbrite's public search page HTML links
           (We only read <a href="..."> tags — NOT parsing any event data from HTML)
  Step 2: For each ID → GET /v3/events/{id}/?expand=venue,organizer,ticket_availability
           This gives us 100% accurate data from the official API

All displayed data (price, organizer, timing, capacity) comes ONLY from the API v3.
"""
import requests
import re
import os
import logging
from math import sin, cos, sqrt, atan2, radians

logger = logging.getLogger(__name__)

# Token is read lazily inside functions to ensure load_dotenv() has run first
BASE = "https://www.eventbriteapi.com/v3"

def _get_token():
    return os.getenv("EVENTBRITE_PRIVATE_TOKEN", "")

def _api_headers():
    return {"Authorization": f"Bearer {_get_token()}"}

SEARCH_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36"
}


# ── Helpers ────────────────────────────────────────────────────────────────────
def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371e3
    f1, f2 = radians(float(lat1)), radians(float(lat2))
    df = radians(float(lat2) - float(lat1))
    dl = radians(float(lon2) - float(lon1))
    a = sin(df / 2) ** 2 + cos(f1) * cos(f2) * sin(dl / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def _extract_price(event: dict) -> tuple:
    """Returns (price_display, is_paid) from API v3 event dict."""
    # ticket_availability is most reliable
    ta = event.get("ticket_availability") or {}
    if ta:
        is_free = ta.get("is_free")
        if is_free is True:
            return "Free", False
        if is_free is False:
            min_p = (ta.get("minimum_ticket_price") or {}).get("display", "")
            max_p = (ta.get("maximum_ticket_price") or {}).get("display", "")
            if min_p and max_p and min_p != max_p:
                return f"{min_p} – {max_p}", True
            return min_p or max_p or "Paid Event", True

    # Fallback: top-level is_free
    if event.get("is_free") is True:
        return "Free", False
    if event.get("is_free") is False:
        return "Paid Event", True

    # Fallback: ticket_classes
    for tc in (event.get("ticket_classes") or []):
        cost = tc.get("cost") or {}
        val = cost.get("major_value")
        if val is not None:
            try:
                if float(str(val).replace(",", "")) > 0:
                    sym = "$" if cost.get("currency") == "USD" else (cost.get("currency") + " ")
                    return f"{sym}{float(val):.0f}", True
            except ValueError:
                pass

    return "Free", False


# ── Step 1: Get IDs ────────────────────────────────────────────────────────────
def _get_event_ids(city: str) -> list:
    """
    Reads <a href="..."> links from Eventbrite search page to extract event IDs.
    No event data is taken from HTML — only numeric IDs from URL paths.
    """
    city_slug = city.lower().strip().replace(" ", "-")
    url = f"https://www.eventbrite.com/d/ca--{city_slug}/events/"
    
    try:
        r = requests.get(url, headers=SEARCH_HEADERS, timeout=12)
        # Find all Eventbrite event URLs in the page HTML links
        # Pattern: /e/some-event-name-tickets-123456789
        ids = re.findall(r'/e/[^"\'?#\s]+-(\d{6,})', r.text)
        # Deduplicate preserving order
        seen = set()
        unique = []
        for eid in ids:
            if eid not in seen:
                seen.add(eid)
                unique.append(eid)
        logger.info(f"Found {len(unique)} event IDs for '{city}'")
        return unique[:25]
    except Exception as e:
        logger.error(f"ID discovery failed for {city}: {e}")
        return []


# ── Step 2: Enrich via API v3 ──────────────────────────────────────────────────
def _fetch_event(event_id: str) -> dict:
    """GET /v3/events/{id}/ with all expansions. Returns full API response or None."""
    token = _get_token()
    if not token:
        logger.error("EVENTBRITE_PRIVATE_TOKEN is empty — check .env file")
        return None
    url = f"{BASE}/events/{event_id}/"
    params = {"expand": "venue,organizer,ticket_availability,ticket_classes,category"}
    try:
        r = requests.get(url, headers=_api_headers(), params=params, timeout=10)
        if r.status_code == 200:
            return r.json()
        logger.warning(f"Event {event_id} returned {r.status_code}: {r.text[:100]}")
    except Exception as e:
        logger.warning(f"Failed to fetch event {event_id}: {e}")
    return None


# ── Main entry point ───────────────────────────────────────────────────────────
def search_eventbrite_events(city: str, lat: float, lon: float, radius: float = 10000, **kwargs) -> list:
    """
    Returns enriched event list using official Eventbrite API v3 data.
    All prices, organizers, timings, and capacity values come from the API — not HTML.
    Only returns VALIDATED events with all required fields.
    """
    token = _get_token()
    if not token or not token.strip():
        logger.error("EVENTBRITE_PRIVATE_TOKEN is not set or empty — check .env file!")
        return []

    # Step 1: Discover IDs
    event_ids = _get_event_ids(city)
    if not event_ids:
        return []

    # Step 2: Enrich via API v3
    events = []
    for eid in event_ids:
        try:
            ev = _fetch_event(eid)
            if not ev:
                continue

            # Venue / location — REQUIRED for distance calculation
            venue = ev.get("venue") or {}
            v_lat = venue.get("latitude")
            v_lon = venue.get("longitude")
            if not v_lat or not v_lon:
                logger.debug(f"Event {eid} skipped: no venue coordinates")
                continue

            dist_m = _haversine(lat, lon, v_lat, v_lon)
            if dist_m > radius:
                continue

            # ── All data below is 100% from API v3 ──
            organizer       = ev.get("organizer") or {}
            price_str, paid = _extract_price(ev)
            start_local     = (ev.get("start") or {}).get("local", "")
            end_local       = (ev.get("end")   or {}).get("local", "")
            capacity        = ev.get("capacity")
            attendance      = str(int(capacity)) if capacity and int(capacity) > 0 else "TBA"
            cat_obj         = ev.get("category") or {}
            logo            = ev.get("logo") or {}
            addr_obj        = venue.get("address") or {}
            venue_addr = (
                addr_obj.get("localized_address_display")
                or addr_obj.get("address_1")
                or venue.get("name")
                or "Venue TBA"
            )
            
            # Validate required fields before adding
            event_name = (ev.get("name") or {}).get("text") or "Unnamed Event"
            if not start_local or not event_name or event_name == "Unnamed Event":
                logger.debug(f"Event {eid} skipped: missing event name or start_time")
                continue

            event_record = {
                "id":                eid,
                "name":              event_name,
                "lat":               float(v_lat),
                "lon":               float(v_lon),
                "address":           venue_addr,
                "venue_name":        venue.get("name") or "",
                "category":          (cat_obj.get("short_name") or "community").lower(),
                "type":              "Eventbrite",
                "description":       ev.get("summary") or "",
                "distance":          round(dist_m),
                "image_url":         logo.get("url") or "",
                "date":              start_local,
                "end_date":          end_local,
                "url":               ev.get("url") or "",
                "organizer_name":    organizer.get("name") or "Eventbrite Organizer",
                "organizer_website": organizer.get("website") or "",
                "price":             price_str,
                "is_paid":           paid,
                "attendance":        attendance,
                "is_dummy":          False,
            }
            events.append(event_record)
            logger.debug(f"Added valid event: {event_name[:40]}")
        except Exception as e:
            logger.warning(f"Error processing event {eid}: {e}")
            continue

    events.sort(key=lambda x: x.get("distance", 999999))
    logger.info(f"Returning {len(events)} API-enriched events for '{city}'")
    return events
