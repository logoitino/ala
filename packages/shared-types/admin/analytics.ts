/**
 * Analytical structure for the admin portal (`/analytics`, owned by ANALYST). Every number on
 * Analytics is a named measure from `get_admin_reports` or `get_company_revenue_summary`. This
 * file turns one reports read and one revenue read into eight dashboards: a KPI row, chart specs
 * for the inline chart kit in `components/charts`, and the measure catalog. It never computes a
 * measure the report does not return. A key the read did not return stays blank (`—`), a prior
 * week of zero never becomes a percent, and only clips and gifts have a prior week.
 * Chart colours come from `lib/measureColors.ts`, stream names from `streamName`, and shared labels
 * from `REPORT_LABELS`, so a measure reads and looks the same here as on Trends, Home and Revenue.
 * Minutes and durations use the Home/Health formatters (`<1 min`, `1.3 s`). Measure and list names
 * match Health and Trends (checkout steps, "Time on each tab", "Taps by control", "Most-hyped
 * clips"). "Taps by control" and "UI issues and open bugs" name their rows with `featureLabel` /
 * `issueLabel` (lib/eventLabels.ts), never the raw telemetry key. Live games draws only the
 * live/parked split: poll, booster and shop counts are tiles or catalog rows, because an all-time
 * vote total does not belong on one chart with current counts.
 * Gifts draws "Athletes by all-time gifts" from `get_admin_reports.donation_bands` (three
 * catalog measures, counts of athletes, no names; owner decision 2026-10-12). The named
 * `leaders.malo` list is no longer drawn on any board; it stays in the list catalog by row count
 * only so every report key is still named. Bands missing from a working read (migration not applied)
 * stay blank with a note, never zeros.
 * Pure data, no React, so `node --test` can check it.
 * The measure catalog and chart / tile types live in `analyticsCatalog.ts` (split for R4-03) and are
 * re-exported here, so `@tapuai/shared-types/admin/analytics` stays the one import path.
 */

import { formatMinutes, formatMs, weekChange, weekSentence } from './dashboard';
import { featureLabel, issueLabel, labelRows } from './eventLabels';
import { measureColor } from './measureColors';
import {
  BOARDS,
  MEASURES,
  PRIOR_WEEK,
  RANKINGS,
  SERIES,
  STREAMS_SOURCE,
  type AnalyticsBoard,
  type AnalyticsChart,
  type AnalyticsMeter,
  type AnalyticsPoint,
  type AnalyticsTile,
  type BarsSpec,
  type BoardId,
  type CatalogRow,
  type ChartAccent,
  type CompareSpec,
  type ListCatalogRow,
  type MeasureDef,
  type MeasureUnit,
  type RankingId,
  type ReadState,
  type RingSpec,
  type SeriesId,
  type SplitPartSpec,
  type SplitSpec,
  type StackSpec,
  type TrendSpec,
} from './analyticsCatalog';
import {
  DONATION_BANDS,
  DONATION_BANDS_MISSING_NOTE,
  DONATION_BANDS_TITLE,
  donationBandsSentence,
  streamName,
  type PortalReports,
  type PortalRevenue,
  type ReportLeader,
} from './reports';

// Every catalog export stays reachable from this module's original path (portal `lib/analytics.ts` re-exports it).
export * from './analyticsCatalog';

const STREAMS_NOTE = 'Gross, Tapua\'i share, and payee share per stream, all time.';

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
  if (unit === 'minutes') return formatMinutes(value);
  if (unit === 'milliseconds') return formatMs(value);
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

/**
 * @purpose A measure's note, plus the 2026-10-12 update note when a gift band is blank in a
 *   working read, so "—" says why instead of looking like nothing was given.
 */
