import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass, Calendar, MapPin, Loader2, Sparkles } from 'lucide-react';
import L from 'leaflet';

// Icons Fix
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Components
import { SearchBar, MobileSearchBar } from './components/SearchBar';
import { VenueCard } from './components/VenueCard';
import { BusinessDashboard } from './components/BusinessDashboard';

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

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
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
  const [radius, setRadius] = useState(1000);
  const [error, setError] = useState(null);

  // New AI Analytics State
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const fetchNearby = async (lat, lon) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/nearby-venues`, {
        params: { lat: parseFloat(lat), lon: parseFloat(lon), radius: radius }
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

  const fetchAIAnalytics = async (place) => {
    setAnalyticsLoading(true);
    setAnalytics(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/analytics`, {
        params: { store_name: place.name, lat: place.lat, lon: place.lon }
      });
      if (res.data.status === 'success') {
        setAnalytics(res.data.analytics);
      }
    } catch (err) {
      console.error("Gemini AI Error:", err);
    } finally {
      setAnalyticsLoading(false);
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
    fetchNearby(place.lat, place.lon);
    fetchAIAnalytics(place); // Trigger AI Analysis
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 border-b border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between z-[1001] shadow-sm">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="bg-primary-600 p-2 rounded-xl text-white shadow-lg shadow-primary-200">
            <Compass size={22} strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">Geo<span className="text-primary-600">Events</span></span>
        </div>

        <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearch={handleSearch} loading={loading} />

        <div className="hidden md:flex items-center gap-3">
          {/* <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">System Status</span>
            <span className="text-[10px] font-bold text-primary-600 flex items-center gap-1 mt-1">
              <Sparkles size={10} className="animate-pulse" />
              AI ENGINE: ACTIVE (v3.0)
            </span>
          </div> */}
        </div>
      </header>

      {/* Main Container - Scrollable */}
      <div className="flex-1 overflow-y-auto w-full max-w-[1600px] mx-auto p-4 lg:p-6 space-y-6">

        {/* Top Grid: Sidebar + Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-h-[500px] lg:h-[calc(100vh-140px)]">

          {/* Sidebar */}
          <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden h-full">
            <MobileSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearch={handleSearch} />

            {/* Suggestions */}
            {searchResults.length > 1 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden shrink-0">
                <div className="p-2 bg-slate-50 border-b border-slate-100"><p className="text-[10px] font-bold text-slate-400 uppercase ml-2">Suggestions</p></div>
                <div className="max-h-[200px] overflow-y-auto">
                  {searchResults.map((res, i) => (
                    <button key={i} onClick={() => handleSelect(res)} className="w-full text-left p-3 hover:bg-primary-50 transition-colors border-b last:border-0 flex gap-2">
                      <MapPin size={14} className="mt-1 text-primary-500" />
                      <div className="overflow-hidden">
                        <p className="text-sm font-bold truncate">{res.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{res.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Info Card */}
            {selectedPlace && (
              <div className="bg-gradient-to-br from-white to-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                <div className="flex gap-1.5 items-center mb-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Analysis Target</p>
                </div>
                <h2 className="text-lg font-bold leading-tight line-clamp-2 text-slate-800">{selectedPlace.name}</h2>
                <div className="mt-3 py-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[10px] font-medium text-slate-500 flex items-center gap-1"><MapPin size={12} /> {radius / 1000}km Radius</div>
                  <div className="text-[10px] font-bold text-primary-600 bg-white px-2 py-0.5 rounded-full border border-slate-100">{venues.length} results</div>
                </div>
              </div>
            )}

            {/* List */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col min-h-[300px]">
              <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <Calendar size={16} className="text-primary-600" />
                <h3 className="text-sm font-bold">Local Event Landscape</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {venues.length > 0 ? (
                  venues.map((v, i) => <VenueCard key={i} venue={v} />)
                ) : loading ? (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 flex flex-col gap-3">
                        <div className="flex justify-between">
                          <div className="h-4 w-32 bg-slate-200 rounded-full animate-pulse"></div>
                          <div className="h-3 w-8 bg-slate-200 rounded-full animate-pulse"></div>
                        </div>
                        <div className="h-3 w-48 bg-slate-200/60 rounded-full animate-pulse"></div>
                        <div className="flex justify-between items-center mt-1">
                          <div className="h-5 w-16 bg-slate-200 rounded-full animate-pulse"></div>
                          <div className="h-2 w-10 bg-slate-100 rounded-full animate-pulse"></div>
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-col items-center gap-2 mt-4 opacity-50">
                      <Loader2 className="animate-spin text-primary-500" size={16} />
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Synchronizing Local Data</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 opacity-40">
                    <Compass size={32} className="mb-2 text-slate-300" />
                    <p className="text-xs font-semibold uppercase tracking-widest text-center">Search for a location to begin business mapping</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-8 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl relative min-h-[400px]">
            {analyticsLoading && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1002] animate-in fade-in zoom-in duration-500">
                <div className="bg-slate-900/90 backdrop-blur-xl text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl border border-white/10">
                  <div className="relative">
                    <div className="w-4 h-4 rounded-full border-2 border-primary-500/20 border-t-primary-500 animate-spin"></div>
                    <Sparkles className="absolute inset-0 m-auto text-primary-400" size={8} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">Scanning for nearest event</span>
                </div>
              </div>
            )}
            {/* Removed the Initiate System overlay */}
            <MapContainer center={selectedPlace ? [selectedPlace.lat, selectedPlace.lon] : [37.444, -122.159]} zoom={13} className="w-full h-full" zoomControl={false}>
              <TileLayer url={`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`} />
              <ZoomControl position="bottomright" />
              <MapController center={selectedPlace ? [selectedPlace.lat, selectedPlace.lon] : null} zoom={15} />
              {selectedPlace && (
                <>
                  <Marker
                    position={[selectedPlace.lat, selectedPlace.lon]}
                    icon={YellowIcon}
                    eventHandlers={{
                      mouseover: (e) => e.target.openPopup(),
                      mouseout: (e) => e.target.closePopup(),
                      click: () => {
                        const section = document.getElementById('analytics-section');
                        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                  >
                    <Popup closeButton={false} autoPan={true}>
                      <div className="p-2 text-center min-w-[150px]">
                        <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-1">Target Business</p>
                        <p className="text-xs font-black text-slate-800 leading-tight">{selectedPlace.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Click to view deep analytics</p>
                      </div>
                    </Popup>
                  </Marker>
                  <Circle center={[selectedPlace.lat, selectedPlace.lon]} radius={radius} pathOptions={{ color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.1, weight: 2 }} interactive={false} />
                  {venues.map((v, i) => (
                    <Marker key={i} position={[v.lat, v.lon]} icon={v.is_dummy ? RedIcon : BlueIcon} eventHandlers={{ mouseover: (e) => e.target.openPopup(), mouseout: (e) => e.target.closePopup() }}>
                      <Popup closeButton={false} autoPan={false}>
                        <div className="font-sans min-w-[120px]">
                          <p className="font-bold text-slate-800 text-xs leading-tight mb-1">{v.name}</p>
                          <div className="flex items-center justify-between">
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${v.is_dummy ? 'bg-red-100 text-red-600' : 'bg-primary-100 text-primary-600'}`}>{v.type || 'Venue'}</span>
                            <span className="text-[8px] font-bold text-slate-400">{(v.distance / 1000).toFixed(1)}km</span>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </>
              )}
            </MapContainer>
          </div>
        </div>

        {/* AI Analysis Section */}
        {selectedPlace && (
          <div id="analytics-section">
            <BusinessDashboard data={analytics} loading={analyticsLoading} />
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
