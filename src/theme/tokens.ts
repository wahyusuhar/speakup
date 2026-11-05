// Design tokens (colors, type, spacing, radii). Source: doc/design/ (call screen).
// Every screen should take its colors and sizes from here so the app stays consistent.

export const colors = {
  // Surfaces
  bg: '#070C1B',
  headerBg: '#0A1126',
  card: '#0F172E',
  cardHeader: '#0B1328',
  inset: '#0A1022',
  bubbleTutor: '#162244',
  bubbleUser: '#2563EB',
  chip: '#1E293B',
  chipPressed: '#334155',

  // Lines
  border: '#1E2B4D',
  borderSubtle: 'rgba(51, 65, 85, 0.6)',

  // Brand
  primary: '#06D6A0',
  primarySoft: 'rgba(6, 214, 160, 0.12)',
  primaryBorder: 'rgba(6, 214, 160, 0.3)',
  glow: '#00F5B4',
  cyan: '#00E5FF',
  emerald: '#34D399',
  callStart: '#059669',
  callStartBorder: 'rgba(52, 211, 153, 0.4)',
  onPrimary: '#04121F',

  // Text
  textStrong: '#FFFFFF',
  text: '#F1F5F9',
  textSoft: '#CBD5E1',
  textMuted: '#94A3B8',
  textDim: '#64748B',
  userName: '#38BDF8',
  /** English words being taught, inside tutor bubbles. */
  english: '#00F5B4',

  // States
  danger: '#F43F5E',
  dangerSolid: '#E11D48',
  dangerSoft: 'rgba(244, 63, 94, 0.2)',
  dangerBorder: 'rgba(244, 63, 94, 0.3)',
  dangerText: '#FB7185',
  warning: '#FDE68A',
  errorBg: 'rgba(127, 29, 29, 0.85)',
  errorText: '#FECACA',
} as const;

/** Families registered in app/_layout.tsx via @expo-google-fonts/plus-jakarta-sans. */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
  mono: 'monospace',
} as const;

export const fontSize = {
  xxs: 10,
  xs: 11,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 36,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  pill: 999,
} as const;

/** Width at which screens switch from one column (phone) to two columns (desktop). */
export const breakpoints = {
  wide: 900,
  /** Below this window height, wide layouts use compact spacing. */
  shortHeight: 860,
} as const;

export const layout = {
  maxContentWidth: 1280,
} as const;

/** CSS box-shadow strings (supported on web and on Android with the new architecture). */
export const shadows = {
  card: '0 20px 40px -12px rgba(0, 0, 0, 0.6)',
  glow: '0 0 30px 0 rgba(6, 214, 160, 0.45), 0 0 50px -6px rgba(0, 229, 255, 0.3)',
  glowStrong: '0 0 45px 6px rgba(6, 214, 160, 0.6), 0 0 70px 0 rgba(0, 229, 255, 0.35)',
  userBubble: '0 8px 20px -8px rgba(37, 99, 235, 0.6)',
  callButton: '0 10px 24px -8px rgba(6, 214, 160, 0.45)',
} as const;
