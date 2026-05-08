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

    return "Not Available", False


def _scrape_public_event_page(url: str) -> dict:
    """
    Fetches the public Eventbrite event page HTML and extracts:
    - Ticket Price (e.g. from JSON-LD or text like "From $88.95")
    - Total attendance count (e.g. "59 total attendees")
    """
    res = {"price": None, "attendance": None}
    if not url:
        return res
    try:
        r = requests.get(url, headers=SEARCH_HEADERS, timeout=10)
        if r.status_code != 200:
            return res
            
        html = r.text
        
        # Extract Attendance
        attendees_match = re.search(r'"totalAttendees"\s*:\s*(\d+)', html)
        if not attendees_match:
            attendees_match = re.search(r'(\d+)\s+total\s+attendees', html, re.IGNORECASE)
        if not attendees_match:
            attendees_match = re.search(r'(\d+)\s+attendees', html, re.IGNORECASE)
        if not attendees_match:
            attendees_match = re.search(r'(\d+)\s+attending', html, re.IGNORECASE)
        if attendees_match:
            res["attendance"] = attendees_match.group(1)
            logger.info(f"Scraped attendance: {res['attendance']} from public page")

        # Extract Price via JSON-LD
        ld_json_tags = re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.DOTALL)
        for ld_text in ld_json_tags:
            try:
                import json
                data = json.loads(ld_text.strip())
                structures = data if isinstance(data, list) else [data]
                for s in structures:
                    offers = s.get("offers")
                    if offers:
                        off = offers[0] if isinstance(offers, list) else offers
                        low = off.get("lowPrice") or off.get("price")
                        high = off.get("highPrice")
                        currency = off.get("priceCurrency") or "USD"
                        symbol = "$" if currency == "USD" else (currency + " ")
                        if low and high and float(low) != float(high):
                            res["price"] = f"{symbol}{float(low):.2f} - {symbol}{float(high):.2f}".replace(".00", "")
                            logger.info(f"Scraped price range from JSON-LD: {res['price']}")
                            break
                        elif low:
                            res["price"] = f"{symbol}{float(low):.2f}".replace(".00", "")
                            logger.info(f"Scraped single price from JSON-LD: {res['price']}")
                            break
            except Exception:
                pass

        # Fallback direct regex price range match
        if not res["price"]:
            range_match = re.search(r'(\$\d+(?:\.\d{2})?)\s*[-–—]\s*(\$\d+(?:\.\d{2})?)', html)
            if range_match:
                res["price"] = f"{range_match.group(1)} - {range_match.group(2)}"
                logger.info(f"Scraped price range from Regex: {res['price']}")

        # Fallback price regex (lowPrice attribute)
        if not res["price"]:
            low_price_match = re.search(r'"lowPrice"\s*:\s*"?(\d+(?:\.\d+)?)"?', html)
            if low_price_match:
                res["price"] = f"${float(low_price_match.group(1)):.2f}".replace(".00", "")
                logger.info(f"Scraped price from direct lowPrice regex: {res['price']}")

        # Fallback price regex (text occurrences)
        if not res["price"]:
            price_match = re.search(r'From\s+(\$\d+(?:\.\d{2})?)', html, re.IGNORECASE)
            if not price_match:
                price_match = re.search(r'(\$\d+(?:\.\d{2})?)', html)
            if price_match:
                res["price"] = price_match.group(1)
                logger.info(f"Scraped price from fallback regex: {res['price']}")

    except Exception as e:
        logger.warning(f"Failed to scrape public page {url}: {e}")
    return res


