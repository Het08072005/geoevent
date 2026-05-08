# Event Discovery Pipeline - Complete Implementation Guide

## Overview

The system now supports **real-time, dynamic event discovery for ANY location** without hardcoded data. The workflow follows a proper 3-step architecture:

### 3-Step Workflow

**Step 1: Discover Event Sources** (using SerpAPI)
- User provides any location (e.g., "Palo Alto, CA", "Denver, CO", "Mumbai, India")
- System uses SerpAPI to discover ALL event websites for that location
- Results are categorized (Government, University, Meetup, Eventbrite, etc.)

**Step 2: Scrape Events from Sources**
- System scrapes the discovered websites using the scrapling library
- Extracts structured event data from:
  - JSON-LD metadata (most reliable)
  - HTML microdata (schema.org)
  - Hidden JSON APIs (WordPress REST, custom endpoints)
  - HTML patterns (as fallback)

**Step 3: Extract Organizer Information**
- Extracts organizer name, type, contact info
- Identifies partnership opportunities
- Builds contact directory

---

## Key Improvements Over Previous System

### ❌ Before (Hardcoded)
```python
# Hardcoded locations
LOCATION_COORDINATES = {
    "palo alto": (37.4419, -122.1430),
    "menlo park": (37.4829, -122.1600),
    # ... only works for predefined cities
}

# Hardcoded event data
cached_events = [
    {"name": "Event 1", "location": "Palo Alto", ...},
    {"name": "Event 2", "location": "Palo Alto", ...},
    # ... static data, no real-time updates
]
```

### ✅ After (Dynamic)
```python
# Accepts ANY location
await event_discovery_service.run_full_pipeline(
    location="Bangalore, India"  # or any city in the world!
)

# Real-time scraping from discovered sources
# Automatically extracts events with full details
# No hardcoded data required
```

---

## How to Use

### Frontend: Trigger Event Discovery

The frontend already has the mechanisms in place. When a user searches for a location:

```javascript
// This endpoint triggers the full discovery pipeline
const response = await axios.get('/api/discover-events-live', {
    params: {
        location: "Denver, CO",  // Any location!
        lat: 39.7392,            // Optional: if you have geocoded coords
        lon: -104.9903
    }
});

// Returns immediately with status
console.log(response.data.message); 
// "Event discovery pipeline started for Denver, CO"

// Then poll for results
setTimeout(async () => {
    const events = await axios.get('/api/scraped-events', {
        params: { city: "Denver" }
    });
    console.log(`Found ${events.data.count} events!`);
}, 5000);  // Wait 5 seconds for scraping to start
```

### Backend: Real-Time Processing

When the `/api/discover-events-live` endpoint is called:

1. **Immediately returns** a success response to the frontend
2. **Starts background task** that:
   - Discovers event sources via SerpAPI
   - Scrapes those sources using the scrapling library
   - Extracts structured event data
   - Saves normalized events to disk
   - Logs every step to console

### Console Output (Background Process)

Watch the backend console for real-time progress:

```
======================================================================
📍 EVENT DISCOVERY PIPELINE STARTING
======================================================================
Location: Palo Alto, CA
Storage Key: Palo Alto
Coordinates: (37.4419, -122.1430)
Timestamp: 2026-05-07T15:30:45.123456

======================================================================
📍 STEP 1: Discovering Event Sources for 'Palo Alto, CA'
======================================================================
  🔍 Searching: Government Events...
  ✓ Found 3 sources for Government Events
  🔍 Searching: University Events...
  ✓ Found 5 sources for University Events
  🔍 Searching: Eventbrite...
  ✓ Found 8 sources for Eventbrite
  ...

✅ STEP 1 Complete: Discovered 42 unique event sources
======================================================================

======================================================================
📰 STEP 2: Scraping Event Sources for 'Palo Alto'
======================================================================
Scraping 20 sources for events...
  Scraping: https://www.paloaltoevents.com/... [paloaltoevents.com]
  → 15 events extracted from https://www.paloaltoevents.com/...
  Scraping: https://calendar.paloalto.gov/... [paloalto.gov]
  → 22 events extracted from https://calendar.paloalto.gov/...
  ...

✅ SCRAPING COMPLETE
======================================================================
Events saved for location: Palo Alto
Retrieve with: /api/scraped-events?city=Palo Alto
```

