import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Radio, 
  BatteryCharging, 
  RefreshCw, 
  ShieldAlert, 
  ShieldCheck,
  Sliders, 
  Ruler, 
  Trash2, 
  User, 
  Loader2, 
  AlertTriangle,
  LogIn,
  LogOut,
  FileText
} from 'lucide-react';
import { getOfflineQueue, syncOfflineQueue } from '../lib/offlineEngine';
import SOSButton from './SOSButton';

export const SETTINGS_STORAGE_KEY = 'floodspot_user_settings';

export const DEFAULT_USER_SETTINGS = {
  p2pMeshEnabled: true,
  lowPowerMode: false,
  mapStyle: 'dark', // 'dark' | 'satellite' | 'standard'
  showHistoricalZones: true,
  alertRadiusKm: 5,
  unitSystem: 'metric' // 'metric' | 'imperial'
};

/**
 * Loads persistent settings from LocalStorage with fallback defaults.
 */
export function loadSavedSettings() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_USER_SETTINGS;
  }
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_USER_SETTINGS;
    return { ...DEFAULT_USER_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    console.error('[Settings] Error loading saved user settings:', err);
    return DEFAULT_USER_SETTINGS;
  }
}

/**
 * Persists user settings to LocalStorage.
 */
export function saveUserSettings(settings) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('[Settings] Error saving user settings:', err);
  }
}

