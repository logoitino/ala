/**
 * Reports + Money loaders for the Next admin portal.
 * Same RPCs Expo `/admin/reports` and `/admin/money` call.
 */

import { getSupabaseServerClient } from '@/lib/supabase';

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
  tabs: ReportLeader[];
  features: ReportLeader[];
  issues: ReportLeader[];
  scroll: ReportLeader[];
  leaders: { malo: ReportLeader[]; hype: ReportLeader[]; schools: ReportLeader[] };
};

export type RevenueStream = {
  source: string;
  label: string;
  split: string;
  gross_cents: number;
  platform_cents: number;
  payout_cents: number;
  payee: string;
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
  gross_volume_cents: number;
  company_net_cents: number;
  payouts_cents: number;
  stripe_paid_cents: number;
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
  tabs: [],
  features: [],
  issues: [],
  scroll: [],
  leaders: { malo: [], hype: [], schools: [] },
};

const EMPTY_REVENUE: PortalRevenue = {
  configured: false,
  error: null,
  gross_volume_cents: 0,
  company_net_cents: 0,
  payouts_cents: 0,
  stripe_paid_cents: 0,
  streams: [],
  recent: [],
};

function asInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
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

function asLeaders(value: unknown): ReportLeader[] {
  if (!Array.isArray(value)) return [];
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
  seki: 'Seki',
  aura: 'Aura',
  flex: 'Flex',
  hype_votes: 'Hype votes',
  saves: 'Saves',
  crew_follows: 'Crew follows',
  malo_cents_all: 'Mālo all-time',
  malo_count_all: 'Mālo count',
  malo_cents_24h: 'Mālo (24h)',
  malo_count_24h: 'Mālo count (24h)',
  malo_cents_7d: 'Mālo (7d)',
  malo_count_7d: 'Mālo count (7d)',
  avg_tip_cents_7d: 'Avg Mālo (7d)',
  queued_payouts: 'Queued payouts',
  paid_payouts_cents: 'Paid out',
  active_subs: 'Active subscribe',
  flagged: 'Open flags',
  removed: 'Removed clips',
  vault: 'Vault clips',
  exclusive_clips: 'Exclusive clips',
  flash_live: 'Flash Unlock live',
  spotlight_live: 'Live Spotlight awards',
  profiles: 'Profiles',
  athletes: 'Athletes',
  verified: 'Verified athletes',
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
  checkouts_24h: 'Checkout events (24h)',
  avg_checkout_ms_24h: 'Avg Mālo checkout ms',
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

function isMoneyKey(key: string): boolean {
  return key.includes('cents') || key.startsWith('malo_cents') || key === 'paid_payouts_cents' || key === 'avg_tip_cents_7d';
}

/**
 * @purpose Human label + value for a `get_admin_reports` metric.
 */
export function formatReportValue(key: string, value: number): string {
  if (isMoneyKey(key)) return formatUsd(value);
  if (key.includes('dwell_ms')) {
    const minutes = Math.round(value / 60000);
    return `${minutes.toLocaleString()} min`;
  }
  if (key.includes('_ms')) return `${value.toLocaleString()} ms`;
  if (key.includes('pct')) return `${value}%`;
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
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ...EMPTY_REPORTS, error: 'Supabase env missing' };
  const { data, error } = await supabase.rpc('get_admin_reports');
  if (error) return { ...EMPTY_REPORTS, configured: true, error: error.message };
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
  };
}

/**
 * @purpose Load company gross / net / payouts for the web Money desk.
 * @sideEffects `get_company_revenue_summary` (syncs `company_revenue_logs`).
 */
export async function fetchPortalRevenue(): Promise<PortalRevenue> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ...EMPTY_REVENUE, error: 'Supabase env missing' };
  const { data, error } = await supabase.rpc('get_company_revenue_summary');
  if (error) return { ...EMPTY_REVENUE, configured: true, error: error.message };
  try {
    const payload = typeof data === 'string' ? JSON.parse(data) : Array.isArray(data) ? data[0] : data;
    if (!payload || typeof payload !== 'object') return { ...EMPTY_REVENUE, configured: true };
    const row = payload as Record<string, unknown>;
    const streams = Array.isArray(row.streams)
      ? row.streams
          .map((item) => {
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
      gross_volume_cents:
        row.gross_volume_cents != null ? asInt(row.gross_volume_cents) : dollarsToCents(row.total_gross),
      company_net_cents:
        row.company_net_cents != null ? asInt(row.company_net_cents) : dollarsToCents(row.total_platform_revenue),
      payouts_cents: row.payouts_cents != null ? asInt(row.payouts_cents) : dollarsToCents(row.total_payouts),
      stripe_paid_cents: asInt(row.stripe_paid_cents),
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
