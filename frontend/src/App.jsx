import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass, Calendar, MapPin, Loader2, Sparkles, Share, ArrowRight } from 'lucide-react';
import L from 'leaflet';

// Components
import { SearchBar, MobileSearchBar } from './components/SearchBar';
import { VenueCard } from './components/VenueCard';

// Custom Icons
const BlueIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const RedIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const YellowIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [35, 57],
  iconAnchor: [17, 57],
  popupAnchor: [1, -50],
  shadowSize: [41, 41]
});

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || '66dd1c0d3fb542ef9d255dedfd3b2a5a';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [venues, setVenues] = useState([]);
  const [radius, setRadius] = useState(5000);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPrice, setSelectedPrice] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("");
  const [error, setError] = useState(null);

  // Default fetch for Palo Alto on mount
  useEffect(() => {
    const defaultPlace = {
      name: "Palo Alto, California, United States of America",
      lat: 37.4443293,
      lon: -122.1598465,
      city: "Palo Alto"
    };
    setSelectedPlace(defaultPlace);
    setSearchQuery("Palo Alto");
    fetchNearby(defaultPlace.lat, defaultPlace.lon, defaultPlace.city, "", "", "", "");
  }, []);

  const fetchNearby = async (lat, lon, city, category = selectedCategory, date = selectedDate, price = selectedPrice, format = selectedFormat, currentRadius = radius) => {
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
      } else { setError("No results found."); }
    } catch (err) { setError("Search failed."); }
    finally { setLoading(false); }
  };

  const handleSelect = (place) => {
    setSelectedPlace(place);
    setSearchResults([]);
    setSearchQuery(place.name);
    fetchNearby(place.lat, place.lon, place.city || place.name.split(',')[0], selectedCategory, selectedDate, selectedPrice, selectedFormat);
  };

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Executive Header */}
      <header className="h-16 border-b border-slate-100 flex items-center justify-between px-8 shrink-0 bg-white/80 backdrop-blur-xl z-[1001]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg shadow-slate-100">
                <Compass size={18} strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight">GeoEvents</span>
          </div>
          
          <div className="h-8 w-px bg-slate-100 hidden md:block"></div>
          
          <div className="hidden md:block">
            <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearch={handleSearch} loading={loading} />
          </div>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Network Live</span>
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden">
        
        {/* Left: Intelligence Sidebar (Professional Filters) */}
        <aside className="w-72 border-r border-slate-100 p-6 flex flex-col gap-6 bg-slate-50/50 shrink-0 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Filters</h2>
                <button 
                    onClick={() => {
                        setSelectedCategory("");
                        setSelectedDate("");
                        setSelectedPrice("");
                        setSelectedFormat("");
                        if (selectedPlace) fetchNearby(selectedPlace.lat, selectedPlace.lon, selectedPlace.city, "", "", "", "");
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                >
                    Reset
                </button>
            </div>

            {/* Sports & Fitness Expanded */}
            <div className="space-y-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Categories</p>
                <div className="space-y-1">
                    {[
                        { id: "", label: "All Events" },
                        { id: "sports-and-fitness", label: "Sports & Fitness" },
                        { id: "music", label: "Music" },
                        { id: "business", label: "Business" },
                        { id: "food-and-drink", label: "Food & Drink" },
                        { id: "charity-and-causes", label: "Community" }
                    ].map(cat => (
                        <button 
                            key={cat.id}
                            onClick={() => {
                                setSelectedCategory(cat.id);
                                if (selectedPlace) fetchNearby(selectedPlace.lat, selectedPlace.lon, selectedPlace.city, cat.id, selectedDate, selectedPrice, selectedFormat);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-[13px] transition-all ${selectedCategory === cat.id ? 'bg-white text-indigo-600 font-bold shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sports & Fitness Sub-categories */}
            {selectedCategory === "sports-and-fitness" && (
                <div className="pt-4 border-t border-slate-200/50">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Sports Sub-types</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar-mini">
                        {[
                            "Running", "Walking", "Cycling", "Mountain Biking", "Obstacles", 
                            "Basketball", "Football", "Baseball", "Soccer", "Golf", 
                            "Volleyball", "Tennis", "Swimming", "Hockey", "Motorsports", 
                            "Martial Arts", "Snow Sports", "Rugby", "Yoga", "Exercise", 
                            "Softball", "Wrestling", "Lacrosse", "Cheer", "Camps", "Weightlifting"
                        ].map(sub => (
                            <label key={sub} className="flex items-center gap-3 group cursor-pointer">
                                <div className="w-5 h-5 rounded border-2 border-slate-200 flex items-center justify-center group-hover:border-indigo-300 transition-colors">
                                    <div className="w-2.5 h-2.5 rounded-sm bg-indigo-600 scale-0 transition-transform duration-200 group-active:scale-100"></div>
                                </div>
                                <span className="text-[13px] text-slate-500 group-hover:text-slate-900">{sub}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <div className="pt-4 border-t border-slate-200/50">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Date</p>
                <div className="space-y-3">
                    {[
                        { id: "", label: "Any Date" },
                        { id: "today", label: "Today" },
                        { id: "tomorrow", label: "Tomorrow" },
                        { id: "this-weekend", label: "This Weekend" }
                    ].map(date => (
                        <label key={date.id} className="flex items-center gap-3 group cursor-pointer">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedDate === date.id ? 'border-indigo-600 bg-indigo-600' : 'border-slate-200 group-hover:border-slate-300'}`}>
                                {selectedDate === date.id && <div className="w-2 h-2 rounded-full bg-white animate-in zoom-in-50 duration-300"></div>}
                            </div>
                            <input 
                                type="radio" 
                                name="date" 
                                className="hidden" 
                                checked={selectedDate === date.id}
                                onChange={() => {
                                    setSelectedDate(date.id);
                                    if (selectedPlace) fetchNearby(selectedPlace.lat, selectedPlace.lon, selectedPlace.city, selectedCategory, date.id, selectedPrice, selectedFormat);
                                }}
                            />
                            <span className={`text-[13px] transition-colors ${selectedDate === date.id ? 'text-slate-900 font-bold' : 'text-slate-500 group-hover:text-slate-900'}`}>{date.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="pt-4 border-t border-slate-200/50">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Price</p>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                    {["", "Free", "Paid"].map(p => (
                        <button 
                            key={p} 
                            onClick={() => {
                                setSelectedPrice(p);
                                if (selectedPlace) fetchNearby(selectedPlace.lat, selectedPlace.lon, selectedPlace.city, selectedCategory, selectedDate, p, selectedFormat);
                            }}
                            className={`py-1.5 rounded-lg text-[11px] font-bold transition-all ${selectedPrice === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {p || "All"}
                        </button>
                    ))}
                </div>
            </div>

            <div className="pt-4 border-t border-slate-200/50">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Format</p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar-mini">
                    {[
                        "Class", "Conference", "Festival", "Party", "Appearance", 
                        "Attraction", "Convention", "Expo", "Gala", "Game", 
                        "Networking", "Performance", "Race", "Rally", "Retreat", 
                        "Screening", "Seminar", "Tournament", "Tour"
                    ].map(f => (
                        <label 
                            key={f}
                            onClick={() => {
                                const val = f.toLowerCase();
                                setSelectedFormat(selectedFormat === val ? "" : val);
                                if (selectedPlace) fetchNearby(selectedPlace.lat, selectedPlace.lon, selectedPlace.city, selectedCategory, selectedDate, selectedPrice, selectedFormat === val ? "" : val);
                            }}
                            className="flex items-center gap-3 group cursor-pointer"
                        >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedFormat === f.toLowerCase() ? 'border-indigo-600 bg-indigo-600' : 'border-slate-200 group-hover:border-slate-300'}`}>
                                {selectedFormat === f.toLowerCase() && (
                                    <div className="text-white">
                                        <svg size={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </div>
                                )}
                            </div>
                            <span className={`text-[13px] transition-colors ${selectedFormat === f.toLowerCase() ? 'text-slate-900 font-bold' : 'text-slate-500 group-hover:text-slate-900'}`}>{f}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="pt-4 border-t border-slate-200/50 pb-8">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Neighborhood</p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar-mini">
                    {[
                        "Renaissance", "Lindenwood", "Downtown San Mateo", "Sunnyvale East", 
                        "Santana Row", "Lawrence", "Willow Glen", "Newhall", 
                        "Charleston Terrace", "Cherry Orchard", "Downtown Sunnyvale", 
                        "Central", "Valley Fair", "San José Golf Course", "Adobe Corner", 
                        "Emerald Hills", "Japantown", "Ardenwood", "Central-Downtown", 
                        "Tennyson/Alquire", "Southgate", "Downtown Campbell", "Hamilton", 
                        "Ampex", "Centennial", "Dolphin"
                    ].map(n => (
                        <label key={n} className="flex items-center gap-3 group cursor-pointer">
                            <div className="w-5 h-5 rounded border-2 border-slate-200 flex items-center justify-center group-hover:border-indigo-300 transition-colors">
                                <div className="w-2.5 h-2.5 rounded-sm bg-indigo-600 scale-0 transition-transform duration-200 group-active:scale-100"></div>
                            </div>
                            <span className="text-[13px] text-slate-500 group-hover:text-slate-900">{n}</span>
                        </label>
                    ))}
                </div>
            </div>
        </aside>

        {/* Center: Event Stream (Narrower for focus) */}
        <section className="flex-1 max-w-3xl flex flex-col bg-white overflow-hidden border-r border-slate-100">
            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between shrink-0">
                <div className="flex flex-col gap-0.5">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Nearby Events</h2>
                    <p className="text-[11px] text-slate-400 font-medium">Real-time activity near {selectedPlace?.city || "your location"}</p>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                    {[
                        { label: '2km', value: 2000 },
                        { label: '5km', value: 5000 },
                        { label: '10km', value: 10000 },
                        { label: '20km', value: 20000 }
                    ].map((range) => (
                        <button
                            key={range.value}
                            onClick={() => {
                                setRadius(range.value);
                                if (selectedPlace) fetchNearby(selectedPlace.lat, selectedPlace.lon, selectedPlace.city, selectedCategory, selectedDate, range.value);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                radius === range.value 
                                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 custom-scrollbar pb-32 bg-slate-50/30">
                <MobileSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearch={handleSearch} />

                {/* Suggestions */}
                {searchResults.length > 1 && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden mb-6 animate-in fade-in slide-in-from-top-2">
                        <div className="p-3 bg-slate-50/50 border-b border-slate-100"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Location Suggestions</p></div>
                        <div className="max-h-[200px] overflow-y-auto">
                            {searchResults.map((res, i) => (
                                <button key={i} onClick={() => handleSelect(res)} className="w-full text-left p-3 hover:bg-slate-50 transition-all border-b border-slate-50 last:border-0 flex gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><MapPin size={12} /></div>
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-bold text-slate-900 truncate">{res.name}</p>
                                        <p className="text-[10px] text-slate-400 truncate">{res.address}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {venues.length > 0 ? (
                    venues.map((v, i) => <VenueCard key={i} venue={v} />)
                ) : loading ? (
                    <div className="space-y-6">
                        {[1, 2].map(i => (
                            <div key={i} className="bg-white rounded-3xl p-6 border border-slate-100 flex gap-6 animate-pulse">
                                <div className="w-48 h-48 bg-slate-50 rounded-2xl shrink-0"></div>
                                <div className="flex-1 space-y-4 pt-2">
                                    <div className="h-3 w-1/4 bg-slate-50 rounded-full"></div>
                                    <div className="h-6 w-3/4 bg-slate-50 rounded-full"></div>
                                    <div className="h-12 w-full bg-slate-50 rounded-2xl"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-96 flex flex-col items-center justify-center bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-100 text-slate-300">
                        <Compass size={48} strokeWidth={1} className="mb-4 opacity-50" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">No results found</p>
                    </div>
                )}
            </div>
        </section>

        {/* Right: Map Intelligence (Wider & Bordered) */}
        <section className="flex-1 min-w-[500px] p-6 bg-slate-50 shrink-0 overflow-hidden hidden xl:block">
            <div className="w-full h-full rounded-[2.5rem] overflow-hidden border-8 border-white shadow-[0_20px_50px_rgba(0,0,0,0.05)] relative bg-white">
                <MapContainer center={selectedPlace ? [selectedPlace.lat, selectedPlace.lon] : [37.444, -122.159]} zoom={13} className="w-full h-full" zoomControl={false}>
                  <TileLayer url={`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`} />
                  <ZoomControl position="bottomright" />
                  
                  {selectedPlace && (
                    <>
                      <Marker position={[selectedPlace.lat, selectedPlace.lon]} icon={YellowIcon}>
                        <Popup closeButton={false}>
                          <div className="p-2 text-center min-w-[150px]">
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Target Business</p>
                            <p className="text-xs font-black text-slate-800 leading-tight">{selectedPlace.name}</p>
                          </div>
                        </Popup>
                      </Marker>
                      <Circle center={[selectedPlace.lat, selectedPlace.lon]} radius={radius} pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.05, weight: 1 }} interactive={false} />
                      {venues.map((v, i) => (
                        <Marker key={i} position={[v.lat, v.lon]} icon={BlueIcon}>
                          <Popup closeButton={false}>
                            <div className="p-1 min-w-[120px]">
                              <p className="font-bold text-slate-800 text-xs mb-1">{v.name}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-slate-100 text-slate-500">{v.type || 'Venue'}</span>
                                <span className="text-[8px] font-bold text-indigo-600">{(v.distance / 1000).toFixed(1)}km</span>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                      <MapUpdater center={selectedPlace ? [selectedPlace.lat, selectedPlace.lon] : [37.444, -122.159]} />
                    </>
                  )}
                </MapContainer>
            </div>
        </section>
      </main>
    </div>
  );
}

export default App;
