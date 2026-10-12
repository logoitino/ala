/**
 * Analytical structure for the admin portal. Every number on Analytics is a named measure
 * from `get_admin_reports` or `get_company_revenue_summary`. A key the read did not return
 * stays blank. A prior week of zero does not become a percent.
 */

import { weekChange, weekSentence } from '@/lib/dashboard';
import type { PortalReports, PortalRevenue, ReportLeader, ReportSection } from '@/lib/reports';

function formatUsd(cents: number): string {
  return (Math.max(0, cents) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export type BoardId =
  | 'highlights'
  | 'donations'
  | 'audience'
  | 'attention'
  | 'trust'
  | 'gameday'
  | 'playback'
  | 'ledger';

export type MeasureSection = keyof Pick<
  PortalReports,
  'engagement' | 'money' | 'content' | 'audience' | 'live' | 'reliability' | 'usage'
> | 'revenue';

export type MeasureUnit = 'count' | 'cents' | 'minutes' | 'milliseconds' | 'percent';

export type MeasureGrain = 'now' | '24h' | '7d' | 'prior7d' | 'all';

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
  headlineKey: string;
};

export type AnalyticsChart = {
  title: string;
  caption: string;
  kind: 'columns' | 'bars';
  points: ReportLeader[];
  format: 'count' | 'cents' | 'minutes';
};

export type AnalyticsMeasure = {
  key: string;
  label: string;
  display: string;
  note: string;
  missing: boolean;
};

export type AnalyticsBoard = {
  id: BoardId;
  title: string;
  question: string;
  headline: string;
  headlineLabel: string;
  headlineNote: string;
  measures: AnalyticsMeasure[];
  charts: AnalyticsChart[];
};

export type CatalogRow = {
  key: string;
  label: string;
  board: string;
  grain: MeasureGrain;
  unit: MeasureUnit;
  source: string;
  note: string;
};

/** The only week-versus-prior pairs the report function actually returns. */
const PRIOR_WEEK: Record<string, string> = {
  clips_7d: 'clips_prev_7d',
  malo_cents_7d: 'malo_cents_prev_7d',
};

export const BOARDS: BoardDef[] = [
  { id: 'highlights', title: 'Highlights', question: 'Are clips being posted, and are people hyping them?', headlineKey: 'clips_7d' },
  { id: 'donations', title: 'Donations', question: 'How much was donated, and where did the ledger put it?', headlineKey: 'malo_cents_7d' },
  { id: 'audience', title: 'Audience', question: 'How many accounts, athletes, and schools are on the platform?', headlineKey: 'profiles' },
  { id: 'attention', title: 'Attention', question: 'Which tabs and buttons were used?', headlineKey: 'sessions_24h' },
  { id: 'trust', title: 'Trust', question: 'What is live, flagged, removed, or locked?', headlineKey: 'flagged' },
  { id: 'gameday', title: 'Game day', question: 'What is live around a game, a poll, or the shop?', headlineKey: 'live_games' },
  { id: 'playback', title: 'Playback', question: 'Did video stall, and did checkout or the socket struggle?', headlineKey: 'stalls_24h' },
  { id: 'ledger', title: 'Ledger', question: 'What gross, share, and payouts has the company ledger recorded?', headlineKey: 'gross_volume_cents' },
];

export const MEASURES: MeasureDef[] = [
  { key: 'clips_live', board: 'highlights', section: 'engagement', label: 'Live clips', unit: 'count', grain: 'now', note: 'Clips still on Home. Removed clips are not in this count.' },
  { key: 'clips_24h', board: 'highlights', section: 'engagement', label: 'Clips uploaded, 24 hours', unit: 'count', grain: '24h', note: 'New clip rows in the last day.' },
  { key: 'clips_7d', board: 'highlights', section: 'engagement', label: 'Clips uploaded, 7 days', unit: 'count', grain: '7d', note: 'New clip rows this week.' },
  { key: 'clips_prev_7d', board: 'highlights', section: 'engagement', label: 'Clips uploaded, the week before', unit: 'count', grain: 'prior7d', note: 'The week used as the comparison. It is not a second current week.' },
  { key: 'seki', board: 'highlights', section: 'engagement', label: 'Seki', unit: 'count', grain: 'now', note: 'Seki total on live clips.' },
  { key: 'aura', board: 'highlights', section: 'engagement', label: 'Aura', unit: 'count', grain: 'now', note: 'Aura total on live clips.' },
  { key: 'flex', board: 'highlights', section: 'engagement', label: 'Flex', unit: 'count', grain: 'now', note: 'Flex total on live clips.' },
  { key: 'hype_votes', board: 'highlights', section: 'engagement', label: 'Hype votes', unit: 'count', grain: 'all', note: 'Rows in hype votes.' },
  { key: 'saves', board: 'highlights', section: 'engagement', label: 'Saves', unit: 'count', grain: 'all', note: 'Saved clips.' },
  { key: 'crew_follows', board: 'highlights', section: 'engagement', label: 'Crew follows', unit: 'count', grain: 'all', note: 'Follow rows, not distinct people.' },
  { key: 'malo_cents_all', board: 'donations', section: 'money', label: 'Donations, all time', unit: 'cents', grain: 'all', note: 'Sum of donation rows.' },
  { key: 'malo_count_all', board: 'donations', section: 'money', label: 'Donation count, all time', unit: 'count', grain: 'all', note: 'Donations, not people who donated.' },
  { key: 'malo_cents_24h', board: 'donations', section: 'money', label: 'Donations, 24 hours', unit: 'cents', grain: '24h', note: 'Sum of donation rows in the last day.' },
  { key: 'malo_count_24h', board: 'donations', section: 'money', label: 'Donation count, 24 hours', unit: 'count', grain: '24h', note: 'Donations in the last day.' },
  { key: 'malo_cents_7d', board: 'donations', section: 'money', label: 'Donations, 7 days', unit: 'cents', grain: '7d', note: 'Sum of donation rows this week.' },
  { key: 'malo_count_7d', board: 'donations', section: 'money', label: 'Donation count, 7 days', unit: 'count', grain: '7d', note: 'Donations this week.' },
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
  { key: 'dwell_ms_7d', board: 'attention', section: 'usage', label: 'Time on tabs, 7 days', unit: 'minutes', grain: '7d', note: 'Sum of tab time this week.' },
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

export const SERIES = [
  { id: 'clips', title: 'Clips uploaded', source: 'get_admin_reports.series.clips', format: 'count' as const },
  { id: 'malo', title: 'Donations', source: 'get_admin_reports.series.malo', format: 'cents' as const },
  { id: 'dwell', title: 'Time on tabs', source: 'get_admin_reports.series.dwell', format: 'minutes' as const },
  { id: 'stalls', title: 'Video stalls', source: 'get_admin_reports.series.stalls', format: 'count' as const },
] as const;

export const RANKINGS = [
  { id: 'tabs', title: 'Time by tab', source: 'get_admin_reports.tabs', note: 'Sum of tab time over 7 days. Not distinct people.' },
  { id: 'features', title: 'Feature taps', source: 'get_admin_reports.features', note: 'Taps over 7 days, excluding tab opens.' },
  { id: 'issues', title: 'Control issues and bug reports', source: 'get_admin_reports.issues', note: 'Issues over 7 days, plus open bug reports by surface.' },
  { id: 'malo', title: 'Donation leaders', source: 'get_admin_reports.leaders.malo', note: 'Top five athletes by donation cents.' },
  { id: 'hype', title: 'Hype leaders', source: 'get_admin_reports.leaders.hype', note: 'Top five live clips by Seki, Aura, and Flex combined.' },
  { id: 'schools', title: 'Athletes by school', source: 'get_admin_reports.leaders.schools', note: 'Top five schools by player rows.' },
] as const;

/**
 * @purpose Render a measure in the unit the catalog names.
 * @param unit Count, cents, minutes, milliseconds, or percent.
 * @param value The raw number from the report.
 * @returns A short display string.
 */
export function formatMeasure(unit: MeasureUnit, value: number): string {
  if (unit === 'cents') return formatUsd(value);
  if (unit === 'minutes') return `${Math.round(value / 60000).toLocaleString()} min`;
  if (unit === 'milliseconds') return `${value.toLocaleString()} ms`;
  if (unit === 'percent') return `${value}%`;
  return value.toLocaleString();
}

/**
 * @purpose Render a chart point in the series unit.
 * @param format Count, cents, or minutes.
 * @param value The raw point.
 * @returns A short display string.
 */
export function formatChartValue(format: AnalyticsChart['format'], value: number): string {
  if (format === 'cents') return formatUsd(value);
  if (format === 'minutes') return `${Math.round(value / 60000).toLocaleString()} min`;
  return value.toLocaleString();
}

function sourceOf(measure: MeasureDef): string {
  if (measure.section === 'revenue') return `get_company_revenue_summary.${measure.key}`;
  return `get_admin_reports.${measure.section}.${measure.key}`;
}

function revenueBag(revenue: PortalRevenue): ReportSection {
  return {
    gross_volume_cents: revenue.gross_volume_cents,
    company_net_cents: revenue.company_net_cents,
    payouts_cents: revenue.payouts_cents,
    stripe_paid_cents: revenue.stripe_paid_cents,
  };
}

function readMeasure(measure: MeasureDef, reports: PortalReports, revenue: PortalRevenue): number | null {
  if (measure.section === 'revenue') {
    if (revenue.error || !revenue.configured) return null;
    const bag = revenueBag(revenue);
    return Object.prototype.hasOwnProperty.call(bag, measure.key) ? bag[measure.key] : null;
  }
  if (reports.error || !reports.configured) return null;
  const bag = reports[measure.section];
  if (!Object.prototype.hasOwnProperty.call(bag, measure.key)) return null;
  return bag[measure.key];
}

function columnChart(title: string, source: string, points: ReportLeader[], format: AnalyticsChart['format']): AnalyticsChart {
  return {
    title,
    caption: `${source}. Last 7 days, UTC. One bar per day.`,
    kind: 'columns',
    points,
    format,
  };
}

function barChart(title: string, source: string, points: ReportLeader[], format: AnalyticsChart['format']): AnalyticsChart {
  return { title, caption: source, kind: 'bars', points, format };
}

function chartsFor(board: BoardId, reports: PortalReports, revenue: PortalRevenue): AnalyticsChart[] {
  if (reports.error || !reports.configured) {
    if (board !== 'ledger') return [];
  }
  if (board === 'highlights') {
    return [
      columnChart('Clips uploaded', SERIES[0].source, reports.series.clips, 'count'),
      barChart('Hype leaders', RANKINGS[4].source, reports.leaders.hype, 'count'),
    ];
  }
  if (board === 'donations') {
    return [
      columnChart('Donations', SERIES[1].source, reports.series.malo, 'cents'),
      barChart('Donation leaders', RANKINGS[3].source, reports.leaders.malo, 'cents'),
    ];
  }
  if (board === 'audience') {
    return [barChart('Athletes by school', RANKINGS[5].source, reports.leaders.schools, 'count')];
  }
  if (board === 'attention') {
    return [
      columnChart('Time on tabs', SERIES[2].source, reports.series.dwell, 'minutes'),
      barChart('Time by tab', RANKINGS[0].source, reports.tabs, 'minutes'),
      barChart('Feature taps', RANKINGS[1].source, reports.features, 'count'),
    ];
  }
  if (board === 'trust') {
    const mix = ['game_play', 'train_like_me', 'serve_like_me']
      .map((key) => MEASURES.find((measure) => measure.key === key))
      .filter((measure): measure is MeasureDef => Boolean(measure))
      .map((measure) => {
        const value = readMeasure(measure, reports, revenue);
        return value == null ? null : { label: measure.label, value };
      })
      .filter((point): point is ReportLeader => Boolean(point));
    return [barChart('Live clips by category', 'get_admin_reports.content', mix, 'count')];
  }
  if (board === 'gameday') {
    const points = MEASURES.filter((measure) => measure.board === 'gameday')
      .map((measure) => {
        const value = readMeasure(measure, reports, revenue);
        return value == null ? null : { label: measure.label, value };
      })
      .filter((point): point is ReportLeader => Boolean(point));
    return [barChart('Game day counts', 'get_admin_reports.live', points, 'count')];
  }
  if (board === 'playback') {
    return [
      columnChart('Video stalls', SERIES[3].source, reports.series.stalls, 'count'),
      barChart('Control issues and bug reports', RANKINGS[2].source, reports.issues, 'count'),
    ];
  }
  if (revenue.error || !revenue.configured) return [];
  return [
    barChart(
      'Gross by stream',
      'get_company_revenue_summary.streams',
      revenue.streams.map((stream) => ({ label: stream.label, value: stream.gross_cents })),
      'cents',
    ),
  ];
}

/**
 * @purpose Build the eight dashboards and the measure catalog from one reports read and one revenue read.
 * @param reports Parsed `get_admin_reports`.
 * @param revenue Parsed `get_company_revenue_summary`.
 * @returns Boards for the page, plus the catalog those boards were built from.
 */
export function buildAnalytics(reports: PortalReports, revenue: PortalRevenue): { boards: AnalyticsBoard[]; catalog: CatalogRow[] } {
  const catalog: CatalogRow[] = MEASURES.map((measure) => ({
    key: measure.key,
    label: measure.label,
    board: BOARDS.find((board) => board.id === measure.board)?.title ?? measure.board,
    grain: measure.grain,
    unit: measure.unit,
    source: sourceOf(measure),
    note: measure.note,
  }));

  const boards = BOARDS.map((board) => {
    const measures = MEASURES.filter((measure) => measure.board === board.id).map((measure) => {
      const value = readMeasure(measure, reports, revenue);
      return {
        key: measure.key,
        label: measure.label,
        display: value == null ? '—' : formatMeasure(measure.unit, value),
        note: measure.note,
        missing: value == null,
      };
    });
    const headlineDef = MEASURES.find((measure) => measure.key === board.headlineKey);
    const headlineValue = headlineDef ? readMeasure(headlineDef, reports, revenue) : null;
    const priorKey = PRIOR_WEEK[board.headlineKey];
    const priorDef = priorKey ? MEASURES.find((measure) => measure.key === priorKey) : undefined;
    const priorValue = priorDef ? readMeasure(priorDef, reports, revenue) : null;
    let headlineNote = headlineDef?.note ?? '';
    if (headlineDef && headlineValue != null && priorDef && priorValue != null) {
      headlineNote = weekSentence(
        headlineDef.label,
        weekChange(headlineValue, priorValue),
        (value) => formatMeasure(headlineDef.unit, value),
      );
    }
    return {
      id: board.id,
      title: board.title,
      question: board.question,
      headline: headlineValue == null || !headlineDef ? '—' : formatMeasure(headlineDef.unit, headlineValue),
      headlineLabel: headlineDef?.label ?? board.title,
      headlineNote,
      measures,
      charts: chartsFor(board.id, reports, revenue),
    };
  });

  return { boards, catalog };
}
