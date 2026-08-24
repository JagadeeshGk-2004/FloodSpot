export const COLORS = {
  // Dark Background Palette (Mirroring Web 1:1)
  bgDarkest: '#020617',
  bgDark: '#090D16',
  bgCard: '#0F172A',
  bgCardHover: '#1E293B',
  bgGlass: 'rgba(15, 23, 42, 0.85)',
  bgGlassCard: 'rgba(30, 41, 59, 0.75)',
  bgGlassInput: 'rgba(15, 23, 42, 0.7)',
  
  // Accents & Glows
  cyberBlue: '#06B6D4',
  skyBlue: '#38BDF8',
  primary: '#0284C7',
  indigoAccent: '#6366F1',
  accentGlow: 'rgba(56, 189, 248, 0.3)',
  
  // Alert & Severity Colors
  danger: '#EF4444',       // Critical Flood / SOS
  dangerDark: '#991B1B',
  dangerGlow: 'rgba(239, 68, 68, 0.4)',
  highOrange: '#F97316',   // High Risk
  mediumYellow: '#F59E0B', // Moderate Risk
  lowBlue: '#3B82F6',      // Low Water
  safeGreen: '#10B981',    // Emerald Verified Safe
  safeGreenDark: '#065F46',
  
  // Text Colors
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#64748B',
  
  // Borders & Dividers
  borderGlass: 'rgba(255, 255, 255, 0.12)',
  borderLight: 'rgba(255, 255, 255, 0.18)',
  borderActive: '#38BDF8',
  
  // Gradients
  gradientStart: '#0F172A',
  gradientEnd: '#090D16',
};

export const GLASS_STYLE = {
  backgroundColor: COLORS.bgGlassCard,
  borderColor: COLORS.borderGlass,
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
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  }
};

