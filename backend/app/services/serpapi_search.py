import os
import httpx
import asyncio
import logging
import re
import json
from typing import List, Dict, Any
from math import sin, cos, sqrt, atan2, radians
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SERPAPI_API_KEY = os.getenv("SERP_API_KEY", "")

CACHE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data",
    "cache"
)
os.makedirs(CACHE_DIR, exist_ok=True)

def _get_cache_filepath(location: str) -> str:
    # Create safe snake_case filename based on the search location
    safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', location.strip().lower())
    return os.path.join(CACHE_DIR, f"{safe_name}.json")

# ── Geo-Location Coordinates for Bay Area ──
LOCATION_COORDINATES = {
    "palo alto": (37.4419, -122.1430),
    "menlo park": (37.4829, -122.1600),
    "redwood city": (37.4852, -122.2364),
    "east palo alto": (37.4690, -122.1287),
    "mountain view": (37.3861, -122.0839),
    "los altos": (37.3382, -122.1090),
    "stanford": (37.4275, -122.1697),
    "san mateo": (37.5630, -122.3255),
    "atherton": (37.4630, -122.1997),
    "sunnyvale": (37.3688, -122.0363),
    "san francisco": (37.7749, -122.4194),
    "san jose": (37.3382, -121.8863),
}

def _calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371  # Earth's radius in km
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))

def _get_neighboring_cities(primary_city: str) -> List[str]:
    primary_lower = primary_city.lower().strip()
    # Find matching city key in COORDINATES
    matched_key = None
    for key in LOCATION_COORDINATES:
        if key in primary_lower or primary_lower in key:
            matched_key = key
            break
            
    if not matched_key:
        return []

    lat1, lon1 = LOCATION_COORDINATES[matched_key]
    distances = []
    for city, coords in LOCATION_COORDINATES.items():
        if city == matched_key:
            continue
        dist = _calculate_distance(lat1, lon1, coords[0], coords[1])
        distances.append((city, dist))
    
    # Sort by distance
    distances.sort(key=lambda x: x[1])
    # Return top 3 closest cities within 15 km
    neighbors = [city.title() for city, dist in distances[:3] if dist <= 15.0]
    if not neighbors:
        neighbors = [city.title() for city, dist in distances[:2]]
    return neighbors

def _extract_city_from_location(location: str) -> str:
    parts = [p.strip() for p in location.split(",")]
    
    # Prioritize any part that matches a known city name
    for part in parts:
        if part.lower().strip() in LOCATION_COORDINATES:
            return part
            
    if len(parts) == 1:
        return parts[0]
        
    for i in range(len(parts) - 1, -1, -1):
        part = parts[i]
        # Skip country names
        if part.lower() in ["united states", "usa", "united states of america", "us"]:
            continue
        # Check if the part contains a state or zip
        if re.search(r'\b[A-Z]{2}\b|\b\d{5}\b', part):
            if i > 0:
                return parts[i-1]
                
    # Fallback rules
    if len(parts) >= 2:
        last_part = parts[-1]
        second_last = parts[-2]
        if last_part.lower() in ["united states", "usa", "united states of america", "us"] and len(parts) >= 3:
            third_last = parts[-3]
            if re.search(r'\b[A-Z]{2}\b|\b\d{5}\b', second_last):
                return third_last
            return second_last
        return second_last
        
    return parts[0]

