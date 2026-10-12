/**
 * Analytical structure for the admin portal (`/analytics`, owned by ANALYST). Every number on
 * Analytics is a named measure from `get_admin_reports` or `get_company_revenue_summary`. This
 * file turns one reports read and one revenue read into eight dashboards: a KPI row, chart specs
 * for the inline chart kit in `components/charts`, and the measure catalog. It never computes a
 * measure the report does not return. A key the read did not return stays blank (`—`), a prior
 * week of zero never becomes a percent, and only clips and donations have a prior week.
 * Pure data, no React, so `node --test` can check it.
 */

import { weekChange, weekSentence } from '@/lib/dashboard';
import type { PortalReports, PortalRevenue, ReportLeader, ReportSection } from '@/lib/reports';

export type BoardId =
  | 'highlights'
  | 'donations'
  | 'audience'
  | 'attention'
  | 'trust'
  | 'gameday'
  | 'playback'
  | 'ledger';

export type MeasureSection =
  | keyof Pick<PortalReports, 'engagement' | 'money' | 'content' | 'audience' | 'live' | 'reliability' | 'usage'>
  | 'revenue';

/** `minutes` measures arrive as milliseconds and display as minutes. */
export type MeasureUnit = 'count' | 'cents' | 'minutes' | 'milliseconds' | 'percent';

export type MeasureGrain = 'now' | '24h' | '7d' | 'prior7d' | 'all';

/** Same names as the chart kit's `ChartColor`, kept here so this file stays free of React. */
export type ChartAccent = 'jade' | 'cyan' | 'gold' | 'violet' | 'bad' | 'muted';

export type MeasureDef = {
  key: string;
  board: BoardId;
  section: MeasureSection;
  label: string;
  unit: MeasureUnit;
  grain: MeasureGrain;
  note: string;
};

export type BoardDef = {
  id: BoardId;
  title: string;
  question: string;
  /** The KPI row, first tile is the headline. Every key is in `MEASURES` on this board. */
  tileKeys: string[];
};

export type AnalyticsPoint = { label: string; value: number | null };

type ChartBase = {
  /** Unique on the page; used for React keys and the test. */
  id: string;
  title: string;
  caption: string;
  /** The RPC path that feeds the chart, shown under it. */
  source: string;
  /** Every catalog source this chart reads. Each one is in `knownSources()`. */
  keys: string[];
  format: MeasureUnit;
  accent: ChartAccent;
  /** A failed read. Null when the read worked or never ran (unconfigured). */
  error: string | null;
};

export type TrendSpec = ChartBase & { kind: 'columns' | 'line' | 'area'; windowLabel: string; points: AnalyticsPoint[] | null };
export type BarsSpec = ChartBase & { kind: 'bars'; points: AnalyticsPoint[] | null; emptyText: string; keepOrder: boolean };
export type SplitPartSpec = { key: string; label: string; value: number | null; color: ChartAccent };
export type SplitSpec = ChartBase & { kind: 'split'; parts: SplitPartSpec[]; totalLabel: string };
export type RingSpec = ChartBase & {
  kind: 'ring';
  parts: SplitPartSpec[];
  totalLabel: string;
  centerLabel: string;
  centerValue: string;
};
export type CompareSpec = ChartBase & {
  kind: 'compare';
  current: AnalyticsPoint;
  previous: AnalyticsPoint;
  subject: string;
  /** Always set, so the sentence is testable here and not only inside the component. */
  sentence: string;
};
export type StackSpec = ChartBase & {
  kind: 'stack';
  series: { key: string; label: string; color: ChartAccent }[];
  rows: { label: string; segments: Record<string, number | null>; total: number | null }[] | null;
  emptyText: string;
};

export type AnalyticsChart = TrendSpec | BarsSpec | SplitSpec | RingSpec | CompareSpec | StackSpec;

export type AnalyticsTile = {
  key: string;
  label: string;
  value: string;
  missing: boolean;
  hint: string;
  tone: 'neutral' | 'ok' | 'warn' | 'danger';
  goodDirection: 'up' | 'down' | 'none';
  /** Only for clips_7d and malo_cents_7d, and only when both weeks are in the read. */
  delta: { current: number; previous: number } | null;
  spark: { series: SeriesId; points: AnalyticsPoint[]; format: MeasureUnit; accent: ChartAccent } | null;
  source: string;
};

export type AnalyticsMeter = {
  label: string;
  part: number | null;
  whole: number | null;
  hint: string;
  source: string;
};

export type AnalyticsMeasure = {
  key: string;
  label: string;
  display: string;
  note: string;
  source: string;
  missing: boolean;
};

/** ok: the read worked. error: it failed. unconfigured: no database is set, nothing was read. */
export type ReadState = 'ok' | 'error' | 'unconfigured';

export type AnalyticsBoard = {
  id: BoardId;
  title: string;
  question: string;
  state: ReadState;
  error: string | null;
  /** RPC behind this board, named in the failed-read alert. */
  rpc: string;
  tiles: AnalyticsTile[];
  meters: AnalyticsMeter[];
  charts: AnalyticsChart[];
  measures: AnalyticsMeasure[];
};

export type CatalogRow = {
  key: string;
  label: string;
  boardId: BoardId;
  board: string;
  grain: MeasureGrain;
  unit: MeasureUnit;
  source: string;
  note: string;
  /** Current value as text, `—` when the key was not in this read. */
  value: string;
  missing: boolean;
};

