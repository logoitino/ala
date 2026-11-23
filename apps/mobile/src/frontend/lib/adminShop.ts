/**
 * Only a genuine missing catalog uses defaults; denied/network reads never become purchasable seed rows.
 * Admin racks data layer: Drip shop products (`shop_products`) and Locker Room wishlist gear goals
 * (`wishlist_items`), plus the fan Drip rack read (split out of lib/adminCatalog.ts for R4-03; behaviour unchanged).
 * `adminCatalog.ts` re-exports what desks and hooks import, so `@/lib/adminCatalog` (and its test mocks) stays the path.
 * Admin-only writes: every write assumes the caller's role is admin and relies on RLS to enforce it.
 * @sideEffects `shop_products` and `wishlist_items` reads / writes via the shared Supabase client.
 */

import { DRIP_ITEMS, type DripCategory, type DripItem } from '@/data/shop';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ShopProduct, WishlistItem } from '@/types/database';

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function throwIf(error: { message?: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback);
}

/** URL-safe id from a name (Drip SKU ids here; the Polls desk uses it through `adminCatalog`). */
export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || `item-${Date.now()}`;
}

function dripIcon(value: unknown): DripItem['icon'] {
  return value === 'sparkles' || value === 'basketball' ? value : 'shirt';
}

function dripCategory(value: unknown): DripCategory {
  return value === 'apparel' || value === 'aura_cards' || value === 'merch' ? value : 'merch';
}

/**
 * @purpose Map a `shop_products` row onto the Drip marketplace card shape.
 */
export function shopProductToDripItem(row: ShopProduct): DripItem {
  return {
    id: row.id,
    name: row.name,
    category: dripCategory(row.category),
    priceCents: Math.max(0, asInt(row.price_cents)),
    blurb: row.blurb,
    hasSizes: Boolean(row.has_sizes),
    inventory: Math.max(0, asInt(row.inventory)),
    icon: dripIcon(row.icon),
  };
}

function parseShopProduct(row: Record<string, unknown>): ShopProduct | null {
  const id = asText(row.id);
  const name = asText(row.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    category: dripCategory(row.category),
    price_cents: Math.max(0, asInt(row.price_cents)),
    blurb: asText(row.blurb),
    has_sizes: asBool(row.has_sizes),
    inventory: Math.max(0, asInt(row.inventory)),
    icon: dripIcon(row.icon),
    is_active: asBool(row.is_active, true),
    sort_order: asInt(row.sort_order),
    created_at: asText(row.created_at) || undefined,
  };
}

/**
 * @purpose Live Drip rack for fans (`is_active` only). Falls back to seeded `DRIP_ITEMS` only when the table is missing.
 * @sideEffects `shop_products` SELECT.
 */
export async function fetchLiveDripItems(): Promise<DripItem[]> {
  if (!isSupabaseConfigured) return DRIP_ITEMS;
  const { data, error } = await supabase
    .from('shop_products')
    .select('id, name, category, price_cents, blurb, has_sizes, inventory, icon, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    // A named table in a denial/network message is not evidence of a missing catalog.
    const missing = error.code === '42P01' || error.code === 'PGRST205';
    if (missing) return DRIP_ITEMS;
    throw new Error('We could not load the Drip rack. Check your connection and try again.');
  }
  if (!Array.isArray(data)) throw new Error('We could not load the Drip rack. Check your connection and try again.');
  const items = data
    .map((row) => parseShopProduct(row as Record<string, unknown>))
    .filter((row): row is ShopProduct => Boolean(row))
    .map(shopProductToDripItem);
  return items;
}

/**
 * @purpose Full Drip catalog for the admin editor, including hidden rows.
 * @sideEffects `shop_products` SELECT.
 */
export async function fetchAdminShopProducts(): Promise<ShopProduct[]> {
  if (!isSupabaseConfigured) {
    return DRIP_ITEMS.map((item, index) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price_cents: item.priceCents,
      blurb: item.blurb,
      has_sizes: item.hasSizes,
      inventory: item.inventory,
      icon: item.icon,
      is_active: true,
      sort_order: (index + 1) * 10,
    }));
  }
  const { data, error } = await supabase
    .from('shop_products')
    .select('*')
    .order('sort_order', { ascending: true });
  throwIf(error, 'Could not load Drip products.');
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => parseShopProduct(row as Record<string, unknown>))
    .filter((row): row is ShopProduct => Boolean(row));
}

/**
 * @purpose Create or replace a Drip SKU so the production marketplace updates.
 * @sideEffects `shop_products` UPSERT.
 */
