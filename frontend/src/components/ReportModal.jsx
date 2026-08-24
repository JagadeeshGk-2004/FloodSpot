import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  MapPin, 
  Sparkles, 
  AlertTriangle, 
  Loader2, 
  Camera, 
  Droplet, 
  FileText,
  ShieldCheck,
  WifiOff
} from 'lucide-react';
import { verifyFloodImage } from '../lib/cvEngine';
import { createFloodReport } from '../lib/supabase';
import { queueFloodReport, getCurrentLocation } from '../lib/offlineEngine';

export default function ReportModal({ isOpen, onClose, onReportAdded, onShowToast, currentUser }) {
  const [imagePreview, setImagePreview] = useState(null);
  const [, setBase64Image] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cvResult, setCvResult] = useState(null);

  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState(13.0827);
  const [longitude, setLongitude] = useState(80.2707);
  const [severity, setSeverity] = useState('medium');
  const [waterDepth, setWaterDepth] = useState('1.5 ft');
  const [description, setDescription] = useState('');

  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Handle Photo Select and triggering Visual Feature Verification quietly
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Str = reader.result;
      setImagePreview(base64Str);
      setBase64Image(base64Str);

      // Execute quiet visual feature analysis
      setIsAnalyzing(true);
      try {
        const result = await verifyFloodImage(base64Str);
        setCvResult(result);

        if (!result.is_flood) {
          const rejectReason = result.reason || 'Image features do not match urban waterlogging or flood parameters.';
          setErrorMsg(rejectReason);
          if (onShowToast) {
            onShowToast(`❌ Visual Verification Failed: ${rejectReason}`, 'error');
          }
        } else {
          setErrorMsg('');
          if (result.confidence > 80) {
            setSeverity('high');
          }
          if (onShowToast) {
            onShowToast(`✅ Visual Verification Passed (${result.confidence}% Feature Match)`, 'success');
          }
        }
      } catch (err) {
        const msg = err?.detail || err?.message || 'Image features do not match urban waterlogging or flood parameters.';
        console.error('Visual feature analysis error:', err);
        setCvResult({ is_flood: false, confidence: 0, detected_elements: 'unknown', reason: msg });
        setErrorMsg(msg);
        if (onShowToast) {
          onShowToast(`❌ Visual Verification Failed`, 'error');
        }
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Get User High-Accuracy Hardware GPS Location via offlineEngine
  const handleFetchLocation = async () => {
    setIsFetchingLocation(true);
    setErrorMsg('');

    try {
      const pos = await getCurrentLocation();
      const lat = parseFloat(pos.latitude.toFixed(4));
      const lng = parseFloat(pos.longitude.toFixed(4));
      setLatitude(lat);
      setLongitude(lng);
      setLocationName(`Near GPS (${lat}, ${lng})`);
    } catch (err) {
      console.warn('[ReportModal] Geolocation error:', err.message || err);
      setErrorMsg('Could not retrieve GPS coordinates. Defaulting to Chennai centre.');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  // Handle Form Submission with Online/Offline Network Fallback
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim() && !locationName.trim()) {
      setErrorMsg('Please enter a location name or description.');
      return;
    }

    if (imagePreview && cvResult && cvResult.is_flood === false) {
      const rejectMsg = cvResult.reason || 'Image features do not match urban waterlogging or flood parameters.';
      setErrorMsg(rejectMsg);
      if (onShowToast) {
        onShowToast(`Visual Verification Failed: ${rejectMsg}`, 'error');
      }
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const newReport = {
      user_id: currentUser?.id || null,
      full_name: currentUser?.full_name || 'Anonymous User',
      location_name: locationName.trim() || 'Chennai Area',
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      severity,
      water_depth: waterDepth,
      description: description.trim(),
      verified: cvResult?.is_flood ?? false,
      ai_confidence: cvResult?.confidence ? (cvResult.confidence / 100) : 0.85,
      image_url: imagePreview || null,
      image_base64: imagePreview || null,
      created_at: new Date().toISOString()
    };

    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

    try {
      let finalReport = null;

      if (isOnline) {
        // Try submitting to backend endpoint first for visual verification
        try {
          const backendRes = await fetch('http://localhost:8000/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newReport)
          });
          if (backendRes.status === 400) {
            const errBody = await backendRes.json().catch(() => ({}));
            const rejectDetail = errBody.detail || 'Image features do not match urban waterlogging or flood parameters.';
            setErrorMsg(rejectDetail);
            if (onShowToast) {
              onShowToast(`Visual Verification Failed: ${rejectDetail}`, 'error');
            }
            setIsSubmitting(false);
            return;
          }
          if (backendRes.ok) {
            finalReport = await backendRes.json();
          }
        } catch (apiErr) {
          console.warn('[ReportModal] Backend service unreachable, falling back to direct database store:', apiErr);
        }

        if (!finalReport) {
          finalReport = await createFloodReport(newReport);
        }
      } else {
        // Fallback gracefully when offline: save to LocalStorage queue
        const queuedItem = queueFloodReport(newReport);
        finalReport = {
          ...newReport,
          id: queuedItem.id || `local-${Date.now()}`,
          isOffline: true
        };

        if (onShowToast) {
          onShowToast('Saved locally. Auto-syncing when connection returns.', 'offline');
        }
      }

      if (onReportAdded) {
        onReportAdded(finalReport);
      }

      // Reset form state and close modal
      setImagePreview(null);
      setBase64Image(null);
      setCvResult(null);
      setDescription('');
      setLocationName('');
      onClose();

    } catch (err) {
      console.warn('[ReportModal] Online submit exception, queuing offline:', err);
      // Emergency network error fallback
      const queuedItem = queueFloodReport(newReport);
      const fallbackReport = {
        ...newReport,
        id: queuedItem.id || `local-${Date.now()}`,
        isOffline: true
      };

      if (onShowToast) {
        onShowToast('Saved locally. Auto-syncing when connection returns.', 'offline');
      }

      if (onReportAdded) {
        onReportAdded(fallbackReport);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md transition-all duration-300">
      <div className="relative w-full max-w-lg max-h-[90vh] glass-panel rounded-t-3xl sm:rounded-3xl border border-slate-700/80 shadow-2xl overflow-y-auto flex flex-col no-scrollbar animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="sticky top-0 z-10 glass-panel border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                Report Flood Incident
                {typeof navigator !== 'undefined' && !navigator.onLine && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <WifiOff className="w-3 h-3 text-amber-400" />
                    Offline Mode
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">Crowdsource real-time waterlogging data for Chennai</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 text-xs">

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Step 1: Upload Photo & Visual Feature Inspection */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-cyan-400" />
              Photo Evidence & Visual Inspection
            </label>

            {imagePreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 group">
                <img src={imagePreview} alt="Flood evidence preview" className="w-full h-44 object-cover" />
                <button
                  type="button"
                  onClick={() => { setImagePreview(null); setCvResult(null); setErrorMsg(''); }}
                  className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-slate-900 rounded-full text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Feature Processing Banner */}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-cyan-300 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="font-semibold">Performing visual feature analysis...</span>
                  </div>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-2xl bg-slate-900/40 hover:bg-slate-900/80 cursor-pointer transition-all">
                <Upload className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-slate-300 font-medium">Upload or Capture Image</span>
                <span className="text-[10px] text-slate-500">Supports PNG, JPG, WEBP</span>
                <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />
              </label>
            )}

            {/* Visual Verification Badge */}
            {cvResult && (
              <div className={`p-3.5 rounded-2xl border transition-all ${
                cvResult.is_flood 
                  ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200' 
                  : 'bg-red-950/60 border-red-500/70 text-red-200'
              }`}>
                <div className="flex items-start gap-2.5">
                  {cvResult.is_flood ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="font-extrabold flex items-center gap-2">
                      {cvResult.is_flood ? (
                        <span className="text-emerald-300 flex items-center gap-1 text-xs sm:text-sm">
                          ✅ Visual Verification Passed ({cvResult.confidence}% Feature Match)
                        </span>
                      ) : (
                        <span className="text-red-300 flex items-center gap-1 text-xs sm:text-sm">
                          ❌ Visual Verification Failed
                        </span>
                      )}
                    </div>

                    {cvResult.detected_elements && (
                      <p className="text-[11px] font-medium opacity-90">
                        <strong className="font-semibold text-slate-300">Detected Features:</strong> {cvResult.detected_elements}
                      </p>
                    )}

                    <p className="text-[11px] leading-relaxed opacity-90">
                      {cvResult.reason || cvResult.reasoning}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Location Details & Browser Geolocation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-cyan-400" />
                Location Information
              </label>

              <button
                type="button"
                onClick={handleFetchLocation}
                disabled={isFetchingLocation}
                className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isFetchingLocation ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MapPin className="w-3.5 h-3.5" />
                )}
                <span>Fetch GPS Location</span>
              </button>
            </div>

            <input
              type="text"
              placeholder="Location name (e.g. Velachery Main Road near Railway Station)"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500"
              required
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400">Latitude</span>
                <input
                  type="number"
                  step="0.0001"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full glass-input rounded-xl px-3 py-1.5 text-slate-200"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400">Longitude</span>
                <input
                  type="number"
                  step="0.0001"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full glass-input rounded-xl px-3 py-1.5 text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Severity & Water Depth */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Severity Level
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 cursor-pointer"
              >
                <option value="low" className="bg-slate-900 text-emerald-400">Low (Puddles)</option>
                <option value="medium" className="bg-slate-900 text-amber-400">Medium (Ankle Deep)</option>
                <option value="high" className="bg-slate-900 text-orange-400">High (Knee Deep)</option>
                <option value="critical" className="bg-slate-900 text-red-400">Critical (Submerged Vehicles)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300 flex items-center gap-1">
                <Droplet className="w-3.5 h-3.5 text-cyan-400" />
                Water Depth
              </label>
              <select
                value={waterDepth}
                onChange={(e) => setWaterDepth(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 cursor-pointer"
              >
                <option value="0.5 ft" className="bg-slate-900">&lt; 0.5 ft (Minor)</option>
                <option value="1.0 ft" className="bg-slate-900">1.0 ft (Ankle High)</option>
                <option value="1.5 ft" className="bg-slate-900">1.5 ft (Mid Calf)</option>
                <option value="2.5 ft" className="bg-slate-900">2.5 ft (Knee High)</option>
                <option value="3.5+ ft" className="bg-slate-900">3.5+ ft (Waist High)</option>
              </select>
            </div>
          </div>

          {/* Step 4: Description */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Description & Traffic Status
            </label>
            <textarea
              rows={2}
              placeholder="Describe road blockage, stranded vehicles, or recommended detours..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 resize-none"
            />
          </div>

          {/* Submit Trigger */}
          <button
            type="submit"
            disabled={isSubmitting || (imagePreview && cvResult?.is_flood === false) || isAnalyzing}
            className={`mt-2 w-full py-3 px-4 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              imagePreview && cvResult?.is_flood === false
                ? 'bg-slate-900 border border-red-500/50 text-red-300 cursor-not-allowed opacity-75'
                : 'bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-500 hover:to-amber-500 shadow-red-900/30 active:scale-98 disabled:opacity-60'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Publishing Incident Report...</span>
              </>
            ) : imagePreview && cvResult?.is_flood === false ? (
              <>
                <AlertTriangle className="w-4.5 h-4.5 text-red-400" />
                <span>Submit Disabled - Upload Valid Flood Photo</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4.5 h-4.5" />
                <span>Submit Live Flood Report</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