def _is_valid_event_url(url: str) -> bool:
    if not url:
        return False
    url_lower = url.lower().strip()
    
    # Check for invalid patterns, helper pages, login pages, and search queries
    invalid_patterns = [
        "webcache.googleusercontent.com",
        "google.com/search",
        "google.com/maps",
        "google.com/url",
        "bing.com",
        "yahoo.com",
        "/search?",
        "login",
        "signin",
        "signup",
        "register",
        "accounts.",
        "support.",
        "help.",
        "settings",
        "profile",
        "myaccount",
        "/feedback",
        "terms-of-service",
        "privacy-policy",
        "cookie-policy",
        "contact-us",
        "about-us",
    ]
    for pattern in invalid_patterns:
        if pattern in url_lower:
            return False
            
    # Avoid file downloads / static documents
    if any(url_lower.endswith(ext) for ext in [".pdf", ".doc", ".docx", ".xml", ".json", ".txt", ".png", ".jpg", ".jpeg"]):
        return False
        
    # Ensure it's a valid http or https protocol link
    if not (url_lower.startswith("http://") or url_lower.startswith("https://")):
        return False
        
    return True

def _clean_event_name(title: str, domain: str) -> str:
    if not title:
        return domain.replace("www.", "").replace(".com", "").replace(".org", "").title()
    
    # Remove common site suffixes that clutter the title
    cleaned = title
    suffixes = [
        " - Google Search",
        " | Facebook",
        " - Eventbrite",
        " | Eventbrite",
        " - Meetup",
        " | Meetup",
        " - Ticketmaster",
        " | Ticketmaster",
        " - Yelp",
        " | Yelp",
        " | Patch",
        " - Bandsintown",
        " | Bandsintown",
    ]
    for suffix in suffixes:
        cleaned = re.sub(re.escape(suffix), "", cleaned, flags=re.IGNORECASE)
        
    # Remove trailing separator characters
    cleaned = re.sub(r'\s*[-|:|•]\s*$', '', cleaned).strip()
    
    # Limit length
    return cleaned[:70]


# ── Event Listing Page Discovery Queries ──
# Each query targets a specific category of event listing pages.
# OPTIMIZED with proven high-yield search patterns.
# Uses city name only (not full address) — {city} is replaced with primary_city.
CATEGORY_QUERIES = [
    # Generic Event Calendar Discovery
    ("{city} events calendar", "{city} events calendar"),
    ("{city} community events", "{city} community events"),
    ("Things to do {city}", "things to do in {city} this week"),
    ("Things to do {city} weekend", "things to do in {city} this weekend"),
    
    # City/Government Calendars (with .gov dork)
    ("City Government", "site:.gov {city} events"),
    ("City Calendar", "site:.gov \"{city}\" \"community calendar\""),
    
    # University Events
    ("University Events", "site:stanford.edu events"),
    ("University Calendar", "site:.edu {city} campus events calendar"),
    
    # Event Platforms - Eventbrite
    ("Eventbrite", "site:eventbrite.com {city} events"),
    ("Eventbrite Directory", "site:eventbrite.com events {city}"),
    
    # Meetup Groups
    ("Meetup Events", "site:meetup.com {city} events"),
    ("Meetup Groups", "site:meetup.com \"{city}\" events"),
    
    # Ticketed Venues
    ("Venues & Concerts", "{city} concert venues events"),
    ("Theater Events", "{city} theater events tickets"),
    
    # Local News & Community
    ("Local Media Events", "{city} community events calendar"),
    ("Local News", "{city} events upcoming"),
    
    # Business & Nonprofit
    ("Business Events", "{city} chamber events"),
    ("Nonprofit Events", "{city} nonprofit conference events"),
    
    # Sports & Recreation
    ("Sports Events", "{city} 5k race sports tournament"),
    ("Running Events", "{city} running race events"),
    
    # Cultural & Arts
    ("Arts Festival", "{city} arts culture festival"),
    ("Cultural Events", "{city} celebration events"),
    
    # Advanced Google Dorks
    ("Event Pages", "inurl:events \"{city}\""),
    ("Calendar Pages", "inurl:calendar \"{city}\""),
    ("JSON Events", "\"events.json\" \"{city}\""),
]

# ── Domains that are always valid event sources (no path check needed) ──
_EVENT_PLATFORM_DOMAINS = {
    "eventbrite.com", "meetup.com", "ticketmaster.com", "allevents.in",
    "bandsintown.com", "facebook.com", "universe.com", "runsignup.com",
    "active.com", "eventcartel.com", "nextdoor.com", "playpass.com",
    "patch.com",
}

