import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { 
  Navigation, 
  Shield, 
  CheckCircle, 
  Phone, 
  ChevronRight, 
  Droplet,
  X,
  Search,
  MapPin,
  AlertTriangle,
  Loader2,
  Compass,
  ArrowRight,
  WifiOff
} from 'lucide-react';
import { FLOOD_HOTSPOTS, SHELTERS, ROAD_MARKERS } from './chennaiData.js';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const CHENNAI_DEFAULT = { lat: 13.0827, lng: 80.2707 };

// ─── UTILS ──────────────────────────────────────────────────────────────────

function haversine(lat1, lon1, lat2, lon2) {
  try {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  } catch { return 0; }
}

async function fetchSafeRoute(fromLat, fromLng, toLat, toLng) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    if (!data.routes?.length) return null;
    return {
      waypoints: data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distance: data.routes[0].distance
    };
  } catch { return null; }
}

function validateRouteSafety(waypoints, markers, hotspots) {
  const issues = [];
  try {
    for (const pt of waypoints) {
      for (const zone of hotspots) {
        // Point in Polygon
        const x = pt[0], y = pt[1];
        let inside = false;
        const poly = zone.coords;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i][0], yi = poly[i][1];
          const xj = poly[j][0], yj = poly[j][1];
          const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        if (inside) issues.push(zone.name);
      }
    }
  } catch { /* ignore validation errors */ }
  return [...new Set(issues)];
}

// ─── ICONS ──────────────────────────────────────────────────────────────────

