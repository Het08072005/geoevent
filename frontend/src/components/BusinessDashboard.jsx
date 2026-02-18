import React, { useState } from 'react';
import {
    TrendingUp,
    Users,
    Target,
    PieChart,
    Zap,
    Clock,
    CheckCircle2,
    Building2,
    CalendarCheck,
    Briefcase,
    UtensilsCrossed,
    Flame,
    Star,
    ChevronRight
} from 'lucide-react';

const DemographicRing = ({ data }) => {
    if (!data || data.length === 0) return null;
    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    const colors = ['#3b82f6', '#38bdf8', '#4ade80', '#94a3b8', '#64748b'];

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative w-36 h-36">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="8" fill="transparent" />
                    {data.map((item, i) => {
                        const percentage = (item.value / total) * 100;
                        const offset = data.slice(0, i).reduce((acc, curr) => acc + (curr.value / total) * 100, 0);
                        return (
                            <circle
                                key={i}
                                cx="50"
                                cy="50"
                                r="40"
                                stroke={colors[i % colors.length]}
                                strokeWidth="12"
                                strokeDasharray={`${percentage * 2.51} 251.2`}
                                strokeDashoffset={-offset * 2.51}
                                fill="transparent"
                                className="transition-all duration-1000"
                            />
                        );
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-white">{data[0]?.value}%</span>
                </div>
            </div>

            <div className="flex flex-col gap-1 w-full max-w-[200px] border-t border-slate-800 pt-3">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center justify-between group px-1">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors[i % colors.length] }}></div>
                            <span className="text-[9px] font-bold text-slate-400 group-hover:text-slate-200 uppercase tracking-tight">{item.label}</span>
                        </div>
                        <span className="text-[9px] font-black text-slate-500">{item.value}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const BusinessDashboard = ({ data, loading }) => {
    if (loading) {
        return (
            <div className="bg-[#0B1221] rounded-2xl p-10 border border-slate-800 mt-8 animate-pulse text-center space-y-4">
                <div className="h-6 w-48 bg-slate-800 rounded mx-auto"></div>
                <div className="h-4 w-64 bg-slate-800 rounded mx-auto"></div>
            </div>
        );
    }

    if (!data || data.error) return null;

    const analysis = data.combined_analysis || {};
    const store = data.store_info || {};

    return (
        <div className="mt-8 bg-[#0B1221] text-white p-6 md:p-8 rounded-[1rem] border border-slate-800 shadow-2xl font-sans tracking-tight animate-in fade-in duration-1000">

            {/* Optimized Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <div className="space-y-1">
                    <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">Retail Event Impact</h1>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-800">
                            <Building2 size={10} className="text-primary-400" />
                            <span className="text-[9px] font-black text-slate-300 uppercase">{store.name || 'Store'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-800">
                            <Zap size={10} className="text-yellow-400" />
                            <span className="text-[9px] font-black text-slate-300 uppercase">{store.event_count || 0} Local Events</span>
                        </div>
                    </div>
                </div>
                <div className="h-8 w-px bg-slate-800 hidden md:block"></div>
                <div className="flex items-center gap-4 bg-slate-800/20 p-2 rounded-xl border border-slate-800/50">
                    <div className="text-center px-3 border-r border-slate-800/50">
                        <p className="text-[8px] font-black text-slate-500 uppercase mb-0.5">Total Addl. Flow</p>
                        <p className="text-xs font-black text-white">{analysis.total_footfall}</p>
                    </div>
                    <div className="text-center px-3">
                        <p className="text-[8px] font-black text-slate-500 uppercase mb-0.5">Peak Hour Sync</p>
                        <p className="text-xs font-black text-white">{analysis.peak_window}</p>
                    </div>
                </div>
            </div>

            <div className="w-full h-px bg-slate-800/50 my-6"></div>

            {/* Smart Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

                {/* Left Column: Individual Impact - Ultra Compact */}
                <div className="space-y-4">
                    <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                        <CalendarCheck size={14} /> Individual Event Impact
                    </h2>
                    <div className="space-y-3">
                        {data.individual_events?.map((ev, i) => (
                            <div key={i} className="bg-slate-100 rounded-[1.2rem] p-4 text-slate-800 group hover:bg-white transition-all transform hover:-translate-y-1">
                                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-200/50">
                                    <div className="w-6 h-6 flex items-center justify-center bg-slate-900 rounded-lg text-white text-[10px] font-black">
                                        {i + 1}
                                    </div>
                                    <h3 className="text-xs font-black tracking-tight uppercase group-hover:text-primary-600 transition-colors truncate">{ev.name}</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                            <Users size={10} className="text-slate-400" />
                                            <p className="text-[8px] font-black text-slate-400 uppercase">Segment</p>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-600 truncate">{ev.segment}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                            <TrendingUp size={10} className="text-primary-500" />
                                            <p className="text-[8px] font-black text-slate-400 uppercase">Impact</p>
                                        </div>
                                        <p className="text-[10px] font-black text-slate-800 uppercase">{ev.footfall}</p>
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        <div className="flex items-center gap-1.5">
                                            <Briefcase size={10} className="text-slate-400" />
                                            <p className="text-[8px] font-black text-slate-400 uppercase">Behavior</p>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-medium italic line-clamp-1 group-hover:line-clamp-none transition-all duration-300 leading-snug">
                                            "{ev.behavior}"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Column: Mix Analysis & Recommendations */}
                <div className="space-y-4">
                    <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                        <PieChart size={14} /> Intelligence Core
                    </h2>

                    <div className="bg-slate-800/30 border border-slate-800 rounded-[2rem] p-6 lg:p-8 space-y-8">
                        {/* Demographic Center */}
                        <div className="flex flex-col md:flex-row items-center gap-10">
                            <DemographicRing data={analysis.composition || []} />

                            <div className="w-full space-y-4">
                                <div className="bg-slate-900 border border-slate-700/50 p-4 rounded-2xl flex items-center justify-between group hover:border-primary-500/30 transition-all">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Event Synergy</p>
                                        <p className="text-sm font-black text-white">{analysis.summary || 'Optimal Convergence'}</p>
                                    </div>
                                    <div className="p-2 rounded-xl bg-primary-500/10 text-primary-500">
                                        <Zap size={14} />
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl p-4 text-slate-800 shadow-xl border-l-4 border-primary-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Briefcase size={12} className="text-primary-500" />
                                        <p className="text-[9px] font-black text-primary-500 uppercase tracking-[0.2em]">Strategy Recommendation</p>
                                    </div>
                                    <p className="text-xs font-bold text-slate-700 leading-relaxed italic">
                                        "{analysis.operational_rec}"
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Top Recommended Food - Re-styled for Maximum Impact */}
                        <div className="pt-4 border-t border-slate-800 space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <Flame size={16} className="text-orange-500 animate-pulse" />
                                    <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Recommended Menu Focus</h4>
                                </div>
                                <span className="text-[9px] font-black text-slate-500 uppercase">Gemini Pick</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {data.popular_items?.slice(0, 6).map((item, i) => (
                                    <div key={i} className="flex items-center justify-between group bg-slate-900/40 p-3 rounded-2xl border border-slate-800 hover:bg-slate-900/60 transition-all cursor-default">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-slate-800 p-2 rounded-xl text-primary-400 group-hover:scale-110 transition-transform shadow-lg">
                                                <UtensilsCrossed size={12} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-100 tracking-tight">{item.item}</p>
                                                <p className="text-[8px] font-bold text-slate-500 uppercase">{item.who_buys}</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={12} className="text-slate-700 group-hover:text-primary-500 transition-colors" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Compact Footer */}
            <div className="mt-8 pt-6 border-t border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-600 opacity-60">
                <div className="flex items-center gap-4">
                    <span className="text-[9px] font-black uppercase tracking-widest">AI Intelligence v3.0</span>
                    <span className="text-[9px] font-black uppercase tracking-widest">Global Data Feed</span>
                </div>
                <div className="text-[9px] font-black uppercase tracking-widest">
                    Last Analysis: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        </div>
    );
};