export type ListCatalogRow = {
  id: string;
  title: string;
  boardId: BoardId;
  board: string;
  kind: 'series' | 'ranking' | 'streams';
  unit: MeasureUnit;
  source: string;
  note: string;
  /** "7 days", "5 rows", or `—`. */
  value: string;
  missing: boolean;
};

/** The only week-versus-prior pairs the report function actually returns. */
export const PRIOR_WEEK: Readonly<Record<string, string>> = {
  clips_7d: 'clips_prev_7d',
  malo_cents_7d: 'malo_cents_prev_7d',
};

export const BOARDS: BoardDef[] = [
  {
    id: 'highlights',
    title: 'Highlights',
    question: 'Are clips being posted, and are people hyping them?',
    tileKeys: ['clips_7d', 'clips_24h', 'clips_live', 'hype_votes'],
  },
  {
    id: 'donations',
    title: 'Donations',
    question: 'How much was donated, and to which athletes?',
    tileKeys: ['malo_cents_7d', 'malo_count_7d', 'avg_tip_cents_7d', 'malo_cents_all'],
  },
  {
    id: 'audience',
    title: 'Audience',
    question: 'How many accounts, athletes, and schools are on the platform?',
    tileKeys: ['profiles', 'athletes', 'schools', 'pending_verify'],
  },
  {
    id: 'attention',
    title: 'Attention',
    question: 'Which tabs and buttons were used, and how far did people scroll?',
    tileKeys: ['dwell_ms_7d', 'sessions_24h', 'taps_7d', 'avg_scroll_pct_7d'],
  },
  {
    id: 'trust',
    title: 'Trust',
    question: 'What is live, flagged, removed, or locked?',
    tileKeys: ['flagged', 'removed', 'vault', 'spotlight_live'],
  },
  {
    id: 'gameday',
    title: 'Game day',
    question: 'What is live around a game, a poll, or the shop?',
    tileKeys: ['live_games', 'active_polls', 'poll_votes', 'active_boosters'],
  },
  {
    id: 'playback',
    title: 'Playback',
    question: 'Did video stall, and did checkout or the socket struggle?',
    tileKeys: ['stalls_24h', 'reconnects_24h', 'checkouts_24h', 'avg_checkout_ms_24h'],
  },
  {
    id: 'ledger',
    title: 'Ledger',
    question: 'What gross, share, and payouts has the company ledger recorded?',
    tileKeys: ['gross_volume_cents', 'company_net_cents', 'payouts_cents', 'stripe_paid_cents'],
  },
];

