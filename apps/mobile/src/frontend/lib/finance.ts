/**
 * Money labelling helpers: pick the channel stored on a donation (`tips.origin`) and the short channel line shown
 * on receipts and the admin Money desk. Wording follows docs/product/VOICE.md.
 * @sideEffects `fetchRecentTips` reads `tips`. `recordDripOrder` inserts `shop_orders`.
 */

import {
  
  
  type RevenueSource } from '@/data/finance';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { TipLedgerEntry } from '@/types/database';

export type TipOrigin = 'highlight' | 'qr' | 'wishlist' | 'profile' | 'live' | 'rally';
export type TipEntry = 'in_app' | 'qr_link';

/**
 * @purpose Pick the Mālo channel stored on `tips.origin`.
 * @param origin Caller override (QR profile, live feed).
 * @param reelId Highlight clip, when the sheet was opened from one.
 * @param wishlistItemId Locker item being funded. Wins over a clip id.
 * @param rallyId Rally goal the donation counts toward. Wins over a caller origin and a clip id.
 * @returns `wishlist`, `rally`, the caller origin, `highlight`, or `profile`.
 */
export function resolveTipOrigin(args: {
  origin?: TipOrigin;
  reelId?: string | null;
  wishlistItemId?: string | null;
  rallyId?: string | null;
}): TipOrigin {
  if (args.wishlistItemId) return 'wishlist';
  if (args.rallyId) return 'rally';
  if (args.origin) return args.origin;
  if (args.reelId) return 'highlight';
  return 'profile';
}

/**
 * @purpose Short channel line for receipts and the Money desk.
 * @param origin `tips.origin`.
 * @param entry `tips.entry`. A Highlight opened from a QR scan reads "Highlight via QR".
 * @param sourceLabel Item title or other detail stored on the row.
 * @returns "Wishlist · Cleats", "QR link", "Live feed", and the same shapes.
 */
export function tipChannelLabel(
  origin?: string | null,
  entry?: string | null,
  sourceLabel?: string | null,
): string {
  const place =
    origin === 'highlight'
      ? 'Highlight'
      : origin === 'qr'
        ? 'QR link'
        : origin === 'wishlist'
          ? 'Wishlist'
          : origin === 'live'
            ? 'Live feed'
            : origin === 'rally'
              ? 'Rally'
              : 'Profile';
  const via = entry === 'qr_link' && origin !== 'qr' ? ' via QR' : '';
  const detail = sourceLabel?.trim() ? ` · ${sourceLabel.trim()}` : '';
  return `${place}${via}${detail}`;
}

/**
 * @purpose The PaymentIntent id inside a PaymentSheet client secret (`pi_123_secret_abc` → `pi_123`), stored on
 *   the donation so the books can match a Stripe payout to its donations (BOOKS-01). Null when it is not one.
 */
export function paymentIntentIdFromSecret(clientSecret: string | null | undefined): string | null {
  const id = (clientSecret ?? '').split('_secret_')[0];
  return /^pi_[A-Za-z0-9]{8,64}$/.test(id) ? id : null;
}

export type CompanyRevenueStream = {
  source: string;
  label: string;
  split: string;
  gross_cents: number;
  platform_cents: number;
  payout_cents: number;
  platform_bps: number | null;
  payout_bps: number | null;
  payee: string;
};

export type CompanyRevenueLog = {
  id: string;
  source: RevenueSource | string;
  label: string;
  gross_cents: number;
  platform_cents: number;
  payout_cents: number;
  payee_kind: 'athlete' | 'operator' | 'none' | string;
  created_at: string;
};

export type CompanyRevenueSummary = {
  gross_volume_cents: number;
  company_net_cents: number;
  payouts_cents: number;
  stripe_paid_cents: number;
  streams: CompanyRevenueStream[];
  recent: CompanyRevenueLog[];
};

/**
 * @purpose Persist a paid Drip order so merch volume hits the company revenue ledger.
 * @param input Product slug, Stripe cents, qty, optional buyer.
 * @sideEffects `shop_orders` INSERT (trigger writes `company_revenue_logs`).
 */
export async function recordDripOrder(input: {
  productId: string;
  amountCents: number;
  qty: number;
  buyerId?: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  const amount = Math.max(0, Math.round(input.amountCents));
  if (!input.productId || amount <= 0) return;
  await supabase.from('shop_orders').insert({
    product_id: input.productId,
    buyer_id: input.buyerId ?? null,
    amount_cents: amount,
    qty: Math.max(1, Math.round(input.qty) || 1),
  });
}

/**
 * @purpose Newest donation rows for the signed-in Profile ledger. An empty list covers a missing table or a guest.
 * @returns Up to 40 `tips` rows, newest first.
 * @sideEffects `tips` SELECT.
 */
export async function fetchRecentTips(): Promise<TipLedgerEntry[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from('tips').select('*').order('created_at', { ascending: false }).limit(40);
  return (data as TipLedgerEntry[] | null) ?? [];
}
