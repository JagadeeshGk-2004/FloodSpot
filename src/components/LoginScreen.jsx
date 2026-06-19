import { useState } from 'react';
import { ShieldAlert, Loader } from 'lucide-react';

/**
 * LoginScreen — Authentication screen with login/register forms.
 */
export default function LoginScreen({ handleAuth, loading, isDark, authError, clearError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState(null);

  const onSubmit = async (type) => {
    const result = await handleAuth(type, email, password);
    if (result?.needsConfirmation) {
      setSuccessMsg('Account created! Check your email to confirm.');
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-1000 ${isDark ? 'bg-[#0C0B09]' : 'bg-[#F3EFDF]'}`}>
      <div className="w-full max-w-sm p-8 sm:p-10 rounded-[2rem] sm:rounded-[3rem] space-y-6 sm:space-y-8 glass-card smooth-transition animate-in fade-in zoom-in duration-1000">
        <div className="text-center space-y-3">
          <div className="bg-[#A891DE] w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] sm:rounded-[2.2rem] flex items-center justify-center mx-auto text-white shadow-[0_0_40px_rgba(168,145,222,0.4)]">
            <ShieldAlert size={36} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-[#1a1410] dark:text-[#FFFFFF] tracking-tighter uppercase italic">FloodSpot</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1a1410]/50 dark:text-white/40">Real-Time Flood Intelligence</p>
        </div>

        {/* Error Display */}
        {authError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <p className="text-[11px] font-bold text-red-500 text-center">{authError}</p>
          </div>
        )}

        {/* Success Message */}
        {successMsg && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <p className="text-[11px] font-bold text-green-500 text-center">{successMsg}</p>
          </div>
        )}

        <div className="space-y-3">
          <input
            id="login-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => { setEmail(e.target.value); clearError?.(); }}
            className="w-full p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-[#F3EFDF] dark:bg-white/5 border border-[#D4CBAF] dark:border-[#A891DE]/20 text-[#1a1410] dark:text-white placeholder-[#1a1410]/40 dark:placeholder-white/40 outline-none focus:border-[#A891DE] smooth-transition text-sm"
          />
          <input
            id="login-password"
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={e => { setPassword(e.target.value); clearError?.(); }}
            className="w-full p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-[#F3EFDF] dark:bg-white/5 border border-[#D4CBAF] dark:border-[#A891DE]/20 text-[#1a1410] dark:text-white placeholder-[#1a1410]/40 dark:placeholder-white/40 outline-none focus:border-[#A891DE] smooth-transition text-sm"
          />
        </div>

        <div className="space-y-3">
          <button
            id="login-submit"
            onClick={() => onSubmit('login')}
            disabled={loading}
            className="w-full py-4 sm:py-5 bg-[#A891DE] text-white font-black rounded-2xl sm:rounded-3xl shadow-xl hover:brightness-110 active:scale-95 smooth-transition uppercase tracking-widest text-xs sm:text-sm"
          >
            {loading ? <Loader className="animate-spin mx-auto" size={20} /> : 'Login'}
          </button>
          <button
            id="register-submit"
            onClick={() => onSubmit('signup')}
            disabled={loading}
            className="w-full py-4 sm:py-5 border-2 border-[#A891DE] text-[#A891DE] font-black rounded-2xl sm:rounded-3xl hover:bg-[#A891DE] hover:text-white active:scale-95 smooth-transition uppercase tracking-widest text-xs sm:text-sm"
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
}
