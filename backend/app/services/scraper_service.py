import os
import re
import json
import logging
import asyncio
from math import radians, sin, cos, sqrt, atan2
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ── Scrapling async session imports ─────────────────────────────────────────
# Use AsyncStealthySession (correct async API) — never use sync StealthyFetcher
# inside an asyncio event loop as it triggers "Playwright Sync API" errors.
try:
    from scrapling.fetchers import AsyncStealthySession, AsyncDynamicSession
    SCRAPLING_ASYNC_AVAILABLE = True
    logger.info("Scrapling async sessions available (AsyncStealthySession)")
except ImportError:
    AsyncStealthySession = None
    AsyncDynamicSession = None
    SCRAPLING_ASYNC_AVAILABLE = False
    logger.warning("Scrapling async sessions not available — will use Playwright directly")

# ── Direct Playwright async (independent fallback) ───────────────────────────
try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    logger.warning("Playwright not installed")

RAW_SCRAPES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw_scrapes")
NORMALIZED_DIR  = os.path.join(os.path.dirname(__file__), "..", "..", "data", "normalized_events")
os.makedirs(RAW_SCRAPES_DIR, exist_ok=True)
os.makedirs(NORMALIZED_DIR,  exist_ok=True)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

_EVENT_SCHEMA_TYPES = {
    "Event", "MusicEvent", "SportsEvent", "TheaterEvent",
    "FoodEvent", "SocialEvent", "BusinessEvent", "EducationEvent",
    "DanceEvent", "ComedyEvent", "LiteraryEvent", "ScreeningEvent",
    "ExhibitionEvent", "SaleEvent", "CourseInstance",
}

_CAT_MAP = {
    "MusicEvent":     "music",
    "SportsEvent":    "sports",
    "TheaterEvent":   "arts",
    "DanceEvent":     "arts",
    "FoodEvent":      "food",
    "SocialEvent":    "community",
    "BusinessEvent":  "conference",
    "EducationEvent": "education",
    "ComedyEvent":    "arts",
    "LiteraryEvent":  "arts",
    "ScreeningEvent": "arts",
    "ExhibitionEvent":"arts",
    "SaleEvent":      "community",
    "CourseInstance": "education",
}

# Domains handled by their own dedicated service — skip here to avoid duplicates
SKIP_DOMAINS = {
    "eventbrite.com",
    "www.eventbrite.com",
}

# ── URL validation helpers ────────────────────────────────────────────────────
# Domains whose ANY page is likely an event source (no path check needed)
_ALWAYS_SCRAPE_DOMAINS = {
    "meetup.com", "ticketmaster.com", "allevents.in", "bandsintown.com",
    "runsignup.com", "active.com", "universe.com", "eventcartel.com",
    "patch.com", "nextdoor.com", "playpass.com",
}
# Path substrings that confirm a URL is an event listing page
_EVENT_PATH_MARKERS = {
    "/event", "/calendar", "/schedule", "/ticket", "/show", "/shows",
    "/whatson", "/whats-on", "/live", "/concert", "/concerts",
    "/upcoming", "/community", "/activities", "/program", "/programs",
    "/fest", "/fair", "/parade", "/conference", "/workshop", "/class",
    "/race", "/run", "/tournament", "/sports", "/arts", "/listing",
    "/listings", "/agenda", "/things-to-do", "/happenings", "/d/", "/e/",
}


def _is_scrapable_url(url: str) -> bool:
    """
    Returns True only if the URL looks like a real event listing page.
    Rejects bare homepages (path == "/") for non-platform domains.
    """
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower().removeprefix("www.")
        path   = parsed.path.lower()

        if any(d in domain for d in _ALWAYS_SCRAPE_DOMAINS):
            return True

        # Reject root/homepage URLs for generic sites
        if not path or path == "/":
            return False

        return any(marker in path for marker in _EVENT_PATH_MARKERS)
    except Exception:
        return False

