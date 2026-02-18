import React from 'react';
import { Search, Loader2 } from 'lucide-react';

export const SearchBar = ({ searchQuery, setSearchQuery, handleSearch, loading }) => {
    return (
        <form onSubmit={handleSearch} className="relative w-full max-w-md hidden md:block">
            <input
                type="text"
                placeholder="Search store or location (e.g. Evvia Estiatorio Palo Alto)"
                className="w-full bg-slate-100 border-none rounded-full py-2.5 pl-12 pr-4 focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            </div>
        </form>
    );
};

export const MobileSearchBar = ({ searchQuery, setSearchQuery, handleSearch }) => {
    return (
        <form onSubmit={handleSearch} className="relative w-full md:hidden">
            <input
                type="text"
                placeholder="Search location..."
                className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary-500 transition-all outline-none shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        </form>
    );
};
