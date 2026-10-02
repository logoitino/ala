/**
 * Booster sponsorship tiers (Silver and up): price, Aura points granted, badge, perks and accent colour.
 * Prices can be changed from Expo /admin → Catalogs and applied with "Publish to app".
 */

import type { Sponsorship, SponsorshipTierId } from '@/types/database';
import { FOCAL } from '@/theme/motion';

export type SponsorTier = {
  id: SponsorshipTierId;
  name: string;
  dollars: number;
  auraPoints: number;
  badge: string;
  perks: string;
  accent: string;
};

export const SPONSOR_TIERS: SponsorTier[] = [
  {
    id: 'silver',
    name: 'Silver Booster',
    dollars: 50,
    auraPoints: 500,
    badge: '[ Silver ]',
    perks: 'Brand logo on school match cards + 500 Aura Points.',
    accent: '#64748B',
  },
  {
    id: 'gold',
    name: 'Gold Sponsor',
    dollars: 150,
    auraPoints: 2000,
    badge: '[ Gold ⚡ ]',
    perks: 'Featured banner on Highlights ⚡ feeds + custom shoutout in play-by-play + 2,000 Aura Points.',
    accent: FOCAL.goldInk,
  },
  {
    id: 'platinum',
    name: 'Platinum Title Sponsor',
    dollars: 500,
    auraPoints: 10000,
    badge: '[ Platinum 💎 ]',
    perks: 'Primary scoreboard branding + 7-Tier Celestial Prism profile border + 10,000 Aura Points.',
    accent: FOCAL.violetInk,
  },
];

export const DEMO_SPONSORSHIPS: Sponsorship[] = [
  {
    id: 'demo-island-grill',
    business_name: 'Island Grill',
    logo_url: '',
    school_team: 'Westlake Thunder',
    tier: 'gold',
    amount_cents: 15000,
    aura_points: 2000,
    status: 'active',
  },
  {
    id: 'demo-aloha-auto',
    business_name: 'Aloha Auto',
    logo_url: '',
    school_team: 'Lone Peak Knights',
    tier: 'silver',
    amount_cents: 5000,
    aura_points: 500,
    status: 'active',
  },
  {
    id: 'demo-mana-credit',
    business_name: 'Mana Credit Union',
    logo_url: '',
    school_team: 'ALA Hawks',
    tier: 'platinum',
    amount_cents: 50000,
    aura_points: 10000,
    status: 'active',
  },
];

export function sponsorTierById(id: string | null | undefined): SponsorTier {
  return SPONSOR_TIERS.find((tier) => tier.id === id) ?? SPONSOR_TIERS[0];
}

/**
 * @purpose Overlay Catalogs-desk names, dollars, Aura, and perks onto Silver / Gold / Platinum. Accents stay in code.
 */
export function catalogSponsorTiers(
  rows?: Array<{
    id: string;
    name: string;
    dollars: number;
    auraPoints: number;
    badge: string;
    perks: string;
  }> | null,
): SponsorTier[] {
  if (!rows?.length) return SPONSOR_TIERS;
  return SPONSOR_TIERS.map((seed) => {
    const row = rows.find((item) => item.id === seed.id);
    if (!row) return seed;
    return {
      ...seed,
      name: row.name.trim() || seed.name,
      dollars: Number.isFinite(row.dollars) && row.dollars > 0 ? row.dollars : seed.dollars,
      auraPoints: Number.isFinite(row.auraPoints) && row.auraPoints >= 0 ? row.auraPoints : seed.auraPoints,
      badge: row.badge.trim() || seed.badge,
      perks: row.perks.trim() || seed.perks,
    };
  });
}

export function formatSponsorDollars(dollars: number): string {
  return `$${dollars}/mo`;
}

export function initialsForBusiness(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TB';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}
