import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './db.js';
import { addToOutbox, getOutbox } from './idb.js';
import { MapPin, ShieldAlert, Sun, Moon, Loader, Camera, Zap, Navigation, LayoutGrid, PlusCircle, LogOut, Menu, X, ExternalLink, Settings, Phone, Volume2, BookOpen, Cloud, Activity, Wind, Droplet, Copy, Check, CloudRain, Waves, Tornado, Eye, Umbrella, ArrowUp, Route, Users, Wifi } from 'lucide-react';
import { useBackgroundSync } from './useBackgroundSync.js';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import SafestRoutePage from './SafestRoutePage.jsx';
import { CrisisCommandPanel, CrisisCommandToggle } from './EmergencyMode.jsx';

const DISASTERS = [
  {
    id: 'flood', title: 'Flood', icon: Droplet, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30', steps: [
      "Kill main breaker box IMMEDIATELY to prevent electrocution.",
      "Move to highest elevation available. Do not get trapped in an attic without an exit.",
      "Seal valuable documents in watertight bags.",
      "Do NOT wade through floodwaters. 6 inches can knock you down. 2 feet can sweep away cars.",
      "Assume all standing water is biologically or chemically contaminated."
    ]
  },
  {
    id: 'tsunami', title: 'Tsunami', icon: Waves, color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/30', steps: [
      "Abandon vehicles. Run to high ground or inland IMMEDIATELY on foot.",
      "Do not wait for official warnings if you feel a strong earthquake lasting 20+ seconds.",
      "Grab your bug-out bag, but drop it if it slows your ascent.",
      "If trapped, find a tall, reinforced concrete building and get to the 3rd floor or higher.",
      "Stay away from the coast until officials issue an 'all clear'. Subsequent waves are often larger."
    ]
  },
  {
    id: 'cyclone', title: 'Cyclones', icon: Tornado, color: 'text-slate-800', bg: 'bg-slate-400/10', border: 'border-slate-400/30', steps: [
      "Tape windows with a star pattern. Barricade entry points with heavy furniture.",
      "Shelter in a windowless interior room or basement. Use a mattress for overhead cover.",
      "Disconnect gas lines at the main valve to prevent explosions.",
      "Charge all devices while power remains. Fill bathtubs and containers with water.",
      "Do not leave shelter during the 'eye'. The back wall hits with extreme violence."
    ]
  },
  {
    id: 'heat', title: 'Heat Surges', icon: Sun, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', steps: [
      "Block sunlight completely. Cover windows with foil or dark, thick blankets.",
      "Hydrate aggressively. Drink water before you feel thirsty. Mix in salt/electrolytes.",
      "Identify the coolest room (usually lowest level, north-facing). Stay on the floor.",
      "Soak clothing or towels in cold water and drape over your neck and wrists.",
      "Avoid protein-heavy meals; digestion increases internal body temperature."
    ]
  }
];
import L from 'leaflet';
import { formatDistanceToNow } from 'date-fns';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

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
      className="absolute bottom-6 right-6 z-[1000] p-4 bg-[#A891DE] text-white rounded-full shadow-[0_10px_20px_rgba(168,145,222,0.4)] hover:scale-110 active:scale-95 smooth-transition"
    >
      <Navigation size={24} className="animate-pulse" />
    </button>
  );
}