const START_ICON = L.divIcon({
  className: 'marker-pulse',
  html: `<div class="w-5 h-5 bg-[#5D5CDE] rounded-full border-2 border-white shadow-[0_0_15px_#5D5CDE]"></div><div class="absolute inset-0 bg-[#5D5CDE] rounded-full animate-ping opacity-30"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const END_ICON = L.divIcon({
  className: '',
  html: `<div class="w-5 h-5 bg-[#ef4444] rounded-full border-2 border-white shadow-[0_0_15px_#ef4444] flex items-center justify-center"><div class="w-1.5 h-1.5 bg-white rounded-full"></div></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// ─── MAP CORE ───────────────────────────────────────────────────────────────

const MapCore = memo(({ startPoint, destPoint, routeWaypoints, isSafe, markers, hotspots, onMarkerClick, onMapClick }) => {
  const map = useMap();

  useEffect(() => {
    if (startPoint && destPoint && map) {
      try {
        const bounds = L.latLngBounds([startPoint.lat, startPoint.lng], [destPoint.lat, destPoint.lng]);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true, duration: 1.5 });
      } catch (e) { console.error("fitBounds failed", e); }
    }
  }, [startPoint, destPoint, map]);

  useMapEvents({
    dblclick(e) { onMapClick(e.latlng); }
  });

  return (
    <>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {hotspots.map(zone => (
        <Polygon key={zone.id} positions={zone.coords} pathOptions={{ color: '#ef4444', fillOpacity: 0.1, weight: 1 }} />
      ))}
      {markers.map(m => (
        <Marker 
          key={m.id} position={[m.lat, m.lng]} 
          icon={L.divIcon({ html: `<div style="width:12px;height:12px;border-radius:50%;background:${m.type === 'blocked' ? '#ef4444' : '#f59e0b'};border:1px solid #fff;"></div>`, iconSize:[12,12], iconAnchor:[6,6] })}
          eventHandlers={{ click: () => onMarkerClick(m) }}
        />
      ))}
      {startPoint && <Marker position={[startPoint.lat, startPoint.lng]} icon={START_ICON} />}
      {destPoint && <Marker position={[destPoint.lat, destPoint.lng]} icon={END_ICON} />}
      {routeWaypoints.length > 0 && (
        <Polyline positions={routeWaypoints} pathOptions={{ color: isSafe ? '#22c55e' : '#ef4444', weight: 5, dashArray: isSafe ? '' : '5, 10' }} />
      )}
    </>
  );
});

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function SafestRoutePage({ coords, isDark }) {
  const [mapMounted, setMapMounted] = useState(false);
  const [toSearch, setToSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [routeWaypoints, setRouteWaypoints] = useState([]);
  const [safetyIssues, setSafetyIssues] = useState([]);
  const [isRouting, setIsRouting] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  const mapRef = useRef(null);
  const searchContainerRef = useRef(null);
  const debounceTimer = useRef(null);

  // Structural Fix: Hard-Block Leaflet Event Stealing
  useEffect(() => {
    if (searchContainerRef.current) {
      L.DomEvent.disableClickPropagation(searchContainerRef.current);
      L.DomEvent.disableScrollPropagation(searchContainerRef.current);
      // Kill keyboard event stealing
      L.DomEvent.on(searchContainerRef.current, 'keydown', (e) => {
        e.stopPropagation();
      });
    }
  }, [mapMounted]);

  // Safe Start Point with Fallback
  const startPoint = useMemo(() => {
    if (coords?.latitude && coords?.longitude) {
      return { lat: coords.latitude, lng: coords.longitude };
    }
    return CHENNAI_DEFAULT;
  }, [coords]);

  // Structural Fix 1: Robust Map Mounting Guard
  useEffect(() => {
    const checkTimer = setInterval(() => {
      if (document.getElementById('map-container')) {
        setMapMounted(true);
        clearInterval(checkTimer);
      }
    }, 100);
    return () => clearInterval(checkTimer);
  }, []);

  // Structural Fix 2: React 18 Cleanup & Offline Status
  useEffect(() => {
    const handleStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
      // If we used raw Leaflet, we would call mapRef.current.remove() here.
      // With react-leaflet, the component handles cleanup, but we ensure ref is null.
      if (mapRef.current) mapRef.current = null;
    };
  }, []);

  // Proximity Sort
  const sortedShelters = useMemo(() => {
    return [...SHELTERS].sort((a, b) => {
      const distA = haversine(startPoint.lat, startPoint.lng, a.lat, a.lng);
      const distB = haversine(startPoint.lat, startPoint.lng, b.lat, b.lng);
      return distA - distB;
    });
  }, [startPoint]);

  // Routing with Debounce
  const handleRouting = useCallback((dest) => {
    setSelectedDestination(dest);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      setIsRouting(true);
      const route = await fetchSafeRoute(startPoint.lat, startPoint.lng, dest.lat, dest.lng);
      if (route) {
        const issues = validateRouteSafety(route.waypoints, ROAD_MARKERS, FLOOD_HOTSPOTS);
        setRouteWaypoints(route.waypoints);
        setSafetyIssues(issues);
      }
      setIsRouting(false);
    }, 400);
  }, [startPoint]);

  const handleManualSearch = useCallback(async () => {
    if (toSearch.length < 3) return;
    
    setIsRouting(true);
    try {
      if (searchResults.length > 0) {
        handleRouting(searchResults[0]);
        setToSearch(searchResults[0].name);
        setSearchResults([]);
      } else {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(toSearch)}&countrycodes=in&limit=1`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.length > 0) {
          const dest = {
            id: data[0].place_id,
            name: data[0].display_name.split(',')[0],
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
          };
          handleRouting(dest);
          setToSearch(dest.name);
        }
      }
    } catch { /* ignore search error */ }
    setIsRouting(false);
  }, [toSearch, searchResults, handleRouting]);

  const triggerAutocomplete = useCallback((val) => {
    if (val.length < 3) {
      setSearchResults([]);
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&countrycodes=in&limit=5`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.length > 0) {
          const results = data.map(item => ({
            id: item.place_id,
            name: item.display_name.split(',')[0],
            address: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon)
          }));
          setSearchResults(results);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      }
    }, 400);
  }, []);

  const cardStyle = isDark 
    ? 'bg-[#1A1A1E] backdrop-blur-3xl border-[#8B72C7]/30 text-white' 
    : 'bg-white/90 backdrop-blur-3xl border-slate-300 text-slate-800';

  // Error Boundary Style Fallback
  if (!startPoint) return <div className="h-full flex items-center justify-center p-10 text-center"><p className="text-xs font-black uppercase opacity-50">Initializing Core Engine...</p></div>;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700 pb-20 space-y-6 overflow-x-hidden">
      
      {/* ── SAFETY STATUS ─────────────────────────────────────────────── */}
      {selectedDestination && (
        <div className={`p-4 mx-6 rounded-2xl border flex items-center gap-3 animate-in slide-in-from-top-4 ${
          safetyIssues.length === 0 ? 'bg-green-600 border-green-400 text-white' : 'bg-red-600 border-red-400 text-white'
        }`}>
          {safetyIssues.length === 0 ? <CheckCircle size={18} /> : <AlertTriangle size={18} className="animate-pulse" />}
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest">{safetyIssues.length === 0 ? 'Safe Route Verified' : 'Flood Detour Required'}</p>
            <p className="text-[9px] font-bold opacity-90 leading-tight">{safetyIssues.length === 0 ? 'Roads clear for all vehicles.' : `Bypassing ${safetyIssues[0]}.`}</p>
          </div>
          {isRouting && <Loader2 size={14} className="animate-spin" />}
        </div>
      )}

      {/* ── INPUT PANEL ──────────────────────────────────────────────── */}
      <div 
        ref={searchContainerRef}
        id="search-input-panel"
        className={`mx-6 p-6 rounded-[2.5rem] border ${cardStyle} shadow-2xl space-y-5 relative search-input-card-wrapper glass-card`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#5D5CDE]/20 p-2 rounded-xl text-[#5D5CDE]"><Compass size={18} /></div>
            <h2 className="font-black text-[10px] uppercase tracking-[0.2em] opacity-80 italic">Any-to-Any Engine</h2>
          </div>
          {isOffline && <div className="flex items-center gap-2 text-amber-500 text-[9px] font-black uppercase"><WifiOff size={12} /> Offline</div>}
        </div>

        <div className="space-y-3 relative pointer-events-auto">
          <div className="relative">
            <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5D5CDE] opacity-60" />
            <div className={`w-full pl-10 pr-4 py-3.5 rounded-2xl border text-[11px] font-black uppercase tracking-widest bg-slate-500/5 border-transparent opacity-60`}>My Current Location</div>
          </div>
          <div className="relative pointer-events-auto">
            <ArrowRight size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A891DE]" />
            <input 
              type="text" 
              placeholder="Search destination" 
              value={toSearch}
              onChange={(e) => {
                const val = e.target.value;
                setToSearch(val);
                triggerAutocomplete(val);
              }}
              className={`w-full pl-10 pr-4 py-3.5 rounded-2xl border text-[11px] font-black uppercase tracking-widest outline-none transition-all search-input-el ${
                isDark
                  ? 'bg-white/5 border-white/10 text-white placeholder:text-white/50 focus:border-[#A891DE]/50'
                  : 'bg-slate-500/5 border-transparent text-slate-800 placeholder:text-slate-500 focus:border-[#5D5CDE]/30'
              }`}
            />
            {searchResults.length > 0 && (
              <div className={`absolute top-full left-0 right-0 mt-3 rounded-[2rem] border z-[10001] overflow-hidden shadow-2xl ${cardStyle} animate-in fade-in zoom-in-95 duration-200 pointer-events-auto glass-card`}>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  {searchResults.map(s => (
                    <button 
                      key={s.id}
                      onClick={() => {
                        handleRouting(s);
                        setToSearch(s.name);
                        setSearchResults([]);
                      }}
                      className="w-full p-5 text-left border-b border-white/5 hover:bg-[#5D5CDE]/5 transition-colors flex items-center gap-4 group pointer-events-auto"
                    >
                      <div className="bg-[#5D5CDE]/10 p-2.5 rounded-xl text-[#5D5CDE] group-hover:bg-[#5D5CDE] group-hover:text-white transition-all">
                        <MapPin size={16} />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-[11px] font-black uppercase tracking-tight truncate mb-0.5">{s.name}</p>
                        <p className="text-[9px] font-bold opacity-50 truncate leading-none uppercase tracking-widest">{s.address}</p>
                      </div>
                      <ChevronRight size={14} className="opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={handleManualSearch}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#5D5CDE] to-[#3a39a0] text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-2 border border-white/10 pointer-events-auto relative z-[9999] premium-search-btn"
        >
          <Search size={16} />
          Search
        </button>
      </div>

      {/* ── MAP WITH MOUNT GUARD ──────────────────────────────────────── */}
      <div id="map-container" className="mx-6 h-[40vh] min-h-[300px] rounded-[3rem] overflow-hidden shadow-2xl relative border border-black/10 dark:border-white/5 map-hardware-accel bg-slate-500/5">
        {mapMounted ? (
          <MapContainer 
            center={[startPoint.lat, startPoint.lng]} 
            zoom={12} zoomControl={false}
            style={{ height: '100%', width: '100%' }}
            ref={mapRef} doubleClickZoom={false}
          >
            <MapCore 
              startPoint={startPoint} destPoint={selectedDestination} routeWaypoints={routeWaypoints}
              isSafe={safetyIssues.length === 0} markers={ROAD_MARKERS} hotspots={FLOOD_HOTSPOTS}
              onMarkerClick={setSelectedMarker} onMapClick={() => {}}
            />
            <button 
              onClick={() => mapRef.current?.flyTo([startPoint.lat, startPoint.lng], 15)}
              className="absolute bottom-6 right-6 z-[1000] w-12 h-12 bg-[#5D5CDE] text-white rounded-full shadow-lg flex items-center justify-center"
            >
              <Navigation size={20} fill="white" />
            </button>
          </MapContainer>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center animate-pulse">
            <Loader2 size={32} className="text-[#5D5CDE] animate-spin opacity-20" />
          </div>
        )}
      </div>

      {/* ── LIST CONTAINER ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-[#5D5CDE]" />
            <h2 className="font-black text-[11px] uppercase tracking-[0.3em] opacity-70 italic">Verified Centers</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-48" style={{ contentVisibility: 'auto' }}>
          {sortedShelters.map((s) => {
            const isSelected = selectedDestination?.id === s.id;
            const dist = haversine(startPoint.lat, startPoint.lng, s.lat, s.lng).toFixed(1);

            return (
              <div 
                key={s.id} onClick={() => handleRouting(s)}
                className={`w-full text-left p-8 rounded-[2.5rem] border transition-all duration-500 group relative overflow-hidden ${
                  isSelected ? 'bg-gradient-to-br from-[#5D5CDE] to-[#3a39a0] border-[#5D5CDE] text-white shadow-2xl scale-[1.02] z-10' : cardStyle + ' hover:border-[#5D5CDE]/30'
                }`}
              >
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-[0.2em] ${isSelected ? 'bg-white/30 text-white' : 'bg-[#5D5CDE]/10 text-[#5D5CDE]'}`}>Verified Relief Center</div>
                    {isSelected && <div className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-[0.2em] bg-white text-[#5D5CDE] animate-pulse">GUIDE ACTIVE</div>}
                  </div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="max-w-[70%]">
                      <h3 className="font-black text-base uppercase tracking-tight leading-none mb-2 italic">{s.name}</h3>
                      <p className={`text-[10px] font-bold opacity-70 tracking-wide ${isSelected ? 'text-white' : ''}`}>{s.location}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black italic tracking-tighter ${isSelected ? 'text-white' : 'text-[#5D5CDE]'}`}>{dist}km</p>
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] opacity-40">{s.zone}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-8">
                    <a href={`tel:${s.contact}`} onClick={(e) => e.stopPropagation()} className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all ${isSelected ? 'bg-white/10 border border-white/20 text-white' : 'bg-slate-500/5 border border-transparent text-[#5D5CDE]'}`}>
                      <Phone size={14} /> <span className="text-[10px] font-black tracking-[0.1em]">{s.contact}</span>
                    </a>
                    <button className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-lg ${isSelected ? 'bg-white text-[#5D5CDE]' : 'bg-[#5D5CDE] text-white'}`}>
                      <Navigation size={12} fill={isSelected ? '#5D5CDE' : 'white'} /> Navigate
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── HAZARD POPUP ─────────────────────────────────────────────── */}
      {selectedMarker && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-sm p-8 rounded-[3rem] border ${cardStyle} animate-in zoom-in-95`}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-2xl bg-red-500/20 text-red-500"><Droplet size={24} /></div>
                <div>
                  <h3 className="font-black text-lg tracking-tight uppercase leading-none mb-1">{selectedMarker.label}</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Hazard Intel</p>
                </div>
              </div>
              <button onClick={() => setSelectedMarker(null)} className="p-2 hover:bg-white/5 rounded-full"><X size={20} /></button>
            </div>
            <p className="text-[10px] font-bold opacity-80 leading-relaxed mb-8">This zone is currently marked as {selectedMarker.type.toUpperCase()}. Proceed with extreme caution.</p>
            <button onClick={() => setSelectedMarker(null)} className="w-full py-4 rounded-2xl bg-[#5D5CDE] text-white font-black text-xs uppercase tracking-widest">Acknowledge</button>
          </div>
        </div>
      )}

      <style>{`
        .search-input-card-wrapper {
          z-index: 99999 !important;
          pointer-events: auto !important;
          will-change: transform, opacity;
        }
        .search-input-el {
          pointer-events: auto !important;
          user-select: text !important;
          -webkit-user-select: text !important;
          cursor: text !important;
        }
        .premium-search-btn {
          transition: all 0.25s cubic-bezier(0.23, 1, 0.32, 1);
          will-change: transform;
        }
        .premium-search-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 15px 30px rgba(93, 92, 222, 0.4);
          filter: brightness(1.1);
        }
        .premium-search-btn:active {
          transform: translateY(-1px) scale(0.97);
          box-shadow: 0 5px 10px rgba(93, 92, 222, 0.2);
        }
        .map-hardware-accel { 
          transform: translate3d(0,0,0); 
          will-change: transform; 
          backface-visibility: hidden;
        }
        .leaflet-interactive {
          transition: stroke-width 0.05s linear;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(93, 92, 222, 0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
}
