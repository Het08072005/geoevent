from dotenv import load_dotenv
load_dotenv()

import os
print("Token from env:", os.getenv("EVENTBRITE_PRIVATE_TOKEN", "MISSING")[:10] + "...")

from app.services.eventbrite import search_eventbrite_events, _get_token
print("Token from _get_token():", _get_token()[:10] + "..." if _get_token() else "EMPTY!")

results = search_eventbrite_events("Palo Alto", 37.4419, -122.1430, 10000)
print(f"\nEvents returned: {len(results)}")
for e in results[:5]:
    print(f"  {e['name'][:50]} | {e['price']} | {e['organizer_name'][:25]}")
