import { useState, useRef, useCallback, useEffect } from 'react';
import { MapPin, Camera, Zap, Copy, Check, Loader, Phone, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { supabase } from '../db.js';
import { addToOutbox } from '../idb.js';
import { validateFloodImage } from '../services/imageValidator.js';
import ImageVerificationBadge from './ImageVerificationBadge.jsx';

function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords?.latitude && coords?.longitude) map.setView([coords.latitude, coords.longitude], 17);
  }, [coords, map]);
  return null;
}

function MapControls({ coords }) {
  const map = useMap();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (coords) map.flyTo([coords.latitude, coords.longitude], 17); }}
      className="absolute bottom-4 right-4 z-[1000] p-3 sm:p-4 bg-[#A891DE] text-white rounded-full shadow-[0_10px_20px_rgba(168,145,222,0.4)] hover:scale-110 active:scale-95 smooth-transition"
    >
      <Navigation size={20} className="animate-pulse" />
    </button>
  );
}

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

/**
 * ReportView — Flood report submission with map, severity, image upload + AI verification.
 */
export default function ReportView({ coords, isLocationActive, address, requestLocation, user, loading: parentLoading, showToast, onReportSuccess }) {
  const [severity, setSeverity] = useState('medium');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verification, setVerification] = useState(null); // { status, confidence, message }
  const fileInputRef = useRef(null);

  // Run image verification when file changes
  const handleFileChange = useCallback(async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setVerification({ status: 'verifying', confidence: 0, message: 'Analyzing image...' });

    try {
      const result = await validateFloodImage(selectedFile);
      setVerification({
        status: result.status,
        confidence: result.confidence,
        message: result.message,
      });

      if (result.status === 'rejected') {
        showToast(result.message);
      }
    } catch {
      setVerification({ status: 'verified', confidence: 50, message: 'Verification skipped.' });
    }
  }, [showToast]);

  const handleReport = async () => {
    if (!coords) return;
    setLoading(true);
    try {
      if (!navigator.onLine) {
        const base64 = file ? await fileToBase64(file) : null;
        await addToOutbox({
          latitude: coords.latitude, longitude: coords.longitude,
          severity, photo_base64: base64, place_name: address, user_id: user?.id,
          created_at: new Date().toISOString(),
        });
        showToast('Report Saved Locally. Auto-sending when signal returns...');
        setFile(null);
        setVerification(null);
        onReportSuccess?.();
        setLoading(false);
        return;
      }

      let publicUrl = null;
      if (file) {
        const fileName = `${Date.now()}-${user?.id}.jpg`;
        await supabase.storage.from('flood-pics').upload(fileName, file);
        publicUrl = supabase.storage.from('flood-pics').getPublicUrl(fileName).data.publicUrl;
      }
      await supabase.from('reports').insert([{
        latitude: coords.latitude, longitude: coords.longitude,
        severity, photo_url: publicUrl, place_name: address, user_id: user.id
      }]);
      setFile(null);
      setVerification(null);
      onReportSuccess?.();
    } catch (err) {
      console.error(err);
      showToast("Failed to report: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = loading || parentLoading || !coords || (verification?.status === 'rejected');

  return (
    <div className="space-y-6 sm:space-y-10 animate-in fade-in duration-700">
      {/* Emergency Hotlines */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[{ n: "National", p: "108" }, { n: "Disaster", p: "1070" }, { n: "Fire", p: "101" }, { n: "Police", p: "100" }].map(h => (
          <a key={h.n} href={`tel:${h.p}`} className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-red-500/20 flex items-center gap-3 active:scale-95 smooth-transition">
            <Phone size={14} className="text-red-500 shrink-0" />
            <div>
              <p className="text-[8px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2]">{h.n}</p>
              <p className="font-black text-xs text-[#1a1410] dark:text-[#FFFFFF]">{h.p}</p>
            </div>
          </a>
        ))}
      </div>

      {/* Location Card */}
      <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[3rem] flex items-center justify-between border border-[#D4CBAF] dark:border-[#A891DE]/30 smooth-transition">
        <div className="flex items-center gap-4 sm:gap-6 overflow-hidden flex-1 min-w-0">
          <div className="bg-[#A891DE] p-3 sm:p-5 rounded-xl sm:rounded-2xl text-white shadow-lg shrink-0">
            <MapPin size={22} />
          </div>
          <div className="overflow-hidden min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#1a1410] dark:text-[#D3C9F2]">{isLocationActive ? 'ONLINE' : 'OFFLINE'}</p>
            <p className="font-black text-base sm:text-xl truncate tracking-tight text-[#1a1410] dark:text-[#FFFFFF]">{address}</p>
          </div>
        </div>
        <button
          id="gps-toggle"
          onClick={requestLocation}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 flex items-center justify-center smooth-transition shadow-lg shrink-0 ${
            isLocationActive ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'
          }`}
        >
          <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full ${
            isLocationActive
              ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)] animate-pulse'
              : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse'
          }`} />
        </button>
      </div>

      {/* GPS Coordinates */}
      {coords && (
        <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border border-[#D4CBAF] dark:border-[#A891DE]/30 flex justify-between items-center shadow-lg">
          <div className="space-y-1 min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2] tracking-widest">Decimal GPS</p>
            <p className="font-mono font-bold text-xs sm:text-sm text-[#1a1410] dark:text-[#FFFFFF]">{coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="p-3 sm:p-4 bg-[#A891DE]/10 border border-[#A891DE]/30 text-[#A891DE] rounded-xl sm:rounded-2xl hover:bg-[#A891DE] hover:text-white smooth-transition active:scale-95 shrink-0"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
      )}

      {/* Map */}
      <div className="h-[20rem] sm:h-[26rem] rounded-[1.5rem] sm:rounded-[3.5rem] overflow-hidden border border-[#D4CBAF] dark:border-[#A891DE]/30 relative shadow-2xl">
        <MapContainer center={[13.08, 80.27]} zoom={15} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          {coords && <Marker position={[coords.latitude, coords.longitude]} />}
          <RecenterMap coords={coords} />
          <MapControls coords={coords} />
        </MapContainer>
      </div>

      {/* Severity + Photo Upload */}
      <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-5 sm:p-10 rounded-[1.5rem] sm:rounded-[3.5rem] space-y-5 sm:space-y-8 border border-[#D4CBAF] dark:border-[#A891DE]/30">
        {/* Severity Picker */}
        <div className="flex bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-1.5 sm:p-2 rounded-[1.5rem] sm:rounded-[2.5rem] gap-1.5 sm:gap-2 border border-[#D4CBAF] dark:border-[#A891DE]/20">
          {['low', 'medium', 'high'].map((s) => (
            <button
              key={s}
              id={`severity-${s}`}
              onClick={() => setSeverity(s)}
              className={`flex-1 py-3 sm:py-4 rounded-[1.2rem] sm:rounded-[2rem] text-[9px] sm:text-[10px] font-black uppercase smooth-transition ${
                severity === s
                  ? 'bg-[#A891DE] text-white shadow-xl scale-105'
                  : 'text-[#1a1410] dark:text-[#D3C9F2]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Photo Upload */}
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
        <button
          id="attach-image"
          onClick={() => fileInputRef.current.click()}
          className="w-full py-6 sm:py-8 rounded-[1.5rem] sm:rounded-[2.5rem] border-2 border-dashed border-[#D4CBAF] dark:border-[#A891DE]/40 bg-[#A891DE]/5 flex items-center justify-center gap-3 sm:gap-4 text-[#1a1410] dark:text-[#FFFFFF] hover:bg-[#A891DE]/10 smooth-transition"
        >
          <Camera size={22} className="text-[#A891DE]" />
          <span className="font-black uppercase text-[10px] sm:text-[11px] tracking-[0.15em] sm:tracking-[0.2em]">{file ? "Intel Logged" : "Attach Intel"}</span>
        </button>

        {/* Image Verification Badge */}
        {verification && (
          <ImageVerificationBadge
            status={verification.status}
            confidence={verification.confidence}
            message={verification.message}
            onDismiss={() => { setVerification(null); setFile(null); }}
          />
        )}
      </div>

      {/* Submit Button */}
      <button
        id="broadcast-report"
        onClick={handleReport}
        disabled={isSubmitDisabled}
        className="w-full py-6 sm:py-9 rounded-[2.5rem] sm:rounded-[4rem] font-black text-xl sm:text-2xl bg-[#A891DE] text-white shadow-[0_20px_50px_rgba(168,145,222,0.3)] disabled:opacity-50 hover:scale-[1.02] active:scale-95 smooth-transition flex items-center justify-center gap-4 sm:gap-5"
      >
        {loading ? <Loader className="animate-spin" /> : <><Zap size={26} fill="white" /> BROADCAST</>}
      </button>
    </div>
  );
}
