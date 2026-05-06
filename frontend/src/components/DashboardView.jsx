import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Calendar,
  Store,
  DollarSign,
  Users,
  Sparkles,
  CloudSun,
  Info,
  MapPin,
  TrendingUp,
  Loader2,
  ChevronRight,
  Compass
} from 'lucide-react';

// Custom Icons for Leaflet
const BlueIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
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

// Import the generative business analytics component
import { BusinessDashboard } from './BusinessDashboard';

export default function DashboardView() {
  const {
    currentStore,
    radiusMiles,
    setRadiusMiles,
    selectedCategory,
    setSelectedCategory,
    venues,
    loading,
    selectedPlace,
    getMetrics,
    getWeatherSignals,
    getNearbyBusinesses,
    WEATHER_ICONS,
    GEOAPIFY_KEY,
    API_BASE_URL,
    fmtDate,
    fmtTime,
    getCategoryStyles
  } = useOutletContext();

  const [dashboardTab, setDashboardTab] = useState('events');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [realWeather, setRealWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(null);

  // Manual trigger for fetching AI business impact analytics from backend
  const fetchAIAnalytics = () => {
    if (!currentStore) return;
    setAnalyticsLoading(true);
    axios.get(`${API_BASE_URL}/api/analytics`, {
      params: {
        store_name: currentStore.name,
        lat: currentStore.lat,
        lon: currentStore.lon
      }
    })
      .then(res => {
        if (res.data.status === 'success') {
          setAnalyticsData(res.data.analytics);
        }
      })
      .catch(err => {
        console.error("AI Analytics API Error:", err);
        // Set an error payload so BusinessDashboard can render a Retry/Error interface
        setAnalyticsData({
          error: "AI analysis failed",
          summary: "The generative AI models are currently busy or unavailable. Please retry shortly."
        });
      })
      .finally(() => {
        setAnalyticsLoading(false);
      });
  };

  useEffect(() => {
    setAnalyticsData(null);
    setAnalyticsLoading(false);
    setRealWeather(null);
    setWeatherError(null);
  }, [currentStore]);

  useEffect(() => {
    if (!currentStore?.lat || !currentStore?.lon) return;
    axios.get(`${API_BASE_URL}/api/weather`, {
      params: {
        lat: parseFloat(currentStore.lat) + 0.0001,
        lon: parseFloat(currentStore.lon) + 0.0001
      }
    })
      .then(res => {
        if (res.data?.status === 'success') {
          if (res.data.daily && res.data.daily.length > 0) {
            setRealWeather(res.data.daily);
          } else {
            setWeatherError("API returned empty daily array");
          }
        } else {
          setWeatherError("API returned error status");
        }
      })
      .catch(err => {
        console.error("Weather fetch error", err);
        setWeatherError(err.message || "Network Error");
      });
  }, [currentStore]);

  const { totalEvents, projectedLift, extraCovers, highOpportunity, enrichedVenues } = getMetrics();
  const nearbyBusinesses = getNearbyBusinesses(currentStore.id);

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const weatherSignals = realWeather
    ? realWeather.map((d, i) => {
      const dt = new Date();
      dt.setDate(dt.getDate() + i);
      const desc = d.description.toLowerCase();
      const rain = d.pop;
      let icon = 'CloudSun', type = 'Clear', text = '+ traffic', color = 'text-emerald-600 bg-emerald-50 border-emerald-100';
      if (desc.includes('thunder')) { icon = 'CloudLightning'; type = 'Storm'; text = '- traffic'; color = 'text-rose-600 bg-rose-50 border-rose-100'; }
      else if (rain > 50 || desc.includes('rain') || desc.includes('drizzle')) { icon = 'CloudRain'; type = 'Rainy'; text = '- traffic'; color = 'text-rose-600 bg-rose-50 border-rose-100'; }
      else if (desc.includes('cloud') || desc.includes('fog') || desc.includes('mist') || desc.includes('overcast')) { icon = 'Cloud'; type = 'Cloudy'; text = 'neutral'; color = 'text-slate-500 bg-slate-100 border-slate-200'; }
      return { day: days[dt.getDay()], date: `${months[dt.getMonth()]} ${dt.getDate()}`, icon, type, text, color, temp: [d.temp_max, d.temp_min], rain };
    })
    : [];

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#f8fafc] custom-scrollbar pb-24">

      {/* Store Headline Cover */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950 leading-none">{currentStore.name}</h1>
          <p className="text-xs text-slate-400 font-bold mt-2 flex items-center gap-1">
            <span>{currentStore.address}</span>
            <span className="text-slate-200">•</span>
            <span>{currentStore.cuisine}</span>
            <span className="text-slate-200">•</span>
            <span>avg ticket ${currentStore.avgTicket}</span>
          </p>
        </div>

        {/* Time Interval Selector and Distance Slider */}
        <div className="flex flex-wrap items-center gap-6 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {["7 days", "15 days", "30 days"].map(day => (
              <button
                key={day}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${day === '15 days' ? 'bg-white text-indigo-600 shadow-sm font-black' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {day}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">Radius</span>
            <input
              type="range"
              min="1"
              max="15"
              value={radiusMiles}
              onChange={(e) => setRadiusMiles(parseInt(e.target.value))}
              className="w-24 h-1 bg-slate-100 rounded-full appearance-none accent-indigo-600 cursor-pointer"
            />
            <span className="text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg w-12 text-center shrink-0">
              {radiusMiles} mi
            </span>
          </div>
        </div>
      </div>

      {/* 4 Premium Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        {/* Metric 1 */}
        <div className="bg-white rounded-[2rem] border border-slate-100 p-6 flex justify-between items-start shadow-sm hover:shadow-md transition-all">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Events Nearby</p>
            <p className="text-3xl font-black text-slate-900 leading-none pt-2">{loading ? '...' : totalEvents}</p>
            <p className="text-[10px] text-indigo-500 font-bold leading-none pt-2">next 7 days</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50/70 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Calendar size={16} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-[2rem] border border-slate-100 p-6 flex justify-between items-start shadow-sm hover:shadow-md transition-all">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Projected Lift</p>
            <p className="text-3xl font-black text-emerald-600 leading-none pt-2">{loading ? '...' : projectedLift}</p>
            <p className="text-[10px] text-emerald-500 font-bold leading-none pt-2">from events in window</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50/70 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <DollarSign size={16} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-[2rem] border border-slate-100 p-6 flex justify-between items-start shadow-sm hover:shadow-md transition-all">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Extra Covers</p>
            <p className="text-3xl font-black text-indigo-600 leading-none pt-2">{loading ? '...' : extraCovers}</p>
            <p className="text-[10px] text-indigo-500 font-bold leading-none pt-2">estimated incremental</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50/70 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Users size={16} />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-[2rem] border border-slate-100 p-6 flex justify-between items-start shadow-sm hover:shadow-md transition-all">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">High-Opportunity</p>
            <p className="text-3xl font-black text-amber-600 leading-none pt-2">{loading ? '...' : highOpportunity}</p>
            <p className="text-[10px] text-amber-500 font-bold leading-none pt-2">score &gt;= 60</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50/70 border border-amber-100 flex items-center justify-center text-amber-600">
            <Sparkles size={16} />
          </div>
        </div>
      </div>

      {/* Dashboard Tabs Selector */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200/50">
        <button
          onClick={() => setDashboardTab('events')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${dashboardTab === 'events' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Calendar size={14} />
          Events
        </button>
        <button
          onClick={() => setDashboardTab('businesses')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${dashboardTab === 'businesses' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Store size={14} />
          Nearby Businesses & AI Impact
        </button>
      </div>

      {/* Content Body Based on Tab */}
      {dashboardTab === 'events' ? (
        <div className="space-y-6">

          {/* Heading & Category pills */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-lg font-black text-slate-950">Events around your store</h2>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5 bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
              {[
                { id: "", label: "All" },
                { id: "sports", label: "Sports" },
                { id: "music", label: "Concert" },
                { id: "community", label: "Meetup" },
                { id: "food", label: "Celebration" },
                { id: "parade", label: "Parade" },
                { id: "conference", label: "Conference" },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-wider ${selectedCategory === cat.id ? 'bg-indigo-600 text-white shadow-sm font-black' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Inline Map Leaflet Container */}
          <div className="w-full h-96 rounded-[2rem] overflow-hidden border border-slate-100 bg-white relative shadow-sm z-0">
            <MapContainer center={selectedPlace ? [selectedPlace.lat, selectedPlace.lon] : [37.752, -122.418]} zoom={13} className="w-full h-full" zoomControl={false}>
              <TileLayer url={`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`} />
              <ZoomControl position="bottomright" />

              {selectedPlace && (
                <>
                  <Marker position={[selectedPlace.lat, selectedPlace.lon]} icon={YellowIcon}>
                    <Popup closeButton={false}>
                      <div className="p-2 text-center min-w-[150px]">
                        <p className="text-[9px] font-black text-indigo-600 uppercase tracking-wider mb-1">Target Store</p>
                        <p className="text-xs font-black text-slate-800 leading-tight">{currentStore.name}</p>
                      </div>
                    </Popup>
                  </Marker>

                  <Circle
                    center={[selectedPlace.lat, selectedPlace.lon]}
                    radius={radiusMiles * 1609.34}
                    pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.05, weight: 1.5 }}
                  />

                  {enrichedVenues.map((v, i) => (
                    <Marker key={i} position={[v.lat, v.lon]} icon={BlueIcon}>
                      <Popup closeButton={false}>
                        <div className="p-1 min-w-[120px]">
                          <p className="font-bold text-slate-800 text-xs mb-1">{v.name}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-slate-100 text-slate-500">{v.categoryClean || 'Venue'}</span>
                            <span className="text-[8px] font-bold text-indigo-600">{(v.distance / 1000).toFixed(1)}km</span>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </>
              )}
            </MapContainer>
          </div>

          {/* 7-day Weather Signal Card Container (mockup Image 3) */}
          <div className="bg-white rounded-[2rem] border border-slate-100 p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <CloudSun size={18} className="text-indigo-500" /> 7-day weather signal
              </h3>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Traffic Impact</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {weatherSignals.length > 0 ? (
                weatherSignals.map((sig, i) => {
                  const Icon = WEATHER_ICONS[sig.icon] || CloudSun;
                  return (
                    <div key={i} className="border border-slate-50 hover:border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-2 bg-slate-50/30">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{sig.day}</span>
                      <span className="text-[10px] font-bold text-slate-400">{sig.date}</span>
                      <div className="p-1.5 rounded-full bg-white shadow-sm border border-slate-50">
                        <Icon size={20} className="text-slate-600" />
                      </div>
                      <span className="text-xs font-black text-slate-900">{sig.temp[0]}°C</span>
                      <span className="text-[9px] text-slate-400 font-bold">{sig.rain}% rain</span>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${sig.color}`}>
                        {sig.text}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full h-32 flex flex-col items-center justify-center text-slate-400 text-sm font-bold">
                  {weatherError ? (
                    <span className="text-rose-500">Error: {weatherError}</span>
                  ) : (
                    "Loading precise API weather data..."
                  )}
                </div>
              )}
            </div>

            {/* Weather Insight Banner */}
            <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-4 flex gap-3 items-start">
              <Info size={16} className="text-indigo-600 mt-0.5 shrink-0" />
              <p className="text-xs font-bold text-indigo-700 leading-normal">
                {realWeather
                  ? (() => {
                    const rainyDays = weatherSignals.filter(s => s.text === '- traffic').length;
                    const goodDays = weatherSignals.filter(s => s.text === '+ traffic').length;
                    if (rainyDays >= 3) return `Insight: ${rainyDays} rainy days this week may reduce foot traffic. Consider indoor promotions and delivery-focused staffing on those days.`;
                    if (goodDays >= 5) return `Insight: ${goodDays} clear days forecast — ideal for event-driven foot traffic. Plan extra staffing and inventory on peak days.`;
                    return `Insight: Mixed weather this week. Monitor daily forecasts and adjust staffing for the ${goodDays} favorable days.`;
                  })()
                  : 'Insight: Sunny days ahead are likely to amplify event-driven traffic. Plan extra food preparation and staffing on forecast peak traffic days.'
                }
              </p>
            </div>
          </div>

          {/* High-Opportunity Events List (mockup Image 3) */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-950">High-opportunity events</h3>
                <p className="text-[11px] text-slate-400 font-medium">Score &gt;= 60 — recommended to act on. Filtered by live Eventbrite radar.</p>
              </div>
              <button
                onClick={() => setSelectedCategory("")}
                className="text-xs font-black text-slate-400 hover:text-slate-600 uppercase tracking-wider"
              >
                Clear Selection
              </button>
            </div>

            {/* List Container */}
            <div className="space-y-4">
              {loading ? (
                <div className="h-40 flex items-center justify-center bg-white rounded-3xl border border-slate-100">
                  <Loader2 className="animate-spin text-indigo-500" />
                </div>
              ) : enrichedVenues.filter(v => v.score >= 60).length > 0 ? (
                enrichedVenues
                  .filter(v => v.score >= 60)
                  .slice(0, 5)
                  .map((v, idx) => {
                    return (
                      <div key={v.id || idx} className="bg-white rounded-[2rem] border border-slate-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300">
                        <div className="flex items-start gap-6 w-full md:w-auto">
                          {/* Score Badge */}
                          <div className="flex flex-col items-center shrink-0">
                            <span className="text-[10px] font-black text-slate-400 mb-1">#{v.rank}</span>
                            <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex flex-col items-center justify-center shadow shadow-emerald-200 border border-emerald-600">
                              <span className="text-xl font-black leading-none">{v.score}</span>
                              <span className="text-[8px] font-black uppercase tracking-widest mt-0.5">Score</span>
                            </div>
                          </div>

                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${getCategoryStyles(v.categoryClean)}`}>
                                {v.categoryClean}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-0.5">
                                <MapPin size={10} /> {(v.distance / 1000).toFixed(1)} mi away
                              </span>
                            </div>
                            <h4 className="text-md font-black text-slate-900 leading-snug truncate">{v.name}</h4>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 font-bold">
                              <span className="flex items-center gap-1">
                                <Calendar size={12} className="text-indigo-400" /> {fmtDate(v.date)} · {fmtTime(v.date)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin size={12} /> {v.address}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users size={12} /> {v.attendance} attending
                              </span>
                              <span className="flex items-center gap-1">
                                <TrendingUp size={12} /> ~{v.covers} extra covers
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold mt-1">
                              Source: <a href={v.url} target="_blank" rel="noreferrer" className="underline hover:text-indigo-600">{v.organizer_name}</a>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 border-l border-slate-100 pl-6 shrink-0 w-full md:w-auto mt-4 md:mt-0">
                          <span className="text-xl font-black text-slate-900">+{v.lift ? `$${(v.lift / 1000).toFixed(1)}k` : '+$14k'}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Projected Lift</span>
                          <a href={v.url} target="_blank" rel="noreferrer" className="text-xs font-black text-indigo-600 hover:text-indigo-700 mt-2 flex items-center gap-0.5 group">
                            View details <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="h-48 flex flex-col items-center justify-center bg-white rounded-[2rem] border border-dashed border-slate-100 text-slate-300">
                  <Compass size={40} className="mb-2 opacity-50 animate-spin-slow" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No high-opportunity signals active</p>
                </div>
              )}
            </div>
          </div>

        </div>
      ) : (
        /* Nearby Businesses Panel + Gemini Generative Retail Impact report side-by-side */
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] border border-slate-100 p-6 space-y-6 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-slate-950">Nearby Businesses & Competitors</h2>
              <p className="text-xs text-slate-400 font-medium mt-1">Cross-reference location dynamics with surrounding commercial entities.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="py-3 px-4">Business Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Distance</th>
                    <th className="py-3 px-4">Footfall volume</th>
                    <th className="py-3 px-4">Avg ticket</th>
                    <th className="py-3 px-4">Overlap index</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-700">
                  {nearbyBusinesses.map((bus, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 font-black text-slate-950">{bus.name}</td>
                      <td className="py-4 px-4 text-slate-500">{bus.type}</td>
                      <td className="py-4 px-4 text-slate-400">{bus.distance}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${bus.footfall === 'Extremely High' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                          {bus.footfall}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-900">{bus.ticket}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${bus.overlap === 'High' || bus.overlap === 'Very High' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                          {bus.overlap}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Generative Retail Impact Report Card */}
          <BusinessDashboard data={analyticsData} loading={analyticsLoading} onGenerate={fetchAIAnalytics} />
        </div>
      )}
    </div>
  );
}
