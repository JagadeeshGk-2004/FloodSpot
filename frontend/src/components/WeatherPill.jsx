import React from 'react';
import { CloudRain, Waves, Sun } from 'lucide-react';

export default function WeatherPill({ weather }) {
  const isRain = weather ? weather.isFloodMode : true;
  const temp = weather ? weather.temp : 31;
  const condition = weather ? weather.condition : 'Heavy Rainfall';
  const rainRate = weather?.rain1h ? `${weather.rain1h} mm/hr` : '42 mm/hr';

  return (
    <div className="glass-panel bg-[#111827] rounded-full px-4 py-2 border border-[#1E293B] shadow-xl flex items-center gap-3 backdrop-blur-xl text-xs">
      <div className="flex items-center gap-2 border-r border-[#1E293B] pr-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
          isRain 
            ? 'bg-[#38BDF8]/20 border border-[#38BDF8]/40 text-[#38BDF8] animate-pulse'
            : 'bg-[#F59E0B]/20 border border-[#F59E0B]/40 text-[#F59E0B]'
        }`}>
          {isRain ? <CloudRain className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </div>
        <div>
          <div className="font-bold text-[#F8FAFC] flex items-center gap-1">
            <span>Chennai ({temp}°C)</span>
            <span className={`w-2 h-2 rounded-full ${isRain ? 'bg-[#EF4444] animate-ping' : 'bg-[#10B981]'}`}></span>
          </div>
          <p className={`text-[10px] font-medium ${isRain ? 'text-[#38BDF8]' : 'text-[#94A3B8]'}`}>
            {condition}
          </p>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-3 text-[#94A3B8]">
        <div className="flex items-center gap-1 text-[11px]">
          <Waves className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>High Tide: <strong className="text-[#F8FAFC]">3.2m @ 18:45</strong></span>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          <CloudRain className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>Rain Rate: <strong className="text-[#F8FAFC]">{rainRate}</strong></span>
        </div>
      </div>
    </div>
  );
}
