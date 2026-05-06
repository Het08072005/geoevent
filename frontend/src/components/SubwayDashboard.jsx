import React, { useState } from 'react';
import { MapPin, Search, Loader2, AlertCircle, Zap, TrendingUp, Users } from 'lucide-react';
import { VenueCard } from './VenueCard';

const GEOAPIFY_KEY = "66dd1c0d3fb542ef9d255dedfd3b2a5a";
const BACKEND_URL = "http://127.0.0.1:8000";

export const SubwayDashboard = () => {
  const [address, setAddress] = useState("Palo Alto, CA");
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [city, setCity] = useState("Palo Alto");

  const fetchEvents = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setEvents([]);
    setSearched(true);

    try {
      // Step 1: Geocode address
      const geoRes = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&apiKey=${GEOAPIFY_KEY}`
      );
      if (!geoRes.ok) throw new Error("Location service failed. Check Geoapify key.");
      const geoData = await geoRes.json();
      if (!geoData.features?.length) throw new Error("Address not found. Try a more specific location.");

      const { lat, lon, city: geoCity } = geoData.features[0].properties;
      const detectedCity = geoCity || address.split(",")[0].trim();
      setCity(detectedCity);

      // Step 2: Fetch from backend (Eventbrite API v3 enriched)
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lon.toString(),
        radius: "10000",
        city: detectedCity
      });

      const eventsRes = await fetch(`${BACKEND_URL}/api/nearby-venues?${params}`);
      if (!eventsRes.ok) {
        const errBody = await eventsRes.json().catch(() => ({}));
        throw new Error(errBody.detail || `Backend error: ${eventsRes.status}`);
      }

      const data = await eventsRes.json();
      const venues = data.venues || [];
      setEvents(venues);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const paidCount = events.filter(e => e.is_paid).length;
  const highImpact = events.filter(e => {
    const att = parseInt(e.attendance);
    return !isNaN(att) && att > 200;
  }).length;

  return (
    <div className="min-h-screen bg-[#f0f2f5] font-sans">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
              <span className="text-white font-black text-lg">S</span>
            </div>
            <div>
              <h1 className="text-[15px] font-black text-slate-900 leading-none">Subway</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Event Intelligence</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex flex-1 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-400/10 transition-all">
            <div className="flex items-center pl-4 pr-2 text-slate-400">
              <MapPin size={16} strokeWidth={2.5} />
            </div>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchEvents()}
              placeholder="Enter store address (e.g. 456 University Ave, Palo Alto)"
              className="flex-1 bg-transparent py-3 text-sm text-slate-800 placeholder-slate-400 outline-none font-medium"
            />
            <button
              onClick={fetchEvents}
              disabled={loading}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white px-6 py-3 text-sm font-black flex items-center gap-2 transition-colors"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              Scan
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ─── Stats Bar ──────────────────────────────────────────────── */}
        {searched && !loading && !error && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} className="text-green-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Events</span>
              </div>
              <p className="text-3xl font-black text-slate-900">{events.length}</p>
              <p className="text-xs text-slate-400 font-medium mt-1">within 10km of {city}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-indigo-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paid Events</span>
              </div>
              <p className="text-3xl font-black text-indigo-600">{paidCount}</p>
              <p className="text-xs text-slate-400 font-medium mt-1">revenue opportunities</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Users size={14} className="text-amber-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">High Impact</span>
              </div>
              <p className="text-3xl font-black text-amber-600">{highImpact}</p>
              <p className="text-xs text-slate-400 font-medium mt-1">events with 200+ attendees</p>
            </div>
          </div>
        )}

        {/* ─── Error ──────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4 mb-6">
            <div className="p-2 bg-red-100 rounded-xl text-red-600">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="font-bold text-red-800 mb-1">Sync Failed</h3>
              <p className="text-sm text-red-600 leading-relaxed">{error}</p>
              <p className="text-xs text-red-400 mt-2 font-medium">Make sure the backend is running: <code className="bg-red-100 px-1 rounded">uvicorn app.main:app --reload</code></p>
            </div>
          </div>
        )}

        {/* ─── Loading Skeletons ───────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 h-28 animate-pulse flex items-center p-5 gap-5">
                <div className="w-36 h-full bg-slate-100 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-4 bg-slate-100 rounded-lg w-2/3" />
                  <div className="h-3 bg-slate-100 rounded-lg w-1/3" />
                  <div className="h-3 bg-slate-100 rounded-lg w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── Events List ────────────────────────────────────────────── */}
        {!loading && events.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest">
                Live Events Radar — {events.length} signals
              </h2>
              <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Eventbrite API v3
              </div>
            </div>
            {events.map(venue => (
              <VenueCard key={venue.id || venue.name} venue={venue} />
            ))}
          </div>
        )}

        {/* ─── Empty State ─────────────────────────────────────────────── */}
        {!loading && !error && searched && events.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 p-20 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search size={28} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-black text-slate-700 mb-2">No Events Found</h3>
            <p className="text-slate-400 text-sm font-medium max-w-xs mx-auto">
              No Eventbrite events in 10km. Try a different city or check the backend logs.
            </p>
          </div>
        )}

        {/* ─── Welcome State ───────────────────────────────────────────── */}
        {!loading && !error && !searched && (
          <div className="bg-white rounded-3xl border border-slate-200 p-20 text-center shadow-sm">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
              <TrendingUp size={28} className="text-white" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3">Event Intelligence Dashboard</h3>
            <p className="text-slate-500 font-medium max-w-md mx-auto mb-8">
              Enter your store address above to discover nearby Eventbrite events, identify footfall opportunities, and prepare your team.
            </p>
            <button
              onClick={fetchEvents}
              className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-xl font-black text-sm transition-all shadow-lg shadow-green-500/30 hover:-translate-y-0.5"
            >
              Scan Palo Alto →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
