import json
import os
from math import sin, cos, sqrt, atan2, radians
from typing import List, Dict, Any

# Approximate coordinates for common locations
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

class EventSourcesService:
    def __init__(self):
        self.sources_file = os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "data",
            "event_sources.json"
        )
        self.sources = self._load_sources()

    def _load_sources(self) -> List[Dict[str, Any]]:
        """Load event sources from JSON file."""
        try:
            with open(self.sources_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('sources', [])
        except FileNotFoundError:
            print(f"Warning: {self.sources_file} not found. Returning empty sources.")
            return []
        except json.JSONDecodeError:
            print(f"Warning: Invalid JSON in {self.sources_file}. Returning empty sources.")
            return []

    def _calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance in kilometers between two coordinates using Haversine formula."""
        R = 6371  # Earth's radius in kilometers
        phi1, phi2 = radians(lat1), radians(lat2)
        dphi = radians(lat2 - lat1)
        dlambda = radians(lon2 - lon1)
        a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
        return R * 2 * atan2(sqrt(a), sqrt(1 - a))

    def _get_location_coordinates(self, location: str) -> tuple:
        """Get approximate coordinates for a location."""
        location_lower = location.lower().strip()
        if location_lower in LOCATION_COORDINATES:
            return LOCATION_COORDINATES[location_lower]
        return None

    def get_all_sources(self) -> List[Dict[str, Any]]:
        """Get all event sources sorted by priority."""
        return sorted(self.sources, key=lambda x: x.get('priority_level', 0), reverse=True)

    def search_sources_by_location(
        self,
        location: str,
        radius_km: float = 25
    ) -> List[Dict[str, Any]]:
        """
        Search event sources that cover a specific location within a radius.
        
        Args:
            location: Location name (e.g., "Palo Alto")
            radius_km: Search radius in kilometers
            
        Returns:
            List of sources covering the location
        """
        coords = self._get_location_coordinates(location)
        
        if not coords:
            # Return sources that mention the location in geographic_coverage
            location_lower = location.lower()
            return [
                s for s in self.sources
                if any(location_lower in city.lower() for city in s.get('geographic_coverage', []))
            ]
        
        user_lat, user_lon = coords
        matching_sources = []
        
        for source in self.sources:
            coverage = source.get('geographic_coverage', [])
            
            # Check if any city in coverage is within the radius
            for city in coverage:
                city_coords = self._get_location_coordinates(city)
                if city_coords:
                    distance = self._calculate_distance(user_lat, user_lon, city_coords[0], city_coords[1])
                    if distance <= radius_km:
                        matching_sources.append({
                            **source,
                            'distance_km': round(distance, 2),
                            'relevant_city': city
                        })
                        break  # Don't add the same source multiple times
        
        # Sort by distance then by priority
        matching_sources.sort(key=lambda x: (x.get('distance_km', float('inf')), -x.get('priority_level', 0)))
        
        return matching_sources

    def search_sources_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Search sources by category."""
        category_lower = category.lower()
        return [
            s for s in self.sources
            if category_lower in s.get('category', '').lower()
        ]

    def get_sources_by_category_group(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get all sources grouped by category."""
        grouped = {}
        for source in self.sources:
            category = source.get('category', 'Uncategorized')
            if category not in grouped:
                grouped[category] = []
            grouped[category].append(source)
        
        # Sort categories by average priority
        for category in grouped:
            grouped[category].sort(key=lambda x: x.get('priority_level', 0), reverse=True)
        
        return grouped

    def get_priority_sources(self, min_priority: int = 4) -> List[Dict[str, Any]]:
        """Get high-priority sources only."""
        return [
            s for s in self.sources
            if s.get('priority_level', 0) >= min_priority
        ]

    def get_api_accessible_sources(self) -> List[Dict[str, Any]]:
        """Get sources with API or RSS access."""
        return [
            s for s in self.sources
            if 'API' in s.get('data_access_method', '') or 'RSS' in s.get('data_access_method', '')
        ]

    def get_supported_locations(self) -> List[str]:
        """Get list of all supported location names."""
        locations = set()
        for source in self.sources:
            locations.update(source.get('geographic_coverage', []))
        return sorted(list(locations))


# Initialize service
event_sources_service = EventSourcesService()
