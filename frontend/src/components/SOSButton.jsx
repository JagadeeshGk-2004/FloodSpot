import React, { useState } from 'react';
import { ShieldAlert, Radio, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { getCurrentLocation } from '../lib/offlineEngine';
import { broadcastSOS } from '../lib/p2pEngine';

export default function SOSButton({ currentUser }) {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const triggerSOS = async () => {
    if (isBroadcasting) return;

    setIsBroadcasting(true);
    setToastMessage(null);

    try {
      // 1. Fetch high-accuracy hardware coordinates
      let location = null;
      try {
        location = await getCurrentLocation();
      } catch (locErr) {
        console.warn('[SOSButton] Location lock failed, broadcasting fallback:', locErr);
      }

      // 2. Broadcast emergency SOS alert to P2P Mesh & Save to LocalStorage queue
      const result = await broadcastSOS({
        user_id: currentUser?.id || null,
        user_name: currentUser?.full_name || 'Anonymous Peer',
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        accuracy: location?.accuracy || null,
        location_name: location ? `GPS (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})` : 'Live SOS Beacon',
        severity: 'critical',
        message: 'EMERGENCY SOS SIGNAL BROADCASTED VIA FLOODSPOT MESH'
      });

      // 3. Show immediate visual feedback toast
      const feedbackText = result.queuedOffline
        ? '🚨 Emergency SOS queued to LocalStorage! Auto-broadcasting to mesh.'
        : `🚨 Emergency SOS Broadcasted to ${result.sentCount} connected peer(s)!`;

      setToastMessage({
        type: 'success',
        text: feedbackText
      });
    } catch (err) {
      console.error('[SOSButton] Emergency SOS trigger failed:', err);
      setToastMessage({
        type: 'error',
        text: 'Failed to broadcast SOS. Retrying local storage queue...'
      });
    } finally {
      setIsBroadcasting(false);

      // Auto-dismiss toast notification after 5 seconds
      setTimeout(() => {
        setToastMessage(null);
      }, 5000);
    }
  };

  return (
    <>
      {/* Floating SOS Toast Notification Feedback Banner */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 max-w-md mx-auto pointer-events-auto animate-in slide-in-from-top duration-300">
          <div className={`glass-panel p-3.5 rounded-2xl border shadow-2xl flex items-center justify-between gap-3 text-xs font-semibold ${
            toastMessage.type === 'success' 
              ? 'bg-red-950/90 border-red-500/80 text-red-200 shadow-red-950/50' 
              : 'bg-amber-950/90 border-amber-500/80 text-amber-200'
          }`}>
            <div className="flex items-center gap-2.5">
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 animate-bounce" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
            <button 
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-slate-200 px-1 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Accessible High-Visibility SOS Floating Action Button */}
      <button
        onClick={triggerSOS}
        disabled={isBroadcasting}
        title="Broadcast Emergency SOS Signal"
        className="relative group p-0.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 shadow-xl shadow-red-600/40 hover:shadow-red-500/60 active:scale-95 transition-all duration-200 cursor-pointer pointer-events-auto disabled:opacity-70"
      >
        <div className="px-3.5 py-2 rounded-[14px] bg-slate-950/90 group-hover:bg-slate-950/70 backdrop-blur-md flex items-center gap-2 text-white border border-red-500/50">
          <div className="relative flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
            <ShieldAlert className="w-4 h-4 text-red-400 relative z-10 shrink-0" />
          </div>

          <span className="font-extrabold text-xs tracking-wider text-red-100 flex items-center gap-1 font-['Outfit']">
            {isBroadcasting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-300" />
                BROADCASTING...
              </>
            ) : (
              <>
                SOS
                <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              </>
            )}
          </span>
        </div>
      </button>
    </>
  );
}
