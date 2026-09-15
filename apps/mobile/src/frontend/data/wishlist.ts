import type { WishlistItem } from '@/types/database';

export const WISHLIST_TITLE = '👟 Locker Room Wishlist';
export const WISHLIST_LEDE = 'Gear this athlete needs. Chip in or buy it outright.';
export const WISHLIST_GIFT_ACTION = '🎁 Gift Item Directly';
export const WISHLIST_CHIP_IN_ACTION = '⚡ Chip In $5';

/**
 * @purpose Chip In label. Catalogs desk first Mālo preset can change the dollar amount after Publish to app.
 */
export function wishlistChipInAction(dollars = WISHLIST_CHIP_IN_DOLLARS): string {
  const amount = Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
  return `⚡ Chip In $${amount}`;
}
export const WISHLIST_EQUIPPED_BADGE = 'EQUIPPED ⚡';
export const WISHLIST_UNLOCKED_TOAST = 'Gear Unlocked!';
export const WISHLIST_EMPTY = 'No gear on the wishlist yet.';

/** Flat Aura bonus the athlete earns the moment an item is fully funded. */
export const WISHLIST_EQUIP_AURA = 500;

/** Default Mālo preset on the Chip In button. */
export const WISHLIST_CHIP_IN_DOLLARS = 5;

/** Seeded rack so Expo Go without `wishlist_items` still shows the board. */
export const WISHLIST_DEMO_ITEMS: WishlistItem[] = [
  {
    id: 'demo-cleats',
    player_id: null,
    title: 'Speed Cleats — Size 12',
    photo_url: '',
    buy_url: 'https://www.dickssportinggoods.com/f/football-cleats',
    target_amount_cents: 12000,
    current_amount_cents: 8500,
    is_equipped: false,
    sort_order: 0,
  },
  {
    id: 'demo-gloves',
    player_id: null,
    title: 'Grip Receiver Gloves',
    photo_url: '',
    buy_url: 'https://www.dickssportinggoods.com/f/football-gloves',
    target_amount_cents: 6000,
    current_amount_cents: 1500,
    is_equipped: false,
    sort_order: 1,
  },
  {
    id: 'demo-recovery',
    player_id: null,
    title: 'Recovery Compression Sleeves',
    photo_url: '',
    buy_url: 'https://www.dickssportinggoods.com/f/compression-sleeves',
    target_amount_cents: 4500,
    current_amount_cents: 4500,
    is_equipped: true,
    sort_order: 2,
  },
];

/**
 * @purpose Funded share of one wishlist item, clamped to 0…100 for the jade progress bar.
 */
export function wishlistProgressPct(item: WishlistItem): number {
  const target = Math.max(0, item.target_amount_cents);
  if (target === 0) return item.is_equipped ? 100 : 0;
  const pct = (Math.max(0, item.current_amount_cents) / target) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/**
 * @purpose True when an item has hit its goal, whether the server flagged it or the fan just crossed it.
 */
export function isWishlistFunded(item: WishlistItem): boolean {
  if (item.is_equipped) return true;
  return item.target_amount_cents > 0 && item.current_amount_cents >= item.target_amount_cents;
}

export function wishlistDollars(cents: number): string {
  const amount = Math.max(0, cents) / 100;
  return `$${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

/**
 * @purpose Money line under the title: `$85 of $120 · 71%` (or the equipped state).
 */
export function wishlistFundedLabel(item: WishlistItem): string {
  const raised = wishlistDollars(item.current_amount_cents);
  const goal = wishlistDollars(item.target_amount_cents);
  if (isWishlistFunded(item)) return `${goal} funded · Fully equipped`;
  return `${raised} of ${goal} · ${wishlistProgressPct(item)}%`;
}

/**
 * @purpose Optimistically add a contribution so the bar animates before the RPC answers.
 */
export function applyWishlistChipIn(item: WishlistItem, amountCents: number): WishlistItem {
  const next: WishlistItem = {
    ...item,
    current_amount_cents: Math.max(0, item.current_amount_cents) + Math.max(0, amountCents),
  };
  return { ...next, is_equipped: isWishlistFunded(next) };
}
