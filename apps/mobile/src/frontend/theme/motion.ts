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
 * Focal color hierarchy — Island Daylight (standard fan-app scheme).
 *
 * | Role | Color | Where |
 * | --- | --- | --- |
 * | Brand / Mālo / Aura | Neon Jade + jade ink | Primary CTAs, active Home/Profile |
 * | Seki / away / Local | Island Cyan | Local tab, cheer away, Seki bursts |
 * | Rank / Spotlight | Electric Gold + gold ink | Kickers, #1 ranks, Spotlight, Flex |
 * | Live / heat | Ember | LIVE pills, Crimson Ember tier, urgency |
 * | Flex-adjacent | Electric Violet | Profile chrome, Flex-adjacent accents |
 *
 * The app ships **light** (`backgroundBase`). Use `ink` on filled jade/gold, `*Ink` for
 * colored text on light surfaces, `mist*` washes for cards, and `videoBase` for chrome
 * that stays dark (Reel overlays, Spotlight modal, scrims).
 */
export const FOCAL = {
  backgroundBase: '#F3FAF6',
  ink: '#0F1416',
  neonJade: '#00E676',
  jadeInk: '#00733C',
  mistJade: '#E8FBF0',
  islandCyan: '#00E5FF',
  cyanInk: '#007A8A',
  mistCyan: '#CFF7FF',
  electricGold: '#FFD700',
  goldInk: '#8A6400',
  mistGold: '#FFF8DC',
  electricViolet: '#7C4DFF',
  violetInk: '#4C1D95',
  mistViolet: '#F3EDFF',
  ember: '#FF1744',
  emberInk: '#C4002B',
  mistEmber: '#FFE8EC',
  mistSlate: '#F1F5F9',
  videoBase: '#0F1416',
} as const;

/**
 * @purpose Per-tab accent for the fan bar and light-tab chrome so each destination reads at a glance.
 * Home = jade, Local = cyan, Spotlight = gold, Drip = ember, Profile = violet.
 */
export const TAB_ACCENTS = {
  index: { color: FOCAL.jadeInk, mist: FOCAL.mistJade, glow: FOCAL.neonJade },
  local: { color: FOCAL.cyanInk, mist: FOCAL.mistCyan, glow: FOCAL.islandCyan },
  spotlight: { color: FOCAL.goldInk, mist: FOCAL.mistGold, glow: FOCAL.electricGold },
  drip: { color: FOCAL.emberInk, mist: FOCAL.mistEmber, glow: FOCAL.ember },
  profile: { color: FOCAL.violetInk, mist: FOCAL.mistViolet, glow: FOCAL.electricViolet },
} as const;

export type FanTabAccentId = keyof typeof TAB_ACCENTS;

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
