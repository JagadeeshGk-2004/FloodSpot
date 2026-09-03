import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Search, 
  MapPin, 
  AlertTriangle, 
  Droplet, 
  Clock, 
  ThumbsUp, 
  ThumbsDown, 
  ShieldCheck, 
  CheckCircle2, 
  Navigation2, 
  Crosshair,
  Sparkles,
  Layers,
  X,
  Compass
} from 'lucide-react';
import { voteFloodReport } from '../lib/supabase';

// Fix Leaflet Default Marker Icon Assets for Webpack/Vite bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Default Chennai Coordinates
const CHENNAI_CENTER = [13.0827, 80.2707];
const DEFAULT_ZOOM = 13;
const FLY_TO_ZOOM = 15.5;

// High-Performance Esri Dark Gray Canvas Map Tile Configuration (Zero Keys, Zero Watermarks)
const DARK_MAP_TILE = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
  maxZoom: 16,
};

// Initial Mock Hotspots / Rescue Shelters in Chennai
const MOCK_CRITICAL_INFRASTRUCTURE = [
  {
    id: 'infra-1',
    name: 'Chennai Central Relief & Evacuation Shelter',
    latitude: 13.0827,
    longitude: 80.2707,
    type: 'shelter',
    capacity: '1,500 Beds',
    status: 'Open 24/7',
    location_name: 'Central Chennai Relief Shelter',
    description: 'Equipped with food supplies, medical triage desk, and emergency backup power generators.'
  },
  {
    id: 'infra-2',
    name: 'Velachery Stormwater Pumping Sub-station',
    latitude: 12.9788,
    longitude: 80.2209,
    type: 'infrastructure',
    capacity: '4,000 L/min',
    status: 'Operational',
    location_name: 'Velachery Drainage Canal Outlet',
    description: 'Stormwater canal desilting completed. High priority monitoring zone during heavy rainfall.'
  },
  {
    id: 'infra-3',
    name: 'T. Nagar Underground Drainage Station',
    latitude: 13.0405,
    longitude: 80.2337,
    type: 'infrastructure',
    capacity: '3,200 L/min',
    status: 'Operational',
    location_name: 'Usman Road Relief Zone',
    description: 'Historical low-lying area. Elevated multi-level parking recommended during heavy rain alerts.'
  }
];

/**
 * Custom High-Contrast SVG Leaflet Markers according to Severity
 */
function createSeverityIcon(severity, upvotes = 0, downvotes = 0) {
  const isFlaggedFake = downvotes >= (upvotes + 3);
  let color = '#38bdf8'; // Default Cyan
  let borderColor = '#0284c7';
  let pulseColor = 'rgba(56, 189, 248, 0.4)';
  let iconContent = '💧';

  if (isFlaggedFake) {
    color = '#64748b'; // Slate Grey for flagged fake reports
    borderColor = '#334155';
    pulseColor = 'rgba(100, 116, 139, 0.2)';
    iconContent = '⚠️';
  } else if (severity === 'critical') {
    color = '#ef4444'; // Red
    borderColor = '#991b1b';
    pulseColor = 'rgba(239, 68, 68, 0.6)';
    iconContent = '🚨';
  } else if (severity === 'high') {
    color = '#f97316'; // Orange
    borderColor = '#9a3412';
    pulseColor = 'rgba(249, 115, 22, 0.5)';
    iconContent = '🌊';
  } else if (severity === 'medium') {
    color = '#f59e0b'; // Amber
    borderColor = '#b45309';
    pulseColor = 'rgba(245, 158, 11, 0.4)';
    iconContent = '⚠️';
  }

  const svgHtml = `
    <div style="
      position: relative;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    ">
      <div style="
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background-color: ${pulseColor};
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: ${color};
        border: 2px solid #ffffff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      ">
        ${iconContent}
      </div>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-leaflet-marker',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19]
  });
}

function createInfrastructureIcon(type) {
  const isShelter = type === 'shelter';
  const color = isShelter ? '#10b981' : '#6366f1';
  const iconSymbol = isShelter ? '🏥' : '⚙️';

  const svgHtml = `
    <div style="
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background-color: ${color};
      border: 2px solid #ffffff;
      box-shadow: 0 4px 10px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      cursor: pointer;
    ">
      ${iconSymbol}
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-infra-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
}

