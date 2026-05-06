import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Compass,
  LayoutDashboard,
  Calendar,
  Search,
  Store,
  Settings as SettingsIcon
} from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="w-64 border-r border-slate-100 flex flex-col bg-white shrink-0 h-full">
      {/* Brand Header */}
      <div className="h-16 px-6 border-b border-slate-50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
          <Compass size={18} strokeWidth={2.5} className="animate-spin-slow" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-black tracking-tight text-slate-900 leading-none">AreaIQ</span>
          <span className="text-[10px] text-slate-400 font-bold leading-none mt-1">Location Intelligence</span>
        </div>
      </div>

      {/* Workspace Menu List */}
      <div className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Workspace</p>
          
          {/* Dashboard Button */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black transition-all ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/30'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`
            }
          >
            <LayoutDashboard size={16} />
            Dashboard
          </NavLink>

          {/* Events Page */}
          <NavLink
            to="/events"
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black transition-all ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/30'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`
            }
          >
            <Calendar size={16} />
            Events
          </NavLink>

          {/* Event Sources Web Scraper */}
          <NavLink
            to="/event-sources"
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black transition-all ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/30'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`
            }
          >
            <Search size={16} />
            Event Sources
          </NavLink>

          {/* Stores List */}
          <NavLink
            to="/stores"
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black transition-all ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/30'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`
            }
          >
            <Store size={16} />
            Stores
          </NavLink>

          {/* Settings */}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black transition-all ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/30'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`
            }
          >
            <SettingsIcon size={16} />
            Settings
          </NavLink>
        </div>
      </div>

      {/* User Info Bottom */}
      <div className="p-4 border-t border-slate-50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black shadow animate-pulse">
          JM
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-800 truncate">John Manager</p>
          <p className="text-[10px] text-slate-400 font-medium truncate">john@missionbistro.com</p>
        </div>
      </div>
    </aside>
  );
}
