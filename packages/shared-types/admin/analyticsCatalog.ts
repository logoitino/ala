/**
 * Analytics measure catalog for the admin portal (`/analytics`, owned by ANALYST): board, measure, chart and
 * tile shapes plus the fixed lists of boards, named measures, daily series, rankings and their labels
 * (split out of analytics.ts for R4-03; values unchanged). Every entry names the `get_admin_reports` /
 * `get_company_revenue_summary` key it reads, so no chart can show an invented measure. `analytics.ts`
 * builds the dashboards from this catalog and re-exports it. Pure data, no React, so `node --test` can check it.
 */

import { measureColor } from './measureColors';
import { REPORT_LABELS, REPORT_NOTES, type PortalReports } from './reports';

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
  | 'donation_bands'
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
export type BarsSpec = ChartBase & {
  kind: 'bars';
  points: AnalyticsPoint[] | null;
  emptyText: string;
  keepOrder: boolean;
  /** Replaces the kit's generated sentence when set (the donation bands, and their missing note). */
  summary?: string;
};
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
    question: 'How much was donated, how often, and are any payouts queued?',
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
    title: 'Live games',
    question: 'Which games are live, and how active are polls, boosters and the shop?',
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
    question: "What gross, Tapua'i share, and payee share has the ledger recorded?",
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
  { key: 'paid_payouts_cents', board: 'donations', section: 'money', label: REPORT_LABELS.paid_payouts_cents, unit: 'cents', grain: 'all', note: REPORT_NOTES.paid_payouts_cents },
  { key: 'active_subs', board: 'donations', section: 'money', label: 'Exclusive rows marked active', unit: 'count', grain: 'now', note: 'One-time Exclusive. This is a row count, not a renewal.' },
  { key: 'under_50', board: 'donations', section: 'donation_bands', label: 'Athletes with all-time donations under $50', unit: 'count', grain: 'all', note: 'Athletes whose all-time donation total is more than $0 and under $50. A count, no names.' },
  { key: '50_to_250', board: 'donations', section: 'donation_bands', label: 'Athletes with all-time donations of $50–$250', unit: 'count', grain: 'all', note: 'Athletes whose all-time donation total is $50 or more and under $250. A count, no names.' },
  { key: '250_plus', board: 'donations', section: 'donation_bands', label: 'Athletes with all-time donations of $250 and up', unit: 'count', grain: 'all', note: 'Athletes whose all-time donation total is $250 or more. A count, no names.' },
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
  { key: 'issues_24h', board: 'attention', section: 'usage', label: 'UI issues, 24 hours', unit: 'count', grain: '24h', note: 'Problems the app logged on a button or screen in the last day.' },
  { key: 'issues_7d', board: 'attention', section: 'usage', label: 'UI issues, 7 days', unit: 'count', grain: '7d', note: 'Problems the app logged on a button or screen this week.' },
  { key: 'feedback_bugs_open', board: 'attention', section: 'usage', label: 'Open bug reports', unit: 'count', grain: 'now', note: 'Bug reports not shipped or declined.' },
  { key: 'avg_scroll_pct_7d', board: 'attention', section: 'usage', label: 'Average scroll depth, 7 days', unit: 'percent', grain: '7d', note: 'Average of the scroll samples. Not a share of people.' },
  { key: 'flagged', board: 'trust', section: 'content', label: 'Open flags', unit: 'count', grain: 'now', note: 'Flagged clips that are still up.' },
  { key: 'removed', board: 'trust', section: 'content', label: 'Removed clips', unit: 'count', grain: 'now', note: 'Clips taken off Home.' },
  { key: 'vault', board: 'trust', section: 'content', label: 'Vault clips', unit: 'count', grain: 'now', note: 'Clips locked to Vault.' },
  { key: 'exclusive_clips', board: 'trust', section: 'content', label: 'Exclusive clips', unit: 'count', grain: 'now', note: 'Clips marked one-time Exclusive.' },
  { key: 'flash_live', board: 'trust', section: 'content', label: 'Flash unlocks still open', unit: 'count', grain: 'now', note: 'Clips still up with a timed unlock open.' },
  { key: 'spotlight_live', board: 'trust', section: 'content', label: 'Spotlight awards live today', unit: 'count', grain: 'now', note: 'Awards whose dates include today.' },
  { key: 'qna', board: 'trust', section: 'content', label: REPORT_LABELS.qna, unit: 'count', grain: 'all', note: 'Request rows. Not a count of people.' },
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
  { key: 'checkouts_24h', board: 'playback', section: 'reliability', label: 'Checkout step timings, 24 hours', unit: 'count', grain: '24h', note: 'Donation checkout steps that logged a time in the last day.' },
  { key: 'avg_checkout_ms_24h', board: 'playback', section: 'reliability', label: 'Average checkout step, 24 hours', unit: 'milliseconds', grain: '24h', note: 'Mean across every logged checkout step, not one whole checkout.' },
  { key: 'events_24h', board: 'playback', section: 'reliability', label: 'Telemetry events, 24 hours', unit: 'count', grain: '24h', note: 'All telemetry rows in the last day.' },
  { key: 'gross_volume_cents', board: 'ledger', section: 'revenue', label: 'Gross recorded', unit: 'cents', grain: 'all', note: 'Company ledger gross.' },
  { key: 'company_net_cents', board: 'ledger', section: 'revenue', label: 'Tapua\'i share', unit: 'cents', grain: 'all', note: 'What the ledger recorded for Tapua\'i across every stream. Donation policy: 90% to the family account, 10% to Tapua\'i.' },
  { key: 'payouts_cents', board: 'ledger', section: 'revenue', label: 'Payee share recorded', unit: 'cents', grain: 'all', note: 'Recorded for families, Vault athletes, and booster operators. Nothing is paid out in Wave 0.' },
  { key: 'stripe_paid_cents', board: 'ledger', section: 'revenue', label: 'Payouts marked paid', unit: 'cents', grain: 'all', note: 'Disbursement rows marked paid. Same sum on the Donations and Ledger boards. Should be $0 while payouts are blocked in Wave 0.' },
];