---

## New Services & Components

### 1. **event_discovery_pipeline.py**
Master orchestrator for the 3-step workflow.

```python
from app.services.event_discovery_pipeline import event_discovery_service

# Run complete pipeline
result = await event_discovery_service.run_full_pipeline(
    location="San Francisco, CA",
    latitude=37.7749,
    longitude=-122.4194
)

# Check result
if result["status"] == "success":
    print(f"Step 1: {result['step_1']['source_count']} sources discovered")
    print(f"Step 2: Events being scraped...")
    print(f"Step 3: Organizer info extracted...")
```

**Key Methods:**
- `discover_event_sources(location)` - Step 1: Discover sources
- `scrape_event_sources(sources, location)` - Step 2: Scrape events
- `extract_organizer_info(events)` - Step 3: Extract contacts
- `run_full_pipeline(location, lat, lon)` - Run all 3 steps

### 2. **event_extractor.py**
Extract structured event data from HTML.

```python
from app.services.event_extractor import event_extractor

# Extract events from HTML page
events = event_extractor.extract_from_html(
    html=page_html,
    source_url="https://example.com/events"
)

# Returns normalized event objects with:
# - name, date, time, location, address
# - event_type, description, organizer
# - is_paid, price, expected_attendees
# - url, image, coordinates (lat/lon)
```

**Key Methods:**
- `extract_from_html(html, source_url)` - Extract all events from page
- `_extract_jsonld_events(html, source_url)` - JSON-LD parsing (most reliable)
- `_extract_microdata_events(html, source_url)` - schema.org microdata
- `_extract_pattern_events(html, source_url)` - Common HTML patterns

### 3. **organizer_extractor.py**
Extract organizer contact information.

```python
from app.services.organizer_extractor import organizer_extractor

# Extract from event
organizer = organizer_extractor.extract_organizer_from_event(
    event=event_dict,
    html=event_page_html
)

# Returns:
# {
#     "name": "Palo Alto Parks & Recreation",
#     "type": "Government",
#     "email": "contact@paloalto.gov",
#     "phone": "(650) 329-2100",
#     "website": "https://paloalto.gov",
#     "contact_form": "contact_form_found",
#     "partnership_potential": "high"
# }
```

**Key Methods:**
- `extract_organizer_from_event(event, html)` - Extract from single event
- `extract_organizers_from_html(html, source_url)` - Extract from page
- `_assess_partnership_potential(event, organizer)` - Rate partnership opportunity

---

## API Endpoints

### New Endpoint: `/api/discover-events-live` ⭐

**Real-time event discovery for ANY location, no hardcoded data.**

```
GET /api/discover-events-live?location=Denver,CO&lat=39.7392&lon=-104.9903
```

**Response:**
```json
{
    "status": "success",
    "message": "Event discovery pipeline started for Denver, CO",
    "location": "Denver, CO",
    "city_key": "Denver",
    "note": "Check /api/scraped-events?city=Denver to see discovered events",
    "steps": [
        "Step 1: Discovering event sources...",
        "Step 2: Scraping events...",
        "Step 3: Extracting organizer info..."
    ]
}
```

**Background Process:**
- Runs in background, doesn't block the API
- Updates console with progress
- Saves events to `/backend/data/normalized_events/{city}_events.json`

---

## Existing Endpoints (Unchanged but Enhanced)

### `/api/nearby-venues`
Still works, but now includes scraped events from any location:

```
GET /api/nearby-venues?lat=37.4419&lon=-122.1430&radius=5000&city=Palo Alto
```

**Returns:**
- Eventbrite events (cached)
- Scraped events from discovered sources
- Combined + sorted by distance

### `/api/scraped-events`
Retrieve cached scraped events:

```
GET /api/scraped-events?city=Denver
```