export const MEASURES: MeasureDef[] = [
  { key: 'clips_live', board: 'highlights', section: 'engagement', label: 'Live clips', unit: 'count', grain: 'now', note: 'Clips still on Home. Removed clips are not in this count.' },
  { key: 'clips_24h', board: 'highlights', section: 'engagement', label: 'Clips uploaded, 24 hours', unit: 'count', grain: '24h', note: 'New clip rows in the last day.' },
  { key: 'clips_7d', board: 'highlights', section: 'engagement', label: 'Clips uploaded, 7 days', unit: 'count', grain: '7d', note: 'New clip rows this week.' },
  { key: 'clips_prev_7d', board: 'highlights', section: 'engagement', label: 'Clips uploaded, the week before', unit: 'count', grain: 'prior7d', note: 'The week used as the comparison. It is not a second current week.' },
  { key: 'seki', board: 'highlights', section: 'engagement', label: 'Seki', unit: 'count', grain: 'now', note: 'Seki total on live clips.' },
  { key: 'aura', board: 'highlights', section: 'engagement', label: 'Aura', unit: 'count', grain: 'now', note: 'Aura total on live clips.' },
  { key: 'flex', board: 'highlights', section: 'engagement', label: 'Flex', unit: 'count', grain: 'now', note: 'Flex total on live clips.' },
  { key: 'hype_votes', board: 'highlights', section: 'engagement', label: 'Hype votes', unit: 'count', grain: 'all', note: 'Rows in hype votes. Not distinct people.' },
  { key: 'saves', board: 'highlights', section: 'engagement', label: 'Saves', unit: 'count', grain: 'all', note: 'Saved clips.' },
  { key: 'crew_follows', board: 'highlights', section: 'engagement', label: 'Crew follows', unit: 'count', grain: 'all', note: 'Follow rows, not distinct people.' },
  { key: 'malo_cents_all', board: 'donations', section: 'money', label: 'Donations, all time', unit: 'cents', grain: 'all', note: 'Sum of donation rows.' },
  { key: 'malo_count_all', board: 'donations', section: 'money', label: 'Donation count, all time', unit: 'count', grain: 'all', note: 'Donations, not people who donated.' },
  { key: 'malo_cents_24h', board: 'donations', section: 'money', label: 'Donations, 24 hours', unit: 'cents', grain: '24h', note: 'Sum of donation rows in the last day.' },
  { key: 'malo_count_24h', board: 'donations', section: 'money', label: 'Donation count, 24 hours', unit: 'count', grain: '24h', note: 'Donations in the last day.' },
  { key: 'malo_cents_7d', board: 'donations', section: 'money', label: 'Donations, 7 days', unit: 'cents', grain: '7d', note: 'Sum of donation rows this week.' },
  { key: 'malo_count_7d', board: 'donations', section: 'money', label: 'Donation count, 7 days', unit: 'count', grain: '7d', note: 'Donations this week. Not people who donated.' },
  { key: 'malo_cents_prev_7d', board: 'donations', section: 'money', label: 'Donations, the week before', unit: 'cents', grain: 'prior7d', note: 'The week used as the comparison.' },
  { key: 'avg_tip_cents_7d', board: 'donations', section: 'money', label: 'Average donation, 7 days', unit: 'cents', grain: '7d', note: 'Mean donation this week. Not the share of people who donated.' },
  { key: 'queued_payouts', board: 'donations', section: 'money', label: 'Queued payouts', unit: 'count', grain: 'now', note: 'Payout rows waiting. Not money sent.' },
  { key: 'paid_payouts_cents', board: 'donations', section: 'money', label: 'Paid out', unit: 'cents', grain: 'all', note: 'Payout rows marked paid.' },
  { key: 'active_subs', board: 'donations', section: 'money', label: 'Exclusive rows marked active', unit: 'count', grain: 'now', note: 'One-time Exclusive. This is a row count, not a renewal.' },
  { key: 'profiles', board: 'audience', section: 'audience', label: 'Profiles', unit: 'count', grain: 'now', note: 'Account rows.' },
  { key: 'athletes', board: 'audience', section: 'audience', label: 'Athletes', unit: 'count', grain: 'now', note: 'Player rows.' },
  { key: 'verified', board: 'audience', section: 'audience', label: 'Verified profiles', unit: 'count', grain: 'now', note: 'Profiles marked verified. Not a share until it is divided by profiles.' },
  { key: 'admins', board: 'audience', section: 'audience', label: 'Admin accounts', unit: 'count', grain: 'now', note: 'Profiles with admin on.' },
  { key: 'schools', board: 'audience', section: 'audience', label: 'Schools', unit: 'count', grain: 'now', note: 'Schools in the catalog.' },
  { key: 'pending_verify', board: 'audience', section: 'audience', label: 'Verify queue', unit: 'count', grain: 'now', note: 'Verification requests still pending.' },
  { key: 'sessions_24h', board: 'attention', section: 'usage', label: 'Tab opens, 24 hours', unit: 'count', grain: '24h', note: 'Events, not distinct people.' },
  { key: 'dwell_ms_24h', board: 'attention', section: 'usage', label: 'Time on tabs, 24 hours', unit: 'minutes', grain: '24h', note: 'Sum of tab time, not time per person.' },
  { key: 'dwell_ms_7d', board: 'attention', section: 'usage', label: 'Time on tabs, 7 days', unit: 'minutes', grain: '7d', note: 'Sum of tab time this week, not time per person.' },
  { key: 'taps_24h', board: 'attention', section: 'usage', label: 'Feature taps, 24 hours', unit: 'count', grain: '24h', note: 'Button taps in the last day.' },
  { key: 'taps_7d', board: 'attention', section: 'usage', label: 'Feature taps, 7 days', unit: 'count', grain: '7d', note: 'Button taps this week.' },
  { key: 'issues_24h', board: 'attention', section: 'usage', label: 'Control issues, 24 hours', unit: 'count', grain: '24h', note: 'Recorded control problems in the last day.' },
  { key: 'issues_7d', board: 'attention', section: 'usage', label: 'Control issues, 7 days', unit: 'count', grain: '7d', note: 'Recorded control problems this week.' },
  { key: 'feedback_bugs_open', board: 'attention', section: 'usage', label: 'Open bug reports', unit: 'count', grain: 'now', note: 'Bug reports not shipped or declined.' },
  { key: 'avg_scroll_pct_7d', board: 'attention', section: 'usage', label: 'Average scroll depth, 7 days', unit: 'percent', grain: '7d', note: 'Average of the scroll samples. Not a share of people.' },
  { key: 'flagged', board: 'trust', section: 'content', label: 'Open flags', unit: 'count', grain: 'now', note: 'Flagged clips that are still up.' },
  { key: 'removed', board: 'trust', section: 'content', label: 'Removed clips', unit: 'count', grain: 'now', note: 'Clips taken off Home.' },
  { key: 'vault', board: 'trust', section: 'content', label: 'Vault clips', unit: 'count', grain: 'now', note: 'Clips locked to Vault.' },
  { key: 'exclusive_clips', board: 'trust', section: 'content', label: 'Exclusive clips', unit: 'count', grain: 'now', note: 'Clips marked one-time Exclusive.' },
  { key: 'flash_live', board: 'trust', section: 'content', label: 'Flash unlocks still open', unit: 'count', grain: 'now', note: 'Vault clips in a timed unlock.' },
  { key: 'spotlight_live', board: 'trust', section: 'content', label: 'Spotlight awards live today', unit: 'count', grain: 'now', note: 'Awards whose dates include today.' },
  { key: 'qna', board: 'trust', section: 'content', label: 'Vault questions', unit: 'count', grain: 'all', note: 'Question rows. Not a count of people.' },
  { key: 'game_play', board: 'trust', section: 'content', label: 'Game Day clips', unit: 'count', grain: 'now', note: 'Live clips in Game Day.' },
  { key: 'train_like_me', board: 'trust', section: 'content', label: 'Train Like Me clips', unit: 'count', grain: 'now', note: 'Live clips in Train Like Me.' },
  { key: 'serve_like_me', board: 'trust', section: 'content', label: 'Serve Like Me clips', unit: 'count', grain: 'now', note: 'Live clips in Serve Like Me.' },
  { key: 'live_games', board: 'gameday', section: 'live', label: 'Live games', unit: 'count', grain: 'now', note: 'Games marked active.' },
  { key: 'parked_games', board: 'gameday', section: 'live', label: 'Parked games', unit: 'count', grain: 'now', note: 'Games marked inactive.' },
  { key: 'poll_votes', board: 'gameday', section: 'live', label: 'Poll votes', unit: 'count', grain: 'all', note: 'Home plus away votes. Not distinct people.' },
  { key: 'active_polls', board: 'gameday', section: 'live', label: 'Active polls', unit: 'count', grain: 'now', note: 'Polls marked active.' },
  { key: 'active_boosters', board: 'gameday', section: 'live', label: 'Active boosters', unit: 'count', grain: 'now', note: 'Booster rows marked active.' },
  { key: 'drip_skus', board: 'gameday', section: 'live', label: 'Drip products on the rack', unit: 'count', grain: 'now', note: 'Shop products marked active.' },
  { key: 'stalls_24h', board: 'playback', section: 'reliability', label: 'Video stalls, 24 hours', unit: 'count', grain: '24h', note: 'Playback stall events in the last day.' },
  { key: 'reconnects_24h', board: 'playback', section: 'reliability', label: 'Reconnects, 24 hours', unit: 'count', grain: '24h', note: 'Socket reconnect events in the last day.' },
  { key: 'checkouts_24h', board: 'playback', section: 'reliability', label: 'Checkout events, 24 hours', unit: 'count', grain: '24h', note: 'Checkout timing events in the last day.' },
  { key: 'avg_checkout_ms_24h', board: 'playback', section: 'reliability', label: 'Average checkout time, 24 hours', unit: 'milliseconds', grain: '24h', note: 'Mean of the recorded checkout times.' },
  { key: 'events_24h', board: 'playback', section: 'reliability', label: 'Telemetry events, 24 hours', unit: 'count', grain: '24h', note: 'All telemetry rows in the last day.' },
  { key: 'gross_volume_cents', board: 'ledger', section: 'revenue', label: 'Gross recorded', unit: 'cents', grain: 'all', note: 'Company ledger gross.' },
  { key: 'company_net_cents', board: 'ledger', section: 'revenue', label: 'Tapua\'i recorded share', unit: 'cents', grain: 'all', note: 'What the ledger recorded for Tapua\'i. Donation policy is still 90 to the family.' },
  { key: 'payouts_cents', board: 'ledger', section: 'revenue', label: 'Recorded payouts', unit: 'cents', grain: 'all', note: 'Payouts in the company ledger.' },
  { key: 'stripe_paid_cents', board: 'ledger', section: 'revenue', label: 'Stripe paid', unit: 'cents', grain: 'all', note: 'Paid amount the revenue summary returned from Stripe.' },
];

