/**
 * Tests for `lib/analytics.ts`: the measure catalog, the eight dashboards, and the chart specs.
 * They prove every chart reads a catalog key, a missing key renders `—` (not 0), only the two
 * real prior-week pairs get a delta, a prior week of 0 gives no percent, failed and unconfigured
 * reads stay distinct, and the ledger ring adds an unsplit remainder only when gross is larger.
 * Run: `node --import ./lib/analytics-resolver.mjs --test lib/*.test.ts`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BOARDS,
  GRAIN_LABEL,
  MEASURES,
  PRIOR_WEEK,
  RANKINGS,
  SERIES,
  UNIT_LABEL,
  buildAnalytics,
  formatMeasure,
  formatTick,
  knownSources,
  readMeasure,
  tickUnitFor,
  type AnalyticsChart,
} from './analytics.ts';
import type { PortalReports, PortalRevenue } from './reports.ts';

const emptyReports: PortalReports = {
  configured: true,
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
  // Series keys absent from this read are null; the lists above were read and are empty.
  series: { clips: null, malo: null, stalls: null, dwell: null },
};

const emptyRevenue: PortalRevenue = {
  configured: true,
  error: null,
  gross_volume_cents: 0,
  company_net_cents: 0,
  payouts_cents: 0,
  stripe_paid_cents: 0,
  streams: [],
  recent: [],
};

const days = (values: number[]) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => ({ label, value: values[index] }));

/** A full read: every catalog key present with a distinct value, every list populated. */
function fullReports(): PortalReports {
  const sections: Pick<PortalReports, 'engagement' | 'money' | 'content' | 'audience' | 'live' | 'reliability' | 'usage'> = {
    engagement: {},
    money: {},
    content: {},
    audience: {},
    live: {},
    reliability: {},
    usage: {},
  };
  MEASURES.forEach((measure, index) => {
    if (measure.section !== 'revenue') sections[measure.section][measure.key] = (index + 1) * 10;
  });
  return {
    ...emptyReports,
    ...sections,
    tabs: [{ label: 'Home', value: 600000 }],
    features: [{ label: 'donate.open', value: 12 }],
    issues: [{ label: 'upload · app', value: 3 }],
    scroll: [{ label: 'Home', value: 64 }, { label: 'Local', value: 31 }],
    leaders: { malo: [{ label: 'Kaleo', value: 2500 }], hype: [{ label: 'Pick six', value: 40 }], schools: [{ label: 'Kahuku', value: 9 }] },
    series: { clips: days([1, 2, 3, 4, 5, 6, 7]), malo: days([0, 0, 500, 0, 0, 1200, 0]), stalls: days([0, 1, 0, 0, 0, 0, 2]), dwell: days([60000, 0, 0, 0, 0, 0, 120000]) },
  };
}

const fullRevenue: PortalRevenue = {
  ...emptyRevenue,
  gross_volume_cents: 10000,
  company_net_cents: 1000,
  payouts_cents: 8000,
  stripe_paid_cents: 9500,
  streams: [{ source: 'malo', label: 'Donations', split: '10/90', gross_cents: 10000, platform_cents: 1000, payout_cents: 8000, payee: 'Athlete' }],
};

function chart(boards: ReturnType<typeof buildAnalytics>['boards'], id: string): AnalyticsChart {
  const found = boards.flatMap((board) => board.charts).find((item) => item.id === id);
  assert.ok(found, `chart ${id} exists`);
  return found;
}

