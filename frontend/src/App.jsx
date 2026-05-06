import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import {
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning
} from 'lucide-react';

// Decoupled Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import AllEventsView from './components/AllEventsView';
import EventSourcesDashboard from './components/EventSourcesDashboard';
import StoresView from './components/StoresView';
import SettingsView from './components/SettingsView';

const API_BASE_URL = 'http://127.0.0.1:8000';
const GEOAPIFY_KEY = '66dd1c0d3fb542ef9d255dedfd3b2a5a';

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
  const [currentStore, setCurrentStore] = useState(STORES[2]); // Defaults to Stanford Grill (Palo Alto)
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [venues, setVenues] = useState([]);
  const [radiusMiles, setRadiusMiles] = useState(5); // Slider distance in miles
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPrice, setSelectedPrice] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("");
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);

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

  // Update selected place and fetch events on store switch
  useEffect(() => {
    if (currentStore) {
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
    }
  }, [currentStore, radiusMiles, selectedCategory, selectedDate, selectedPrice, selectedFormat]);

  const fetchNearby = async (lat, lon, city, category = selectedCategory, date = selectedDate, price = selectedPrice, format = selectedFormat, currentRadius = radiusMiles * 1609.34) => {
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
      console.error("Fetch Venues Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/search`, { params: { text: searchQuery } });
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
    fetchNearby(place.lat, place.lon, place.city || place.name.split(',')[0], selectedCategory, selectedDate, selectedPrice, selectedFormat);
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

  const getCategoryStyles = (cat = "") => {
    const styles = {
      sports: 'bg-orange-50 border border-orange-100 text-orange-600',
      music: 'bg-purple-50 border border-purple-100 text-purple-600',
      food: 'bg-yellow-50 border border-yellow-100 text-yellow-700',
      conference: 'bg-blue-50 border border-blue-100 text-blue-700',
      business: 'bg-blue-50 border border-blue-100 text-blue-700',
      community: 'bg-green-50 border border-green-100 text-green-700',
      parade: 'bg-amber-50 border border-amber-100 text-amber-600'
    };
    return styles[cat.toLowerCase()] || 'bg-slate-50 border border-slate-100 text-slate-600';
  };

  // Generate dynamic Metrics based on loaded events list
  const getMetrics = () => {
    const totalVenues = venues.length;
    let totalCovers = 0;
    let totalLift = 0;
    let highOppCount = 0;

    const enrichedVenues = venues.map((v, idx) => {
      const attendance = v.attendance !== 'TBA' ? parseInt(v.attendance) : 250;
      let conversionRate = 0.012; // default
      let categoryClean = v.category || "community";

      if (categoryClean.includes('sport')) {
        conversionRate = 0.015;
        categoryClean = 'sports';
      } else if (categoryClean.includes('music') || categoryClean.includes('concert')) {
        conversionRate = 0.020;
        categoryClean = 'music';
      } else if (categoryClean.includes('business') || categoryClean.includes('conference')) {
        conversionRate = 0.010;
        categoryClean = 'conference';
      }

      const distanceKm = v.distance ? (v.distance / 1000) : 1;
      const distanceFactor = Math.max(0.2, 1 - (distanceKm / 10));

      const covers = Math.round(attendance * conversionRate * distanceFactor);
      const lift = Math.round(covers * (currentStore?.avgTicket || 38));

      totalCovers += covers;
      totalLift += lift;

      // Score calculation
      let score = 50;
      if (attendance > 1000) score += 20;
      else if (attendance > 500) score += 12;
      else if (attendance > 100) score += 5;

      if (distanceKm < 1) score += 20;
      else if (distanceKm < 3) score += 12;
      else if (distanceKm < 5) score += 5;

      if (categoryClean === 'sports' || categoryClean === 'music') score += 10;

      score = Math.min(100, Math.max(40, score));

      if (score >= 60) highOppCount++;

      return {
        ...v,
        categoryClean,
        score,
        covers,
        lift,
        rank: idx + 1
      };
    });

    return {
      totalEvents: totalVenues,
      projectedLift: totalLift > 0 ? `$${(totalLift / 1000).toFixed(1)}k` : "$14.4k",
      extraCovers: totalCovers > 0 ? totalCovers : 378,
      highOpportunity: highOppCount > 0 ? highOppCount : 1,
      enrichedVenues
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
      <style>{`
        * {
          font-family: Arial, Helvetica, sans-serif !important;
        }
      `}</style>
      {/* Persistent Left Sidebar */}
      <Sidebar />

      {/* Right Content Panel */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Executive Top Header */}
        <Header
          STORES={STORES}
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
          STORES,
          currentStore,
          setCurrentStore,
          radiusMiles,
          setRadiusMiles,
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
          getCategoryStyles
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