export type SeriesId = 'clips' | 'malo' | 'dwell' | 'stalls';

export const SERIES: readonly { id: SeriesId; title: string; board: BoardId; source: string; format: MeasureUnit; accent: ChartAccent; note: string }[] = [
  { id: 'clips', title: 'Clips uploaded', board: 'highlights', source: 'get_admin_reports.series.clips', format: 'count', accent: measureColor('clips'), note: 'New clip rows per UTC day, last 7 days.' },
  { id: 'malo', title: 'Donations', board: 'donations', source: 'get_admin_reports.series.malo', format: 'cents', accent: measureColor('donations'), note: 'Sum of donation rows per UTC day, last 7 days.' },
  { id: 'dwell', title: 'Time on tabs', board: 'attention', source: 'get_admin_reports.series.dwell', format: 'minutes', accent: measureColor('timeOnTabs'), note: 'Sum of tab time per UTC day, last 7 days. Not time per person.' },
  { id: 'stalls', title: 'Video stalls', board: 'playback', source: 'get_admin_reports.series.stalls', format: 'count', accent: measureColor('stalls'), note: 'Playback stall events per UTC day, last 7 days.' },
];

export type RankingId = 'tabs' | 'features' | 'scroll' | 'issues' | 'malo' | 'hype' | 'schools';

export const RANKINGS: readonly { id: RankingId; title: string; board: BoardId; source: string; format: MeasureUnit; note: string }[] = [
  { id: 'tabs', title: 'Time on each tab', board: 'attention', source: 'get_admin_reports.tabs', format: 'minutes', note: 'Sum of tab time over 7 days. Not distinct people.' },
  { id: 'features', title: 'Taps by control', board: 'attention', source: 'get_admin_reports.features', format: 'count', note: 'Taps over 7 days, excluding tab opens.' },
  { id: 'scroll', title: 'Scroll depth by surface', board: 'attention', source: 'get_admin_reports.scroll', format: 'percent', note: 'Average scroll sample per surface, 7 days. Not a share of people.' },
  { id: 'issues', title: 'UI issues and open bugs', board: 'playback', source: 'get_admin_reports.issues', format: 'count', note: 'UI issues over 7 days (problems the app logged on a button or screen), plus open bug reports by surface.' },
  { id: 'malo', title: 'Donation totals by athlete (not drawn)', board: 'donations', source: 'get_admin_reports.leaders.malo', format: 'cents', note: 'All time, top 5, named. Read but not drawn: the portal names no one by donation total (owner decision 2026-10-12). Donations shows athletes by all-time donations instead.' },
  { id: 'hype', title: 'Most-hyped clips', board: 'highlights', source: 'get_admin_reports.leaders.hype', format: 'count', note: 'Top five live clips by Seki, Aura, and Flex combined.' },
  { id: 'schools', title: 'Schools by athletes listed', board: 'audience', source: 'get_admin_reports.leaders.schools', format: 'count', note: 'Top 5 schools · player rows.' },
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
  milliseconds: 'Duration (ms or s)',
  percent: 'Percent, an average',
};

export const STREAMS_SOURCE = 'get_company_revenue_summary.streams';
