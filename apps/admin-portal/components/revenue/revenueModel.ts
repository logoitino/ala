/**
 * Pure helpers for the Revenue desk (`app/(protected)/money/page.tsx`, owned by COMMERCE).
 * Display words for ledger codes, UTC day grids, and the donation split read from the ledger.
 * No fetching and no new measures: every number here is a field from `lib/reports.ts` or a
 * ratio of two of them. Money words follow docs/product/VOICE.md (Donate / donation; "tip" only
 * for the tip for Tapua'i).
 */
import type { MaloDay, RevenueStream } from '@/lib/reports';

/** Compact USD for gridline labels only ("$1.2K"). Values are cents. */
export function compactUsd(cents: number): string {
  return (Math.max(0, cents) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  });
}

/** One-decimal percent of a whole, or null when the whole is 0. */
export function percent1(part: number, whole: number): number | null {
  if (!(whole > 0)) return null;
  return Math.round((Math.max(0, part) / whole) * 1000) / 10;
}

/** Display name per `company_revenue_logs.source` / stream `source`, so older hosted labels ("Mālo …") never show. */
const STREAM_NAMES: Record<string, string> = {
  malo: 'Donations',
  tip: "Optional tips for Tapua'i",
  booster: 'Booster sponsorships',
  vault: 'Vault subscriptions',
  merch: 'Drip merch',
  merch_vault: 'Vault and Drip',
};

export function streamName(source: string, fallback: string): string {
  return STREAM_NAMES[source] ?? fallback;
}

const PAYEE_NAMES: Record<string, string> = {
  Athlete: "athlete's family account",
  Operator: 'booster operator',
  "Tapua'i": "Tapua'i only",
  'Athlete + company': "athlete and Tapua'i",
};

export function payeeName(payee: string): string {
  return PAYEE_NAMES[payee] ?? payee;
}

/** Ledger row labels are written by SQL as "Mālo · Highlight · Kaleo". Drop the retired prefix for display. */
export function ledgerDetail(source: string, label: string): string {
  const cleaned = label.replace(/^M[aā]lo\s*·\s*/i, '').trim();
  if (source === 'tip') return "Tip for Tapua'i";
  return cleaned || streamName(source, label);
}

/** Where a donation started, by `tips.origin`. Same keys as `maloOriginTitle`, in VOICE words. */
export function originName(origin: string): string {
  if (origin === 'highlight') return 'Highlight';
  if (origin === 'qr') return 'QR link';
  if (origin === 'wishlist') return 'Gear goal';
  if (origin === 'live') return 'Live feed';
  return 'Profile';
}

/** How a donation arrived, by `tips.entry`. */
export function entryName(entry: string): string {
  return entry === 'qr_link' ? 'QR donation link' : 'In the app';
}

/** Origin plus entry plus the stored source label, for the donation table. */
export function donationChannel(origin: string, entry: string, sourceLabel: string): string {
  const via = entry === 'qr_link' && origin !== 'qr' ? ' via QR' : '';
  const detail = sourceLabel.trim() ? ` · ${sourceLabel.trim()}` : '';
  return `${originName(origin)}${via}${detail}`;
}

/** "Oct 3" for a `YYYY-MM-DD` UTC day. */
export function shortDay(day: string): string {
  const at = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(at.getTime())) return day;
  return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** "Oct 3, 4:05 PM UTC". Fixed to UTC so the server's time zone never changes the table. */
export function utcStamp(iso: string): string {
  if (!iso) return '—';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  return `${at.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })} UTC`;
}

/**
 * @purpose Fill the sparse `by_day` rows into every UTC day of the window. `get_admin_malo_breakdown`
 *   only returns days that had donations, and it reads every `tips` row since now − 14 days, so a day
 *   without a row is a real $0. The window can touch 15 calendar days (the first is partial); that
 *   earliest day is kept only when it has a row.
 * @param byDay Parsed `by_day` totals.
 * @param now Render time.
 * @returns Oldest first, `{ day, cents }` for each day.
 */
export function fillDays(byDay: MaloDay[], now: Date = new Date()): MaloDay[] {
  const totals = new Map(byDay.map((row) => [row.day, row.cents]));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const grid: string[] = [];
  for (let back = 13; back >= 0; back -= 1) grid.push(new Date(today - back * 86_400_000).toISOString().slice(0, 10));
  const extra = [...totals.keys()].filter((day) => !grid.includes(day)).sort();
  return [...extra, ...grid].sort().map((day) => ({ day, cents: totals.get(day) ?? 0 }));
}

/** The donation stream's split as recorded in the ledger (never the policy constant). */
export type DonationSplit = {
  gross: number;
  family: number;
  platform: number;
  unsplit: number;
  familyPct: number | null;
  platformPct: number | null;
  policy: string;
};

/** "90" for 9000 basis points, "12.5" for 1250. */
function bpsPercent(bps: number): string {
  return (bps / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function donationSplit(streams: RevenueStream[]): DonationSplit | null {
  const stream = streams.find((row) => row.source === 'malo');
  if (!stream) return null;
  const gross = stream.gross_cents;
  return {
    gross,
    family: stream.payout_cents,
    platform: stream.platform_cents,
    unsplit: Math.max(0, gross - stream.payout_cents - stream.platform_cents),
    familyPct: percent1(stream.payout_cents, gross),
    platformPct: percent1(stream.platform_cents, gross),
    // Stated policy: from the RPC's basis points when present (VOICE words), else its `split` text.
    policy:
      stream.payout_bps != null && stream.platform_bps != null
        ? `${bpsPercent(stream.payout_bps)}% to the family account, ${bpsPercent(stream.platform_bps)}% to Tapua'i`
        : stream.split,
  };
}