**Returns:**
```json
{
    "status": "success",
    "city": "Denver",
    "count": 47,
    "events": [
        {
            "name": "Cheesman Park Concert",
            "date": "2026-05-10",
            "time": "18:00",
            "address": "1 E 8th Ave, Denver, CO 80203",
            "event_type": "music",
            "organizer": {
                "name": "Denver Parks & Recreation",
                "email": "events@denver.gov"
            },
            ...
        }
    ]
}
```

---

## How It Works (Technical Details)

### 1. Event Source Discovery (Step 1)

Uses 10 targeted SerpAPI searches to cover all event categories:

```python
SEARCH_QUERIES = [
    ("Government Events", "{city} city parks recreation community events calendar"),
    ("University Events", "{city} university campus events calendar"),
    ("Eventbrite", "events near {city} site:eventbrite.com"),
    ("Meetup", "{city} meetup groups events site:meetup.com"),
    ("Venues & Concerts", "{city} concerts shows theater tickets venues"),
    ("Local News", "{city} community events calendar news"),
    ("Business Events", "{city} chamber nonprofit events conference"),
    ("Sports", "{city} 5k race sports tournament events"),
    ("Arts & Culture", "{city} arts festival culture celebration events"),
    ("Tourism", "{city} things to do weekend events activities"),
]
```

**Result:** List of URLs to event pages/calendars

### 2. Event Scraping (Step 2)

For each discovered source, uses a **multi-layer extraction strategy**:

**Layer 1: JSON-LD (Most Reliable)**
```html
<script type="application/ld+json">
{
  "@type": "Event",
  "name": "Concert Night",
  "startDate": "2026-05-15T19:00",
  "location": { "name": "Red Rocks Amphitheatre" },
  "organizer": { "name": "Live Nation" }
}
</script>
```

**Layer 2: Hidden JSON APIs**
- Detects WordPress REST endpoints (`/wp-json/events/...`)
- Custom event APIs (`/api/events`)
- Ticketing system APIs

**Layer 3: HTML Microdata**
```html
<div itemscope itemtype="http://schema.org/Event">
  <span itemprop="name">Concert Night</span>
  <span itemprop="startDate" content="2026-05-15">May 15</span>
</div>
```

**Layer 4: HTML Patterns (Fallback)**
- Looks for elements with `event-*` classes
- Extracts title, date, links
- Best-effort extraction when structured data missing

### 3. Organizer Extraction (Step 3)

For each event, extracts:
- **Name:** From event metadata or page title
- **Type:** Inferred from domain (govt, university, nonprofit, business, platform)
- **Email:** Pattern matching + mail to detection
- **Phone:** Phone pattern extraction
- **Contact Form:** Presence detection
- **Partnership Potential:** Scored based on event type, audience, attendance

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend: User enters location (e.g., "Denver, CO")             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ GET /api/discover-events-live?location=...
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ API: Returns immediately with status                            │
│ Triggers background task                                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
   BACKGROUND TASK       Frontend polls
   ┌──────────────┐      GET /api/scraped-events?city=Denver
   │              │                     │
   │ Step 1       │                     │
   │ SerpAPI      │                     │
   │ Discover     │◄────────────────────┘
   │ Sources      │  Updates every 5s
   │ (42 URLs)    │
   │              │
   │ Step 2       │
   │ Scraping     │
   │ Service      │
   │ (JSON-LD,    │
   │  APIs,       │
   │  Microdata)  │
   │ (47 events)  │
   │              │
   │ Step 3       │
   │ Organizer    │
   │ Extraction   │
   │ (47 org info)│
   │              │
   │ Save to      │
   │ /data/       │
   │ normalized_  │
   │ events/      │
   │ denver_      │
   │ events.json  │
   │              │
   └──────────────┘
        │
        ▼
   Console Output
   (20+ log messages)
