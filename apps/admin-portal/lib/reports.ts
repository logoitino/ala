/**
 * Reports + Money loaders for the Next admin portal.
 * Same RPCs Expo `/admin/reports` and `/admin/money` call.
 */

// `supabase.server` (server-only) is loaded inside each fetcher, so `node --test` can import the pure parsers here.
async function serverClient() {
  const { getSupabaseServerClient } = await import('@/lib/supabase.server');
  return getSupabaseServerClient();
}

export type ReportSection = Record<string, number>;

export type ReportLeader = {
  label: string;
  value: number;
};

export type PortalReports = {
  configured: boolean;
  error: string | null;
  generatedAt: string | null;
  engagement: ReportSection;
  money: ReportSection;
  content: ReportSection;
  audience: ReportSection;
  live: ReportSection;
  reliability: ReportSection;
  usage: ReportSection;
  /** Each list: `null` = the key was not in this read (kit "missing"); `[]` = read, nothing in it (kit empty state). */
  tabs: ReportLeader[] | null;
  features: ReportLeader[] | null;
  issues: ReportLeader[] | null;
  scroll: ReportLeader[] | null;
  leaders: { malo: ReportLeader[] | null; hype: ReportLeader[] | null; schools: ReportLeader[] | null };
  series: ReportSeries;
};

export type ReportPoint = { label: string; value: number };

/** `null` = the series key was not in this read; `[]` = present but empty. */
export type ReportSeries = {
  clips: ReportPoint[] | null;
  malo: ReportPoint[] | null;
  stalls: ReportPoint[] | null;
  dwell: ReportPoint[] | null;
};

export type RevenueStream = {
  source: string;
  label: string;
  split: string;
  gross_cents: number;
  platform_cents: number;
  payout_cents: number;
  payee: string;
  /** Stated split in basis points (1000 = 10%) when the RPC returns it. `null` / absent = not in this read. */
  platform_bps?: number | null;
  payout_bps?: number | null;
};

export type RevenueLog = {
  id: string;
  source: string;
  label: string;
  gross_cents: number;
  platform_cents: number;
  payout_cents: number;
  created_at: string;
};

export type PortalRevenue = {
  configured: boolean;
  error: string | null;
  /** `null` = the key was not in this read: show "—", never $0.00. */
  gross_volume_cents: number | null;
  company_net_cents: number | null;
  payouts_cents: number | null;
  stripe_paid_cents: number | null;
  streams: RevenueStream[];
  recent: RevenueLog[];
};

const EMPTY_REPORTS: PortalReports = {
  configured: false,
  error: null,
  generatedAt: null,
  engagement: {},
  money: {},
  content: {},
  audience: {},
  live: {},
  reliability: {},
  usage: {},
  tabs: null,
  features: null,
  issues: null,
  scroll: null,
  leaders: { malo: null, hype: null, schools: null },
  series: { clips: null, malo: null, stalls: null, dwell: null },
};

const EMPTY_REVENUE: PortalRevenue = {
  configured: false,
  error: null,
  gross_volume_cents: null,
  company_net_cents: null,
  payouts_cents: null,
  stripe_paid_cents: null,
  streams: [],
  recent: [],
};

function asInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/** Like `asInt`, but an absent or non-numeric value is `null` (not in this read), never 0. */
function asIntOrNull(value: unknown): number | null {
  if (value == null || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asSection(value: unknown): ReportSection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: ReportSection = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) out[key] = raw;
  }
  return out;
}

export function asSeries(value: unknown): ReportSeries {
  const bag = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    clips: asLeaders(bag.clips),
    malo: asLeaders(bag.malo),
    stalls: asLeaders(bag.stalls),
    dwell: asLeaders(bag.dwell),
  };
}

/**
 * @purpose Parse a `{label,value}` list. `null` when the key is absent (or not a list); a present `[]` stays `[]`.
 */
export function asLeaders(value: unknown): ReportLeader[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const bag = row as Record<string, unknown>;
      const label = asText(bag.label || bag.day || bag.id);
      if (!label) return null;
      return { label, value: asInt(bag.value ?? bag.cents ?? bag.count) };
    })
    .filter((row): row is ReportLeader => Boolean(row));
}

function dollarsToCents(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 1_000_000 && !Number.isInteger(value)) {
    return Math.max(0, Math.round(value * 100));
  }
  if (typeof value === 'number' && Number.isFinite(value) && value < 10_000 && String(value).includes('.')) {
    return Math.max(0, Math.round(value * 100));
  }
  return asInt(value);
}

