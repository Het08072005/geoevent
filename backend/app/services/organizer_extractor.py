"""
Organizer Extractor — Extract Contact & Organizer Information from Events

Handles:
- Email extraction from event pages
- Phone number extraction
- Contact form discovery
- Partnership opportunity identification
- Organizer type classification
"""

import re
import logging
from typing import Dict, Any, Optional, List
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class OrganizerExtractor:
    """Extract organizer contact information from events."""
    
    # Common email patterns in HTML
    EMAIL_PATTERNS = [
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        r'mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})',
        r'contact\s*[:=]\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)',
    ]
    
    # Common phone patterns
    PHONE_PATTERNS = [
        r'\+?1?\s*\(?([0-9]{3})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{4})\b',
        r'phone\s*[:=]\s*([+\d\s()-]+)',
        r'tel\s*[:=]\s*([+\d\s()-]+)',
    ]
    
    def __init__(self):
        logger.info("✅ Organizer Extractor initialized")
    
    def extract_organizer_from_event(
        self,
        event: Dict[str, Any],
        html: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract complete organizer information for an event.
        
        Args:
            event: Event dictionary with at least 'name' and 'url'
            html: Optional HTML content from event page
            
        Returns:
            Dictionary with organizer information
        """
        organizer = {
            "name": event.get("organizer_name") or "Unknown Organizer",
            "type": self._infer_organizer_type(event),
            "website": event.get("organizer_url"),
            "email": None,
            "phone": None,
            "contact_form": None,
            "partnership_potential": "low",
            "notes": []
        }
        
        # Extract from HTML if provided
        if html:
            email = self._extract_email(html)
            if email:
                organizer["email"] = email
            
            phone = self._extract_phone(html)
            if phone:
                organizer["phone"] = phone
            
            contact_form = self._find_contact_form(html)
            if contact_form:
                organizer["contact_form"] = contact_form
        
        # Assess partnership potential
        organizer["partnership_potential"] = self._assess_partnership_potential(event, organizer)
        
        return organizer
    
    def extract_organizers_from_html(self, html: str, source_url: str) -> List[Dict[str, Any]]:
        """
        Extract all organizer contacts from a website page.
        
        Args:
            html: HTML content
            source_url: Source URL
            
        Returns:
            List of organizer dictionaries
        """
        organizers = []
        
        # Extract main contact info
        main_organizer = {
            "website": source_url,
            "type": self._infer_type_from_domain(urlparse(source_url).hostname or ""),
            "email": self._extract_email(html),
            "phone": self._extract_phone(html),
            "contact_form": self._find_contact_form(html),
            "notes": []
        }
        
        # Find name if available
        soup = BeautifulSoup(html, 'html.parser')
        
        # Try to find organization name in common places
        name_candidates = [
            soup.find(class_=re.compile("organization|company|site-title", re.I)),
            soup.find("h1"),
            soup.find(attrs={"itemprop": "name"}),
        ]
        
        for elem in name_candidates:
            if elem:
                name = elem.get_text(strip=True)
                if name and len(name) < 200:
                    main_organizer["name"] = name
                    break
        
        if main_organizer.get("name") or main_organizer.get("email"):
            organizers.append(main_organizer)
        
        return organizers
    
    def _extract_email(self, text: str) -> Optional[str]:
        """Extract email from text."""
        if not text:
            return None
        
        # Use first pattern for general email extraction
        match = re.search(self.EMAIL_PATTERNS[0], text)
        if match:
            return match.group(0)
        
        # Try mailto links
        mailto_pattern = r'href=["\']?mailto:([^"\'&]+)'
        match = re.search(mailto_pattern, text, re.I)
        if match:
            return match.group(1)
        
        return None
    
    def _extract_phone(self, text: str) -> Optional[str]:
        """Extract phone number from text."""
        if not text:
            return None
        
        match = re.search(self.PHONE_PATTERNS[0], text)
        if match:
            return f"({match.group(1)}) {match.group(2)}-{match.group(3)}"
        
        return None
    
    def _find_contact_form(self, html: str) -> Optional[str]:
        """Check if page has a contact form."""
        soup = BeautifulSoup(html, 'html.parser')
        
        # Look for contact forms
        form = soup.find("form", attrs={"name": re.compile("contact", re.I)})
        if form:
            return "contact_form_found"
        
        # Look for contact section
        contact_section = soup.find(id=re.compile("contact", re.I))
        if contact_section:
            return "contact_section_found"
        
        return None
    
    def _infer_organizer_type(self, event: Dict[str, Any]) -> str:
        """Infer organizer type from event information."""
        
        # Check source domain
        if event.get("source_domain"):
            return self._infer_type_from_domain(event["source_domain"])
        
        # Check URL
        if event.get("url"):
            domain = urlparse(event["url"]).hostname or ""
            return self._infer_type_from_domain(domain)
        
        # Default
        return "Other"
    
    def _infer_type_from_domain(self, domain: str) -> str:
        """Infer organization type from domain."""
        
        domain_lower = domain.lower()
        
        if any(x in domain_lower for x in [".gov", "city.", "parks", "recreation"]):
            return "Government"
        elif any(x in domain_lower for x in ["stanford", "berkeley", "university", "college", ".edu"]):
            return "University"
        elif any(x in domain_lower for x in ["eventbrite", "meetup", "ticketmaster", "universe"]):
            return "Event Platform"
        elif any(x in domain_lower for x in ["nonprofit", "charity", "foundation", ".org"]):
            return "Nonprofit"
        elif any(x in domain_lower for x in ["chamber", "business", "trade", "rotary"]):
            return "Business"
        elif any(x in domain_lower for x in ["facebook", "instagram", "twitter"]):
            return "Social Media"
        else:
            return "Other"
    
    def _assess_partnership_potential(
        self,
        event: Dict[str, Any],
        organizer: Dict[str, Any]
    ) -> str:
        """Assess partnership opportunity for restaurant."""
        
        score = 0
        
        # High-value event types
        high_value_types = ["conference", "food", "community", "arts", "sports"]
        if event.get("event_type") in high_value_types:
            score += 3
        
        # Organizer type
        organizer_type = organizer.get("type", "")
        if organizer_type in ["Government", "University", "Business"]:
            score += 2
        
        # Has contact info
        if organizer.get("email"):
            score += 1
        if organizer.get("phone"):
            score += 1
        
        # Expected attendance
        attendees = event.get("expected_attendees")
        if attendees and attendees > 500:
            score += 2
        elif attendees and attendees > 100:
            score += 1
        
        # Determine level
        if score >= 8:
            return "very_high"
        elif score >= 5:
            return "high"
        elif score >= 3:
            return "medium"
        else:
            return "low"


# Global instance
organizer_extractor = OrganizerExtractor()


# Utility function to enrich events with organizer info
def enrich_events_with_organizers(
    events: List[Dict[str, Any]],
    html_map: Optional[Dict[str, str]] = None
) -> List[Dict[str, Any]]:
    """
    Enrich a list of events with organizer information.
    
    Args:
        events: List of event dictionaries
        html_map: Optional dict mapping event URLs to HTML content
        
    Returns:
        Events enriched with organizer information
    """
    enriched = []
    
    for event in events:
        # Get HTML if available
        html = None
        if html_map and event.get("url"):
            html = html_map.get(event["url"])
        
        # Extract organizer
        organizer = organizer_extractor.extract_organizer_from_event(event, html)
        event["organizer"] = organizer
        enriched.append(event)
    
    return enriched
