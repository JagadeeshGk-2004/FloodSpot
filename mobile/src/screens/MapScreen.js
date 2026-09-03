import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { COLORS, SHADOWS } from '../theme/colors';
import { GlassView } from '../components/GlassView';
import { WeatherPill } from '../components/WeatherPill';
import { ToastNotification } from '../components/ToastNotification';
import { apiClient, ENDPOINTS } from '../config/api';
import {
  MapPin,
  ThumbsUp,
  ThumbsDown,
  X,
  Layers,
  Search,
  Crosshair,
  Droplet,
  Sparkles,
} from 'lucide-react-native';

const MOCK_CRITICAL_INFRASTRUCTURE = [
  {
    id: 'infra-1',
    name: 'Central Relief & Evacuation Shelter',
    latitude: 13.0827,
    longitude: 80.2707,
    type: 'shelter',
    capacity: '1,500 Beds',
    status: 'Open 24/7',
    description: 'Equipped with food supplies, medical triage desk, emergency generators.'
  },
  {
    id: 'infra-2',
    name: 'Velachery Stormwater Pumping Sub-station',
    latitude: 12.9788,
    longitude: 80.2209,
    type: 'infrastructure',
    capacity: '4,000 L/min',
    status: 'Operational',
    description: 'Stormwater canal desilting completed. High priority drainage zone.'
  },
  {
    id: 'infra-3',
    name: 'T. Nagar Underground Drainage Station',
    latitude: 13.0405,
    longitude: 80.2337,
    type: 'infrastructure',
    capacity: '3,200 L/min',
    status: 'Operational',
    description: 'Usman Road drainage relief pumps running.'
  }
];

function formatConfidence(val) {
  if (val === null || val === undefined) return 95;
  const num = Number(val);
  if (isNaN(num)) return 95;
  if (num <= 1.0) return Math.min(100, Math.max(0, Math.round(num * 100)));
  return Math.min(100, Math.max(0, Math.round(num)));
}

function formatString(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return val.name || val.location_name || val.title || (val.latitude && val.longitude ? `${val.latitude}, ${val.longitude}` : fallback);
  }
  return String(val);
}

