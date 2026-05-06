import React from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Users,
  TrendingUp,
  ChevronRight,
  Compass,
  Loader2
} from 'lucide-react';

export default function AllEventsView() {
  const {
    currentStore,
    radiusMiles,
    selectedCategory,
    setSelectedCategory,
    venues,
    loading,
    getMetrics,
    fmtDate,
    fmtTime,
    getCategoryStyles
  } = useOutletContext();

  const { totalEvents, enrichedVenues } = getMetrics();

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#f8fafc] custom-scrollbar pb-24">
      
      {/* Header section matching All Events */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-950 leading-none">All events</h1>
          <p className="text-xs text-slate-400 font-bold mt-2">
            Every event within {radiusMiles} miles of {currentStore.name}, ranked by revenue opportunity
          </p>
        </div>

        {/* Day filter buttons */}
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-xs text-slate-400 font-bold">{totalEvents} events in next 15 days</span>
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
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm w-fit">
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
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-wider ${selectedCategory === cat.id ? 'bg-indigo-600 text-white shadow-sm font-black' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Stream of all Event Cards matching Image 1 */}
      <div className="space-y-4">
        {loading ? (
          <div className="h-40 flex items-center justify-center bg-white rounded-3xl border border-slate-100 shadow-sm">
            <Loader2 className="animate-spin text-indigo-500" />
          </div>
        ) : enrichedVenues.length > 0 ? (
          enrichedVenues
            .filter(v => selectedCategory === "" || v.categoryClean === selectedCategory)
            .map((v, idx) => {
              return (
                <div key={v.id || idx} className="bg-white rounded-[2.5rem] border border-slate-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300">
                  <div className="flex items-start gap-6 w-full md:w-auto">
                    {/* Green score badge */}
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[10px] font-black text-slate-400 mb-1">#{v.rank}</span>
                      <div className="w-16 h-16 bg-emerald-500 text-white rounded-[1.3rem] flex flex-col items-center justify-center shadow border border-emerald-600">
                        <span className="text-2xl font-black leading-none">{v.score}</span>
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
                      <h3 className="text-lg font-black text-slate-900 leading-snug truncate">{v.name}</h3>
                      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-400 font-bold">
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
                      <p className="text-[10px] text-slate-400 font-bold mt-1.5">
                        Source: <a href={v.url} target="_blank" rel="noreferrer" className="underline hover:text-indigo-600">{v.organizer_name}</a>
                      </p>
                    </div>
                  </div>

                  {/* Lift indicator */}
                  <div className="flex flex-col items-end gap-1 border-l border-slate-100 pl-6 shrink-0 w-full md:w-auto mt-4 md:mt-0">
                    <span className="text-2xl font-black text-slate-900">+{v.lift ? `$${(v.lift/1000).toFixed(1)}k` : '+$14k'}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Projected Lift</span>
                    <a href={v.url} target="_blank" rel="noreferrer" className="text-xs font-black text-indigo-600 hover:text-indigo-700 mt-2.5 flex items-center gap-0.5 group">
                      View details <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                    </a>
                  </div>
                </div>
              );
            })
        ) : (
          <div className="h-48 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 text-slate-300 shadow-sm">
            <Compass size={40} className="mb-2 opacity-50 animate-spin-slow" />
            <p className="text-xs font-black uppercase tracking-wider">No events found in this query.</p>
          </div>
        )}
      </div>
    </div>
  );
}
