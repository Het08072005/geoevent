import React from 'react';

export default function SettingsView() {
  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-white custom-scrollbar pb-24">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 max-w-3xl leading-relaxed">
          Configuration & integrations will live here. Connect a real event feed (Ticketmaster, PredictHQ), weather provider, and your POS to unlock real-time forecasting.
        </p>
      </div>
      
      <div className="mt-8 border border-dashed border-slate-200 rounded-3xl bg-white h-64 flex items-center justify-center">
        <span className="text-slate-400 text-sm font-medium">Coming soon</span>
      </div>
    </div>
  );
}
