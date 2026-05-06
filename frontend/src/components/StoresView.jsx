import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';

export default function StoresView() {
  const { STORES, currentStore, setCurrentStore } = useOutletContext();
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#f8fafc] custom-scrollbar pb-24">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-slate-950">My Stores</h1>
        <p className="text-sm text-slate-400 font-semibold">Monitor and switch between active store locations.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {STORES.map(store => (
          <div key={store.id} className={`bg-white rounded-[2rem] border p-6 transition-all relative shadow-sm ${currentStore.id === store.id ? 'border-indigo-500 shadow-md shadow-indigo-500/5' : 'border-slate-100 hover:border-slate-200'}`}>
            {currentStore.id === store.id && (
              <span className="absolute top-6 right-6 bg-indigo-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest animate-pulse">Active</span>
            )}
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-600 mb-4">
              <Store size={22} />
            </div>
            <h3 className="text-lg font-black text-slate-900 leading-snug mb-1">{store.name}</h3>
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
            </div>
            
            <button
              onClick={() => {
                setCurrentStore(store);
                navigate('/');
              }}
              className={`w-full py-2.5 rounded-xl text-xs font-black transition-all text-center ${currentStore.id === store.id ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
            >
              {currentStore.id === store.id ? 'Viewing Dashboard' : 'Switch to Store'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
