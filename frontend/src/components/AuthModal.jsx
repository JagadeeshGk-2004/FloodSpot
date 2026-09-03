import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  LogIn, 
  UserPlus, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck 
} from 'lucide-react';
import { signInUser, signUpUser } from '../lib/supabase';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, onShowToast }) {
  const [activeTab, setActiveTab] = useState('signin'); // 'signin' | 'register'

  // Form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Status state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setConfirmPassword('');
    setErrorMsg('');
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setErrorMsg('');
  };

  // Sign In Handler
  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const authResult = await signInUser(email.trim(), password, rememberMe);
      
      if (onShowToast) {
        onShowToast(`Welcome back, ${authResult.profile?.full_name || 'User'}!`, 'success');
      }

      if (onAuthSuccess) {
        onAuthSuccess(authResult);
      }

      resetForm();
      onClose();
    } catch (err) {
      console.warn('[AuthModal] Sign in error:', err);
      const msg = err.message || 'Failed to sign in. Please check your credentials.';
      if (msg.includes('Invalid login credentials')) {
        setErrorMsg('Invalid email or password. Please try again.');
      } else if (msg.includes('Email not confirmed')) {
        setErrorMsg('Please confirm your email address before signing in.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Register Handler
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fullName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const authResult = await signUpUser(email.trim(), password, fullName.trim());

      if (onShowToast) {
        onShowToast('Account registered successfully!', 'success');
      }

      if (onAuthSuccess) {
        onAuthSuccess(authResult);
      }

      resetForm();
      onClose();
    } catch (err) {
      console.warn('[AuthModal] Register error:', err);
      const msg = err.message || 'Failed to create account. Please try again.';
      if (msg.includes('User already registered') || msg.includes('already in use')) {
        setErrorMsg('An account with this email already exists.');
      } else if (msg.includes('Password should be')) {
        setErrorMsg('Password is too weak. Please use at least 6 characters.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all duration-300">
      <div className="relative w-full max-w-md glass-panel bg-[#111827] rounded-3xl border border-[#1E293B] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="glass-panel bg-[#111827] border-b border-[#1E293B] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/20 border border-[#38BDF8]/40 flex items-center justify-center text-[#38BDF8]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#F8FAFC] font-['Outfit']">
                FloodSpot Account
              </h3>
              <p className="text-[11px] text-[#94A3B8]">Sync reports & P2P alerts across devices</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); onClose(); }}
            className="p-1.5 rounded-full hover:bg-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#1E293B] bg-[#090D16]/50 p-1">
          <button
            type="button"
            onClick={() => handleTabSwitch('signin')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'signin'
                ? 'bg-[#38BDF8] text-slate-950 shadow-md'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]/40'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('register')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'register'
                ? 'bg-[#38BDF8] text-slate-950 shadow-md'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]/40'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-red-950/80 border border-[#EF4444]/60 text-red-200 text-xs flex items-start gap-2.5 animate-in slide-in-from-top duration-200">
              <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* SIGN IN TAB */}
          {activeTab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-[#94A3B8] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#38BDF8]" />
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full glass-input bg-[#111827] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-[#F8FAFC] placeholder-[#64748B] focus:border-[#38BDF8] focus:outline-none transition-colors"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-[#94A3B8] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#38BDF8]" />
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full glass-input bg-[#111827] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-[#F8FAFC] placeholder-[#64748B] focus:border-[#38BDF8] focus:outline-none transition-colors"
                  required
                />
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#090D16] border-[#1E293B] text-[#38BDF8] focus:ring-[#38BDF8]/30 cursor-pointer accent-[#38BDF8]"
                  />
                  <span className="text-xs text-[#94A3B8] font-medium">Remember me on this device</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-4 w-full py-3 px-4 bg-[#38BDF8] hover:bg-sky-400 text-slate-950 font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* CREATE ACCOUNT TAB */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-[#94A3B8] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#38BDF8]" />
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full glass-input bg-[#111827] border border-[#1E293B] rounded-xl px-3.5 py-2 text-[#F8FAFC] placeholder-[#64748B] focus:border-[#38BDF8] focus:outline-none transition-colors"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#94A3B8] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#38BDF8]" />
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full glass-input bg-[#111827] border border-[#1E293B] rounded-xl px-3.5 py-2 text-[#F8FAFC] placeholder-[#64748B] focus:border-[#38BDF8] focus:outline-none transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-[#94A3B8] flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-[#38BDF8]" />
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Min 6 chars"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full glass-input bg-[#111827] border border-[#1E293B] rounded-xl px-3 py-2 text-[#F8FAFC] placeholder-[#64748B] focus:border-[#38BDF8] focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#94A3B8] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#38BDF8]" />
                    Confirm
                  </label>
                  <input
                    type="password"
                    placeholder="Re-enter"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full glass-input bg-[#111827] border border-[#1E293B] rounded-xl px-3 py-2 text-[#F8FAFC] placeholder-[#64748B] focus:border-[#38BDF8] focus:outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-4 w-full py-3 px-4 bg-[#10B981] hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Register Account</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
