/**
 * Locker Room gear goals: load an athlete's list (falling back to the seeded rack when the table is missing) and
 * move an item's funded total after a donation has been recorded.
 * @sideEffects Reads / updates `wishlist_items`.
 */

import { WISHLIST_DEMO_ITEMS, applyWishlistChipIn, isWishlistFunded } from '@/data/wishlist';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { WishlistItem } from '@/types/database';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WishlistChipInResult = {
  item: WishlistItem;
  /** True only on the transition that crossed 100% — drives confetti and the Aura award. */
  newlyEquipped: boolean;
  auraPoints: number;
  /** Athlete's new Aura total so the trading card border can restyle immediately. */
  athleteAuraPoints: number | null;
};

function asInt(value: unknown): number {
  const next = Number(value);
  return Number.isFinite(next) ? Math.round(next) : 0;
}

function parseWishlistItem(raw: unknown): WishlistItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string') return null;
  return {
    id: row.id,
    player_id: typeof row.player_id === 'string' ? row.player_id : null,
    title: typeof row.title === 'string' ? row.title : 'Gear',
    photo_url: typeof row.photo_url === 'string' ? row.photo_url : '',
    buy_url: typeof row.buy_url === 'string' ? row.buy_url : '',
    target_amount_cents: asInt(row.target_amount_cents),
    current_amount_cents: asInt(row.current_amount_cents),
    is_equipped: row.is_equipped === true,
    equipped_at: typeof row.equipped_at === 'string' ? row.equipped_at : null,
    aura_awarded: row.aura_awarded === true,
    is_active: row.is_active !== false,
    sort_order: asInt(row.sort_order),
  };
}

/**
 * @purpose Load one athlete's Locker Room Wishlist, falling back to the seeded rack when `wishlist_items` is missing.
 * @param playerId `players.id`. Demo / dev ids skip the network.
 * @returns Active items, unfunded first.
 * @sideEffects `get_wishlist_items` RPC.
 */
export async function fetchWishlistItems(playerId?: string | null): Promise<WishlistItem[]> {
  if (!isSupabaseConfigured || !playerId || !UUID_RE.test(playerId)) return WISHLIST_DEMO_ITEMS;

  const { data, error } = await supabase.rpc('get_wishlist_items', { target_player_id: playerId });
  if (error || !Array.isArray(data)) return WISHLIST_DEMO_ITEMS;

  return data
    .map((row) => parseWishlistItem(row))
    .filter((row): row is WishlistItem => Boolean(row));
}

/**
 * @purpose Move a wishlist item's funded total after the Mālo sheet has already written the `tips` row.
 * @param item Card the fan chipped in on. That row's id and title are stored on the `tips` insert (`origin=wishlist`).
 * @param amountCents Amount PaymentSheet actually charged.
 * @returns Updated item plus whether this contribution finished the goal.
 * @sideEffects `chip_in_wishlist_item` RPC (item total and, on first full funding, `add_user_aura`). Does not insert a second `tips` row. Demo rows resolve locally.
 */
export async function chipInWishlistItem(
  item: WishlistItem,
  amountCents: number,
): Promise<WishlistChipInResult> {
  const optimistic = applyWishlistChipIn(item, amountCents);
  const localResult: WishlistChipInResult = {
    item: optimistic,
    newlyEquipped: !isWishlistFunded(item) && isWishlistFunded(optimistic),
    auraPoints: 0,
    athleteAuraPoints: null,
  };

  if (!isSupabaseConfigured || !UUID_RE.test(item.id)) return localResult;

  const { data, error } = await supabase.rpc('chip_in_wishlist_item', {
    item_id: item.id,
    amount_cents: Math.max(0, Math.round(amountCents)),
  });

  if (error || !data || typeof data !== 'object') return localResult;

  const payload = data as Record<string, unknown>;
  const parsed = parseWishlistItem(payload.item);
  const athleteAura = Number(payload.athlete_aura_points);

  return {
    item: parsed ?? optimistic,
    newlyEquipped: payload.newly_equipped === true,
    auraPoints: asInt(payload.aura_points),
    athleteAuraPoints: Number.isFinite(athleteAura) ? athleteAura : null,
  };
}
