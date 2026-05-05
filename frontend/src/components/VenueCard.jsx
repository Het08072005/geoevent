import React, { useState } from 'react';
import {
  MapPin, Calendar, Clock, Users, ChevronDown, ChevronUp,
  ExternalLink, Building2, DollarSign, User, Tag
} from 'lucide-react';

// Parse local datetime string (2026-05-09T08:30:00) without UTC shift
function parseLocalISO(iso) {
  if (!iso) return null;
  try {
    const [date, time] = iso.split('T');
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = (time || '00:00').split(':').map(Number);
    return new Date(y, m - 1, d, h, min);
  } catch { return null; }
}

function fmtDate(iso) {
  const d = parseLocalISO(iso);
  if (!d) return 'TBA';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtTime(iso) {
  const d = parseLocalISO(iso);
  if (!d) return 'TBA';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function distKm(meters) {
  if (meters == null) return null;
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)} km`;
}

const CATEGORY_STYLE = {
  sports:      'bg-orange-50 text-orange-600',
  music:       'bg-purple-50 text-purple-600',
  food:        'bg-yellow-50 text-yellow-700',
  conference:  'bg-blue-50 text-blue-700',
  business:    'bg-blue-50 text-blue-700',
  community:   'bg-green-50 text-green-700',
};

export const VenueCard = ({ venue }) => {
  const [open, setOpen] = useState(false);

  const dateStr  = fmtDate(venue.date);
  const startStr = fmtTime(venue.date);
  const endStr   = fmtTime(venue.end_date);
  const dist     = distKm(venue.distance);
  const price    = venue.price || 'Free';
  const isPaid   = !!venue.is_paid;
  const cap      = venue.attendance !== 'TBA' ? venue.attendance : null;
  const catStyle = CATEGORY_STYLE[venue.category?.toLowerCase()] || 'bg-slate-50 text-slate-600';
  const imgSrc   = venue.image_url ||
    `https://picsum.photos/seed/${encodeURIComponent((venue.name || '').slice(0, 20).replace(/\s+/g, ''))}/640/320`;
  const href     = venue.url || '#';

  return (
    <div className={`bg-white rounded-2xl border transition-all overflow-hidden
      ${open ? 'border-indigo-300 shadow-[0_4px_24px_rgba(99,102,241,0.12)]' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}>

      {/* ─── Collapsed Row ────────────────────────────────────────────── */}
      <div className="flex min-h-[100px]">

        {/* Thumbnail */}
        <div className="relative w-32 sm:w-40 shrink-0 bg-slate-100 overflow-hidden">
          <img
            src={imgSrc}
            alt={venue.name}
            className="w-full h-full object-cover"
            onError={e => {
              e.target.src = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=400&h=250';
            }}
          />
          {dist && (
            <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <MapPin size={8} />{dist}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0 px-4 py-3 flex flex-col justify-between">
          {/* Top */}
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {venue.category && (
                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${catStyle}`}>
                  {venue.category}
                </span>
              )}
            </div>
            <h3 className="text-[15px] font-bold text-slate-900 leading-snug line-clamp-2">
              {venue.name}
            </h3>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            <span className="flex items-center gap-1 text-[12px] text-slate-500 font-medium">
              <Calendar size={11} className="text-indigo-400" />
              {dateStr}
              {startStr !== 'TBA' && (
                <><span className="text-slate-300 mx-0.5">·</span>
                <Clock size={10} className="text-slate-400" />
                {startStr}{endStr && endStr !== 'TBA' ? ` – ${endStr}` : ''}</>
              )}
            </span>
            {(venue.venue_name || venue.address) && (
              <span className="flex items-center gap-1 text-[12px] text-slate-400 font-medium max-w-[240px]">
                <MapPin size={10} className="shrink-0 text-slate-300" />
                <span className="truncate">{venue.venue_name || venue.address}</span>
              </span>
            )}
          </div>

          {/* Bottom: price + buttons */}
          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <span className={`flex items-center gap-1 text-sm font-black ${isPaid ? 'text-indigo-700' : 'text-green-600'}`}>
                <DollarSign size={13} className={isPaid ? 'text-indigo-500' : 'text-green-500'} />
                {price}
              </span>
              {cap && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  <Users size={10} />{cap} capacity
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setOpen(v => !v)}
                className={`flex items-center gap-1 text-[11px] font-black px-3 py-1.5 rounded-lg border transition-all
                  ${open
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
              >
                {open ? 'Close' : 'Show more'}
                {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                title="Open on Eventbrite"
              >
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Expanded Section ─────────────────────────────────────────── */}
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Left: About + Organizer */}
          <div className="space-y-4">
            {venue.description && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">About</p>
                <p className="text-[13px] text-slate-600 leading-relaxed">{venue.description}</p>
              </div>
            )}

            {/* Organizer */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Organizer</p>
              <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <User size={16} className="text-indigo-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-800 leading-tight">
                    {venue.organizer_name || 'Eventbrite Organizer'}
                  </p>
                  {venue.organizer_website && (
                    <a
                      href={venue.organizer_website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-indigo-500 hover:underline font-semibold truncate block"
                    >
                      {venue.organizer_website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Details table + Subway tip */}
          <div className="space-y-4">
            {/* Details */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Event Details</p>
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden text-[12px]">
                <Row icon={<Clock size={12} className="text-indigo-400" />} label="Time">
                  {startStr !== 'TBA'
                    ? `${startStr}${endStr && endStr !== 'TBA' ? ` – ${endStr}` : ''}`
                    : 'TBA'}
                </Row>
                <Row icon={<DollarSign size={12} className="text-green-500" />} label="Price">
                  <span className={isPaid ? 'text-indigo-700 font-black' : 'text-green-700 font-black'}>{price}</span>
                </Row>
                <Row icon={<Users size={12} className="text-amber-500" />} label="Capacity">
                  {cap ? `${cap} people` : 'Not disclosed'}
                </Row>
                {venue.venue_name && (
                  <Row icon={<Building2 size={12} className="text-slate-400" />} label="Venue">
                    {venue.venue_name}
                  </Row>
                )}
                {venue.address && (
                  <Row icon={<MapPin size={12} className="text-slate-400" />} label="Address">
                    <span className="text-right leading-tight">{venue.address}</span>
                  </Row>
                )}
                {dist && (
                  <Row icon={<MapPin size={12} className="text-indigo-400" />} label="Distance">
                    {dist} from store
                  </Row>
                )}
              </div>
            </div>

            {/* Manager tip */}
            <div className="bg-slate-900 rounded-xl p-4 text-white">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">🎯 Manager Tip</p>
              <p className="text-[13px] font-semibold leading-snug text-slate-200">
                {venue.category === 'sports'
                  ? 'Post-game rush likely. Boost meal deals & increase staffing 60 min before event ends.'
                  : cap && parseInt(cap) > 300
                    ? `${cap} attendees expected — consider proactive catering and bulk order outreach.`
                    : 'Moderate footfall expected. Promote loyalty rewards and combo deals.'}
              </p>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center justify-center gap-1.5 w-full text-[11px] font-bold text-slate-300 hover:text-white py-2 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
              >
                View Official Event <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Mini helper ────────────────────────────────────────────────────────────────
function Row({ icon, label, children }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-3">
      <span className="flex items-center gap-1.5 text-slate-500 font-semibold shrink-0">
        {icon}{label}
      </span>
      <span className="text-slate-800 font-bold text-right">{children}</span>
    </div>
  );
}
