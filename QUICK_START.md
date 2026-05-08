# Quick Start Guide - Event Discovery System

## 🚀 Get Started in 3 Steps

### Step 1: Make Sure Everything is Configured

```bash
# Check .env file has SerpAPI key
cat backend/.env | grep SERP_API_KEY

# Should output: SERP_API_KEY=your_key_here (not empty!)
```

### Step 2: Start the Backend

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000

# You should see output like:
# INFO:     Uvicorn running on http://0.0.0.0:8000
# INFO:     Application startup complete
```

### Step 3: Test the Event Discovery

**In a new terminal:**

```bash
# Test: Discover events in any city
curl "http://localhost:8000/api/discover-events-live?location=Denver,Colorado"

# Response:
# {
#     "status": "success",
#     "message": "Event discovery pipeline started for Denver, Colorado",
#     "city_key": "Denver"
# }
```

**Watch the backend console** for real-time progress:

```
📍 STEP 1: Discovering Event Sources for 'Denver, Colorado'
  🔍 Searching: Government Events...
  ✓ Found 3 sources
  🔍 Searching: University Events...
  ✓ Found 5 sources
  ... (continues)
✅ STEP 1 Complete: Discovered 37 sources

📰 STEP 2: Scraping Event Sources
  Scraping: https://... [domain.com]
  → 15 events extracted
  ... (continues)
✅ STEP 2 Complete: 47 events extracted

👥 STEP 3: Extracting Organizer Information
✅ STEP 3 Complete: 47 organizer infos extracted
```

**Wait 15-30 seconds** for processing to complete, then retrieve results:

```bash
# Get the discovered events
curl "http://localhost:8000/api/scraped-events?city=Denver"

# Response: List of 47 events with full details
```

---

## 📊 What You'll Get

Each event includes:

```json
{
    "name": "Concert Night",
    "date": "2026-05-15",
    "time": "19:00",
    "location_name": "Red Rocks Amphitheatre",
    "address": "18300 W Alameda Parkway, Morrison, CO 80465",
    "event_type": "music",
    "organizer": {
        "name": "Red Rocks Presents",
        "type": "Venue",
        "email": "info@redrocksonline.com",
        "phone": "(303) 295-4444",
        "partnership_potential": "high"
    }
}
```

---

## 🎯 Try Different Locations

```bash
# San Francisco
curl "http://localhost:8000/api/discover-events-live?location=San%20Francisco,California"

# New York
curl "http://localhost:8000/api/discover-events-live?location=New%20York,NY"

# London, England
curl "http://localhost:8000/api/discover-events-live?location=London,England"

# Mumbai, India
curl "http://localhost:8000/api/discover-events-live?location=Mumbai,India"

# Any location in the world!
```

---

## 🔄 How the System Works

```
User searches for location
    ↓
Frontend calls: /api/discover-events-live
    ↓
API returns immediately (non-blocking)
    ↓
Backend starts background task:
    Step 1: SerpAPI discovers event websites (5-10s)
    Step 2: Scraper extracts events (10-60s)
    Step 3: Organizer info extracted (automatic)
    ↓
Events saved to disk
    ↓
Frontend polls: /api/scraped-events?city=...
    ↓
Display updated event list to user
```

---

## 📁 Key Files

**New Services (Complete Event Pipeline):**
- `backend/app/services/event_discovery_pipeline.py` - Master orchestrator
- `backend/app/services/event_extractor.py` - Extract event data from HTML
- `backend/app/services/organizer_extractor.py` - Extract contact info

**API Integration:**
- `backend/app/main.py` - Added `/api/discover-events-live` endpoint

**Documentation:**
- `EVENT_DISCOVERY_README.md` - Complete technical guide
- `IMPLEMENTATION_SUMMARY.md` - What changed & why
- `QUICK_START_GUIDE.md` - This file

---

## ✅ Troubleshooting

### Issue: "No events found"
```bash
# 1. Verify SerpAPI key is set
echo $SERP_API_KEY

# 2. Wait longer (first run takes 30+ seconds)
# 3. Check different location format
curl "http://localhost:8000/api/discover-events-live?location=San%20Francisco,CA"

# 4. Check console for error messages
```

### Issue: "SerpAPI error"
```bash
# Verify your SerpAPI key at: https://serpapi.com
# Make sure you have API quota available
# Try again in 5 seconds (rate limiting)
```

### Issue: "Backend won't start"
```bash
# Check Python version (3.8+)
python --version

# Check all imports work
python -c "from app.main import app; print('OK')"

# Check dependencies installed
pip install -r requirements.txt
```

---

## 🎓 Learn More

- **Full Technical Guide:** Read `EVENT_DISCOVERY_README.md`
- **What Changed:** See `IMPLEMENTATION_SUMMARY.md`
- **Implementation Details:** Check docstrings in service files

---

## 🚦 Ready to Use?

Your event discovery system is ready to go! Start with:

```bash
# Terminal 1: Start backend
cd backend && python -m uvicorn app.main:app --reload --port 8000

# Terminal 2: Test discovery
curl "http://localhost:8000/api/discover-events-live?location=YourCity,State"

# Terminal 3: Get results (wait 30s)
curl "http://localhost:8000/api/scraped-events?city=YourCity"
```

**The system works with ANY location worldwide - no hardcoded data!**

---

## 🎉 Key Features

✅ Works with **ANY location** (no hardcoded cities)
✅ **Real-time scraping** (no pre-cached data)
✅ **Complete 3-step workflow** (discover → scrape → extract organizers)
✅ **Proper logging** (watch progress in console)
✅ **Non-blocking API** (background tasks)
✅ **Contact information** (organizer extraction)
✅ **Event categorization** (automatic type detection)
✅ **Partnership scoring** (for restaurant owners)

Enjoy!