# ── Path keywords that confirm a URL is an event listing page ──
_EVENT_PATH_KEYWORDS = {
    "/event", "/calendar", "/schedule", "/ticket", "/show", "/shows",
    "/whatson", "/whats-on", "/live", "/concert", "/concerts", "/upcoming",
    "/community", "/activities", "/program", "/programs", "/fest", "/fair",
    "/parade", "/conference", "/workshop", "/class", "/race", "/run",
    "/tournament", "/sports", "/arts", "/d/", "/e/", "/listing",
    "/listings", "/agenda", "/things-to-do", "/happenings",
}


def _is_event_listing_url(url: str, domain: str) -> bool:
    """Returns True if URL looks like an actual event listing page, not a homepage."""
    domain_lower = domain.lower()
    if any(p in domain_lower for p in _EVENT_PLATFORM_DOMAINS):
        return True
    try:
        path = urlparse(url).path.lower()
        if not path or path == "/" or path == "":
            return False
        return any(kw in path for kw in _EVENT_PATH_KEYWORDS)
    except Exception:
        return False


class SerpAPIEventSearch:
    def __init__(self):
        self.api_key = SERPAPI_API_KEY
        self.base_url = "https://serpapi.com/search"
        logger.info(f"SerpAPI initialized. Key present: {bool(self.api_key)}")

    def _parse_google_event_date(self, when_str: str) -> str:
        if not when_str:
            from datetime import datetime, timedelta
            return (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%dT18:00:00")
        
        try:
            from datetime import datetime
            current_year = datetime.now().year
            
            months_re = r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})"
            match = re.search(months_re, when_str, re.IGNORECASE)
            if match:
                month_str = match.group(1)[:3].title()
                day_val = int(match.group(2))
                
                time_match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", when_str, re.IGNORECASE)
                hour = 18
                minute = 0
                if time_match:
                    h = int(time_match.group(1))
                    m = int(time_match.group(2))
                    ampm = time_match.group(3).upper()
                    if ampm == "PM" and h < 12:
                        h += 12
                    elif ampm == "AM" and h == 12:
                        h = 0
                    hour = h
                    minute = m
                
                months_map = {
                    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
                    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
                }
                month_val = months_map[month_str]
                
                dt = datetime(current_year, month_val, day_val, hour, minute)
                return dt.strftime("%Y-%m-%dT%H:%M:%S")
        except Exception as e:
            logger.debug(f"Failed to parse event date '{when_str}': {e}")
            
        from datetime import datetime, timedelta
        return (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%dT18:00:00")

    async def search_google_events(self, location: str) -> List[Dict[str, Any]]:
        if not self.api_key:
            logger.error("SERP_API key not configured for Google Events")
            return []

        query = f"events in {location}"
        params = {
            "engine": "google_events",
            "q": query,
            "api_key": self.api_key,
            "gl": "us",
            "hl": "en"
        }

        logger.info(f"SerpAPI Google Events query: {query}")
        events = []
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(self.base_url, params=params)
                if resp.status_code != 200:
                    logger.error(f"SerpAPI Google Events returned status code {resp.status_code}")
                    return []
                
                data = resp.json()
                results = data.get("events_results", [])
                logger.info(f"SerpAPI Google Events returned {len(results)} events")
                
                for item in results:
                    title = item.get("title")
                    if not title:
                        continue
                    
                    when_str = ""
                    date_info = item.get("date", {})
                    if isinstance(date_info, dict):
                        when_str = date_info.get("when") or date_info.get("start_date") or ""
                    elif isinstance(date_info, str):
                        when_str = date_info
                    
                    iso_date = self._parse_google_event_date(when_str)
                    
                    link = item.get("link") or ""
                    domain = self._extract_domain(link) or "google.com"
                    
                    address_list = item.get("address", [])
                    address = ", ".join(address_list) if isinstance(address_list, list) else str(address_list)
                    
                    venue_name = item.get("venue", {}).get("name") or ""
                    if not address and venue_name:
                        address = venue_name
                    
                    desc = item.get("description") or ""
                    
                    price = "Free"
                    ticket_info = item.get("ticket_info", [])
                    if isinstance(ticket_info, list) and ticket_info:
                        for t in ticket_info:
                            if t.get("price"):
                                price = t.get("price")
                                break
                    elif isinstance(ticket_info, dict):
                        price = ticket_info.get("price") or "Free"
                    
                    category = "community"
                    desc_lower = desc.lower() + " " + title.lower()
                    if any(w in desc_lower for w in ["music", "concert", "show", "band", "live"]):
                        category = "music"
                    elif any(w in desc_lower for w in ["sports", "game", "match", "tournament", "soccer", "football", "basketball", "run"]):
                        category = "sports"
                    elif any(w in desc_lower for w in ["conference", "summit", "business", "networking", "workshop"]):
                        category = "conference"
                    elif any(w in desc_lower for w in ["food", "taste", "dining", "dinner", "celebration", "festival"]):
                        category = "food"
                    
                    event_record = {
                        "name":           title[:120],
                        "date":           iso_date,
                        "end_date":       "",
                        "venue_name":     venue_name[:100],
                        "address":        address[:150] or None,
                        "lat":            None,
                        "lon":            None,
                        "price":          price,
                        "attendance":     "TBA",
                        "description":    desc[:200],
                        "categoryClean":  category,
                        "url":            link,
                        "organizer_name": venue_name or "Event Organizer",
                        "source":         "Scraper",
                        "source_domain":  domain,
                        "source_website": f"https://{domain}" if domain != "google.com" else "",
                        "source_url":     link,
                    }
                    events.append(event_record)
        except Exception as e:
            logger.error(f"Error searching Google Events via SerpAPI: {e}")
            
        return events

    async def search_event_sources(self, location: str) -> Dict[str, Any]:
        # ── Check Server-side File Cache First using EXACT query ──
        filepath = _get_cache_filepath(location)
        if os.path.exists(filepath):
            logger.info(f"Loading cached SerpAPI results from file: {filepath}")
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                    return cached_data
            except Exception as e:
                logger.error(f"Failed to read file cache: {e}")

        if not self.api_key:
            logger.error("SERP_API key not configured")
            return {"status": "error", "message": "SERP_API key not configured", "websites": {}}

        primary_query = location.strip()
        primary_city = _extract_city_from_location(location)
        neighboring_cities = _get_neighboring_cities(primary_city)
        logger.info(f"Search location: '{primary_query}' → city: '{primary_city}'")

        # Use CITY NAME (not full address) so queries like "{city} events calendar" work correctly
        cities_query_part = primary_city

        # Define domains to completely ignore (blacklisted sites)
        BLACKLISTED_DOMAINS = {
            "tripadvisor.com",
            "expedia.com",
            "yelp.com",
            "getyourguide.com",
            "visitcalifornia.com",
            "uschamber.com",
            "sjchamber.com",
            "web.sjchamber.com"
        }

        # Platforms to show, allowing multiple unique URLs (no domain-level deduplication)
        ALLOWED_PLATFORMS = {
            "eventbrite.com",
            "ticketmaster.com",
            "meetup.com",
            "bandsintown.com",
            "facebook.com",
            "allevents.in",
            "universe.com",
            "eventcartel.com",
            "nextdoor.com",
            "runsignup.com",
            "active.com",
            "playpass.com",
            "grassrootsecology.org",
            "canopy.org",
            "losgatan.com",
            "golobos.com",
            "paloaltoonline.com",
            "mercurynews.com"
        }

        seen_domains: set = set()
        seen_urls: set = set()
        all_results: List[Dict[str, Any]] = []

        # ── Seed exact user-defined calendars for Palo Alto and surrounding Bay Area ──
        seeds = self._get_seeds_for_city(primary_city)
        for seed in seeds:
            url = seed["url"]
            domain = seed["domain"]
            seen_urls.add(url)
            if domain not in ALLOWED_PLATFORMS:
                seen_domains.add(domain)
            all_results.append(seed)

        async with httpx.AsyncClient(timeout=30.0) as client:
            for category, query_template in CATEGORY_QUERIES:
                query = query_template.replace("{city}", cities_query_part)
                try:
                    params = {
                        "q": query,
                        "api_key": self.api_key,
                        "engine": "google",
                        "num": 10,
                        "gl": "us",
                        "hl": "en",
                        # No tbs/time restriction — calendar pages are evergreen and don't get re-indexed every week
                    }
                    logger.info(f"SerpAPI query [{category}]: {query}")
                    resp = await client.get(self.base_url, params=params)
                    resp.raise_for_status()
                    data = resp.json()

                    for result in data.get("organic_results", []):
                        url = result.get("link", "")
                        title = result.get("title", "")
                        domain = self._extract_domain(url)

                        if not domain:
                            continue

                        # 1. Skip invalid, helper, dead, or login URLs
                        if not _is_valid_event_url(url):
                            continue

                        # 1b. Require the URL to look like an event listing page (not a homepage)
                        if not _is_event_listing_url(url, domain):
                            logger.debug(f"Skipping non-event URL: {url}")
                            continue

                        # 2. Block blacklisted domains
                        is_blacklisted = False
                        for blacklisted in BLACKLISTED_DOMAINS:
                            if blacklisted in domain or domain == blacklisted:
                                is_blacklisted = True
                                break
                        if is_blacklisted:
                            continue

                        # 3. Prevent exact duplicate URLs
                        if url in seen_urls:
                            continue

                        # 4. Check if it's an allowed event platform
                        is_platform = any(platform in domain for platform in ALLOWED_PLATFORMS)

                        if not is_platform and domain in seen_domains:
                            continue

                        # Register in seen trackers
                        seen_domains.add(domain)
                        seen_urls.add(url)

                        all_results.append({
                            "url": url,
                            "title": title,
                            "domain": domain,
                            "category": category,
                        })

                    await asyncio.sleep(0.5)

                except Exception as e:
                    logger.warning(f"Query failed [{category}] '{query}': {e}")
                    continue

        logger.info(f"Total unique sources found: {len(all_results)}")
        categorized = self._build_categorized(all_results, location, primary_city, neighboring_cities)

        result = {
            "status": "success",
            "location": location,
            "total_sources": len(categorized),
            "websites": categorized,
        }

        # ── Save to Server-side File Cache! ──
        if len(categorized) > 0:
            try:
                # Validate categorized data before saving to cache
                if all(item.get("url") and item.get("domain") and item.get("name") for item in categorized):
                    with open(filepath, "w", encoding="utf-8") as f:
                        json.dump(result, f, indent=2, ensure_ascii=False)
                    logger.info(f"Saved {len(categorized)} validated SerpAPI results to file cache: {filepath}")
                else:
                    logger.warning(f"Skipped cache save: found invalid items in categorized results")
            except Exception as e:
                logger.error(f"Failed to write file cache: {e}")

        return result

    def _extract_domain(self, url: str) -> str:
        if not url:
            return ""
        raw = url.replace("https://", "").replace("http://", "").split("/")[0].lower()
        return raw.removeprefix("www.")

    def _build_categorized(self, results: List[Dict], location: str, primary_city: str, neighboring_cities: List[str]) -> List[Dict[str, Any]]:
        primary_lower = primary_city.lower().strip()
        neighbor_lowers = [c.lower().strip() for c in neighboring_cities]
        categorized = []

        for item in results:
            domain = item["domain"]
            url = item["url"]
            title = item["title"]
            category = item["category"]

            priority = self._score(domain, url, category, primary_lower, neighbor_lowers)
            
            # Use the smart name cleaner helper
            name = _clean_event_name(title, domain)

            categorized.append({
                "domain": domain,
                "url": url,
                "name": name,
                "category": category,
                "priority": priority,
                "description": f"Event source for {location}",
            })

        categorized.sort(key=lambda x: -x["priority"])
        return categorized[:60]

    def _score(self, domain: str, url: str, category: str, primary_city_lower: str, neighbor_lowers: List[str]) -> int:
        domain_lower = domain.lower()
        url_lower = url.lower()
        
        # Check if the URL explicitly points to an event directory or ticket page
        has_event_path = any(keyword in url_lower for keyword in ["/event", "/calendar", "/schedule", "/ticket", "/show", "/d/", "/e/"])
        
        # --- PRIORITY 10 ---
        if any(d in domain_lower for d in [".gov", "events.stanford.edu", "eventbrite.com", "meetup.com", "ticketmaster.com"]):
            return 10 if has_event_path else 9
            
        # --- PRIORITY 9 ---
        if any(d in domain_lower for d in ["menlopark.gov", "redwoodcity.org", "paloaltou.edu", "gostanford.com", "deanza.edu", ".edu"]):
            return 9 if has_event_path else 8
            
        # --- PRIORITY 8 ---
        if any(d in domain_lower for d in ["patch.com", "paloaltoscoop.com", "paloaltoonline.com", "mercurynews.com", "facebook.com", "theatreworks.org", "paphil.org", "allevents.in", "universe.com", "eventcartel.com"]):
            return 8 if has_event_path else 7
            
        # --- PRIORITY 7 ---
        if any(d in domain_lower for d in ["almanacnews.com", "padailypost.com", "paloaltofestival.com", "paloaltochamber.com", "chamber.com", "news.com", "grassrootsecology.org", "canopy.org", "losgatan.com", "golobos.com"]):
            return 7 if has_event_path else 6
            
        # --- PRIORITY 6 ---
        if any(d in domain_lower for d in ["runsignup.com", "maxpreps.com", "active.com", "playpass.com", "nextdoor.com", "bandsintown.com"]):
            return 6 if has_event_path else 5

        # --- Base Fallback Scoring (For generic sites discovered organically) ---
        base = {
            "City Government": 5,
            "Universities": 5,
            "Venues": 4,
            "Business & Community": 4,
            "Local Media": 4,
            "Sports & Recreation": 4,
            "Cultural & Religious": 3,
            "Tourism & Visitors": 3,
            "Event Platforms": 3,
            "Social Media": 3,
        }.get(category, 3)

        clean_domain = domain.replace("-", "").replace(".", "").replace(" ", "")
        if primary_city_lower.replace(" ", "") in clean_domain:
            base += 1
        else:
            for neighbor in neighbor_lowers:
                if neighbor.replace(" ", "") in clean_domain:
                    base += 1
                    break

        # Max score for a generic site is 5. Priority levels 6-10 are strictly reserved for the known best platforms.
        return min(5, base)

    def _get_seeds_for_city(self, city: str) -> List[Dict[str, Any]]:
        city_lower = city.lower().strip()
        
        # Bay Area / Palo Alto region seeds
        if any(kw in city_lower for kw in ["palo alto", "menlo park", "redwood city", "los gatos", "stanford", "mountain view", "sunnyvale"]):
            return [
                # ── OFFICIAL CITY/GOV WEBSITES (highest priority) ──
                {
                    "url": "https://www.paloalto.gov/calendar",
                    "title": "City of Palo Alto Official Events",
                    "domain": "paloalto.gov",
                    "category": "City Government"
                },
                {
                    "url": "https://www.sf.gov/events/upcoming",
                    "title": "San Francisco Events",
                    "domain": "sf.gov",
                    "category": "City Government"
                },
                # ── STANFORD EVENTS ──
                {
                    "url": "https://events.stanford.edu/",
                    "title": "Stanford University Events Calendar",
                    "domain": "events.stanford.edu",
                    "category": "Universities"
                },
                {
                    "url": "https://ose.stanford.edu/upcoming-events",
                    "title": "Stanford OSE Events",
                    "domain": "ose.stanford.edu",
                    "category": "Universities"
                },
                # ── MAJOR EVENT PLATFORMS ──
                {
                    "url": "https://allevents.in/palo-alto",
                    "title": "AllEvents Palo Alto",
                    "domain": "allevents.in",
                    "category": "Event Platforms"
                },
                {
                    "url": "https://www.meetup.com/find/us--ca--palo-alto/",
                    "title": "Meetup Palo Alto",
                    "domain": "meetup.com",
                    "category": "Meetup Events"
                },
                # ── LOCAL MEDIA & COMMUNITY CALENDARS ──
                {
                    "url": "https://www.paloaltoonline.com/calendar/",
                    "title": "Palo Alto Online Calendar",
                    "domain": "paloaltoonline.com",
                    "category": "Local Media"
                },
                {
                    "url": "https://www.destinationpaloalto.com/calendar/",
                    "title": "Destination Palo Alto Events",
                    "domain": "destinationpaloalto.com",
                    "category": "Tourism & Visitors"
                },
                # ── VENUES & ARTS ──
                {
                    "url": "https://livelyarts.stanford.edu/events",
                    "title": "Stanford Lively Arts",
                    "domain": "livelyarts.stanford.edu",
                    "category": "Venues"
                },
                {
                    "url": "https://www.theatreworks.org/tickets/upcoming-events/",
                    "title": "TheatreWorks Silicon Valley",
                    "domain": "theatreworks.org",
                    "category": "Venues"
                },
                # ── ENVIRONMENTAL & COMMUNITY ──
                {
                    "url": "https://www.grassrootsecology.org/event-calendar",
                    "title": "Grassroots Ecology Events",
                    "domain": "grassrootsecology.org",
                    "category": "Community"
                },
                {
                    "url": "https://canopy.org/event-calendar/",
                    "title": "Canopy Events",
                    "domain": "canopy.org",
                    "category": "Community"
                },
            ]
        
        # Bay Area generic (East Orange, Newark, etc.)
        if any(kw in city_lower for kw in ["east orange", "orange", "newark", "jersey", "nj"]):
            return [
                {
                    "url": "https://www.meetup.com/find/us--nj--orange/",
                    "title": "Meetup Orange NJ",
                    "domain": "meetup.com",
                    "category": "Meetup Events"
                },
                {
                    "url": "https://www.eventbrite.com/d/nj--orange/events/",
                    "title": "Eventbrite Orange NJ",
                    "domain": "eventbrite.com",
                    "category": "Event Platforms"
                },
                {
                    "url": "https://allevents.in/orange",
                    "title": "AllEvents Orange NJ",
                    "domain": "allevents.in",
                    "category": "Event Platforms"
                },
                {
                    "url": "https://www.nj.gov/nj/events/",
                    "title": "State of New Jersey Events",
                    "domain": "nj.gov",
                    "category": "City Government"
                },
            ]
        
        # Fallback for any city
        return [
            {
                "url": f"https://www.eventbrite.com/d/{city.lower().replace(' ', '-')}/events/",
                "title": f"Eventbrite {city}",
                "domain": "eventbrite.com",
                "category": "Event Platforms"
            },
            {
                "url": f"https://www.meetup.com/find/{city.lower().replace(' ', '-')}/",
                "title": f"Meetup {city}",
                "domain": "meetup.com",
                "category": "Meetup Events"
            },
            {
                "url": f"https://allevents.in/{city.lower().replace(' ', '-')}",
                "title": f"AllEvents {city}",
                "domain": "allevents.in",
                "category": "Event Platforms"
            },
        ]


serpapi_service = SerpAPIEventSearch()
