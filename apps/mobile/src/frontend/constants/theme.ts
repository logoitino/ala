/**
 * Colour and style tokens for the whole app. `palette` holds the raw hexes; `LIGHT_COLORS` / `DARK_COLORS` map them to
 * roles (background, surface, text, accent); `colors` is the light set that components import. `DAYLIGHT_THEME` is the
 * default look the owner can override from Expo /admin → Look. Focal and motion tokens live in `theme/motion.ts`.
 */

import { Platform, type ViewStyle } from 'react-native';

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

/** Default mode: Daylight. Jade stays the primary CTA; gold kickers + ember LIVE sit beside it. */
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
  accentSoft: FOCAL.mistJade,
  gold: palette.goldInk,
  electricGold: palette.electricGold,
  goldSoft: FOCAL.mistGold,
  ember: palette.ember,
  emberSoft: FOCAL.mistEmber,
  glow: palette.neonJade,
  night: palette.midnightObsidian,
  onAccent: '#FFFFFF',
  photoPlaceholder: '#E4EBE7',
  success: palette.jadeInk,
  danger: palette.emberInk,
  videoSurface: palette.midnightObsidian,
  videoScrim: 'rgba(15,20,22,0.86)',
  videoScrimSoft: 'rgba(15,20,22,0.55)',
  onVideo: '#F3FBF7',
  onVideoMuted: '#9EB0AA',
  backdrop: 'rgba(15,20,22,0.55)',
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
  background: '#F3FAF6',
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
  sheetRadius: 28,
  cardRadius: 20,
  controlRadius: 16,
  touchTarget: 44,
} as const;

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
