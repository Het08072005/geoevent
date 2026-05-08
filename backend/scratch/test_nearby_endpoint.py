import os
import sys
import asyncio
from dotenv import load_dotenv

# Ensure we can import from backend directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from app.main import get_nearby_venues

# Mock background tasks class
class MockBackgroundTasks:
    def add_task(self, func, *args, **kwargs):
        pass

async def test():
    print("--- Testing /api/nearby-venues endpoint directly ---")
    
    # Coordinates for Palo Alto (centered on Emerson St/University Ave)
    lat = 37.4419
    lon = -122.1430
    radius = 15000 # 15 km (about 9.3 miles)
    city = "Palo Alto"
    
    bg = MockBackgroundTasks()
    
    # Run the get_nearby_venues function
    res = await get_nearby_venues(
        lat=lat,
        lon=lon,
        background_tasks=bg,
        radius=radius,
        city=city
    )
    
    print(f"\nEndpoint response status: {res.get('status')}")
    print(f"Source: {res.get('source')}")
    
    venues = res.get("venues", [])
    print(f"Aggregated {len(venues)} total events.")
    
    # Count sources
    sources = {}
    for e in venues:
        src = e.get("source", "Unknown")
        sources[src] = sources.get(src, 0) + 1
        
    print("\nSource breakdown:")
    for src, count in sources.items():
        print(f"  {src}: {count}")
        
    print("\nFirst 3 events normalized detail:")
    print("=" * 100)
    for idx, e in enumerate(venues[:3], 1):
        print(f"[{idx}] {e['name']}")
        print(f"    Source: {e['source']} | ID: {e['id']}")
        print(f"    Category: {e['category']} | Venue: {e['venue_name']}")
        print(f"    Address: {e['address']}")
        print(f"    Coords: ({e['lat']}, {e['lon']}) | Distance: {e['distance']} m")
        print(f"    Price: {e['price']} (Paid: {e['is_paid']})")
        print(f"    Attendance: {e['attendance']}")
        print(f"    Organizer: {e['organizer_name']} | Website: {e['organizer_website']}")
        print("-" * 100)

if __name__ == "__main__":
    asyncio.run(test())
