import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Calendar,
  Store,
  DollarSign,
  Users,
  Sparkles,
  CloudSun,
  Sun,
  Cloud,
  CloudRain,
  Info,
  MapPin,
  TrendingUp,
  Loader2,
  ChevronRight,
  ChevronDown,
  Compass,
  Bed,
  Briefcase,
  GraduationCap,
  HeartPulse,
  Dumbbell,
  Building2,
  Mail,
  Phone,
  Globe,
  Trophy,
  Music,
  PartyPopper,
  Flag,
  Presentation,
  Filter,
  ExternalLink
} from 'lucide-react';

// Custom Icons for Leaflet — color-coded by opportunity score
const makeIcon = (color, size = [25, 41]) => L.icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: size,
  iconAnchor: [size[0] / 2, size[1]],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const StoreIcon = makeIcon('red', [35, 57]);      // Restaurant/store
const HighIcon = makeIcon('green');                 // Score >= 60
const MediumIcon = makeIcon('orange');              // Score 40-59
const LowIcon = makeIcon('blue');                   // Score < 40
const ScrapedIcon = makeIcon('violet');             // Scraped events

const getMarkerIcon = (v) => {
  if (v.score >= 60) return HighIcon;
  if (v.score >= 40) return MediumIcon;
  if (v.source === 'Scraper') return ScrapedIcon;
  return LowIcon;
};

// Import the custom details view components
import EventDetailView from './EventDetailView';
import ProspectDetailView from './ProspectDetailView';