function noteFor(measure: MeasureDef, value: number | null, reports: PortalReports): string {
  if (measure.section === 'donation_bands' && value == null && stateOf(reports) === 'ok') return `${measure.note} ${DONATION_BANDS_MISSING_NOTE}`;
  return measure.note;
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
  if (measure.section === 'donation_bands') {
    // The whole key is null until the 2026-10-12 migration is applied; one band can also be null.
    const band = DONATION_BANDS.find((item) => item.key === key);
    return band && reports.donationBands ? reports.donationBands[band.field] : null;
  }
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
  if (rows == null) return null;
  // Taps and UI issues arrive as telemetry keys; they read as people words, as on Health and Trends.
  if (id === 'features') return labelRows(rows, featureLabel);
  if (id === 'issues') return labelRows(rows, issueLabel);
  return rows.map((row) => ({ label: row.label, value: row.value }));
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

/**
 * @purpose "Athletes by all-time gifts": the three `donation_bands` measures as bars in band
 *   order. Counts of athletes, no names (owner decision 2026-10-12).
 * @returns `points: null` (kit "missing") when the read did not include the key, with a summary that
 *   names the 2026-10-12 reports update; a partial key keeps its missing band as `null` ("—").
 */
function donationBands(reports: PortalReports, revenue: PortalRevenue, error: string | null): BarsSpec {
  const ok = stateOf(reports) === 'ok';
  const bands = ok ? reports.donationBands : null;
  const defs = DONATION_BANDS.map((band) => measureDef(band.key));
  let summary: string | undefined;
  if (ok) summary = bands ? donationBandsSentence(bands) : `${DONATION_BANDS_TITLE}: not in this read. ${DONATION_BANDS_MISSING_NOTE}`;
  return {
    id: 'bands-donations',
    kind: 'bars',
    title: DONATION_BANDS_TITLE,
    caption: 'All time. Counts of athletes, no names.',
    source: 'get_admin_reports.donation_bands',
    keys: defs.map(sourceOf),
    format: 'count',
    accent: measureColor('donations'),
    error,
    points: bands ? DONATION_BANDS.map((band) => ({ label: band.label, value: readMeasure(band.key, reports, revenue) })) : null,
    emptyText: 'No athletes have gifts yet.',
    // Bands, not a ranking: fixed order, no rank numbers, no "leads" line.
    keepOrder: true,
    summary,
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
    accent: current.unit === 'cents' ? measureColor('donations') : measureColor('clips'),
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
    { key: 'payouts_cents', label: 'Payee share recorded', value: payouts, color: measureColor('payeeShare') },
    { key: 'company_net_cents', label: 'Tapua\'i share', value: net, color: measureColor('tapuaiShare') },
  ];
  let caption = 'Tapua\'i share and payee share as parts of recorded gross. Current test-mode model: 90% to the family account, 10% to Tapua\'i.';
  let totalLabel = 'Recorded gross';
  if (gross != null && net != null && payouts != null) {
    const rest = gross - net - payouts;
    if (rest > 0) {
      parts.push({ key: 'gross_volume_cents', label: 'Recorded gross not split', value: rest, color: 'muted' });
    } else if (rest < 0) {
      totalLabel = 'Shares together';
      caption = `The two shares add up to ${formatUsd(-rest)} more than recorded gross, so the ring shows their sum, not gross.`;
    }
  }
  return {
    id: 'ledger-ring',
    kind: 'ring',
    title: 'Where recorded gross goes',
    caption,
    source: 'get_company_revenue_summary',
    keys: ['get_company_revenue_summary.company_net_cents', 'get_company_revenue_summary.payouts_cents', 'get_company_revenue_summary.gross_volume_cents'],
    format: 'cents',
    accent: measureColor('payeeShare'),
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
    accent: measureColor('payeeShare'),
    error: stateOf(revenue) === 'error' ? revenue.error : null,
    series: [
      { key: 'payout_cents', label: 'Payee share recorded', color: measureColor('payeeShare') },
      { key: 'platform_cents', label: 'Tapua\'i share', color: measureColor('tapuaiShare') },
    ],
    rows: ok
      ? revenue.streams.map((stream) => ({
          label: streamName(stream.source, stream.label),
          segments: { payout_cents: stream.payout_cents, platform_cents: stream.platform_cents },
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
          { key: 'seki', color: measureColor('seki') },
          { key: 'aura', color: measureColor('aura') },
          { key: 'flex', color: measureColor('flex') },
        ],
        'Hype on live clips',
        reports,
        revenue,
        error,
      ),
      ranking('hype', reports, error, measureColor('hype'), 'No live clips have hype yet.'),
    ];
  }
  if (board === 'donations') {
    return [
      trend('malo', 'area', reports, error),
      compare('malo_cents_7d', 'Gifts', 'Gifts, this week and the week before', reports, revenue, error),
      donationBands(reports, revenue, error),
    ];
  }
  if (board === 'audience') {
    // Cyan, as on Trends and Audience (no measure-map key for schools yet).
    return [ranking('schools', reports, error, measureColor('schools'), 'No athletes have a school yet.')];
  }
  if (board === 'attention') {
    return [
      trend('dwell', 'line', reports, error),
      ranking('tabs', reports, error, measureColor('timeOnTabs'), 'No tab time in the last 7 days.'),
      ranking('features', reports, error, measureColor('featureTaps'), 'No feature taps in the last 7 days.'),
      ranking('scroll', reports, error, measureColor('scrollDepth'), 'No scroll samples in the last 7 days.'),
    ];
  }
  if (board === 'trust') {
    return [
      split(
        'split-categories',
        'Live clips by category',
        'Live clips in Game Day, Train Like Me, and Serve Like Me.',
        [
          { key: 'game_play', label: 'Game Day', color: measureColor('gameDay') },
          { key: 'train_like_me', label: 'Train Like Me', color: measureColor('trainLikeMe') },
          { key: 'serve_like_me', label: 'Serve Like Me', color: measureColor('serveLikeMe') },
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
          { key: 'live_games', color: measureColor('live') },
          { key: 'parked_games', color: measureColor('parked') },
        ],
        'All games',
        reports,
        revenue,
        error,
      ),
    ];
  }
  if (board === 'playback') {
    return [
      trend('stalls', 'columns', reports, error),
      ranking('issues', reports, error, measureColor('issues'), 'No UI issues or open bugs.'),
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
      note: noteFor(measure, value, reports),
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
        stateOf(revenue) === 'ok' ? revenue.streams.map((stream) => ({ label: streamName(stream.source, stream.label), value: stream.gross_cents })) : null,
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
          note: noteFor(measure, value, reports),
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
