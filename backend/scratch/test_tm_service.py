import os
import sys
import json
from dotenv import load_dotenv

# Ensure we can import from backend directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from app.services.ticketmaster import search_ticketmaster_events

print("--- Testing Ticketmaster Event Fetcher Service ---")
print(f"API Key: {os.getenv('TICKETMASTER_API_KEY')}")

# Coordinates for Palo Alto (centered on Emerson St/University Ave)
lat = 37.4419
lon = -122.1430
radius = 15000 # 15 km (about 9.3 miles)

events = search_ticketmaster_events("Palo Alto", lat, lon, radius)

print(f"\nFetched {len(events)} events near Palo Alto within {radius} meters:")
print("=" * 100)

for idx, e in enumerate(events[:5], 1):
    print(f"[{idx}] {e['name']}")
    print(f"    Source: {e['source']} | ID: {e['id']}")
    print(f"    Category: {e['category']} | Venue: {e['venue_name']}")
    print(f"    Address: {e['address']}")
    print(f"    Coords: ({e['lat']}, {e['lon']}) | Distance: {e['distance']} m")
    print(f"    Date: {e['date']} | Price: {e['price']} (Paid: {e['is_paid']})")
    print(f"    Attendance Projection: {e['attendance']}")
    print(f"    Organizer: {e['organizer_name']} | Website: {e['organizer_website']}")
    print(f"    Email: {e['organizer_email']} | Phone: {e['organizer_phone']}")
    print(f"    URL: {e['url']}")
    print("-" * 100)

if not events:
    print("No upcoming events found.")