# City/country keywords that flag a non-local (foreign) event
_FOREIGN_KEYWORDS = frozenset([
    "ahmedabad", "mumbai", "delhi", "bengaluru", "bangalore", "chennai",
    "hyderabad", "kolkata", "pune", "jaipur", "surat", "india", "gujarat",
    "rajasthan", "karnataka", "maharashtra", "andhra", "telangana",
    "london", "manchester", "birmingham", "uk", "england", "britain",
    "toronto", "vancouver", "montreal", "calgary", "canada",
    "sydney", "melbourne", "brisbane", "perth", "australia",
    "dubai", "abu dhabi", "uae",
    "singapore", "hong kong", "tokyo", "beijing", "shanghai",
    "paris", "berlin", "amsterdam", "madrid", "rome",
    "karachi", "lahore", "islamabad", "pakistan",
    "dhaka", "bangladesh", "colombo", "nairobi", "lagos",
])


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = radians(lat1), radians(lat2)
    a = sin(radians(lat2 - lat1) / 2) ** 2 + cos(phi1) * cos(phi2) * sin(radians(lon2 - lon1) / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))

_DATE_RE = re.compile(
    r"\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\.?\s+\d{1,2}(?:,\s*\d{4})?\b"
    r"|\b\d{4}-\d{2}-\d{2}\b",
    re.IGNORECASE,
)


def _extract_domain(url: str) -> str:
    try:
        netloc = urlparse(url).netloc.lower()
        return netloc.removeprefix("www.")
    except Exception:
        return ""


def _safe_text(val: Any, limit: int = 200) -> str:
    if val is None:
        return ""
    if isinstance(val, dict):
        val = val.get("text") or val.get("rendered") or val.get("value") or ""
    return str(val).strip()[:limit]


