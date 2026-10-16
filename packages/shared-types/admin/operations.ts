/**
 * Plain breakdowns for the Health (operations) page. The page passes report rows, the 7-day
 * series, and the live menu flags. Ranking, units, and sentences stay here so the client tabs
 * only display them. Pure data: no functions cross into the client board; each value names its
 * unit (`kind`) and the board picks the formatter. Button and error rows are telemetry keys; they
 * pass through `featureLabel` / `issueLabel` (lib/eventLabels.ts) before ranking, summaries or
 * "Every row", so the tab never shows "reel.seki" or "upload.retry · upload".
 */
import { APP_RUNTIME_FLAG_GROUPS } from '../index';

import type { ChartColor } from './measureColors';
import { formatCount, formatMinutes, formatMs, formatPercent, isMeasured, tapsPerOpen } from './dashboard';
import { featureLabel, issueLabel, labelRows } from './eventLabels';
import { measureColor } from './measureColors';

export type OperationsTabId = 'where' | 'buttons' | 'errors' | 'menus';

/** Unit of a value. The client board maps each to a formatter. */
export type OperationsKind = 'count' | 'minutes' | 'percent' | 'ms' | 'ratio';

export type OperationsBar = {
  label: string;
  value: number;
};

export type OperationsDetail = {
  label: string;
  value: string;
};

export type OperationsPoint = { label: string; value: number | null };

/** One KPI tile. `value` null = not in this read. */
export type OperationsStat = {
  key: string;
  label: string;
  value: number | null;
  kind: OperationsKind;
  hint?: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
  goodDirection?: 'up' | 'down' | 'none';
  /** Decorative 7-day line under the value; the tile repeats it as screen-reader text. */
  spark?: { points: OperationsPoint[]; accent: ChartColor };
};

/** One ranked list. `rows` null = not in this read; [] = read, nothing in the window. */
export type OperationsRanking = {
  title: string;
  caption: string;
  source: string;
  rows: OperationsBar[] | null;
  kind: OperationsKind;
  accent: ChartColor;
  emptyText: string;
  summary?: string;
};

/** One daily series. `points` null = not in this read. */
export type OperationsSeries = {
  title: string;
  source: string;
  points: OperationsPoint[] | null;
  kind: OperationsKind;
  variant: 'columns' | 'line' | 'area';
  accent: ChartColor;
};

/** Menus on and off inside one flag group. Null counts = the published flags were not read. */
export type OperationsSplit = {
  id: string;
  title: string;
  caption: string;
  on: number | null;
  off: number | null;
};

export type OperationsLens = {
  id: OperationsTabId;
  label: string;
  summary: string;
  /** Read failures for this tab. The board shows every lens's alerts once, above the tabs. */
  alerts: string[];
  stats: OperationsStat[];
  series: OperationsSeries[];
  rankings: OperationsRanking[];
  splits: OperationsSplit[];
  /** Kept for the "Every row" list and older callers. */
  bars: OperationsBar[];
  details: OperationsDetail[];
};

export type OperationsInput = {
  /** `null` = the list was not in this read; `[]` = read, nothing in the window. */
  tabs: OperationsBar[] | null;
  buttons: OperationsBar[] | null;
  appErrors: OperationsBar[] | null;
  portalErrors: string[];
  usage: Record<string, number>;
  reliability: Record<string, number>;
  published: Record<string, unknown>;
  /** Average scroll sample per surface, 7 days (`get_admin_reports.scroll`). */
  scroll?: OperationsBar[] | null;
  /** `get_admin_reports.series.dwell` and `.stalls`, oldest first. `null` = not in this read. */
  dwellSeries?: OperationsPoint[] | null;
  stallSeries?: OperationsPoint[] | null;
  /** False when the reports read failed or Supabase is not set up: every report number is missing. */
  reportsOk?: boolean;
  /** False when the published flags were not read. Menus are then missing, not "all on". */
  runtimeOk?: boolean;
};