/**
 * Controller component inside MapContainer to trigger smooth Leaflet map.flyTo animations
 */
function MapFlyToController({ targetLocation, zoom, triggerKey }) {
  const map = useMap();

  useEffect(() => {
    if (targetLocation && targetLocation[0] && targetLocation[1]) {
      map.flyTo(targetLocation, zoom || FLY_TO_ZOOM, {
        animate: true,
        duration: 1.2
      });
    }
  }, [targetLocation, zoom, triggerKey, map]);

  return null;
}

export default function Map({ 
  reports = [], 
  weatherState = null, 
  onSelectReport = null, 
  onShowToast = null,
  activeFilter = 'all'
}) {
  const [userLocation, setUserLocation] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // Search Bar logic with Nominatim Geocoding API
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Map Animation Fly-To States
  const [flyToTarget, setFlyToTarget] = useState(CHENNAI_CENTER);
  const [flyToTrigger, setFlyToTrigger] = useState(0);

  // Local Vote Tracker to prevent multiple votes per session
  const [votedReportIds, setVotedReportIds] = useState(new Set());

  // Filter reports based on active severity filter tab
  const activeReports = useMemo(() => {
    if (!reports) return [];
    if (activeFilter === 'all') return reports;
    return reports.filter(r => r.severity === activeFilter);
  }, [reports, activeFilter]);

  // Handle Nominatim Search Suggestions API
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=in&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data || []);
          setShowSearchDropdown(true);
        }
      } catch (err) {
        console.warn('[Map Search] Geocoding API error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle Selecting a Search Result
  const handleSelectSearchResult = (result) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    if (!isNaN(lat) && !isNaN(lon)) {
      setFlyToTarget([lat, lon]);
      setFlyToTrigger(prev => prev + 1);
      setSearchQuery(result.display_name.split(',')[0]);
      setShowSearchDropdown(false);

      if (onShowToast) {
        onShowToast(`Moved map to ${result.display_name.split(',')[0]}`, 'info');
      }
    }
  };

  // High-Precision GPS Hardware Relocation Handler
  const handleRelocateUser = () => {
    setIsLocating(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setIsLocating(false);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const coords = [latitude, longitude];

        setUserLocation(coords);
        setLocationAccuracy(accuracy);
        setIsLocating(false);

        // Smoothly center map to high-precision hardware location
        setFlyToTarget(coords);
        setFlyToTrigger(prev => prev + 1);

        if (onShowToast) {
          onShowToast(`GPS Position Locked (±${Math.round(accuracy)}m accuracy)`, 'success');
        }
      },
      (error) => {
        console.warn('[GPS Relocate] Geolocation error:', error.message);
        setIsLocating(false);
        setLocationError(error.message || 'Failed to lock GPS position.');

        // Fallback: Default to Chennai central
        setFlyToTarget(CHENNAI_CENTER);
        setFlyToTrigger(prev => prev + 1);

        if (onShowToast) {
          onShowToast('Could not retrieve hardware GPS coordinates. Defaulting to Chennai central.', 'warning');
        }
      },
      options
    );
  };

  // Trigger GPS positioning on initial mount
  useEffect(() => {
    handleRelocateUser();
  }, []);

  // Handle Community Voting
  const handleVote = async (reportId, voteType, e) => {
    e.stopPropagation();
    if (votedReportIds.has(reportId)) {
      if (onShowToast) onShowToast('You have already voted on this report.', 'warning');
      return;
    }

    try {
      setVotedReportIds(prev => new Set([...prev, reportId]));
      await voteFloodReport(reportId, voteType);
      if (onShowToast) {
        onShowToast(`Submitted ${voteType === 'up' ? 'upvote' : 'downvote'} for verification.`, 'success');
      }
    } catch (err) {
      console.error('[Map Vote] Error:', err);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-4rem)] overflow-hidden bg-slate-950">
      
      {/* Leaflet Map Container */}
      <MapContainer
        center={CHENNAI_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={5}
        maxZoom={16}
        maxBounds={[[5.0, 68.0], [38.0, 97.0]]}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={true}
        zoomControl={false}
        className="w-full h-full z-0 will-change-transform bg-[#090d16]"
        style={{ backgroundColor: '#090d16', transform: 'translate3d(0,0,0)' }}
      >
        {/* Esri Dark Gray Canvas Tile Layer (Zero Keys, Zero Watermarks) */}
        <TileLayer
          key="esri-dark-gray-v2"
          url={DARK_MAP_TILE.url}
          attribution={DARK_MAP_TILE.attribution}
          maxZoom={16}
          maxNativeZoom={16}
          keepBuffer={8}
          updateWhenZooming={false}
          updateWhenIdle={true}
        />
        
        {/* Smooth Map Fly-To Animation Controller */}
        <MapFlyToController 
          targetLocation={flyToTarget} 
          zoom={FLY_TO_ZOOM} 
          triggerKey={flyToTrigger} 
        />

        {/* User GPS location Accuracy Circle Radius */}
        {userLocation && locationAccuracy && (
          <Circle 
            center={userLocation} 
            radius={Math.min(200, Math.max(15, locationAccuracy))} 
            pathOptions={{ 
              fillColor: '#38bdf8', 
              fillOpacity: 0.12, 
              color: '#0284c7', 
              weight: 1.5, 
              dashArray: '4, 4' 
            }} 
          />
        )}

        {/* High-Precision Blue Pulsating User Location Dot */}
        {userLocation && (
          <Marker 
            position={userLocation}
            icon={L.divIcon({
              html: `
                <div style="position: relative; width: 24px; height: 24px;">
                  <div style="position: absolute; inset: 0; border-radius: 50%; background-color: rgba(56, 189, 248, 0.4); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                  <div style="position: absolute; inset: 3px; border-radius: 50%; background-color: #38bdf8; border: 2.5px solid #ffffff; box-shadow: 0 0 12px #38bdf8;"></div>
                </div>
              `,
              className: 'user-gps-dot',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })}
          >
            <Popup className="dark-leaflet-popup">
              <div className="p-2 space-y-1 text-slate-100 text-xs">
                <div className="font-bold flex items-center gap-1.5 text-cyan-400">
                  <Navigation2 className="w-3.5 h-3.5 fill-cyan-400" />
                  <span>Your Current Hardware GPS Location</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Accuracy: ±{Math.round(locationAccuracy || 10)} meters
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Render User & Community Submitted Flood Incident Markers */}
        {activeReports.map((report) => {
          const upvotes = report.upvotes || 0;
          const downvotes = report.downvotes || 0;
          const isFlaggedFake = downvotes >= (upvotes + 3);

          return (
            <Marker
              key={report.id || `report-${report.latitude}-${report.longitude}`}
              position={[report.latitude, report.longitude]}
              icon={createSeverityIcon(report.severity, upvotes, downvotes)}
              eventHandlers={{
                click: () => {
                  if (onSelectReport) onSelectReport(report);
                }
              }}
            >
              <Popup className="dark-leaflet-popup min-w-[240px]">
                <div className="p-2.5 space-y-2 text-xs">
                  {/* Photo Evidence Header */}
                  {report.image_url && (
                    <div className="relative rounded-xl overflow-hidden mb-2 bg-slate-900 border border-slate-700">
                      <img 
                        src={report.image_url} 
                        alt="Flood incident evidence" 
                        className="w-full h-28 object-cover"
                      />
                      <span className="absolute bottom-1 right-1 text-[9px] bg-slate-950/80 px-1.5 py-0.5 rounded text-cyan-300 font-semibold border border-cyan-500/40">
                        Feature Verified
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full border ${
                      isFlaggedFake ? 'bg-slate-800 text-slate-400 border-slate-600' :
                      report.severity === 'critical' ? 'bg-red-950/80 text-red-400 border-red-800' :
                      report.severity === 'high' ? 'bg-orange-950/80 text-orange-400 border-orange-800' :
                      report.severity === 'medium' ? 'bg-amber-950/80 text-amber-400 border-amber-800' :
                      'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                    }`}>
                      {isFlaggedFake ? 'Unverified / Flagged' : report.severity}
                    </span>

                    {report.verified && !isFlaggedFake && (
                      <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-semibold bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/50">
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        Feature Verified
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    {report.location_name || 'Reported Location'}
                  </h4>

                  {report.water_depth && (
                    <p className="text-xs font-medium text-cyan-300 flex items-center gap-1">
                      <Droplet className="w-3 h-3 fill-cyan-400 text-cyan-400" />
                      Water Depth: <span className="font-bold text-slate-100">{report.water_depth}</span>
                    </p>
                  )}

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {report.description || 'No detailed description provided.'}
                  </p>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {report.created_at ? new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                    </span>

                    {/* Community Upvote / Downvote Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleVote(report.id, 'up', e)}
                        disabled={votedReportIds.has(report.id)}
                        className={`p-1 rounded hover:bg-emerald-950/60 transition-colors flex items-center gap-0.5 cursor-pointer disabled:opacity-50 ${
                          votedReportIds.has(report.id) ? 'text-emerald-400' : 'text-slate-400 hover:text-emerald-400'
                        }`}
                        title="Upvote accuracy"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>{upvotes}</span>
                      </button>

                      <button
                        onClick={(e) => handleVote(report.id, 'down', e)}
                        disabled={votedReportIds.has(report.id)}
                        className={`p-1 rounded hover:bg-red-950/60 transition-colors flex items-center gap-0.5 cursor-pointer disabled:opacity-50 ${
                          votedReportIds.has(report.id) ? 'text-red-400' : 'text-slate-400 hover:text-red-400'
                        }`}
                        title="Flag inaccurate report"
                      >
                        <ThumbsDown className="w-3 h-3" />
                        <span>{downvotes}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Render Critical Infrastructure & Relief Shelters Markers */}
        {MOCK_CRITICAL_INFRASTRUCTURE.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.latitude, loc.longitude]}
            icon={createInfrastructureIcon(loc.type)}
          >
            <Popup className="dark-leaflet-popup min-w-[220px]">
              <div className="p-2 space-y-1.5 text-xs text-slate-200">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md ${
                    loc.type === 'shelter' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                  }`}>
                    {loc.type === 'shelter' ? 'Relief Shelter' : 'Infrastructure Sub-station'}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold">{loc.status}</span>
                </div>

                <h4 className="font-bold text-sm text-slate-100">{loc.name}</h4>
                <p className="text-[11px] text-slate-300 leading-snug">{loc.description}</p>

                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                  Capacity / Rating: <span className="font-semibold text-cyan-300">{loc.capacity}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Floating Top Search Bar with OpenStreetMap Nominatim Geocoding API */}
      <div className="absolute top-16 left-4 right-4 z-30 flex flex-col gap-2 max-w-md mx-auto pointer-events-auto">
        <div className="relative">
          <div className="glass-panel rounded-2xl p-2.5 shadow-2xl flex items-center gap-2 border border-[#1E293B]">
            <div className="relative flex-1 flex items-center">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search place or address in India..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true); }}
                className="w-full bg-[#111827] text-[#F8FAFC] placeholder-[#64748B] text-xs rounded-xl pl-9 pr-8 py-2 border border-[#1E293B] focus:outline-none focus:border-[#38BDF8] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearchDropdown(false); }}
                  className="absolute right-2.5 p-1 text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Nominatim Search Dropdown Suggestions */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 glass-panel bg-[#111827] rounded-2xl border border-[#1E293B] shadow-2xl overflow-hidden z-40 max-h-60 overflow-y-auto no-scrollbar animate-in fade-in duration-200">
              {searchResults.map((result, idx) => (
                <button
                  key={`search-res-${idx}`}
                  onClick={() => handleSelectSearchResult(result)}
                  className="w-full px-3 py-2.5 text-left text-xs text-[#F8FAFC] hover:bg-[#1E293B] border-b border-[#1E293B] last:border-0 flex items-start gap-2 cursor-pointer transition-colors"
                >
                  <MapPin className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
                  <div className="truncate">
                    <span className="font-semibold text-[#F8FAFC] block truncate">
                      {result.display_name.split(',')[0]}
                    </span>
                    <span className="text-[10px] text-[#94A3B8] truncate block">
                      {result.display_name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating GPS Relocate Button (Bottom Right) */}
      <div className="absolute bottom-24 right-4 z-30 pointer-events-auto">
        <button
          onClick={handleRelocateUser}
          disabled={isLocating}
          title="Relocate Hardware GPS Location"
          className="p-3 bg-[#111827] hover:bg-[#1E293B] border border-[#1E293B] text-[#38BDF8] hover:text-cyan-300 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <Crosshair className={`w-5 h-5 ${isLocating ? 'animate-spin text-[#F59E0B]' : 'text-[#38BDF8]'}`} />
        </button>
      </div>

    </div>
  );
}
