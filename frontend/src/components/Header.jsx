import React from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Store,
  ChevronDown,
  Loader2,
  Search,
  Bell,
  Menu,
  MapPin
} from 'lucide-react';

export default function Header({
  STORES,
  currentStore,
  setCurrentStore,
  searchQuery,
  setSearchQuery,
  loading,
  handleSearch,
  searchResults,
  handleSelect,
  storeDropdownOpen,
  setStoreDropdownOpen,
  dropdownRef
}) {

  return (
    <header className="h-16 shrink-0 border-b border-slate-100 bg-white flex items-center justify-between px-8 z-10">
      <div className="flex items-center gap-6">
        <button className="text-slate-400 hover:text-slate-600 md:hidden">
          <Menu size={20} />
        </button>

        {/* Store Picker Dropdown Card */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
            className="flex items-center gap-3 px-3 py-1.5 hover:bg-slate-50 rounded-xl transition-all text-left border border-slate-100 bg-white shadow-sm"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <Store size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 leading-tight">{currentStore.name}</div>
              <div className="text-[9px] text-slate-400 font-medium truncate max-w-[150px]">{currentStore.address}</div>
            </div>
            <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${storeDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {storeDropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2 border-b border-slate-50 mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Workspace Store</span>
              </div>
              {STORES.map(store => (
                <button
                  key={store.id}
                  onClick={() => {
                    setCurrentStore(store);
                    setStoreDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-all flex items-center gap-3 ${currentStore.id === store.id ? 'bg-indigo-50/50' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${currentStore.id === store.id ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-500'}`}>
                    <Store size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-xs font-bold leading-tight ${currentStore.id === store.id ? 'text-indigo-600' : 'text-slate-800'}`}>{store.name}</div>
                    <div className="text-[9px] text-slate-400 truncate mt-0.5">{store.address}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Area: Search & Status Indicators */}
      <div className="flex items-center gap-4">
        
        {/* Search autocomplete widget for custom geolocation mapping */}
        <div className="relative">
          <form onSubmit={handleSearch} className="relative w-80">
            <input
              type="text"
              placeholder="Geocode custom city or venue..."
              className="w-full bg-slate-50 border border-slate-200/50 rounded-full py-1.5 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none text-xs font-semibold placeholder-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </div>
          </form>

          {searchResults.length > 0 && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-2 bg-slate-50/50 border-b border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Location Suggestions</p>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
                {searchResults.map((res, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(res)}
                    className="w-full text-left p-3 hover:bg-slate-50 transition-all flex gap-3 items-start"
                  >
                    <MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-950 truncate leading-tight">{res.name}</p>
                      <p className="text-[9px] text-slate-400 truncate mt-0.5">{res.address}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notification bell */}
        <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 bg-slate-50 relative">
          <Bell size={16} />
          <div className="w-2 h-2 rounded-full bg-indigo-500 absolute top-2 right-2 border-2 border-slate-50" />
        </button>

        {/* Live Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Network Live</span>
        </div>
      </div>
    </header>
  );
}