function ranked(rows: OperationsBar[]): OperationsBar[] {
  return [...rows].filter((row) => row.label.trim()).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function topSentence(kind: string, rows: OperationsBar[], empty: string): string {
  const top = ranked(rows)[0];
  if (!top || top.value <= 0) return empty;
  return `${top.label} is ${kind}.`;
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function flagOn(published: Record<string, unknown>, path: string): boolean | null {
  const [root, key] = path.split('.');
  if (!root || !key) return null;
  const group = published[root];
  if (!isPlain(group)) return null;
  const value = group[key];
  return typeof value === 'boolean' ? value : null;
}

/** Report keys with their unit, so the detail list never prints milliseconds as a count. */
function kindOfKey(key: string): OperationsKind {
  if (key.startsWith('dwell_ms')) return 'minutes';
  if (key.endsWith('_ms_24h') || key.includes('_ms')) return 'ms';
  if (key.includes('pct')) return 'percent';
  return 'count';
}

/**
 * @purpose Format one value by its unit. Shared by the server lib and the client board.
 * @param kind Unit of the value.
 * @param value Raw number from the read.
 * @returns Display text, e.g. "12 min", "42%", "850 ms", "1.3 s".
 */
export function formatOperationsValue(kind: OperationsKind, value: number): string {
  if (kind === 'minutes') return formatMinutes(value);
  if (kind === 'ms') return formatMs(value);
  if (kind === 'percent') return formatPercent(value);
  if (kind === 'ratio') return value.toLocaleString('en-US');
  return formatCount(value);
}

/** Kept for older callers; the words now live in `lib/eventLabels.ts` with `issueLabel`. */
export { featureLabel };

const DETAIL_LABELS: Record<string, string> = {
  sessions_24h: 'Tab opens · 24h',
  dwell_ms_24h: 'Time on tabs · 24h',
  dwell_ms_7d: 'Time on tabs · 7d',
  taps_24h: 'Feature taps · 24h',
  taps_7d: 'Feature taps · 7d',
  issues_24h: 'UI issues · 24h',
  issues_7d: 'UI issues · 7d',
  feedback_bugs_open: 'Open bug reports',
  avg_scroll_pct_7d: 'Average scroll depth · 7d',
  stalls_24h: 'Video stalls · 24h',
  reconnects_24h: 'Live reconnects · 24h',
  checkouts_24h: 'Checkout step timings · 24h',
  avg_checkout_ms_24h: 'Average checkout step · 24h',
  events_24h: 'Telemetry events · 24h',
};

function detailsFromCounts(section: Record<string, number>): OperationsDetail[] {
  return Object.entries(section)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({
      label: DETAIL_LABELS[key] ?? key.replace(/_/g, ' '),
      value: formatOperationsValue(kindOfKey(key), value),
    }));
}

function pick(section: Record<string, number>, key: string, ok: boolean): number | null {
  if (!ok) return null;
  const value = section[key];
  return isMeasured(value) ? value : null;
}

/**
 * @purpose Menus on and off per flag group, from the published runtime flags. Used by Health
 *   (Menus tab) and Product.
 * @param published `app_runtime_config.published`.
 * @param runtimeOk False when the flags were not read: counts are null, not "all on".
 * @returns One split per `APP_RUNTIME_FLAG_GROUPS` group, with the group's switch total.
 */
export function menuSplits(published: Record<string, unknown>, runtimeOk: boolean): (OperationsSplit & { total: number })[] {
  return APP_RUNTIME_FLAG_GROUPS.map((group) => {
    const values = group.flags.map(flag => flagOn(published, flag.path));
    const measured = runtimeOk && values.every(value => value != null);
    const on = values.filter(value => value === true).length;
    return {
      id: group.id,
      title: group.label,
      caption: group.hint,
      on: measured ? on : null,
      off: measured ? group.flags.length - on : null,
      total: group.flags.length,
    };
  });
}

/**
 * @purpose Four operations lenses: where people spend time, which buttons they use, errors, and which menus are on.
 * @param input Report rows and series, portal read failures, and the published menu flags.
 * @returns Where, Buttons, Errors, and Menus, each with a one-line summary, tiles, charts, and the smaller rows.
 */
export function buildOperations(input: OperationsInput): OperationsLens[] {
  const reportsOk = input.reportsOk ?? true;
  const runtimeOk = input.runtimeOk ?? true;
  const tabs = ranked(input.tabs ?? []);
  const buttons = ranked(input.buttons ?? []);
  // Raw `feature_tap` keys ("hype.seki") read as people words ("Seki on a Highlight") everywhere on the tab.
  const buttonsNamed = labelRows(buttons, featureLabel);
  // Raw `ui_issue` rows ("upload.retry · upload") read as "Upload retry (upload)" in the headline, chart and Every row.
  const appErrors = labelRows(ranked(input.appErrors ?? []), issueLabel);
  const scroll = ranked(input.scroll ?? []);
  // A list missing from the read stays null ("Not in this read"); a read empty list stays [] (empty state).
  const list = (raw: OperationsBar[] | null | undefined, rows: OperationsBar[]) => (reportsOk && raw != null ? rows : null);
  const series = (points: OperationsPoint[] | null | undefined) => (reportsOk && points && points.length > 0 ? points : null);
  const usage = (key: string) => pick(input.usage, key, reportsOk);
  const reliability = (key: string) => pick(input.reliability, key, reportsOk);

  const menuRows = APP_RUNTIME_FLAG_GROUPS.flatMap((group) =>
    group.flags.map((flag) => ({
      group: group.label,
      label: flag.label,
      on: flagOn(input.published, flag.path),
    })),
  );
  const menusOn = menuRows.filter((row) => row.on).length;
  const menusKnown = runtimeOk && menuRows.every(row => row.on != null);
  const taps24h = usage('taps_24h');
  const sessions24h = usage('sessions_24h');
  const perOpen = isMeasured(taps24h) && isMeasured(sessions24h) ? tapsPerOpen(taps24h, sessions24h) : null;
  const stalls24h = reliability('stalls_24h');
  const reconnects24h = reliability('reconnects_24h');
  const issues24h = usage('issues_24h');
  const openBugs = usage('feedback_bugs_open');
  const notRead = reportsOk ? [] : input.portalErrors;

  return [
    {
      id: 'where',
      label: 'Where',
      summary: reportsOk
        ? topSentence('where people spend the most time', tabs, 'No tab time in this window.')
        : 'The reports read did not load, so tab time is not shown.',
      alerts: notRead,
      stats: [
        { key: 'sessions_24h', label: 'Tab opens · 24h', value: sessions24h, kind: 'count', hint: 'Events, not distinct people', goodDirection: 'none' },
        { key: 'dwell_ms_24h', label: 'Time on tabs · 24h', value: usage('dwell_ms_24h'), kind: 'minutes', hint: 'Sum of tab time, all people', goodDirection: 'none' },
        {
          key: 'dwell_ms_7d',
          label: 'Time on tabs · 7d',
          value: usage('dwell_ms_7d'),
          kind: 'minutes',
          hint: 'Sum of tab time, not time per person',
          goodDirection: 'none',
          spark: series(input.dwellSeries) ? { points: input.dwellSeries ?? [], accent: measureColor('timeOnTabs') } : undefined,
        },
        { key: 'avg_scroll_pct_7d', label: 'Average scroll depth · 7d', value: usage('avg_scroll_pct_7d'), kind: 'percent', hint: 'Average scroll sample. Not a share of people.', goodDirection: 'none' },
      ],
      series: [
        { title: 'Time on tabs', source: 'get_admin_reports.series.dwell', points: series(input.dwellSeries), kind: 'minutes', variant: 'line', accent: measureColor('timeOnTabs') },
      ],
      rankings: [
        {
          title: 'Time on each tab',
          caption: 'Last 7 days · minutes, all people together',
          source: 'get_admin_reports.tabs',
          rows: list(input.tabs, tabs),
          kind: 'minutes',
          accent: measureColor('timeOnTabs'),
          emptyText: 'No tab time in the last 7 days.',
        },
        {
          title: 'Scroll depth by surface',
          caption: 'Last 7 days · average scroll sample per surface. Not a share of people.',
          source: 'get_admin_reports.scroll',
          rows: list(input.scroll, scroll),
          kind: 'percent',
          accent: measureColor('scrollDepth'),
          emptyText: 'No scroll samples in the last 7 days.',
        },
      ],
      splits: [],
      bars: tabs,
      details: detailsFromCounts(reportsOk ? input.usage : {}),
    },
    {
      id: 'buttons',
      label: 'Buttons',
      summary: reportsOk
        ? topSentence('the most tapped button', buttonsNamed, 'No button taps in this window.')
        : 'The reports read did not load, so button taps are not shown.',
      alerts: notRead,
      stats: [
        { key: 'taps_24h', label: 'Feature taps · 24h', value: taps24h, kind: 'count', hint: 'Tap events, not people', goodDirection: 'none' },
        { key: 'taps_7d', label: 'Feature taps · 7d', value: usage('taps_7d'), kind: 'count', hint: 'Tap events, not people', goodDirection: 'none' },
        {
          key: 'taps_per_open',
          label: 'Taps per tab open · 24h',
          value: perOpen,
          kind: 'ratio',
          hint: isMeasured(taps24h) && isMeasured(sessions24h) && perOpen == null ? 'No tab opens in 24 hours, so no ratio' : 'Feature taps divided by tab opens',
          goodDirection: 'none',
        },
      ],
      series: [],
      rankings: [
        {
          title: 'Most used buttons',
          caption: 'Last 7 days · taps, tab switches left out',
          source: 'get_admin_reports.features',
          rows: list(input.buttons, buttonsNamed),
          kind: 'count',
          accent: measureColor('featureTaps'),
          emptyText: 'No button taps in the last 7 days.',
        },
      ],
      splits: [],
      bars: buttonsNamed,
      details: buttonsNamed.map((row) => ({ label: row.label, value: formatCount(row.value) })),
    },
    {
      id: 'errors',
      label: 'Errors',
      summary: input.portalErrors.length
        ? 'The portal could not load a read. App errors are listed under that.'
        : topSentence('the most reported app error', appErrors, 'No app errors in this window.'),
      alerts: input.portalErrors,
      stats: [
        {
          key: 'stalls_24h',
          label: 'Video stalls · 24h',
          value: stalls24h,
          kind: 'count',
          hint: !isMeasured(stalls24h) ? '' : stalls24h > 0 ? 'Playback stalled. Fewer is better.' : 'No stalls in 24 hours',
          tone: !isMeasured(stalls24h) ? 'neutral' : stalls24h > 0 ? 'warn' : 'ok',
          goodDirection: 'down',
          spark: series(input.stallSeries) ? { points: input.stallSeries ?? [], accent: measureColor('stalls') } : undefined,
        },
        {
          key: 'reconnects_24h',
          label: 'Live reconnects · 24h',
          value: reconnects24h,
          kind: 'count',
          hint: 'Live connection dropped and came back',
          tone: !isMeasured(reconnects24h) ? 'neutral' : reconnects24h > 0 ? 'warn' : 'ok',
          goodDirection: 'down',
        },
        { key: 'checkouts_24h', label: 'Checkout step timings · 24h', value: reliability('checkouts_24h'), kind: 'count', hint: 'Donation checkout steps that logged a time', goodDirection: 'none' },
        {
          key: 'avg_checkout_ms_24h',
          label: 'Average checkout step · 24h',
          value: reliability('avg_checkout_ms_24h'),
          kind: 'ms',
          hint: 'Mean across every logged donation checkout step, not one whole checkout',
          goodDirection: 'down',
        },
        {
          key: 'issues_24h',
          label: 'UI issues · 24h',
          value: issues24h,
          kind: 'count',
          hint: 'Problems the app logged on a button or screen',
          tone: !isMeasured(issues24h) ? 'neutral' : issues24h > 0 ? 'warn' : 'ok',
          goodDirection: 'down',
        },
        {
          key: 'feedback_bugs_open',
          label: 'Open bug reports',
          value: openBugs,
          kind: 'count',
          hint: 'Feedback not shipped or declined',
          tone: !isMeasured(openBugs) ? 'neutral' : openBugs > 0 ? 'warn' : 'ok',
          goodDirection: 'down',
        },
      ],
      series: [
        { title: 'Video stalls', source: 'get_admin_reports.series.stalls', points: series(input.stallSeries), kind: 'count', variant: 'columns', accent: measureColor('stalls') },
      ],
      rankings: [
        {
          title: 'Most reported errors',
          caption: 'UI issues in the last 7 days, plus open bug reports',
          source: 'get_admin_reports.issues',
          rows: list(input.appErrors, appErrors),
          kind: 'count',
          accent: measureColor('issues'),
          emptyText: 'No app errors in this window.',
        },
      ],
      splits: [],
      bars: appErrors,
      details: [
        ...input.portalErrors.map((message) => ({ label: 'Portal', value: message })),
        ...appErrors.map((row) => ({ label: row.label, value: formatCount(row.value) })),
        ...detailsFromCounts(reportsOk ? input.reliability : {}),
      ],
    },
    {
      id: 'menus',
      label: 'Menus',
      summary: menusKnown
        ? `${menusOn} of ${menuRows.length} menus are on. Changes are made in Expo admin, then this list updates.`
        : 'The published menu switches were not read, so on and off are not shown.',
      alerts: [],
      stats: [],
      series: [],
      rankings: [],
      splits: menuSplits(input.published, runtimeOk),
      bars: menusKnown
        ? APP_RUNTIME_FLAG_GROUPS.map((group) => ({
            label: group.label,
            value: group.flags.filter((flag) => flagOn(input.published, flag.path)).length,
          }))
        : [],
      details: runtimeOk
        ? menuRows.map((row) => ({
            label: `${row.group} · ${row.label}`,
            value: row.on == null ? '—' : row.on ? 'On' : 'Off',
          }))
        : [],
    },
  ];
}