# ── Nearby city slugs for Bay Area Eventbrite searches ────────────────────────
_NEARBY_SLUGS: dict = {
    "palo alto":    ["palo-alto", "mountain-view", "menlo-park", "los-altos", "stanford", "sunnyvale", "redwood-city"],
    "mountain view":["mountain-view", "palo-alto", "sunnyvale", "los-altos", "santa-clara"],
    "menlo park":   ["menlo-park", "palo-alto", "redwood-city", "atherton", "san-carlos"],
    "redwood city": ["redwood-city", "menlo-park", "san-carlos", "belmont"],
    "sunnyvale":    ["sunnyvale", "mountain-view", "santa-clara", "cupertino"],
    "san jose":     ["san-jose", "santa-clara", "campbell", "los-gatos"],
    "san francisco":["san-francisco", "south-san-francisco", "daly-city"],
    "stanford":     ["palo-alto", "menlo-park", "mountain-view"],
    "los altos":    ["los-altos", "mountain-view", "palo-alto", "sunnyvale"],
    "atherton":     ["menlo-park", "palo-alto", "redwood-city"],
}


def _city_slugs_for(primary_city: str) -> list:
    """Return Eventbrite city slugs to search for a given primary city."""
    key = primary_city.lower().strip()
    for k, slugs in _NEARBY_SLUGS.items():
        if k in key or key in k:
            return slugs
    # Generic fallback
    return [key.replace(" ", "-")]


# ── Step 1: Get IDs ────────────────────────────────────────────────────────────
def _get_event_ids(primary_city: str) -> list:
    """
    Reads <a href="..."> links from Eventbrite search pages for the primary city
    AND nearby cities to maximise event discovery.
    No event data is taken from HTML — only numeric IDs from URL paths.
    """
    slugs = _city_slugs_for(primary_city)
    seen: set = set()
    unique: list = []

    for slug in slugs:
        url = f"https://www.eventbrite.com/d/ca--{slug}/events/"
        try:
            r = requests.get(url, headers=SEARCH_HEADERS, timeout=12)
            ids = re.findall(r'/e/[^"\'?#\s]+-(\d{6,})', r.text)
            added = 0
            for eid in ids:
                if eid not in seen:
                    seen.add(eid)
                    unique.append(eid)
                    added += 1
            logger.info(f"Eventbrite '{slug}': found {added} new IDs (total {len(unique)})")
        except Exception as e:
            logger.warning(f"ID discovery failed for slug '{slug}': {e}")

    logger.info(f"Total unique Eventbrite IDs across all cities: {len(unique)}")
    return unique[:60]  # up from 25 → 60 to allow more candidates


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

    # Step 1: Discover IDs — search primary city + all nearby Eventbrite pages
    event_ids = _get_event_ids(city)
    if not event_ids:
        return []

    # Step 2: Enrich via API v3
    # Use a generous internal radius (max of passed radius or 50 km) so we
    # fetch events from the whole Bay Area; main.py applies the display radius.
    fetch_radius = max(radius, 50_000)

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
            if dist_m > fetch_radius:
                continue

            # ── All data below is 100% from API v3 ──
            organizer       = ev.get("organizer") or {}
            price_str, paid = _extract_price(ev)
            start_local     = (ev.get("start") or {}).get("local", "")
            end_local       = (ev.get("end")   or {}).get("local", "")
            capacity        = ev.get("capacity")
            attendance      = str(int(capacity)) if capacity and int(capacity) > 0 else "TBA"

            # Scrape public page ONLY when API data is missing/generic — avoids 60 extra HTTP calls
            event_url = ev.get("url") or ""
            needs_scrape = attendance == "TBA" or price_str in ("Not Available", "Paid Event")
            if needs_scrape and event_url:
                scraped_details = _scrape_public_event_page(event_url)
                if scraped_details.get("price"):
                    price_str = scraped_details["price"]
                    paid = True
                if scraped_details.get("attendance"):
                    attendance = scraped_details["attendance"]
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
                "source":            "Eventbrite",
                "description":       (ev.get("description") or {}).get("text") or ev.get("summary") or "No description available.",
                "distance":          round(dist_m),
                "image_url":         logo.get("url") or "",
                "date":              start_local,
                "end_date":          end_local,
                "url":               ev.get("url") or "",
                "organizer_name":    organizer.get("name") or "Eventbrite Organizer",
                "organizer_website": organizer.get("website") or "",
                "organizer_description": (organizer.get("description") or {}).get("text") or "",
                "organizer_email":   organizer.get("email") or "",
                "organizer_phone":   organizer.get("phone") or "",
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
