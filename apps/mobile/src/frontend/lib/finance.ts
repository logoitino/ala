/**
 * Money labelling helpers: pick the channel stored on a donation (`tips.origin`) and the short channel line shown
 * on receipts and the admin Money desk. Wording follows docs/VOICE.md.
 */

import {
  MALO_PLATFORM_CUT_BPS,
  splitLabelForSource,
  type RevenueSource,
} from '@/data/finance';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

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

const EMPTY_STREAMS: CompanyRevenueStream[] = [
  {
    source: 'malo',
    label: 'Donations',
    split: splitLabelForSource('malo'),
    gross_cents: 0,
    platform_cents: 0,
    payout_cents: 0,
    platform_bps: MALO_PLATFORM_CUT_BPS,
    payout_bps: 9000,
    payee: 'Athlete',
  },
  {
    source: 'tip',
    label: "Optional tips to Tapua'i",
    split: splitLabelForSource('tip'),
    gross_cents: 0,
    platform_cents: 0,
    payout_cents: 0,
    platform_bps: 10000,
    payout_bps: 0,
    payee: "Tapua'i",
  },
  {
    source: 'booster',
    label: 'Local District Booster Sponsorships',
    split: splitLabelForSource('booster'),
    gross_cents: 0,
    platform_cents: 0,
    payout_cents: 0,
    platform_bps: 1500,
    payout_bps: 8500,
    payee: 'Operator',
  },
  {
    source: 'merch_vault',
    label: 'Merch & Vault Subscriptions',
    split: 'Vault 20% / 80% athlete · Drip 100% platform',
    gross_cents: 0,
    platform_cents: 0,
    payout_cents: 0,
    platform_bps: null,
    payout_bps: null,
    payee: 'Athlete + company',
  },
];

export const EMPTY_COMPANY_REVENUE: CompanyRevenueSummary = {
  gross_volume_cents: 0,
  company_net_cents: 0,
  payouts_cents: 0,
  stripe_paid_cents: 0,
  streams: EMPTY_STREAMS,
  recent: [],
};

function asInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function dollarsToCents(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value * 100));
  }
  return asInt(value);
}

function parseLog(raw: unknown): CompanyRevenueLog | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asText(row.id);
  if (!id) return null;
  const gross =
    row.gross_cents != null ? asInt(row.gross_cents) : dollarsToCents(row.gross_amount);
  const platform =
    row.platform_cents != null ? asInt(row.platform_cents) : dollarsToCents(row.platform_cut_amount);
  const payout =
    row.payout_cents != null ? asInt(row.payout_cents) : dollarsToCents(row.payout_amount);
  return {
    id,
    source: asText(row.source || row.transaction_type, 'malo'),
    label: asText(row.label, asText(row.transaction_type, 'Revenue')),
    gross_cents: gross,
    platform_cents: platform,
    payout_cents: payout,
    payee_kind: asText(row.payee_kind, 'none'),
    created_at: asText(row.created_at),
  };
}

function parseStream(raw: unknown): CompanyRevenueStream | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const label = asText(row.label);
  if (!label) return null;
  const source = asText(row.source, label);
  return {
    source,
    label:
      source === 'malo'
        ? 'Donations'
        : source === 'booster'
          ? 'Local District Booster Sponsorships'
          : source === 'merch_vault' || source === 'vault' || source === 'merch'
            ? asText(row.label, 'Merch & Vault Subscriptions')
            : asText(row.label, label),
    split: asText(row.split, '—'),
    gross_cents: asInt(row.gross_cents),
    platform_cents: asInt(row.platform_cents),
    payout_cents: asInt(row.payout_cents),
    platform_bps: row.platform_bps == null ? null : asInt(row.platform_bps),
    payout_bps: row.payout_bps == null ? null : asInt(row.payout_bps),
    payee: asText(row.payee, '—'),
  };
}

function parseSummary(raw: unknown): CompanyRevenueSummary {
  if (!raw || typeof raw !== 'object') return EMPTY_COMPANY_REVENUE;
  const row = raw as Record<string, unknown>;
  const streams = Array.isArray(row.streams)
    ? row.streams.map(parseStream).filter((item): item is CompanyRevenueStream => Boolean(item))
    : [];
  const recent = Array.isArray(row.recent)
    ? row.recent.map(parseLog).filter((item): item is CompanyRevenueLog => Boolean(item))
    : [];
  return {
    gross_volume_cents:
      row.gross_volume_cents != null ? asInt(row.gross_volume_cents) : dollarsToCents(row.total_gross),
    company_net_cents:
      row.company_net_cents != null
        ? asInt(row.company_net_cents)
        : dollarsToCents(row.total_platform_revenue),
    payouts_cents:
      row.payouts_cents != null ? asInt(row.payouts_cents) : dollarsToCents(row.total_payouts),
    stripe_paid_cents: asInt(row.stripe_paid_cents),
    streams: streams.length > 0 ? streams : EMPTY_STREAMS,
    recent,
  };
}

/**
 * @purpose Load company gross / net / payout totals plus per-stream splits for the Money desk.
 * @returns Widget cents, Mālo / booster / merch+vault rows, and recent log fallback.
 * @sideEffects `get_company_revenue_summary` (syncs `company_revenue_logs` from tips, sponsorships, subscriptions, shop_orders).
 */
export async function fetchCompanyRevenueSummary(): Promise<CompanyRevenueSummary> {
  if (!isSupabaseConfigured) return EMPTY_COMPANY_REVENUE;
  const { data, error } = await supabase.rpc('get_company_revenue_summary');
  if (error || data == null) return EMPTY_COMPANY_REVENUE;
  try {
    const payload = typeof data === 'string' ? JSON.parse(data) : Array.isArray(data) ? data[0] : data;
    return parseSummary(payload);
  } catch {
    return EMPTY_COMPANY_REVENUE;
  }
}

/**
 * @purpose List recent company revenue ledger rows for the Money desk.
 * @returns Newest 40 logs; empty when the table is missing or RLS hides rows.
 * @sideEffects `company_revenue_logs` SELECT.
 */
export async function fetchCompanyRevenueLogs(): Promise<CompanyRevenueLog[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('company_revenue_logs')
    .select(
      'id, source, transaction_type, label, gross_cents, platform_cents, payout_cents, gross_amount, platform_cut_amount, payout_amount, payee_kind, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(40);
  if (error || !Array.isArray(data)) return [];
  return data.map(parseLog).filter((row): row is CompanyRevenueLog => Boolean(row));
}

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

export function revenueSourceTitle(source: string): string {
  if (source === 'malo') return 'Donations';
  if (source === 'booster') return 'Booster';
  if (source === 'vault') return 'Vault';
  if (source === 'merch') return 'Drip';
  if (source === 'tip') return "Tip to Tapua'i";
  return source;
}
