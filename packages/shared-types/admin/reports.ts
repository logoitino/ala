/**
 * ADM-02: platform-neutral report parsers, nullable snapshots and money labels for both admins.
 * Transport stays in each application; this module never reads a session or performs I/O.
 * Missing rankings and donation bands stay missing, while measured empty lists stay empty.
 */
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
  /** `get_admin_reports.donation_bands`. `null` = not in this read (migration not applied) or not an object. */
  donationBands: DonationBands | null;
  /** `get_admin_reports.trivia` (20261020180000). `null` = not in this read; zeros = read, no rounds. */
  trivia: TriviaReport | null;
  /** `get_admin_reports.smoothness` (20261020180000 + 20261020173000 + flag). Same null semantics. */
  smoothness: SmoothnessReport | null;
};

/**
 * Athletes counted by all-time donation total (owner decision 2026-10-12). Each count is `null`
 * when that band is absent or not a number in the read, so a partial payload never shows a 0 it
 * did not return.
 */
export type DonationBands = {
  /** More than $0 and under $50. */
  under50: number | null;
  /** $50 up to (not including) $250. */
  from50to250: number | null;
  /** $250 and up. */
  over250: number | null;
};

/**
 * Trivia funnel over 7 days (behavior-logging Step 1 events). Each count is `null` when absent,
 * so a partial payload never shows a 0 it did not return. Lists keep `null` (absent) vs `[]` (empty).
 */
export type TriviaReport = {
  prepViews7d: number | null;
  startPresses7d: number | null;
  starts7d: number | null;
  answers7d: number | null;
  nexts7d: number | null;
  completes7d: number | null;
  abandons7d: number | null;
  unavailable7d: number | null;
  startFailed7d: number | null;
  answerFailed7d: number | null;
  nextFailed7d: number | null;
  explanationFailed7d: number | null;
  /** Answers per question position, position order (drop-off reads left to right). */
  byPosition7d: ReportLeader[] | null;
  /** Starts per round kind, most first. */
  startsByKind7d: ReportLeader[] | null;
};

/** Smoothness over 7 days (behavior-logging Step 2 events). Same null semantics as trivia. */
export type SmoothnessReport = {
  mounts7d: number | null;
  avgMountMs7d: number | null;
  /** Average mount ms per surface, slowest first. */
  bySurface7d: ReportLeader[] | null;
  appStarts7d: number | null;
  avgStartMs7d: number | null;
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
  donationBands: null,
  trivia: null,
  smoothness: null,
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

/** The three bands in display order: RPC key, typed field, and the label people read. */
export const DONATION_BANDS: readonly { key: 'under_50' | '50_to_250' | '250_plus'; field: keyof DonationBands; label: string }[] = [
  { key: 'under_50', field: 'under50', label: 'Under $50' },
  { key: '50_to_250', field: 'from50to250', label: '$50–$250' },
  { key: '250_plus', field: 'over250', label: '$250 and up' },
];

/** Title shared by Trends and Analytics. */
export const DONATION_BANDS_TITLE = 'Athletes by all-time donations';

/** Shown when a working read has no `donation_bands` key: the migration is not on this database yet. */
export const DONATION_BANDS_MISSING_NOTE = 'Needs the 2026-10-12 reports update on this database.';

/**
 * @purpose Parse `get_admin_reports.donation_bands`. Pure.
 * @param value The raw key: `{ under_50, 50_to_250, 250_plus }` counts.
 * @returns `null` when the key is absent, not an object, or has none of the three counts (malformed);
 *   otherwise each band is a whole count, or `null` when that band is absent or not a number (partial).
 */
export function parseDonationBands(value: unknown): DonationBands | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const bag = value as Record<string, unknown>;
  const count = (raw: unknown): number | null => {
    if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null;
    // Postgres bigint can arrive as a numeric string.
    if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number(raw.trim());
    return null;
  };
  const bands: DonationBands = { under50: count(bag.under_50), from50to250: count(bag['50_to_250']), over250: count(bag['250_plus']) };
  return bands.under50 == null && bands.from50to250 == null && bands.over250 == null ? null : bands;
}

/**
 * @purpose The three bands as chart rows in display order. A band not in the read keeps `value: null` ("—").
 */
export function donationBandRows(bands: DonationBands): { label: string; value: number | null }[] {
  return DONATION_BANDS.map((band) => ({ label: band.label, value: bands[band.field] }));
}

/**
 * @purpose One plain sentence for the bands chart: each band with its count of athletes, or "not in this read".
 */
export function donationBandsSentence(bands: DonationBands): string {
  const parts = DONATION_BANDS.map((band) => {
    const value = bands[band.field];
    if (value == null) return `${band.label}: not in this read`;
    return `${band.label}: ${value.toLocaleString('en-US')} ${value === 1 ? 'athlete' : 'athletes'}`;
  });
  return `${DONATION_BANDS_TITLE}. ${parts.join('; ')}.`;
}

