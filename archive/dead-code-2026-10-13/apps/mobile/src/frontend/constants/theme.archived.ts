// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/constants/theme.ts: DARK_COLORS, paletteFromTheme.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

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
    electricGold: light ? FOCAL.electricGold : theme.gold,
    onAccent: light ? '#FFFFFF' : FOCAL.ink,
  };
}

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
  gold: palette.electricGold,
  electricGold: palette.electricGold,
  goldSoft: '#2A2410',
  ember: palette.ember,
  emberSoft: '#3A1218',
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

