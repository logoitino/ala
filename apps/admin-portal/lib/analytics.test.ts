/**
 * Tests for `lib/analytics.ts`: the measure catalog, the eight dashboards, and the chart specs.
 * They prove every chart reads a catalog key, a missing key renders `—` (not 0), only the two
 * real prior-week pairs get a delta, a prior week of 0 gives no percent, failed and unconfigured
 * reads stay distinct, and the ledger ring adds an unsplit remainder only when gross is larger.
 * They also pin the W3 wording (Donations and Live games questions, payee and paid-out notes,
 * names shared with Health and Trends) and that Live games draws only the live/parked split.
 * Tap and UI-issue rankings use people words from lib/eventLabels.ts, never the raw key.
 * Donations draws the three `donation_bands` counts (no names, owner decision 2026-10-12) and never
 * the named `leaders.malo` list; missing bands stay blank with the update note, not zeros.
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
  // The 2026-10-12 migration is not applied in this read.
  donationBands: null,
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
    if (measure.section !== 'revenue' && measure.section !== 'donation_bands') sections[measure.section][measure.key] = (index + 1) * 10;
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
    donationBands: { under50: 12, from50to250: 4, over250: 1 },
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
  const { boards } = buildAnalytics(fullReports(), fullRevenue);
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
    ['Payee share recorded', 8000],
    ['Tapua\'i share', 1000],
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
  assert.equal(overRing.totalLabel, 'Shares together');
  assert.match(overRing.caption, /add up to \$5\.00 more than recorded gross/);
  assert.equal(ring.title, 'Where recorded gross goes');
  assert.deepEqual(ring.parts.map((part) => part.color), ['jade', 'gold', 'muted']);
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
  // Same rule as Home (dashboard.formatMinutes): under a minute is "<1 min", not "0 min".
  assert.equal(formatMeasure('minutes', 30000), '<1 min');
  assert.equal(formatMeasure('minutes', 0), '0 min');
  // Same rule as Trends and Health: under a second in ms, a second or more in seconds.
  assert.equal(formatMeasure('milliseconds', 850), '850 ms');
  assert.equal(formatMeasure('milliseconds', 1260), '1.3 s');
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

test('streams use the VOICE names, never the raw database label', () => {
  const raw = buildAnalytics(emptyReports, {
    ...fullRevenue,
    streams: [
      { ...fullRevenue.streams[0], source: 'malo', label: 'M\u0101lo Micro-Tips' },
      { ...fullRevenue.streams[0], source: 'tip', label: "Optional tips to Tapua'i" },
    ],
  });
  const streams = chart(raw.boards, 'ledger-streams');
  assert.ok(streams.kind === 'stack');
  assert.deepEqual(streams.rows?.map((row) => row.label), ['Donations', "Optional tips for Tapua'i"]);
  assert.deepEqual(streams.series.map((part) => [part.label, part.color]), [
    ['Payee share recorded', 'jade'],
    ["Tapua'i share", 'gold'],
  ]);
});

test('ledger and payout wording stays Wave 0 safe and matches Trends', () => {
  const label = (key: string) => MEASURES.find((measure) => measure.key === key)?.label;
  assert.equal(label('paid_payouts_cents'), 'Payouts marked paid');
  assert.equal(label('stripe_paid_cents'), 'Payouts marked paid');
  assert.equal(label('payouts_cents'), 'Payee share recorded');
  assert.equal(label('company_net_cents'), "Tapua'i share");
  assert.equal(label('qna'), 'Subscriber Q&A requests');
  assert.doesNotMatch(MEASURES.find((measure) => measure.key === 'flash_live')!.note, /vault/i);
  for (const measure of MEASURES) assert.doesNotMatch(`${measure.label} ${measure.note}`, /Stripe|M\u0101lo|\btip/i);
  assert.equal(BOARDS.find((board) => board.id === 'gameday')?.title, 'Live games');
  assert.equal(RANKINGS.find((ranking) => ranking.id === 'malo')?.title, 'Donation totals by athlete (not drawn)');
  const bands = chart(buildAnalytics(fullReports(), fullRevenue).boards, 'bands-donations');
  assert.ok(bands.kind === 'bars' && bands.keepOrder, 'donation bands render unranked');
  assert.equal(RANKINGS.find((ranking) => ranking.id === 'schools')?.title, 'Schools by athletes listed');
  // One name across the portal (Health, Departments, Trends): "UI issues", never "Control issues".
  assert.equal(label('issues_24h'), 'UI issues, 24 hours');
  assert.equal(RANKINGS.find((ranking) => ranking.id === 'issues')?.title, 'UI issues and open bugs');
  for (const text of [...MEASURES.map((m) => `${m.label} ${m.note}`), ...RANKINGS.map((r) => `${r.title} ${r.note}`)]) {
    assert.doesNotMatch(text, /control issue/i);
  }
});

test('chart colours come from the shared measure map', () => {
  const { boards } = buildAnalytics(fullReports(), fullRevenue);
  assert.equal(chart(boards, 'series-clips').accent, 'cyan');
  assert.equal(chart(boards, 'series-malo').accent, 'jade');
  assert.equal(chart(boards, 'compare-malo_cents_7d').accent, 'jade');
  assert.equal(chart(boards, 'compare-clips_7d').accent, 'cyan');
  assert.equal(chart(boards, 'ranking-features').accent, 'violet');
  assert.equal(chart(boards, 'ranking-scroll').accent, 'gold');
  const categories = chart(boards, 'split-categories');
  assert.ok(categories.kind === 'split');
  assert.deepEqual(categories.parts.map((part) => part.color), ['jade', 'cyan', 'gold']);
});

test('Live games draws only the live and parked split; poll, booster and shop counts stay in the catalog', () => {
  const { boards, catalog } = buildAnalytics(fullReports(), fullRevenue);
  const gameday = boards.find((board) => board.id === 'gameday')!;
  assert.deepEqual(gameday.charts.map((spec) => spec.id), ['split-games']);
  assert.ok(!boards.flatMap((board) => board.charts).some((spec) => spec.id === 'bars-gameday'));
  for (const key of ['poll_votes', 'active_polls', 'active_boosters', 'drip_skus']) {
    assert.ok(gameday.measures.some((measure) => measure.key === key), `${key} is still listed on Live games`);
    assert.equal(catalog.find((row) => row.key === key)?.missing, false);
  }
  assert.equal(BOARDS.find((board) => board.id === 'gameday')?.question, 'Which games are live, and how active are polls, boosters and the shop?');
});

test('W3 wording: Donations question, ledger notes, and names shared with Health and Trends', () => {
  const measure = (key: string) => MEASURES.find((item) => item.key === key)!;
  const ranking = (id: string) => RANKINGS.find((item) => item.id === id)!;
  assert.equal(BOARDS.find((board) => board.id === 'donations')?.question, 'How much was donated, how often, and are any payouts queued?');
  assert.equal(measure('payouts_cents').note, 'Recorded for families, Vault athletes, and booster operators. Nothing is paid out in Wave 0.');
  assert.equal(
    measure('stripe_paid_cents').note,
    'Disbursement rows marked paid. Same sum on the Donations and Ledger boards. Should be $0 while payouts are blocked in Wave 0.',
  );
  assert.equal(measure('checkouts_24h').label, 'Checkout step timings, 24 hours');
  assert.equal(measure('checkouts_24h').note, 'Donation checkout steps that logged a time in the last day.');
  assert.equal(measure('avg_checkout_ms_24h').label, 'Average checkout step, 24 hours');
  assert.equal(measure('avg_checkout_ms_24h').note, 'Mean across every logged checkout step, not one whole checkout.');
  assert.equal(ranking('tabs').title, 'Time on each tab');
  assert.equal(ranking('features').title, 'Taps by control');
  assert.equal(ranking('hype').title, 'Most-hyped clips');
  const { boards, lists } = buildAnalytics(fullReports(), fullRevenue);
  assert.equal(chart(boards, 'ranking-hype').title, 'Most-hyped clips');
  assert.equal(lists.find((row) => row.id === 'features')?.title, 'Taps by control');
});

test('Taps by control and UI issues name their rows, never the raw telemetry key (VISUAL_QA 2026-10-12)', () => {
  const reports: PortalReports = {
    ...fullReports(),
    features: [{ label: 'reel.seki', value: 41220 }, { label: 'crew.follow', value: 8120 }, { label: 'spotlight.open_modal', value: 2210 }],
    issues: [{ label: 'upload.retry · upload', value: 31 }, { label: 'malo.sheet.dismiss_error · home', value: 22 }],
  };
  const { boards } = buildAnalytics(reports, fullRevenue);
  const features = chart(boards, 'ranking-features');
  assert.ok(features.kind === 'bars');
  assert.deepEqual(features.points, [
    { label: 'Seki on a Highlight', value: 41220 },
    { label: 'Join Crew', value: 8120 },
    { label: 'Open Spotlight', value: 2210 },
  ]);
  const issues = chart(boards, 'ranking-issues');
  assert.ok(issues.kind === 'bars');
  assert.deepEqual(issues.points?.map((point) => point.label), ['Upload retry (upload)', 'Donate sheet closed with an error (Home)']);
  // Other rankings keep their labels as read.
  const tabs = chart(boards, 'ranking-tabs');
  assert.ok(tabs.kind === 'bars');
  assert.deepEqual(tabs.points?.map((point) => point.label), ['Home']);
});

test('Donations draws athletes by all-time donations as three bands and never the named list (owner 3C, 2026-10-12)', () => {
  const reports = fullReports();
  const { boards, catalog, lists } = buildAnalytics(reports, fullRevenue);
  const donations = boards.find((board) => board.id === 'donations')!;
  assert.deepEqual(donations.charts.map((spec) => spec.id), ['series-malo', 'compare-malo_cents_7d', 'bands-donations']);
  assert.ok(!boards.flatMap((board) => board.charts).some((spec) => spec.id === 'ranking-malo' || spec.source === 'get_admin_reports.leaders.malo'));
  const bands = chart(boards, 'bands-donations');
  assert.ok(bands.kind === 'bars');
  assert.equal(bands.title, 'Athletes by all-time donations');
  assert.equal(bands.caption, 'All time. Counts of athletes, no names.');
  assert.equal(bands.format, 'count');
  assert.equal(bands.accent, 'jade');
  assert.deepEqual(bands.points, [
    { label: 'Under $50', value: 12 },
    { label: '$50–$250', value: 4 },
    { label: '$250 and up', value: 1 },
  ]);
  assert.equal(bands.summary, 'Athletes by all-time donations. Under $50: 12 athletes; $50–$250: 4 athletes; $250 and up: 1 athlete.');
  assert.ok(!JSON.stringify(bands).includes('Kaleo'), 'no athlete name reaches the bands chart');
  // Every band is a named catalog measure on Donations.
  assert.deepEqual(bands.keys, ['get_admin_reports.donation_bands.under_50', 'get_admin_reports.donation_bands.50_to_250', 'get_admin_reports.donation_bands.250_plus']);
  for (const key of ['under_50', '50_to_250', '250_plus']) {
    assert.equal(MEASURES.find((measure) => measure.key === key)?.board, 'donations');
    assert.equal(catalog.find((row) => row.key === key)?.missing, false);
    assert.ok(donations.measures.some((measure) => measure.key === key));
  }
  assert.equal(catalog.find((row) => row.key === '50_to_250')?.value, '4');
  assert.equal(readMeasure('250_plus', reports, fullRevenue), 1);
  // The named list is still a known report key, listed by row count only.
  assert.equal(lists.find((row) => row.id === 'leaders.malo')?.value, '1 row');
});

test('donation bands missing from a working read stay blank with the update note, never zeros', () => {
  const { boards, catalog } = buildAnalytics({ ...fullReports(), donationBands: null }, fullRevenue);
  const bands = chart(boards, 'bands-donations');
  assert.ok(bands.kind === 'bars');
  assert.equal(bands.points, null);
  assert.equal(bands.summary, 'Athletes by all-time donations: not in this read. Needs the 2026-10-12 reports update on this database.');
  for (const key of ['under_50', '50_to_250', '250_plus']) {
    const row = catalog.find((item) => item.key === key)!;
    assert.equal(row.value, '—');
    assert.equal(row.missing, true);
    assert.match(row.note, /Needs the 2026-10-12 reports update on this database\.$/);
  }
  // Partial: the missing band is null, the others keep their counts; the chart still draws.
  const partial = chart(buildAnalytics({ ...fullReports(), donationBands: { under50: 0, from50to250: null, over250: 2 } }, fullRevenue).boards, 'bands-donations');
  assert.ok(partial.kind === 'bars');
  assert.deepEqual(partial.points?.map((point) => point.value), [0, null, 2]);
  assert.match(partial.summary ?? '', /\$50–\$250: not in this read/);
  // Failed and unconfigured reads: no summary of our own, so the kit shows the error or missing state.
  const failed = chart(buildAnalytics({ ...fullReports(), error: 'down' }, fullRevenue).boards, 'bands-donations');
  assert.ok(failed.kind === 'bars');
  assert.equal(failed.points, null);
  assert.equal(failed.error, 'down');
  assert.equal(failed.summary, undefined);
  const unset = buildAnalytics({ ...fullReports(), configured: false }, fullRevenue);
  const unsetBands = chart(unset.boards, 'bands-donations');
  assert.ok(unsetBands.kind === 'bars');
  assert.equal(unsetBands.points, null);
  assert.equal(unsetBands.summary, undefined);
  assert.equal(unset.catalog.find((row) => row.key === 'under_50')?.note.includes('2026-10-12'), false);
});
