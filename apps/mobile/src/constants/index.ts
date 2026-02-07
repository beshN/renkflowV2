// API Configuration
export const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000/api/v1' 
  : 'https://your-production-url.com/api/v1';

// Colors (Premium Design System)
export const Colors = {
  // Primary
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  
  // Accent
  accent: '#f43f5e',
  accentLight: '#fb7185',
  
  // Background
  background: '#0f172a',
  backgroundLight: '#1e293b',
  backgroundCard: '#1e293b',
  
  // Surface
  surface: '#334155',
  surfaceLight: '#475569',
  
  // Text
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  
  // Border
  border: '#334155',
  borderLight: '#475569',
  
  // Status Colors
  success: '#22c55e',
  successLight: '#4ade80',
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  error: '#ef4444',
  errorLight: '#f87171',
  info: '#3b82f6',
  infoLight: '#60a5fa',
  
  // Order Status
  pending: '#f59e0b',
  pendingBg: 'rgba(245, 158, 11, 0.15)',
  in_production: '#3b82f6',
  in_productionBg: 'rgba(59, 130, 246, 0.15)',
  delivered: '#22c55e',
  deliveredBg: 'rgba(34, 197, 94, 0.15)',
  
  // Gradients
  gradientStart: '#6366f1',
  gradientEnd: '#8b5cf6',
};

// Status labels
export const StatusLabels: Record<string, string> = {
  pending: 'Beklemede',
  in_production: 'Üretimde',
  delivered: 'Teslim Edildi',
};

// Status colors with backgrounds
export const StatusColors: Record<string, { color: string; bg: string; icon: string }> = {
  pending: { 
    color: Colors.pending, 
    bg: Colors.pendingBg,
    icon: 'time-outline'
  },
  in_production: { 
    color: Colors.in_production, 
    bg: Colors.in_productionBg,
    icon: 'construct-outline'
  },
  delivered: { 
    color: Colors.delivered, 
    bg: Colors.deliveredBg,
    icon: 'checkmark-circle-outline'
  },
};

// Shadows
export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
};

// Spacing
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border Radius
export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
