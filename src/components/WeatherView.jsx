import {
  Cloud, CloudRain, MapPin, Loader, Activity, Wind,
  Droplet, Sun, Umbrella, Eye, ArrowUp
} from 'lucide-react';

/**
 * WeatherView — Weather intelligence dashboard with current conditions, hourly, and forecast.
 */
export default function WeatherView({ coords, weatherData, weatherLoading, requestLocation }) {
  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
      {/* Header Card */}
      <div className="bg-gradient-to-br from-blue-500 to-[#A891DE] p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[3.5rem] shadow-[0_20px_50px_rgba(168,145,222,0.3)] text-white relative overflow-hidden">
        <div className="relative z-10">
          <Cloud size={30} className="mb-3 opacity-80" />
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase italic mb-1 sm:mb-2">Weather Intel</h2>
          <p className="text-xs sm:text-sm font-medium opacity-80">Local conditions & forecast</p>
        </div>
        <div className="absolute -right-10 -bottom-10 opacity-10"><CloudRain size={150} /></div>
      </div>

      {!coords ? (
        <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-8 sm:p-10 rounded-[1.5rem] sm:rounded-[3rem] text-center space-y-4 border border-[#D4CBAF] dark:border-[#A891DE]/30">
          <MapPin size={36} className="mx-auto text-[#A891DE] opacity-50" />
          <p className="text-xs sm:text-sm font-medium text-[#1a1410] dark:text-[#FFFFFF] opacity-70">Location required for weather data.</p>
          <button onClick={requestLocation} className="px-6 py-3 bg-[#A891DE] text-white font-bold rounded-2xl uppercase tracking-widest text-xs shadow-lg hover:scale-105 smooth-transition">Enable GPS</button>
        </div>
      ) : weatherLoading ? (
        <div className="py-16 sm:py-20 flex justify-center"><Loader className="animate-spin text-[#A891DE]" size={36} /></div>
      ) : weatherData ? (
        <div className="space-y-4">
          {/* Main Current Temp */}
          <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[3rem] border border-[#D4CBAF] dark:border-[#A891DE]/30 flex flex-col justify-center items-center shadow-xl text-center">
            <CloudRain size={48} className="text-[#A891DE] mb-3 sm:mb-4" />
            <h3 className="font-black text-6xl sm:text-8xl tracking-tighter text-[#1a1410] dark:text-[#FFFFFF]">{Math.round(weatherData.current.temperature_2m)}°</h3>
            <p className="text-base sm:text-lg font-bold text-[#1a1410] dark:text-[#D3C9F2]">Feels like {Math.round(weatherData.current.apparent_temperature)}°</p>
            <p className="text-xs sm:text-sm font-bold text-[#9A8FB3] dark:text-[#A891DE] mt-1 sm:mt-2">
              High {Math.round(weatherData.daily.temperature_2m_max[0])}° • Low {Math.round(weatherData.daily.temperature_2m_min[0])}°
            </p>
          </div>

          {/* Hourly Carousel */}
          <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[3rem] border border-[#D4CBAF] dark:border-[#A891DE]/30 overflow-x-auto scrollbar-hide flex gap-3 sm:gap-4 snap-x">
            {weatherData.hourly.time.slice(0, 24).map((time, idx) => (
              <div key={time} className="flex flex-col items-center justify-between min-w-[3.5rem] sm:min-w-[4rem] p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-white/50 dark:bg-black/20 snap-center shrink-0">
                <span className="text-[9px] sm:text-[10px] font-black text-[#1a1410] dark:text-[#D3C9F2] uppercase">{new Date(time).getHours()}:00</span>
                <Cloud size={20} className="my-2 sm:my-3 text-[#A891DE]" />
                <span className="font-black text-base sm:text-lg text-[#1a1410] dark:text-[#FFFFFF]">{Math.round(weatherData.hourly.temperature_2m[idx])}°</span>
                <span className="text-[8px] sm:text-[9px] font-bold text-blue-500 mt-1 sm:mt-2">{weatherData.hourly.precipitation_probability[idx]}%</span>
              </div>
            ))}
          </div>

          {/* Mini Cards Grid */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Air Quality */}
            <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border border-[#D4CBAF] dark:border-[#A891DE]/30 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <Activity size={14} className="text-[#A891DE]" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2]">Air Quality</span>
              </div>
              <h4 className="font-black text-xl sm:text-2xl text-[#1a1410] dark:text-[#FFFFFF] mb-2">{weatherData.aqi?.current?.us_aqi || '--'}</h4>
              <div className="w-full h-1.5 sm:h-2 rounded-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 relative">
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full shadow border-2 border-[#1a1410]" style={{ left: `${Math.min((weatherData.aqi?.current?.us_aqi || 0) / 3, 100)}%` }} />
              </div>
            </div>

            {/* Wind */}
            <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border border-[#D4CBAF] dark:border-[#A891DE]/30 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <Wind size={14} className="text-[#A891DE]" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2]">Wind</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-white/50 dark:bg-black/20 rounded-full" style={{ transform: `rotate(${weatherData.current.wind_direction_10m}deg)` }}>
                  <ArrowUp size={16} className="text-[#1a1410] dark:text-white" />
                </div>
                <h4 className="font-black text-lg sm:text-xl text-[#1a1410] dark:text-[#FFFFFF]">{Math.round(weatherData.current.wind_speed_10m)} <span className="text-[9px] sm:text-[10px]">km/h</span></h4>
              </div>
            </div>

            {/* Rainfall */}
            <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border border-[#D4CBAF] dark:border-[#A891DE]/30">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <Droplet size={14} className="text-blue-500" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2]">Rainfall</span>
              </div>
              <h4 className="font-black text-xl sm:text-2xl text-[#1a1410] dark:text-[#FFFFFF]">{weatherData.current.precipitation} <span className="text-xs sm:text-sm">mm</span></h4>
              <p className="text-[9px] sm:text-[10px] font-bold text-[#9A8FB3] dark:text-[#A891DE] mt-1">in last 24h</p>
            </div>

            {/* UV Index */}
            <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border border-[#D4CBAF] dark:border-[#A891DE]/30">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <Sun size={14} className="text-orange-500" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2]">UV Index</span>
              </div>
              <h4 className="font-black text-xl sm:text-2xl text-[#1a1410] dark:text-[#FFFFFF]">{weatherData.daily.uv_index_max[0] || '--'}</h4>
              <p className="text-[9px] sm:text-[10px] font-bold text-[#9A8FB3] dark:text-[#A891DE] mt-1">Max today</p>
            </div>

            {/* Humidity */}
            <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border border-[#D4CBAF] dark:border-[#A891DE]/30">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <Umbrella size={14} className="text-[#A891DE]" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2]">Humidity</span>
              </div>
              <h4 className="font-black text-xl sm:text-2xl text-[#1a1410] dark:text-[#FFFFFF]">{weatherData.current.relative_humidity_2m}%</h4>
              <p className="text-[9px] sm:text-[10px] font-bold text-[#9A8FB3] dark:text-[#A891DE] mt-1">Dew point {Math.round(weatherData.hourly.temperature_2m[0] - (100 - weatherData.current.relative_humidity_2m) / 5)}°</p>
            </div>

            {/* Visibility */}
            <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border border-[#D4CBAF] dark:border-[#A891DE]/30">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <Eye size={14} className="text-[#A891DE]" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2]">Visibility</span>
              </div>
              <h4 className="font-black text-xl sm:text-2xl text-[#1a1410] dark:text-[#FFFFFF]">{Math.round(weatherData.hourly.visibility[0] / 1000)} <span className="text-xs sm:text-sm">km</span></h4>
              <p className="text-[9px] sm:text-[10px] font-bold text-[#9A8FB3] dark:text-[#A891DE] mt-1">Current distance</p>
            </div>
          </div>

          {/* 10-Day Forecast */}
          <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[3rem] border border-[#D4CBAF] dark:border-[#A891DE]/30 mt-4 sm:mt-6">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#A891DE] mb-4 sm:mb-6">10-Day Forecast</p>
            <div className="space-y-4 sm:space-y-5">
              {weatherData.daily.time.map((time, idx) => {
                const date = new Date(time);
                const max = Math.round(weatherData.daily.temperature_2m_max[idx]);
                const min = Math.round(weatherData.daily.temperature_2m_min[idx]);
                const pop = weatherData.daily.precipitation_probability_max[idx] || 0;
                return (
                  <div key={time} className="flex justify-between items-center pb-3 sm:pb-5 border-b border-[#D4CBAF]/5 dark:border-[#A891DE]/20 last:border-0 last:pb-0">
                    <span className="font-bold text-xs sm:text-sm uppercase text-[#1a1410] dark:text-[#FFFFFF] w-12 sm:w-16">
                      {idx === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <div className="flex items-center gap-1.5 sm:gap-2 w-12 sm:w-16 justify-center">
                      <CloudRain size={14} className={pop > 20 ? 'text-blue-500' : 'text-[#1a1410]'} />
                      <span className="text-[9px] sm:text-[10px] font-black text-[#1a1410] dark:text-[#A891DE]">{pop}%</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 sm:gap-3 w-16 sm:w-20">
                      <span className="text-xs sm:text-sm font-black text-[#A891DE]">{max}°</span>
                      <span className="text-xs sm:text-sm font-bold text-[#1a1410] dark:text-[#A891DE]">{min}°</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-10 text-center font-bold text-red-500">Failed to load weather.</div>
      )}
    </div>
  );
}
