"""
Real-Time Event Discovery Service
Discovers event sources using SerpAPI and scrapes them using Scrapling
Works for ANY location without caching
"""

import logging
import asyncio
import httpx
import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from urllib.parse import urlparse, urljoin
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

SERP_API_KEY = os.getenv("SERP_API_KEY", "")

# Import Scrapling
try:
    from scrapling.fetchers import AsyncStealthySession, DynamicFetcher
    SCRAPLING_AVAILABLE = True
except ImportError:
    SCRAPLING_AVAILABLE = False
    logger.warning("Scrapling not available")

# Import BeautifulSoup for fallback
from bs4 import BeautifulSoup


class RealtimeEventDiscovery:
    """Discover and scrape events in real-time for any location."""
    
    def __init__(self):
        self.serp_api_key = SERP_API_KEY
        self.base_serp_url = "https://serpapi.com/search"
        logger.info("✅ Realtime Event Discovery Service initialized")
    
    async def discover_and_scrape(self, location: str, days: int = 7) -> Dict[str, Any]:
        """
        Complete 3-step workflow:
        Step 1: Discover event sources using SerpAPI
        Step 2: Scrape events from those sources
        Step 3: Extract and normalize data
        
        Returns fresh events without relying on cache.
        """
        logger.info(f"\n{'='*80}")
        logger.info(f"🌍 REAL-TIME EVENT DISCOVERY FOR: {location}")
        logger.info(f"{'='*80}")
        
        # STEP 1: Discover Event Sources
        logger.info(f"\n📍 STEP 1: Discovering Event Sources for '{location}'")
        logger.info("-" * 80)
        
        sources = await self._discover_sources(location)
        
        if not sources:
            logger.warning(f"❌ No event sources found for {location}")
            return {"status": "error", "message": "No sources found", "events": []}
        
        logger.info(f"✅ STEP 1 Complete: Found {len(sources)} event sources")
        for i, src in enumerate(sources[:10], 1):
            logger.info(f"   {i}. {src.get('domain', 'unknown')} - {src.get('title', '')[:60]}")
        
        # STEP 2: Scrape Events
        logger.info(f"\n📰 STEP 2: Scraping Events from {len(sources)} Sources")
        logger.info("-" * 80)
        
        events = await self._scrape_sources(sources, location)
        
        logger.info(f"✅ STEP 2 Complete: Scraped {len(events)} events")
        
        # STEP 3: Extract Organizers
        logger.info(f"\n👥 STEP 3: Extracting Organizer Information")
        logger.info("-" * 80)
        
        enriched_events = await self._extract_organizers(events)
        
        logger.info(f"✅ STEP 3 Complete: Enriched {len(enriched_events)} events with organizer info")
        
        logger.info(f"\n{'='*80}")
        logger.info(f"✅ DISCOVERY COMPLETE: {len(enriched_events)} Events Found")
        logger.info(f"{'='*80}\n")
        
        return {
            "status": "success",
            "location": location,
            "event_count": len(enriched_events),
            "events": enriched_events
        }
    
    async def _discover_sources(self, location: str) -> List[Dict[str, Any]]:
        """Step 1: Use SerpAPI to find event websites."""
        
        if not self.serp_api_key:
            logger.error("❌ SERP_API_KEY not configured")
            return []
        
        all_sources = []
        search_categories = [
            (f"{location} event calendar", "Event Calendars"),
            (f"{location} community events", "Community"),
            (f"{location} city events", "City Events"),
            (f"events.{location.split(',')[0].lower().replace(' ', '')} site:eventbrite.com", "Eventbrite"),
            (f"{location} meetup events site:meetup.com", "Meetup"),
            (f"{location} concerts shows venue site:ticketmaster.com", "Ticketmaster"),
            (f"{location} festivals fairs site:allevents.in", "AllEvents"),
            (f"{location} university campus events", "University"),
            (f"{location} theater performance", "Theater"),
            (f"{location} sports events", "Sports"),
        ]
        
        async with httpx.AsyncClient(timeout=15) as client:
            for query, category in search_categories:
                try:
                    logger.info(f"   🔍 Searching {category}: {query[:50]}...")
                    
                    params = {
                        "q": query,
                        "engine": "google",
                        "api_key": self.serp_api_key,
                        "num": 10,
                        "gl": "us"
                    }
                    
                    response = await client.get(self.base_serp_url, params=params, timeout=12)
                    response.raise_for_status()
                    data = response.json()
                    
                    # Extract URLs from organic results
                    organic = data.get("organic_results", [])
                    for result in organic[:5]:
                        url = result.get("link", "")
                        if url and self._is_valid_event_url(url):
                            domain = urlparse(url).hostname or ""
                            
                            # Avoid duplicates
                            if not any(s["url"] == url for s in all_sources):
                                source = {
                                    "url": url,
                                    "domain": domain,
                                    "title": result.get("title", ""),
                                    "category": category,
                                    "discovered_at": datetime.now().isoformat()
                                }
                                all_sources.append(source)
                                logger.info(f"      ✓ {domain}")
                    
                    await asyncio.sleep(0.5)  # Rate limiting
                    
                except Exception as e:
                    logger.warning(f"   ⚠ {category} search failed: {str(e)[:60]}")
                    continue
        
        # Remove duplicate domains, keep only the best source per domain
        seen_domains = {}
        unique = []
        for src in all_sources:
            domain = src["domain"]
            if domain not in seen_domains:
                seen_domains[domain] = src
                unique.append(src)
        
        logger.info(f"\n   📊 Found {len(unique)} unique event sources")
        return unique
    
    async def _scrape_sources(self, sources: List[Dict[str, Any]], location: str) -> List[Dict[str, Any]]:
        """Step 2: Scrape events from discovered sources."""
        
        all_events = []
        
        logger.info(f"   Starting to scrape {len(sources)} sources...")
        logger.info(f"   This may take a moment...")
        
        for i, source in enumerate(sources, 1):
            url = source["url"]
            domain = source["domain"]
            
            try:
                logger.info(f"   [{i}/{len(sources)}] Scraping {domain}...", end=" ")
                
                # Use Scrapling for advanced scraping
                events = await self._scrape_url(url, domain)
                
                if events:
                    logger.info(f"✓ Found {len(events)} events")
                    all_events.extend(events)
                else:
                    logger.info("✗ No events extracted")
                
                await asyncio.sleep(0.5)  # Rate limiting
                
            except Exception as e:
                logger.warning(f"✗ Error: {str(e)[:50]}")
                continue
        
        return all_events
    
    async def _scrape_url(self, url: str, domain: str) -> List[Dict[str, Any]]:
        """Scrape a single URL using Scrapling or fallback."""
        
        events = []
        
        try:
            # Try Scrapling first
            if SCRAPLING_AVAILABLE:
                try:
                    page = await asyncio.to_thread(
                        DynamicFetcher.fetch,
                        url,
                        headless=True,
                        timeout=10
                    )
                    
                    # Extract JSON-LD event data
                    json_lds = page.css('script[type="application/ld+json"]')
                    for js in json_lds:
                        try:
                            data = json.loads(js.text)
                            if self._is_event_data(data):
                                event = self._parse_event_data(data, url, domain)
                                if event:
                                    events.append(event)
                        except:
                            continue
                    
                    # Extract from HTML if no JSON-LD found
                    if not events:
                        events = self._extract_from_html(page.html, url, domain)
                        
                except Exception as e:
                    logger.debug(f"Scrapling failed for {domain}: {str(e)[:50]}")
                    # Fall back to simple httpx
                    events = await self._fallback_scrape(url, domain)
            else:
                events = await self._fallback_scrape(url, domain)
            
        except Exception as e:
            logger.debug(f"Scrape error for {url}: {str(e)[:50]}")
        
        return events
    
    async def _fallback_scrape(self, url: str, domain: str) -> List[Dict[str, Any]]:
        """Fallback HTTP scraping with httpx."""
        
        events = []
        
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(url, follow_redirects=True)
                response.raise_for_status()
                
                # Look for JSON-LD in response
                soup = BeautifulSoup(response.text, "html.parser")
                
                for script in soup.find_all("script", {"type": "application/ld+json"}):
                    try:
                        data = json.loads(script.string)
                        if self._is_event_data(data):
                            event = self._parse_event_data(data, url, domain)
                            if event:
                                events.append(event)
                    except:
                        continue
                
                # Extract from HTML structure if no JSON-LD
                if not events:
                    events = self._extract_from_html_soup(soup, url, domain)
        
        except Exception as e:
            logger.debug(f"Fallback scrape error: {str(e)[:50]}")
        
        return events
    
    def _is_event_data(self, data: Any) -> bool:
        """Check if data is event-related."""
        if isinstance(data, dict):
            type_val = data.get("@type", "").lower()
            return any(x in type_val for x in ["event", "conference", "concert", "performance"])
        elif isinstance(data, list):
            return any(self._is_event_data(item) for item in data)
        return False
    
    def _parse_event_data(self, data: dict, url: str, domain: str) -> Optional[Dict[str, Any]]:
        """Parse JSON-LD event data."""
        
        if isinstance(data, list):
            for item in data:
                result = self._parse_event_data(item, url, domain)
                if result:
                    return result
            return None
        
        if not isinstance(data, dict):
            return None
        
        # Extract event fields
        event = {
            "name": data.get("name", ""),
            "description": data.get("description", ""),
            "date": data.get("startDate", ""),
            "end_date": data.get("endDate", ""),
            "venue_name": "",
            "address": "",
            "url": url,
            "domain": domain,
            "source": "scraper",
            "price": "TBA",
        }
        
        # Extract venue info
        location = data.get("location", {})
        if isinstance(location, dict):
            event["venue_name"] = location.get("name", "")
            event["address"] = location.get("address", {}).get("streetAddress", "")
        
        # Extract organizer
        organizer = data.get("organizer", {})
        if isinstance(organizer, dict):
            event["organizer_name"] = organizer.get("name", "")
            event["organizer_url"] = organizer.get("url", "")
        
        # Price
        offers = data.get("offers", [])
        if offers and isinstance(offers, list) and offers[0]:
            event["price"] = offers[0].get("price", "Free")
        
        if event.get("name"):
            return event
        
        return None
    
    def _extract_from_html(self, html: str, url: str, domain: str) -> List[Dict[str, Any]]:
        """Extract events from HTML structure."""
        
        try:
            soup = BeautifulSoup(html, "html.parser")
            return self._extract_from_html_soup(soup, url, domain)
        except:
            return []
    
    def _extract_from_html_soup(self, soup: BeautifulSoup, url: str, domain: str) -> List[Dict[str, Any]]:
        """Extract from BeautifulSoup object."""
        
        events = []
        
        # Common event container selectors
        selectors = [
            ("div.event", "Event div"),
            ("article.event", "Event article"),
            ("li.event", "Event list"),
            ("div[data-event-id]", "Data event ID"),
            ("div.event-item", "Event item"),
            ("div.post-event", "Post event"),
        ]
        
        for selector, _desc in selectors:
            containers = soup.select(selector)
            if containers:
                for container in containers[:10]:  # Max 10 per URL
                    try:
                        event = {
                            "name": "",
                            "date": "",
                            "venue_name": "",
                            "address": "",
                            "description": "",
                            "url": url,
                            "domain": domain,
                            "source": "scraper",
                        }
                        
                        # Extract title
                        title = container.select_one("h2, h3, h4, .title, .name")
                        if title:
                            event["name"] = title.get_text(strip=True)[:100]
                        
                        # Extract date
                        date_elem = container.select_one(".date, .time, [data-date], time")
                        if date_elem:
                            event["date"] = date_elem.get_text(strip=True)[:50]
                        
                        # Extract venue
                        venue = container.select_one(".venue, .location, .place")
                        if venue:
                            event["venue_name"] = venue.get_text(strip=True)[:100]
                        
                        # Extract description
                        desc = container.select_one(".description, .excerpt, p")
                        if desc:
                            event["description"] = desc.get_text(strip=True)[:200]
                        
                        if event.get("name"):
                            events.append(event)
                    
                    except:
                        continue
                
                if events:
                    return events
        
        return events
    
    def _is_valid_event_url(self, url: str) -> bool:
        """Check if URL is likely an event source."""
        
        if not url or not url.startswith(("http://", "https://")):
            return False
        
        url_lower = url.lower()
        
        # Reject invalid patterns
        invalid = [
            "webcache", "google.com/search", "bing.com", "login", "signin",
            "register", "/search?", "privacy", "terms", "support", "contact",
            "about", "help"
        ]
        for pattern in invalid:
            if pattern in url_lower:
                return False
        
        # Good event URL indicators
        good_paths = [
            "event", "calendar", "schedule", "ticket", "show", "concert",
            "festival", "workshop", "conference", "meetup", "community"
        ]
        
        # Either has good path indicators or is from a known event platform
        known_domains = [
            "eventbrite.com", "meetup.com", "ticketmaster.com", "allevents.in",
            "bandsintown.com", "universe.com", "active.com", "patch.com"
        ]
        
        from_known = any(domain in url_lower for domain in known_domains)
        has_good_path = any(path in url_lower for path in good_paths)
        
        return from_known or has_good_path
    
    async def _extract_organizers(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Step 3: Extract and enrich organizer information."""
        
        for i, event in enumerate(events, 1):
            if i % 20 == 0:
                logger.info(f"   Processing event {i}/{len(events)}...")
            
            # Enrich with basic organizer inference
            if not event.get("organizer_name"):
                event["organizer_name"] = event.get("domain", "Unknown")
            
            event["organizer"] = {
                "name": event.get("organizer_name", ""),
                "domain": event.get("domain", ""),
                "type": self._infer_organizer_type(event.get("domain", ""))
            }
        
        logger.info(f"   ✓ Enriched {len(events)} events with organizer info")
        
        return events
    
    def _infer_organizer_type(self, domain: str) -> str:
        """Infer organizer type from domain."""
        
        if not domain:
            return "Unknown"
        
        domain_lower = domain.lower()
        
        if any(x in domain_lower for x in ["eventbrite", "ticketmaster", "universe"]):
            return "Event Platform"
        elif any(x in domain_lower for x in ["meetup"]):
            return "Community Network"
        elif any(x in domain_lower for x in ["allevents"]):
            return "Event Aggregator"
        elif any(x in domain_lower for x in [".gov", "city.", "parks"]):
            return "Government"
        elif any(x in domain_lower for x in ["stanford", "berkeley", ".edu", "university"]):
            return "University"
        elif any(x in domain_lower for x in ["theater", "venue"]):
            return "Venue"
        elif any(x in domain_lower for x in ["news", "patch"]):
            return "Local News"
        else:
            return "Local Organization"


# Singleton instance
realtime_discovery = RealtimeEventDiscovery()
