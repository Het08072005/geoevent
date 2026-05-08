import React from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Users,
  TrendingUp,
  ChevronRight,
  Compass,
  Loader2,
  ChevronDown,
  Trophy,
  Music,
  PartyPopper,
  Flag,
  Presentation
} from 'lucide-react';
import EventDetailView from './EventDetailView';

export default function AllEventsView() {
  const {
    currentStore,
    radiusMiles,
    activeDays,
    setActiveDays,
    selectedCategory,
    setSelectedCategory,
    venues,
    loading,
    getMetrics,
    fmtDate,
    fmtTime,
    getCategoryStyles,
    getCategoryDetails,
    selectedEvent,
    setSelectedEvent,
    GEOAPIFY_KEY
  } = useOutletContext();

  const { totalEvents, enrichedVenues } = getMetrics();

  if (selectedEvent) {
    return (
      <EventDetailView
        event={selectedEvent}
        currentStore={currentStore}
        onBack={() => setSelectedEvent(null)}
        fmtDate={fmtDate}
        fmtTime={fmtTime}
        getCategoryStyles={getCategoryStyles}
        GEOAPIFY_KEY={GEOAPIFY_KEY}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#f8fafc] custom-scrollbar pb-24">
      
      {/* Header section matching All Events */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950 leading-none">All events</h1>
          <p className="text-xs text-slate-400 font-bold mt-2">
            Every event within {radiusMiles} miles of {currentStore.name}, ranked by revenue opportunity
          </p>
        </div>

        {/* Day filter dropdown */}
        <div className="flex items-center gap-3.5 bg-white p-2 px-5 rounded-full border border-slate-100 shadow-sm shrink-0">
          <span className="text-xs text-slate-400 font-semibold">{totalEvents} events in {activeDays === 0 ? "Today" : `${activeDays} days`}</span>
          <div className="w-px h-4 bg-slate-200/60 self-center"></div>
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
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2.5 items-center">
        {[
          { id: "", label: "All", icon: Compass, activeColors: "bg-slate-700 border-slate-800 text-white", inactiveColors: "bg-slate-50 border-slate-100/80 text-slate-600 hover:bg-slate-100" },
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center gap-1.5 leading-none border shadow-sm ${isActive ? cat.activeColors : cat.inactiveColors}`}
            >
              <Icon size={14} className="stroke-[2.25]" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Stream of all Event Cards matching Image 1 */}
      <div className="space-y-4">
        {loading ? (
          <div className="h-40 flex items-center justify-center bg-white rounded-xl border border-slate-100 shadow-sm">
            <Loader2 className="animate-spin text-indigo-500" />
          </div>
        ) : enrichedVenues.length > 0 ? (
          enrichedVenues
            .filter(v => selectedCategory === "" || v.categoryClean === selectedCategory)
            .map((v, idx) => {
              return (
                <div 
                  key={v.id || idx} 
                  onClick={() => setSelectedEvent(v)}
                  className="bg-white rounded-xl border border-slate-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 cursor-pointer group/card"
                >
                  <div className="flex items-start gap-6 flex-1 min-w-0 w-full">
                    {/* Green score badge */}
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[10px] font-semibold text-slate-400 mb-1">#{v.rank}</span>
                      <div className="w-16 h-16 bg-emerald-500 text-white rounded-xl flex flex-col items-center justify-center shadow border border-emerald-600">
                        <span className="text-2xl font-bold leading-none">{v.score}</span>
                        <span className="text-[8px] font-semibold uppercase tracking-widest mt-0.5">Score</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(() => {
                          const details = getCategoryDetails(v.categoryClean);
                          const BadgeIcon = details.icon;
                          return (
                            <span className={`text-[10px] font-bold tracking-tight px-2 py-1 rounded-full flex items-center gap-1 leading-none shadow-sm ${details.colors}`}>
                              <BadgeIcon size={11} className="stroke-[2.25]" />
                              <span>{details.label}</span>
                            </span>
                          );
                        })()}
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-0.5">
                          <MapPin size={10} /> {v.distanceMiles ? `${parseFloat(v.distanceMiles).toFixed(1)} km away` : 'Distance N/A'}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 leading-snug truncate group-hover/card:text-indigo-600 transition-colors">{v.name}</h3>
                      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-400 font-bold">
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
                          <TrendingUp size={12} /> ~{v.covers} covers ({v.convRate}% conv)
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold mt-1.5">
                        Source: <a href={v.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="underline hover:text-indigo-600">{v.source_domain || v.organizer_name || 'Event Source'}</a>
                      </p>
                    </div>
                  </div>

                  {/* Lift indicator */}
                  <div className="flex flex-col items-end gap-1 border-l border-slate-100 pl-6 shrink-0 w-full md:w-auto mt-4 md:mt-0">
                    <span className="text-2xl font-bold text-slate-900">+{v.lift >= 1000 ? `$${(v.lift/1000).toFixed(1)}k` : `$${v.lift}`}</span>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Projected Lift</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(v);
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 mt-2.5 flex items-center gap-0.5 group"
                    >
                      View details <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              );
            })
        ) : (
          <div className="h-48 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 text-slate-300 shadow-sm">
            <Compass size={40} className="mb-2 opacity-50 animate-spin-slow" />
            <p className="text-xs font-semibold uppercase tracking-wider">No events found in this query.</p>
          </div>
        )}
      </div>
    </div>
  );
}