export default function MapScreen() {
  const [userLocation, setUserLocation] = useState({
    latitude: 13.0827,
    longitude: 80.2707,
  });
  const [filteredReports, setFilteredReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [toastNotification, setToastNotification] = useState(null);

  // Nominatim Search bar state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Layers toggle
  const [showShelters, setShowShelters] = useState(true);
  const [showHeatmaps, setShowHeatmaps] = useState(true);

  const webViewRef = useRef(null);

  const showToast = (text, type = 'info') => {
    setToastNotification({ text, type });
    setTimeout(() => setToastNotification(null), 4000);
  };

  useEffect(() => {
    fetchUserLocation();
    fetchReports();
    fetchWeather();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchReports();
      fetchWeather();
    }, [])
  );

  const fetchUserLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const newCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setUserLocation(newCoords);
        setLocationAccuracy(loc.coords.accuracy || 15);
        if (webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({ type: 'FLY_TO', lat: loc.coords.latitude, lon: loc.coords.longitude }));
        }
      }
    } catch (err) {
      console.log('[MapScreen] Location access notice:', err.message);
    } finally {
      setIsLocating(false);
    }
  };

  const fetchWeather = async () => {
    try {
      const resp = await apiClient.get(ENDPOINTS.WEATHER_CURRENT, {
        params: { lat: userLocation.latitude, lon: userLocation.longitude },
      });
      setWeatherData(resp.data);
    } catch (e) {
      console.log('Weather fetch note:', e.message);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const resp = await apiClient.get(ENDPOINTS.REPORTS);
      if (resp.data) {
        const activeReports = resp.data.filter((r) => {
          const downvotes = r.downvotes || r.fake_flags || 0;
          return downvotes < 3 && r.status !== 'FLAGGED_REMOVED';
        });
        setReports(activeReports);
        setFilteredReports(activeReports);
      }
    } catch (err) {
      console.log('[MapScreen] Error fetching reports:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Nominatim Search Geocoding API
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
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
        console.log('[Search] Geocoding API error:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSearchResult = (result) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    if (!isNaN(lat) && !isNaN(lon)) {
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({ type: 'FLY_TO', lat, lon }));
      }
      setSearchQuery(result.display_name.split(',')[0]);
      setShowSearchDropdown(false);
      showToast(`Moved map to ${result.display_name.split(',')[0]}`, 'info');
    }
  };

  const handleVote = async (reportId, voteType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const resp = await apiClient.post(ENDPOINTS.REPORT_VOTE(reportId), { vote_type: voteType });
      if (resp.data) {
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, ...resp.data } : r))
        );
        setSelectedReport((prev) => (prev && prev.id === reportId ? { ...prev, ...resp.data } : prev));
        showToast(`Vote submitted successfully.`, 'success');
      }
    } catch (err) {
      showToast('Could not record vote.', 'critical');
    }
  };

  // Generate Leaflet Map HTML
  const getMapHTML = () => {
    const reportsJSON = JSON.stringify(filteredReports);
    const userLocJSON = JSON.stringify(userLocation);
    const infraJSON = JSON.stringify(showShelters ? MOCK_CRITICAL_INFRASTRUCTURE : []);
    const heatmapsActive = showHeatmaps;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
          #map { width: 100vw; height: 100vh; background: #090d16; }
          .pulse-icon {
            border-radius: 50%;
            animation: pulse 1.5s infinite;
          }
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); transform: scale(0.95); }
            70% { box-shadow: 0 0 0 16px rgba(239, 68, 68, 0); transform: scale(1.08); }
            100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); transform: scale(0.95); }
          }
          .user-pulse {
            animation: userPulse 2s infinite;
          }
          @keyframes userPulse {
            0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.8); }
            70% { box-shadow: 0 0 0 18px rgba(56, 189, 248, 0); }
            100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var userLoc = ${userLocJSON};
          var reports = ${reportsJSON};
          var infraList = ${infraJSON};
          var showHeat = ${heatmapsActive};

          var map = L.map('map', { zoomControl: false }).setView([userLoc.latitude, userLoc.longitude], 13);
          
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 16,
            attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
          }).addTo(map);

          // Listen for Fly-To messages
          document.addEventListener("message", function(event) {
            try {
              var data = JSON.parse(event.data);
              if (data.type === 'FLY_TO') {
                map.flyTo([data.lat, data.lon], 15, { animate: true, duration: 1.2 });
              }
            } catch(e) {}
          });

          // Add User Location Marker
          var userMarkerHtml = '<div class="user-pulse" style="width:24px;height:24px;background:#38bdf8;border:3px solid #ffffff;border-radius:50%;box-shadow:0 0 12px rgba(56,189,248,0.9);"></div>';
          var userIcon = L.divIcon({ html: userMarkerHtml, className: '', iconSize: [24, 24] });
          L.marker([userLoc.latitude, userLoc.longitude], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);

          // Add Heatmap / Water Depth Overlay Circles
          if (showHeat) {
            reports.forEach(function(rep) {
              var rLat = Number(rep.latitude);
              var rLon = Number(rep.longitude);
              var radius = rep.severity === 'critical' ? 400 : (rep.severity === 'high' ? 250 : 150);
              var circleColor = rep.severity === 'critical' ? '#ef4444' : '#f97316';
              L.circle([rLat, rLon], {
                radius: radius,
                color: circleColor,
                fillColor: circleColor,
                fillOpacity: 0.18,
                weight: 1,
                dashArray: '4, 4'
              }).addTo(map);
            });
          }

          // Add Infrastructure & Relief Shelter Markers
          infraList.forEach(function(infra) {
            var color = infra.type === 'shelter' ? '#10b981' : '#6366f1';
            var symbol = infra.type === 'shelter' ? '🏥' : '⚙️';
            var infraHtml = '<div style="width:30px;height:30px;border-radius:8px;background:'+color+';border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 4px 10px rgba(0,0,0,0.5);">'+symbol+'</div>';
            var infraIcon = L.divIcon({ html: infraHtml, className: '', iconSize: [30, 30] });
            var marker = L.marker([infra.latitude, infra.longitude], { icon: infraIcon }).addTo(map);
            marker.on('click', function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_INFRA', data: infra }));
            });
          });

          // Add Flood Incident Markers
          reports.forEach(function(rep, index) {
            var lat = Number(rep.latitude);
            var lon = Number(rep.longitude);

            var color = rep.severity === 'critical' ? '#ef4444' : (rep.severity === 'high' ? '#f97316' : '#f59e0b');
            var size = rep.severity === 'critical' ? 28 : 22;
            var symbol = rep.severity === 'critical' ? '🚨' : (rep.severity === 'high' ? '🌊' : '💧');
            var markerHtml = '<div class="pulse-icon" style="width:'+size+'px;height:'+size+'px;background:'+color+';border:2px solid #ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.5);">'+symbol+'</div>';
            var customIcon = L.divIcon({ html: markerHtml, className: '', iconSize: [size, size] });
            
            var marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);
            marker.on('click', function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_REPORT', data: rep }));
            });
          });
        </script>
      </body>
      </html>
    `;
  };

  const onMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'SELECT_REPORT') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSelectedReport(msg.data);
      } else if (msg.type === 'SELECT_INFRA') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        showToast(`${msg.data.name} (${msg.data.status})`, 'info');
      }
    } catch (e) {
      console.log('WebView message error:', e);
    }
  };

  return (
    <View style={styles.container}>
      {/* Non-Blocking Toast Notification */}
      <ToastNotification toast={toastNotification} onDismiss={() => setToastNotification(null)} />

      {/* Dark Leaflet WebView Map */}
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: getMapHTML() }}
        style={styles.mapWebView}
        onMessage={onMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />

      {/* Top Navbar */}
      <View style={styles.topHeader}>
        <View style={styles.brandGroup}>
          <View style={styles.logoBadge}>
            <Droplet size={14} color={COLORS.skyBlue} />
          </View>
          <Text style={styles.brandTitle}>FloodSpot</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={styles.statusBadgePill}>
            <View style={styles.statusBadgeDot} />
            <Text style={styles.statusBadgePillText}>Hydro Depth Active</Text>
          </View>
          <WeatherPill weather={weatherData} />
        </View>
      </View>

      {/* Floating Nominatim Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search place or address in India..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true); }}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); setShowSearchDropdown(false); }}>
              <X size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Dropdown Suggestions */}
        {showSearchDropdown && searchResults.length > 0 && (
          <GlassView style={styles.dropdownContainer}>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {searchResults.map((res, idx) => (
                <TouchableOpacity
                  key={`search-res-${idx}`}
                  style={styles.dropdownItem}
                  onPress={() => handleSelectSearchResult(res)}
                >
                  <MapPin size={14} color={COLORS.skyBlue} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dropdownTitle} numberOfLines={1}>
                      {res.display_name.split(',')[0]}
                    </Text>
                    <Text style={styles.dropdownSub} numberOfLines={1}>
                      {res.display_name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </GlassView>
        )}
      </View>

      {/* Map Layer Toggles Floating Chips (Top Right) */}
      <View style={styles.layersContainer}>
        <TouchableOpacity
          style={[styles.layerChip, showShelters && styles.layerChipActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowShelters(!showShelters);
          }}
        >
          <Layers size={14} color={showShelters ? '#FFF' : COLORS.textMuted} />
          <Text style={[styles.layerChipText, showShelters && styles.layerChipTextActive]}>Shelters</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.layerChip, showHeatmaps && styles.layerChipActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowHeatmaps(!showHeatmaps);
          }}
        >
          <Droplet size={14} color={showHeatmaps ? '#FFF' : COLORS.textMuted} />
          <Text style={[styles.layerChipText, showHeatmaps && styles.layerChipTextActive]}>Heatmaps</Text>
        </TouchableOpacity>
      </View>

      {/* Floating GPS Relocate Button (Bottom Right) */}
      <TouchableOpacity
        style={styles.gpsRelocateBtn}
        onPress={fetchUserLocation}
        disabled={isLocating}
      >
        <Crosshair size={20} color={isLocating ? COLORS.mediumYellow : COLORS.skyBlue} />
      </TouchableOpacity>

      {/* Selected Report Preview Card */}
      {selectedReport && (
        <GlassView style={styles.reportCard} intensity="high">
          <View style={styles.cardHeader}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {formatString(selectedReport.location_name || selectedReport.location, 'Reported Area')}
              </Text>
              <View
                style={[
                  styles.sevBadge,
                  selectedReport.severity === 'critical'
                    ? { backgroundColor: 'rgba(239,68,68,0.2)', borderColor: COLORS.danger }
                    : { backgroundColor: 'rgba(249,115,22,0.2)', borderColor: COLORS.highOrange },
                ]}
              >
                <Text
                  style={[
                    styles.sevBadgeText,
                    selectedReport.severity === 'critical' ? { color: COLORS.danger } : { color: COLORS.highOrange },
                  ]}
                >
                  {formatString(selectedReport.severity, 'HIGH').toUpperCase()}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={() => setSelectedReport(null)} style={{ padding: 4 }}>
              <X size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.cardBody}>
            {selectedReport.image_url ? (
              <Image source={{ uri: selectedReport.image_url }} style={styles.reportThumb} />
            ) : (
              <View style={styles.noThumb}>
                <MapPin size={22} color={COLORS.skyBlue} />
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {formatString(selectedReport.description, 'Waterlogging reported by citizen.')}
              </Text>

              {selectedReport.verified && (
                <View style={styles.verifiedRow}>
                  <Sparkles size={12} color={COLORS.skyBlue} />
                  <Text style={styles.verifiedText}>Hydro Depth Verified</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.voteMeta}>Community Voting:</Text>
            <View style={styles.voteGroup}>
              <TouchableOpacity style={styles.voteBtn} onPress={() => handleVote(selectedReport.id, 'up')}>
                <ThumbsUp size={12} color={COLORS.skyBlue} />
                <Text style={styles.voteText}>{selectedReport.upvotes || 0}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.voteBtn} onPress={() => handleVote(selectedReport.id, 'down')}>
                <ThumbsDown size={12} color={COLORS.textMuted} />
                <Text style={styles.voteText}>{selectedReport.downvotes || 0}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </GlassView>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  mapWebView: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  topHeader: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  drawerBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  brandTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  statusBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusBadgePillText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  searchContainer: {
    position: 'absolute',
    top: 102,
    left: 16,
    right: 16,
    zIndex: 30,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  dropdownContainer: {
    marginTop: 6,
    borderRadius: 16,
    padding: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  dropdownSub: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
  layersContainer: {
    position: 'absolute',
    top: 154,
    right: 16,
    flexDirection: 'row',
    gap: 6,
    zIndex: 20,
  },
  layerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  layerChipActive: {
    backgroundColor: COLORS.skyBlue,
    borderColor: COLORS.skyBlue,
  },
  layerChipText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  layerChipTextActive: {
    color: '#FFF',
  },
  gpsRelocateBtn: {
    position: 'absolute',
    bottom: 95,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 20,
    ...SHADOWS.card,
  },
  reportCard: {
    position: 'absolute',
    bottom: 95,
    left: 16,
    right: 68,
    padding: 12,
    zIndex: 20,
    ...SHADOWS.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  sevBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  sevBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  cardBody: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  reportThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  noThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
  },
  cardDesc: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  verifiedText: {
    color: COLORS.skyBlue,
    fontSize: 10,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  voteMeta: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  voteGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  voteText: {
    color: COLORS.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
});