/**
 * @purpose Parse `get_admin_reports.trivia`. Pure.
 * @returns `null` when the key is absent, not an object, or carries nothing recognizable (malformed);
 *   otherwise each count, or `null` when that count is absent (partial). Present `[]` lists stay `[]`.
 */
export function parseTriviaReport(value: unknown): TriviaReport | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const bag = value as Record<string, unknown>;
  const report: TriviaReport = {
    prepViews7d: asIntOrNull(bag.prep_views_7d),
    startPresses7d: asIntOrNull(bag.start_presses_7d),
    starts7d: asIntOrNull(bag.starts_7d),
    answers7d: asIntOrNull(bag.answers_7d),
    nexts7d: asIntOrNull(bag.nexts_7d),
    completes7d: asIntOrNull(bag.completes_7d),
    abandons7d: asIntOrNull(bag.abandons_7d),
    unavailable7d: asIntOrNull(bag.unavailable_7d),
    startFailed7d: asIntOrNull(bag.start_failed_7d),
    answerFailed7d: asIntOrNull(bag.answer_failed_7d),
    nextFailed7d: asIntOrNull(bag.next_failed_7d),
    explanationFailed7d: asIntOrNull(bag.explanation_failed_7d),
    byPosition7d: asLeaders(bag.by_position_7d),
    startsByKind7d: asLeaders(bag.starts_by_kind_7d),
  };
  const scalars = [report.prepViews7d, report.startPresses7d, report.starts7d, report.answers7d, report.nexts7d,
    report.completes7d, report.abandons7d, report.unavailable7d, report.startFailed7d, report.answerFailed7d,
    report.nextFailed7d, report.explanationFailed7d];
  return scalars.every((v) => v == null) && report.byPosition7d == null && report.startsByKind7d == null ? null : report;
}

/**
 * @purpose Parse `get_admin_reports.smoothness`. Pure. Same null semantics as trivia.
 */
export function parseSmoothnessReport(value: unknown): SmoothnessReport | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const bag = value as Record<string, unknown>;
  const report: SmoothnessReport = {
    mounts7d: asIntOrNull(bag.mounts_7d),
    avgMountMs7d: asIntOrNull(bag.avg_mount_ms_7d),
    bySurface7d: asLeaders(bag.by_surface_7d),
    appStarts7d: asIntOrNull(bag.app_starts_7d),
    avgStartMs7d: asIntOrNull(bag.avg_start_ms_7d),
  };
  return report.mounts7d == null && report.avgMountMs7d == null && report.bySurface7d == null
    && report.appStarts7d == null && report.avgStartMs7d == null ? null : report;
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
  paid_payouts_cents: 'Payouts marked paid',
  active_subs: 'Exclusive rows marked active',
  flagged: 'Open flags',
  removed: 'Removed clips',
  vault: 'Vault clips',
  exclusive_clips: 'Exclusive clips',
  flash_live: 'Flash unlocks still open',
  spotlight_live: 'Spotlight awards live today',
  qna: 'Subscriber Q&A requests',
  game_play: 'Game Day clips',
  train_like_me: 'Train Like Me clips',
  serve_like_me: 'Serve Like Me clips',
  profiles: 'Profiles',
  athletes: 'Athletes',
  verified: 'Verified profiles',
  admins: 'Admin accounts',
  schools: 'Schools',
  pending_verify: 'Verify queue',
  live_games: 'Live games',
  parked_games: 'Parked games',
  poll_votes: 'Poll votes',
  active_polls: 'Active polls',
  active_boosters: 'Active boosters',
  drip_skus: 'Drip products on the rack',
  stalls_24h: 'Video stalls (24h)',
  reconnects_24h: 'Reconnects (24h)',
  checkouts_24h: 'Checkout step timings (24h)',
  avg_checkout_ms_24h: 'Average checkout step (24h)',
  events_24h: 'Telemetry events (24h)',
  sessions_24h: 'Tab opens (24h)',
  dwell_ms_24h: 'Time on tabs (24h)',
  dwell_ms_7d: 'Time on tabs (7d)',
  taps_24h: 'Feature taps (24h)',
  taps_7d: 'Feature taps (7d)',
  issues_24h: 'UI issues (24h)',
  issues_7d: 'UI issues (7d)',
  feedback_bugs_open: 'Open bug reports',
  avg_scroll_pct_7d: 'Average scroll depth (7d)',
  donation_bands: DONATION_BANDS_TITLE,
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
 * @purpose Format milliseconds of time on tabs as minutes ("0 min", "<1 min", "42 min"). `tabs` and
 *   `dwell` values are ms. Same rule as `formatMinutes` in lib/dashboard.ts so Trends, Home, Health
 *   and Analytics print one value the same way.
 */
