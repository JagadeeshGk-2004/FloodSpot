import React from 'react';
import { Map, PlusCircle, ShieldAlert, Navigation2, ShieldCheck } from 'lucide-react';

export default function BottomNav({ activeTab, onSelectTab, onOpenReportModal }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-1 pointer-events-auto">
      <div className="max-w-md mx-auto h-[64px] glass-panel bg-[#111827] rounded-3xl border border-[#1E293B] px-2 flex items-center justify-around shadow-2xl backdrop-blur-2xl">
        
        {/* 1. Radar Tab */}
        <button
          onClick={() => onSelectTab('map')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'map' 
              ? 'text-[#38BDF8] bg-[#38BDF8]/10 font-bold border border-[#38BDF8]/30' 
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <Map className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Radar</span>
        </button>

        {/* 2. Report Trigger */}
        <button
          onClick={onOpenReportModal}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all cursor-pointer text-[#94A3B8] hover:text-[#F8FAFC]`}
        >
          <PlusCircle className="w-5 h-5 mb-0.5 text-[#38BDF8]" />
          <span className="text-[10px]">Report</span>
        </button>

        {/* 3. Center SOS Emergency Action Trigger */}
        <button
          onClick={() => onSelectTab('sos')}
          className="relative -top-3 p-3 bg-[#EF4444] rounded-full text-white shadow-xl shadow-red-950/60 hover:scale-105 active:scale-95 transition-transform border-2 border-[#090D16] cursor-pointer flex items-center justify-center group"
          title="Emergency SOS Broadcast"
        >
          <ShieldAlert className="w-6 h-6 text-white stroke-[2.5]" />
          <span className="absolute -bottom-5 text-[9px] font-extrabold tracking-wider text-[#EF4444] uppercase whitespace-nowrap bg-[#090D16]/95 px-2 py-0.5 rounded-full border border-[#EF4444]/40">
            SOS
          </span>
        </button>

        {/* 4. Routes Tab */}
        <button
          onClick={() => onSelectTab('routes')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'routes' 
              ? 'text-[#38BDF8] bg-[#38BDF8]/10 font-bold border border-[#38BDF8]/30' 
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <Navigation2 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Routes</span>
        </button>

        {/* 5. Verify Tab */}
        <button
          onClick={() => onSelectTab('verify')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'verify' 
              ? 'text-[#38BDF8] bg-[#38BDF8]/10 font-bold border border-[#38BDF8]/30' 
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <ShieldCheck className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Verify</span>
        </button>

      </div>
    </nav>
  );
}
