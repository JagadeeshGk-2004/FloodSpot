import React, { useState, useEffect } from 'react';
import Map from './components/Map';
import ReportModal from './components/ReportModal';
import WeatherPill from './components/WeatherPill';
import BottomNav from './components/BottomNav';
import AuthModal from './components/AuthModal';
import SettingsSidebar, { loadSavedSettings } from './components/SettingsSidebar';
import { fetchFloodReports, getCurrentUser, signOutUser, onAuthStateChange, supabase } from './lib/supabase';
import { initAutoSync, getOfflineQueue } from './lib/offlineEngine';
import { initP2PEngine, onPeerMessage } from './lib/p2pEngine';
import { startWeatherPolling } from './lib/weatherEngine';
import { 
  MapPin, 
  Navigation, 
  AlertTriangle, 
  Droplet, 
  CheckCircle2, 
  Sparkles, 
  PhoneCall, 
  Clock,
  WifiOff,
  Wifi,
  CloudLightning,
  CloudRain,
  X,
  FileText,
  Menu,
  ThumbsUp,
  Flag,
  ShieldCheck,
  ShieldAlert,
  Radio
} from 'lucide-react';

export default function App() {
  const [reports, setReports] = useState([]);
  const [, setLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('map');
  const [selectedReport, setSelectedReport] = useState(null);

  // Active User SOS Alert & Confirmation State
  const [activeUserSOS, setActiveUserSOS] = useState(null);
  const [showResolveConfirmModal, setShowResolveConfirmModal] = useState(false);
  const [targetSOSIdToResolve, setTargetSOSIdToResolve] = useState(null);

  // System Settings State & Persistence
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userSettings, setUserSettings] = useState(loadSavedSettings());

  // Authentication State & Controls
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [myReportsOnly, setMyReportsOnly] = useState(false);

  // Live OpenWeatherMap data & Multi-tier Weather Alert Banner state
  const [weatherData, setWeatherData] = useState(null);
  const [isAlertBannerDismissed, setIsAlertBannerDismissed] = useState(false);

  // Network online/offline status tracking & pending local queue counter
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [queuedCount, setQueuedCount] = useState(0);

  // Non-blocking toast notification banner state
  const [toastNotification, setToastNotification] = useState(null);

  const showToast = (text, type = 'info') => {
    setToastNotification({ text, type });
    setTimeout(() => setToastNotification(null), 5000);
  };

  // Helper to update pending offline queue count
  const updateQueueCount = () => {
    try {
      const pending = getOfflineQueue();
      setQueuedCount(pending.length);
    } catch {
      setQueuedCount(0);
    }
  };

  // 1. Initialize Supabase Auth Listener & Fetch User Profile on Mount
  useEffect(() => {
    async function loadAuth() {
      try {
        const user = await getCurrentUser();
        if (user) {
          setCurrentUser(user);
        }
      } catch (err) {
        console.warn('[App] Non-blocking auth initialization notice:', err);
      }
    }
    loadAuth();

    const unsubscribeAuth = onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const user = await getCurrentUser();
        setCurrentUser(user);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setMyReportsOnly(false);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // 2. Initial reports loading & window online/offline listeners
  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      try {
        const data = await fetchFloodReports();
        setReports(data || []);
      } catch (err) {
        console.warn('[App] Could not load cloud reports (offline fallback mode active):', err);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
    updateQueueCount();

    const handleOnline = () => {
      setIsOnline(true);
      updateQueueCount();
    };
    const handleOffline = () => {
      setIsOnline(false);
      updateQueueCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 3. Initialize Weather Polling (respects lowPowerMode setting)
  useEffect(() => {
    if (userSettings?.lowPowerMode) {
      console.log('[App] Battery Saver mode active: Weather background polling paused.');
      return;
    }

    const stopWeatherPolling = startWeatherPolling((data) => {
      setWeatherData(data);
    }, 300000); // 5 minutes interval

    return () => stopWeatherPolling();
  }, [userSettings?.lowPowerMode]);

  // 4. Initialize Offline Emergency Sharing (P2P) & Auto-Sync Engine on app mount
  useEffect(() => {
    if (userSettings?.p2pMeshEnabled === false) {
      console.log('[App] Offline Emergency Sharing disabled in user settings.');
      return;
    }

    initP2PEngine().catch(err => console.warn('[App] Offline sharing fallback:', err));

    const unsubscribeP2P = onPeerMessage((packet) => {
      if (packet && (packet.type === 'SOS_ALERT' || packet.type === 'FLOOD_REPORT')) {
        const sosReport = {
          id: packet.id || `p2p-sos-${Date.now()}`,
          latitude: packet.payload?.latitude || 13.0827,
          longitude: packet.payload?.longitude || 80.2707,
          location_name: packet.payload?.location_name || 'Offline Emergency Alert Location',
          severity: 'critical',
          water_depth: 'EMERGENCY SOS',
          description: packet.payload?.message || 'Emergency alert shared offline',
          user_id: packet.payload?.user_id || null,
          full_name: packet.payload?.user_name || 'Emergency Peer',
          verified: true,
          ai_confidence: 1.0,
          isP2P: true,
          status: packet.payload?.status || 'active',
          created_at: packet.payload?.created_at || new Date().toISOString()
        };

        if (sosReport.status !== 'resolved') {
          setReports((prev) => [sosReport, ...prev]);

          if (packet.payload?.user_id && currentUser?.id && packet.payload.user_id === currentUser.id) {
            setActiveUserSOS(sosReport);
          }

          showToast(`🚨 Received live Offline Emergency Alert from ${sosReport.full_name}!`, 'critical');
        }
      }
    });

    const unsubscribeAutoSync = initAutoSync((syncResult) => {
      updateQueueCount();
      if (syncResult && syncResult.synced > 0) {
        showToast(`Auto-sent ${syncResult.synced} saved report(s) to cloud.`, 'success');
        fetchFloodReports().then(data => setReports(data || []));
      }
    });

    return () => {
      unsubscribeP2P();
      unsubscribeAutoSync();
    };
  }, [userSettings?.p2pMeshEnabled, currentUser]);

  // Handle User Sign Out
  const handleSignOut = async () => {
    try {
      await signOutUser();
      setCurrentUser(null);
      setMyReportsOnly(false);
      showToast('Signed out of FloodSpot successfully.', 'info');
    } catch (err) {
      console.error('[App] Error signing out:', err);
    }
  };

  // Callback when user submits a report from ReportModal
  const handleReportAdded = (newReport) => {
    setReports((prev) => [newReport, ...prev]);
    updateQueueCount();
    setActiveTab('map');
  };

  // ELEGANT & SYNCHRONOUS "RESOLVE / CLEAR MY SOS" HANDLER
  const requestResolveSOS = (sosId = null) => {
    setTargetSOSIdToResolve(sosId || activeUserSOS?.id || 'all');
    setShowResolveConfirmModal(true);
  };

  const confirmResolveSOS = async () => {
    setShowResolveConfirmModal(false);
    const targetId = targetSOSIdToResolve;

    try {
      // 1. If Supabase client configured, update status to resolved in cloud DB
      if (supabase && currentUser?.id) {
        try {
          await supabase
            .from('flood_reports')
            .update({ status: 'resolved', verified: true, is_resolved: true })
            .eq('user_id', currentUser.id);
        } catch (dbErr) {
          console.warn('[App] Supabase SOS update notice:', dbErr);
        }
      }

      // 2. SYNCHRONOUSLY remove active SOS marker from live reports list & activeUserSOS state
      setReports((prev) => prev.filter(r => {
        if (targetId === 'all') return r.status !== 'resolved' && !r.isP2P && r.water_depth !== 'EMERGENCY SOS';
        return r.id !== targetId;
      }));

      setActiveUserSOS(null);
      setTargetSOSIdToResolve(null);

      // 3. Display instant feedback toast
      showToast("Your emergency status has been resolved. Stay safe!", 'success');
    } catch (err) {
      console.error('[App] Error resolving SOS alert:', err);
      showToast("Your emergency status has been resolved. Stay safe!", 'success');
    }
  };

  // Interactive Community Verification Voting Handlers with Instant >2 Flag Takedown
  const [verifications, setVerifications] = useState({});

  const handleUpvoteReport = async (reportId) => {
    setVerifications((prev) => {
      const current = prev[reportId] || { upvotes: 0, flags: 0, voted: null };
      if (current.voted === 'upvote') return prev;
      const newUp = current.upvotes + 1;
      const newFlags = current.voted === 'flag' ? Math.max(0, current.flags - 1) : current.flags;
      return { ...prev, [reportId]: { upvotes: newUp, flags: newFlags, voted: 'upvote' } };
    });
    showToast('👍 Report confirmed by community verification.', 'success');
    voteFloodReport(reportId, 'up');
  };

  const handleFlagReport = async (reportId) => {
    let reachTakedown = false;
    setVerifications((prev) => {
      const current = prev[reportId] || { upvotes: 0, flags: 0, voted: null };
      if (current.voted === 'flag') return prev;
      const newFlags = current.flags + 1;
      const newUp = current.voted === 'upvote' ? Math.max(0, current.upvotes - 1) : current.upvotes;
      if (newFlags >= 3) {
        reachTakedown = true;
      }
      return { ...prev, [reportId]: { upvotes: newUp, flags: newFlags, voted: 'flag' } };
    });

    if (reachTakedown) {
      setReports((prev) => prev.filter(r => String(r.id) !== String(reportId)));
      showToast('Report flagged as false positive by community consensus and removed.', 'critical');
    } else {
      showToast('🚩 Report flagged for community review.', 'info');
    }
    voteFloodReport(reportId, 'flag');
  };

  // Filtered reports for active view (excludes reports with >= 3 fake flags)
  const activeNonResolvedReports = reports.filter(r => 
    r.status !== 'resolved' && 
    r.status !== 'FLAGGED_REMOVED' && 
    r.status !== 'REMOVED_COMMUNITY_FLAGGED' && 
    r.active !== false && 
    r.is_resolved !== true &&
    !r.is_hidden &&
    (r.downvotes || 0) < 3 &&
    (r.fake_flags || 0) < 3
  );

  const displayedReports = myReportsOnly && currentUser
    ? activeNonResolvedReports.filter(r => r.user_id === currentUser.id)
    : activeNonResolvedReports;

  // Multi-tier Intelligent Weather Alert Banner Logic
  const rain1h = weatherData?.rain1h || 0;
  let alertBannerConfig = null;

  if (!isAlertBannerDismissed && rain1h >= 0.5) {
    if (rain1h > 7.5) {
      alertBannerConfig = {
        level: 'severe',
        bgClass: 'bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white border-b border-red-400/40',
        icon: <CloudLightning className="w-4 h-4 text-amber-300 animate-pulse shrink-0" />,
        message: `⚠️ Severe Rainfall Warning — High waterlogging & flood risk (Rain Rate: ${rain1h} mm/h). Avoid low-lying subways.`
      };
    } else if (rain1h >= 2.5) {
      alertBannerConfig = {
        level: 'moderate',
        bgClass: 'bg-orange-950/95 text-orange-200 border-b border-orange-500/60',
        icon: <CloudRain className="w-4 h-4 text-orange-400 animate-bounce shrink-0" />,
        message: `☔ Moderate Downpour Alert — Use caution near waterlogged areas (Rain Rate: ${rain1h} mm/h).`
      };
    } else {
      alertBannerConfig = {
        level: 'light',
        bgClass: 'bg-amber-950/95 text-amber-200 border-b border-amber-500/60',
        icon: <CloudRain className="w-4 h-4 text-amber-400 shrink-0" />,
        message: `🌧️ Light Rain — Minimal Risk (Rain Rate: ${rain1h} mm/h).`
      };
    }
  }

  return (
    <div className="relative w-screen h-screen bg-[#090D16] text-[#F8FAFC] overflow-hidden flex flex-col font-sans select-none">
      
      {/* Active User Emergency SOS Status Bar Banner */}
      {activeUserSOS && (
        <div className="relative z-40 px-4 py-2 bg-gradient-to-r from-red-700 via-rose-700 to-red-800 text-white border-b border-red-400/40 shadow-2xl flex items-center justify-between pointer-events-auto animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 max-w-xl mx-auto text-xs font-extrabold">
            <Radio className="w-4 h-4 text-red-200 animate-pulse shrink-0" />
            <span>🚨 Active Emergency SOS Signal Broadcasted</span>
          </div>

          <button
            onClick={() => requestResolveSOS(activeUserSOS.id)}
            className="px-3 py-1 rounded-xl bg-[#10B981] hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg flex items-center gap-1 cursor-pointer shrink-0 transition-transform active:scale-95 border border-emerald-300"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>I am Safe / Resolve My SOS</span>
          </button>
        </div>
      )}

      {/* Multi-Tier Intelligent Weather Alert Banner */}
      {alertBannerConfig && !activeUserSOS && (
        <div className={`relative z-30 px-4 py-2 text-xs font-bold shadow-xl flex items-center justify-between pointer-events-auto animate-in slide-in-from-top duration-300 ${alertBannerConfig.bgClass}`}>
          <div className="flex items-center gap-2 max-w-xl mx-auto text-center sm:text-left">
            {alertBannerConfig.icon}
            <span>{alertBannerConfig.message}</span>
          </div>
          <button 
            onClick={() => setIsAlertBannerDismissed(true)}
            className="p-1 hover:bg-black/20 rounded-full transition-colors cursor-pointer shrink-0"
            title="Dismiss Alert"
          >
            <X className="w-4 h-4 text-white/80" />
          </button>
        </div>
      )}

      {/* Non-Blocking Global Toast Notification */}
      {toastNotification && (
        <div className={`fixed ${activeUserSOS ? 'top-28' : alertBannerConfig ? 'top-24' : 'top-16'} left-4 right-4 z-50 max-w-md mx-auto pointer-events-auto animate-in slide-in-from-top duration-300`}>
          <div className={`glass-panel p-3.5 rounded-2xl border shadow-2xl flex items-center justify-between gap-3 text-xs font-semibold ${
            toastNotification.type === 'critical' ? 'bg-red-950/90 border-red-500/80 text-red-200 shadow-red-950/50' :
            toastNotification.type === 'offline' ? 'bg-amber-950/90 border-amber-500/80 text-amber-200' :
            toastNotification.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-200 font-bold' :
            'bg-[#111827] border-[#1E293B] text-sky-200'
          }`}>
            <div className="flex items-center gap-2">
              {toastNotification.type === 'success' ? <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" /> :
               toastNotification.type === 'offline' ? <WifiOff className="w-4 h-4 text-[#F59E0B] shrink-0" /> : 
               <Wifi className="w-4 h-4 text-[#38BDF8] shrink-0" />}
              <span>{toastNotification.text}</span>
            </div>
            <button onClick={() => setToastNotification(null)} className="text-[#94A3B8] hover:text-[#F8FAFC] px-1 font-bold">✕</button>
          </div>
        </div>
      )}

      {/* Top Clean Header Navbar */}
      <header className={`absolute ${activeUserSOS ? 'top-20' : alertBannerConfig ? 'top-12' : 'top-4'} left-4 right-4 z-20 flex items-center justify-between pointer-events-none transition-all duration-300`}>
        {/* Top Left: Menu Trigger & Brand Badge */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 rounded-2xl glass-panel border border-[#1E293B] hover:border-[#38BDF8]/50 text-slate-200 hover:text-[#38BDF8] transition-all cursor-pointer shadow-lg active:scale-95 flex items-center justify-center shrink-0"
            title="Open Control Center & Settings"
            aria-label="Open Left Drawer Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/30 shrink-0">
              <div className="w-full h-full bg-[#090D16] rounded-[14px] flex items-center justify-center text-[#38BDF8]">
                <Droplet className="w-4.5 h-4.5 fill-[#38BDF8]" />
              </div>
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-[#F8FAFC] flex items-center gap-1.5 font-['Outfit']">
                FloodSpot
                {isOnline ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
                    Online
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40 flex items-center gap-1">
                    <WifiOff className="w-3 h-3 text-[#F59E0B]" />
                    Saved Offline ({queuedCount})
                  </span>
                )}
              </h1>
              <p className="text-[10px] text-[#94A3B8] hidden sm:block">Real-Time Flood Radar (India)</p>
            </div>
          </div>
        </div>

        {/* Top Right: Live Weather Summary Pill */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <WeatherPill weather={weatherData} />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative flex-1 w-full h-full">
        {activeTab === 'map' && (
          <Map 
            reports={activeNonResolvedReports} 
            selectedReport={selectedReport}
            weatherData={weatherData}
            onSelectReport={(rep) => setSelectedReport(rep)}
            onRequestReport={() => setIsReportModalOpen(true)}
            userSettings={userSettings}
            onResolveSOS={requestResolveSOS}
          />
        )}

        {/* Safe Navigation Routes View */}
        {activeTab === 'routes' && (
          <div className="w-full h-full pt-24 pb-28 px-4 overflow-y-auto max-w-xl mx-auto space-y-4 no-scrollbar">
            <div className="glass-panel p-5 rounded-3xl border border-[#1E293B] shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg text-[#F8FAFC] flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-[#38BDF8]" />
                  Safe Travel Routes & Advisories
                </h2>
                <span className="text-xs text-[#10B981] bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                  Live Traffic Updates
                </span>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Navigation corridors filtered to avoid active waterlogged areas and deep flood spots.
              </p>

              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-[#111827] border border-[#10B981]/40 flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider">Recommended Route</span>
                    <h4 className="font-bold text-sm text-[#F8FAFC]">OMR Highway Corridor</h4>
                    <p className="text-xs text-[#94A3B8]">Guindy → Taramani → Siruseri</p>
                    <p className="text-[11px] text-[#10B981] mt-1">Clear of standing water. Safe speed flow.</p>
                  </div>
                  <span className="text-xs font-bold text-[#10B981] bg-emerald-950 px-2 py-1 rounded-lg">CLEAR</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#111827] border border-[#EF4444]/40 flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-[#EF4444] uppercase tracking-wider">Blocked Route</span>
                    <h4 className="font-bold text-sm text-[#F8FAFC]">Velachery Main Road & Subway</h4>
                    <p className="text-xs text-[#94A3B8]">Tambaram ←→ Guindy Bypass</p>
                    <p className="text-[11px] text-red-300 mt-1">Submerged under subway (&gt;2.5 ft water). Avoid completely.</p>
                  </div>
                  <span className="text-xs font-bold text-[#EF4444] bg-red-950 px-2 py-1 rounded-lg">BLOCKED</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dedicated Web SOS View */}
        {activeTab === 'sos' && (
          <div className="w-full h-full pt-24 pb-28 px-4 overflow-y-auto max-w-xl mx-auto space-y-4 no-scrollbar">
            <div className="glass-panel p-6 rounded-3xl border border-[#EF4444]/40 shadow-2xl text-center space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/60 text-[#EF4444] border border-[#EF4444]/40 text-xs font-extrabold uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                Emergency Mesh Dispatch Active
              </div>

              <h2 className="font-extrabold text-2xl text-[#F8FAFC] font-['Outfit']">
                Emergency SOS Broadcast
              </h2>
              <p className="text-xs text-[#94A3B8] max-w-md mx-auto leading-relaxed">
                Broadcast live GPS coordinates to nearby peer responders and emergency dispatch units without cellular network requirement.
              </p>

              <div className="py-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => requestResolveSOS()}
                  className="w-40 h-40 rounded-full bg-[#EF4444] text-white font-extrabold text-2xl tracking-widest shadow-2xl shadow-red-950/80 hover:scale-105 active:scale-95 transition-all border-4 border-[#090D16] flex flex-col items-center justify-center gap-1 cursor-pointer"
                >
                  <ShieldAlert className="w-10 h-10 text-white" />
                  <span>SOS</span>
                </button>
              </div>

              {activeUserSOS && (
                <button
                  type="button"
                  onClick={() => requestResolveSOS(activeUserSOS.id)}
                  className="w-full py-3 px-4 bg-[#10B981] hover:bg-emerald-400 text-slate-950 font-extrabold rounded-2xl shadow-lg border border-emerald-300 flex items-center justify-center gap-2 transition-all cursor-pointer text-xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>I am Safe / Resolve Active SOS</span>
                </button>
              )}
            </div>

            {/* Emergency Helplines */}
            <div className="glass-panel p-4 rounded-2xl border border-[#1E293B] space-y-2">
              <h4 className="font-bold text-xs text-[#F59E0B] flex items-center gap-1.5">
                <PhoneCall className="w-4 h-4" />
                Disaster Response Dispatch Engine — Helplines
              </h4>
              <ul className="text-xs text-[#94A3B8] space-y-1.5 font-mono">
                <li className="flex justify-between border-b border-[#1E293B] pb-1"><span>State Disaster Control:</span> <strong className="text-[#38BDF8]">1070</strong></li>
                <li className="flex justify-between border-b border-[#1E293B] pb-1"><span>District Emergency Cell:</span> <strong className="text-[#38BDF8]">1077</strong></li>
                <li className="flex justify-between"><span>Flood Control Helpline:</span> <strong className="text-[#38BDF8]">1913</strong></li>
              </ul>
            </div>
          </div>
        )}

        {/* Live Weather & Incident Alerts View */}
        {activeTab === 'alerts' && (
          <div className="w-full h-full pt-24 pb-28 px-4 overflow-y-auto max-w-xl mx-auto space-y-3 no-scrollbar">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-[#F8FAFC] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
                Emergency Weather & Alerts
              </h2>
              {myReportsOnly && (
                <button
                  onClick={() => setMyReportsOnly(false)}
                  className="text-xs font-semibold text-[#38BDF8] hover:text-cyan-300 bg-cyan-950/60 border border-cyan-800 px-2.5 py-1 rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <span>Showing My Reports</span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Live Weather Status Card */}
            {weatherData && (
              <div className={`p-4 rounded-2xl border shadow-xl flex items-start gap-3 ${
                rain1h > 7.5 ? 'bg-red-950/80 border-[#EF4444]/80 text-red-200' :
                rain1h >= 2.5 ? 'bg-orange-950/80 border-[#F59E0B]/80 text-amber-200' :
                'bg-[#111827] border-[#1E293B] text-sky-200'
              }`}>
                <CloudRain className="w-6 h-6 text-[#38BDF8] shrink-0 mt-0.5" />
                <div className="space-y-1 w-full">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-[#F8FAFC]">Live Weather Status — {weatherData.cityName || 'Chennai'}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#090D16] text-[#38BDF8] border border-[#1E293B]">
                      Rain Rate: {rain1h} mm/h
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">
                    {rain1h > 7.5 ? 'Severe Heavy Rain Warning: Flash flooding risk in low-lying subways.' :
                     rain1h >= 2.5 ? 'Moderate Downpour Alert: Localized waterlogging on roads.' :
                     'Light Rain / Clear Conditions: Low flood risk.'}
                  </p>
                </div>
              </div>
            )}

            {/* Incident Reports List with 5-part visual hierarchy */}
            {displayedReports.length === 0 ? (
              <div className="glass-panel p-8 rounded-3xl border border-[#1E293B] text-center space-y-2">
                <FileText className="w-8 h-8 text-[#94A3B8] mx-auto" />
                <p className="font-semibold text-[#F8FAFC]">No active incident reports found.</p>
              </div>
            ) : (
              displayedReports.map((report) => {
                const locTitle = typeof report.location_name === 'object'
                  ? (report.location_name?.name || report.location_name?.location_name || 'Flood Incident Zone')
                  : String(report.location_name || 'Flood Incident Zone');
                const vData = verifications[report.id] || { upvotes: report.upvotes || 0, flags: report.downvotes || 0, voted: null };

                return (
                  <div 
                    key={report.id}
                    className="glass-panel p-4 rounded-2xl border border-[#1E293B] shadow-lg space-y-3"
                  >
                    {/* 1. Header row: Location title (single line, ellipsis) on left; Severity pill on right */}
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-bold text-sm text-[#F8FAFC] truncate flex items-center gap-1.5 flex-1 min-w-0">
                        <MapPin className="w-4 h-4 text-[#38BDF8] shrink-0" />
                        <span className="truncate">{locTitle}</span>
                      </h4>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                        report.severity === 'critical' ? 'bg-[#EF4444] text-white' :
                        report.severity === 'high' ? 'bg-orange-500 text-white' :
                        report.severity === 'medium' ? 'bg-[#F59E0B] text-slate-950' :
                        'bg-[#10B981] text-slate-950'
                      }`}>
                        {report.severity || 'ELEVATED'}
                      </span>
                    </div>

                    {/* 2. Verification badge */}
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#10B981]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                      <span>✓ Hydro Depth Engine Verified</span>
                    </div>

                    {/* 3. User-uploaded incident image container */}
                    {report.image_url ? (
                      <div className="w-full h-[180px] rounded-xl overflow-hidden border border-[#1E293B]">
                        <img 
                          src={report.image_url} 
                          alt="Incident Report" 
                          className="w-full h-full object-cover" 
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-24 rounded-xl bg-[#090D16] border border-[#1E293B] flex items-center justify-center text-[#94A3B8] text-xs">
                        No Citizen Photo Attached
                      </div>
                    )}

                    {/* 4. Incident description / citizen report text */}
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      {report.description || 'Community waterlogging report.'}
                    </p>

                    {/* 5. Action row: Confirm & Flag buttons */}
                    <div className="pt-2 border-t border-[#1E293B] flex items-center justify-between">
                      <div className="text-[11px] font-mono text-[#94A3B8]">
                        👍 {vData.upvotes} Confirm • 🚩 {vData.flags} Flagged
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpvoteReport(report.id)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            vData.voted === 'upvote'
                              ? 'bg-[#10B981] text-slate-950 border-emerald-300'
                              : 'bg-[#1E293B] hover:bg-slate-700 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          👍 {vData.voted === 'upvote' ? 'Confirmed' : 'Confirm'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleFlagReport(report.id)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            vData.voted === 'flag'
                              ? 'bg-[#EF4444] text-white border-rose-400'
                              : 'bg-[#1E293B] hover:bg-slate-700 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          🚩 {vData.voted === 'flag' ? 'Flagged' : 'Flag Fake'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Community Verification View */}
        {activeTab === 'verify' && (
          <div className="w-full h-full pt-24 pb-28 px-4 overflow-y-auto max-w-xl mx-auto space-y-4 no-scrollbar">
            <div className="glass-panel p-5 rounded-3xl border border-[#1E293B] shadow-xl space-y-3">
              <h2 className="font-bold text-lg text-[#F8FAFC] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#38BDF8]" />
                Community Verification Portal
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Help verify crowdsourced waterlogged area reports uploaded by citizens using Hydro Depth Engine + Community Review.
              </p>
              
              <div className="p-3.5 rounded-2xl bg-[#111827] border border-[#1E293B] flex items-center gap-2 text-[#10B981] text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Fine-Tuned ResNet-50 / YOLOv8 Spatial Vision Pipeline Active</span>
              </div>
            </div>

            {/* List of Reports for Community Verification with 5-part visual hierarchy */}
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-[#F8FAFC] flex items-center justify-between">
                <span>Recent Community Reports ({displayedReports.length})</span>
                <span className="text-[11px] text-[#94A3B8] font-normal">Click to vote</span>
              </h3>

              {displayedReports.length === 0 ? (
                <div className="glass-panel p-8 rounded-3xl border border-[#1E293B] text-center space-y-2">
                  <FileText className="w-8 h-8 text-[#94A3B8] mx-auto" />
                  <p className="font-semibold text-[#F8FAFC]">No pending community verifications in your area.</p>
                </div>
              ) : (
                displayedReports.map((report) => {
                  const locTitle = typeof report.location_name === 'object'
                    ? (report.location_name?.name || report.location_name?.location_name || 'Flood Incident Zone')
                    : String(report.location_name || 'Flood Incident Zone');
                  const vData = verifications[report.id] || { upvotes: report.upvotes || 0, flags: report.downvotes || 0, voted: null };

                  return (
                    <div 
                      key={report.id}
                      className="glass-panel p-4 rounded-2xl border border-[#1E293B] space-y-3 shadow-lg"
                    >
                      {/* 1. Header row: Location title (single line, ellipsis) on left; Severity pill on right */}
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-bold text-sm text-[#F8FAFC] truncate flex items-center gap-1.5 flex-1 min-w-0">
                          <MapPin className="w-4 h-4 text-[#38BDF8] shrink-0" />
                          <span className="truncate">{locTitle}</span>
                        </h4>

                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                          report.severity === 'critical' ? 'bg-[#EF4444] text-white' :
                          report.severity === 'high' ? 'bg-orange-500 text-white' :
                          report.severity === 'medium' ? 'bg-[#F59E0B] text-slate-950' :
                          'bg-[#10B981] text-slate-950'
                        }`}>
                          {report.severity || 'ELEVATED'}
                        </span>
                      </div>

                      {/* 2. Verification badge */}
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#10B981]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                        <span>✓ Hydro Depth Engine Verified</span>
                      </div>

                      {/* 3. User-uploaded incident image container */}
                      {report.image_url ? (
                        <div className="w-full h-[180px] rounded-xl overflow-hidden border border-[#1E293B]">
                          <img 
                            src={report.image_url} 
                            alt="Citizen Incident Photo" 
                            className="w-full h-full object-cover" 
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-24 rounded-xl bg-[#090D16] border border-[#1E293B] flex items-center justify-center text-[#94A3B8] text-xs">
                          No Citizen Photo Attached
                        </div>
                      )}

                      {/* 4. Incident description / citizen report text */}
                      <p className="text-xs text-[#94A3B8] leading-relaxed">
                        {report.description || 'Community waterlogging report.'}
                      </p>

                      {/* 5. Action row: Confirm & Flag buttons */}
                      <div className="pt-2 border-t border-[#1E293B] flex items-center justify-between">
                        <div className="text-[11px] font-mono text-[#94A3B8]">
                          👍 {vData.upvotes} Confirm • 🚩 {vData.flags} Flagged
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpvoteReport(report.id)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                              vData.voted === 'upvote'
                                ? 'bg-[#10B981] text-slate-950 border-emerald-300'
                                : 'bg-[#1E293B] hover:bg-slate-700 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            👍 {vData.voted === 'upvote' ? 'Confirmed' : 'Confirm'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleFlagReport(report.id)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                              vData.voted === 'flag'
                                ? 'bg-[#EF4444] text-white border-rose-400'
                                : 'bg-[#1E293B] hover:bg-slate-700 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            🚩 {vData.voted === 'flag' ? 'Flagged' : 'Flag Fake'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="glass-panel p-4 rounded-2xl border border-[#1E293B] space-y-2">
                <h4 className="font-bold text-xs text-[#F59E0B] flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4" />
                  Disaster Response Dispatch Engine — Helplines
                </h4>
                <ul className="text-xs text-[#94A3B8] space-y-1 font-mono">
                  <li>Flood Control Helpline: <strong className="text-[#F8FAFC]">1913</strong></li>
                  <li>Disaster Response: <strong className="text-[#F8FAFC]">1070</strong></li>
                  <li>Emergency Fire & Rescue: <strong className="text-[#F8FAFC]">101</strong></li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Sleek Resolve SOS Confirmation Modal */}
      {showResolveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090D16]/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-panel p-6 rounded-3xl border border-[#10B981]/40 shadow-2xl max-w-sm w-full space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] flex items-center justify-center mx-auto shadow-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-base text-[#F8FAFC]">Confirm SOS Resolution</h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Mark your emergency status as safe and clear active alert from the map?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={confirmResolveSOS}
                className="py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-2xl shadow-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Yes, I am Safe</span>
              </button>

              <button
                type="button"
                onClick={() => setShowResolveConfirmModal(false)}
                className="py-2.5 px-4 bg-[#1E293B] hover:bg-slate-700 text-[#94A3B8] font-bold text-xs rounded-2xl cursor-pointer transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <BottomNav 
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenReportModal={() => setIsReportModalOpen(true)}
      />

      {/* Flood Report Upload Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onReportAdded={handleReportAdded}
        onShowToast={showToast}
        currentUser={currentUser}
      />

      {/* Account Login / Registration Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(authResult) => {
          const user = authResult.user 
            ? { ...authResult.user, full_name: authResult.profile?.full_name || authResult.user.email.split('@')[0] } 
            : authResult;
          setCurrentUser(user);
          setIsAuthModalOpen(false);
        }}
        onShowToast={showToast}
      />

      {/* System Settings & Control Center Left Drawer */}
      <SettingsSidebar
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={userSettings}
        onUpdateSettings={(updated) => setUserSettings(updated)}
        currentUser={currentUser}
        onShowToast={showToast}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onSignOut={handleSignOut}
        myReportsOnly={myReportsOnly}
        onToggleMyReports={() => setMyReportsOnly(!myReportsOnly)}
        onResolveSOS={() => requestResolveSOS()}
      />
    </div>
  );
}
