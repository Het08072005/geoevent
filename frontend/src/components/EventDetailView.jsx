import React, { useEffect } from 'react';
import { MapPin, Calendar, Clock, Users, ArrowLeft, Mail, Phone, ExternalLink, ArrowUpRight, Sparkles, Trophy, Music, PartyPopper, Flag, Presentation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom Map Markers
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

export default function EventDetailView({ event, currentStore, onBack, fmtDate, fmtTime, getCategoryStyles, getCategoryDetails, GEOAPIFY_KEY }) {
  useEffect(() => {
    // Scroll to top of the scrollable container when an event is loaded
    const container = document.querySelector('.overflow-y-auto');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [event]);

  if (!event) return null;

  const parseLocalISO = (iso) => {
    if (!iso) return null;
    try {
      const [date, time] = iso.split('T');
      const [y, m, d] = date.split('-').map(Number);
      const [h, min] = (time || '00:00').split(':').map(Number);
      return new Date(y, m - 1, d, h, min);
    } catch { return null; }
  };

  // Calculate detailed parameters — use pre-computed enriched values when available
  const distanceMiles = event.distanceMiles || (event.distance ? (event.distance / 1609.34).toFixed(2) : null);
  const attendanceVal = (event.attendance && event.attendance !== 'TBA') ? parseInt(event.attendance) : null;
  const liftVal = event.lift ? (event.lift >= 1000 ? `$${(event.lift / 1000).toFixed(1)}k` : `$${event.lift}`) : null;
  const coversVal = event.covers || null;
  const avgTicketVal = currentStore?.avgTicket || 38;
  const captureRateVal = event.convRate || ((coversVal && attendanceVal) ? ((coversVal / attendanceVal) * 100).toFixed(2) : null);

  // Duration text calculation
  const startD = parseLocalISO(event.date);
  const endD = parseLocalISO(event.end_date);
  let durationText = null;
  if (startD && endD) {
    const diffMs = endD - startD;
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours > 0) {
      if (diffHours <= 24) {
        durationText = `${diffHours.toFixed(1).replace('.0', '')}h duration`;
      } else {
        durationText = "Multi-day Event";
      }
    }
  }

  // ─── DYNAMIC RECOMMENDED ACTIONS ALGORITHM ─────────────────────────────────
  // NO Gemini AI — pure logic-based recommendations based on event properties
  const generateRecommendedActions = () => {
    const actions = [];
    const cat = (event.categoryClean || '').toLowerCase();
    const att = parseInt(event.attendance) || 0;
    const isPaid = event.is_paid || event.price?.toLowerCase?.() !== 'free';
    const startDate = parseLocalISO(event.date);
    const eventHour = startDate?.getHours() || 0;
    const eventDay = startDate?.getDay() || 0; // 0 = Sunday, 6 = Saturday
    const isWeekend = eventDay === 0 || eventDay === 6;
    const isMorning = eventHour < 12;
    const isAfternoon = eventHour >= 12 && eventHour < 18;
    const isEvening = eventHour >= 18;
    const lift = event.lift || 0;
    const coversVal = event.covers || 0;

    // ─────────────────────────────────────────────────────────────────────────

    // MUSIC/CONCERT — Focus on bar/beverage and post-event partnerships
    if (cat.includes('music') || cat.includes('concert') || cat.includes('dj')) {
      if (isEvening && att > 300) {
        actions.push({
          title: "Launch happy hour specials",
          desc: `Bundle craft cocktails + small plates ($2 discount) to capture ${att > 800 ? 'high-volume' : 'mid-volume'} pre-event crowd.`,
          priority: "HIGH",
          color: "text-emerald-600 bg-emerald-50 border-emerald-100"
        });
      }
      if (att > 500 && isPaid) {
        actions.push({
          title: "Partner as official after-party spot",
          desc: "Pitch exclusive venue partnership to organizer for post-event VIP access (premium pricing opportunity).",
          priority: "HIGH",
          color: "text-emerald-600 bg-emerald-50 border-emerald-100"
        });
      } else {
        actions.push({
          title: "Extend service hours late-night",
          desc: "Stay open extra 2 hours past event end to capture post-concert crowd flowing to nearby venues.",
          priority: "MEDIUM",
          color: "text-amber-600 bg-amber-50 border-amber-100"
        });
      }
      if (isWeekend) {
        actions.push({
          title: "Create event-themed drink menu",
          desc: "Design limited-time signature drink/appetizer combo tied to artist/genre for social media buzz.",
          priority: "MEDIUM",
          color: "text-amber-600 bg-amber-50 border-amber-100"
        });
      }
    }

    // SPORTS — Focus on pre/post-game dining and viewing parties
    if (cat.includes('sport') || cat.includes('game') || cat.includes('match') || cat.includes('soccer') || cat.includes('baseball')) {
      if (isEvening) {
        actions.push({
          title: "Launch game-day prix-fixe",
          desc: `Bundle 2 entrées + shareables priced for fans heading to/from the venue (${coversVal > 0 ? coversVal + ' estimated covers' : 'projected audience: ' + att}).`,
          priority: "HIGH",
          color: "text-emerald-600 bg-emerald-50 border-emerald-100"
        });
      }
      if (att > 200) {
        actions.push({
          title: "Extend kitchen hours post-game",
          desc: `Stay open ${isEvening ? '90 min' : '2 hours'} past final whistle to capture post-game crowd. Peak = ${att > 1000 ? 'very high' : 'high'} volume.`,
          priority: "MEDIUM",
          color: "text-amber-600 bg-amber-50 border-amber-100"
        });
      }
      actions.push({
        title: "Pitch watch-party sponsorship",
        desc: "Contact organizer about official watch-party partnership with branded seating/specials.",
        priority: "MEDIUM",
        color: "text-amber-600 bg-amber-50 border-amber-100"
      });
    }

    // FOOD & FESTIVAL — Focus on cross-promotion and sampler menus
    if (cat.includes('food') || cat.includes('festival') || cat.includes('tasting') || cat.includes('culinary')) {
      if (att > 500 || coversVal > 100) {
        actions.push({
          title: "Create collaborative sampler booth",
          desc: `Set up branded tasting booth at event with QR code for exclusive ${isPaid ? 'discounts' : 'loyalty rewards'} driving post-event traffic.`,
          priority: "HIGH",
          color: "text-emerald-600 bg-emerald-50 border-emerald-100"
        });
      }
      actions.push({
        title: "Cross-promote featured menu items",
        desc: "Coordinate with event organizer to feature your signature dish/ingredient in event program.",
        priority: "MEDIUM",
        color: "text-amber-600 bg-amber-50 border-amber-100"
      });
      if (isMorning || isAfternoon) {
        actions.push({
          title: "Partner on post-event chef talk",
          desc: "Offer venue for organizer's chef speaker panel to drive foot traffic post-tasting.",
          priority: "LOW",
          color: "text-blue-600 bg-blue-50 border-blue-100"
        });
      }
    }

    // BUSINESS/CONFERENCE — Focus on networking and premium services
    if (cat.includes('conference') || cat.includes('business') || cat.includes('workshop') || cat.includes('seminar')) {
      const isWeekday = !isWeekend;
      if (isWeekday) {
        actions.push({
          title: "Offer attendee networking breakfast/lunch",
          desc: `Partner to provide ${isPaid ? 'premium catering' : 'coffee + pastry station'} during networking breaks (${att > 500 ? 'high' : 'moderate'} volume).`,
          priority: "HIGH",
          color: "text-emerald-600 bg-emerald-50 border-emerald-100"
        });
      }
      actions.push({
        title: "Sponsor executive dinner",
        desc: "Pitch invitation-only dinner for VIP attendees/speakers at premium pricing.",
        priority: "MEDIUM",
        color: "text-amber-600 bg-amber-50 border-amber-100"
      });
      actions.push({
        title: "Capture attendee emails for CRM",
        desc: "Set up exclusive discount code at event to build email list + track ROI from attendees.",
        priority: "MEDIUM",
        color: "text-amber-600 bg-amber-50 border-amber-100"
      });
    }

    // ARTS/THEATER — Focus on ambiance, pre/post-show dining
    if (cat.includes('art') || cat.includes('theater') || cat.includes('exhibition') || cat.includes('comedy')) {
      if (isEvening) {
        actions.push({
          title: "Create pre-show prix-fixe",
          desc: `Offer ${eventHour >= 19 ? '2-course' : '3-course'} menu ending 30 min before showtime for attendees.`,
          priority: "HIGH",
          color: "text-emerald-600 bg-emerald-50 border-emerald-100"
        });
      }
      actions.push({
        title: "Host post-show wine & dessert bar",
        desc: "Stay open 2 hours post-event with themed wine selection + signature desserts for sophisticated crowd.",
        priority: "MEDIUM",
        color: "text-amber-600 bg-amber-50 border-amber-100"
      });
      if (att > 300) {
        actions.push({
          title: "Pitch artist/director partnership",
          desc: "Offer exclusive pre-show VIP lounge access or custom menu collaboration with organizer.",
          priority: "MEDIUM",
          color: "text-amber-600 bg-amber-50 border-amber-100"
        });
      }
    }

    // EDUCATION/TRAINING — Focus on professional development partnerships
    if (cat.includes('education') || cat.includes('training') || cat.includes('course')) {
      actions.push({
        title: "Offer attendee study break venue",
        desc: `Partner to provide quiet lounge + refreshments during multi-day event (${att > 200 ? 'bulk' : 'per-person'} pricing).`,
        priority: "HIGH",
        color: "text-emerald-600 bg-emerald-50 border-emerald-100"
      });
      actions.push({
        title: "Sponsor lunch-and-learn session",
        desc: "Host educational content session at venue to position brand as thought leader.",
        priority: "MEDIUM",
        color: "text-amber-600 bg-amber-50 border-amber-100"
      });
    }

    // COMMUNITY/SOCIAL — Focus on group bookings and loyalty
    if (cat.includes('community') || cat.includes('social') || cat.includes('meetup')) {
      if (att > 100) {
        actions.push({
          title: "Create group dining package",
          desc: `Pitch preset group menu + table reservation (${att > 500 ? 'premium markup' : 'modest discount'} to maximize covers).`,
          priority: "HIGH",
          color: "text-emerald-600 bg-emerald-50 border-emerald-100"
        });
      }
      actions.push({
        title: "Offer event attendees loyalty signup",
        desc: "Place branded signup cards at event for exclusive discounts + future promotions.",
        priority: "MEDIUM",
        color: "text-amber-600 bg-amber-50 border-amber-100"
      });
    }

    // FALLBACK — Generic high-value recommendations if no specific category match
    if (actions.length === 0) {
      if (att > 500 || lift > 1000) {
        actions.push({
          title: "Launch exclusive event package",
          desc: `Create special menu/pricing for event attendees to capture high-volume opportunity (${att} expected attendees).`,
          priority: "HIGH",
          color: "text-emerald-600 bg-emerald-50 border-emerald-100"
        });
      }
      actions.push({
        title: "Pitch co-marketing partnership",
        desc: "Contact event organizer about cross-promotion via email/social to drive mutual traffic.",
        priority: "MEDIUM",
        color: "text-amber-600 bg-amber-50 border-amber-100"
      });
      actions.push({
        title: "Set up promotional presence at event",
        desc: "Sponsor booth/table with staff to hand out coupons + drive foot traffic post-event.",
        priority: "MEDIUM",
        color: "text-amber-600 bg-amber-50 border-amber-100"
      });
    }

    // Return top 3 actions only (prioritize HIGH > MEDIUM > LOW)
    const sorted = actions.sort((a, b) => {
      const priorityScore = { "HIGH": 3, "MEDIUM": 2, "LOW": 1 };
      return (priorityScore[b.priority] || 0) - (priorityScore[a.priority] || 0);
    });

    return sorted.slice(0, 3);
  };

  const recommendedActions = generateRecommendedActions();

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#f8fafc] custom-scrollbar pb-24">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-100 text-xs font-bold text-slate-700 hover:text-slate-900 shadow-sm hover:shadow transition-all w-fit"
      >
        <ArrowLeft size={14} /> Back
      </button>

      {/* Main header banner card matching Image 2 */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div className="flex items-center gap-6 w-full md:w-auto">
          {/* Green premium badge */}
          <div className="w-16 h-16 bg-emerald-500 text-white rounded-xl flex flex-col items-center justify-center shadow border border-emerald-600 shrink-0">
            <span className="text-2xl font-bold leading-none">{event.score || 95}</span>
          </div>

          <div className="space-y-1">
            {(() => {
              const details = getCategoryDetails ? getCategoryDetails(event.categoryClean) : { label: event.categoryClean, icon: Trophy, colors: getCategoryStyles(event.categoryClean) };
              const BadgeIcon = details.icon;
              return (
                <>
                  <div className="flex items-center gap-2 flex-wrap text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <span className={`text-[10px] font-bold tracking-tight px-2 py-1 rounded-full flex items-center gap-1 leading-none shadow-sm ${details.colors}`}>
                      <BadgeIcon size={11} className="stroke-[2.25]" />
                      <span>{details.label}</span>
                    </span>
                    <span>{distanceMiles ? `${distanceMiles} km from ${currentStore?.name || 'Store'}` : 'Distance Not Available'}</span>
                  </div>
                  <h1 className="text-2xl font-bold text-slate-950 leading-tight mt-1">{event.name}</h1>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 font-medium mt-1">
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 font-semibold">Price: {event.price || 'Not Available'}</span>
                    <span>·</span>
                    <span className="capitalize font-semibold">{details.label} Event</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Big projected lift metrics */}
        <div className="flex flex-col items-end shrink-0 w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
          <span className="text-3xl font-bold text-slate-900">{liftVal || 'Not Available'}</span>
          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Projected Lift</span>
        </div>
      </div>

      {/* 4 parameters cards grid matching Image 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2 shadow-sm">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Calendar size={10} className="text-slate-400" /> Date
          </p>
          <p className="text-sm font-bold text-slate-900">{fmtDate(event.date)}</p>
        </div>

        {/* Time Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2 shadow-sm">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Clock size={10} className="text-slate-400" /> Time
          </p>
          <p className="text-sm font-bold text-slate-900">
            {fmtTime(event.date)}{event.end_date ? ` – ${fmtTime(event.end_date)}` : ''}
          </p>
          {durationText && <p className="text-[10px] text-slate-400 font-semibold">{durationText}</p>}
        </div>

        {/* Attendance Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2 shadow-sm">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Users size={10} className="text-slate-400" /> Expected attendance
          </p>
          <p className="text-sm font-bold text-slate-900">
            {attendanceVal ? `${attendanceVal.toLocaleString()} people` : 'Not Available'}
          </p>
        </div>

        {/* Distance Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2 shadow-sm">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <MapPin size={10} className="text-slate-400" /> Distance
          </p>
          <p className="text-sm font-bold text-slate-900">
            {distanceMiles ? `${distanceMiles} km` : 'Not Available'}
          </p>
          <p className="text-[10px] text-slate-400 font-semibold">from your store</p>
        </div>
      </div>

      {/* Location card and map row matching Image 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overview & Location Details Panel */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <p className="text-[9px] font-semibold text-indigo-600 uppercase tracking-widest flex items-center gap-1">
              <Sparkles size={12} /> Overview / Description
            </p>
            <div className="max-h-36 overflow-y-auto pr-2 custom-scrollbar text-xs text-slate-600 font-medium leading-relaxed whitespace-pre-line">
              {event.description || 'No detailed description available from the source.'}
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <p className="text-[9px] font-semibold text-indigo-600 uppercase tracking-widest flex items-center gap-1">
              <MapPin size={12} /> Venue & Coordinates
            </p>
            {event.venue_name && <h4 className="text-xs font-semibold text-slate-800">{event.venue_name}</h4>}
            <h3 className="text-sm font-bold text-slate-900 leading-tight">{event.address || 'Venue TBA'}</h3>
            {event.lat && event.lon && (
              <p className="text-[10px] text-slate-400 font-semibold leading-none">{event.lat.toFixed(4)}, {event.lon.toFixed(4)}</p>
            )}
          </div>
        </div>

        {/* Map Container */}
        <div className="w-full h-64 lg:h-auto min-h-[16rem] rounded-xl overflow-hidden border border-slate-100 bg-white relative shadow-sm z-0">
          <MapContainer center={event.lat && event.lon ? [event.lat, event.lon] : [currentStore.lat, currentStore.lon]} zoom={13} className="w-full h-full" zoomControl={false}>
            <TileLayer url={`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`} />
            <ZoomControl position="bottomright" />

            {/* Store Marker */}
            {currentStore && (
              <Marker position={[currentStore.lat, currentStore.lon]} icon={YellowIcon}>
                <Popup closeButton={false}>
                  <div className="p-1 text-center">
                    <p className="text-[8px] font-semibold text-indigo-600 uppercase mb-0.5">Your Store</p>
                    <p className="text-[10px] font-semibold text-slate-800 leading-none">{currentStore.name}</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Event Marker */}
            {event.lat && event.lon && (
              <>
                <Marker position={[event.lat, event.lon]} icon={BlueIcon}>
                  <Popup closeButton={false}>
                    <div className="p-1">
                      <p className="font-bold text-slate-850 text-[11px] leading-tight">{event.name}</p>
                    </div>
                  </Popup>
                </Marker>

                {/* Radius Circle */}
                <Circle
                  center={[event.lat, event.lon]}
                  radius={event.distance || 1000}
                  pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.05, weight: 1.5 }}
                />
              </>
            )}
          </MapContainer>
        </div>
      </div>

      {/* Revenue Projection Card matching Image 3 */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ArrowUpRight size={18} className="text-indigo-500" /> Revenue projection
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Projected lift</p>
            <p className="text-2xl font-bold text-slate-950">{liftVal || 'Not Available'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Extra covers</p>
            <p className="text-2xl font-bold text-slate-950">{coversVal ? `+${coversVal}` : 'Not Available'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Capture rate</p>
            <p className="text-2xl font-bold text-slate-950">{captureRateVal ? `${captureRateVal}%` : 'Not Available'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Avg ticket</p>
            <p className="text-2xl font-bold text-slate-950">{event.price || `$${avgTicketVal}`}</p>
          </div>
        </div>
      </div>

      {/* Recommended Actions Cards matching Image 3 */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-500" /> Recommended actions
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {recommendedActions.map((act, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow transition-all">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-950">{act.title}</h4>
                  <span className={`text-[8px] font-semibold px-2 py-0.5 rounded-full border ${act.color}`}>
                    {act.priority}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">{act.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Organizer details section matching Image 3 */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <p className="text-[9px] font-semibold text-indigo-600 uppercase tracking-widest">Organizer</p>
          <h3 className="text-lg font-bold text-slate-900">{event.organizer_name || 'Not Available'}</h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xl">
            {event.organizer_description || 'No detailed organizer description available.'}
          </p>
          <div className="flex flex-wrap gap-x-4 pt-2 text-xs text-slate-400 font-medium">
            {event.organizer_email ? (
              <span className="flex items-center gap-1 text-slate-500"><Mail size={12} /> {event.organizer_email}</span>
            ) : (
              <span className="flex items-center gap-1 text-slate-300"><Mail size={12} /> Email: Not Available</span>
            )}
            {event.organizer_phone ? (
              <span className="flex items-center gap-1 text-slate-500"><Phone size={12} /> {event.organizer_phone}</span>
            ) : (
              <span className="flex items-center gap-1 text-slate-300"><Phone size={12} /> Phone: Not Available</span>
            )}
          </div>
        </div>

        {/* Buttons: Email, Call, Website (Website redirecting directly!) */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto shrink-0 pt-4 md:pt-0">
          {event.organizer_email && (
            <a
              href={`mailto:${event.organizer_email}`}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-50 border border-slate-150 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-all text-center"
            >
              <Mail size={13} /> Email
            </a>
          )}
          {event.organizer_phone && (
            <a
              href={`tel:${event.organizer_phone}`}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-50 border border-slate-150 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-all text-center"
            >
              <Phone size={13} /> Call
            </a>
          )}
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noreferrer"
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-50 border border-slate-150 rounded-xl text-xs font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all text-center"
            >
              <ExternalLink size={13} /> Website
            </a>
          )}
        </div>
      </div>

      {/* Footer Details */}
      <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row justify-between text-xs text-slate-500 font-medium gap-2">
        <span className="flex items-center gap-1">
          Source: {event.source_website || event.url ? (
            <a
              href={event.source_website || event.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-colors"
            >
              <span>{event.source_domain || event.organizer_name || 'Event Source'}</span>
              <ExternalLink size={11} className="shrink-0" />
            </a>
          ) : (
            <span>{event.source_domain || event.organizer_name || 'Event Source'}</span>
          )}
        </span>
        <span>Event ID: {event.id || 'N/A'}</span>
      </div>
    </div>
  );
}
