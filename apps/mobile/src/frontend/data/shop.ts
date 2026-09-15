import { auraPointsForTip } from '@/data/players';

export const DRIP_SIZES = ['S', 'M', 'L', 'XL', '2XL'] as const;
export type DripSize = (typeof DRIP_SIZES)[number];

export type DripCategory = 'apparel' | 'aura_cards' | 'merch';

export type DripItem = {
  id: string;
  name: string;
  category: DripCategory;
  priceCents: number;
  blurb: string;
  hasSizes: boolean;
  /** Units remaining; ProductSheet qty clamps 1…inventory. */
  inventory: number;
  icon: 'shirt' | 'sparkles' | 'basketball';
};

export type DripFilter = 'all' | DripCategory;

export const DRIP_FILTERS: Array<{ id: DripFilter; label: string }> = [
  { id: 'all', label: 'All Drip' },
  { id: 'apparel', label: 'Team Apparel' },
  { id: 'aura_cards', label: 'Custom Aura Cards' },
  { id: 'merch', label: 'Athlete Merch' },
];

export const DRIP_CATEGORY_LABELS: Record<DripCategory, string> = {
  apparel: 'Team Apparel',
  aura_cards: 'Custom Aura Cards',
  merch: 'Athlete Merch',
};

export const DRIP_ITEMS: DripItem[] = [
  {
    id: 'app-hoodie',
    name: 'Hawks Booster Hoodie',
    category: 'apparel',
    priceCents: 5400,
    blurb: 'Heavyweight fleece with booster crest for Friday nights.',
    hasSizes: true,
    inventory: 8,
    icon: 'shirt',
  },
  {
    id: 'app-tee',
    name: 'Rivalry Night Tee',
    category: 'apparel',
    priceCents: 3200,
    blurb: 'Westlake vs Lone Peak throwback print.',
    hasSizes: true,
    inventory: 24,
    icon: 'shirt',
  },
  {
    id: 'app-shorts',
    name: 'Sideline Practice Shorts',
    category: 'apparel',
    priceCents: 3600,
    blurb: 'Mesh shorts with Neon Jade taping.',
    hasSizes: true,
    inventory: 14,
    icon: 'shirt',
  },
  {
    id: 'card-jade',
    name: 'Neon Jade Holo Card',
    category: 'aura_cards',
    priceCents: 1400,
    blurb: 'Holographic Aura print with your handle on the foil edge.',
    hasSizes: false,
    inventory: 40,
    icon: 'sparkles',
  },
  {
    id: 'card-ember',
    name: 'Crimson Ember Foil Card',
    category: 'aura_cards',
    priceCents: 2200,
    blurb: 'Tier 5 border replica on heavy stock.',
    hasSizes: false,
    inventory: 30,
    icon: 'sparkles',
  },
  {
    id: 'card-prism',
    name: 'Celestial Prism Set',
    category: 'aura_cards',
    priceCents: 4000,
    blurb: 'Three-card pack: Jade, Cyan, and Prism foils.',
    hasSizes: false,
    inventory: 12,
    icon: 'sparkles',
  },
  {
    id: 'merch-bottle',
    name: 'Sideline Hydration Bottle',
    category: 'merch',
    priceCents: 1800,
    blurb: 'Team-marked bottle for the stands.',
    hasSizes: false,
    inventory: 18,
    icon: 'basketball',
  },
  {
    id: 'merch-wrist',
    name: 'Wrist Coach Playband',
    category: 'merch',
    priceCents: 2400,
    blurb: 'Call the next play from the bleachers.',
    hasSizes: false,
    inventory: 20,
    icon: 'basketball',
  },
  {
    id: 'merch-jersey',
    name: 'Replica Friday Jersey',
    category: 'merch',
    priceCents: 6500,
    blurb: 'Stitched nameplate, booster-ready fit.',
    hasSizes: true,
    inventory: 6,
    icon: 'basketball',
  },
];

/**
 * @purpose Format a Drip catalog price for badges and Buy Now.
 * @param cents Stripe-style integer cents.
 * @returns `$18.00`-style label.
 */
export function dripPriceLabel(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

/**
 * @purpose Aura grant for a Drip order (10 points per dollar, same as Mālo).
 * @param item Catalog row.
 * @param quantity Units in the sheet.
 * @returns Points to send through `add_user_aura`.
 */
export function dripAuraForOrder(item: DripItem, quantity: number): number {
  const qty = Math.max(1, Math.round(quantity));
  return auraPointsForTip((item.priceCents * qty) / 100);
}

/**
 * @purpose Upper bound for ProductSheet quantity (never below 1).
 * @param item Catalog row with `inventory`.
 * @returns Max units the + control may reach.
 */
export function dripMaxQty(item: DripItem): number {
  return Math.max(1, Math.round(item.inventory));
}

/** @deprecated Use `DRIP_ITEMS`. Kept so older shop imports keep compiling during the rename. */
export const SHOP_ITEMS = DRIP_ITEMS;
