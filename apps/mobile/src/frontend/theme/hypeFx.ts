/**
 * Per-hype colours and shout words so Seki, Aura and Flex each look and sound different on the Highlights rail and
 * on Local play cards.
 */

import { FOCAL } from '@/theme/motion';
import type { PlayReactionId } from '@/data/players';

export type HypeFx = {
  color: string;
  glow: string;
  shout: string;
  emojis: readonly [string, string, string, string];
};

/**
 * @purpose Per-hype color and shout copy so Seki / Aura / Flex feel distinct on the Highlights rail and Local play cards.
 * @returns Tokens keyed by `PlayReactionId`.
 * @sideEffects None — tokens only.
 */
export const HYPE_FX: Record<PlayReactionId, HypeFx> = {
    seki: {
    color: FOCAL.islandCyan,
    glow: 'rgba(0,229,255,0.62)',
    shout: 'SEKI!',
    emojis: ['🤙', '🌊', '✨', '💙'],
  },
  aura: {
    color: FOCAL.neonJade,
    glow: 'rgba(0,230,118,0.62)',
    shout: 'AURA!',
    emojis: ['⚡', '✨', '💚', '🌟'],
  },
  flex: {
    color: FOCAL.electricGold,
    glow: 'rgba(255,215,0,0.62)',
    shout: 'FLEX!',
    emojis: ['💪', '🔥', '😤', '✨'],
  },
};