export type SeriesId = 'clips' | 'malo' | 'dwell' | 'stalls';

export const SERIES: readonly { id: SeriesId; title: string; board: BoardId; source: string; format: MeasureUnit; accent: ChartAccent; note: string }[] = [
  { id: 'clips', title: 'Clips uploaded', board: 'highlights', source: 'get_admin_reports.series.clips', format: 'count', accent: 'jade', note: 'New clip rows per UTC day, last 7 days.' },
  { id: 'malo', title: 'Donations', board: 'donations', source: 'get_admin_reports.series.malo', format: 'cents', accent: 'cyan', note: 'Sum of donation rows per UTC day, last 7 days.' },
  { id: 'dwell', title: 'Time on tabs', board: 'attention', source: 'get_admin_reports.series.dwell', format: 'minutes', accent: 'gold', note: 'Sum of tab time per UTC day, last 7 days. Not time per person.' },
  { id: 'stalls', title: 'Video stalls', board: 'playback', source: 'get_admin_reports.series.stalls', format: 'count', accent: 'bad', note: 'Playback stall events per UTC day, last 7 days.' },
];

export type RankingId = 'tabs' | 'features' | 'scroll' | 'issues' | 'malo' | 'hype' | 'schools';

export const RANKINGS: readonly { id: RankingId; title: string; board: BoardId; source: string; format: MeasureUnit; note: string }[] = [
  { id: 'tabs', title: 'Time by tab', board: 'attention', source: 'get_admin_reports.tabs', format: 'minutes', note: 'Sum of tab time over 7 days. Not distinct people.' },
  { id: 'features', title: 'Feature taps', board: 'attention', source: 'get_admin_reports.features', format: 'count', note: 'Taps over 7 days, excluding tab opens.' },
  { id: 'scroll', title: 'Scroll depth by surface', board: 'attention', source: 'get_admin_reports.scroll', format: 'percent', note: 'Average scroll sample per surface, 7 days. Not a share of people.' },
  { id: 'issues', title: 'Control issues and bug reports', board: 'playback', source: 'get_admin_reports.issues', format: 'count', note: 'Issues over 7 days, plus open bug reports by surface.' },
  { id: 'malo', title: 'Athletes by donations', board: 'donations', source: 'get_admin_reports.leaders.malo', format: 'cents', note: 'Top five athletes by donation cents, all time.' },
  { id: 'hype', title: 'Hype leaders', board: 'highlights', source: 'get_admin_reports.leaders.hype', format: 'count', note: 'Top five live clips by Seki, Aura, and Flex combined.' },
  { id: 'schools', title: 'Athletes by school', board: 'audience', source: 'get_admin_reports.leaders.schools', format: 'count', note: 'Top five schools by player rows.' },
];

/** Plain words for the catalog's grain column. */
export const GRAIN_LABEL: Readonly<Record<MeasureGrain, string>> = {
  now: 'Now',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  prior7d: 'The 7 days before',
  all: 'All time',
};

/** Plain words for the catalog's unit column. */
export const UNIT_LABEL: Readonly<Record<MeasureUnit, string>> = {
  count: 'Count',
  cents: 'Dollars',
  minutes: 'Minutes',
  milliseconds: 'Milliseconds',
  percent: 'Percent, an average',
};

