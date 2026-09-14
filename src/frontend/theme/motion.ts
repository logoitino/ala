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

/**
 * Focal color hierarchy.
 * Neon Jade is reserved for tipping, Aura gains, and active roles.
 * Electric Gold is reserved for Platinum / Gold boosters and top ranks.
 */
export const FOCAL = {
  backgroundBase: '#0F1416',
  neonJade: '#00E676',
  electricGold: '#FFD700',
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
