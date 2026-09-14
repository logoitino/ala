import { Platform, type ViewStyle } from 'react-native';

import { FOCAL } from '@/theme/motion';

export const palette = {
  /** Light canvas the app ships with. */
  daylight: FOCAL.backgroundBase,
  midnightObsidian: FOCAL.videoBase,
  neonJade: FOCAL.neonJade,
  jadeInk: FOCAL.jadeInk,
  electricGold: FOCAL.electricGold,
  slateCharcoal: '#1E262B',
};

export type ThemeColors = {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryMuted: string;
  deepGreen: string;
  accent: string;
  accentSoft: string;
  gold: string;
  electricGold: string;
  /** Neon jade reserved for glows, progress fills, and chrome over video. */
  glow: string;
  night: string;
  onAccent: string;
  photoPlaceholder: string;
  success: string;
  danger: string;
  /** Chrome that stays dark in any mode: Reel scrims, Spotlight cards, video sheets. */
  videoSurface: string;
  videoScrim: string;
  videoScrimSoft: string;
  onVideo: string;
  onVideoMuted: string;
  /** Full-screen modal backdrop. */
  backdrop: string;
};

/** Default mode: Daylight. Jade stays the accent; jade-on-light text uses `jadeInk`. */
export const LIGHT_COLORS: ThemeColors = {
  background: palette.daylight,
  surface: '#FFFFFF',
  border: '#D8E2DD',
  text: '#0F1416',
  textMuted: '#5C6B66',
  primary: palette.jadeInk,
  primaryMuted: '#00A34A',
  deepGreen: palette.jadeInk,
  accent: palette.jadeInk,
  accentSoft: '#E3F8EC',
  gold: palette.jadeInk,
  electricGold: FOCAL.goldInk,
  glow: palette.neonJade,
  night: palette.midnightObsidian,
  onAccent: '#FFFFFF',
  photoPlaceholder: '#E4EBE7',
  success: palette.jadeInk,
  danger: '#C63A3A',
  videoSurface: palette.midnightObsidian,
  videoScrim: 'rgba(15,20,22,0.86)',
  videoScrimSoft: 'rgba(15,20,22,0.55)',
  onVideo: '#F3FBF7',
  onVideoMuted: '#9EB0AA',
  backdrop: 'rgba(15,20,22,0.55)',
};

/** Obsidian mode, kept for the Look desk preset and any surface that opts into dark chrome. */
export const DARK_COLORS: ThemeColors = {
  background: palette.midnightObsidian,
  surface: palette.slateCharcoal,
  border: '#2E3A40',
  text: '#F3FBF7',
  textMuted: '#9EB0AA',
  primary: palette.neonJade,
  primaryMuted: '#00B85C',
  deepGreen: palette.neonJade,
  accent: palette.neonJade,
  accentSoft: '#16342C',
  gold: palette.neonJade,
  electricGold: palette.electricGold,
  glow: palette.neonJade,
  night: palette.midnightObsidian,
  onAccent: FOCAL.ink,
  photoPlaceholder: '#2A3439',
  success: palette.neonJade,
  danger: '#FF6B6B',
  videoSurface: palette.midnightObsidian,
  videoScrim: 'rgba(15,20,22,0.86)',
  videoScrimSoft: 'rgba(15,20,22,0.55)',
  onVideo: '#F3FBF7',
  onVideoMuted: '#9EB0AA',
  backdrop: 'rgba(15,20,22,0.78)',
};

export const colors = LIGHT_COLORS;

export type ThemeTokens = {
  background: string;
  surface: string;
  jade: string;
  gold: string;
  text: string;
};

/** Shipping Daylight tokens — Look desk "Reset to default" and `DEFAULT_APP_RUNTIME.theme`. */
export const DAYLIGHT_THEME: ThemeTokens = {
  background: '#F4F7F5',
  surface: '#FFFFFF',
  jade: '#00733C',
  gold: '#8A6400',
  text: '#0F1416',
};

function channelLuminance(hex: string): number {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return 1;
  const n = Number.parseInt(raw, 16);
  if (!Number.isFinite(n)) return 1;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * @purpose True when a hex canvas is light enough that ink (not white) should sit on it.
 */
export function isLightCanvas(hex: string): boolean {
  return channelLuminance(hex) >= 0.55;
}

/**
 * @purpose Map Look-desk theme tokens onto the full palette. Light canvases keep Daylight chrome; dark canvases keep Obsidian chrome. Highlights ⚡ video surfaces stay `videoSurface` in both.
 */
export function paletteFromTheme(theme: ThemeTokens): ThemeColors {
  const light = isLightCanvas(theme.background);
  const base = light ? LIGHT_COLORS : DARK_COLORS;
  return {
    ...base,
    background: theme.background,
    surface: theme.surface,
    text: theme.text,
    primary: theme.jade,
    primaryMuted: theme.jade,
    deepGreen: theme.jade,
    accent: theme.jade,
    gold: theme.gold,
    electricGold: theme.gold,
    onAccent: light ? '#FFFFFF' : FOCAL.ink,
  };
}

export const radii = {
  md: 12,
  lg: 16,
};

export const SCREEN_BOTTOM_GAP = 52;

export const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#0F1416',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  android: {
    elevation: 4,
  },
  default: {
    boxShadow: '0px 8px 16px rgba(15, 20, 22, 0.12)',
  },
}) as ViewStyle;
