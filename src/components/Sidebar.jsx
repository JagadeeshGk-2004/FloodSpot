import { Settings, X, Sun, Moon, Volume2, Zap, LogOut } from 'lucide-react';
import { CrisisCommandToggle } from '../EmergencyMode.jsx';

/**
 * Sidebar — Settings drawer with theme toggle, emergency tools, crisis mode, sign-out.
 */
export default function Sidebar({
  isOpen,
  onClose,
  isDark,
  setIsDark,
  isSirenPlaying,
  setIsSirenPlaying,
  isFlashing,
  setIsFlashing,
  isEmergencyMode,
  setIsEmergencyMode,
  onSignOut,
}) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] animate-in fade-in duration-500"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={`fixed top-0 left-0 bottom-0 w-72 sm:w-80 glass-card z-[3001] transform smooth-transition p-6 sm:p-10 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex justify-between items-center mb-10 sm:mb-16 text-[#1a1410] dark:text-[#FFFFFF]">
          <div className="flex items-center gap-3">
            <Settings size={20} />
            <h2 className="font-black text-xl sm:text-2xl tracking-tighter uppercase">Settings</h2>
          </div>
          <button onClick={onClose} className="hover:rotate-90 smooth-transition p-1">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-8 sm:space-y-10 flex-1 overflow-y-auto pb-6 scrollbar-hide">
          {/* Theme Toggle */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1a1410] dark:text-white/50 ml-2">Theme</p>
            <div
              onClick={() => setIsDark(!isDark)}
              className="w-full h-14 sm:h-16 bg-[#F3EFDF] dark:bg-[#A891DE]/10 rounded-[2rem] sm:rounded-[2.5rem] p-2 cursor-pointer relative flex items-center border border-[#D4CBAF] dark:border-[#A891DE]/30"
            >
              <div className="flex items-center justify-around w-full z-10 font-black text-[10px] sm:text-[11px] uppercase tracking-widest">
                <div className={`flex items-center gap-2 smooth-transition ${!isDark ? 'text-white' : 'text-[#1a1410] dark:text-[#A891DE]'}`}>
                  <Sun size={16} /> Light
                </div>
                <div className={`flex items-center gap-2 smooth-transition ${isDark ? 'text-white' : 'text-[#1a1410] dark:text-[#A891DE]'}`}>
                  <Moon size={16} /> Dark
                </div>
              </div>
              <div className={`absolute w-[47%] h-[82%] bg-[#A891DE] rounded-[1.5rem] sm:rounded-[2rem] smooth-transition ${isDark ? 'translate-x-[105%]' : 'translate-x-0'}`} />
            </div>
          </div>

          {/* Emergency Tools */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1a1410] dark:text-white/50 ml-2">Emergency Tools</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                id="siren-toggle"
                onClick={() => setIsSirenPlaying(!isSirenPlaying)}
                className={`p-3 sm:p-4 rounded-2xl sm:rounded-3xl border flex flex-col items-center gap-2 smooth-transition ${
                  isSirenPlaying
                    ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                    : 'bg-[#F3EFDF] dark:bg-[#A891DE]/10 border-[#D4CBAF] dark:border-[#A891DE]/30 text-[#1a1410] dark:text-[#D3C9F2]'
                }`}
              >
                <Volume2 size={22} className={isSirenPlaying ? 'animate-pulse' : ''} />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">{isSirenPlaying ? 'Siren On' : 'Siren'}</span>
              </button>
              <button
                id="beacon-toggle"
                onClick={() => setIsFlashing(!isFlashing)}
                className={`p-3 sm:p-4 rounded-2xl sm:rounded-3xl border flex flex-col items-center gap-2 smooth-transition ${
                  isFlashing
                    ? 'bg-white border-white text-red-500 shadow-[0_0_30px_rgba(255,255,255,0.8)]'
                    : 'bg-[#F3EFDF] dark:bg-[#A891DE]/10 border-[#D4CBAF] dark:border-[#A891DE]/30 text-[#1a1410] dark:text-[#D3C9F2]'
                }`}
              >
                <Zap size={22} className={isFlashing ? 'animate-pulse' : ''} />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">{isFlashing ? 'Beacon On' : 'Beacon'}</span>
              </button>
            </div>
          </div>

          {/* Crisis Command Toggle */}
          <CrisisCommandToggle
            isOn={isEmergencyMode}
            onToggle={() => { setIsEmergencyMode(v => !v); onClose(); }}
            isDark={isDark}
          />

          {/* Sign Out */}
          <button
            id="sign-out"
            onClick={onSignOut}
            className="w-full p-4 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center gap-3 text-red-500 hover:bg-red-500/10 smooth-transition font-bold uppercase text-xs tracking-widest mt-4"
          >
            <LogOut size={18} />Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
