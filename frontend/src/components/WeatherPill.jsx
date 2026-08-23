import React from 'react';
import { CloudRain, Waves, Sun } from 'lucide-react';

export default function WeatherPill({ weather }) {
  const isRain = weather ? weather.isFloodMode : true;
  const temp = weather ? weather.temp : 31;
  const condition = weather ? weather.condition : 'Heavy Rainfall';
  const rainRate = weather?.rain1h ? `${weather.rain1h} mm/hr` : '42 mm/hr';

  return (
    <div className="glass-panel rounded-full px-4 py-2 border border-slate-700/60 shadow-xl flex items-center gap-3 backdrop-blur-xl text-xs">
      <div className="flex items-center gap-2 border-r border-slate-700/60 pr-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
          isRain 
            ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-400 animate-pulse'
            : 'bg-amber-500/20 border border-amber-400/40 text-amber-400'
        }`}>
          {isRain ? <CloudRain className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </div>
        <div>
          <div className="font-bold text-slate-100 flex items-center gap-1">
            <span>Chennai ({temp}°C)</span>
            <span className={`w-2 h-2 rounded-full ${isRain ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`}></span>
          </div>
          <p className={`text-[10px] font-medium ${isRain ? 'text-cyan-300' : 'text-slate-400'}`}>
            {condition}
          </p>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-3 text-slate-300">
        <div className="flex items-center gap-1 text-[11px]">
          <Waves className="w-3.5 h-3.5 text-blue-400" />
          <span>High Tide: <strong className="text-slate-100">3.2m @ 18:45</strong></span>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
          <span>Rain Rate: <strong className="text-slate-100">{rainRate}</strong></span>
        </div>
      </div>
    </div>
  );
}