export function formatMinutes(ms: number): string {
  if (ms <= 0) return '0 min';
  if (ms < 60000) return '<1 min';
  return `${Math.round(ms / 60000).toLocaleString('en-US')} min`;
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
    donationBands: parseDonationBands(row.donation_bands),
    trivia: parseTriviaReport(row.trivia),
    smoothness: parseSmoothnessReport(row.smoothness),
  };
}

/** Short notes under a report value, where the label alone could mislead. Keyed like `REPORT_LABELS`. */
export const REPORT_NOTES: Record<string, string> = {
  paid_payouts_cents: 'Disbursement rows marked paid. Same sum on the Donations and Ledger boards. Should be $0 while payouts are blocked in Wave 0.',
  donation_bands: 'All time. Counts of athletes by all-time donation total (more than $0 and under $50, $50 to under $250, $250 and up), no names. Athletes with no donations are not counted.',
};

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

/**
 * Display name per revenue `source` (stream and `company_revenue_logs` row), so older hosted labels
 * ("Mālo Micro-Tips", "Merch & Vault Subscriptions") never show. VOICE money words.
 */
const STREAM_NAMES: Record<string, string> = {
  malo: 'Donations',
  tip: "Optional tips for Tapua'i",
  booster: 'Booster sponsorships',
  vault: 'Vault subscriptions',
  merch: 'Drip merch',
  merch_vault: 'Vault and Drip',
};

/** VOICE name for a revenue `source`; `fallback` (usually the RPC label) when the source is unknown. */
export function streamName(source: string, fallback: string): string {
  return STREAM_NAMES[source] ?? fallback;
}

/** "90" for 9000 basis points, "12.5" for 1250. */
function bpsPercent(bps: number): string {
  return (bps / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * `merch_vault` comes back with null basis points because it mixes two rates. Checked 2026-10-12 against
 * `company_revenue_bps`, `record_company_revenue` and `sync_company_revenue_logs` in
 * apps/mobile/src/backend/db/schema.sql and supabase/company_revenue.sql: vault = 2000 bps to Tapua'i,
 * the rest to the athlete (payee_kind 'athlete'); merch (Drip) = 10000 bps, payout 0. The Vault 80% is
 * "recorded for the athlete", never "family account": `get_custodial_summary` sums only `tips`, so Vault
 * money is not credited to the custodial family account (VOICE re-review 2026-10-12).
 */
const MERCH_VAULT_SPLIT = "Vault: 80% recorded for the athlete, 20% to Tapua'i · Drip: 100% to Tapua'i";

/**
 * @purpose The stated split of one `get_company_revenue_summary` stream in VOICE words, built from
 *   `payout_bps` / `platform_bps`. Never returns the RPC's raw `split` text.
 * @returns The sentence, or `null` when this read cannot support one (unknown source, missing basis
 *   points, or basis points that do not add up to 100%).
 */
export function streamSplitText(stream: Pick<RevenueStream, 'source' | 'payout_bps' | 'platform_bps'>): string | null {
  if (stream.source === 'merch_vault') return MERCH_VAULT_SPLIT;
  const payout = stream.payout_bps;
  const platform = stream.platform_bps;
  if (payout == null || platform == null || payout + platform !== 10_000) return null;
  if (stream.source === 'malo') return `${bpsPercent(payout)}% to the family account, ${bpsPercent(platform)}% to Tapua'i`;
  if (stream.source === 'booster') return `${bpsPercent(payout)}% to the operator, ${bpsPercent(platform)}% to Tapua'i`;
  if (stream.source === 'tip') return payout === 0 ? "100% to Tapua'i (donor's choice)" : null;
  return null;
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

/** Fresh missing snapshots keep one account's report state out of another account's read. */
export function emptyPortalReports(configured = false, error: string | null = null): PortalReports {
  return { ...EMPTY_REPORTS, configured, error, engagement: {}, money: {}, content: {}, audience: {}, live: {}, reliability: {}, usage: {}, leaders: { malo: null, hype: null, schools: null }, series: { clips: null, malo: null, stalls: null, dwell: null } };
}
export function emptyPortalRevenue(configured = false, error: string | null = null): PortalRevenue {
  return { ...EMPTY_REVENUE, configured, error, streams: [], recent: [] };
}
export function emptyPortalMaloBreakdown(configured = false, error: string | null = null): PortalMaloBreakdown {
  return { ...EMPTY_BREAKDOWN, configured, error, byOrigin: [], byEntry: [], byDay: [], recent: [] };
}