export default function SettingsSidebar({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  currentUser,
  onShowToast,
  onOpenAuthModal,
  onSignOut,
  myReportsOnly,
  onToggleMyReports,
  onResolveSOS
}) {
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Update pending queue count when sidebar opens or sync occurs
  useEffect(() => {
    if (isOpen) {
      updatePendingCount();
    }
  }, [isOpen]);

  const updatePendingCount = () => {
    try {
      const queue = getOfflineQueue();
      setPendingQueueCount(queue.length);
    } catch {
      setPendingQueueCount(0);
    }
  };

  if (!isOpen) return null;

  // Toggle helper
  const handleToggle = (key) => {
    const updated = {
      ...settings,
      [key]: !settings[key]
    };
    onUpdateSettings(updated);
    saveUserSettings(updated);
  };

  // Change single value helper
  const handleChange = (key, value) => {
    const updated = {
      ...settings,
      [key]: value
    };
    onUpdateSettings(updated);
    saveUserSettings(updated);
  };

  // Manual Force Sync trigger
  const handleForceSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncOfflineQueue();
      updatePendingCount();
      if (onShowToast) {
        if (result.synced > 0) {
          onShowToast(`Successfully synced ${result.synced} offline item(s) to Supabase cloud.`, 'success');
        } else if (result.offline) {
          onShowToast('Device is offline. Auto-sync will retry when connected.', 'offline');
        } else {
          onShowToast('No pending offline reports to sync.', 'info');
        }
      }
    } catch (err) {
      console.error('[Settings] Force sync error:', err);
      if (onShowToast) onShowToast('Sync failed. Please check network connection.', 'critical');
    } finally {
      setIsSyncing(false);
    }
  };

  // Clear Cache handler
  const handleClearCache = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('floodspot_last_location');
        localStorage.removeItem('floodspot_weather_cache');
      }
      setShowClearConfirm(false);
      if (onShowToast) {
        onShowToast('Local map & weather cache cleared successfully.', 'success');
      }
    } catch (err) {
      console.error('[Settings] Clear cache error:', err);
    }
  };

  // User initials helper
  const getUserInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Dark Backdrop Overlay */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-40 transition-opacity duration-300 animate-in fade-in"
      />

      {/* Left Slide-Over Panel Drawer */}
      <aside className="fixed inset-y-0 left-0 z-50 w-full max-w-sm sm:max-w-md glass-panel border-r border-slate-700/80 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-left duration-300 select-none">
        
        {/* Drawer Header Bar */}
        <div className="glass-panel border-b border-slate-800 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-100 font-['Outfit']">
                Control Center
              </h3>
              <p className="text-[11px] text-slate-400">Account, Emergency SOS & App Settings</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Streamlined Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs no-scrollbar">

          {/* SECTION 1: ACCOUNT & AUTH */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Account & Authentication
            </h4>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-md">
              {currentUser ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center font-bold text-sm text-white shadow-md border border-cyan-400/30 shrink-0">
                        {getUserInitials(currentUser.full_name)}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold text-slate-100 truncate">{currentUser.full_name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold mt-0.5">
                          <ShieldCheck className="w-3 h-3" /> Supabase Session Active
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onSignOut}
                      className="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/80 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
                      title="Sign Out"
                    >
                      <LogOut className="w-3.5 h-3.5 text-red-400" />
                      <span>Sign Out</span>
                    </button>
                  </div>

                  {onToggleMyReports && (
                    <button
                      type="button"
                      onClick={onToggleMyReports}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between cursor-pointer transition-colors border ${
                        myReportsOnly 
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold border-cyan-500/40' 
                          : 'bg-slate-800/50 text-slate-300 border-slate-700/60 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{myReportsOnly ? 'Showing My Reports Only' : 'Filter My Reports'}</span>
                      </div>
                      {myReportsOnly && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-200">Guest Session Active</p>
                    <p className="text-[11px] text-slate-400">Sign in to sync flood incident reports</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { onClose(); if (onOpenAuthModal) onOpenAuthModal(); }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-950/50 flex items-center gap-1.5 cursor-pointer shrink-0 border border-cyan-400/30"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign In / Register</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-slate-800/80" />

          {/* SECTION 2: EMERGENCY SOS & RESOLVE ACTION */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-extrabold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Emergency SOS Broadcast
            </h4>

            <div className="p-4 rounded-2xl bg-red-950/30 border border-red-900/50 space-y-3">
              <p className="text-[11px] text-red-200/90 leading-relaxed">
                Broadcast an emergency SOS signal with live GPS coordinates to nearby mesh peers & emergency responders.
              </p>
              
              <div className="flex flex-col items-center justify-center gap-2.5 pt-1">
                <SOSButton currentUser={currentUser} />

                {onResolveSOS && (
                  <button
                    type="button"
                    onClick={() => { onClose(); onResolveSOS(); }}
                    className="w-full py-2 px-3 bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md border border-emerald-400/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>I am Safe / Resolve Active SOS</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-800/80" />

          {/* SECTION 3: APP & EMERGENCY SETTINGS */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              App & Emergency Settings
            </h4>

            <div className="space-y-2.5">
              {/* Offline Emergency Sharing Toggle */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Offline Emergency Sharing</span>
                    {settings.p2pMeshEnabled && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">Share emergency alerts without internet connection</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggle('p2pMeshEnabled')}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    settings.p2pMeshEnabled ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white transition-transform transform ${
                    settings.p2pMeshEnabled ? 'translate-x-6' : 'translate-x-1'
                  } top-1 absolute`} />
                </button>
              </div>

              {/* Battery Saver Mode Toggle */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
                    <span>Battery Saver Mode</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Pause background weather updates</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggle('lowPowerMode')}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    settings.lowPowerMode ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white transition-transform transform ${
                    settings.lowPowerMode ? 'translate-x-6' : 'translate-x-1'
                  } top-1 absolute`} />
                </button>
              </div>

              {/* Alert Distance Slider */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Alert Distance</span>
                  <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded-lg border border-cyan-800">
                    {settings.alertRadiusKm} {settings.unitSystem === 'metric' ? 'km' : 'mi'}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={settings.alertRadiusKm}
                  onChange={(e) => handleChange('alertRadiusKm', parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Unit System */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Distance Units</span>
                </div>

                <div className="flex bg-slate-800 p-0.5 rounded-xl border border-slate-700">
                  <button
                    type="button"
                    onClick={() => handleChange('unitSystem', 'metric')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      settings.unitSystem === 'metric'
                        ? 'bg-cyan-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Kilometers
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('unitSystem', 'imperial')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      settings.unitSystem === 'imperial'
                        ? 'bg-cyan-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Miles
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-800/80" />

          {/* SECTION 4: SAVED STORAGE */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              Saved Storage
            </h4>

            <div className="space-y-2.5">
              {/* Send Saved Reports Now */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Saved Reports Queue</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Pending: <strong className="text-cyan-300 font-mono">{pendingQueueCount} item(s)</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleForceSync}
                  disabled={isSyncing}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Send Saved Reports Now</span>
                    </>
                  )}
                </button>
              </div>

              {/* Clear Cache */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-200">Local Map Cache</div>
                  <p className="text-[11px] text-slate-400">Clears offline tiles & weather cache</p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>

              {/* Clear Cache Confirmation Dialog */}
              {showClearConfirm && (
                <div className="p-3.5 rounded-2xl bg-rose-950/90 border border-rose-600/80 text-rose-100 space-y-2 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Confirm Clear Cache?</span>
                  </div>
                  <p className="text-[11px] text-rose-200">
                    This will clear stored GPS & weather cache. Your offline report queue remains safe.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleClearCache}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-md"
                    >
                      Clear Cache
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 text-center text-[10px] text-slate-500 font-mono">
            FloodSpot Mobile Engine • v2.0.0 • Bounded GIS & SOS System
          </div>
        </div>
      </aside>
    </>
  );
}
