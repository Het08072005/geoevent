import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Store, Plus, X, Trash2 } from 'lucide-react';

export default function StoresView() {
  const { STORES, setStores, currentStore, setCurrentStore } = useOutletContext();
  const navigate = useNavigate();

  // State for Add Store Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [avgTicket, setAvgTicket] = useState('35');
  const [capacity, setCapacity] = useState('150');
  const [validationError, setValidationError] = useState('');
  const [geocodingLoading, setGeocodingLoading] = useState(false);

  // Handle store deletion
  const handleDeleteStore = (storeId, e) => {
    e.stopPropagation();
    if (storeId === currentStore.id) {
      alert("You cannot delete the active store!");
      return;
    }
    const confirmed = window.confirm("Are you sure you want to delete this store location?");
    if (confirmed) {
      const updated = STORES.filter(s => s.id !== storeId);
      setStores(updated);
    }
  };

  // Helper to parse city from address comma
  const parseCity = (addr) => {
    if (!addr) return "San Francisco";
    const parts = addr.split(',');
    if (parts.length >= 2) {
      // Find potential state/zip part and city part
      const cityPart = parts[parts.length - 2].trim();
      if (cityPart) return cityPart;
    }
    return "San Francisco";
  };

  // Address Geocoding Lookup Function
  const handleLookupAddress = async () => {
    if (!address.trim()) {
      setValidationError("Please enter an address first.");
      return;
    }
    setGeocodingLoading(true);
    setValidationError('');
    try {
      const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');
      const res = await fetch(`${API_BASE_URL}/api/search?text=${encodeURIComponent(address)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.results && data.results.length > 0) {
          const first = data.results[0];
          setLat(first.lat.toFixed(6));
          setLon(first.lon.toFixed(6));
          setAddress(first.name);
        } else {
          setValidationError("Could not resolve address. Please adjust or enter coordinates manually.");
        }
      } else {
        setValidationError("Geocoding service unavailable.");
      }
    } catch (err) {
      // console.error(err);
      setValidationError("Error looking up address.");
    } finally {
      setGeocodingLoading(false);
    }
  };

  // Handle form submission
  const handleAddStoreSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (!name.trim()) {
      setValidationError('Store Name is required.');
      return;
    }
    if (!address.trim()) {
      setValidationError('Address is required.');
      return;
    }

    let latitudeVal = lat.trim();
    let longitudeVal = lon.trim();

    // Auto-geocode on submission if coordinates were left blank
    if (!latitudeVal || !longitudeVal) {
      setGeocodingLoading(true);
      try {
        const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');
        const res = await fetch(`${API_BASE_URL}/api/search?text=${encodeURIComponent(address)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && data.results && data.results.length > 0) {
            const first = data.results[0];
            latitudeVal = first.lat.toString();
            longitudeVal = first.lon.toString();
            setLat(first.lat.toFixed(6));
            setLon(first.lon.toFixed(6));
            setAddress(first.name);
          } else {
            setValidationError('Could not auto-resolve coordinates. Please enter Latitude and Longitude manually.');
            setGeocodingLoading(false);
            return;
          }
        } else {
          setValidationError('Geocoding service failed. Please enter coordinates manually.');
          setGeocodingLoading(false);
          return;
        }
      } catch (err) {
        setValidationError('Error resolving coordinates. Please enter them manually.');
        setGeocodingLoading(false);
        return;
      } finally {
        setGeocodingLoading(false);
      }
    }

    const latitudeNum = parseFloat(latitudeVal);
    const longitudeNum = parseFloat(longitudeVal);

    if (isNaN(latitudeNum) || latitudeNum < -90 || latitudeNum > 90) {
      setValidationError('Please enter a valid Latitude (-90 to 90).');
      return;
    }
    if (isNaN(longitudeNum) || longitudeNum < -180 || longitudeNum > 180) {
      setValidationError('Please enter a valid Longitude (-180 to 180).');
      return;
    }

    const ticketNum = parseInt(avgTicket);
    const capacityNum = parseInt(capacity);
    if (isNaN(ticketNum) || ticketNum <= 0) {
      setValidationError('Please enter a valid Average Ticket price.');
      return;
    }

    const newStoreId = name.toLowerCase().replace(/[^a-z0-9]/g, '-') || `store-${Date.now()}`;

    // Check for duplicate ID
    if (STORES.some(s => s.id === newStoreId)) {
      setValidationError('A store with this name or ID already exists.');
      return;
    }

    const newStore = {
      id: newStoreId,
      name: name.trim(),
      address: address.trim(),
      lat: latitudeNum,
      lon: longitudeNum,
      city: parseCity(address),
      cuisine: cuisine.trim() || 'General Dining',
      avgTicket: ticketNum,
      capacity: isNaN(capacityNum) ? 100 : capacityNum
    };

    setStores([...STORES, newStore]);

    // Reset fields & close
    setName('');
    setAddress('');
    setLat('');
    setLon('');
    setCuisine('');
    setAvgTicket('35');
    setCapacity('150');
    setShowAddModal(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#f8fafc] custom-scrollbar pb-24">
      {/* Header section with modern title & "+ Add store" CTA button */}
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-slate-950">My Stores</h1>
          <p className="text-sm text-slate-400 font-semibold">Monitor and switch between active store locations.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/10 transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span>Add store</span>
        </button>
      </div>

      {/* Grid of Stores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {STORES.map(store => (
          <div
            key={store.id}
            className={`bg-white rounded-xl border p-6 transition-all relative shadow-sm flex flex-col justify-between ${currentStore.id === store.id ? 'border-indigo-500 shadow-md shadow-indigo-500/5' : 'border-slate-100 hover:border-slate-200'
              }`}
          >
            {currentStore.id === store.id && (
              <span className="absolute top-6 right-6 bg-indigo-600 text-white text-[9px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-widest animate-pulse">
                Active
              </span>
            )}

            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-600">
                  <Store size={22} />
                </div>
                {/* Delete button (only show for inactive stores) */}
                {store.id !== currentStore.id && (
                  <button
                    onClick={(e) => handleDeleteStore(store.id, e)}
                    className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-100"
                    title="Delete store location"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <h3 className="text-lg font-bold text-slate-900 leading-snug mb-1">{store.name}</h3>
              <p className="text-xs text-slate-400 font-bold mb-4">{store.address}</p>

              <div className="border-t border-slate-50 pt-4 space-y-2 text-xs font-bold text-slate-600 mb-6">
                <div className="flex justify-between">
                  <span>Cuisine</span>
                  <span className="text-slate-900">{store.cuisine}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Ticket</span>
                  <span className="text-slate-900">${store.avgTicket}</span>
                </div>
                {store.capacity && (
                  <div className="flex justify-between">
                    <span>Capacity</span>
                    <span className="text-slate-900">{store.capacity} seats</span>
                  </div>
                )}
              </div>
            </div>
            
            <button
              onClick={() => {
                setCurrentStore(store);
                navigate('/');
              }}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all text-center ${currentStore.id === store.id ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
            >
              {currentStore.id === store.id ? 'Viewing Dashboard' : 'Switch to Store'}
            </button>
          </div>
        ))}
      </div>

      {/* Add Store Modal Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-100/50 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-8 py-5 border-b border-slate-50">
              <h2 className="text-lg font-bold text-slate-900">Add a new store</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddStoreSubmit} className="p-8 space-y-4">
              {validationError && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-2.5 text-xs font-bold text-rose-600">
                  {validationError}
                </div>
              )}

              {/* Store Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Name</label>
                <input
                  type="text"
                  placeholder="Downtown Cafe"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Address</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="123 Main St, Palo Alto, CA"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none transition-all"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleLookupAddress}
                    disabled={geocodingLoading}
                    className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold px-4 rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    {geocodingLoading ? 'Searching...' : 'Lookup'}
                  </button>
                </div>
                <p className="text-[9px] text-indigo-500 font-bold mt-1">💡 Pro-tip: Leave coordinates blank for automatic lookup, or click the 'Lookup' button!</p>
              </div>

              {/* Coordinates Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Latitude (Optional)</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Auto-resolved on submit"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none transition-all"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Longitude (Optional)</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Auto-resolved on submit"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none transition-all"
                    value={lon}
                    onChange={(e) => setLon(e.target.value)}
                  />
                </div>
              </div>

              {/* Details Grid (Cuisine, Avg Ticket, Capacity) */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Cuisine</label>
                  <input
                    type="text"
                    placeholder="Italian"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none transition-all"
                    value={cuisine}
                    onChange={(e) => setCuisine(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Avg ticket ($)</label>
                  <input
                    type="number"
                    placeholder="35"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none transition-all"
                    value={avgTicket}
                    onChange={(e) => setAvgTicket(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Capacity</label>
                  <input
                    type="number"
                    placeholder="150"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none transition-all"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-50 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs py-2.5 px-6 rounded-xl shadow-lg shadow-indigo-600/10 transition-all cursor-pointer"
                >
                  Add store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
