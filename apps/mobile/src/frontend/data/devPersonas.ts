/**
 * Fake athletes and fans for development only: seven personas from a rookie to an Aura legend, so every Aura tier
 * and profile state can be tried without real accounts. Used by the Studio unlock tool and the Aura boosters mock,
 * and only when `isDevMode()` (`__DEV__`) is true.
 */

import { AURA_TIERS } from '@/lib/aura';
import type { Player } from '@/types/database';

export const DEV_PERSONA_IDS = [
  'rookie_sam',
  'rising_kai',
  'marcus7',
  'allstar_isaiah',
  'mana_champ',
  'obsidian_pro',
  'aura_legend',
] as const;

export type DevPersonaId = (typeof DEV_PERSONA_IDS)[number];

export type DevPersona = Player & {
  handle: DevPersonaId;
  aura_points: number;
};

function pointsForTier(tier: 1 | 2 | 3 | 4 | 5 | 6 | 7): number {
  return AURA_TIERS.find((item) => item.tier === tier)?.min ?? 0;
}

export const DEV_PERSONAS: DevPersona[] = [
  {
    handle: 'rookie_sam',
    id: 'dev-rookie_sam',
    name: 'Sam Tui',
    jersey_number: 2,
    position: 'Wide Receiver',
    height: "5'10\"",
    school_name: 'ALA Hawks',
    backer_count: 3,
    aura_count: 1,
    seki_count: 1,
    flex_count: 0,
    aura_points: pointsForTier(1),
  },
  {
    handle: 'rising_kai',
    id: 'dev-rising_kai',
    name: 'Kai Folau',
    jersey_number: 11,
    position: 'Running Back',
    height: "5'11\"",
    school_name: 'Westlake Thunder',
    backer_count: 8,
    aura_count: 5,
    seki_count: 3,
    flex_count: 1,
    aura_points: pointsForTier(2),
  },
  {
    handle: 'marcus7',
    id: 'dev-marcus7',
    name: 'Marcus Rivera',
    jersey_number: 7,
    position: 'Quarterback',
    height: "6'2\"",
    school_name: 'ALA Hawks',
    backer_count: 14,
    aura_count: 12,
    seki_count: 8,
    flex_count: 4,
    aura_points: pointsForTier(3),
  },
  {
    handle: 'allstar_isaiah',
    id: 'dev-allstar_isaiah',
    name: 'Isaiah Vae',
    jersey_number: 34,
    position: 'Linebacker',
    height: "6'1\"",
    school_name: 'Lone Peak Knights',
    backer_count: 21,
    aura_count: 22,
    seki_count: 12,
    flex_count: 10,
    aura_points: pointsForTier(4),
  },
  {
    handle: 'mana_champ',
    id: 'dev-mana_champ',
    name: 'Mana Tofa',
    jersey_number: 88,
    position: 'Tight End',
    height: "6'4\"",
    school_name: 'Skyridge',
    backer_count: 33,
    aura_count: 36,
    seki_count: 22,
    flex_count: 18,
    aura_points: pointsForTier(5),
  },
  {
    handle: 'obsidian_pro',
    id: 'dev-obsidian_pro',
    name: 'Tua Niko',
    jersey_number: 99,
    position: 'Defensive End',
    height: "6'5\"",
    school_name: 'Timpview',
    backer_count: 48,
    aura_count: 54,
    seki_count: 31,
    flex_count: 28,
    aura_points: pointsForTier(6),
  },
  {
    handle: 'aura_legend',
    id: 'dev-aura_legend',
    name: 'Lani Storm',
    jersey_number: 1,
    position: 'Athlete',
    height: "6'0\"",
    school_name: 'American Fork',
    backer_count: 96,
    aura_count: 88,
    seki_count: 52,
    flex_count: 41,
    aura_points: pointsForTier(7),
  },
];

export function isDevMode(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}
