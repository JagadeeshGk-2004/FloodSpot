import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../db.js';

/**
 * useAuth — Manages Supabase authentication lifecycle.
 * Handles session restore, login, signup, signout, and error messaging.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Restore session + listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUser(session.user);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const clearError = useCallback(() => setAuthError(null), []);

  const handleAuth = useCallback(async (type, email, password) => {
    if (!email || !password) {
      setAuthError('Email and password are required.');
      return { success: false };
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAuthError('Please enter a valid email address.');
      return { success: false };
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return { success: false };
    }

    setLoading(true);
    setAuthError(null);

    try {
      if (type === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setUser(data.user);
        return { success: true };
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Check if email confirmation is required
        if (data.user && !data.session) {
          return { success: true, needsConfirmation: true };
        }
        return { success: true };
      }
    } catch (err) {
      let message = err.message;
      // Provide user-friendly error messages
      if (message.includes('Invalid login credentials')) {
        message = 'Invalid email or password. Please try again.';
      } else if (message.includes('User already registered')) {
        message = 'This email is already registered. Try logging in.';
      } else if (message.includes('Email not confirmed')) {
        message = 'Please check your email and confirm your account.';
      } else if (message.includes('rate limit') || message.includes('too many')) {
        message = 'Too many attempts. Please wait a moment.';
      }
      setAuthError(message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return {
    user,
    loading,
    authReady,
    authError,
    clearError,
    handleAuth,
    signOut,
  };
}
