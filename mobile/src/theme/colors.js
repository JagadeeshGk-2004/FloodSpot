export const COLORS = {
  // Midnight Hydro Theme Specification
  background: '#090D16',
  card: '#111827',
  elevated: '#1E293B',
  border: '#1E293B',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  emerald: '#10B981',
  crimson: '#EF4444',
  accent: '#38BDF8',
  warning: '#F59E0B',

  // Mirror & Compatibility Aliases
  bgDarkest: '#090D16',
  bgDark: '#090D16',
  bgCard: '#111827',
  bgCardHover: '#1E293B',
  bgGlass: 'rgba(17, 24, 39, 0.92)',
  bgGlassCard: 'rgba(17, 24, 39, 0.88)',
  bgGlassInput: '#111827',
  
  // Accents & State Highlights
  cyberBlue: '#38BDF8',
  skyBlue: '#38BDF8',
  primary: '#10B981',
  indigoAccent: '#38BDF8',
  accentGlow: 'rgba(56, 189, 248, 0.3)',
  
  // Alert & Severity Colors
  danger: '#EF4444',       // Critical Flood / SOS
  dangerDark: '#991B1B',
  dangerGlow: 'rgba(239, 68, 68, 0.4)',
  highOrange: '#F97316',   // High Risk
  mediumYellow: '#F59E0B', // Warning / Moderate Risk
  lowBlue: '#38BDF8',      // Low Water
  safeGreen: '#10B981',    // Emerald Safe
  safeGreenDark: '#065F46',
  
  // Text Palette
  textPrimary: '#F8FAFC',
  textMuted: '#94A3B8',
  placeholder: '#64748B',
  
  // Borders & Dividers
  borderGlass: '#1E293B',
  borderLight: '#1E293B',
  borderActive: '#38BDF8',
  
  // Gradients
  gradientStart: '#111827',
  gradientEnd: '#090D16',
};

export const GLASS_STYLE = {
  backgroundColor: COLORS.card,
  borderColor: COLORS.border,
  borderWidth: 1,
  borderRadius: 20,
};

export const SHADOWS = {
  glow: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  dangerGlow: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  }
};

