import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import {
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  Trophy,
  Music,
  Users,
  PartyPopper,
  Flag,
  Presentation
} from 'lucide-react';

// Decoupled Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import AllEventsView from './components/AllEventsView';
import EventSourcesDashboard from './components/EventSourcesDashboard';
import StoresView from './components/StoresView';
import SettingsView from './components/SettingsView';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || '';

// Predefined list of active store locations
const STORES = [
  {
    id: "bistro",
    name: "Mission Bistro",
    address: "2789 Mission St, San Francisco, CA",
    lat: 37.7523916,
    lon: -122.4183742,
    city: "San Francisco",
    cuisine: "Modern American",
    avgTicket: 38
  },
  {
    id: "cafe",
    name: "Soma Cafe",
    address: "345 Howard St, San Francisco, CA",
    lat: 37.7883921,
    lon: -122.3958114,
    city: "San Francisco",
    cuisine: "Coffee & Bakery",
    avgTicket: 12
  },
  {
    id: "grill",
    name: "Stanford Grill",
    address: "855 El Camino Real, Palo Alto, CA",
    lat: 37.4443293,
    lon: -122.1598465,
    city: "Palo Alto",
    cuisine: "Classic American",
    avgTicket: 45
  }
];

// Weather Signal Icons Mapper
const WEATHER_ICONS = {
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning
};