/**
 * @purpose Format ledger cents as USD for the web Reports / Money desks.
 */
export function formatUsd(cents: number): string {
  return (Math.max(0, cents) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export const REPORT_LABELS: Record<string, string> = {
  clips_live: 'Live clips',
  clips_24h: 'Clips uploaded (24h)',
  clips_7d: 'Clips uploaded (7d)',
  clips_prev_7d: 'Clips uploaded (prior 7d)',
  seki: 'Seki',
  aura: 'Aura',
  flex: 'Flex',
  hype_votes: 'Hype votes',
  saves: 'Saves',
  crew_follows: 'Crew follows',
  malo_cents_all: 'Donations, all time',
  malo_count_all: 'Donation count, all time',
  malo_cents_24h: 'Donations (24h)',
  malo_count_24h: 'Donation count (24h)',
  malo_cents_7d: 'Donations (7d)',
  malo_count_7d: 'Donation count (7d)',
  malo_cents_prev_7d: 'Donations (prior 7d)',
  avg_tip_cents_7d: 'Average donation (7d)',
  queued_payouts: 'Queued payouts',
  paid_payouts_cents: 'Paid out',
  active_subs: 'Active subscriptions',
  flagged: 'Open flags',
  removed: 'Removed clips',
  vault: 'Vault clips',
  exclusive_clips: 'Exclusive clips',
  flash_live: 'Flash Unlock live',
  spotlight_live: 'Live Spotlight awards',
  qna: 'Subscriber Q&A requests',
  game_play: 'Game Day clips',
  train_like_me: 'Train Like Me clips',
  serve_like_me: 'Serve Like Me clips',
  profiles: 'Profiles',
  athletes: 'Athletes',
  verified: 'Verified profiles',
  admins: 'Admins',
  schools: 'Schools',
  pending_verify: 'Verify queue',
  live_games: 'Live games',
  parked_games: 'Parked games',
  poll_votes: 'Poll votes',
  active_polls: 'Active polls',
  active_boosters: 'Active boosters',
  drip_skus: 'Drip SKUs on rack',
  stalls_24h: 'Stalls (24h)',
  reconnects_24h: 'Reconnects (24h)',
  checkouts_24h: 'Checkout step timings (24h)',
  avg_checkout_ms_24h: 'Average checkout step time (24h)',
  events_24h: 'Telemetry events (24h)',
  sessions_24h: 'Tab sessions (24h)',
  dwell_ms_24h: 'Time on tabs (24h)',
  dwell_ms_7d: 'Time on tabs (7d)',
  taps_24h: 'Feature taps (24h)',
  taps_7d: 'Feature taps (7d)',
  issues_24h: 'Control issues (24h)',
  issues_7d: 'Control issues (7d)',
  feedback_bugs_open: 'Open bug reports',
  avg_scroll_pct_7d: 'Avg scroll depth (7d)',
};

/**
 * @purpose Format ledger cents as whole dollars ("$1,200") for chart gridlines, where cents are noise.
 */
export function formatUsdWhole(cents: number): string {
  return (Math.max(0, cents) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

/**
 * @purpose Format a count. Whole numbers print plainly; averages (e.g. a 7-day daily average) keep one decimal.
 */
export function formatCount(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

/**
 * @purpose Format milliseconds of time on tabs as minutes ("42 min", "3.5 min"). `tabs` and `dwell` values are ms.
 */
export function formatMinutes(ms: number): string {
  const minutes = Math.max(0, ms) / 60000;
  const digits = minutes > 0 && minutes < 10 ? 1 : 0;
  return `${minutes.toLocaleString('en-US', { maximumFractionDigits: digits })} min`;
}

/**
 * @purpose Format a short duration in ms ("850 ms", "1.2 s"), e.g. `avg_checkout_ms_24h`.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms).toLocaleString('en-US')} ms`;
  return `${(ms / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} s`;
}

/**
 * @purpose Format an average percent (`scroll` values, `avg_scroll_pct_7d`) as "n%". It is already a percent, not a share to compute.
 */
export function formatPercent(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')}%`;
}

/**
 * @purpose Read one number from a `get_admin_reports` section. `null` = the key was not in this read (not 0).
 */
export function reportNumber(section: ReportSection, key: string): number | null {
  const value = section[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isMoneyKey(key: string): boolean {
  return key.includes('cents') || key.startsWith('malo_cents') || key === 'paid_payouts_cents' || key === 'avg_tip_cents_7d';
}

/**
 * @purpose Human label + value for a `get_admin_reports` metric.
 */
export function formatReportValue(key: string, value: number): string {
  if (isMoneyKey(key)) return formatUsd(value);
  if (key.includes('dwell_ms')) return formatMinutes(value);
  if (key.includes('_ms')) return formatDuration(value);
  if (key.includes('pct')) return formatPercent(value);
  return value.toLocaleString();
}

export function labelForReportKey(key: string): string {
  return REPORT_LABELS[key] ?? key.replace(/_/g, ' ');
}

/**
 * @purpose Load behavior + money aggregates for the web Reports desk.
 * @sideEffects `get_admin_reports` RPC (same as Expo `/admin/reports`).
 */
export async function fetchPortalReports(): Promise<PortalReports> {
  const supabase = await serverClient();
  if (!supabase) return { ...EMPTY_REPORTS, error: 'Supabase env missing' };
  const { data, error } = await supabase.rpc('get_admin_reports');
  if (error) return { ...EMPTY_REPORTS, configured: true, error: error.message };
  return parseReportsPayload(data);
}

/**
 * @purpose Parse a `get_admin_reports` payload. Pure. A missing list or series key is `null`, a present `[]` stays `[]`.
 */
export function parseReportsPayload(data: unknown): PortalReports {
  if (!data || typeof data !== 'object') return { ...EMPTY_REPORTS, configured: true };
  const row = data as Record<string, unknown>;
  const leadersRaw = row.leaders && typeof row.leaders === 'object' ? (row.leaders as Record<string, unknown>) : {};
  return {
    configured: true,
    error: null,
    generatedAt: asText(row.generated_at) || null,
    engagement: asSection(row.engagement),
    money: asSection(row.money),
    content: asSection(row.content),
    audience: asSection(row.audience),
    live: asSection(row.live),
    reliability: asSection(row.reliability),
    usage: asSection(row.usage),
    tabs: asLeaders(row.tabs),
    features: asLeaders(row.features),
    issues: asLeaders(row.issues),
    scroll: asLeaders(row.scroll),
    leaders: {
      malo: asLeaders(leadersRaw.malo),
      hype: asLeaders(leadersRaw.hype),
      schools: asLeaders(leadersRaw.schools),
    },
    series: asSeries(row.series),
  };
}

/**
 * @purpose Load company gross / net / payouts for the web Money desk.
 * @sideEffects `get_company_revenue_summary` (syncs `company_revenue_logs`).
 */
export async function fetchPortalRevenue(): Promise<PortalRevenue> {
  const supabase = await serverClient();
  if (!supabase) return { ...EMPTY_REVENUE, error: 'Supabase env missing' };
  const { data, error } = await supabase.rpc('get_company_revenue_summary');
  if (error) return { ...EMPTY_REVENUE, configured: true, error: error.message };
  return parseRevenueSummary(data);
}

/** Cents field, else the older dollars field, else `null` (absent = not in this read, never $0). */
function centsOrNull(cents: unknown, dollars: unknown): number | null {
  if (cents != null) return asIntOrNull(cents);
  if (dollars != null) return dollarsToCents(dollars);
  return null;
}

/**
 * @purpose Parse a `get_company_revenue_summary` payload. Pure. Absent totals are `null`; streams keep
 *   `platform_bps` / `payout_bps` when the RPC returns them.
 */
export function parseRevenueSummary(data: unknown): PortalRevenue {
  try {
    const payload = typeof data === 'string' ? JSON.parse(data) : Array.isArray(data) ? data[0] : data;
    if (!payload || typeof payload !== 'object') return { ...EMPTY_REVENUE, configured: true };
    const row = payload as Record<string, unknown>;
    const streams = Array.isArray(row.streams)
      ? row.streams
          .map((item): RevenueStream | null => {
            if (!item || typeof item !== 'object') return null;
            const bag = item as Record<string, unknown>;
            const label = asText(bag.label);
            if (!label) return null;
            return {
              source: asText(bag.source, label),
              label,
              split: asText(bag.split, '—'),
              gross_cents: asInt(bag.gross_cents),
              platform_cents: asInt(bag.platform_cents),
              payout_cents: asInt(bag.payout_cents),
              payee: asText(bag.payee, '—'),
              platform_bps: asIntOrNull(bag.platform_bps),
              payout_bps: asIntOrNull(bag.payout_bps),
            };
          })
          .filter((item): item is RevenueStream => Boolean(item))
      : [];
    const recent = Array.isArray(row.recent)
      ? row.recent
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const bag = item as Record<string, unknown>;
            const id = asText(bag.id);
            if (!id) return null;
            return {
              id,
              source: asText(bag.source || bag.transaction_type, 'malo'),
              label: asText(bag.label, 'Revenue'),
              gross_cents:
                bag.gross_cents != null ? asInt(bag.gross_cents) : dollarsToCents(bag.gross_amount),
              platform_cents:
                bag.platform_cents != null ? asInt(bag.platform_cents) : dollarsToCents(bag.platform_cut_amount),
              payout_cents:
                bag.payout_cents != null ? asInt(bag.payout_cents) : dollarsToCents(bag.payout_amount),
              created_at: asText(bag.created_at),
            };
          })
          .filter((item): item is RevenueLog => Boolean(item))
      : [];
    return {
      configured: true,
      error: null,
      gross_volume_cents: centsOrNull(row.gross_volume_cents, row.total_gross),
      company_net_cents: centsOrNull(row.company_net_cents, row.total_platform_revenue),
      payouts_cents: centsOrNull(row.payouts_cents, row.total_payouts),
      stripe_paid_cents: asIntOrNull(row.stripe_paid_cents),
      streams,
      recent,
    };
  } catch (caught) {
    return {
      ...EMPTY_REVENUE,
      configured: true,
      error: caught instanceof Error ? caught.message : 'Could not parse revenue summary.',
    };
  }
}

export type MaloSlice = { key: string; label: string; cents: number; count: number };
export type MaloDay = { day: string; cents: number };
export type MaloTxn = {
  id: string;
  amount_cents: number;
  created_at: string;
  origin: string;
  entry: string;
  source_label: string;
  athlete_name: string;
  fan_name: string;
  reel_id: string | null;
  wishlist_item_id: string | null;
};

export type PortalMaloBreakdown = {
  configured: boolean;
  error: string | null;
  byOrigin: MaloSlice[];
  byEntry: MaloSlice[];
  byDay: MaloDay[];
  recent: MaloTxn[];
  /** `rpc` = `get_admin_malo_breakdown`; `fallback` = built from the last 200 `tips` rows (partial); `null` = not read. */
  source: 'rpc' | 'fallback' | null;
};

/** Row cap on the `tips` fallback read. Totals built from it are partial. */
export const MALO_FALLBACK_LIMIT = 200;

const EMPTY_BREAKDOWN: PortalMaloBreakdown = {
  configured: false,
  error: null,
  source: null,
  byOrigin: [],
  byEntry: [],
  byDay: [],
  recent: [],
};

export function maloOriginTitle(origin: string): string {
  if (origin === 'highlight') return 'Highlight';
  if (origin === 'qr') return 'QR link';
  if (origin === 'wishlist') return 'Gear goal';
  if (origin === 'live') return 'Live feed';
  return 'Profile';
}

export function maloEntryTitle(entry: string): string {
  return entry === 'qr_link' ? 'QR donation link' : 'In the app';
}

export function maloChannel(origin: string, entry: string, sourceLabel: string): string {
  const via = entry === 'qr_link' && origin !== 'qr' ? ' via QR' : '';
  const detail = sourceLabel.trim() ? ` · ${sourceLabel.trim()}` : '';
  return `${maloOriginTitle(origin)}${via}${detail}`;
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object');
}

/**
 * @purpose Parse a `get_admin_malo_breakdown` payload. Pure. Marked `source: 'rpc'`.
 */
export function parseBreakdown(payload: Record<string, unknown>): PortalMaloBreakdown {
  const byOrigin = asRows(payload.by_origin).map((row) => {
    const key = asText(row.origin, 'profile');
    return { key, label: maloOriginTitle(key), cents: asInt(row.cents), count: asInt(row.count) };
  });
  const byEntry = asRows(payload.by_entry).map((row) => {
    const key = asText(row.entry, 'in_app');
    return { key, label: maloEntryTitle(key), cents: asInt(row.cents), count: asInt(row.count) };
  });
  const dayMap = new Map<string, number>();
  for (const row of asRows(payload.by_day)) {
    const day = asText(row.day);
    if (!day) continue;
    dayMap.set(day, (dayMap.get(day) ?? 0) + asInt(row.cents));
  }
  const byDay = [...dayMap.entries()].map(([day, cents]) => ({ day, cents }));
  const recent = asRows(payload.recent).map((row) => ({
    id: asText(row.id),
    amount_cents: asInt(row.amount_cents),
    created_at: asText(row.created_at),
    origin: asText(row.origin, 'profile'),
    entry: asText(row.entry, 'in_app'),
    source_label: asText(row.source_label),
    athlete_name: asText(row.athlete_name, 'Athlete'),
    fan_name: asText(row.fan_name, 'Fan'),
    reel_id: asText(row.reel_id) || null,
    wishlist_item_id: asText(row.wishlist_item_id) || null,
  })).filter((row) => row.id);
  return { configured: true, error: null, byOrigin, byEntry, byDay, recent, source: 'rpc' };
}

/**
 * @purpose Where each donation started, plus the latest donation rows, for the web Money desk.
 * @sideEffects `get_admin_malo_breakdown`. Admin-only. Falls back to a `tips` SELECT (last 200 rows, `source: 'fallback'`)
 *   when the RPC is not applied yet.
 */
export async function fetchPortalMaloBreakdown(): Promise<PortalMaloBreakdown> {
  const supabase = await serverClient();
  if (!supabase) return { ...EMPTY_BREAKDOWN, error: 'Supabase env missing' };
  const rpc = await supabase.rpc('get_admin_malo_breakdown');
  if (!rpc.error && rpc.data && typeof rpc.data === 'object') {
    return parseBreakdown(rpc.data as Record<string, unknown>);
  }
  const listed = await supabase
    .from('tips')
    .select('id, amount_cents, created_at, origin, entry, source_label, reel_id, wishlist_item_id, player_id')
    .order('created_at', { ascending: false })
    .limit(MALO_FALLBACK_LIMIT);
  if (listed.error || !Array.isArray(listed.data)) {
    return { ...EMPTY_BREAKDOWN, configured: true, error: rpc.error?.message ?? listed.error?.message ?? 'Could not load donations.' };
  }
  return breakdownFromTips(listed.data as Record<string, unknown>[]);
}

/**
 * @purpose Build the donation breakdown from raw `tips` rows (the RPC fallback). Pure. Marked `source: 'fallback'`:
 *   it only sees the rows it was given (at most `MALO_FALLBACK_LIMIT`), so its totals are partial.
 */
export function breakdownFromTips(rows: Record<string, unknown>[], now: number = Date.now()): PortalMaloBreakdown {
  const originMap = new Map<string, { cents: number; count: number }>();
  const entryMap = new Map<string, { cents: number; count: number }>();
  const dayMap = new Map<string, number>();
  const cutoff = now - 14 * 24 * 60 * 60 * 1000;
  for (const row of rows) {
    const origin = asText(row.origin, 'profile');
    const entry = asText(row.entry, 'in_app');
    const cents = asInt(row.amount_cents);
    const originBucket = originMap.get(origin) ?? { cents: 0, count: 0 };
    originBucket.cents += cents;
    originBucket.count += 1;
    originMap.set(origin, originBucket);
    const entryBucket = entryMap.get(entry) ?? { cents: 0, count: 0 };
    entryBucket.cents += cents;
    entryBucket.count += 1;
    entryMap.set(entry, entryBucket);
    const created = asText(row.created_at);
    const at = created ? new Date(created).getTime() : 0;
    if (at >= cutoff) {
      const day = created.slice(0, 10);
      dayMap.set(day, (dayMap.get(day) ?? 0) + cents);
    }
  }
  return {
    configured: true,
    error: null,
    source: 'fallback',
    byOrigin: [...originMap.entries()]
      .map(([key, bucket]) => ({ key, label: maloOriginTitle(key), ...bucket }))
      .sort((a, b) => b.cents - a.cents),
    byEntry: [...entryMap.entries()]
      .map(([key, bucket]) => ({ key, label: maloEntryTitle(key), ...bucket }))
      .sort((a, b) => b.cents - a.cents),
    byDay: [...dayMap.entries()].map(([day, cents]) => ({ day, cents })),
    recent: rows.slice(0, 40).map((row) => ({
      id: asText(row.id),
      amount_cents: asInt(row.amount_cents),
      created_at: asText(row.created_at),
      origin: asText(row.origin, 'profile'),
      entry: asText(row.entry, 'in_app'),
      source_label: asText(row.source_label),
      athlete_name: 'Athlete',
      fan_name: 'Fan',
      reel_id: asText(row.reel_id) || null,
      wishlist_item_id: asText(row.wishlist_item_id) || null,
    })).filter((row) => row.id),
  };
}
