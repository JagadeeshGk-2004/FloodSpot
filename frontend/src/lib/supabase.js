import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Supabase client initialization using import.meta.env.VITE_SUPABASE_URL
 * and import.meta.env.VITE_SUPABASE_ANON_KEY.
 */
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const MOCK_FLOOD_REPORTS = [];

/**
 * Fetch all flood reports from Supabase / API backend.
 * Returns genuine user-submitted reports or empty array.
 */
export async function fetchFloodReports() {
  if (!supabase) {
    try {
      const apiRes = await fetch('http://localhost:8000/api/reports');
      if (apiRes.ok) {
        const reports = await apiRes.json();
        return reports || [];
      }
    } catch {
      // API unreachable
    }
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('flood_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data;
  } catch (err) {
    console.error('[FloodSpot] Error reading flood_reports:', err);
    return [];
  }
}

/**
 * Insert a new flood report into Supabase `flood_reports`.
 */
export async function createFloodReport(newReport) {
  if (!supabase) {
    console.warn('[FloodSpot] Supabase offline, saving report locally for session.');
    return {
      ...newReport,
      id: `local-${Date.now()}`,
      created_at: new Date().toISOString()
    };
  }

  try {
    const { data, error } = await supabase
      .from('flood_reports')
      .insert([newReport])
      .select();

    if (error) {
      console.warn('[FloodSpot] Failed to insert into Supabase table:', error.message);
      return {
        ...newReport,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString()
      };
    }

    return data ? data[0] : newReport;
  } catch (err) {
    console.error('[FloodSpot] Error creating report in Supabase:', err);
    return {
      ...newReport,
      id: `local-${Date.now()}`,
      created_at: new Date().toISOString()
    };
  }
}

/**
 * Vote on a flood report (upvote or downvote).
 */
export async function voteFloodReport(reportId, voteType) {
  try {
    const res = await fetch(`http://localhost:8000/api/reports/${reportId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote_type: voteType })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[Vote] API notice:', err);
  }
  return { id: reportId, vote_type: voteType };
}

// ============================================================================
// SUPABASE AUTHENTICATION & PROFILE UTILITIES
// ============================================================================

/**
 * Registers a new user with Supabase Auth and creates a matching record in public.profiles.
 * 
 * @param {string} email 
 * @param {string} password 
 * @param {string} fullName 
 * @returns {Promise<{ user: Object, session: Object, profile: Object }>}
 */
export async function signUpUser(email, password, fullName) {
  if (!supabase) {
    throw new Error('Supabase client is not configured. Please check your environment variables.');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (error) {
    throw error;
  }

  const user = data.user;
  let profile = null;

  if (user) {
    // Automatically create or update matching entry in public.profiles table
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .upsert([
          {
            id: user.id,
            email: email,
            full_name: fullName
          }
        ])
        .select()
        .single();

      if (profileError) {
        console.warn('[FloodSpot Auth] Profile table upsert notice:', profileError.message);
      } else {
        profile = profileData;
      }
    } catch (err) {
      console.warn('[FloodSpot Auth] Profiles table error during registration:', err);
    }
  }

  return {
    user,
    session: data.session,
    profile: profile || { id: user?.id, email, full_name: fullName }
  };
}

/**
 * Authenticates user with email and password, handling rememberMe session persistence.
 * 
 * @param {string} email 
 * @param {string} password 
 * @param {boolean} rememberMe 
 * @returns {Promise<{ user: Object, session: Object, profile: Object }>}
 */
export async function signInUser(email, password, rememberMe = true) {
  if (!supabase) {
    throw new Error('Supabase client is not configured. Please check your environment variables.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw error;
  }

  // Handle session persistence configuration
  if (typeof window !== 'undefined') {
    if (rememberMe) {
      localStorage.setItem('floodspot_remember', 'true');
    } else {
      localStorage.setItem('floodspot_remember', 'false');
    }
    sessionStorage.setItem('floodspot_session_active', 'true');
  }

  // Fetch complete profile details
  const fullUser = await getCurrentUser();

  return {
    user: data.user,
    session: data.session,
    profile: fullUser?.profile || { id: data.user.id, email: data.user.email, full_name: data.user.user_metadata?.full_name || email.split('@')[0] }
  };
}

/**
 * Signs out the active user and clears local auth session state flags.
 * 
 * @returns {Promise<void>}
 */
export async function signOutUser() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('floodspot_remember');
    sessionStorage.removeItem('floodspot_session_active');
  }

  if (!supabase) return;

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn('[FloodSpot Auth] Sign out error:', error.message);
    }
  } catch (err) {
    console.error('[FloodSpot Auth] Error signing out:', err);
  }
}

/**
 * Fetches the current active user and associated profile data.
 * Gracefully handles offline auth checking and rememberMe session expiration.
 * 
 * @returns {Promise<{ id: string, email: string, full_name: string, profile: Object }|null>}
 */
export async function getCurrentUser() {
  if (!supabase) return null;

  try {
    // Session memory check for rememberMe = false
    if (typeof window !== 'undefined') {
      const rememberFlag = localStorage.getItem('floodspot_remember');
      const sessionActive = sessionStorage.getItem('floodspot_session_active');

      if (rememberFlag === 'false' && !sessionActive) {
        console.log('[FloodSpot Auth] Session memory expired (rememberMe was false). Signing out...');
        await signOutUser();
        return null;
      }
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    // Try fetching user profile from public.profiles table
    let profileData = null;
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profileError && profile) {
        profileData = profile;
      }
    } catch {
      // Ignore profile lookup error
    }

    const fullName = profileData?.full_name || 
                     user.user_metadata?.full_name || 
                     user.email?.split('@')[0] || 
                     'User';

    return {
      id: user.id,
      email: user.email,
      full_name: fullName,
      user_metadata: user.user_metadata,
      profile: profileData || { id: user.id, email: user.email, full_name: fullName }
    };
  } catch (err) {
    console.warn('[FloodSpot Auth] Offline or error fetching current user:', err);
    return null;
  }
}

/**
 * Subscribes to Supabase authentication state changes.
 * 
 * @param {Function} callback (event, session) => void
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
  if (!supabase) {
    return () => {};
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (callback) {
      callback(event, session);
    }
  });

  return () => {
    subscription?.unsubscribe();
  };
}

