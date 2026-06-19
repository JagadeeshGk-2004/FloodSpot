import { useState, useEffect } from 'react';
import { Phone, MessageSquare, Copy, Check, X, UserCheck, AlertTriangle, ChevronRight, Wifi, WifiOff } from 'lucide-react';

const LS_KEY = 'floodspot_sos_contacts';
const HELPLINE = '1913';

const SMS_TEMPLATES = [
  { id: 't1', label: "Safe — Need Assistance", icon: UserCheck, color: '#22c55e', text: (lat, lng) => `SAFE BUT STUCK. GPS:${lat},${lng} Cannot move, need help. -FloodSpot` },
  { id: 't2', label: "Water Rising — SOS",     icon: AlertTriangle, color: '#ef4444', text: (lat, lng) => `SOS WATER RISING. GPS:${lat},${lng} Need immediate rescue. -FloodSpot` },
  { id: 't3', label: "Medical Emergency",       icon: Phone, color: '#f59e0b', text: (lat, lng) => `MEDICAL EMERGENCY. GPS:${lat},${lng} Urgent help needed. -FloodSpot` },
];

function useSosContacts() {
  const [contacts, setContacts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
  });
  const save = (list) => { setContacts(list); localStorage.setItem(LS_KEY, JSON.stringify(list)); };
  return [contacts, save];
}

/* ─────────────────────────────────────────
   CrisisCommandPanel
   ───────────────────────────────────────── */