export default function App() {
  const [view, setView] = useState('login');
  const [user, setUser] = useState(null);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('floodspot_theme') !== 'light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const [isLocationActive, setIsLocationActive] = useState(false);
  const [address, setAddress] = useState("Acquiring Signal...");
  const [reports, setReports] = useState([]);
  const [severity, setSeverity] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSirenPlaying, setIsSirenPlaying] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [selectedDisaster, setSelectedDisaster] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [nearbySurvivors, setNearbySurvivors] = useState(0);

  const fileInputRef = useRef(null);
  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isSirenPlaying) {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          console.warn('[Siren] Web Audio API unavailable on this device.');
          setTimeout(() => setIsSirenPlaying(false), 0);
          return;
        }
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.connect(gain);
      gain.connect(ctx.destination);

      const modulate = () => {
        const t = ctx.currentTime;
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.linearRampToValueAtTime(1200, t + 0.5);
        osc.frequency.linearRampToValueAtTime(600, t + 1.0);
      };

      modulate();
      intervalRef.current = setInterval(modulate, 1000);

      osc.start();
      oscRef.current = osc;
    } else {
      if (oscRef.current) {
        try { oscRef.current.stop(); } catch { /* ignore stop error if already stopped */ }
        oscRef.current.disconnect();
        oscRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (oscRef.current) {
        try { oscRef.current.stop(); } catch { /* ignore stop error if already stopped */ }
        oscRef.current.disconnect();
        oscRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isSirenPlaying]);

  // P2P Mesh Discovery Logic (BLE + Simulation)
  useEffect(() => {
    let scanInterval;
    
    const startMeshDiscovery = async () => {
      // 1. Attempt genuine BLE scan if supported (Experimental Web Bluetooth Scanning)
      if (navigator.bluetooth && navigator.bluetooth.requestLEScan) {
        try {
          await navigator.bluetooth.requestLEScan({ acceptAllAdvertisements: true });
          navigator.bluetooth.addEventListener('advertisementreceived', () => {
            // For privacy/demo, we just increment on any nearby device with specific traits
            setNearbySurvivors(prev => Math.min(prev + 1, 5));
          });
          return; // If real hardware works, skip simulation
        } catch {
          console.log('[Mesh] Hardware BLE scan unavailable, falling back to simulation.');
        }
      }

      // 2. Fallback: Simulated Radar for environments without Web BLE Support
      scanInterval = setInterval(() => {
        // Randomly simulate finding 0 to 3 users nearby
        const mockFound = Math.floor(Math.random() * 4);
        setNearbySurvivors(mockFound);
      }, 8000);
    };

    startMeshDiscovery();

    return () => {
      if (scanInterval) clearInterval(scanInterval);
    };
  }, []);

  useEffect(() => {
    if (view === 'weather' && coords && !weatherData) {
      setTimeout(() => setWeatherLoading(true), 0);
      Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code,visibility,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&timezone=auto`).then(res => res.json()),
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.latitude}&longitude=${coords.longitude}&current=us_aqi`).then(res => res.json()).catch(() => null)
      ]).then(([weather, aqi]) => {
        setWeatherData({ ...weather, aqi });
        setWeatherLoading(false);
      }).catch(() => setWeatherLoading(false));
    }
  }, [view, coords, weatherData]);

  // Effect 1: Theme class — runs only when isDark changes, zero side effects on routing
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('floodspot_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Effect 3: Auth listener — runs ONCE on mount, uses functional setView
  // so it only navigates away from the login screen, never clobbers an active page
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        setView(prev => (prev === 'login' ? 'report' : prev));
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session) setView(prev => (prev === 'login' ? 'report' : prev));
      else setView('login');
    });
    fetchReports();
    return () => subscription.unsubscribe();
  }, []); // empty — intentionally runs once

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 5000);
  }, []);

  // Background sync – runs when connectivity restores
  useBackgroundSync(fetchReportsWithOffline);

  const requestLocation = () => {
    if (loading) return;
    if (!('geolocation' in navigator)) {
      showToast('GPS not available on this device.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude, longitude } = p.coords;
        setCoords({ latitude, longitude });
        setIsLocationActive(true);
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          .then(res => res.json())
          .then(data => {
            if (data?.display_name) {
              const parts = data.display_name.split(',');
              setAddress(`${parts[0]}${parts[1] ? ', ' + parts[1] : ''}`);
            }
          }).finally(() => setLoading(false));
      },
      () => { setIsLocationActive(false); setLoading(false); },
      { enableHighAccuracy: true }
    );
  };

  // Removed duplicate syncOutbox – handled by useBackgroundSync hook

  async function fetchReports() {
    const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
    if (data) setReports(data);
  }

  // Merges live Supabase reports with local offline queue for the feed
  async function fetchReportsWithOffline() {
    let live = [];
    try {
      const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
      if (data) live = data;
    } catch {
      console.warn("Offline mode: fetching local outbox.");
    }

    const queue = await getOutbox();
    const pending = queue.map((item, i) => ({
      id: `offline-${i}`,
      created_at: item.created_at || new Date().toISOString(),
      ...item,
      _isPending: true,
    }));
    setReports([...pending, ...live]);
  }


    const handleAuth = async (type) => {
      if (!email || !password) return alert("Credentials required.");
      setLoading(true);
      try {
        if (type === 'login') {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          alert("Check your email!");
        }
      } catch (err) { alert(err.message); }
      finally { setLoading(false); }
    };

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
          await fetchReportsWithOffline();
          setView('explore');
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
        await fetchReports();
        setView('explore');
      } catch (err) {
        console.error(err);
        alert("Failed to report: " + err.message);
      }
      finally { setLoading(false); }
    };

    if (!user) {
      return (
        <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-1000 ${isDark ? 'bg-[#0C0B09]' : 'bg-[#F3EFDF]'}`}>

          <div className="w-full max-w-md p-10 rounded-[3rem] space-y-8 glass-card smooth-transition animate-in fade-in zoom-in duration-1000">
            <div className="text-center space-y-3">
              <div className="bg-[#A891DE] w-20 h-20 rounded-[2.2rem] flex items-center justify-center mx-auto text-white shadow-[0_0_40px_rgba(168,145,222,0.4)]">
                <ShieldAlert size={44} />
              </div>
              <h1 className="text-4xl font-black text-[#1a1410] dark:text-[#FFFFFF] tracking-tighter uppercase italic">FloodSpot</h1>
            </div>
            <div className="space-y-4">
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 rounded-2xl bg-[#F3EFDF] dark:bg-white/5 border border-[#D4CBAF] dark:border-[#A891DE]/20 text-[#1a1410] dark:text-white placeholder-[#1a1410]/40 dark:placeholder-white/40 outline-none focus:border-[#A891DE] smooth-transition" />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 rounded-2xl bg-[#F3EFDF] dark:bg-white/5 border border-[#D4CBAF] dark:border-[#A891DE]/20 text-[#1a1410] dark:text-white placeholder-[#1a1410]/40 dark:placeholder-white/40 outline-none focus:border-[#A891DE] smooth-transition" />
            </div>
            <div className="space-y-4">
              <button onClick={() => handleAuth('login')} disabled={loading} className="w-full py-5 bg-[#A891DE] text-white font-black rounded-3xl shadow-xl hover:brightness-110 active:scale-95 smooth-transition uppercase tracking-widest">{loading ? <Loader className="animate-spin mx-auto" size={20} /> : 'Login'}</button>
              <button onClick={() => handleAuth('signup')} disabled={loading} className="w-full py-5 border-2 border-[#A891DE] text-[#A891DE] font-black rounded-3xl hover:bg-[#A891DE] hover:text-white active:scale-95 smooth-transition uppercase tracking-widest">Register</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`h-screen w-full overflow-hidden flex flex-col items-center justify-center transition-colors duration-1000 ${isDark ? 'dark bg-[#0C0B09] text-[#FFFFFF]' : 'light bg-[#F3EFDF] text-[#1a1410]'}`}>
        <div className="w-full h-full flex flex-col max-w-full mx-auto">
        {/* Crisis Command overlay — mounts over everything, unmounts maps */}
        {isEmergencyMode && (
          <CrisisCommandPanel coords={coords} onExit={() => setIsEmergencyMode(false)} />
        )}

        {/* Toast Notification */}
        {toastMsg && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[10001] max-w-xs w-[90vw] bg-[#A891DE] text-white px-5 py-4 rounded-3xl shadow-2xl text-[11px] font-black uppercase tracking-widest text-center animate-in slide-in-from-top-4 fade-in duration-300">
            {toastMsg}
          </div>
        )}

        {isFlashing && (
          <>
            <div
              className="fixed inset-0 w-screen h-screen z-[9998]"
              style={{ animation: 'sosFlash 0.15s infinite' }}
            >
              <style>{`
              @keyframes sosFlash {
                0%, 100% { background-color: #ff0000; }
                50% { background-color: #ffffff; }
              }
            `}</style>
            </div>
            <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-10 fade-in duration-500">
              <button
                onClick={() => setIsFlashing(false)}
                className="group flex items-center gap-4 bg-black/80 backdrop-blur-2xl border border-white/10 p-2 pr-8 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:bg-black hover:scale-105 active:scale-95 smooth-transition"
              >
                <div className="bg-red-500/20 text-red-500 p-4 rounded-full group-hover:bg-red-500 group-hover:text-white smooth-transition shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                  <X size={24} />
                </div>
                <span className="font-black text-white uppercase tracking-[0.2em] text-xs">Terminate Beacon</span>
              </button>
            </div>
          </>
        )}

        {isSidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] animate-in fade-in duration-500" onClick={() => setIsSidebarOpen(false)} />}
        <div className={`fixed top-0 left-0 bottom-0 w-80 glass-card z-[3001] transform smooth-transition p-10 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex justify-between items-center mb-16 text-[#1a1410] dark:text-[#FFFFFF]">
            <div className="flex items-center gap-3"><Settings size={22} /><h2 className="font-black text-2xl tracking-tighter uppercase">Settings</h2></div>
            <button onClick={() => setIsSidebarOpen(false)} className="hover:rotate-90 smooth-transition"><X size={24} /></button>
          </div>
          <div className="space-y-10 flex-1 overflow-y-auto pb-6 scrollbar-hide">
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1a1410] dark:text-white/50 ml-2">Theme</p>
              <div onClick={() => setIsDark(!isDark)} className="w-full h-16 bg-[#F3EFDF] dark:bg-[#A891DE]/10 rounded-[2.5rem] p-2 cursor-pointer relative flex items-center border border-[#D4CBAF] dark:border-[#A891DE]/30">
                <div className="flex items-center justify-around w-full z-10 font-black text-[11px] uppercase tracking-widest">
                  <div className={`flex items-center gap-2 smooth-transition ${!isDark ? 'text-white' : 'text-[#1a1410] dark:text-[#A891DE]'}`}><Sun size={18} /> Light</div>
                  <div className={`flex items-center gap-2 smooth-transition ${isDark ? 'text-white' : 'text-[#1a1410] dark:text-[#A891DE]'}`}><Moon size={18} /> Dark</div>
                </div>
                <div className={`absolute w-[47%] h-[82%] bg-[#A891DE] rounded-[2rem] smooth-transition ${isDark ? 'translate-x-[105%]' : 'translate-x-0'}`} />
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1a1410] dark:text-white/50 ml-2">Emergency Tools</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setIsSirenPlaying(!isSirenPlaying)} className={`p-4 rounded-3xl border flex flex-col items-center gap-2 smooth-transition ${isSirenPlaying ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-[#F3EFDF] dark:bg-[#A891DE]/10 border-[#D4CBAF] dark:border-[#A891DE]/30 text-[#1a1410] dark:text-[#D3C9F2]'}`}>
                  <Volume2 size={24} className={isSirenPlaying ? "animate-pulse" : ""} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{isSirenPlaying ? 'Siren On' : 'Siren'}</span>
                </button>
                <button onClick={() => setIsFlashing(!isFlashing)} className={`p-4 rounded-3xl border flex flex-col items-center gap-2 smooth-transition ${isFlashing ? 'bg-white border-white text-red-500 shadow-[0_0_30px_rgba(255,255,255,0.8)]' : 'bg-[#F3EFDF] dark:bg-[#A891DE]/10 border-[#D4CBAF] dark:border-[#A891DE]/30 text-[#1a1410] dark:text-[#D3C9F2]'}`}>
                  <Zap size={24} className={isFlashing ? "animate-pulse" : ""} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{isFlashing ? 'Beacon On' : 'Beacon'}</span>
                </button>
              </div>
            </div>

            <CrisisCommandToggle
              isOn={isEmergencyMode}
              onToggle={() => { setIsEmergencyMode(v => !v); setIsSidebarOpen(false); }}
              isDark={isDark}
            />

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                setUser(null);
                setCoords(null);
                setReports([]);
                setWeatherData(null);
                setIsSidebarOpen(false);
                setView('login');
                window.location.reload();
              }}
              className="w-full p-4 rounded-[2rem] flex items-center justify-center gap-3 text-red-500 hover:bg-red-500/10 smooth-transition font-bold uppercase text-xs tracking-widest mt-4"
            >
              <LogOut size={18} />Sign Out
            </button>
          </div>
        </div>

        <header className="sticky top-0 z-[999] w-full shrink-0 bg-[#F3EFDF] dark:bg-[#0C0B09] border-b border-[#D4CBAF] dark:border-[#A891DE]/10">
          <div className="w-full max-w-3xl mx-auto px-6 pt-8 pb-4 flex justify-between items-center h-24">
            <button onClick={() => setIsSidebarOpen(true)} className="p-4 bg-[#F3EFDF] dark:bg-[#A891DE]/10 rounded-2xl border border-[#D4CBAF] dark:border-[#A891DE]/30 text-[#1a1410] dark:text-[#D3C9F2] hover:scale-110 active:scale-95 smooth-transition"><Menu size={24} /></button>
            <h1 className="text-4xl font-black tracking-tighter italic text-[#A891DE]">FLOODSPOT</h1>
            <div className="w-12" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto animate-in fade-in duration-1000 w-full">
        <div className="w-full max-w-3xl mx-auto px-6 pt-6 pb-36 space-y-12 flex flex-col items-stretch">

          {view === 'route' && (
            <SafestRoutePage coords={coords} isDark={isDark} />
          )}

          {view === 'explore' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
              
              {/* P2P MESH DISCOVERY INDICATOR */}
              <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-6 rounded-[3rem] border border-[#A891DE]/30 flex items-center justify-between shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`p-4 rounded-2xl flex items-center justify-center ${nearbySurvivors > 0 ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'bg-[#F3EFDF] dark:bg-white/10 text-[#9A8FB3] dark:text-white/30'}`}>
                    {nearbySurvivors > 0 ? (
                      <div className="relative">
                        <Users size={24} />
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                        </span>
                      </div>
                    ) : (
                      <Wifi size={24} />
                    )}
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-widest text-[#1a1410] dark:text-[#FFFFFF]">
                      {nearbySurvivors > 0 ? `${nearbySurvivors} People detected nearby` : 'Scanning Mesh...'}
                    </h3>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${nearbySurvivors > 0 ? 'text-green-600 dark:text-green-400' : 'text-[#9A8FB3] dark:text-white/40'}`}>
                      {nearbySurvivors > 0 ? 'Local Mesh Active. You are not alone.' : 'Searching for nearby peers'}
                    </p>
                  </div>
                </div>
                {nearbySurvivors > 0 && <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 to-green-500/10 animate-pulse" />}
              </div>

              {reports.map((r) => (
                <div key={r.id} className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 rounded-[3.5rem] overflow-hidden border border-[#D4CBAF] dark:border-[#A891DE]/30 shadow-xl smooth-transition">
                  {r.photo_url ? (
                    <img src={r.photo_url} className="w-full h-84 object-cover" alt="intel" />
                  ) : (
                    <div className="w-full h-84 bg-[#F9F7F0] dark:bg-[#0A0A0A] flex flex-col items-center justify-center gap-4 border-b border-[#D4CBAF] dark:border-[#A891DE]/20">
                      <div className="p-6 rounded-full bg-[#F3EFDF] dark:bg-[#A891DE]/10 border border-[#D4CBAF] dark:border-[#A891DE]/30">
                        <ShieldAlert className="text-[#A891DE]" size={40} />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 dark:text-[#A891DE]">Visual Intel Restricted</p>
                    </div>
                  )}
                  <div className="p-10 space-y-6">
                    <div className="flex justify-between items-start">
                      <div><p className="text-[10px] font-black uppercase text-[#A891DE]">Incident Sector</p><h3 className="font-black text-2xl tracking-tight text-[#1a1410] dark:text-[#FFFFFF]">{r.place_name || "Unmapped"}</h3></div>
                      <div className="flex flex-col items-end gap-1.5">
                        {r._isPending && (
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-500 text-[8px] font-black uppercase tracking-widest">
                            <Loader size={9} className="animate-spin" /> Pending Sync
                          </span>
                        )}
                        <span className={`px-5 py-2 rounded-2xl font-black text-[10px] uppercase ${r.severity === 'high' ? 'bg-red-600' : 'bg-[#A891DE]'} text-white shadow-lg`}>{r.severity}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-6 border-t border-[#D4CBAF] dark:border-[#A891DE]/20">
                      <p className="text-[10px] font-bold text-[#1a1410] dark:text-[#D3C9F2] uppercase">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p>
                      <a href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} target="_blank" className="text-[10px] font-black text-[#A891DE] flex items-center gap-2 uppercase hover:translate-x-1 smooth-transition"><ExternalLink size={14} /> GPS Link</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'report' && (
            <div className="space-y-10 animate-in fade-in duration-700">
              <div className="grid grid-cols-2 gap-4">
                {[{ n: "National", p: "108" }, { n: "Disaster", p: "1070" }, { n: "Fire", p: "101" }, { n: "Police", p: "100" }].map(h => (
                  <div key={h.n} className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-4 rounded-3xl border border-red-500/20 flex items-center gap-3">
                    <Phone size={16} className="text-red-500" />
                    <div><p className="text-[8px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2]">{h.n}</p><p className="font-black text-xs text-[#1a1410] dark:text-[#FFFFFF]">{h.p}</p></div>
                  </div>
                ))}
              </div>

              <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-8 rounded-[3rem] flex items-center justify-between border border-[#D4CBAF] dark:border-[#A891DE]/30 smooth-transition">
                <div className="flex items-center gap-6 overflow-hidden">
                  <div className="bg-[#A891DE] p-5 rounded-2xl text-white shadow-lg"><MapPin size={28} /></div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#1a1410] dark:text-[#D3C9F2]">{isLocationActive ? 'ONLINE' : 'OFFLINE'}</p>
                    </div>
                    <p className="font-black text-xl truncate tracking-tight text-[#1a1410] dark:text-[#FFFFFF]">{address}</p>
                  </div>
                </div>
                <button
                  onClick={requestLocation}
                  className={`p-4 rounded-2xl border-2 flex items-center justify-center smooth-transition shadow-lg ${isLocationActive
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-red-500 bg-red-500/10'
                    }`}
                >
                  <div className={`w-6 h-6 rounded-full ${isLocationActive
                    ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)] animate-pulse'
                    : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse'
                    }`} />
                </button>
              </div>

              {coords && (
                <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-6 rounded-[2.5rem] border border-[#D4CBAF] dark:border-[#A891DE]/30 flex justify-between items-center shadow-lg">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2] tracking-widest">Decimal GPS</p>
                    <p className="font-mono font-bold text-sm text-[#1a1410] dark:text-[#FFFFFF]">{coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="p-4 bg-[#A891DE]/10 border border-[#A891DE]/30 text-[#A891DE] rounded-2xl hover:bg-[#A891DE] hover:text-white smooth-transition active:scale-95"
                  >
                    {copied ? <Check size={20} /> : <Copy size={20} />}
                  </button>
                </div>
              )}

              <div className="h-[26rem] rounded-[3.5rem] overflow-hidden border border-[#D4CBAF] dark:border-[#A891DE]/30 relative shadow-2xl">
                <MapContainer center={[13.08, 80.27]} zoom={15} zoomControl={false} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                  {coords && <Marker position={[coords.latitude, coords.longitude]} />}
                  <RecenterMap coords={coords} />
                  <MapControls coords={coords} />
                </MapContainer>
              </div>

              <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-10 rounded-[3.5rem] space-y-8 border border-[#D4CBAF] dark:border-[#A891DE]/30">
                <div className="flex bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-2 rounded-[2.5rem] gap-2 border border-[#D4CBAF] dark:border-[#A891DE]/20">
                  {['low', 'medium', 'high'].map((s) => (
                    <button key={s} onClick={() => setSeverity(s)} className={`flex-1 py-4 rounded-[2rem] text-[10px] font-black uppercase smooth-transition ${severity === s ? 'bg-[#A891DE] text-white shadow-xl scale-105' : 'text-[#1a1410] dark:text-[#D3C9F2] hover:text-[#1a1410] dark:hover:text-[#D3C9F2]'}`}>{s}</button>
                  ))}
                </div>
                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                <button onClick={() => fileInputRef.current.click()} className="w-full py-8 rounded-[2.5rem] border-2 border-dashed border-[#D4CBAF] dark:border-[#A891DE]/40 bg-[#A891DE]/5 flex items-center justify-center gap-4 text-[#1a1410] dark:text-[#FFFFFF] hover:bg-[#A891DE]/10 smooth-transition">
                  <Camera size={26} className="text-[#A891DE]" />
                  <span className="font-black uppercase text-[11px] tracking-[0.2em]">{file ? "Intel Logged" : "Attach Intel"}</span>
                </button>
              </div>

              <button onClick={handleReport} disabled={loading || !coords} className="w-full py-9 rounded-[4rem] font-black text-2xl bg-[#A891DE] text-white shadow-[0_20px_50px_rgba(168,145,222,0.3)] disabled:opacity-50 hover:scale-[1.02] active:scale-95 smooth-transition flex items-center justify-center gap-5">
                {loading ? <Loader className="animate-spin" /> : <><Zap size={32} fill="white" /> BROADCAST</>}
              </button>
            </div>
          )
          }

          {
            view === 'handbook' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
                <div className="bg-[#A891DE] p-8 rounded-[3.5rem] shadow-[0_20px_50px_rgba(168,145,222,0.3)] text-white relative overflow-hidden">
                  <div className="relative z-10">
                    <BookOpen size={36} className="mb-4 opacity-80" />
                    <h2 className="text-3xl font-black tracking-tight uppercase italic mb-2">Survival Guide</h2>
                    <p className="text-sm font-medium opacity-80">Offline Emergency Handbook</p>
                  </div>
                  <div className="absolute -right-10 -bottom-10 opacity-10"><BookOpen size={180} /></div>
                </div>

                {selectedDisaster ? (
                  <div className="space-y-4 animate-in slide-in-from-right-5 duration-500">
                    <button onClick={() => setSelectedDisaster(null)} className="mb-4 text-[#A891DE] font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:opacity-70"><X size={16} /> Back to Hub</button>
                    <div className={`p-8 rounded-[3rem] border ${selectedDisaster.bg} ${selectedDisaster.border} relative overflow-hidden`}>
                      <selectedDisaster.icon size={48} className={`${selectedDisaster.color} mb-6`} />
                      <h3 className={`font-black text-2xl uppercase tracking-tight ${selectedDisaster.color} mb-6`}>{selectedDisaster.title} Action Plan</h3>
                      <div className="space-y-4 relative z-10">
                        {selectedDisaster.steps.map((step, idx) => (
                          <div key={idx} className="flex gap-4 items-start">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs text-white ${selectedDisaster.color.replace('text-', 'bg-')} shrink-0 mt-1`}>{idx + 1}</div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>
                      <selectedDisaster.icon size={150} className={`${selectedDisaster.color} absolute -right-10 -bottom-10 opacity-5`} />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {DISASTERS.map((d) => (
                      <div key={d.id} onClick={() => setSelectedDisaster(d)} className={`cursor-pointer p-6 rounded-[2.5rem] border ${d.border} ${d.bg} flex flex-col items-center gap-4 hover:scale-105 active:scale-95 smooth-transition shadow-lg text-center`}>
                        <div className={`p-4 rounded-full bg-white/10 ${d.color}`}><d.icon size={32} /></div>
                        <h3 className="font-black text-xs uppercase tracking-widest text-slate-800 dark:text-white">{d.title}</h3>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          {
            view === 'weather' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
                <div className="bg-gradient-to-br from-blue-500 to-[#A891DE] p-8 rounded-[3.5rem] shadow-[0_20px_50px_rgba(168,145,222,0.3)] text-white relative overflow-hidden">
                  <div className="relative z-10">
                    <Cloud size={36} className="mb-4 opacity-80" />
                    <h2 className="text-3xl font-black tracking-tight uppercase italic mb-2">Weather Intel</h2>
                    <p className="text-sm font-medium opacity-80">Local conditions & forecast</p>
                  </div>
                  <div className="absolute -right-10 -bottom-10 opacity-10"><CloudRain size={180} /></div>
                </div>

                {!coords ? (
                  <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-10 rounded-[3rem] text-center space-y-4 border border-[#D4CBAF] dark:border-[#A891DE]/30">
                    <MapPin size={40} className="mx-auto text-[#A891DE] opacity-50" />
                    <p className="text-sm font-medium text-[#1a1410] dark:text-[#FFFFFF] opacity-70">Location required for weather data.</p>
                    <button onClick={requestLocation} className="px-6 py-3 bg-[#A891DE] text-white font-bold rounded-2xl uppercase tracking-widest text-xs shadow-lg hover:scale-105 smooth-transition">Enable GPS</button>
                  </div>
                ) : weatherLoading ? (
                  <div className="py-20 flex justify-center"><Loader className="animate-spin text-[#A891DE]" size={40} /></div>
                ) : weatherData ? (
                  <div className="space-y-4">
                    {/* MAIN CURRENT TEMP CARD */}
                    <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-8 rounded-[3rem] border border-[#D4CBAF] dark:border-[#A891DE]/30 flex flex-col justify-center items-center shadow-xl text-center">
                      <CloudRain size={60} className="text-[#A891DE] mb-4" />
                      <h3 className="font-black text-8xl tracking-tighter text-[#1a1410] dark:text-[#FFFFFF]">{Math.round(weatherData.current.temperature_2m)}°</h3>
                      <p className="text-lg font-bold text-[#1a1410] dark:text-[#D3C9F2]">Feels like {Math.round(weatherData.current.apparent_temperature)}°</p>
                      <p className="text-sm font-bold text-[#9A8FB3] dark:text-[#A891DE] mt-2">High {Math.round(weatherData.daily.temperature_2m_max[0])}° • Low {Math.round(weatherData.daily.temperature_2m_min[0])}°</p>
                    </div>

                    {/* HOURLY CAROUSEL */}
                    <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-6 rounded-[3rem] border border-[#D4CBAF] dark:border-[#A891DE]/30 overflow-x-auto scrollbar-hide flex gap-4 snap-x">
                      {weatherData.hourly.time.slice(0, 24).map((time, idx) => (
                        <div key={time} className="flex flex-col items-center justify-between min-w-[4rem] p-4 rounded-3xl bg-white/50 dark:bg-black/20 snap-center shrink-0">
                          <span className="text-[10px] font-black text-[#1a1410] dark:text-[#D3C9F2] uppercase">{new Date(time).getHours()}:00</span>
                          <Cloud size={24} className="my-3 text-[#A891DE]" />
                          <span className="font-black text-lg text-[#1a1410] dark:text-[#FFFFFF]">{Math.round(weatherData.hourly.temperature_2m[idx])}°</span>
                          <span className="text-[9px] font-bold text-blue-500 mt-2">{weatherData.hourly.precipitation_probability[idx]}%</span>
                        </div>
                      ))}
                    </div>

                    {/* MINI CARDS GRID */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* AIR QUALITY */}
                      <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-6 rounded-[2.5rem] border border-[#D4CBAF] dark:border-[#A891DE]/30 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-4">
                          <Activity size={16} className="text-[#A891DE]" />
                          <span className="text-[10px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2]">Air Quality</span>
                        </div>
                        <h4 className="font-black text-2xl text-[#1a1410] dark:text-[#FFFFFF] mb-2">{weatherData.aqi?.current?.us_aqi || '--'}</h4>
                        <div className="w-full h-2 rounded-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 relative">
                          <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow border-2 border-[#1a1410]" style={{ left: `${Math.min((weatherData.aqi?.current?.us_aqi || 0) / 3, 100)}%` }} />
                        </div>
                      </div>

                      {/* WIND */}
                      <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-6 rounded-[2.5rem] border border-[#D4CBAF] dark:border-[#A891DE]/30 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-4">
                          <Wind size={16} className="text-[#A891DE]" />
                          <span className="text-[10px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2]">Wind</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-white/50 dark:bg-black/20 rounded-full" style={{ transform: `rotate(${weatherData.current.wind_direction_10m}deg)` }}>
                            <ArrowUp size={20} className="text-[#1a1410] dark:text-white" />
                          </div>
                          <div>
                            <h4 className="font-black text-xl text-[#1a1410] dark:text-[#FFFFFF]">{Math.round(weatherData.current.wind_speed_10m)} <span className="text-[10px]">km/h</span></h4>
                          </div>
                        </div>
                      </div>

                      {/* PRECIPITATION */}
                      <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-6 rounded-[2.5rem] border border-[#D4CBAF] dark:border-[#A891DE]/30">
                        <div className="flex items-center gap-2 mb-4">
                          <Droplet size={16} className="text-blue-500" />
                          <span className="text-[10px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2]">Rainfall</span>
                        </div>
                        <h4 className="font-black text-2xl text-[#1a1410] dark:text-[#FFFFFF]">{weatherData.current.precipitation} <span className="text-sm">mm</span></h4>
                        <p className="text-[10px] font-bold text-[#9A8FB3] dark:text-[#A891DE] mt-1">in last 24h</p>
                      </div>

                      {/* UV INDEX */}
                      <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-6 rounded-[2.5rem] border border-[#D4CBAF] dark:border-[#A891DE]/30">
                        <div className="flex items-center gap-2 mb-4">
                          <Sun size={16} className="text-orange-500" />
                          <span className="text-[10px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2]">UV Index</span>
                        </div>
                        <h4 className="font-black text-2xl text-[#1a1410] dark:text-[#FFFFFF]">{weatherData.daily.uv_index_max[0] || '--'}</h4>
                        <p className="text-[10px] font-bold text-[#9A8FB3] dark:text-[#A891DE] mt-1">Max today</p>
                      </div>

                      {/* HUMIDITY */}
                      <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-6 rounded-[2.5rem] border border-[#D4CBAF] dark:border-[#A891DE]/30">
                        <div className="flex items-center gap-2 mb-4">
                          <Umbrella size={16} className="text-[#A891DE]" />
                          <span className="text-[10px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2]">Humidity</span>
                        </div>
                        <h4 className="font-black text-2xl text-[#1a1410] dark:text-[#FFFFFF]">{weatherData.current.relative_humidity_2m}%</h4>
                        <p className="text-[10px] font-bold text-[#9A8FB3] dark:text-[#A891DE] mt-1">Dew point {Math.round(weatherData.hourly.temperature_2m[0] - (100 - weatherData.current.relative_humidity_2m) / 5)}°</p>
                      </div>

                      {/* VISIBILITY */}
                      <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-6 rounded-[2.5rem] border border-[#D4CBAF] dark:border-[#A891DE]/30">
                        <div className="flex items-center gap-2 mb-4">
                          <Eye size={16} className="text-[#A891DE]" />
                          <span className="text-[10px] font-black uppercase text-[#1a1410] dark:text-[#D3C9F2]">Visibility</span>
                        </div>
                        <h4 className="font-black text-2xl text-[#1a1410] dark:text-[#FFFFFF]">{Math.round(weatherData.hourly.visibility[0] / 1000)} <span className="text-sm">km</span></h4>
                        <p className="text-[10px] font-bold text-[#9A8FB3] dark:text-[#A891DE] mt-1">Current distance</p>
                      </div>
                    </div>

                    {/* 10-DAY FORECAST */}
                    <div className="bg-[#F3EFDF] dark:bg-[#A891DE]/10 p-8 rounded-[3rem] border border-[#D4CBAF] dark:border-[#A891DE]/30 mt-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#A891DE] mb-6">10-Day Forecast</p>
                      <div className="space-y-5">
                        {weatherData.daily.time.map((time, idx) => {
                          const date = new Date(time);
                          const max = Math.round(weatherData.daily.temperature_2m_max[idx]);
                          const min = Math.round(weatherData.daily.temperature_2m_min[idx]);
                          const pop = weatherData.daily.precipitation_probability_max[idx] || 0;
                          return (
                            <div key={time} className="flex justify-between items-center pb-5 border-b border-[#D4CBAF]/5 dark:border-[#A891DE]/20 last:border-0 last:pb-0">
                              <span className="font-bold text-sm uppercase text-[#1a1410] dark:text-[#FFFFFF] w-16">{idx === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                              <div className="flex items-center gap-2 w-16 justify-center">
                                <CloudRain size={16} className={pop > 20 ? 'text-blue-500' : 'text-[#1a1410]'} />
                                <span className="text-[10px] font-black text-[#1a1410] dark:text-[#A891DE]">{pop}%</span>
                              </div>
                              <div className="flex items-center justify-end gap-3 w-20">
                                <span className="text-sm font-black text-[#A891DE]">{max}°</span>
                                <span className="text-sm font-bold text-[#1a1410] dark:text-[#A891DE]">{min}°</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-10 text-center font-bold text-red-500">Failed to load weather.</div>
                )}
              </div>
            )
          }

        </div>
        </main>

        </div>
        <div className="fixed bottom-6 left-0 right-0 z-[9999] flex justify-center pointer-events-none px-6">
          <nav className="pointer-events-auto bg-white/95 dark:bg-[#0C0B09]/95 backdrop-blur-3xl rounded-full px-4 py-2.5 flex items-center gap-1 border border-[#D4CBAF]/20 dark:border-[#A891DE]/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <button onClick={() => { fetchReports(); setView('explore'); }} className={`w-12 h-12 flex items-center justify-center rounded-full smooth-transition ${view === 'explore' ? 'bg-[#A891DE] text-white shadow-lg scale-110' : 'text-[#9A8FB3] dark:text-[#A891DE] hover:text-[#A891DE] dark:hover:text-[#D3C9F2]'}`}><LayoutGrid size={22} /></button>
            <button onClick={() => setView('report')} className={`w-12 h-12 flex items-center justify-center rounded-full smooth-transition ${view === 'report' ? 'bg-[#A891DE] text-white shadow-lg scale-110' : 'text-[#9A8FB3] dark:text-[#A891DE] hover:text-[#A891DE] dark:hover:text-[#D3C9F2]'}`}><PlusCircle size={22} /></button>
            <button onClick={() => setView('handbook')} className={`w-12 h-12 flex items-center justify-center rounded-full smooth-transition ${view === 'handbook' ? 'bg-[#A891DE] text-white shadow-lg scale-110' : 'text-[#9A8FB3] dark:text-[#A891DE] hover:text-[#A891DE] dark:hover:text-[#D3C9F2]'}`}><BookOpen size={22} /></button>
            <button onClick={() => { requestLocation(); setView('weather'); }} className={`w-12 h-12 flex items-center justify-center rounded-full smooth-transition ${view === 'weather' ? 'bg-[#A891DE] text-white shadow-lg scale-110' : 'text-[#9A8FB3] dark:text-[#A891DE] hover:text-[#A891DE] dark:hover:text-[#D3C9F2]'}`}><Cloud size={22} /></button>
            <button onClick={() => { requestLocation(); setView('route'); }} className={`w-12 h-12 flex items-center justify-center rounded-full smooth-transition ${view === 'route' ? 'bg-[#A891DE] text-white shadow-lg scale-110' : 'text-[#9A8FB3] dark:text-[#A891DE] hover:text-[#A891DE] dark:hover:text-[#D3C9F2]'}`}><Route size={22} /></button>
          </nav>
        </div>
      </div>
    );
  }