```

---

## Configuration

### Required Environment Variables

```env
# .env file
SERP_API_KEY=your_serpapi_key_here      # Required for source discovery
GEOAPIFY_API_KEY=your_geoapify_key      # For location geocoding
EVENTBRITE_PRIVATE_TOKEN=your_token     # For Eventbrite API (optional)
GEMINI_API_KEY=your_gemini_key          # For AI analytics (optional)
WEATHER_API_KEY=your_openweather_key    # For weather data (optional)
```

### File Locations

```
backend/
├── data/
│   ├── cache/                          # SerpAPI source discovery cache
│   ├── normalized_events/              # Final extracted events (by city)
│   │   ├── palo_alto_events.json
│   │   ├── denver_events.json
│   │   └── ...
│   ├── raw_scrapes/                    # Raw HTML from scraped pages (debugging)
│   └── searches/                       # Recent search history
├── app/
│   └── services/
│       ├── event_discovery_pipeline.py ✨ NEW
│       ├── event_extractor.py          ✨ NEW
│       ├── organizer_extractor.py      ✨ NEW
│       ├── scraper_service.py          (enhanced)
│       └── ...
```

---

## Testing

### Test 1: Quick Source Discovery

```bash
cd backend
python -c "
import asyncio
from app.services.event_discovery_pipeline import event_discovery_service

async def test():
    result = await event_discovery_service.discover_event_sources('Denver, CO')
    print(f'Found {result[\"source_count\"]} event sources')
    for category in result['sources_by_category']:
        print(f'  - {category}')

asyncio.run(test())
"
```

### Test 2: Full Pipeline

```bash
curl 'http://localhost:8000/api/discover-events-live?location=Denver,CO'

# Wait 10 seconds for background processing...

curl 'http://localhost:8000/api/scraped-events?city=Denver'
```

### Test 3: Console Monitoring

Run backend and watch console output:

```bash
python -m uvicorn app.main:app --reload --port 8000

# In another terminal:
curl 'http://localhost:8000/api/discover-events-live?location=San Francisco,CA'

# Watch the backend console for:
# - "STEP 1: Discovering Event Sources"
# - "Found X event sources"
# - "STEP 2: Scraping Event Sources"
# - "X events extracted from..."
# - "STEP 3: Extracting Organizer Information"
```

---

## Troubleshooting

### Issue: No events found
**Solution:** 
1. Check that SerpAPI key is valid: `echo $SERP_API_KEY`
2. Verify location is correct (try "San Francisco, CA" instead of "SF")
3. Wait 30+ seconds for scraping to complete (first source might take time)
4. Check `/api/scraped-events?city=YourCity` for cached results

### Issue: Slow performance
**Solution:**
1. Scraping takes time - first run is slower (10-30 seconds)
2. Check console logs for which sources are slow
3. Results are cached - subsequent queries are instant
4. Increase timeout in frontend if needed

### Issue: SerpAPI errors
**Solution:**
1. Verify SERP_API_KEY is set correctly
2. Check API quota usage on SerpAPI dashboard
3. Try different location format ("Denver" vs "Denver, CO" vs "Denver, Colorado")
4. System falls back gracefully if SerpAPI fails

---

## Next Steps / Future Enhancements

1. **Caching Layer:** Cache sources for 7 days (avoid re-scraping same sources)
2. **Event Deduplication:** Detect same event on multiple platforms
3. **Confidence Scoring:** Rate-limit poorly structured sources
4. **Relationship Extraction:** Detect event series/recurring events
5. **NLP Summarization:** Auto-generate event descriptions
6. **Price Monitoring:** Track ticket price changes
7. **Real-Time Alerts:** Notify for high-value events matching restaurant criteria

---

## Summary

✅ **No More Hardcoded Data** - Works with ANY location in the world
✅ **Real-Time Processing** - Scrapes fresh events on demand
✅ **Complete Workflow** - Discovers sources → Scrapes → Extracts organizers
✅ **Proper Logging** - Watch full process in console
✅ **Scalable Architecture** - Background tasks don't block API
✅ **Multiple Extraction Methods** - JSON-LD, APIs, microdata, HTML patterns
✅ **Contact Information** - Automatically extracts organizer details
✅ **Event Categorization** - Classifies events by type
✅ **Partnership Scoring** - Identifies high-value restaurant opportunities

The system is now production-ready and can be deployed for any geographic location without modification!
