import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

apikey = os.getenv("TICKETMASTER_API_KEY", "ueGOxHEEHJdIo0zoC6GTgCPgnKaAUdy9")
print(f"Using API Key: {apikey}")

url = "https://app.ticketmaster.com/discovery/v2/events.json"
params = {
    "latlong": "37.4419,-122.1430",
    "radius": "50",
    "unit": "miles",
    "apikey": apikey,
    "size": 5
}

try:
    r = requests.get(url, params=params, timeout=10)
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"Total events found: {data.get('page', {}).get('totalElements', 0)}")
        
        embedded = data.get("_embedded", {})
        events = embedded.get("events", [])
        print(f"Retrieved {len(events)} events in page.")
        
        if events:
            # Save the first event to a json file to inspect its full structure
            first_event = events[0]
            print("\nFirst event overview:")
            print(f"  Name: {first_event.get('name')}")
            print(f"  ID: {first_event.get('id')}")
            print(f"  URL: {first_event.get('url')}")
            print(f"  Dates: {json.dumps(first_event.get('dates'), indent=2)}")
            print(f"  Price Ranges: {json.dumps(first_event.get('priceRanges'), indent=2)}")
            
            # Print venue info
            venues = first_event.get("_embedded", {}).get("venues", [])
            print(f"  Venues Count: {len(venues)}")
            if venues:
                print(f"    First Venue Name: {venues[0].get('name')}")
                print(f"    First Venue Address: {json.dumps(venues[0].get('address'), indent=2)}")
                print(f"    First Venue Location: {json.dumps(venues[0].get('location'), indent=2)}")
                
            # Write full structure to file
            with open("ticketmaster_sample.json", "w", encoding="utf-8") as f:
                json.dump(first_event, f, indent=2)
            print("\nSaved sample event details to ticketmaster_sample.json")
        else:
            print("No events found.")
    else:
        print(f"Error: {r.text}")
except Exception as e:
    print(f"Exception: {e}")