class ScraperService:
    def __init__(self):
        self.browser    = None
        self.playwright = None

    # ── Browser lifecycle (direct Playwright) ────────────────────────────────
    async def _init_browser(self):
        if not PLAYWRIGHT_AVAILABLE:
            return
        if not self.playwright:
            self.playwright = await async_playwright().start()
        if not self.browser:
            self.browser = await self.playwright.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
            )

    async def close(self):
        if self.browser:
            await self.browser.close()
            self.browser = None
        if self.playwright:
            await self.playwright.stop()
            self.playwright = None

    # ── Disk helpers ──────────────────────────────────────────────────────────
    def get_cached_normalized_events(self, city: str) -> List[Dict]:
        fp = os.path.join(
            NORMALIZED_DIR,
            f"{city.lower().replace(' ', '_')}_events.json"
        )
        if os.path.exists(fp):
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def save_normalized_events(self, city: str, new_events: List[Dict]):
        fp = os.path.join(
            NORMALIZED_DIR,
            f"{city.lower().replace(' ', '_')}_events.json"
        )
        existing  = self.get_cached_normalized_events(city)
        seen_urls = {e.get("url") for e in existing if e.get("url")}
        added = 0
        for e in new_events:
            if e.get("url") and e["url"] not in seen_urls:
                existing.append(e)
                seen_urls.add(e["url"])
                added += 1
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2, ensure_ascii=False)
        if added:
            logger.info(f"Saved {added} new events for '{city}' (total {len(existing)})")

    # ── JSON-LD parser ────────────────────────────────────────────────────────
    def _parse_json_ld(self, html: str) -> List:
        blocks = []
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(tag.string or "")
                blocks.append(data)
            except Exception:
                pass
        return blocks

    # ── HTTP fetchers ─────────────────────────────────────────────────────────
    async def _httpx_fetch(self, url: str) -> Dict:
        try:
            async with httpx.AsyncClient(
                timeout=15, follow_redirects=True, headers=_HEADERS
            ) as c:
                r = await c.get(url)
                if r.status_code == 200:
                    html = r.text
                    return {
                        "status": "success",
                        "html": html,
                        "json_ld": self._parse_json_ld(html),
                        "status_code": 200,
                    }
        except Exception as e:
            logger.debug(f"httpx failed {url}: {e}")
        return {"status": "error", "html": "", "json_ld": []}

    async def _scrapling_async_fetch(self, url: str) -> Dict:
        """
        Properly async Scrapling fetch using AsyncStealthySession.
        This avoids the 'Playwright Sync API inside asyncio loop' error
        that occurred with the old sync StealthyFetcher.fetch() call.
        """
        if not SCRAPLING_ASYNC_AVAILABLE or AsyncStealthySession is None:
            return {
                "status": "error", "html": "", "json_ld": [],
                "error": "Scrapling async sessions not available",
            }
        session = AsyncStealthySession(headless=True, auto_match=False)
        try:
            await session.start()
            response = await session.fetch(
                url,
                disable_resources=True,
                wait=1500,
                timeout=30000,
                network_idle=False,
            )
            html = str(getattr(response, "html_content", None) or "")
            return {
                "status": "success" if html else "error",
                "html": html,
                "json_ld": self._parse_json_ld(html),
            }
        except Exception as e:
            logger.warning(f"Scrapling async fetch failed {url}: {e}")
            return {"status": "error", "html": "", "json_ld": [], "error": str(e)}
        finally:
            try:
                await session.close()
            except Exception:
                pass

    async def _playwright_fetch(self, url: str) -> Dict:
        """Direct async Playwright fetch — last resort fallback."""
        if not PLAYWRIGHT_AVAILABLE:
            return {
                "status": "error", "html": "", "json_ld": [],
                "error": "playwright not installed",
            }
        await self._init_browser()
        if not self.browser:
            return {"status": "error", "html": "", "json_ld": []}
        ctx  = await self.browser.new_context(user_agent=_HEADERS["User-Agent"])
        page = await ctx.new_page()
        result: Dict = {"status": "success", "html": "", "json_ld": []}
        try:
            await page.set_extra_http_headers({"Accept-Language": "en-US,en;q=0.9"})
            resp = await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            if resp:
                result["status_code"] = resp.status
            await page.evaluate("window.scrollBy(0, window.innerHeight * 3)")
            await asyncio.sleep(2)
            html = await page.content()
            result["html"]    = html
            result["json_ld"] = self._parse_json_ld(html)
        except Exception as e:
            result["status"] = "error"
            result["error"]  = str(e)
        finally:
            await ctx.close()
        return result

    async def scrape_source(self, url: str) -> Dict:
        """
        Fetch pipeline: httpx → async Scrapling → direct Playwright.
        All paths are fully async — no sync Playwright calls.
        """
        # 1. Fast httpx
        result = await self._httpx_fetch(url)
        if result["status"] == "success":
            if result["json_ld"]:
                return result
            # No JSON-LD from plain HTTP — try Scrapling for JS-rendered content
            if SCRAPLING_ASYNC_AVAILABLE:
                logger.info(f"No JSON-LD from httpx for {url} — trying async Scrapling")
                scrapling_result = await self._scrapling_async_fetch(url)
                if scrapling_result["status"] == "success":
                    if scrapling_result["json_ld"]:
                        return scrapling_result
                    if scrapling_result["html"]:
                        result = scrapling_result  # richer HTML, even without JSON-LD

            # Still no JSON-LD — use direct Playwright
            if not result.get("json_ld") and PLAYWRIGHT_AVAILABLE:
                logger.info(f"No JSON-LD yet for {url} — trying Playwright")
                pw = await self._playwright_fetch(url)
                if pw["status"] == "success":
                    return pw

            return result

        # httpx failed entirely — go to async Scrapling
        if SCRAPLING_ASYNC_AVAILABLE:
            logger.info(f"httpx failed for {url} — trying async Scrapling")
            scrapling_result = await self._scrapling_async_fetch(url)
            if scrapling_result["status"] == "success":
                return scrapling_result

        # Last resort: direct Playwright
        logger.info(f"All fast paths failed for {url} — using direct Playwright")
        return await self._playwright_fetch(url)

    # ── Event extraction ──────────────────────────────────────────────────────
    def _events_from_json_ld(
        self, json_lds: List, fallback_url: str, source_domain: str
    ) -> List[Dict]:
        events = []
        for jld in json_lds:
            entities = jld if isinstance(jld, list) else [jld]
            if isinstance(jld, dict) and "@graph" in jld:
                entities = list(jld["@graph"])
            for entity in entities:
                if not isinstance(entity, dict):
                    continue
                etype = entity.get("@type", "")
                if isinstance(etype, list):
                    etype = next(
                        (t for t in etype if t in _EVENT_SCHEMA_TYPES), ""
                    )
                if etype not in _EVENT_SCHEMA_TYPES:
                    continue

                # Location
                loc        = entity.get("location", {})
                venue_name = ""
                address    = None
                lat = lon  = None
                if isinstance(loc, dict):
                    venue_name = _safe_text(loc.get("name", ""), 100)
                    addr = loc.get("address", {})
                    if isinstance(addr, dict):
                        parts   = [
                            addr.get("streetAddress", ""),
                            addr.get("addressLocality", ""),
                            addr.get("addressRegion", ""),
                        ]
                        address = ", ".join(p for p in parts if p).strip(", ") or None
                    elif isinstance(addr, str):
                        address = addr or None
                    geo = loc.get("geo", {})
                    if isinstance(geo, dict):
                        try:
                            lat = float(geo.get("latitude") or 0) or None
                            lon = float(geo.get("longitude") or 0) or None
                        except Exception:
                            pass
                elif isinstance(loc, str):
                    address = loc or None

                # Price
                offers = entity.get("offers", {})
                if isinstance(offers, list):
                    offers = offers[0] if offers else {}
                price = "Free"
                if isinstance(offers, dict):
                    pv = str(offers.get("price", ""))
                    if pv and pv not in ("0", "0.0", ""):
                        price = f"${pv}"

                # Attendance
                attendance = str(entity.get("maximumAttendeeCapacity", "TBA"))

                # Organizer
                org = entity.get("organizer", {})
                if isinstance(org, list):
                    org = org[0] if org else {}
                organizer_name = (
                    _safe_text(org.get("name", ""), 80)
                    if isinstance(org, dict)
                    else str(org)[:80]
                )

                event_url = (
                    entity.get("url") or entity.get("@id") or fallback_url
                )

                events.append({
                    "name":           _safe_text(entity.get("name", "Unknown Event"), 120),
                    "date":           _safe_text(entity.get("startDate", ""), 30),
                    "end_date":       _safe_text(entity.get("endDate", ""), 30),
                    "venue_name":     venue_name,
                    "address":        address,
                    "lat":            lat,
                    "lon":            lon,
                    "price":          price,
                    "attendance":     attendance,
                    "description":    _safe_text(entity.get("description", ""), 200),
                    "categoryClean":  _CAT_MAP.get(etype, "community"),
                    "url":            event_url,
                    "organizer_name": organizer_name,
                    "source":         "Scraper",
                    "source_domain":  source_domain,
                    "source_website": f"https://{source_domain}",
                    "source_url":     fallback_url,
                })
        return events

    def _events_from_microdata(
        self, html: str, fallback_url: str, source_domain: str
    ) -> List[Dict]:
        """Extract events from HTML microdata (itemscope + schema.org/Event)."""
        events = []
        soup = BeautifulSoup(html, "html.parser")
        event_scopes = soup.find_all(
            attrs={
                "itemscope": True,
                "itemtype": re.compile(r"schema\.org/\w*Event", re.I),
            }
        )
        for scope in event_scopes[:20]:
            def _prop(name: str) -> str:
                el = scope.find(attrs={"itemprop": name})
                if not el:
                    return ""
                return el.get("content") or el.get_text(strip=True)

            name = _prop("name")
            if not name:
                continue

            url_el = scope.find(attrs={"itemprop": "url"})
            event_url = fallback_url
            if url_el:
                href = url_el.get("href") or url_el.get("content") or ""
                if href.startswith("http"):
                    event_url = href
                elif href.startswith("/"):
                    event_url = f"https://{source_domain}{href}"

            events.append({
                "name":           name[:120],
                "date":           _prop("startDate")[:30],
                "end_date":       _prop("endDate")[:30],
                "venue_name":     _prop("location")[:100],
                "address":        _prop("address") or None,
                "lat":            None,
                "lon":            None,
                "price":          _prop("price") or "Free",
                "attendance":     "TBA",
                "description":    _prop("description")[:200],
                "categoryClean":  "community",
                "url":            event_url,
                "organizer_name": _prop("organizer"),
                "source":         "Scraper",
                "source_domain":  source_domain,
                "source_website": f"https://{source_domain}",
                "source_url":     fallback_url,
            })
        return events

    async def _detect_hidden_api(
        self, url: str, html: str
    ) -> Optional[List[Dict]]:
        """
        Probe common hidden JSON API endpoints (WordPress REST, custom /api/events).
        Returns parsed events if any endpoint responds with event data.
        """
        parsed  = urlparse(url)
        base    = f"{parsed.scheme}://{parsed.netloc}"
        candidates = [
            f"{base}/wp-json/tribe/events/v1/events?per_page=20&status=publish",
            f"{base}/wp-json/events/v1/events",
            f"{base}/wp-json/wp/v2/tribe_events?per_page=20",
            f"{base}/api/events?limit=20",
            f"{base}/api/v1/events",
            f"{base}/events.json",
            f"{base}/calendar/events.json",
        ]

        # Scan inline JS for API URL hints
        soup = BeautifulSoup(html, "html.parser")
        for script in soup.find_all("script"):
            text = script.string or ""
            found = re.findall(
                r'["\']([^"\']{5,120}(?:wp-json|/api/events|/events\.json)[^"\']*)["\']',
                text,
            )
            for f in found[:3]:
                if f.startswith("/"):
                    candidates.append(urljoin(base, f))
                elif f.startswith("http"):
                    candidates.append(f)

        async with httpx.AsyncClient(
            timeout=8, follow_redirects=True, headers=_HEADERS
        ) as client:
            for endpoint in candidates[:8]:
                try:
                    r = await client.get(endpoint)
                    if r.status_code != 200:
                        continue
                    ct = r.headers.get("content-type", "")
                    if "json" not in ct and not endpoint.endswith(".json"):
                        continue
                    data = r.json()
                    events = self._parse_api_json(data, endpoint)
                    if events:
                        logger.info(
                            f"Hidden API found {len(events)} events: {endpoint}"
                        )
                        return events
                except Exception:
                    pass
        return None

    def _parse_api_json(self, data: Any, source_url: str) -> List[Dict]:
        """Parse generic JSON event API responses."""
        domain = _extract_domain(source_url)
        items: List[Any] = []

        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            for key in ("events", "results", "data", "items", "collection"):
                if key in data and isinstance(data[key], list):
                    items = data[key]
                    break

        events = []
        for item in items[:30]:
            if not isinstance(item, dict):
                continue
            # Title
            raw_name = (
                item.get("title")
                or item.get("name")
                or item.get("event_name")
                or ""
            )
            name = _safe_text(raw_name, 120)
            if not name or len(name) < 3:
                continue

            # Date
            raw_start = (
                item.get("start_date")
                or item.get("start")
                or item.get("date")
                or item.get("startDate")
                or ""
            )
            start = _safe_text(raw_start, 30)

            # URL
            event_url = (
                item.get("url")
                or item.get("link")
                or item.get("event_url")
                or source_url
            )

            # Venue
            raw_venue = item.get("venue") or item.get("location") or {}
            venue_name = (
                _safe_text(
                    raw_venue.get("venue") or raw_venue.get("name") or "", 100
                )
                if isinstance(raw_venue, dict)
                else _safe_text(raw_venue, 100)
            )

            events.append({
                "name":           name,
                "date":           start,
                "end_date":       _safe_text(
                    item.get("end_date") or item.get("end") or "", 30
                ),
                "venue_name":     venue_name,
                "address":        None,
                "lat":            None,
                "lon":            None,
                "price":          "Free",
                "attendance":     "TBA",
                "description":    _safe_text(
                    item.get("description") or item.get("excerpt") or "", 200
                ),
                "categoryClean":  "community",
                "url":            event_url,
                "organizer_name": "",
                "source":         "Scraper",
                "source_domain":  domain,
                "source_website": f"https://{domain}",
                "source_url":     source_url,
            })
        return events

    def _events_from_html_heuristic(
        self, html: str, fallback_url: str, source_domain: str
    ) -> List[Dict]:
        """
        Best-effort HTML extraction: look for elements whose class/id
        contains 'event' or 'calendar', then find a title + date inside them.
        """
        events = []
        soup   = BeautifulSoup(html, "html.parser")

        def _has_event_keyword(tag) -> bool:
            cls = " ".join(tag.get("class", []))
            iid = tag.get("id", "")
            combined = f"{cls} {iid}".lower()
            return any(
                kw in combined
                for kw in (
                    "event", "calendar", "listing", "event-item",
                    "cal-event", "event-card", "event-row",
                )
            )

        containers = soup.find_all(
            lambda tag: tag.name in ("article", "li", "div", "section")
            and _has_event_keyword(tag)
        )

        seen: set = set()
        for container in containers[:40]:
            title_el = container.find(["h1", "h2", "h3", "h4"])
            if not title_el:
                title_el = container.find("a")
            if not title_el:
                continue

            name = title_el.get_text(strip=True)[:120]
            if not name or name in seen or len(name) < 5:
                continue

            # Date
            text       = container.get_text(" ", strip=True)
            date_match = _DATE_RE.search(text)
            date_str   = date_match.group(0) if date_match else ""

            # Link
            link      = container.find("a", href=True)
            event_url = fallback_url
            if link:
                href = link.get("href", "")
                if href.startswith("http"):
                    event_url = href
                elif href.startswith("/"):
                    event_url = f"https://{source_domain}{href}"

            seen.add(name)
            events.append({
                "name":           name,
                "date":           date_str,
                "end_date":       "",
                "venue_name":     "",
                "address":        None,
                "lat":            None,
                "lon":            None,
                "price":          "Free",
                "attendance":     "TBA",
                "description":    "",
                "categoryClean":  "community",
                "url":            event_url,
                "organizer_name": "",
                "source":         "Scraper",
                "source_domain":  source_domain,
                "source_website": f"https://{source_domain}",
                "source_url":     fallback_url,
            })
            if len(events) >= 20:
                break
        return events

    def _filter_events_by_location(
        self, events: List[Dict], city: str,
        lat: Optional[float], lon: Optional[float]
    ) -> List[Dict]:
        """
        Minimal location filtering — only remove events from completely different cities.
        Keep all events that:
        - Have valid geocoded coordinates (any US event is fine)
        - Don't explicitly mention foreign cities in their content
        """
        city_lower = city.lower().strip()
        kept = []
        
        for e in events:
            # Only check for VERY EXPLICIT foreign keywords
            haystack = " ".join(filter(None, [
                (e.get("address") or "").lower(),
                (e.get("venue_name") or "").lower(),
            ])).strip()
            
            # Only filter if explicitly mentions a different country/city
            # Don't use keyword matching on event names (too aggressive)
            very_foreign_patterns = [
                " london", " paris", " tokyo", " mexico", " canada",
                " india", " australia", " uk,", " england", " france",
                " germany", " spain", " italy", " international"
            ]
            has_explicit_foreign = any(f in haystack for f in very_foreign_patterns)
            
            if has_explicit_foreign and city_lower not in haystack:
                logger.debug(f"Filtered out foreign event: {e.get('name')[:50]}")
                continue
            
            # Geo check: if event has real coordinates, allow if reasonably close
            # (don't reject valid scraped events with geocoded addresses)
            if lat and lon and e.get("lat") and e.get("lon"):
                dist_km = _haversine_km(lat, lon, e["lat"], e["lon"])
                # Allow up to 10km for nearby events only
                if dist_km > 10:
                    logger.debug(f"Filtered out too-far event: {e.get('name')[:40]} ({dist_km:.0f}km)")
                    continue
            
            # Keep all other events (don't aggressively filter without coordinates)
            kept.append(e)
        
        return kept

    # ── Main pipeline ─────────────────────────────────────────────────────────
    async def process_sources(self, city: str, source_urls: List[str], lat: Optional[float] = None, lon: Optional[float] = None):
        # Skip Eventbrite (handled by eventbrite.py) and bare homepages
        filtered_urls = []
        for u in source_urls:
            if _extract_domain(u) in SKIP_DOMAINS:
                continue
            if not _is_scrapable_url(u):
                logger.info(f"Skipping non-event-listing URL: {u}")
                continue
            filtered_urls.append(u)

        urls = filtered_urls[:20]  # increased from 15 → 20

        if not urls:
            logger.info(f"No scrapable non-Eventbrite URLs for '{city}'")
            return

        logger.info(f"Scraping {len(urls)} validated event-listing sources for '{city}'")
        all_events: List[Dict] = []

        for url in urls:
            domain = _extract_domain(url)
            logger.info(f"  Scraping: {url} [{domain}]")

            result = await self.scrape_source(url)
            if result["status"] != "success":
                logger.warning(f"  Skip {url}: {result.get('error', 'no content')}")
                continue

            # Persist raw metadata for debugging
            safe_name = re.sub(r"[^\w]", "_", url)[:60]
            try:
                raw_path = os.path.join(RAW_SCRAPES_DIR, f"{safe_name}.json")
                with open(raw_path, "w", encoding="utf-8") as f:
                    json.dump(
                        {"url": url, "domain": domain, "json_ld": result["json_ld"]},
                        f,
                        ensure_ascii=False,
                    )
            except Exception:
                pass

            events: List[Dict] = []

            # 1. JSON-LD — most reliable structured metadata
            if result["json_ld"]:
                events = self._events_from_json_ld(result["json_ld"], url, domain)

            # 2. Hidden JSON API detection (WordPress REST, /api/events, etc.)
            if not events and result.get("html"):
                api_events = await self._detect_hidden_api(url, result["html"])
                if api_events:
                    events = api_events

            # 3. HTML microdata (itemscope/itemtype schema.org/Event)
            if not events and result.get("html"):
                events = self._events_from_microdata(result["html"], url, domain)

            # 4. HTML heuristic extraction (event class/id patterns + date matching)
            if not events and result.get("html"):
                events = self._events_from_html_heuristic(result["html"], url, domain)

            logger.info(f"  → {len(events)} events extracted from {url}")
            all_events.extend(events)

        # Fetch actual events from SerpAPI Google Events engine
        serpapi_events = []
        try:
            from app.services.serpapi_search import serpapi_service
            logger.info(f"Triggering background Google Events search via SerpAPI for: {city}")
            serpapi_events = await serpapi_service.search_google_events(city)
            if serpapi_events:
                logger.info(f"Successfully retrieved {len(serpapi_events)} events from SerpAPI Google Events for '{city}'")
        except Exception as e:
            logger.error(f"Failed to fetch Google Events via SerpAPI: {e}")

        combined_events = all_events + serpapi_events
        if combined_events:
            before = len(combined_events)
            combined_events = self._filter_events_by_location(combined_events, city, lat, lon)
            if before != len(combined_events):
                logger.info(f"Location filter: {before} → {len(combined_events)} combined events for '{city}'")
            self.save_normalized_events(city, combined_events)

        await self.close()

    def process_sources_sync(self, city: str, source_urls: List[str], lat: Optional[float] = None, lon: Optional[float] = None):
        """Thread-safe synchronous wrapper for FastAPI BackgroundTasks."""
        import sys
        if sys.platform == "win32":
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self.process_sources(city, source_urls, lat, lon))
        except Exception as e:
            logger.error(f"process_sources_sync error: {e}")
        finally:
            loop.close()


scraper_service = ScraperService()
