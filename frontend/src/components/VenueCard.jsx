import React from 'react';
import { MapPin, ArrowRight } from 'lucide-react';

export const VenueCard = ({ venue }) => {
    return (
        <div className={`group p-4 rounded-2xl border transition-all duration-300 transform hover:-translate-y-1 ${venue.is_dummy
                ? 'bg-red-50/50 border-red-100 hover:border-red-300'
                : 'bg-white border-slate-200 hover:border-primary-300'
            } hover:shadow-xl`}>
            <div className="flex justify-between items-start gap-2">
                <div className="overflow-hidden">
                    <h4 className="font-bold text-sm group-hover:text-primary-600 transition-colors uppercase tracking-tight truncate flex items-center gap-2">
                        {venue.name}
                        {venue.is_dummy && (
                            <span className="flex-shrink-0 bg-red-600 text-[8px] text-white px-1.5 py-0.5 rounded-full font-black animate-pulse">
                                EVENT
                            </span>
                        )}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium flex items-center gap-1">
                        <MapPin size={10} /> {venue.address}
                    </p>
                </div>
                <span className="text-[10px] bg-white border border-slate-100 text-slate-600 px-2 py-0.5 rounded-full shrink-0 font-bold shadow-sm">
                    {(venue.distance / 1000).toFixed(1)}km
                </span>
            </div>

            {venue.description && (
                <p className="text-[10px] text-slate-500 mt-2 bg-slate-50 p-2 rounded-xl border border-dotted border-slate-200 leading-relaxed italic">
                    "{venue.description}"
                </p>
            )}

            <div className="mt-3 flex items-center justify-between">
                <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${venue.is_dummy ? 'bg-red-100 text-red-600' : 'bg-primary-50 text-primary-600'
                    }`}>
                    {venue.type || venue.category?.replace('.', ' ') || 'Entertainment'}
                </span>
                <div className="text-primary-600 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 text-[9px] font-bold tracking-tighter">
                    LOCATE <ArrowRight size={10} />
                </div>
            </div>
        </div>
    );
};