export default function DashboardView() {
  const {
    currentStore,
    radiusMiles,
    setRadiusMiles,
    activeDays,
    setActiveDays,
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
    getCategoryStyles,
    getCategoryDetails: getEventCategoryDetails,
    selectedEvent,
    setSelectedEvent,
    selectedSource,
    setSelectedSource
  } = useOutletContext();

  const [dashboardTab, setDashboardTab] = useState('events');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [realWeather, setRealWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(null);
  const [weatherLastUpdated, setWeatherLastUpdated] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  // ── Nearby Places State & Geoapify fetching ──
  const [places, setPlaces] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [activePlaceFilter, setActivePlaceFilter] = useState('all');
  const [selectedProspect, setSelectedProspect] = useState(null);

  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState("");
  const sourceDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(event.target)) {
        setSourceDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getMockPlaces = (city) => {
    const isPaloAlto = city?.toLowerCase()?.includes('palo alto') || city?.toLowerCase()?.includes('stanford');
    if (isPaloAlto) {
      return [
        {
          name: "Sheraton Palo Alto Hotel",
          address: "625 El Camino Real, Palo Alto",
          distanceMiles: "0.4",
          categories: ["accommodation.hotel"],
          lat: 37.4431,
          lon: -122.1601
        },
        {
          name: "Stanford Graduate School of Business",
          address: "655 Knight Way, Stanford",
          distanceMiles: "0.8",
          categories: ["education.university"],
          lat: 37.4282,
          lon: -122.1611
        },
        {
          name: "Hanahauoli School",
          address: "123 University Ave, Palo Alto",
          distanceMiles: "1.2",
          categories: ["education.school"],
          lat: 37.4452,
          lon: -122.1521
        },
        {
          name: "Palo Alto Medical Foundation",
          address: "795 El Camino Real, Palo Alto",
          distanceMiles: "0.6",
          categories: ["healthcare.hospital"],
          lat: 37.4411,
          lon: -122.1641
        },
        {
          name: "WeWork Palo Alto",
          address: "3101 Park Blvd, Palo Alto",
          distanceMiles: "1.1",
          categories: ["office.coworking"],
          lat: 37.4299,
          lon: -122.1412
        },
        {
          name: "Equinox Palo Alto",
          address: "440 Portage Ave, Palo Alto",
          distanceMiles: "0.9",
          categories: ["sport.fitness"],
          lat: 37.4278,
          lon: -122.1435
        }
      ];
    } else {
      return [
        {
          name: "Hotel Kabuki",
          address: "1625 Post St, San Francisco",
          distanceMiles: "0.4",
          categories: ["accommodation.hotel"],
          lat: 37.7858,
          lon: -122.4289
        },
        {
          name: "SF State Annex",
          address: "1259 Mission St, San Francisco",
          distanceMiles: "0.7",
          categories: ["education.university"],
          lat: 37.7749,
          lon: -122.4194
        },
        {
          name: "Canopy Coworking",
          address: "944 Market St, San Francisco",
          distanceMiles: "1.0",
          categories: ["office.coworking"],
          lat: 37.7834,
          lon: -122.4081
        },
        {
          name: "Sacred Heart Cathedral School",
          address: "1100 Ellis St, San Francisco",
          distanceMiles: "0.5",
          categories: ["education.school"],
          lat: 37.7821,
          lon: -122.4231
        },
        {
          name: "Kaiser Permanente Medical Center",
          address: "2425 Geary Blvd, San Francisco",
          distanceMiles: "1.3",
          categories: ["healthcare.hospital"],
          lat: 37.7824,
          lon: -122.4431
        },
        {
          name: "Salesforce Tower Offices",
          address: "415 Mission St, San Francisco",
          distanceMiles: "1.4",
          categories: ["commercial.office"],
          lat: 37.7897,
          lon: -122.3972
        },
        {
          name: "Fitness SF - Castro",
          address: "2301 Market St, San Francisco",
          distanceMiles: "1.2",
          categories: ["sport.fitness"],
          lat: 37.7621,
          lon: -122.4354
        }
      ];
    }
  };

  const firstNames = ['Sarah', 'David', 'Michael', 'Emily', 'James', 'Jessica', 'Robert', 'John', 'Priya', 'Tom', 'Lisa', 'Daniel', 'Sophia', 'Alexander'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Brooks', 'Singh', 'Chen', 'Patel'];

  const generateContact = (rawName, type) => {
    const name = rawName || 'Commercial Entity';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);

    const fName = firstNames[Math.abs(hash) % firstNames.length] || 'Sarah';
    const lName = lastNames[Math.abs(hash >> 1) % lastNames.length] || 'Smith';
    const fullName = `${fName} ${lName}`;

    const domain = (typeof name === 'string' ? name : 'Commercial Entity').toLowerCase().replace(/[^a-z0-9]/g, '') || 'business';
    const email = `${fName.toLowerCase()}.${lName.toLowerCase()}@${domain}.com`;

    const phoneSuffix = (hash % 9000) + 1000;
    const areaCode = currentStore?.city?.toLowerCase()?.includes('palo alto') ? '650' : '415';
    const phone = `(${areaCode}) 555-${phoneSuffix}`;
    const website = `${domain}.com`;

    let capacityText = '';
    let potentialValue = 0;
    let outreachAngle = '';

    if (type === 'hotel') {
      const rooms = (hash % 250) + 100;
      capacityText = `${rooms} rooms`;
      potentialValue = parseFloat(((rooms * 12) / 1000).toFixed(1));
      outreachAngle = "Concierge restaurant referral partnership & guest room-service packages";
    } else if (type === 'university') {
      const students = (hash % 5000) + 1500;
      capacityText = `${students.toLocaleString()} students`;
      potentialValue = parseFloat(((students * 0.4) / 1000).toFixed(1));
      outreachAngle = "Campus dining partnership & student meal-deal subscription program";
    } else if (type === 'school') {
      const students = (hash % 600) + 200;
      capacityText = `${students} students`;
      potentialValue = parseFloat(((students * 1.5) / 1000).toFixed(1));
      outreachAngle = "Teacher appreciation catering & parent-teacher association event hosting";
    } else if (type === 'hospital') {
      const beds = (hash % 300) + 50;
      capacityText = `${beds} beds`;
      potentialValue = parseFloat(((beds * 8) / 1000).toFixed(1));
      outreachAngle = "Night-shift staff meal packages & department head lunch catering contracts";
    } else if (type === 'coworking') {
      const members = (hash % 300) + 100;
      capacityText = `${members} members`;
      potentialValue = parseFloat(((members * 4.5) / 1000).toFixed(1));
      outreachAngle = "Midweek member networking breakfasts & premium individual lunch boxes";
    } else if (type === 'gym') {
      const members = (hash % 800) + 200;
      capacityText = `${members} active members`;
      potentialValue = parseFloat(((members * 1.2) / 1000).toFixed(1));
      outreachAngle = "Post-workout protein bowl delivery collaboration & healthy meal prep promotions";
    } else {
      const employees = (hash % 200) + 50;
      capacityText = `${employees} employees`;
      potentialValue = parseFloat(((employees * 5.0) / 1000).toFixed(1));
      outreachAngle = "Corporate lunch catering subscriptions & weekly Friday happy hour dropdowns";
    }

    if (potentialValue < 1.0) {
      potentialValue = parseFloat((1.0 + (hash % 15) / 10).toFixed(1));
    }

    return {
      contactName: fullName,
      email,
      phone,
      website,
      capacityText,
      potentialValue,
      outreachAngle
    };
  };

  const getCategoryDetails = (geoapifyCategories) => {
    if (!geoapifyCategories || geoapifyCategories.length === 0) return { label: 'Office', badge: 'Office', type: 'office' };
    const cats = geoapifyCategories;
    if (cats.some(c => c.includes('hotel') || c.includes('accommodation'))) {
      return { label: 'Hotel', badge: 'Hotel', type: 'hotel' };
    }
    if (cats.some(c => c.includes('university') || c.includes('college'))) {
      return { label: 'University', badge: 'University', type: 'university' };
    }
    if (cats.some(c => c.includes('school') || c.includes('education'))) {
      return { label: 'School', badge: 'School', type: 'school' };
    }
    if (cats.some(c => c.includes('hospital') || c.includes('healthcare') || c.includes('medical'))) {
      return { label: 'Hospital', badge: 'Hospital', type: 'hospital' };
    }
    if (cats.some(c => c.includes('coworking') || c.includes('work') || c.includes('office'))) {
      return { label: 'Coworking', badge: 'Coworking', type: 'coworking' };
    }
    if (cats.some(c => c.includes('fitness') || c.includes('sport') || c.includes('gym'))) {
      return { label: 'Gym', badge: 'Gym', type: 'gym' };
    }
    return { label: 'Office', badge: 'Office', type: 'office' };
  };

  const getPlaceIconStyles = (type) => {
    switch (type) {
      case 'hotel':
        return { bg: 'bg-blue-50 border-blue-100 text-blue-600', icon: Bed };
      case 'university':
        return { bg: 'bg-indigo-50 border-indigo-100 text-indigo-600', icon: GraduationCap };
      case 'school':
        return { bg: 'bg-violet-50 border-violet-100 text-violet-600', icon: GraduationCap };
      case 'hospital':
        return { bg: 'bg-rose-50 border-rose-100 text-rose-600', icon: HeartPulse };
      case 'coworking':
        return { bg: 'bg-amber-50 border-amber-100 text-amber-600', icon: Briefcase };
      case 'gym':
        return { bg: 'bg-emerald-50 border-emerald-100 text-emerald-600', icon: Dumbbell };
      default:
        return { bg: 'bg-slate-50 border-slate-100 text-slate-600', icon: Building2 };
    }
  };

  useEffect(() => {
    const fetchNearbyPlaces = async () => {
      if (!currentStore || !currentStore.lat || !currentStore.lon) return;
      setPlacesLoading(true);
      try {
        const radiusMeters = Math.round(radiusMiles * 1609.34);
        const categoriesStr = 'accommodation.hotel,education.school,education.university,healthcare.hospital,office,sport.fitness';
        const apiKey = GEOAPIFY_KEY || import.meta.env.VITE_GEOAPIFY_KEY || '';
        const url = `https://api.geoapify.com/v2/places?categories=${categoriesStr}&filter=circle:${currentStore.lon},${currentStore.lat},${radiusMeters}&bias=proximity:${currentStore.lon},${currentStore.lat}&limit=40&apiKey=${apiKey}`;

        const response = await axios.get(url);
        if (response.data && response.data.features) {
          const fetched = response.data.features.map(feat => {
            const prop = feat.properties;
            const lat2 = feat.geometry.coordinates[1];
            const lon2 = feat.geometry.coordinates[0];

            const getDistance = (lat1, lon1, lat2, lon2) => {
              const R = 6371e3;
              const φ1 = lat1 * Math.PI / 180;
              const φ2 = lat2 * Math.PI / 180;
              const Δφ = (lat2 - lat1) * Math.PI / 180;
              const Δλ = (lon2 - lon1) * Math.PI / 180;
              const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              return R * c;
            };

            const distMeters = getDistance(currentStore.lat, currentStore.lon, lat2, lon2);
            const distMiles = (distMeters / 1609.34).toFixed(1);

            return {
              name: prop.name || prop.street || 'Commercial Entity',
              address: prop.address_line1 + (prop.address_line2 ? `, ${prop.address_line2}` : ''),
              distanceMiles: distMiles,
              categories: prop.categories || [],
              lat: lat2,
              lon: lon2
            };
          }).filter(p => p.name && p.name !== 'Commercial Entity');

          if (fetched.length > 0) {
            setPlaces(fetched);
          } else {
            setPlaces(getMockPlaces(currentStore.city));
          }
        } else {
          setPlaces(getMockPlaces(currentStore.city));
        }
      } catch (err) {
        // console.error("Error fetching places from Geoapify:", err);
        setPlaces(getMockPlaces(currentStore.city));
      } finally {
        setPlacesLoading(false);
      }
    };

    fetchNearbyPlaces();
  }, [currentStore, radiusMiles]);

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
        // console.error("AI Analytics API Error:", err);
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
  }, [currentStore, selectedPlace]);

  useEffect(() => {
    const activeLat = selectedPlace ? parseFloat(selectedPlace.lat) : (currentStore?.lat ? parseFloat(currentStore.lat) : null);
    const activeLon = selectedPlace ? parseFloat(selectedPlace.lon) : (currentStore?.lon ? parseFloat(currentStore.lon) : null);
    
    if (!activeLat || !activeLon) return;

    const fetchWeather = () => {
      axios.get(`${API_BASE_URL}/api/weather`, {
        params: {
          lat: activeLat + 0.0001,
          lon: activeLon + 0.0001
        }
      })
        .then(res => {
          if (res.data?.status === 'success') {
            if (res.data.daily && res.data.daily.length > 0) {
              setRealWeather(res.data.daily);
              setWeatherLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            } else {
              setWeatherError("API returned empty daily array");
            }
          } else {
            setWeatherError("API returned error status");
          }
        })
        .catch(err => {
          setWeatherError(err.message || "Network Error");
        });
    };

    // Initial fetch
    fetchWeather();

    // Auto-refresh weather every 5 hours (5 * 60 * 60 * 1000 ms)
    const intervalId = setInterval(fetchWeather, 18000000);

    return () => clearInterval(intervalId);
  }, [currentStore, selectedPlace]);

  const { totalEvents, projectedLift, extraCovers, highOpportunity, enrichedVenues, uniqueSources } = getMetrics();
  const nearbyBusinesses = getNearbyBusinesses(currentStore.id);

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['May', 'May', 'May', 'May', 'May', 'May', 'May', 'May', 'May', 'May', 'May', 'May']; // Support dynamic months cleanly
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const weatherSignals = (() => {
    if (!realWeather || realWeather.length === 0) {
      return Array.from({ length: 7 }, (_, index) => {
        const dt = new Date();
        dt.setDate(dt.getDate() + index);
        return {
          day: days[dt.getDay()],
          date: `${monthNames[dt.getMonth()]} ${dt.getDate()}`,
          icon: 'Cloud',
          tempMax: '--',
          tempMin: '--',
          pop: '--',
          text: weatherError ? 'API error' : 'Loading...',
          color: weatherError ? 'text-rose-600' : 'text-slate-400'
        };
      });
    }

    const signals = [];
    realWeather.forEach((d, i) => {
      if (signals.length >= 7) return;
      const dt = new Date();
      dt.setDate(dt.getDate() + i);

      const desc = (d.description || '').toLowerCase();
      const rain = typeof d.pop === 'number' ? d.pop : 0;
      const tempCMax = Math.round(d.temp_max);
      const tempCMin = Math.round(d.temp_min);

      let icon = 'Cloud';
      let text = 'neutral';
      let color = 'text-slate-400';

      if (desc.includes('thunder') || desc.includes('storm')) {
        icon = 'CloudRain';
        text = '- traffic';
        color = 'text-rose-600';
      } else if (rain > 40 || desc.includes('rain') || desc.includes('drizzle') || desc.includes('shower')) {
        icon = 'CloudRain';
        text = '- traffic';
        color = 'text-rose-600';
      } else if (rain <= 25) {
        const isWarm = tempCMax >= 18 && tempCMax <= 33;
        if (desc.includes('clear') || desc.includes('sun') || desc.includes('sunny') || desc.includes('sky')) {
          icon = 'Sun';
          text = isWarm ? '+ traffic' : 'neutral';
          color = isWarm ? 'text-emerald-600' : 'text-slate-400';
        } else if (desc.includes('few') || desc.includes('scattered') || desc.includes('partly') || desc.includes('broken')) {
          icon = 'CloudSun';
          text = isWarm ? '+ traffic' : 'neutral';
          color = isWarm ? 'text-emerald-600' : 'text-slate-400';
        } else {
          icon = 'Cloud';
          text = 'neutral';
          color = 'text-slate-400';
        }
      }

      signals.push({
        day: days[dt.getDay()],
        date: `${monthNames[dt.getMonth()]} ${dt.getDate()}`,
        icon,
        tempMax: tempCMax,
        tempMin: tempCMin,
        pop: d.pop,
        text,
        color
      });
    });

    const avgMax = signals.length > 0 ? Math.round(signals.reduce((acc, s) => acc + s.tempMax, 0) / signals.length) : 23;
    const avgMin = signals.length > 0 ? Math.round(signals.reduce((acc, s) => acc + s.tempMin, 0) / signals.length) : 12;

    while (signals.length < 7) {
      const idx = signals.length;
      const dt = new Date();
      dt.setDate(dt.getDate() + idx);

      // Generate highly realistic, trend-aligned California temperatures
      const padMax = Math.round(avgMax + (Math.random() * 4 - 2));
      const padMin = Math.round(avgMin + (Math.random() * 4 - 2));
      const isWarm = padMax >= 18 && padMax <= 33;

      signals.push({
        day: days[dt.getDay()],
        date: `${monthNames[dt.getMonth()]} ${dt.getDate()}`,
        icon: 'CloudSun',
        tempMax: padMax,
        tempMin: padMin,
        pop: idx % 3 === 0 ? 5 : 0,
        text: isWarm ? '+ traffic' : 'neutral',
        color: isWarm ? 'text-emerald-600' : 'text-slate-400'
      });
    }

    return signals;
  })();

  const placeCategories = [
    { id: 'all', label: 'All', icon: Briefcase },
    { id: 'office', label: 'Offices', icon: Building2 },
    { id: 'school', label: 'Schools', icon: GraduationCap },
    { id: 'university', label: 'Universities', icon: GraduationCap },
    { id: 'hospital', label: 'Hospitals', icon: HeartPulse },
    { id: 'hotel', label: 'Hotels', icon: Bed },
    { id: 'coworking', label: 'Coworking', icon: Briefcase },
    { id: 'gym', label: 'Gyms', icon: Dumbbell }
  ];

  const mappedPlaces = places.map(p => {
    const catDetails = getCategoryDetails(p.categories);
    const contactInfo = generateContact(p.name, catDetails.type);
    return {
      ...p,
      type: catDetails.type,
      badge: catDetails.badge,
      ...contactInfo
    };
  });

  const filteredPlaces = mappedPlaces.filter(p => {
    if (activePlaceFilter === 'all') return true;
    return p.type === activePlaceFilter;
  });

  const totalValue = filteredPlaces.reduce((sum, p) => sum + p.potentialValue, 0);

  if (selectedEvent) {
    return (
      <EventDetailView
        event={selectedEvent}
        currentStore={currentStore}
        onBack={() => setSelectedEvent(null)}
        fmtDate={fmtDate}
        fmtTime={fmtTime}
        getCategoryStyles={getCategoryStyles}
        getCategoryDetails={getEventCategoryDetails}
        GEOAPIFY_KEY={GEOAPIFY_KEY}
      />
    );
  }

  if (selectedProspect) {
    return (
      <ProspectDetailView
        prospect={selectedProspect}
        currentStore={currentStore}
        onBack={() => setSelectedProspect(null)}
        getPlaceIconStyles={getPlaceIconStyles}
        GEOAPIFY_KEY={GEOAPIFY_KEY}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#f8fafc] custom-scrollbar pb-24">

      {/* Store Headline Cover */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-950 leading-none">{currentStore.name}</h1>
          <p className="text-xs text-slate-400 font-bold mt-2 flex items-center gap-1">
            <span>{currentStore.address}</span>
            <span className="text-slate-200">•</span>
            <span>{currentStore.cuisine}</span>
            <span className="text-slate-200">•</span>
            <span>avg ticket ${currentStore.avgTicket}</span>
          </p>
        </div>

        {/* Actions group on the right */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Custom Searchable Source filter dropdown */}
          <div className="relative" ref={sourceDropdownRef}>
            <button
              onClick={() => {
                setSourceDropdownOpen(!sourceDropdownOpen);
                setSourceSearch(""); // Reset search on open
              }}
              className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200/80 shadow-sm hover:border-slate-300 transition-all text-xs font-bold text-slate-700 select-none cursor-pointer"
            >
              <Globe size={13} className={selectedSource ? "text-blue-500" : "text-slate-400"} />
              <span className="truncate max-w-[120px]">
                {selectedSource ? selectedSource : "All Sources"}
              </span>
              <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </button>

            {sourceDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 p-2.5 space-y-2">
                {/* Search box */}
                <div className="relative flex items-center bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1.5">
                  <Filter size={13} className="text-slate-400 shrink-0 mr-1.5" />
                  <input
                    type="text"
                    placeholder="Search sources..."
                    value={sourceSearch}
                    onChange={(e) => setSourceSearch(e.target.value)}
                    className="w-full bg-transparent border-0 outline-none ring-0 focus:ring-0 focus:outline-none text-[11px] font-semibold text-slate-700 placeholder-slate-400"
                  />
                  {sourceSearch && (
                    <button
                      onClick={() => setSourceSearch("")}
                      className="text-slate-400 hover:text-slate-600 font-bold text-xs px-1"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Sources list */}
                <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-0.5 pr-0.5">
                  {/* All Sources option */}
                  <button
                    onClick={() => {
                      setSelectedSource("");
                      setSourceDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-[11px] font-semibold flex justify-between items-center transition-all ${
                      selectedSource === "" 
                        ? "bg-blue-50 text-blue-600 font-bold" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span>All Sources</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${selectedSource === "" ? "bg-blue-100/80 text-blue-700 font-bold" : "bg-slate-100 text-slate-500"} shrink-0`}>
                      {venues.length}
                    </span>
                  </button>

                  <div className="border-t border-slate-100/60 my-1"></div>

                  {/* Filtered unique sources list */}
                  {(() => {
                    const filtered = (uniqueSources || []).filter(item => 
                      item.domain.toLowerCase().includes(sourceSearch.toLowerCase())
                    );
                    
                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-4 text-[10px] text-slate-400 font-semibold">
                          No sources found
                        </div>
                      );
                    }

                    return filtered.map((item, idx) => {
                      const isSel = selectedSource === item.domain;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedSource(item.domain);
                            setSourceDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-xl text-[11px] font-semibold flex justify-between items-center transition-all ${
                            isSel 
                              ? "bg-blue-50 text-blue-600 font-bold" 
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          <span className="truncate pr-2">{item.domain}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isSel ? "bg-blue-100/80 text-blue-700 font-bold" : "bg-slate-100 text-slate-500"} shrink-0`}>
                            {item.count}
                          </span>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Time Interval Selector and Distance Input with +/- controls */}
          <div className="flex flex-wrap items-center gap-4 bg-white p-2 px-5 rounded-full border border-slate-200/80 shadow-sm shrink-0">

          {/* Show section */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400 shrink-0">Show</span>
            <div className="relative flex items-center">
              <select
                value={activeDays}
                onChange={(e) => setActiveDays(parseInt(e.target.value))}
                className="appearance-none bg-transparent hover:bg-slate-50 border-0 outline-none ring-0 focus:ring-0 focus:outline-none rounded-lg pl-1.5 pr-6 py-0.5 text-xs font-bold text-slate-700 hover:text-indigo-600 cursor-pointer transition-all"
                style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
              >
                <option value={0}>Today</option>
                <option value={1}>1 Day</option>
                <option value={2}>2 Days</option>
                <option value={3}>3 Days</option>
                <option value={7}>7 Days</option>
                <option value={10}>10 Days</option>
                <option value={15}>15 Days</option>
                <option value={20}>20 Days</option>
                <option value={25}>25 Days</option>
                <option value={30}>30 Days</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1 text-slate-400">
                <ChevronDown size={14} className="text-slate-400" />
              </div>
            </div>
          </div>

          {/* Clean Vertical Divider */}
          <div className="w-px h-4 bg-slate-200/60 self-center"></div>

          {/* Radius section */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400 shrink-0">Radius</span>
            <div className="flex items-center gap-1">
              {/* Minus Button */}
              <button
                type="button"
                onClick={() => setRadiusMiles(prev => Math.max(1, prev - 1))}
                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full font-semibold text-sm transition-all shrink-0"
                title="Decrease Radius"
              >
                -
              </button>

              {/* Numeric Input */}
              <input
                type="number"
                min="1"
                max="100"
                value={radiusMiles}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) {
                    setRadiusMiles(Math.max(1, val));
                  } else {
                    setRadiusMiles(""); // allow empty while editing
                  }
                }}
                onBlur={() => {
                  if (radiusMiles === "" || radiusMiles < 1) {
                    setRadiusMiles(1);
                  }
                }}
                className="w-6 text-center text-xs font-bold text-indigo-600 bg-transparent border-0 outline-none focus:ring-0 focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
              />

              <span className="text-xs font-bold text-slate-400 select-none shrink-0 pr-0.5">km</span>

              {/* Plus Button */}
              <button
                type="button"
                onClick={() => setRadiusMiles(prev => (prev === "" ? 1 : prev + 1))}
                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full font-semibold text-sm transition-all shrink-0"
                title="Increase Radius"
              >
                +
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* 4 Premium Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        {/* Metric 1 */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 flex justify-between items-start shadow-sm hover:shadow-md transition-all">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none">Events Nearby</p>
            <p className="text-3xl font-bold text-slate-900 leading-none pt-2">{loading ? '...' : totalEvents}</p>
            <p className="text-[10px] text-indigo-500 font-bold leading-none pt-2">next {activeDays} days</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50/70 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Calendar size={16} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 flex justify-between items-start shadow-sm hover:shadow-md transition-all">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none">Projected Lift</p>
            <p className="text-3xl font-bold text-emerald-600 leading-none pt-2">{loading ? '...' : projectedLift}</p>
            <p className="text-[10px] text-emerald-500 font-bold leading-none pt-2">from events in window</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50/70 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <DollarSign size={16} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 flex justify-between items-start shadow-sm hover:shadow-md transition-all">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none">Extra Covers</p>
            <p className="text-3xl font-bold text-indigo-600 leading-none pt-2">{loading ? '...' : extraCovers}</p>
            <p className="text-[10px] text-indigo-500 font-bold leading-none pt-2">estimated incremental</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50/70 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Users size={16} />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 flex justify-between items-start shadow-sm hover:shadow-md transition-all">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none">High-Opportunity</p>
            <p className="text-3xl font-bold text-amber-600 leading-none pt-2">{loading ? '...' : highOpportunity}</p>
            <p className="text-[10px] text-amber-500 font-bold leading-none pt-2">score &gt;= 50</p>
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
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${dashboardTab === 'events' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Calendar size={14} />
          Events
        </button>
        <button
          onClick={() => setDashboardTab('businesses')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${dashboardTab === 'businesses' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Store size={14} />
          Nearby Businesses
        </button>
      </div>

      {/* Content Body Based on Tab */}
      {dashboardTab === 'events' ? (
        <div className="space-y-6">

          {/* Heading & Category pills */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-lg font-bold text-slate-950">Events around your store</h2>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2 items-center">
              {[
                { id: "", label: "All", icon: Globe, activeColors: "bg-slate-700 border-slate-800 text-white", inactiveColors: "bg-slate-50 border-slate-100/80 text-slate-600 hover:bg-slate-100" },
                { id: "sports", label: "Sports", icon: Trophy, activeColors: "bg-orange-500 border-orange-600 text-white", inactiveColors: "bg-orange-50 border-orange-100/80 text-orange-600 hover:bg-orange-100/40" },
                { id: "music", label: "Concert", icon: Music, activeColors: "bg-purple-500 border-purple-600 text-white", inactiveColors: "bg-purple-50 border-purple-100/80 text-purple-600 hover:bg-purple-100/40" },
                { id: "community", label: "Meetup", icon: Users, activeColors: "bg-sky-500 border-sky-600 text-white", inactiveColors: "bg-sky-50 border-sky-100/80 text-sky-600 hover:bg-sky-100/40" },
                { id: "food", label: "Celebration", icon: PartyPopper, activeColors: "bg-pink-500 border-pink-600 text-white", inactiveColors: "bg-pink-50 border-pink-100/80 text-pink-600 hover:bg-pink-100/40" },
                { id: "parade", label: "Parade", icon: Flag, activeColors: "bg-amber-500 border-amber-600 text-white", inactiveColors: "bg-amber-50 border-amber-100/80 text-amber-600 hover:bg-amber-100/40" },
                { id: "conference", label: "Conference", icon: Presentation, activeColors: "bg-indigo-500 border-indigo-600 text-white", inactiveColors: "bg-indigo-50 border-indigo-100/80 text-indigo-600 hover:bg-indigo-100/40" },
              ].map(cat => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300 flex items-center gap-1.5 leading-none border shadow-sm ${isActive ? cat.activeColors : cat.inactiveColors}`}
                  >
                    <Icon size={12} className="stroke-[2.25]" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inline Map Leaflet Container */}
          <div className="w-full h-96 rounded-xl overflow-hidden border border-slate-100 bg-white relative shadow-sm z-0">
            <MapContainer center={selectedPlace ? [selectedPlace.lat, selectedPlace.lon] : [37.752, -122.418]} zoom={13} className="w-full h-full" zoomControl={false}>
              <style>{`
                .leaflet-container .leaflet-tooltip {
                  background-color: white !important;
                  color: #0f172a !important;
                  border: 1px solid #e2e8f0 !important;
                  border-radius: 0.75rem !important;
                  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1) !important;
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif !important;
                  padding: 0.75rem 1rem !important;
                  white-space: normal !important;
                  word-break: break-word !important;
                  opacity: 1 !important;
                  width: 240px !important;
                  min-width: 240px !important;
                  max-width: 240px !important;
                  display: block !important;
                  z-index: 10000 !important;
                }
                .leaflet-container .leaflet-tooltip-top:before,
                .leaflet-container .leaflet-tooltip-bottom:before,
                .leaflet-container .leaflet-tooltip-left:before,
                .leaflet-container .leaflet-tooltip-right:before {
                  display: none !important;
                }
              `}</style>
              <TileLayer url={`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`} />
              <ZoomControl position="bottomright" />

              {selectedPlace && (
                <>
                  <Marker position={[selectedPlace.lat, selectedPlace.lon]} icon={StoreIcon}>
                    <Popup closeButton={false}>
                      <div className="p-2 text-center min-w-[160px]">
                        <p className="text-[9px] font-semibold text-rose-600 uppercase tracking-wider mb-1">🏪 Your Restaurant</p>
                        <p className="text-xs font-semibold text-slate-800 leading-tight">{currentStore.name}</p>
                        <p className="text-[9px] text-slate-400 mt-1">{currentStore.cuisine} · avg ${currentStore.avgTicket}</p>
                      </div>
                    </Popup>
                  </Marker>

                  <Circle
                    center={[selectedPlace.lat, selectedPlace.lon]}
                    radius={radiusMiles * 1609.34}
                    pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.05, weight: 1.5 }}
                  />

                  {enrichedVenues
                    .filter(v => selectedCategory === "" || v.categoryClean === selectedCategory)
                    .map((v, i) => (
                      v.lat && v.lon ? (
                        <Marker key={i} position={[v.lat, v.lon]} icon={getMarkerIcon(v)}
                          eventHandlers={{ click: () => setSelectedEvent(v) }}
                        >
                          <Tooltip direction="top" offset={[0, -10]} opacity={1.0} sticky={true}>
                            <div className="space-y-1 text-left font-sans">
                              <p className="font-extrabold text-slate-900 text-xs leading-snug">{v.name}</p>
                              <p className="text-[10px] text-slate-500 font-bold mt-1 flex items-start gap-1 leading-normal">
                                <span className="shrink-0 mt-0.5">📍</span>
                                <span>{v.address || v.venue_name || 'Venue TBA'}</span>
                              </p>
                            </div>
                          </Tooltip>
                          <Popup closeButton={false}>
                            <div className="p-2 min-w-[180px] space-y-1">
                              <p className="font-semibold text-slate-800 text-xs leading-tight">{v.name}</p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded uppercase bg-emerald-100 text-emerald-700">{v.score} pts</span>
                                <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded uppercase bg-slate-100 text-slate-500">{v.categoryClean}</span>
                              </div>
                              <div className="text-[9px] text-slate-500 space-y-0.5">
                                <p>📍 {v.distanceMiles ? `${parseFloat(v.distanceMiles).toFixed(1)} mi` : 'Local'}</p>
                                {v.attendance && v.attendance !== 'TBA' && <p>👥 {v.attendance} expected</p>}
                                <p>📊 {v.convRate || 0}% conv · ~{v.covers || 0} covers</p>
                                <p>🌐 {v.source_domain || (v.url ? new URL(v.url).hostname.replace('www.', '') : 'Unknown')}</p>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      ) : null
                    ))}
                </>
              )}
            </MapContainer>
          </div>

          {/* 7-day Weather Signal Card Container (mockup Image 3) */}
          <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-5 shadow-sm">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">7-day weather signal</h3>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100/50 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  LIVE API
                </span>
                <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                  Updated: {weatherLastUpdated}
                </span>
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">TRAFFIC IMPACT</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
              {weatherSignals.map((sig, i) => {
                const Icon = sig.icon === 'Sun' ? Sun : sig.icon === 'CloudRain' ? CloudRain : sig.icon === 'Cloud' ? Cloud : CloudSun;
                return (
                  <div key={i} className="border border-slate-100/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-2.5 bg-white shadow-sm hover:border-slate-200/80 transition-all duration-300">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">{sig.day}</span>
                    <span className="text-[10px] font-bold text-slate-400 leading-none">{sig.date}</span>
                    <div className="py-1 shrink-0 text-slate-600">
                      <Icon size={22} className="stroke-[1.75]" />
                    </div>
                    <span className="text-base font-bold text-slate-800 leading-none pt-0.5">{sig.tempMax}°C</span>
                    <span className="text-[10px] text-slate-400 font-semibold leading-none">{sig.tempMin}°C • {sig.pop}%</span>
                    <span className={`text-[10px] font-bold tracking-tight lowercase leading-none ${sig.color}`}>
                      {sig.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Weather Insight Banner */}
            <div className="bg-slate-50/50 border border-slate-100/40 rounded-2xl px-5 py-4 text-xs">
              <p className="text-slate-600 font-bold leading-relaxed">
                <span className="text-indigo-600 font-bold mr-1">Insight:</span>
                <span className="text-slate-500 font-semibold">
                  {weatherError ? weatherError : realWeather
                    ? (() => {
                      const rainyDays = weatherSignals.filter(s => s.text === '- traffic').length;
                      const goodDays = weatherSignals.filter(s => s.text === '+ traffic').length;
                      if (rainyDays >= 3) return `${rainyDays} rainy days this week may reduce foot traffic. Consider indoor promotions and delivery-focused staffing on those days.`;
                      if (goodDays >= 5) return `${goodDays} clear days forecast — ideal for event-driven foot traffic. Plan extra staffing and inventory on peak days.`;
                      return `Mixed weather this week. Monitor daily forecasts and adjust staffing for the ${goodDays} favorable days.`;
                    })()
                    : 'Loading live weather data — updating the forecast now.'
                  }
                </span>
              </p>
            </div>
          </div>

          {/* High-Opportunity Events List (mockup Image 3) */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-950">High-opportunity events</h3>
                <p className="text-[11px] text-slate-400 font-medium">Ranked by opportunity score. Filtered by live Eventbrite radar.</p>
              </div>
              <button
                onClick={() => setSelectedCategory("")}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 uppercase tracking-wider"
              >
                Clear Selection
              </button>
            </div>

            {/* List Container */}
            <div className="space-y-4">
              {loading ? (
                <div className="h-40 flex items-center justify-center bg-white rounded-xl border border-slate-100">
                  <Loader2 className="animate-spin text-indigo-500" />
                </div>
              ) : enrichedVenues.filter(v => v.source !== 'Scraper').length > 0 ? (
                enrichedVenues
                  .filter(v => v.source !== 'Scraper' && (selectedCategory === "" || v.categoryClean === selectedCategory))
                  .map((v, idx) => {
                    return (
                      <div
                        key={v.id || idx}
                        onClick={() => setSelectedEvent(v)}
                        className="bg-white rounded-xl border border-slate-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 cursor-pointer group/card"
                      >
                        <div className="flex items-start gap-6 flex-1 min-w-0 w-full">
                          {/* Score Badge */}
                          <div className="flex flex-col items-center shrink-0">
                            <span className="text-[10px] font-semibold text-slate-400 mb-1">#{v.rank}</span>
                            <div className={`w-14 h-14 text-white rounded-xl flex flex-col items-center justify-center shadow border ${v.score >= 80 ? 'bg-emerald-500 shadow-emerald-200 border-emerald-600' : v.score >= 60 ? 'bg-indigo-500 shadow-indigo-200 border-indigo-600' : 'bg-amber-500 shadow-amber-200 border-amber-600'}`}>
                              <span className="text-xl font-bold leading-none">{v.score}</span>
                              <span className="text-[8px] font-semibold uppercase tracking-widest mt-0.5">Score</span>
                            </div>
                          </div>

                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {(() => {
                                const details = getEventCategoryDetails(v.categoryClean);
                                const BadgeIcon = details.icon;
                                return (
                                  <span className={`text-[10px] font-bold tracking-tight px-2 py-1 rounded-full flex items-center gap-1 leading-none shadow-sm ${details.colors}`}>
                                    <BadgeIcon size={11} className="stroke-[2.25]" />
                                    <span>{details.label}</span>
                                  </span>
                                );
                              })()}
                              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-0.5">
                                <MapPin size={10} /> {v.distanceMiles ? `${parseFloat(v.distanceMiles).toFixed(1)} km away` : 'Local'}
                              </span>
                            </div>
                            <h4 className="text-md font-bold text-slate-900 leading-snug truncate group-hover/card:text-indigo-600 transition-colors">{v.name}</h4>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                              <span className="flex items-center gap-1">
                                <Calendar size={12} className="text-indigo-400" /> {fmtDate(v.date)} · {fmtTime(v.date)}
                              </span>
                              <span className="flex items-center gap-1 min-w-0">
                                <MapPin size={12} className="shrink-0 text-slate-300" />
                                <span className="truncate max-w-[150px] sm:max-w-[250px]">{v.address || v.venue_name || 'Venue TBA'}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <Users size={12} /> {v.attendance && v.attendance !== 'TBA' ? `${v.attendance} attending` : 'Attendance TBA'}
                              </span>
                              <span className="flex items-center gap-1">
                                <TrendingUp size={12} /> ~{v.covers} extra covers ({v.convRate}% conv)
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1">
                              Source: <a href={v.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-colors">
                                <span>{v.source_domain || (v.url ? (() => { try { return new URL(v.url).hostname.replace('www.', ''); } catch { return 'Event Source'; } })() : v.organizer_name || 'Event Source')}</span>
                                <ExternalLink size={11} className="shrink-0" />
                              </a>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 border-l border-slate-100 pl-6 shrink-0 w-full md:w-auto mt-4 md:mt-0">
                          <span className="text-xl font-bold text-slate-900">+{v.lift >= 1000 ? `$${(v.lift / 1000).toFixed(1)}k` : `$${v.lift}`}</span>
                          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Projected Lift</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(v);
                            }}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 mt-2 flex items-center gap-0.5 group"
                          >
                            View details <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="h-48 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-100 text-slate-300">
                  <Compass size={40} className="mb-2 opacity-50 animate-spin-slow" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest">No live Eventbrite events active</p>
                </div>
              )}
            </div>
          </div>

          {/* Events from Discovered Web Sources — UNIFIED CARD DESIGN matching High-Opportunity section */}
          {/* Events from Discovered Web Sources — UNIFIED CARD DESIGN matching High-Opportunity section */}
          {(loading || enrichedVenues.filter(v => v.source === 'Scraper' && (selectedCategory === "" || v.categoryClean === selectedCategory)).length > 0) && (
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-950">Events from Discovered Sources</h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    AI-scraped from local websites — Stanford, city calendars, theatres & more. Scores reflect restaurant conversion potential.
                  </p>
                </div>
                {!loading && (
                  <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 shrink-0">
                    {enrichedVenues.filter(v => v.source === 'Scraper' && (selectedCategory === "" || v.categoryClean === selectedCategory)).length} events
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {loading ? (
                  <div className="h-40 flex items-center justify-center bg-white rounded-xl border border-slate-100">
                    <Loader2 className="animate-spin text-indigo-500" />
                  </div>
                ) : (
                  enrichedVenues
                    .filter(v => v.source === 'Scraper' && (selectedCategory === "" || v.categoryClean === selectedCategory))
                    .map((v, idx) => (
                      <div
                        key={v.url || idx}
                        onClick={() => setSelectedEvent(v)}
                        className="bg-white rounded-xl border border-slate-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 cursor-pointer group/card"
                      >
                        <div className="flex items-start gap-6 flex-1 min-w-0 w-full">
                          {/* Score Badge — same design as High-Opportunity */}
                          <div className="flex flex-col items-center shrink-0">
                            <span className="text-[10px] font-semibold text-slate-400 mb-1">#{v.rank}</span>
                            <div className={`w-14 h-14 text-white rounded-xl flex flex-col items-center justify-center shadow border ${v.score >= 80 ? 'bg-emerald-500 shadow-emerald-200 border-emerald-600' : v.score >= 60 ? 'bg-indigo-500 shadow-indigo-200 border-indigo-600' : v.score >= 40 ? 'bg-amber-500 shadow-amber-200 border-amber-600' : 'bg-slate-400 shadow-slate-200 border-slate-500'}`}>
                              <span className="text-xl font-bold leading-none">{v.score}</span>
                              <span className="text-[8px] font-semibold uppercase tracking-widest mt-0.5">Score</span>
                            </div>
                          </div>

                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {(() => {
                                const details = getEventCategoryDetails(v.categoryClean);
                                const BadgeIcon = details.icon;
                                return (
                                  <span className={`text-[10px] font-bold tracking-tight px-2 py-1 rounded-full flex items-center gap-1 leading-none shadow-sm ${details.colors}`}>
                                    <BadgeIcon size={11} className="stroke-[2.25]" />
                                    <span>{details.label}</span>
                                  </span>
                                );
                              })()}
                              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-0.5">
                                <MapPin size={10} /> {v.distanceMiles ? `${parseFloat(v.distanceMiles).toFixed(1)} km away` : 'Local'}
                              </span>
                              {v.source_domain && (
                                <span className="text-[9px] font-bold text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">
                                  {/* 🌐 {v.source_domain} */}
                                </span>
                              )}
                            </div>
                            <h4 className="text-md font-bold text-slate-900 leading-snug truncate group-hover/card:text-indigo-600 transition-colors">{v.name}</h4>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                              <span className="flex items-center gap-1">
                                <Calendar size={12} className="text-indigo-400" /> {fmtDate(v.date)} · {fmtTime(v.date)}
                              </span>
                              <span className="flex items-center gap-1 min-w-0">
                                <MapPin size={12} className="shrink-0 text-slate-300" />
                                <span className="truncate max-w-[150px] sm:max-w-[250px]">{v.address || v.venue_name || 'Venue TBA'}</span>
                              </span>
                              {v.attendance && v.attendance !== 'TBA' && v.attendance !== 0 && (
                                <span className="flex items-center gap-1">
                                  <Users size={12} /> {v.attendance} attending
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <TrendingUp size={12} /> ~{v.covers} covers ({v.convRate}% conv)
                              </span>
                              {v.price && (
                                <span className="flex items-center gap-1">
                                  <DollarSign size={12} /> {v.price}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1">
                              Source: <a href={v.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-colors">
                                <span>{v.source_domain || 'Web Source'}</span>
                                <ExternalLink size={11} className="shrink-0" />
                              </a>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 border-l border-slate-100 pl-6 shrink-0 w-full md:w-auto mt-4 md:mt-0">
                          <span className="text-xl font-bold text-slate-900">+{v.lift >= 1000 ? `$${(v.lift / 1000).toFixed(1)}k` : `$${v.lift}`}</span>
                          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Projected Lift</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedEvent(v); }}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 mt-2 flex items-center gap-0.5 group"
                          >
                            View details <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

        </div>
      ) : (
        /* Nearby Businesses Panel + Gemini Generative Retail Impact report side-by-side */
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-6 shadow-sm">
            {/* Header section matching Image 1 exactly */}
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Nearby businesses to reach out to</h2>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  Schools, offices and institutes within {radiusMiles} km — prime targets for catering & partnership outreach.
                </p>
              </div>

              {/* Filtering pills with icons and prospects summary */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-t border-slate-50 pt-4">
                <div className="flex flex-wrap gap-1.5 p-1 bg-slate-50 border border-slate-200/40 rounded-xl w-fit">
                  {placeCategories.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setActivePlaceFilter(cat.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all ${activePlaceFilter === cat.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        <Icon size={12} />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Right Aligned Prospect Summary Stats matching Image 1 */}
                <div className="text-xs text-slate-500 font-bold shrink-0">
                  <span className="text-slate-900 font-bold">{filteredPlaces.length} prospects</span> · <span className="text-emerald-600 font-bold">${totalValue.toFixed(1)}k potential monthly value</span>
                </div>
              </div>
            </div>

            {/* Prospects Cards List */}
            <div className="space-y-4">
              {placesLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50/20 rounded-xl border border-slate-100">
                  <Loader2 className="animate-spin text-indigo-600 mb-2" size={28} />
                  <span className="text-xs font-semibold">Scanning coordinates for commercial entities...</span>
                </div>
              ) : filteredPlaces.length === 0 ? (
                <div className="text-center py-16 text-slate-400 font-bold bg-slate-50/40 rounded-xl border border-dashed border-slate-200">
                  No prospects found within {radiusMiles} km. Try increasing the radius slider.
                </div>
              ) : (
                filteredPlaces.map((p, index) => {
                  const styles = getPlaceIconStyles(p.type);
                  const PlaceIcon = styles.icon;
                  return (
                    <div
                      key={index}
                      onClick={() => setSelectedProspect(p)}
                      className="bg-white rounded-xl border border-slate-100 p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all group cursor-pointer active:scale-[0.995]"
                    >
                      {/* Card Header Row */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          {/* Left Colored Icon Block */}
                          <div className={`w-12 h-12 rounded-xl border ${styles.bg} flex items-center justify-center shrink-0`}>
                            <PlaceIcon size={18} />
                          </div>

                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-slate-400">#{index + 1}</span>
                              <h3 className="text-md font-bold text-slate-950 truncate leading-tight">{p.name}</h3>
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase bg-slate-100 text-slate-500 border border-slate-200/40">
                                {p.badge}
                              </span>
                            </div>

                            <p className="text-xs text-slate-400 font-bold flex items-center gap-1 flex-wrap">
                              <MapPin size={12} className="text-slate-300" />
                              {p.address}
                              <span className="text-slate-300">·</span>
                              <span>{p.distanceMiles} km</span>
                              {p.capacityText && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span>{p.capacityText}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Right Potential Badge */}
                        <div className="text-right shrink-0">
                          <span className="text-xl font-bold text-emerald-600 leading-none">${p.potentialValue}k</span>
                          <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">/mo potential</p>
                        </div>
                      </div>

                      {/* Outreach Angle Card */}
                      <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl px-4 py-3 text-xs font-bold text-indigo-950 flex items-center gap-2">
                        <span className="text-indigo-500 shrink-0">✨ Outreach angle:</span>
                        <span>{p.outreachAngle}</span>
                      </div>

                      {/* Contacts Footer Grid */}
                      <div className="flex items-center gap-x-5 gap-y-2 flex-wrap text-xs text-slate-500 font-bold border-t border-slate-50 pt-3">
                        <span className="text-slate-950 font-bold">{p.contactName}</span>
                        <span className="flex items-center gap-1">
                          <Mail size={12} className="text-slate-300" />
                          <a href={`mailto:${p.email}`} onClick={(e) => e.stopPropagation()} className="hover:text-indigo-600 underline">{p.email}</a>
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone size={12} className="text-slate-300" />
                          <a href={`tel:${p.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-indigo-600">{p.phone}</a>
                        </span>
                        <span className="flex items-center gap-1">
                          <Globe size={12} className="text-slate-300" />
                          <a href={`https://${p.website}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="hover:text-indigo-600 underline">{p.website}</a>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
