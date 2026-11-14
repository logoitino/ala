/** Shared motion and sport accents keep fan destinations consistent; bright glows never replace readable text inks. */
import { Platform, type ViewStyle } from 'react-native';
import type { WithSpringConfig } from 'react-native-reanimated';

/**
 * @purpose Shared Reanimated springs plus focal color tokens for every fan tab (Reel, Local, Drip, Profile, Upload).
 * @returns Spring configs for `withSpring`, focal hexes, and a persistent Mālo jade glow.
 * @sideEffects None — tokens only.
 */
export const SPRING_CARD: WithSpringConfig = {
  stiffness: 180,
  damping: 12,
  mass: 1,
};

/** Snappy reaction icons, chip overshoot, live score pops. */
export const SPRING_BOUNCE: WithSpringConfig = {
  stiffness: 300,
  damping: 8,
  mass: 0.5,
};

/** 3D Aura trading-card `rotateY`. */
export const SPRING_FLIP: WithSpringConfig = {
  stiffness: 140,
  damping: 14,
  mass: 1,
};

/** Reel owner peek panel slide (swipe left / right on a Highlight). */
export const SPRING_PEEK: WithSpringConfig = {
  stiffness: 220,
  damping: 24,
  mass: 0.9,
};

/** Fan sheets and tab indicators. Settles in place, without the bounce of `SPRING_CARD`. */
export const SPRING_SHEET: WithSpringConfig = {
  stiffness: 260,
  damping: 28,
  mass: 0.85,
};

/** Default off-screen travel for fan bottom sheets (px). Tip checkout may use a taller off value. */
export const SHEET_TRAVEL = 420;

/** Backdrop fade-in for fan sheets (matches TipSheet open). */
export const SHEET_BACKDROP_IN_MS = 200;

/** Backdrop fade-out while the sheet slides away. */
export const SHEET_BACKDROP_OUT_MS = 160;

/** Sheet slide-away duration when Reduce Motion is off. */
export const SHEET_DISMISS_MS = 220;

/** Instant-feel open/close when Reduce Motion is on. */
export const SHEET_REDUCED_MS = 100;

/**
 * Timing objects that call `Easing.*` stay inside hooks/components — not this module —
 * so Jest's Reanimated mock (which may omit `Easing`) can still import FOCAL / springs.
 */

/**
 * Highlights pager depth: the outgoing page shrinks / sinks / rounds while the incoming page
 * scales up from `scaleIn`. `sink` is a fraction of page height.
 */
export const REEL_DEPTH = {
  scaleOut: 0.9,
  scaleIn: 0.94,
  sink: 0.16,
  radius: 32,
  fade: 0.5,
  tiltDeg: 7,
} as const;

/** Scroll-reveal distance (px) for `ScrollFxItem` before an item is fully in. */
export const SCROLL_FX = {
  revealDistance: 140,
  riseY: 28,
  slideX: 40,
  tiltDeg: 14,
  staggerMs: 55,
  maxStagger: 8,
  exitFade: 0.45,
  exitScale: 0.04,
} as const;

/**
 * Focal color hierarchy — Calm Island with the owner's 2026-10-21 sporty accent continuation.
 * Jade anchors the brand; destination inks and mist fills add color without changing reward meaning.
 *
 * | Role | Color | Where |
 * | --- | --- | --- |
 * | Brand / Donate / Aura | Deep jade ink + bright jade glow | Primary CTAs, Upload, the active tab on every destination |
 * | Rank / Spotlight | Gold ink + soft gold | Kickers, #1 ranks, Spotlight, Flex — awards only |
 * | Live / heat / Drip | Ember | LIVE pills, errors and Drip's apparel accent |
 * | Sport / community | Island Cyan / Electric Violet | Local, Activity/Profile, hype bursts and Aura tiers |
 *
 * The app ships **light** on a warm sand-white canvas (`backgroundBase`). Use `ink` on bright
 * fills, `*Ink` for coloured text on light surfaces, `mist*` washes for cards, and `videoBase`
 * for chrome that stays dark (Reel overlays, Spotlight modal, scrims). Hex pairs are WCAG AA
 * (≥ 4.5:1) checked for text use.
 */
export const FOCAL = {
  backgroundBase: '#F7F6F2',
  ink: '#14191B',
  neonJade: '#2EE59D',
  jadeInk: '#0B6E4F',
  mistJade: '#E3F1EA',
  islandCyan: '#3DD6F5',
  cyanInk: '#00707E',
  mistCyan: '#DDF5FA',
  electricGold: '#F5C542',
  goldInk: '#7F5A00',
  mistGold: '#FBF4DE',
  electricViolet: '#7C4DFF',
  violetInk: '#4C1D95',
  mistViolet: '#F1ECFB',
  ember: '#E5213F',
  emberInk: '#C8102E',
  mistEmber: '#FCE9EB',
  mistSlate: '#F1F3F2',
  videoBase: '#0E1315',
} as const;

const JADE_ACCENT = { color: FOCAL.jadeInk, mist: FOCAL.mistJade, glow: FOCAL.neonJade } as const;

/**
 * @purpose Fan-tab accents under the Lovable standard: one jade primary everywhere; gold only for
 * Spotlight awards. Dark inks sit on mist fills; bright glows belong on dark media. Cyan / violet /
 * ember stay in FOCAL for Seki, quiz, Aura tiers and LIVE — not as per-tab chrome.
 */
export const TAB_ACCENTS = {
  index: JADE_ACCENT,
  beyond: JADE_ACCENT,
  local: JADE_ACCENT,
  activity: JADE_ACCENT,
  spotlight: { color: FOCAL.goldInk, mist: FOCAL.mistGold, glow: FOCAL.electricGold },
  drip: JADE_ACCENT,
  profile: JADE_ACCENT,
} as const;


/** Persistent Neon Jade border glow for the Reel Mālo ⚡ control. */
export const JADE_BORDER_GLOW: ViewStyle = Platform.select({
  ios: {
    shadowColor: FOCAL.neonJade,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.92,
    shadowRadius: 14,
  },
  android: {
    elevation: 14,
  },
  default: {
    boxShadow: `0px 0px 18px ${FOCAL.neonJade}`,
  },
}) as ViewStyle;