export async function upsertShopProduct(input: ShopProduct): Promise<ShopProduct> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const id = slugify(input.id || input.name);
  const payload = {
    id,
    name: input.name.trim(),
    category: dripCategory(input.category),
    price_cents: Math.max(0, asInt(input.price_cents)),
    blurb: input.blurb.trim(),
    has_sizes: Boolean(input.has_sizes),
    inventory: Math.max(0, asInt(input.inventory)),
    icon: dripIcon(input.icon),
    is_active: input.is_active !== false,
    sort_order: asInt(input.sort_order),
  };
  if (!payload.name) throw new Error('Add a product name.');
  const { data, error } = await supabase.from('shop_products').upsert(payload).select('*').single();
  throwIf(error, 'Could not save this Drip item.');
  const parsed = parseShopProduct((data ?? payload) as Record<string, unknown>);
  if (!parsed) throw new Error('Could not save this Drip item.');
  return parsed;
}

export type AdminWishlistRow = WishlistItem & { athleteName: string; school: string };

export type WishlistDraft = {
  id?: string;
  player_id: string;
  title: string;
  photo_url: string;
  buy_url: string;
  target_amount_cents: number;
  current_amount_cents?: number;
  is_active?: boolean;
  sort_order?: number;
};

/**
 * @purpose Every athlete's Locker Room Wishlist gear for the admin rack, newest goal first.
 * @returns Items joined to the tagged athlete and school so admins never read raw player ids.
 * @sideEffects `wishlist_items` SELECT with a `players` join.
 */
export async function fetchAdminWishlist(): Promise<AdminWishlistRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('wishlist_items')
    .select('*, players(name, school_name)')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  throwIf(error, 'Could not load the Locker Room rack.');
  if (!Array.isArray(data)) return [];
  return data.map((raw) => {
    const row = raw as Record<string, unknown>;
    const player = (row.players ?? {}) as Record<string, unknown>;
    return {
      id: asText(row.id),
      player_id: typeof row.player_id === 'string' ? row.player_id : null,
      title: asText(row.title, 'Gear'),
      photo_url: asText(row.photo_url),
      buy_url: asText(row.buy_url),
      target_amount_cents: asInt(row.target_amount_cents),
      current_amount_cents: asInt(row.current_amount_cents),
      is_equipped: row.is_equipped === true,
      equipped_at: typeof row.equipped_at === 'string' ? row.equipped_at : null,
      aura_awarded: row.aura_awarded === true,
      is_active: row.is_active !== false,
      sort_order: asInt(row.sort_order),
      athleteName: asText(player.name, 'Unassigned'),
      school: asText(player.school_name),
    };
  });
}

/**
 * @purpose Add or edit one gear goal so the fan Locker Room rack is fully admin-built.
 * @param input Athlete, title, photo, retailer link, and the dollar goal in cents.
 * @sideEffects `wishlist_items` INSERT / UPDATE.
 */
export async function upsertWishlistItem(input: WishlistDraft): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const title = input.title.trim();
  if (!title) throw new Error('Add gear name.');
  if (!input.player_id) throw new Error('Pick the athlete this gear is for.');
  if (input.target_amount_cents <= 0) throw new Error('Set a goal above $0.');

  const payload = {
    player_id: input.player_id,
    title,
    photo_url: input.photo_url.trim(),
    buy_url: input.buy_url.trim(),
    target_amount_cents: Math.max(0, asInt(input.target_amount_cents)),
    current_amount_cents: Math.max(0, asInt(input.current_amount_cents ?? 0)),
    is_active: input.is_active !== false,
    sort_order: asInt(input.sort_order),
  };

  const { error } = input.id
    ? await supabase.from('wishlist_items').update(payload).eq('id', input.id)
    : await supabase.from('wishlist_items').insert(payload);
  throwIf(error, 'Could not save this gear goal.');
}

/**
 * @purpose Pull a gear card off the athlete's rack (or put it back) without losing what fans already chipped in.
 * @sideEffects `wishlist_items` UPDATE.
 */
export async function setWishlistItemActive(id: string, isActive: boolean): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('wishlist_items').update({ is_active: isActive }).eq('id', id);
  throwIf(error, 'Could not update this gear goal.');
}

/**
 * @purpose Hide or delete a Drip SKU from the production rack.
 * @sideEffects `shop_products` UPDATE or DELETE.
 */
export async function setShopProductActive(id: string, isActive: boolean): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('shop_products').update({ is_active: isActive }).eq('id', id);
  throwIf(error, 'Could not update this Drip item.');
}
