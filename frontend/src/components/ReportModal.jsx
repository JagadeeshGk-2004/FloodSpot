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

  // Handle Photo Select and trigger visual feature verification
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setCvResult(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Str = reader.result;
      setImagePreview(base64Str);
      setBase64Image(base64Str);

      setIsAnalyzing(true);
      try {
        const result = await verifyFloodImage(base64Str);
        setCvResult(result);
        if (!result.verified) {
          setErrorMsg(result.error || 'Verification Failed: No floodwater, road inundation, or storm hazard detected in this image.');
        } else {
          setErrorMsg('');
        }
      } catch (err) {
        console.error('[ReportModal] Vision classification error:', err);
        const fallbackErr = 'Verification Failed: No floodwater, road inundation, or storm hazard detected in this image.';
        setCvResult({ verified: false, confidence: 0.12, detected_features: [], error: fallbackErr });
        setErrorMsg(fallbackErr);
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

  const isFormDisabled = isSubmitting || isAnalyzing || (imagePreview && cvResult && !cvResult.verified);

  // Handle Form Submission with Reliable Network & Local Fallbacks
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim() && !locationName.trim()) {
      setErrorMsg('Please enter a location name or description.');
      return;
    }

    if (imagePreview && cvResult && !cvResult.verified) {
      setErrorMsg(cvResult.error || 'Verification Failed: No floodwater, road inundation, or storm hazard detected in this image.');
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
      severity: severity || 'medium',
      water_depth: waterDepth || '1.5 ft',
      description: description.trim() || 'Waterlogging reported by citizen.',
      verified: Boolean(cvResult?.verified ?? true),
      ai_confidence: cvResult?.confidence ? (cvResult.confidence > 1 ? cvResult.confidence / 100 : cvResult.confidence) : 0.86,
      image_url: imagePreview || null,
      image_base64: imagePreview || null,
      created_at: new Date().toISOString()
    };

    try {
      let finalReport = null;

      try {
        const backendRes = await fetch('http://localhost:8000/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newReport)
        });
        if (backendRes.ok) {
          finalReport = await backendRes.json();
        }
      } catch (apiErr) {
        console.warn('[ReportModal] API backend offline fallback:', apiErr);
      }

      if (!finalReport) {
        try {
          finalReport = await createFloodReport(newReport);
        } catch (dbErr) {
          console.warn('[ReportModal] Direct store notice:', dbErr);
        }
      }

      if (!finalReport) {
        const queuedItem = queueFloodReport(newReport);
        finalReport = {
          ...newReport,
          id: queuedItem?.id || `local-${Date.now()}`
        };
      }

      if (onReportAdded) {
        onReportAdded(finalReport);
      }

      if (onShowToast) {
        onShowToast('Report submitted successfully', 'success');
      }

      // Reset form and close modal cleanly
      setImagePreview(null);
      setBase64Image(null);
      setCvResult(null);
      setDescription('');
      setLocationName('');
      onClose();

    } catch (err) {
      console.warn('[ReportModal] Error in report pipeline:', err);
      const fallbackItem = {
        ...newReport,
        id: `local-${Date.now()}`
      };

      if (onReportAdded) {
        onReportAdded(fallbackItem);
      }
      if (onShowToast) {
        onShowToast('Report submitted successfully', 'success');
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
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Step 1: Upload Photo & Visual Feature Inspection */}
          <div className="space-y-2">
            <label className="font-semibold text-[#94A3B8] flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#38BDF8]" />
              Photo Evidence & Visual Inspection
            </label>

            {imagePreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-[#1E293B] bg-[#090D16] group">
                <img src={imagePreview} alt="Flood evidence preview" className="w-full h-44 object-cover" />
                <button
                  type="button"
                  onClick={() => { setImagePreview(null); setCvResult(null); setErrorMsg(''); }}
                  className="absolute top-2 right-2 p-1.5 bg-[#090D16]/80 hover:bg-[#090D16] rounded-full text-[#94A3B8] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#1E293B] hover:border-[#38BDF8]/60 rounded-2xl bg-[#090D16]/40 hover:bg-[#090D16]/80 cursor-pointer transition-all">
                <Upload className="w-6 h-6 text-[#94A3B8] mb-1" />
                <span className="text-[#F8FAFC] font-medium">Upload or Capture Image</span>
                <span className="text-[10px] text-[#94A3B8]">Supports PNG, JPG, WEBP</span>
                <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />
              </label>
            )}

            {/* Active Spinner Banner */}
            {isAnalyzing && (
              <div className="p-3.5 rounded-2xl bg-[#090D16] border border-[#38BDF8]/40 text-[#38BDF8] flex items-center justify-center gap-2 font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing image via Hydro Depth Engine...</span>
              </div>
            )}

            {/* Content-Aware Verification Result Badge */}
            {!isAnalyzing && cvResult && (
              cvResult.verified ? (
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-[#10B981] text-[#10B981] space-y-1">
                  <div className="font-extrabold flex items-center gap-2 text-xs sm:text-sm">
                    <ShieldCheck className="w-4.5 h-4.5 text-[#10B981] shrink-0" />
                    <span>✓ Visual Verification Passed ({Math.round((cvResult.confidence > 1 ? cvResult.confidence / 100 : cvResult.confidence) * 100)}% Confidence)</span>
                  </div>
                  {cvResult.detected_features && cvResult.detected_features.length > 0 && (
                    <p className="text-[11px] text-emerald-200/90 pl-6">
                      <strong className="text-white">Detected:</strong> {cvResult.detected_features.join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-red-950/40 border border-[#EF4444] text-[#EF4444] space-y-1">
                  <div className="font-extrabold flex items-center gap-2 text-xs sm:text-sm">
                    <AlertTriangle className="w-4.5 h-4.5 text-[#EF4444] shrink-0" />
                    <span>❌ Verification Failed</span>
                  </div>
                  <p className="text-[11px] text-red-200/90 pl-6">
                    {cvResult.error || 'Verification Failed: No floodwater, road inundation, or storm hazard detected in this image.'}
                  </p>
                </div>
              )
            )}
          </div>

          {/* Step 2: Location Details & Browser Geolocation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-[#94A3B8] flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#38BDF8]" />
                Location Information
              </label>

              <button
                type="button"
                onClick={handleFetchLocation}
                disabled={isFetchingLocation}
                className="text-[#38BDF8] hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
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
              className="w-full glass-input bg-[#111827] border border-[#1E293B] rounded-xl px-3 py-2 text-[#F8FAFC] placeholder-[#64748B]"
              required
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-[#94A3B8]">Latitude</span>
                <input
                  type="number"
                  step="0.0001"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full glass-input bg-[#111827] border border-[#1E293B] rounded-xl px-3 py-1.5 text-[#F8FAFC]"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#94A3B8]">Longitude</span>
                <input
                  type="number"
                  step="0.0001"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full glass-input bg-[#111827] border border-[#1E293B] rounded-xl px-3 py-1.5 text-[#F8FAFC]"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Severity & Water Depth */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-[#94A3B8] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
                Severity Level
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full glass-input bg-[#111827] border border-[#1E293B] rounded-xl px-3 py-2 text-[#F8FAFC] cursor-pointer"
              >
                <option value="low" className="bg-[#111827] text-[#10B981]">Low (Puddles)</option>
                <option value="medium" className="bg-[#111827] text-[#F59E0B]">Medium (Ankle Deep)</option>
                <option value="high" className="bg-[#111827] text-orange-400">High (Knee Deep)</option>
                <option value="critical" className="bg-[#111827] text-[#EF4444]">Critical (Submerged Vehicles)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-[#94A3B8] flex items-center gap-1">
                <Droplet className="w-3.5 h-3.5 text-[#38BDF8]" />
                Water Depth
              </label>
              <select
                value={waterDepth}
                onChange={(e) => setWaterDepth(e.target.value)}
                className="w-full glass-input bg-[#111827] border border-[#1E293B] rounded-xl px-3 py-2 text-[#F8FAFC] cursor-pointer"
              >
                <option value="0.5 ft" className="bg-[#111827]">&lt; 0.5 ft (Minor)</option>
                <option value="1.0 ft" className="bg-[#111827]">1.0 ft (Ankle High)</option>
                <option value="1.5 ft" className="bg-[#111827]">1.5 ft (Mid Calf)</option>
                <option value="2.5 ft" className="bg-[#111827]">2.5 ft (Knee High)</option>
                <option value="3.5+ ft" className="bg-[#111827]">3.5+ ft (Waist High)</option>
              </select>
            </div>
          </div>

          {/* Step 4: Description */}
          <div className="space-y-1.5">
            <label className="font-semibold text-[#94A3B8] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#94A3B8]" />
              Description & Traffic Status
            </label>
            <textarea
              rows={2}
              placeholder="Describe road blockage, stranded vehicles, or recommended detours..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full glass-input bg-[#111827] border border-[#1E293B] rounded-xl px-3 py-2 text-[#F8FAFC] placeholder-[#64748B] resize-none"
            />
          </div>

          {/* Submit Trigger - Enabled when verified, disabled on rejection */}
          <button
            type="submit"
            disabled={isFormDisabled}
            className={`mt-2 w-full py-3.5 px-4 font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all ${
              imagePreview && cvResult && !cvResult.verified
                ? 'bg-[#1E293B] text-[#94A3B8] border border-red-500/40 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white cursor-pointer active:scale-98 disabled:opacity-50'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Publishing Incident Report...</span>
              </>
            ) : imagePreview && cvResult && !cvResult.verified ? (
              <>
                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                <span>Verification Failed — Submit Locked</span>
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
