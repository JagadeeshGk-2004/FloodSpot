import React from 'react';
import { Map, Navigation2, Bell, Plus, ShieldCheck } from 'lucide-react';

export default function BottomNav({ activeTab, onSelectTab, onOpenReportModal }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-1 pointer-events-auto">
      <div className="max-w-md mx-auto glass-panel rounded-3xl border border-slate-700/80 p-1.5 flex items-center justify-around shadow-2xl backdrop-blur-2xl">
        
        {/* Map Tab */}
        <button
          onClick={() => onSelectTab('map')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'map' 
              ? 'text-cyan-400 bg-cyan-500/10 font-bold border border-cyan-500/30' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Map className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Live Map</span>
        </button>

        {/* Safe Navigation Routes Tab */}
        <button
          onClick={() => onSelectTab('routes')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'routes' 
              ? 'text-cyan-400 bg-cyan-500/10 font-bold border border-cyan-500/30' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Navigation2 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Safe Routes</span>
        </button>

        {/* Center Report Flood Action Trigger */}
        <button
          onClick={onOpenReportModal}
          className="relative -top-3 p-3 bg-gradient-to-tr from-red-600 via-orange-500 to-amber-500 rounded-full text-white shadow-xl shadow-red-900/50 hover:scale-105 active:scale-95 transition-transform border-2 border-slate-900 cursor-pointer flex items-center justify-center"
          title="Report Flood Incident"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
          <span className="absolute -bottom-5 text-[9px] font-extrabold tracking-wider text-amber-300 uppercase whitespace-nowrap bg-slate-950/80 px-2 py-0.5 rounded-full border border-amber-500/40">
            + Report
          </span>
        </button>

        {/* Alerts Tab */}
        <button
          onClick={() => onSelectTab('alerts')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'alerts' 
              ? 'text-cyan-400 bg-cyan-500/10 font-bold border border-cyan-500/30' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bell className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Alerts</span>
        </button>

        {/* Community Verify Tab */}
        <button
          onClick={() => onSelectTab('verify')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'verify' 
              ? 'text-cyan-400 bg-cyan-500/10 font-bold border border-cyan-500/30' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Verify</span>
        </button>

      </div>
    </nav>
  );
}
