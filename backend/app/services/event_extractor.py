"""
Event Extractor — Extract Structured Event Data from HTML

Handles:
- JSON-LD structured data extraction
- Microdata (schema.org) parsing
- Common event website patterns
- Normalization to standard event schema
"""

import json
import re
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class EventSchema:
    """Standard normalized event schema."""
    
    @staticmethod
    def create(
        name: str,
        date: Optional[str] = None,
        time: Optional[str] = None,
        end_time: Optional[str] = None,
        location_name: Optional[str] = None,
        address: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        event_type: Optional[str] = None,
        description: Optional[str] = None,
        url: Optional[str] = None,
        image: Optional[str] = None,
        organizer_name: Optional[str] = None,
        organizer_url: Optional[str] = None,
        expected_attendees: Optional[int] = None,
        is_paid: Optional[bool] = None,
        price: Optional[str] = None,
        source_domain: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a normalized event dict."""
        return {
            "name": name,
            "date": date,
            "time": time,
            "end_time": end_time,
            "location_name": location_name,
            "address": address,
            "latitude": latitude,
            "longitude": longitude,
            "event_type": event_type,
            "description": description,
            "url": url,
            "image": image,
            "organizer_name": organizer_name,
            "organizer_url": organizer_url,
            "expected_attendees": expected_attendees,
            "is_paid": is_paid,
            "price": price,
            "source_domain": source_domain,
            "extracted_at": datetime.now().isoformat()
        }


class EventExtractor:
    """Extract structured event data from HTML pages."""
    
    def __init__(self):
        logger.info("✅ Event Extractor initialized")
    
    def extract_from_html(self, html: str, source_url: str) -> List[Dict[str, Any]]:
        """
        Extract all events from HTML content.
        
        Args:
            html: HTML page content
            source_url: URL of the page (for relative URL resolution)
            
        Returns:
            List of normalized event dictionaries
        """
        events = []
        
        # Try JSON-LD first (most reliable)
        jsonld_events = self._extract_jsonld_events(html, source_url)
        events.extend(jsonld_events)
        
        # Try microdata extraction
        microdata_events = self._extract_microdata_events(html, source_url)
        events.extend([e for e in microdata_events if e not in events])
        
        # Try common website patterns
        pattern_events = self._extract_pattern_events(html, source_url)
        events.extend([e for e in pattern_events if e not in events])
        
        logger.debug(f"  Extracted {len(events)} events from {source_url}")
        return events
    
    def _extract_jsonld_events(self, html: str, source_url: str) -> List[Dict[str, Any]]:
        """Extract events from JSON-LD structured data."""
        events = []
        
        # Find all <script type="application/ld+json"> tags
        jsonld_pattern = r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>'
        matches = re.findall(jsonld_pattern, html, re.DOTALL | re.IGNORECASE)
        
        for match in matches:
            try:
                data = json.loads(match.strip())
                
                # Handle both single objects and arrays
                items = data if isinstance(data, list) else [data]
                
                for item in items:
                    if isinstance(item, dict):
                        # Check if it's an Event or contains events
                        event = self._parse_jsonld_event(item, source_url)
                        if event and event.get("name"):
                            events.append(event)
                        
                        # Check for nested events
                        if item.get("@graph"):
                            for subitem in item["@graph"]:
                                subevent = self._parse_jsonld_event(subitem, source_url)
                                if subevent and subevent.get("name"):
                                    events.append(subevent)
            
            except json.JSONDecodeError as e:
                logger.debug(f"  Failed to parse JSON-LD: {e}")
                continue
        
        return events
    
    def _parse_jsonld_event(self, item: dict, source_url: str) -> Optional[Dict[str, Any]]:
        """Parse a single JSON-LD event object."""
        
        # Check if this is an Event type
        schema_type = item.get("@type")
        if not schema_type:
            return None
        
        # Accept various event type names
        event_types = ["Event", "MusicEvent", "SportsEvent", "TheaterEvent", "FoodEvent"]
        is_event = False
        if isinstance(schema_type, str):
            is_event = any(et in schema_type for et in event_types)
        elif isinstance(schema_type, list):
            is_event = any(any(et in s for et in event_types) for s in schema_type)
        
        if not is_event:
            return None
        
        # Extract fields
        name = item.get("name", "")
        if not name:
            return None
        
        # Parse dates
        event_date = item.get("startDate") or item.get("datePublished")
        start_time = None
        end_time = None
        if event_date:
            parsed = self._parse_datetime(event_date)
            event_date = parsed.get("date")
            start_time = parsed.get("time")
        
        event_end = item.get("endDate")
        if event_end:
            parsed_end = self._parse_datetime(event_end)
            end_time = parsed_end.get("time")
        
        # Extract location
        location_name = None
        address = None
        if item.get("location"):
            loc = item["location"]
            if isinstance(loc, dict):
                location_name = loc.get("name")
                address = loc.get("address")
            elif isinstance(loc, str):
                location_name = loc
        
        # Extract organizer
        organizer_name = None
        organizer_url = None
        if item.get("organizer"):
            org = item["organizer"]
            if isinstance(org, dict):
                organizer_name = org.get("name")
                organizer_url = org.get("url")
            elif isinstance(org, str):
                organizer_name = org
        
        # Extract description
        description = item.get("description") or item.get("summary")
        
        # Extract image
        image = item.get("image")
        if isinstance(image, list):
            image = image[0] if image else None
        elif isinstance(image, dict):
            image = image.get("url")
        
        # Extract ticket price
        is_paid = None
        price = None
        if item.get("offers"):
            offers = item["offers"]
            if isinstance(offers, dict):
                offers = [offers]
            
            for offer in offers:
                if offer.get("price"):
                    price = offer.get("price")
                    is_paid = float(price) > 0 if isinstance(price, (int, float)) else True
        
        # Determine event type
        event_type = self._infer_event_type(schema_type)
        
        return EventSchema.create(
            name=name,
            date=event_date,
            time=start_time,
            end_time=end_time,
            location_name=location_name,
            address=address,
            event_type=event_type,
            description=description,
            url=item.get("url") or source_url,
            image=image,
            organizer_name=organizer_name,
            organizer_url=organizer_url,
            is_paid=is_paid,
            price=price,
            source_domain=urlparse(source_url).hostname
        )
    
    def _extract_microdata_events(self, html: str, source_url: str) -> List[Dict[str, Any]]:
        """Extract events from microdata (schema.org markup)."""
        events = []
        soup = BeautifulSoup(html, 'html.parser')
        
        # Find elements with itemtype="http://schema.org/Event"
        event_elements = soup.find_all(attrs={"itemtype": re.compile(r"schema\.org.*Event", re.I)})
        
        for elem in event_elements:
            event = self._parse_microdata_event(elem, source_url)
            if event and event.get("name"):
                events.append(event)
        
        return events
    
    def _parse_microdata_event(self, elem, source_url: str) -> Optional[Dict[str, Any]]:
        """Parse a single microdata event element."""
        
        # Extract name
        name_elem = elem.find(attrs={"itemprop": "name"})
        name = name_elem.get_text(strip=True) if name_elem else ""
        if not name:
            return None
        
        # Extract date
        date_elem = elem.find(attrs={"itemprop": "startDate"})
        event_date = date_elem.get("content", "") or date_elem.get_text(strip=True) if date_elem else ""
        parsed = self._parse_datetime(event_date) if event_date else {}
        
        # Extract location
        location_elem = elem.find(attrs={"itemprop": "location"})
        location_name = None
        if location_elem:
            name_elem_loc = location_elem.find(attrs={"itemprop": "name"})
            location_name = name_elem_loc.get_text(strip=True) if name_elem_loc else location_elem.get_text(strip=True)
        
        # Extract description
        desc_elem = elem.find(attrs={"itemprop": "description"})
        description = desc_elem.get_text(strip=True) if desc_elem else ""
        
        return EventSchema.create(
            name=name,
            date=parsed.get("date"),
            time=parsed.get("time"),
            location_name=location_name,
            description=description,
            url=source_url,
            source_domain=urlparse(source_url).hostname
        )
    
    def _extract_pattern_events(self, html: str, source_url: str) -> List[Dict[str, Any]]:
        """Extract events from common website patterns (fallback method)."""
        events = []
        
        # This is a placeholder for common website patterns
        # Each website may have different HTML structures
        
        logger.debug(f"  Pattern extraction would analyze common website patterns")
        return events
    
    def _parse_datetime(self, date_string: str) -> Dict[str, Optional[str]]:
        """Parse various datetime formats."""
        result = {"date": None, "time": None}
        
        if not date_string:
            return result
        
        # ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
        if "T" in date_string:
            parts = date_string.split("T")
            result["date"] = parts[0]
            if len(parts) > 1:
                time_part = parts[1].split("+")[0].split("-")[0].split("Z")[0]  # Remove timezone
                result["time"] = time_part[:8]  # HH:MM:SS
        else:
            # Just a date
            if re.match(r"\d{4}-\d{2}-\d{2}", date_string):
                result["date"] = date_string[:10]
        
        return result
    
    def _infer_event_type(self, schema_type) -> str:
        """Map schema.org event type to category."""
        
        type_str = str(schema_type).lower()
        
        mapping = {
            "music": "music",
            "sports": "sports",
            "theater": "arts",
            "dance": "arts",
            "food": "food",
            "education": "education",
            "business": "conference",
            "conference": "conference",
            "workshop": "education",
            "class": "education",
            "comedy": "arts",
            "screening": "arts",
            "exhibition": "arts",
            "social": "community",
            "fundraiser": "community",
            "festival": "community",
            "parade": "community",
        }
        
        for key, value in mapping.items():
            if key in type_str:
                return value
        
        return "other"


# Global instance
event_extractor = EventExtractor()