export const STREAMS_SOURCE ='get_company_revenue_summary.streams';

const STREAMS_NOTE = 'Gross, Tapua\'i recorded share, and payouts per revenue stream, all time.';

const WEEK = 'Last 7 days, UTC';

function formatUsd(cents: number): string {
  return (Math.max(0, cents) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * @purpose Render a measure in the unit the catalog names.
 * @param unit Count, cents, minutes (value in ms), milliseconds, or percent.
 * @param value The raw number from the report.
 * @returns A short display string.
 */
export function formatMeasure(unit: MeasureUnit, value: number): string {
  if (unit === 'cents') return formatUsd(value);
  if (unit === 'minutes') return `${Math.round(value / 60000).toLocaleString('en-US')} min`;
  if (unit === 'milliseconds') return `${Math.round(value).toLocaleString('en-US')} ms`;
  if (unit === 'percent') return `${Math.round(value).toLocaleString('en-US')}%`;
  return Math.round(value).toLocaleString('en-US');
}

/**
 * @purpose Render a chart value. Same rules as `formatMeasure`; kept as its own name for chart call sites.
 * @param format The chart's unit.
 * @param value The raw point.
 * @returns A short display string.
 */
export function formatChartValue(format: MeasureUnit, value: number): string {
  return formatMeasure(format, value);
}

/**
 * @purpose Compact gridline label, e.g. "$1.2K", so a large dollar axis stays narrow.
 * @param format The chart's unit.
 * @param value The raw tick value.
 * @returns A short label.
 */
export function formatTick(format: MeasureUnit, value: number): string {
  if (format === 'cents') {
    const dollars = Math.max(0, value) / 100;
    if (dollars >= 1000) {
      return `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(dollars)}`;
    }
    return `$${Math.round(dollars).toLocaleString('en-US')}`;
  }
  if (format === 'count' && value >= 10000) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }
  return formatMeasure(format, value);
}

/**
 * @purpose Gridline step so ticks land on round display numbers (whole minutes, whole dollars).
 * @param format The chart's unit.
 * @returns The `tickUnit` for `TrendChart`.
 */
export function tickUnitFor(format: MeasureUnit): number {
  if (format === 'minutes') return 60000;
  if (format === 'cents') return 100;
  return 1;
}

/**
 * @purpose The catalog path of a measure.
 * @param measure A catalog entry.
 * @returns `get_admin_reports.<section>.<key>` or `get_company_revenue_summary.<key>`.
 */
export function sourceOf(measure: MeasureDef): string {
  if (measure.section === 'revenue') return `get_company_revenue_summary.${measure.key}`;
  return `get_admin_reports.${measure.section}.${measure.key}`;
}

/**
 * @purpose Every source a chart may read: each measure, series, ranking, and the revenue streams.
 * @returns A set of RPC paths. A chart key outside this set would be an invented measure.
 */
export function knownSources(): Set<string> {
  return new Set<string>([
    ...MEASURES.map(sourceOf),
    ...SERIES.map((series) => series.source),
    ...RANKINGS.map((ranking) => ranking.source),
    STREAMS_SOURCE,
  ]);
}

function stateOf(read: { configured: boolean; error: string | null }): ReadState {
  if (!read.configured) return 'unconfigured';
  return read.error ? 'error' : 'ok';
}

function revenueBag(revenue: PortalRevenue): Record<string, number | null> {
  return {
    gross_volume_cents: revenue.gross_volume_cents,
    company_net_cents: revenue.company_net_cents,
    payouts_cents: revenue.payouts_cents,
    stripe_paid_cents: revenue.stripe_paid_cents,
  };
}

function measureDef(key: string): MeasureDef {
  const found = MEASURES.find((measure) => measure.key === key);
  if (!found) throw new Error(`Unknown measure ${key}`);
  return found;
}

/**
 * @purpose Read one measure. Null when the read failed, never ran, or did not return the key.
 * @param key A `MEASURES` key.
 * @param reports Parsed `get_admin_reports`.
 * @param revenue Parsed `get_company_revenue_summary`.
 * @returns The number, or null for "not in this read".
 */
export function readMeasure(key: string, reports: PortalReports, revenue: PortalRevenue): number | null {
  const measure = measureDef(key);
  if (measure.section === 'revenue') {
    if (stateOf(revenue) !== 'ok') return null;
    const bag = revenueBag(revenue);
    return Object.prototype.hasOwnProperty.call(bag, key) ? bag[key] : null;
  }
  if (stateOf(reports) !== 'ok') return null;
  const bag = reports[measure.section];
  if (!Object.prototype.hasOwnProperty.call(bag, key)) return null;
  const value = bag[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function seriesPoints(id: SeriesId, reports: PortalReports): AnalyticsPoint[] | null {
  if (stateOf(reports) !== 'ok') return null;
  const points = reports.series[id];
  // null = the key was not in the payload. A working read returns seven days; [] stays empty.
  return points == null ? null : points.map((point) => ({ label: point.label, value: point.value }));
}

function rankingRows(id: RankingId, reports: PortalReports): AnalyticsPoint[] | null {
  if (stateOf(reports) !== 'ok') return null;
  const rows: ReportLeader[] | null =
    id === 'malo' || id === 'hype' || id === 'schools' ? reports.leaders[id] : reports[id];
  // null = the list was not in the payload ("missing"); [] = read, nothing ranked (empty state).
  return rows == null ? null : rows.map((row) => ({ label: row.label, value: row.value }));
}

function seriesDef(id: SeriesId) {
  return SERIES.find((series) => series.id === id)!;
}

function rankingDef(id: RankingId) {
  return RANKINGS.find((ranking) => ranking.id === id)!;
}

function trend(
  id: SeriesId,
  variant: TrendSpec['kind'],
  reports: PortalReports,
  error: string | null,
): TrendSpec {
  const series = seriesDef(id);
  return {
    id: `series-${id}`,
    kind: variant,
    title: series.title,
    caption: series.note,
    windowLabel: WEEK,
    source: series.source,
    keys: [series.source],
    format: series.format,
    accent: series.accent,
    error,
    points: seriesPoints(id, reports),
  };
}

function ranking(id: RankingId, reports: PortalReports, error: string | null, accent: ChartAccent, emptyText: string): BarsSpec {
  const def = rankingDef(id);
  return {
    id: `ranking-${id}`,
    kind: 'bars',
    title: def.title,
    caption: def.note,
    source: def.source,
    keys: [def.source],
    format: def.format,
    accent,
    error,
    points: rankingRows(id, reports),
    emptyText,
    keepOrder: false,
  };
}

/** Bars built from named measures that are not a partition (so not a split). */
function measureBars(
  id: string,
  title: string,
  caption: string,
  keys: string[],
  reports: PortalReports,
  revenue: PortalRevenue,
  error: string | null,
  accent: ChartAccent,
): BarsSpec {
  const defs = keys.map(measureDef);
  const section = defs[0].section;
  return {
    id,
    kind: 'bars',
    title,
    caption,
    source: section === 'revenue' ? 'get_company_revenue_summary' : `get_admin_reports.${section}`,
    keys: defs.map(sourceOf),
    format: defs[0].unit,
    accent,
    error,
    points: stateOf(reports) === 'unconfigured' && section !== 'revenue' ? null : defs.map((def) => ({ label: def.label, value: readMeasure(def.key, reports, revenue) })),
    emptyText: 'No rows in this read.',
    keepOrder: true,
  };
}

function split(
  id: string,
  title: string,
  caption: string,
  parts: { key: string; label?: string; color: ChartAccent }[],
  totalLabel: string,
  reports: PortalReports,
  revenue: PortalRevenue,
  error: string | null,
): SplitSpec {
  const defs = parts.map((part) => measureDef(part.key));
  return {
    id,
    kind: 'split',
    title,
    caption,
    source: `get_admin_reports.${defs[0].section}`,
    keys: defs.map(sourceOf),
    format: defs[0].unit,
    accent: parts[0].color,
    error,
    parts: parts.map((part, index) => ({
      key: part.key,
      label: part.label ?? defs[index].label,
      value: readMeasure(part.key, reports, revenue),
      color: part.color,
    })),
    totalLabel,
  };
}

function compare(currentKey: string, subject: string, title: string, reports: PortalReports, revenue: PortalRevenue, error: string | null): CompareSpec {
  const current = measureDef(currentKey);
  const previous = measureDef(PRIOR_WEEK[currentKey]);
  const now = readMeasure(current.key, reports, revenue);
  const then = readMeasure(previous.key, reports, revenue);
  const format = (value: number) => formatMeasure(current.unit, value);
  const sentence =
    now != null && then != null
      ? weekSentence(subject, weekChange(now, then), format)
      : `${subject}: one side of this comparison is not in this read, so there is no change to report.`;
  return {
    id: `compare-${current.key}`,
    kind: 'compare',
    title,
    caption: 'This week against the 7 days before it. The only prior week the report returns for this measure.',
    source: `get_admin_reports.${current.section}`,
    keys: [sourceOf(current), sourceOf(previous)],
    format: current.unit,
    accent: current.unit === 'cents' ? 'cyan' : 'jade',
    error,
    current: { label: 'Last 7 days', value: now },
    previous: { label: 'The 7 days before', value: then },
    subject,
    sentence,
  };
}

function ledgerRing(revenue: PortalRevenue): RingSpec {
  const ok = stateOf(revenue) === 'ok';
  const gross = ok ? revenue.gross_volume_cents : null;
  const net = ok ? revenue.company_net_cents : null;
  const payouts = ok ? revenue.payouts_cents : null;
  const parts: SplitPartSpec[] = [
    { key: 'company_net_cents', label: 'Tapua\'i recorded share', value: net, color: 'jade' },
    { key: 'payouts_cents', label: 'Recorded payouts', value: payouts, color: 'cyan' },
  ];
  let caption = 'Share and payouts as parts of recorded gross. Donation policy is still 90 to the family.';
  let totalLabel = 'Recorded gross';
  if (gross != null && net != null && payouts != null) {
    const rest = gross - net - payouts;
    if (rest > 0) {
      parts.push({ key: 'gross_volume_cents', label: 'Recorded gross not split', value: rest, color: 'muted' });
    } else if (rest < 0) {
      totalLabel = 'Share plus payouts';
      caption = `Share plus payouts is ${formatUsd(-rest)} more than recorded gross, so the ring shows their sum, not gross.`;
    }
  }
  return {
    id: 'ledger-ring',
    kind: 'ring',
    title: 'Where recorded gross went',
    caption,
    source: 'get_company_revenue_summary',
    keys: ['get_company_revenue_summary.company_net_cents', 'get_company_revenue_summary.payouts_cents', 'get_company_revenue_summary.gross_volume_cents'],
    format: 'cents',
    accent: 'jade',
    error: stateOf(revenue) === 'error' ? revenue.error : null,
    parts,
    totalLabel,
    centerLabel: 'Recorded gross',
    centerValue: gross == null ? '—' : formatUsd(gross),
  };
}

function ledgerStack(revenue: PortalRevenue): StackSpec {
  const ok = stateOf(revenue) === 'ok';
  return {
    id: 'ledger-streams',
    kind: 'stack',
    title: 'Revenue streams',
    caption: STREAMS_NOTE,
    source: STREAMS_SOURCE,
    keys: [STREAMS_SOURCE],
    format: 'cents',
    accent: 'jade',
    error: stateOf(revenue) === 'error' ? revenue.error : null,
    series: [
      { key: 'platform_cents', label: 'Tapua\'i recorded share', color: 'jade' },
      { key: 'payout_cents', label: 'Recorded payouts', color: 'cyan' },
    ],
    rows: ok
      ? revenue.streams.map((stream) => ({
          label: stream.label,
          segments: { platform_cents: stream.platform_cents, payout_cents: stream.payout_cents },
          total: stream.gross_cents,
        }))
      : null,
    emptyText: 'The ledger returned no streams.',
  };
}

function chartsFor(board: BoardId, reports: PortalReports, revenue: PortalRevenue): AnalyticsChart[] {
  const error = stateOf(reports) === 'error' ? reports.error : null;
  if (board === 'highlights') {
    return [
      trend('clips', 'columns', reports, error),
      compare('clips_7d', 'Clips uploaded', 'Clips, this week and the week before', reports, revenue, error),
      split(
        'split-hype',
        'Hype on live clips',
        'Seki, Aura, and Flex totals on clips still on Home. Counts, not people.',
        [
          { key: 'seki', color: 'jade' },
          { key: 'aura', color: 'violet' },
          { key: 'flex', color: 'gold' },
        ],
        'Hype on live clips',
        reports,
        revenue,
        error,
      ),
      ranking('hype', reports, error, 'violet', 'No live clips have hype yet.'),
    ];
  }
  if (board === 'donations') {
    return [
      trend('malo', 'area', reports, error),
      compare('malo_cents_7d', 'Donations', 'Donations, this week and the week before', reports, revenue, error),
      ranking('malo', reports, error, 'cyan', 'No donations recorded yet.'),
    ];
  }
  if (board === 'audience') {
    return [ranking('schools', reports, error, 'jade', 'No athletes have a school yet.')];
  }
  if (board === 'attention') {
    return [
      trend('dwell', 'line', reports, error),
      ranking('tabs', reports, error, 'gold', 'No tab time in the last 7 days.'),
      ranking('features', reports, error, 'cyan', 'No feature taps in the last 7 days.'),
      ranking('scroll', reports, error, 'violet', 'No scroll samples in the last 7 days.'),
    ];
  }
  if (board === 'trust') {
    return [
      split(
        'split-categories',
        'Live clips by category',
        'Live clips in Game Day, Train Like Me, and Serve Like Me.',
        [
          { key: 'game_play', label: 'Game Day', color: 'jade' },
          { key: 'train_like_me', label: 'Train Like Me', color: 'cyan' },
          { key: 'serve_like_me', label: 'Serve Like Me', color: 'violet' },
        ],
        'Live clips in these categories',
        reports,
        revenue,
        error,
      ),
      measureBars(
        'bars-trust',
        'Clip states',
        'Separate counts. A clip can be in more than one, so they do not add up to a total.',
        ['flagged', 'removed', 'vault', 'exclusive_clips', 'flash_live'],
        reports,
        revenue,
        error,
        'gold',
      ),
    ];
  }
  if (board === 'gameday') {
    return [
      split(
        'split-games',
        'Games, live and parked',
        'Every game row is either active or inactive, so these two add up to all games.',
        [
          { key: 'live_games', color: 'jade' },
          { key: 'parked_games', color: 'muted' },
        ],
        'All games',
        reports,
        revenue,
        error,
      ),
      measureBars(
        'bars-gameday',
        'Around the game',
        'Separate counts from polls, boosters, and the shop. Votes are not people.',
        ['poll_votes', 'active_polls', 'active_boosters', 'drip_skus'],
        reports,
        revenue,
        error,
        'cyan',
      ),
    ];
  }
  if (board === 'playback') {
    return [
      trend('stalls', 'columns', reports, error),
      ranking('issues', reports, error, 'bad', 'No control issues or open bug reports.'),
    ];
  }
  return [ledgerRing(revenue), ledgerStack(revenue)];
}

function tileFor(key: string, reports: PortalReports, revenue: PortalRevenue): AnalyticsTile {
  const def = measureDef(key);
  const value = readMeasure(key, reports, revenue);
  const priorKey = PRIOR_WEEK[key];
  const prior = priorKey ? readMeasure(priorKey, reports, revenue) : null;
  const sparkId: SeriesId | null =
    key === 'clips_7d' ? 'clips' : key === 'malo_cents_7d' ? 'malo' : key === 'dwell_ms_7d' ? 'dwell' : key === 'stalls_24h' ? 'stalls' : null;
  const sparkPoints = sparkId ? seriesPoints(sparkId, reports) : null;
  const sparkSeries = sparkId ? seriesDef(sparkId) : null;
  const badWhenUp = ['stalls_24h', 'reconnects_24h', 'flagged', 'pending_verify', 'avg_checkout_ms_24h'].includes(key);
  let tone: AnalyticsTile['tone'] = 'neutral';
  if (value != null && value > 0 && (key === 'flagged' || key === 'pending_verify' || key === 'stalls_24h')) tone = 'warn';
  let hint = def.note;
  if (priorKey && value != null && prior == null) hint = `${def.note} The week before is not in this read.`;
  return {
    key,
    label: def.label,
    value: value == null ? '—' : formatMeasure(def.unit, value),
    missing: value == null,
    hint,
    tone,
    goodDirection: priorKey ? 'up' : badWhenUp ? 'down' : 'none',
    delta: priorKey && value != null && prior != null ? { current: value, previous: prior } : null,
    spark: sparkSeries && sparkPoints ? { series: sparkSeries.id, points: sparkPoints, format: sparkSeries.format, accent: sparkSeries.accent } : null,
    source: sourceOf(def),
  };
}

function metersFor(board: BoardId, reports: PortalReports, revenue: PortalRevenue): AnalyticsMeter[] {
  if (board !== 'audience') return [];
  return [
    {
      label: 'Verified profiles',
      part: readMeasure('verified', reports, revenue),
      whole: readMeasure('profiles', reports, revenue),
      hint: 'Verified profiles divided by all profiles. A share of accounts, not of people who use the app.',
      source: 'get_admin_reports.audience.verified / get_admin_reports.audience.profiles',
    },
  ];
}

/**
 * @purpose Current value of a series or ranking for the list catalog.
 * @returns "7 days", "5 rows", or `—` when it was not in the read.
 */
function listValue(points: AnalyticsPoint[] | null, kind: ListCatalogRow['kind']): { value: string; missing: boolean } {
  if (points == null) return { value: '—', missing: true };
  if (kind === 'series') return { value: `${points.length} ${points.length === 1 ? 'day' : 'days'}`, missing: false };
  return { value: `${points.length} ${points.length === 1 ? 'row' : 'rows'}`, missing: false };
}

/**
 * @purpose Build the eight dashboards and the measure catalog from one reports read and one revenue read.
 * @param reports Parsed `get_admin_reports`.
 * @param revenue Parsed `get_company_revenue_summary`.
 * @returns Boards, the measure catalog, the list catalog, and the four series for the week strip.
 */
export function buildAnalytics(
  reports: PortalReports,
  revenue: PortalRevenue,
): {
  boards: AnalyticsBoard[];
  catalog: CatalogRow[];
  lists: ListCatalogRow[];
  week: { id: SeriesId; title: string; format: MeasureUnit; accent: ChartAccent; points: AnalyticsPoint[] | null }[];
  reportsState: ReadState;
  revenueState: ReadState;
} {
  const boardTitle = (id: BoardId) => BOARDS.find((board) => board.id === id)?.title ?? id;

  const catalog: CatalogRow[] = MEASURES.map((measure) => {
    const value = readMeasure(measure.key, reports, revenue);
    return {
      key: measure.key,
      label: measure.label,
      boardId: measure.board,
      board: boardTitle(measure.board),
      grain: measure.grain,
      unit: measure.unit,
      source: sourceOf(measure),
      note: measure.note,
      value: value == null ? '—' : formatMeasure(measure.unit, value),
      missing: value == null,
    };
  });

  const lists: ListCatalogRow[] = [
    ...SERIES.map((series) => ({
      id: `series.${series.id}`,
      title: series.title,
      boardId: series.board,
      board: boardTitle(series.board),
      kind: 'series' as const,
      unit: series.format,
      source: series.source,
      note: series.note,
      ...listValue(seriesPoints(series.id, reports), 'series'),
    })),
    ...RANKINGS.map((item) => ({
      id: item.id === 'malo' || item.id === 'hype' || item.id === 'schools' ? `leaders.${item.id}` : item.id,
      title: item.title,
      boardId: item.board,
      board: boardTitle(item.board),
      kind: 'ranking' as const,
      unit: item.format,
      source: item.source,
      note: item.note,
      ...listValue(rankingRows(item.id, reports), 'ranking'),
    })),
    {
      id: 'streams',
      title: 'Revenue streams',
      boardId: 'ledger',
      board: boardTitle('ledger'),
      kind: 'streams',
      unit: 'cents',
      source: STREAMS_SOURCE,
      note: STREAMS_NOTE,
      ...listValue(
        stateOf(revenue) === 'ok' ? revenue.streams.map((stream) => ({ label: stream.label, value: stream.gross_cents })) : null,
        'ranking',
      ),
    },
  ];

  const boards: AnalyticsBoard[] = BOARDS.map((board) => {
    const read = board.id === 'ledger' ? revenue : reports;
    const state = stateOf(read);
    return {
      id: board.id,
      title: board.title,
      question: board.question,
      state,
      error: state === 'error' ? read.error : null,
      rpc: board.id === 'ledger' ? 'get_company_revenue_summary' : 'get_admin_reports',
      tiles: board.tileKeys.map((key) => tileFor(key, reports, revenue)),
      meters: metersFor(board.id, reports, revenue),
      charts: chartsFor(board.id, reports, revenue),
      measures: MEASURES.filter((measure) => measure.board === board.id).map((measure) => {
        const value = readMeasure(measure.key, reports, revenue);
        return {
          key: measure.key,
          label: measure.label,
          display: value == null ? '—' : formatMeasure(measure.unit, value),
          note: measure.note,
          source: sourceOf(measure),
          missing: value == null,
        };
      }),
    };
  });

  const week = SERIES.map((series) => ({
    id: series.id,
    title: series.title,
    format: series.format,
    accent: series.accent,
    points: seriesPoints(series.id, reports),
  }));

  return { boards, catalog, lists, week, reportsState: stateOf(reports), revenueState: stateOf(revenue) };
}