// Layout Component to share context and orchestrate views
function Layout() {
  const [stores, setStores] = useState(() => {
    const saved = localStorage.getItem('geo_stores');
    return saved ? JSON.parse(saved) : STORES;
  });
  const [currentStore, setCurrentStore] = useState(() => {
    const savedStores = localStorage.getItem('geo_stores');
    const parsedStores = savedStores ? JSON.parse(savedStores) : STORES;
    return parsedStores[2] || parsedStores[0];
  });

  useEffect(() => {
    localStorage.setItem('geo_stores', JSON.stringify(stores));
  }, [stores]);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [venues, setVenues] = useState([]);
  const [radiusMiles, setRadiusMiles] = useState(5); // Slider distance in miles
  const [activeDays, setActiveDays] = useState(15); // Dynamic day-range filter (7, 15, or 30 days)
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPrice, setSelectedPrice] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("");
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);
  const fetchNearbyRef = useRef(null);      // always holds latest fetchNearby
  const scrapedCitiesRef = useRef(new Set()); // tracks cities already scraped this session

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setStoreDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNearby = useCallback(async (lat, lon, city, category = selectedCategory, date = selectedDate, price = selectedPrice, format = selectedFormat, currentRadius = radiusMiles * 1609.34) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/nearby-venues`, {
        params: {
          lat: parseFloat(lat),
          lon: parseFloat(lon),
          radius: currentRadius,
          city: city,
          category: category,
          date_keyword: date,
          price: price,
          format: format
        }
      });
      if (res.data.status === 'success') {
        setVenues(res.data.venues);
      }
    } catch (err) {
      // suppressed to avoid noisy logs during normal app use
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedDate, selectedPrice, selectedFormat, radiusMiles]);

  useEffect(() => {
    if (currentStore) {
      setSelectedEvent(null); // Reset detail view on store switch
      setSelectedPlace({
        name: currentStore.address,
        lat: currentStore.lat,
        lon: currentStore.lon,
        city: currentStore.city
      });
      setSearchQuery(currentStore.address);
      fetchNearby(
        currentStore.lat,
        currentStore.lon,
        currentStore.city,
        selectedCategory,
        selectedDate,
        selectedPrice,
        selectedFormat,
        radiusMiles * 1609.34 // convert miles to meters
      );

      // Trigger background scraping once per city per browser session
      if (currentStore.city && !scrapedCitiesRef.current.has(currentStore.city)) {
        scrapedCitiesRef.current.add(currentStore.city);
        const _lat = currentStore.lat, _lon = currentStore.lon, _city = currentStore.city;
        axios.get(`${API_BASE_URL}/api/event-websites-by-category`, { params: { location: _city, lat: _lat, lon: _lon } })
          .then(() => {
            // Refetch venues at 60s and 120s to pick up newly scraped events
            setTimeout(() => fetchNearbyRef.current?.(_lat, _lon, _city), 60000);
            setTimeout(() => fetchNearbyRef.current?.(_lat, _lon, _city), 120000);
          })
          .catch(() => { });
      }
    }
  }, [currentStore, radiusMiles, selectedCategory, selectedDate, selectedPrice, selectedFormat, fetchNearby]);

  useEffect(() => {
    fetchNearbyRef.current = fetchNearby;
  }, [fetchNearby]);

  const handleSearch = async (e, directTerm = null) => {
    if (e) e.preventDefault();
    const query = directTerm || searchQuery;
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/search`, { params: { text: query } });
      if (res.data.status === 'success' && res.data.results.length > 0) {
        setSearchResults(res.data.results);
        if (res.data.results.length === 1) handleSelect(res.data.results[0]);
      } else {
        setError("No results found.");
      }
    } catch (err) {
      setError("Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (place) => {
    setSelectedPlace(place);
    setSearchResults([]);
    setSearchQuery(place.name);

    // Use clean city name — avoids full-address mismatches in Eventbrite/scraper cache keys
    const cityName = place.city || place.name.split(",")[0].trim();
    fetchNearby(place.lat, place.lon, cityName, selectedCategory, selectedDate, selectedPrice, selectedFormat);

    // Mark city as scraped so the store useEffect doesn't double-trigger
    scrapedCitiesRef.current.add(cityName);
    const _lat = place.lat, _lon = place.lon, _city = cityName;
    axios.get(`${API_BASE_URL}/api/event-websites-by-category`, { params: { location: _city, lat: _lat, lon: _lon } })
      .then(() => {
        setTimeout(() => fetchNearbyRef.current?.(_lat, _lon, _city), 60000);
        setTimeout(() => fetchNearbyRef.current?.(_lat, _lon, _city), 120000);
      })
      .catch(() => {
        // background scraper failure is non-critical; suppress logs for deployment
      });
  };

  // Parse local datetime string (2026-05-09T08:30:00)
  const parseLocalISO = (iso) => {
    if (!iso) return null;
    try {
      const [date, time] = iso.split('T');
      const [y, m, d] = date.split('-').map(Number);
      const [h, min] = (time || '00:00').split(':').map(Number);
      return new Date(y, m - 1, d, h, min);
    } catch { return null; }
  };

  const fmtDate = (iso) => {
    const d = parseLocalISO(iso);
    if (!d) return 'TBA';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const fmtTime = (iso) => {
    const d = parseLocalISO(iso);
    if (!d) return 'TBA';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getCategoryDetails = (cat = "") => {
    const key = (cat || '').toLowerCase().trim();
    
    const config = {
      sports: {
        label: "Sports",
        icon: Trophy,
        colors: "bg-orange-50 border border-orange-100/70 text-orange-600 hover:bg-orange-100/30"
      },
      music: {
        label: "Concert",
        icon: Music,
        colors: "bg-purple-50 border border-purple-100/70 text-purple-600 hover:bg-purple-100/30"
      },
      community: {
        label: "Meetup",
        icon: Users,
        colors: "bg-sky-50 border border-sky-100/70 text-sky-600 hover:bg-sky-100/30"
      },
      food: {
        label: "Celebration",
        icon: PartyPopper,
        colors: "bg-pink-50 border border-pink-100/70 text-pink-600 hover:bg-pink-100/30"
      },
      parade: {
        label: "Parade",
        icon: Flag,
        colors: "bg-amber-50 border border-amber-100/70 text-amber-600 hover:bg-amber-100/30"
      },
      conference: {
        label: "Conference",
        icon: Presentation,
        colors: "bg-indigo-50 border border-indigo-100/70 text-indigo-600 hover:bg-indigo-100/30"
      }
    };

    if (config[key]) {
      return config[key];
    }

    // Secondary categories mappings
    if (key === 'business') {
      return {
        label: "Business",
        icon: Presentation,
        colors: "bg-indigo-50 border border-indigo-100/70 text-indigo-600"
      };
    }
    if (key === 'tech') {
      return {
        label: "Tech",
        icon: Presentation,
        colors: "bg-indigo-50 border border-indigo-100/70 text-indigo-600"
      };
    }
    if (key === 'education' || key === 'science') {
      return {
        label: "Education",
        icon: Presentation,
        colors: "bg-sky-50 border border-sky-100/70 text-sky-600"
      };
    }
    
    // Default fallback
    return {
      label: cat ? (cat.charAt(0).toUpperCase() + cat.slice(1)) : "Event",
      icon: Trophy,
      colors: "bg-slate-50 border border-slate-100 text-slate-600"
    };
  };

  const getCategoryStyles = (cat = "") => {
    return getCategoryDetails(cat).colors;
  };

  // ── Advanced Restaurant-Conversion Scoring Engine ──────────────────────────
  const getMetrics = () => {
    const totalVenues = venues.length;
    let totalCovers = 0;
    let totalLift = 0;
    let highOppCount = 0;

    // Deduplicate by event name + date to avoid inflated counts
    const seenKeys = new Set();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enrichedVenues = venues
      .filter(v => {
        // Strict Quality Rules: Exclude events with missing/TBA names, dates, or venues
        const nameUpper = (v.name || '').toUpperCase().trim();
        if (!v.name || nameUpper === '' || nameUpper === 'UNNAMED EVENT' || nameUpper === 'UNKNOWN EVENT') {
          return false;
        }

        const dateStr = (v.date || '').toUpperCase().trim();
        if (!v.date || dateStr === '' || dateStr === 'TBA' || dateStr.includes('TBA') || dateStr.includes('UNKNOWN')) {
          return false;
        }

        const addrStr = (v.address || '').toUpperCase().trim();
        const venueStr = (v.venue_name || '').toUpperCase().trim();
        const isAddrTBA = !v.address || addrStr === '' || addrStr === 'VENUE TBA' || addrStr.includes('TBA') || addrStr.includes('UNKNOWN');
        const isVenueTBA = !v.venue_name || venueStr === '' || venueStr === 'VENUE TBA' || venueStr.includes('TBA') || venueStr.includes('UNKNOWN');
        
        // If both address and venue are missing or TBA, exclude the event
        if (isAddrTBA && isVenueTBA) {
          return false;
        }

        const key = `${(v.name || '').toLowerCase().trim()}|${(v.date || '').split('T')[0]}`;
        if (seenKeys.has(key)) return false;

        const eventDate = parseLocalISO(v.date);
        if (eventDate) {
          const d1 = new Date(eventDate);
          d1.setHours(0, 0, 0, 0);
          const diffTime = d1 - today;
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          // Keep only if event falls within today up to activeDays (lenient by -1 for timezones)
          if (diffDays < -1 || diffDays > activeDays) {
            return false;
          }
        } else {
          // If the date field was present but failed to parse into a valid Date object, exclude it
          return false;
        }

        seenKeys.add(key);
        return true;
      })
      .map((v, idx) => {
        const rawAttendance = v.attendance !== 'TBA' && v.attendance ? parseInt(v.attendance.toString().replace(/,/g, '')) : 0;
        const attendance = isNaN(rawAttendance) ? 0 : rawAttendance;
        // TBA attendance: use 150 as realistic crowd baseline for scoring (not revenue)
        const scoringAttendance = attendance > 0 ? attendance : 150;
        const classifyCategory = (name, description, category, categoryCleanField) => {
          const text = `${name || ''} ${description || ''} ${category || ''} ${categoryCleanField || ''}`.toLowerCase();

          // 1. Music & Concerts & Arts
          if (/\b(concert|concerts|music|sing|song|songs|symphony|opera|band|bands|orchestra|choir|vocal|guitar|piano|violin|jazz|rock|hiphop|rap|techno|dj|festival|theatre|theater|movie|film|cinema|art|arts|museum|gallery|painting|sculpture|drawing|exhibit|performance|ballet|drama|comedy|play|dance|dancing|choreography)\b/.test(text)) {
            return "music";
          }

          // 2. Sports & Fitness & Athletics
          if (/\b(sport|sports|game|games|match|tournament|championship|cup|race|run|running|5k|10k|marathon|track|jogging|athletics|basketball|soccer|football|baseball|tennis|golf|swimming|pool|gym|workout|fitness|yoga|pilates|aerobics|biking|cycling|hiking|hike|climbing|outdoor|recreation|stadium|arena|billiards|pool)\b/.test(text)) {
            return "sports";
          }

          // 3. Conference & Business & Tech & Education
          if (/\b(conference|seminar|workshop|symposium|summit|lecture|talk|speech|keynote|panel|colloquium|networking|b2b|professional|career|job|expo|fair|convention|academic|science|scientific|technology|tech|ai|software|developer|coding|blockchain|education|educational|school|university|college|student|students|learn|learning|class|classes|course|training|tutorial|medicine|medical|clinic|doctor|nurse|healthcare|hospital|phd|research)\b/.test(text)) {
            return "conference";
          }

          // 4. Food & Dining & Wine
          if (/\b(food|dining|culinary|cooking|bake|baking|recipe|chef|restaurant|cafe|bistro|wine|beer|brewery|tasting|beverage|drink|drinks|cocktail|cocktails|brunch|lunch|dinner|breakfast|supper|feast|banquet|gourmet)\b/.test(text)) {
            return "food";
          }

          // 5. Parade & Festivals & Celebrations
          if (/\b(parade|fest|festival|celebration|anniversary|carnival|fair|gala|ball|party|parties|nightlife|club|disco|pub|bar|happy hour|halloween|christmas|thanksgiving|easter|new year|nye|holiday|holidays)\b/.test(text)) {
            return "parade";
          }

          // 6. Community & Meetup & Social
          if (/\b(community|meetup|gathering|social|club|discussion|forum|circle|meeting|meet|get-together|reunion|neighborhood|volunteer|charity|donation|fundraiser|nonprofit|church|religious|synagogue|mosque|spiritual|worship|senior|seniors|elderly|kids|family|families|parent|parents|youth|teens|camp|crafts|hobbies|library|book|books)\b/.test(text)) {
            return "community";
          }

          // Fallback parsing based on raw fields
          const raw = `${categoryCleanField || category || "community"}`.toLowerCase();
          if (raw.includes('sport')) return 'sports';
          if (raw.includes('music') || raw.includes('concert')) return 'music';
          if (raw.includes('business') || raw.includes('conference') || raw.includes('tech') || raw.includes('education') || raw.includes('science') || raw.includes('academic') || raw.includes('medical') || raw.includes('health') || raw.includes('seminar') || raw.includes('class') || raw.includes('classes')) return 'conference';
          if (raw.includes('food') || raw.includes('culinary') || raw.includes('wine') || raw.includes('beer')) return 'food';
          if (raw.includes('parade') || raw.includes('festival') || raw.includes('party') || raw.includes('celebration')) return 'parade';
          return 'community';
        };

        const categoryClean = classifyCategory(v.name, v.description, v.category, v.categoryClean);

        // ── Distance Calculation ──
        const distanceMeters = v.distance || 0;
        const distanceMiles = distanceMeters > 0 ? (distanceMeters / 1609.34) : null;

        // ── 1. Distance Conversion (exact getDistanceConversion) ──
        let baseConversion = 0.02; // default for >0.5mi and fallback
        if (distanceMiles !== null) {
          if (distanceMiles <= 0.10) {
            baseConversion = 0.20; // 20% conversion within 0.1 mile radius
          } else if (distanceMiles <= 0.25) {
            baseConversion = 0.15; // 15% conversion between 0.1 and 0.25
          } else if (distanceMiles <= 0.40) {
            baseConversion = 0.10; // 10% conversion between 0.24 and 0.40
          } else if (distanceMiles <= 0.50) {
            baseConversion = 0.05; // 5% conversion between 0.40 and 0.50
          }
        }

        // ── Negative Scoring: Food-Included Penalty ──
        // Events that already serve food reduce restaurant opportunity
        const nameLower = (v.name || '').toLowerCase();
        const descLower = (v.description || '').toLowerCase();
        const combined = nameLower + ' ' + descLower;

        let foodPenalty = 0;
        const foodIncludedKeywords = ['catering', 'buffet', 'meal served', 'dinner included', 'lunch provided',
          'food included', 'complimentary meal', 'hosted dinner', 'gala dinner', 'banquet'];
        const restaurantHostedKeywords = ['restaurant event', 'dining event', 'food tasting', 'wine dinner',
          'chef table', 'culinary event', 'food festival', 'cooking class'];

        for (const kw of foodIncludedKeywords) {
          if (combined.includes(kw)) { foodPenalty = -15; break; }
        }
        for (const kw of restaurantHostedKeywords) {
          if (combined.includes(kw)) { foodPenalty = Math.min(foodPenalty, -10); break; }
        }

        // ── 2. Event Type Factor (exact getEventFactor) ──
        let eventFactor = 0.8; // default
        const catLower = categoryClean.toLowerCase();
        if (catLower.includes('conference') || catLower.includes('business') || catLower.includes('tech') || catLower.includes('meetup')) {
          eventFactor = 1.0;
        } else if (catLower.includes('music') || catLower.includes('concert') || catLower.includes('festival') || catLower.includes('entertainment') || catLower.includes('arts')) {
          eventFactor = 0.7;
        } else if (catLower.includes('education') || catLower.includes('academic') || catLower.includes('science') || catLower.includes('school')) {
          eventFactor = 0.8;
        } else if (catLower.includes('sports') || catLower.includes('athletic') || catLower.includes('recreation')) {
          eventFactor = 1.1;
        } else if (catLower.includes('wedding') || catLower.includes('formal') || catLower.includes('party')) {
          eventFactor = 0.5;
        }

        // ── 3. Food Availability Factor (exact getFoodFactor) ──
        const hasFoodFull = foodIncludedKeywords.some(kw => combined.includes(kw));
        const hasFoodSnacks = ['snack', 'refreshment', 'appetizer', 'finger food', 'bites', 'coffee'].some(kw => combined.includes(kw));
        const foodFactor = hasFoodFull ? 0.3 : (hasFoodSnacks ? 0.7 : 1.0);

        // ── 4. Time Factor (exact getTimeFactor) ──
        let timeFactor = 0.7; // default / other
        const dateObj = new Date(v.date);
        const hour = isNaN(dateObj.getTime()) ? 12 : dateObj.getHours(); // fallback to lunch
        if (hour >= 6 && hour < 11) {
          timeFactor = 0.8; // morning
        } else if ((hour >= 11 && hour <= 15) || (hour >= 17 && hour <= 21)) {
          timeFactor = 1.2; // lunch/dinner
        } else if (hour >= 21 || hour < 6) {
          timeFactor = 0.5; // late night
        }

        // ── Positive Scoring: Event Type Intent Multiplier ──
        // How likely are attendees to visit a nearby restaurant?
        let typeScore = 5;
        const highIntentCategories = {
          'sports': 18, 'music': 16, 'conference': 14, 'arts': 13,
          'community': 10, 'education': 9, 'health': 7, 'food': 3
        };
        typeScore = highIntentCategories[categoryClean] || 8;

        // ── Positive Scoring: Audience Type Bonus ──
        let audienceBonus = 0;
        const studentKeywords = ['university', 'college', 'student', 'campus', 'hackathon', 'stanford'];
        const professionalKeywords = ['networking', 'professional', 'corporate', 'business', 'summit'];
        const sportsKeywords = ['game', 'match', 'tournament', 'race', '5k', 'marathon', 'championship'];
        const nightlifeKeywords = ['night', 'late', 'evening', 'after dark', 'pm', 'happy hour', 'bar crawl'];

        if (studentKeywords.some(k => combined.includes(k))) audienceBonus += 8;
        if (professionalKeywords.some(k => combined.includes(k))) audienceBonus += 6;
        if (sportsKeywords.some(k => combined.includes(k))) audienceBonus += 10;
        if (nightlifeKeywords.some(k => combined.includes(k))) audienceBonus += 7;

        // ── Positive Scoring: Timing Bonus ──
        let timingBonus = 0;
        if (v.date) {
          try {
            const eventTime = new Date(v.date);
            const hour = eventTime.getHours();
            // Meal-adjacent timing: lunch (11-13), dinner (17-21), late night (21+)
            if (hour >= 17 && hour <= 21) timingBonus = 10;     // dinner rush
            else if (hour >= 21) timingBonus = 8;                // late night
            else if (hour >= 11 && hour <= 13) timingBonus = 6;  // lunch rush
            else if (hour >= 14 && hour <= 16) timingBonus = 3;  // afternoon
          } catch { }
        }

        // ── Distance Score (closer = much higher) ──
        let distanceScore = 0;
        if (distanceMiles === null) {
          distanceScore = 5;
        } else if (distanceMiles <= 0.10) {
          distanceScore = 25;
        } else if (distanceMiles <= 0.25) {
          distanceScore = 20;
        } else if (distanceMiles <= 0.50) {
          distanceScore = 12;
        } else if (distanceMiles <= 1.0) {
          distanceScore = 6;
        } else {
          distanceScore = 2;
        }

        // ── Attendance Score (uses 150 baseline for TBA events) ──
        let attendanceScore = 5;
        if (scoringAttendance >= 5000) attendanceScore = 25;
        else if (scoringAttendance >= 2000) attendanceScore = 20;
        else if (scoringAttendance >= 1000) attendanceScore = 16;
        else if (scoringAttendance >= 500) attendanceScore = 14;
        else if (scoringAttendance >= 200) attendanceScore = 11;
        else if (scoringAttendance >= 100) attendanceScore = 9;
        else if (scoringAttendance >= 50) attendanceScore = 7;

        // ── Final Score Calculation ──
        let score = distanceScore + attendanceScore + typeScore + audienceBonus + timingBonus + foodPenalty;
        score = Math.min(99, Math.max(20, score));

        // ── 5. Avg Spend & Projections ──
        const avgSpend = 10; // Locked to exactly $10 flat spend as requested
        const effectiveAttendance = attendance > 0 ? attendance : 100; // fallback if missing

        // Overall conversion combines all factors
        const overallConversion = baseConversion * eventFactor * foodFactor * timeFactor;

        const covers = Math.round(effectiveAttendance * overallConversion);
        const lift = Math.round(effectiveAttendance * overallConversion * avgSpend);

        return {
          ...v,
          categoryClean,
          score,
          covers,
          lift,
          convRate: parseFloat((overallConversion * 100).toFixed(1)),
          distanceMiles: distanceMiles !== null ? distanceMiles.toFixed(2) : null,
          rank: idx + 1,
          attendance: attendance > 0 ? attendance : v.attendance
        };
      });

    // Filter enriched venues dynamically by selectedCategory
    const filteredVenues = enrichedVenues.filter(v => selectedCategory === "" || v.categoryClean === selectedCategory);

    // Sum metrics on the filtered list of events
    filteredVenues.forEach(v => {
      totalCovers += v.covers;
      totalLift += v.lift;
      if (v.score >= 50) {
        highOppCount++;
      }
    });

    // Re-rank the filtered list by score descending
    filteredVenues.sort((a, b) => b.score - a.score);
    filteredVenues.forEach((v, i) => v.rank = i + 1);

    return {
      totalEvents: filteredVenues.length,
      projectedLift: totalLift >= 1000 ? `$${(totalLift / 1000).toFixed(1)}k` : `$${totalLift}`,
      extraCovers: totalCovers,
      highOpportunity: highOppCount,
      enrichedVenues: filteredVenues
    };
  };

  // Generate deterministic weather signal for the selected store's city
  const getWeatherSignals = (city = "San Francisco") => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const signals = [];
    const today = new Date();

    const sfWeather = [
      { type: 'Breezy', text: '+ traffic', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: 'CloudSun', temp: [61, 46], rain: 3 },
      { type: 'Sunny', text: '+ traffic', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: 'CloudSun', temp: [64, 48], rain: 0 },
      { type: 'Foggy', text: 'neutral', color: 'text-slate-500 bg-slate-100 border-slate-200', icon: 'Cloud', temp: [58, 48], rain: 5 },
      { type: 'Cloudy', text: 'neutral', color: 'text-slate-500 bg-slate-100 border-slate-200', icon: 'Cloud', temp: [60, 50], rain: 10 },
      { type: 'Rainy', text: '- traffic', color: 'text-rose-600 bg-rose-50 border-rose-100', icon: 'CloudRain', temp: [54, 45], rain: 60 },
      { type: 'Breezy', text: 'neutral', color: 'text-slate-500 bg-slate-100 border-slate-200', icon: 'CloudSun', temp: [62, 47], rain: 2 },
      { type: 'Sunny', text: '+ traffic', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: 'CloudSun', temp: [65, 49], rain: 0 }
    ];

    const paWeather = [
      { type: 'Sunny', text: '+ traffic', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: 'CloudSun', temp: [74, 52], rain: 0 },
      { type: 'Sunny', text: '+ traffic', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: 'CloudSun', temp: [76, 54], rain: 0 },
      { type: 'Clear', text: '+ traffic', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: 'CloudSun', temp: [78, 55], rain: 0 },
      { type: 'Cloudy', text: 'neutral', color: 'text-slate-500 bg-slate-100 border-slate-200', icon: 'Cloud', temp: [70, 50], rain: 12 },
      { type: 'Sunny', text: '+ traffic', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: 'CloudSun', temp: [75, 53], rain: 0 },
      { type: 'Sunny', text: '+ traffic', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: 'CloudSun', temp: [77, 54], rain: 0 },
      { type: 'Clear', text: '+ traffic', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: 'CloudSun', temp: [80, 56], rain: 0 }
    ];

    const weatherList = city.toLowerCase().includes('palo alto') ? paWeather : sfWeather;

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      const dayName = days[d.getDay()];
      const dateStr = `${months[d.getMonth()]} ${d.getDate()}`;
      const w = weatherList[i % weatherList.length];

      signals.push({
        day: dayName,
        date: dateStr,
        ...w
      });
    }
    return signals;
  };

  // Competitor listings for "Nearby Businesses" tab
  const getNearbyBusinesses = (storeId) => {
    const list = {
      bistro: [
        { name: "Taqueria El Farolito", type: "Mexican Restaurant", distance: "0.1 mi", footfall: "High", ticket: "$15", overlap: "Medium" },
        { name: "Foreign Cinema", type: "Mediterranean Dining", distance: "0.3 mi", footfall: "Very High", ticket: "$65", overlap: "Low" },
        { name: "Alamo Drafthouse Cinema", type: "Cinema & Bar", distance: "0.2 mi", footfall: "Extremely High", ticket: "$25", overlap: "High" },
        { name: "Loló", type: "Jaliscan Tapas", distance: "0.4 mi", footfall: "High", ticket: "$40", overlap: "Medium" }
      ],
      cafe: [
        { name: "Sightglass Coffee", type: "Artisanal Coffee", distance: "0.15 mi", footfall: "High", ticket: "$10", overlap: "High" },
        { name: "Blue Bottle Coffee", type: "Premium Espresso", distance: "0.25 mi", footfall: "Medium", ticket: "$12", overlap: "Very High" },
        { name: "Deli Board", type: "Sandwiches & Salads", distance: "0.35 mi", footfall: "Very High", ticket: "$18", overlap: "Medium" },
        { name: "Zero Zero", type: "Neapolitan Pizzeria", distance: "0.4 mi", footfall: "High", ticket: "$30", overlap: "Low" }
      ],
      grill: [
        { name: "Sundance The Steakhouse", type: "Premium Steakhouse", distance: "0.3 mi", footfall: "High", ticket: "$80", overlap: "Low" },
        { name: "Palo Alto Creamery", type: "Classic Diner", distance: "0.2 mi", footfall: "Very High", ticket: "$22", overlap: "High" },
        { name: "Evvia Estiatorio", type: "Hellenic Cuisine", distance: "0.5 mi", footfall: "Extremely High", ticket: "$55", overlap: "Medium" },
        { name: "Tender Greens", type: "Casual Healthy", distance: "0.15 mi", footfall: "High", ticket: "$17", overlap: "Medium" }
      ]
    };
    return list[storeId] || list['bistro'];
  };

  return (
    <div className="flex h-screen w-screen bg-[#f8fafc] text-slate-800 font-sans overflow-hidden">

      {/* Persistent Left Sidebar */}
      <Sidebar />

      {/* Right Content Panel */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Executive Top Header */}
        <Header
          STORES={stores}
          currentStore={currentStore}
          setCurrentStore={setCurrentStore}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          loading={loading}
          handleSearch={handleSearch}
          searchResults={searchResults}
          handleSelect={handleSelect}
          storeDropdownOpen={storeDropdownOpen}
          setStoreDropdownOpen={setStoreDropdownOpen}
          dropdownRef={dropdownRef}
        />

        {/* Dynamic Nested Routes Content with Outlet Context Sharing */}
        <Outlet context={{
          STORES: stores,
          setStores,
          currentStore,
          setCurrentStore,
          selectedEvent,
          setSelectedEvent,
          radiusMiles,
          setRadiusMiles,
          activeDays,
          setActiveDays,
          selectedCategory,
          setSelectedCategory,
          selectedDate,
          setSelectedDate,
          selectedPrice,
          setSelectedPrice,
          selectedFormat,
          setSelectedFormat,
          loading,
          setLoading,
          venues,
          setVenues,
          selectedPlace,
          setSelectedPlace,
          searchQuery,
          setSearchQuery,
          searchResults,
          setSearchResults,
          storeDropdownOpen,
          setStoreDropdownOpen,
          dropdownRef,
          getMetrics,
          getWeatherSignals,
          getNearbyBusinesses,
          WEATHER_ICONS,
          GEOAPIFY_KEY,
          API_BASE_URL,
          fmtDate,
          fmtTime,
          getCategoryStyles,
          getCategoryDetails
        }} />
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardView />} />
          <Route path="events" element={<AllEventsView />} />
          <Route path="event-sources" element={<EventSourcesDashboard />} />
          <Route path="stores" element={<StoresView />} />
          <Route path="settings" element={<SettingsView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
