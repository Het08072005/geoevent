import React, { useEffect } from 'react';
import {
  MapPin,
  Users,
  ArrowLeft,
  Mail,
  Phone,
  ExternalLink,
  Sparkles,
  Bed,
  GraduationCap,
  HeartPulse,
  Briefcase,
  Dumbbell,
  Building2,
  DollarSign,
  Globe,
  Lightbulb,
  Zap,
  Ticket
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet map marker icon configs matching the rest of the application
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
  iconSize: [35, 57],
  iconAnchor: [17, 57],
  popupAnchor: [1, -50],
  shadowSize: [41, 41]
});

export default function ProspectDetailView({ prospect, currentStore, onBack, getPlaceIconStyles }) {
  useEffect(() => {
    // Scroll container to top when loading a prospect
    const container = document.querySelector('.overflow-y-auto');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [prospect]);

  if (!prospect) return null;

  const styles = getPlaceIconStyles(prospect.type);
  const ProspectIcon = styles.icon;

  // Dynamically calculate detailed opportunity metrics
  const annualPotential = (prospect.potentialValue * 12).toFixed(1);
  const avgTicket = currentStore?.avgTicket || 38;

  // Geolocation fallback
  const prospectLat = prospect.lat || currentStore.lat + 0.003;
  const prospectLon = prospect.lon || currentStore.lon + 0.003;

  // Generate hyper-targeted recommendations based on the prospect business type
  const getPitches = (type) => {
    switch (type) {
      case 'hotel':
        return [
          "Get listed in the concierge's preferred restaurant guide.",
          "Place a branded menu insert in the in-room dining folder.",
          "Pitch group catering for hotel-hosted weddings & conferences."
        ];
      case 'school':
        return [
          "Set up a weekly 'Teacher Appreciation' box delivery program.",
          "Partner with the PTA for catering parent-teacher night dinners.",
          "Offer a custom box-lunch menu for off-campus class field trips."
        ];
      case 'university':
        return [
          "Launch a student meal-deal subscription for student associations.",
          "Establish an exclusive catering contract for faculty departments.",
          "Set up a branded pop-up station during graduation/orientation week."
        ];
      case 'hospital':
        return [
          "Promote bulk night-shift dining packages for nursing staff.",
          "Secure a recurring lunch-catering contract with administration heads.",
          "Offer custom patient-family discount vouchers to cafeteria staff."
        ];
      case 'coworking':
        return [
          "Sponsor a recurring 'Midweek Networking Breakfast' with pastries.",
          "Provide premium, pre-ordered lunch boxes for conference rooms.",
          "Offer coworking members a 10% discount during off-peak hours."
        ];
      case 'gym':
        return [
          "Collaborate on a co-branded post-workout protein bowl menu.",
          "Distribute high-protein meal-prep pamphlets at the front desk.",
          "Sponsor fitness challenges with gift card rewards for top members."
        ];
      default:
        return [
          "Pitch corporate lunch catering subscriptions for departments.",
          "Deliver a weekly 'Friday Happy Hour' catering package.",
          "Set up individual corporate account billing for client lunches."
        ];
    }
  };

  const pitches = getPitches(prospect.type);

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#f8fafc] custom-scrollbar pb-24">
      {/* Back Button Link */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-xs transition-colors group"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

      {/* Profile Cover Header Card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div className="flex items-center gap-5 min-w-0">
          {/* Main Logo badge */}
          <div className={`w-14 h-14 rounded-2xl border ${styles.bg} flex items-center justify-center shrink-0 shadow-sm`}>
            <ProspectIcon size={24} />
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 border border-indigo-100 text-indigo-600">
                {prospect.badge}
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {prospect.distanceMiles} mi from {currentStore.name}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-slate-950 tracking-tight leading-none">
              {prospect.name}
            </h1>

            <p className="text-xs text-slate-400 font-bold flex items-center gap-1">
              <MapPin size={12} className="text-slate-300 shrink-0" />
              {prospect.address}
            </p>
          </div>
        </div>

        {/* Potential Label Card */}
        <div className="text-left md:text-right shrink-0 bg-emerald-50/40 border border-emerald-100/50 rounded-2xl px-5 py-3 md:py-4">
          <span className="text-2xl md:text-3xl font-black text-emerald-600 leading-none">
            ${prospect.potentialValue}k
          </span>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1">
            /mo potential
          </p>
        </div>
      </div>

      {/* Four Stats Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Size Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Users size={14} className="text-slate-300" />
            <span className="text-[10px] font-black uppercase tracking-wider">Size</span>
          </div>
          <p className="text-lg font-bold text-slate-900 leading-tight">
            {prospect.capacityText}
          </p>
        </div>

        {/* Distance Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <MapPin size={14} className="text-slate-300" />
            <span className="text-[10px] font-black uppercase tracking-wider">Distance</span>
          </div>
          <p className="text-lg font-bold text-slate-900 leading-tight">
            {prospect.distanceMiles} mi
          </p>
          <p className="text-[10px] text-slate-400 font-bold">from your store</p>
        </div>

        {/* Monthly Potential Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <DollarSign size={14} className="text-slate-300" />
            <span className="text-[10px] font-black uppercase tracking-wider">Monthly Potential</span>
          </div>
          <p className="text-lg font-bold text-slate-900 leading-tight">
            ${prospect.potentialValue}k
          </p>
        </div>

        {/* Annual Potential Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <TrendingUpIcon className="text-slate-300 w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-wider">Annual Potential</span>
          </div>
          <p className="text-lg font-bold text-slate-900 leading-tight">
            ${annualPotential}k
          </p>
        </div>
      </div>

      {/* Split Core Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Location & Outreach Angle Info Box */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col justify-between shadow-sm min-h-[320px]">
          <div className="space-y-4">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <MapPin size={16} className="text-indigo-600" />
              Location Details
            </h2>

            <div className="space-y-3">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Postal Address</p>
                <p className="text-xs font-bold text-slate-800 mt-1 leading-relaxed">{prospect.address}</p>
              </div>

              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Map Coordinates</p>
                <p className="text-xs font-semibold text-slate-500 mt-1 font-mono tracking-tight">{prospectLat.toFixed(5)}, {prospectLon.toFixed(5)}</p>
              </div>
            </div>
          </div>

          {/* Large Outreach Angle Banner */}
          <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-4 mt-6">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles size={14} className="text-indigo-600 shrink-0" />
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Outreach Angle</span>
            </div>
            <p className="text-xs font-bold text-indigo-950 leading-relaxed">
              {prospect.outreachAngle}
            </p>
          </div>
        </div>

        {/* High-Fidelity Location Mini Map Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm h-[320px] flex flex-col">
          <div className="w-full h-full rounded-xl overflow-hidden relative z-0 border border-slate-100">
            <MapContainer
              center={[prospectLat, prospectLon]}
              zoom={14}
              className="w-full h-full"
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              
              {/* Prospect Location Marker */}
              <Marker position={[prospectLat, prospectLon]} icon={BlueIcon}>
                <Popup>
                  <div className="p-1 font-sans">
                    <p className="text-xs font-bold text-slate-900 leading-snug">{prospect.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">{prospect.badge}</p>
                  </div>
                </Popup>
              </Marker>

              {/* Store Location Marker */}
              <Marker position={[currentStore.lat, currentStore.lon]} icon={RedIcon}>
                <Popup>
                  <div className="p-1 font-sans">
                    <p className="text-xs font-bold text-slate-900 leading-snug">{currentStore.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">YOUR STORE</p>
                  </div>
                </Popup>
              </Marker>

              {/* Radial Proximity Buffer Area Circle */}
              <Circle
                center={[currentStore.lat, currentStore.lon]}
                radius={Math.max(100, parseFloat(prospect.distanceMiles || '0.5') * 1609.34)}
                pathOptions={{
                  fillColor: '#6366f1',
                  fillOpacity: 0.1,
                  color: '#4f46e5',
                  weight: 1.5,
                  dashArray: '5, 5'
                }}
              />
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Opportunity Sizing Section */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <TargetIcon className="text-slate-900 w-4 h-4" />
          Opportunity sizing
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-2">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Audience</p>
            <p className="text-lg font-black text-slate-950 mt-1 uppercase">{prospect.capacityText}</p>
          </div>

          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Avg Ticket</p>
            <p className="text-lg font-black text-slate-950 mt-1">${avgTicket}</p>
          </div>

          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Monthly Potential</p>
            <p className="text-lg font-black text-emerald-600 mt-1">${prospect.potentialValue}k</p>
          </div>

          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Annual Potential</p>
            <p className="text-lg font-black text-emerald-600 mt-1">${annualPotential}k</p>
          </div>
        </div>
      </div>

      {/* Recommended Pitches Segment */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Lightbulb size={16} className="text-amber-500" />
          Recommended pitches
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pitches.map((pitch, idx) => (
            <div key={idx} className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 flex gap-3 group hover:bg-slate-50/85 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/40 flex items-center justify-center shrink-0 shadow-sm text-indigo-600">
                <Sparkles size={14} />
              </div>
              <p className="text-xs font-bold text-slate-700 leading-relaxed self-center">
                {pitch}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Contact & Outreach Channels Card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200/40 flex items-center justify-center text-slate-400 font-bold text-sm shrink-0 shadow-inner">
            {prospect.contactName ? prospect.contactName.split(' ').map(n => n[0]).join('') : 'C'}
          </div>

          <div className="space-y-1 min-w-0">
            <h3 className="text-md font-bold text-slate-900 leading-none">
              {prospect.contactName}
            </h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              {prospect.badge} • {prospect.name}
            </p>

            <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500 font-bold pt-1">
              <span className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                <Mail size={12} className="text-slate-300" />
                <a href={`mailto:${prospect.email}`} className="underline">{prospect.email}</a>
              </span>
              <span className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                <Phone size={12} className="text-slate-300" />
                <a href={`tel:${prospect.phone}`}>{prospect.phone}</a>
              </span>
            </div>
          </div>
        </div>

        {/* Outreach Trigger Actions */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0 w-full md:w-auto">
          <a
            href={`mailto:${prospect.email}`}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-colors uppercase tracking-wider shadow-md hover:shadow-lg"
          >
            <Mail size={12} />
            Email
          </a>

          <a
            href={`tel:${prospect.phone}`}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black transition-colors uppercase tracking-wider shadow-sm"
          >
            <Phone size={12} />
            Call
          </a>

          <a
            href={`https://${prospect.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black transition-colors uppercase tracking-wider shadow-sm"
          >
            <ExternalLink size={12} />
            Website
          </a>
        </div>
      </div>
    </div>
  );
}

// Simple internal icon helper wrappers to avoid custom file loads
function TrendingUpIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28-2.28 5.941" />
    </svg>
  );
}

function TargetIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M12 12m-9 0a9 9 0 1118 0 9 9 0 01-18 0" />
    </svg>
  );
}