test('the catalog names every report key once and every board has a KPI row from its own measures', () => {
  const keys = MEASURES.map((measure) => measure.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(BOARDS.length, 8);
  assert.equal(SERIES.length, 4);
  for (const board of BOARDS) {
    assert.ok(board.tileKeys.length >= 1);
    for (const key of board.tileKeys) {
      assert.ok(MEASURES.some((measure) => measure.key === key && measure.board === board.id), `${key} is on ${board.id}`);
    }
  }
  assert.equal(MEASURES.filter((measure) => measure.section === 'revenue').length, 4);
  for (const measure of MEASURES) {
    assert.ok(GRAIN_LABEL[measure.grain]);
    assert.ok(UNIT_LABEL[measure.unit]);
  }
});

test('no catalog entry names an unmeasured rate', () => {
  const words = /retention|returning|conversion|daily active|\bDAU\b|acquisition|\bCAC\b|lifetime/i;
  for (const measure of MEASURES) assert.doesNotMatch(`${measure.label} ${measure.note}`, words);
  for (const ranking of RANKINGS) assert.doesNotMatch(ranking.title, words);
});

test('scroll is in the rankings with its note, as a percent on Attention', () => {
  const scroll = RANKINGS.find((ranking) => ranking.id === 'scroll');
  assert.equal(scroll?.source, 'get_admin_reports.scroll');
  assert.equal(scroll?.note, 'Average scroll sample per surface, 7 days. Not a share of people.');
  const { boards, lists } = buildAnalytics(fullReports(), fullRevenue);
  const spec = chart(boards, 'ranking-scroll');
  assert.equal(spec.format, 'percent');
  assert.equal(boards.find((board) => board.charts.includes(spec))?.id, 'attention');
  assert.ok(spec.kind === 'bars');
  assert.deepEqual(spec.points, [{ label: 'Home', value: 64 }, { label: 'Local', value: 31 }]);
  assert.equal(lists.find((row) => row.id === 'scroll')?.value, '2 rows');
});

test('every chart reads only catalog sources, and its points come from those keys', () => {
  const reports = fullReports();
  const { boards } = buildAnalytics(reports, fullRevenue);
  const known = knownSources();
  const ids = new Set<string>();
  for (const board of boards) {
    assert.ok(board.charts.length >= 1, `${board.id} has a chart`);
    for (const spec of board.charts) {
      assert.ok(!ids.has(spec.id), `${spec.id} is unique`);
      ids.add(spec.id);
      assert.ok(spec.keys.length >= 1);
      for (const key of spec.keys) assert.ok(known.has(key), `${spec.id} reads ${key}, which is in the catalog`);
    }
  }
  const clips = chart(boards, 'series-clips');
  assert.ok(clips.kind === 'columns');
  assert.deepEqual(clips.points, reports.series.clips);
  const dwell = chart(boards, 'series-dwell');
  assert.ok(dwell.kind === 'line');
  assert.equal(dwell.format, 'minutes');
  const stalls = chart(boards, 'series-stalls');
  assert.equal(stalls.accent, 'bad');
  const hype = chart(boards, 'split-hype');
  assert.ok(hype.kind === 'split');
  assert.deepEqual(hype.parts.map((part) => part.value), [reports.engagement.seki, reports.engagement.aura, reports.engagement.flex]);
  const categories = chart(boards, 'split-categories');
  assert.ok(categories.kind === 'split');
  assert.deepEqual(categories.parts.map((part) => part.label), ['Game Day', 'Train Like Me', 'Serve Like Me']);
  const games = chart(boards, 'split-games');
  assert.ok(games.kind === 'split');
  assert.deepEqual(games.parts.map((part) => part.value), [reports.live.live_games, reports.live.parked_games]);
  const tabs = chart(boards, 'ranking-tabs');
  assert.equal(tabs.format, 'minutes');
  const streams = chart(boards, 'ledger-streams');
  assert.ok(streams.kind === 'stack');
  assert.deepEqual(streams.rows, [{ label: 'Donations', segments: { platform_cents: 1000, payout_cents: 8000 }, total: 10000 }]);
});

test('a missing measure stays blank and a recorded zero stays zero', () => {
  const { boards, catalog } = buildAnalytics({ ...emptyReports, engagement: { clips_7d: 0, seki: 4 } }, emptyRevenue);
  const highlights = boards.find((board) => board.id === 'highlights')!;
  const head = highlights.tiles[0];
  assert.equal(head.key, 'clips_7d');
  assert.equal(head.value, '0');
  assert.equal(head.missing, false);
  assert.equal(highlights.tiles.find((tile) => tile.key === 'clips_live')?.value, '—');
  assert.equal(highlights.tiles.find((tile) => tile.key === 'clips_live')?.missing, true);
  assert.equal(catalog.find((row) => row.key === 'clips_live')?.value, '—');
  assert.equal(catalog.find((row) => row.key === 'clips_7d')?.value, '0');
  const hype = chart(boards, 'split-hype');
  assert.ok(hype.kind === 'split');
  assert.deepEqual(hype.parts.map((part) => part.value), [4, null, null]);
  // A read with no series key gives null (not in this read), not seven zeros.
  const clips = chart(boards, 'series-clips');
  assert.ok(clips.kind === 'columns');
  assert.equal(clips.points, null);
  // An empty ranking from a working read is an empty list, which the chart shows as empty, not missing.
  const tabs = chart(boards, 'ranking-tabs');
  assert.ok(tabs.kind === 'bars');
  assert.deepEqual(tabs.points, []);
});

test('only clips and donations get a delta, and a prior week of 0 gives no percent', () => {
  const { boards } = buildAnalytics(fullReports(), fullRevenue);
  const withDelta = boards.flatMap((board) => board.tiles).filter((tile) => tile.delta);
  assert.deepEqual(withDelta.map((tile) => tile.key).sort(), Object.keys(PRIOR_WEEK).sort());

  const up = buildAnalytics({ ...emptyReports, money: { malo_cents_7d: 1500, malo_cents_prev_7d: 1000 } }, emptyRevenue);
  const upCompare = chart(up.boards, 'compare-malo_cents_7d');
  assert.ok(upCompare.kind === 'compare');
  assert.match(upCompare.sentence, /up 50%/);
  assert.deepEqual(up.boards.find((board) => board.id === 'donations')?.tiles[0].delta, { current: 1500, previous: 1000 });

  const fresh = buildAnalytics({ ...emptyReports, money: { malo_cents_7d: 1500, malo_cents_prev_7d: 0 } }, emptyRevenue);
  const freshCompare = chart(fresh.boards, 'compare-malo_cents_7d');
  assert.ok(freshCompare.kind === 'compare');
  assert.match(freshCompare.sentence, /no percent/);
  assert.doesNotMatch(freshCompare.sentence, /\d+%/);

  const half = buildAnalytics({ ...emptyReports, engagement: { clips_7d: 5 } }, emptyRevenue);
  const halfCompare = chart(half.boards, 'compare-clips_7d');
  assert.ok(halfCompare.kind === 'compare');
  assert.equal(halfCompare.previous.value, null);
  assert.doesNotMatch(halfCompare.sentence, /%/);
  assert.equal(half.boards.find((board) => board.id === 'highlights')?.tiles[0].delta, null);
});

test('a failed read is an error, not zeros, and an unconfigured portal is missing, not an error', () => {
  const failed = buildAnalytics({ ...emptyReports, error: 'permission denied' }, emptyRevenue);
  const highlights = failed.boards.find((board) => board.id === 'highlights')!;
  assert.equal(highlights.state, 'error');
  assert.equal(highlights.error, 'permission denied');
  assert.ok(highlights.tiles.every((tile) => tile.missing && tile.value === '—'));
  assert.ok(highlights.charts.every((spec) => spec.error === 'permission denied'));
  // The ledger is a separate read and still works.
  const ledger = failed.boards.find((board) => board.id === 'ledger')!;
  assert.equal(ledger.state, 'ok');
  assert.equal(ledger.tiles[0].value, '$0.00');

  const revenueDown = buildAnalytics(emptyReports, { ...emptyRevenue, error: 'down' });
  const downLedger = revenueDown.boards.find((board) => board.id === 'ledger')!;
  assert.equal(downLedger.state, 'error');
  assert.equal(downLedger.tiles[0].value, '—');
  assert.ok(downLedger.charts.every((spec) => spec.error === 'down'));
  assert.equal(revenueDown.catalog.length, MEASURES.length);

  const unset = buildAnalytics({ ...emptyReports, configured: false, error: 'Supabase env missing' }, { ...emptyRevenue, configured: false, error: 'Supabase env missing' });
  assert.equal(unset.reportsState, 'unconfigured');
  assert.equal(unset.revenueState, 'unconfigured');
  for (const board of unset.boards) {
    assert.equal(board.state, 'unconfigured');
    assert.equal(board.error, null);
    assert.ok(board.charts.every((spec) => spec.error === null));
  }
  const trust = chart(unset.boards, 'bars-trust');
  assert.ok(trust.kind === 'bars');
  assert.equal(trust.points, null);
  assert.ok(unset.catalog.every((row) => row.missing));
  assert.ok(unset.lists.every((row) => row.missing && row.value === '—'));
});

test('the ledger ring adds the unsplit remainder only when gross is larger than share plus payouts', () => {
  const { boards } = buildAnalytics(emptyReports, fullRevenue);
  const ring = chart(boards, 'ledger-ring');
  assert.ok(ring.kind === 'ring');
  assert.deepEqual(ring.parts.map((part) => [part.label, part.value]), [
    ['Tapua\'i recorded share', 1000],
    ['Recorded payouts', 8000],
    ['Recorded gross not split', 1000],
  ]);
  assert.equal(ring.centerValue, '$100.00');

  const even = buildAnalytics(emptyReports, { ...fullRevenue, payouts_cents: 9000 });
  const evenRing = chart(even.boards, 'ledger-ring');
  assert.ok(evenRing.kind === 'ring');
  assert.equal(evenRing.parts.length, 2);
  assert.equal(evenRing.totalLabel, 'Recorded gross');

  const over = buildAnalytics(emptyReports, { ...fullRevenue, payouts_cents: 9500 });
  const overRing = chart(over.boards, 'ledger-ring');
  assert.ok(overRing.kind === 'ring');
  assert.equal(overRing.parts.length, 2);
  assert.equal(overRing.totalLabel, 'Share plus payouts');
  assert.match(overRing.caption, /\$5\.00 more than recorded gross/);
});

test('audience verified share is a meter of two catalog keys', () => {
  const { boards } = buildAnalytics({ ...emptyReports, audience: { verified: 3, profiles: 12 } }, emptyRevenue);
  const meter = boards.find((board) => board.id === 'audience')?.meters[0];
  assert.equal(meter?.part, 3);
  assert.equal(meter?.whole, 12);
  const missing = buildAnalytics({ ...emptyReports, audience: { verified: 3 } }, emptyRevenue);
  assert.equal(missing.boards.find((board) => board.id === 'audience')?.meters[0].whole, null);
});

test('units format as the catalog says', () => {
  assert.equal(formatMeasure('cents', 1500), '$15.00');
  assert.equal(formatMeasure('minutes', 180000), '3 min');
  assert.equal(formatMeasure('milliseconds', 1234), '1,234 ms');
  assert.equal(formatMeasure('percent', 64), '64%');
  assert.equal(formatMeasure('count', 12000), '12,000');
  assert.equal(formatTick('cents', 150000), '$1.5K');
  assert.equal(formatTick('cents', 2500), '$25');
  assert.equal(tickUnitFor('minutes'), 60000);
  assert.equal(tickUnitFor('cents'), 100);
  assert.equal(tickUnitFor('count'), 1);
});

test('a ranking missing from the read is null, a present empty one is [], and a missing ledger total is null', () => {
  const { boards } = buildAnalytics({ ...emptyReports, tabs: null, features: [] }, { ...fullRevenue, stripe_paid_cents: null });
  const tabs = chart(boards, 'ranking-tabs');
  assert.ok(tabs.kind === 'bars');
  assert.equal(tabs.points, null);
  const features = chart(boards, 'ranking-features');
  assert.ok(features.kind === 'bars');
  assert.deepEqual(features.points, []);
  assert.equal(readMeasure('stripe_paid_cents', emptyReports, { ...fullRevenue, stripe_paid_cents: null }), null);
  assert.equal(readMeasure('gross_volume_cents', emptyReports, fullRevenue), 10000);
});