export function CrisisCommandPanel({ coords, onExit }) {
  const [contacts, saveContacts] = useSosContacts();
  const [editingIdx, setEditingIdx] = useState(null);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const lat = coords?.latitude?.toFixed(6) ?? '—';
  const lng = coords?.longitude?.toFixed(6) ?? '—';

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const copyCoords = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(`${lat}, ${lng}`).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const sendSms = (tmpl) => {
    const nums = contacts.filter(Boolean).join(',');
    if (!nums) { alert('Add at least one emergency contact first.'); return; }
    window.location.assign(`sms:${nums}?body=${encodeURIComponent(tmpl.text(lat, lng))}`);
  };

  const saveContact = (idx) => {
    const list = [...contacts];
    list[idx] = draft.trim();
    saveContacts(list.filter(Boolean));
    setEditingIdx(null); setDraft('');
  };

  const removeContact = (idx) => {
    const list = [...contacts]; list.splice(idx, 1); saveContacts(list);
  };

  return (
    <div className="fixed inset-0 z-[5000] overflow-y-auto" style={{ background: '#000', WebkitOverflowScrolling: 'touch' }}>

      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-6 pt-14 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-[#39FF14]/60">Active</span>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">Crisis Command</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={onExit}
            className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95"
          >
            <X size={14} strokeWidth={3} /> Exit
          </button>
          <div className="flex items-center gap-1.5">
            {isOnline ? <Wifi size={11} className="text-[#39FF14]" /> : <WifiOff size={11} className="text-red-500" />}
            <span className={`text-[9px] font-black uppercase tracking-widest ${isOnline ? 'text-[#39FF14]' : 'text-red-500'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-36 space-y-4">

        {/* ── GPS CARD ── */}
        <div className="rounded-3xl p-6" style={{ background: 'rgba(57,255,20,0.08)', border: '1.5px solid rgba(57,255,20,0.25)' }}>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#39FF14]/60 mb-3">Live GPS Coordinates</p>
          <p className="font-mono font-black text-[#39FF14] mb-1" style={{ fontSize: '1.5rem', lineHeight: 1.2 }}>{lat}</p>
          <p className="font-mono font-black text-[#39FF14]" style={{ fontSize: '1.5rem', lineHeight: 1.2 }}>{lng}</p>
          <button
            onClick={copyCoords}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95"
            style={{ background: copied ? 'rgba(57,255,20,0.2)' : 'rgba(255,255,255,0.07)', color: copied ? '#39FF14' : 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied to clipboard!' : 'Copy coordinates'}
          </button>
        </div>

        {/* ── SPEED DIAL ── */}
        <a
          href={`tel:${HELPLINE}`}
          className="flex items-center justify-between rounded-3xl p-6 active:scale-[0.98] smooth-transition"
          style={{ background: 'rgba(57,255,20,0.1)', border: '1.5px solid rgba(57,255,20,0.35)' }}
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#39FF14]/60 mb-2">Chennai Flood Helpline</p>
            <p className="font-black text-white" style={{ fontSize: '3.5rem', lineHeight: 1, letterSpacing: '-0.04em' }}>{HELPLINE}</p>
            <p className="text-xs text-white/40 mt-2 font-semibold">Tap to call · No internet required</p>
          </div>
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-[#39FF14] opacity-25 animate-ping" />
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#39FF14', boxShadow: '0 0 30px rgba(57,255,20,0.5)' }}>
              <Phone size={26} strokeWidth={2.5} style={{ color: '#000' }} />
            </div>
          </div>
        </a>

        {/* ── EMERGENCY CONTACTS ── */}
        <div className="rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-white/40 px-6 pt-5 pb-4">Emergency Contacts (max 3)</p>
          {Array.from({ length: 3 }).map((_, i) => {
            const num = contacts[i];
            const isEditing = editingIdx === i;
            return (
              <div key={i} className="border-t border-white/5">
                {isEditing ? (
                  <div className="flex items-center gap-3 px-5 py-4">
                    <input
                      autoFocus type="tel" inputMode="tel" value={draft}
                      onChange={e => setDraft(e.target.value)}
                      placeholder="Enter mobile number"
                      className="flex-1 bg-transparent text-white text-base font-mono outline-none placeholder-white/20"
                    />
                    <button onClick={() => saveContact(i)} className="text-[#39FF14] text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl" style={{ background: 'rgba(57,255,20,0.15)', border: '1px solid rgba(57,255,20,0.3)' }}>Save</button>
                    <button onClick={() => setEditingIdx(null)} className="text-white/30 px-2 text-lg">✕</button>
                  </div>
                ) : num ? (
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-[#39FF14] shrink-0" />
                      <span className="font-mono text-base text-white">{num}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button onClick={() => { setDraft(num); setEditingIdx(i); }} className="text-white/30 text-xs font-bold uppercase tracking-widest">Edit</button>
                      <button onClick={() => removeContact(i)} className="text-red-500/50 text-base">✕</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setDraft(''); setEditingIdx(i); }} className="w-full flex items-center gap-3 px-6 py-4 text-left active:bg-white/5">
                    <span className="w-2 h-2 rounded-full border border-white/20 shrink-0" />
                    <span className="text-sm font-bold text-white/25">Add contact {i + 1}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── SMS TEMPLATES ── */}
        <div className="rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
          <div className="px-6 pt-5 pb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-white/40 flex items-center gap-2">
              <MessageSquare size={11} /> Send Status via SMS
            </p>
            <p className="text-xs text-white/25 mt-1.5">Your GPS is auto-included. No internet needed.</p>
          </div>
          {SMS_TEMPLATES.map(tmpl => {
            const Icon = tmpl.icon;
            return (
              <button
                key={tmpl.id}
                onClick={() => sendSms(tmpl)}
                className="w-full flex items-center justify-between px-5 py-4 border-t border-white/5 active:bg-white/5 smooth-transition"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${tmpl.color}18`, border: `1px solid ${tmpl.color}35` }}>
                    <Icon size={18} style={{ color: tmpl.color }} />
                  </div>
                  <span className="text-sm font-black uppercase tracking-widest text-white/90">{tmpl.label}</span>
                </div>
                <ChevronRight size={16} className="text-white/20 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   CrisisCommandToggle  (sidebar)
   Mirrors the exact same pill pattern as the
   existing working theme toggle in App.jsx
───────────────────────────────────────── */
export function CrisisCommandToggle({ isOn, onToggle, isDark }) {
  return (
    <div className="space-y-4">
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-800 dark:text-white/50 ml-2">Crisis Command</p>
      <div
        onClick={onToggle}
        className={`w-full h-16 rounded-[2.5rem] p-2 cursor-pointer relative flex items-center border smooth-transition ${
          isOn
            ? 'bg-[#39FF14]/10 border-[#39FF14]/40'
            : isDark ? 'bg-[#8B72C7]/10 border-[#8B72C7]/30' : 'bg-slate-200 border-slate-300'
        }`}
      >
        {/* Text labels sit on top of the sliding pill */}
        <div className="flex items-center justify-around w-full z-10 font-black text-[11px] uppercase tracking-widest">
          <span className={`smooth-transition ${isOn ? 'text-black' : isDark ? 'text-[#8B72C7]' : 'text-slate-800'}`}>
            Active
          </span>
          <span className={`smooth-transition ${!isOn ? 'text-white' : isDark ? 'text-[#8B72C7]' : 'text-slate-800'}`}>
            Off
          </span>
        </div>
        {/* Sliding pill — same positioning logic as theme toggle */}
        <div
          className={`absolute w-[47%] h-[82%] rounded-[2rem] smooth-transition ${
            isOn ? 'bg-[#39FF14] translate-x-0 shadow-[0_0_14px_rgba(57,255,20,0.45)]' : 'bg-[#5D5CDE] translate-x-[105%]'
          }`}
        />
      </div>
    </div>
  );
}
