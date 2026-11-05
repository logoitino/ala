/**
 * Colour and style tokens for the whole app. `palette` holds the raw hexes; `LIGHT_COLORS` maps them to
 * roles (background, surface, text, accent); `colors` is the light set that components import. `DAYLIGHT_THEME` is the
 * default look the owner can override from Expo /admin → Look. Focal and motion tokens live in `theme/motion.ts`.
 */

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import { FOCAL } from '@/theme/motion';

export const palette = {
  /** Light canvas the app ships with. */
  daylight: FOCAL.backgroundBase,
  midnightObsidian: FOCAL.videoBase,
  neonJade: FOCAL.neonJade,
  jadeInk: FOCAL.jadeInk,
  electricGold: FOCAL.electricGold,
  goldInk: FOCAL.goldInk,
  ember: FOCAL.ember,
  emberInk: FOCAL.emberInk,
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
  /** Readable gold on light canvases (kickers, ranks). */
  gold: string;
  /** Bright gold for fills, borders, and video chrome. */
  electricGold: string;
  goldSoft: string;
  /** Live / heat accents (LIVE pills, urgency). */
  ember: string;
  emberSoft: string;
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

/** Default mode: Daylight in the Calm Island palette. Deep jade is the one primary colour; gold marks awards and ember marks LIVE. */
export const LIGHT_COLORS: ThemeColors = {
  background: palette.daylight,
  surface: '#FFFFFF',
  border: '#E3E1D9',
  text: FOCAL.ink,
  textMuted: '#5B6460',
  primary: palette.jadeInk,
  primaryMuted: '#138A63',
  deepGreen: palette.jadeInk,
  accent: palette.jadeInk,
  accentSoft: FOCAL.mistJade,
  gold: palette.goldInk,
  electricGold: palette.electricGold,
  goldSoft: FOCAL.mistGold,
  ember: palette.ember,
  emberSoft: FOCAL.mistEmber,
  glow: palette.neonJade,
  night: palette.midnightObsidian,
  onAccent: '#FFFFFF',
  photoPlaceholder: '#ECEAE3',
  success: palette.jadeInk,
  danger: palette.emberInk,
  videoSurface: palette.midnightObsidian,
  videoScrim: 'rgba(14,19,21,0.86)',
  videoScrimSoft: 'rgba(14,19,21,0.55)',
  onVideo: '#F4F7F5',
  onVideoMuted: '#9EB0AA',
  backdrop: 'rgba(20,25,27,0.55)',
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
  background: FOCAL.backgroundBase,
  surface: '#FFFFFF',
  jade: FOCAL.jadeInk,
  gold: FOCAL.goldInk,
  text: FOCAL.ink,
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

export const radii = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

/** Shared padding rhythm for fan cards, sheets, and empty states. */
export const space = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
};

/** One geometry rhythm for fan menus; avoid changing video overlays or business rules. */
export const MENU_METRICS = {
  sheetRadius: 24,
  cardRadius: 16,
  controlRadius: 14,
  touchTarget: 44,
} as const;

/**
 * Design-refresh tokens (2026-11 Lovable pass): control radius, a softer lift shadow for primary actions, the
 * warning pair used by "Check" statuses, and the obsidian hero stack. Components read these through `Kit`.
 */
export const KIT = {
  controlRadius: 14,
  cardRadius: 16,
  sheetRadius: 24,
  heroRadius: 24,
  warnInk: '#7A5200',
  warnSoft: '#FBF1DC',
  obsidianRaised: '#1A2124',
  onVideoLine: 'rgba(244,247,245,0.12)',
  shadowSoft: Platform.select({
    ios: { shadowColor: FOCAL.ink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 12 },
    android: { elevation: 3 },
    default: { boxShadow: '0px 6px 16px rgba(20, 25, 27, 0.16)' },
  }) as ViewStyle,
} as const;

export const SCREEN_BOTTOM_GAP = 52;

/**
 * Scoreboard digits (UX-08): fixed-width figures so live numbers (scores, Aura, hype counts) never jitter as they
 * tick, set heavy like a stadium board. Spread into a number's text style; colour and size stay with the caller.
 */
export const SCOREBOARD_DIGITS: TextStyle = {
  fontVariant: ['tabular-nums'],
  fontWeight: '900',
  letterSpacing: -0.4,
};

export const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: FOCAL.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  android: {
    elevation: 4,
  },
  default: {
    boxShadow: '0px 8px 16px rgba(20, 25, 27, 0.12)',
  },
}) as ViewStyle;
