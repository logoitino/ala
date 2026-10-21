/**
 * Tests for the Health (operations) lenses: summaries, units, missing reads, and menu splits.
 * Button and error rows (including the Errors headline) read as words, never telemetry keys.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_RUNTIME_FLAG_GROUPS } from '@tapuai/shared-types';

import { buildOperations, featureLabel, formatOperationsValue, type OperationsInput } from './operations.ts';

const base: OperationsInput = {
  tabs: [
    { label: 'Home', value: 40 },
    { label: 'Profile', value: 10 },
  ],
  buttons: [
    { label: 'Donate', value: 8 },
    { label: 'Seki', value: 3 },
  ],
  appErrors: [{ label: 'Playback stall', value: 2 }],
  portalErrors: [],
  usage: { sessions_24h: 12 },
  reliability: { stalls_24h: 2 },
  published: { tabs: { home: true, drip: false } },
};

test('names the busiest place and the most used button', () => {
  const lenses = buildOperations(base);
  assert.equal(lenses[0]?.summary, 'Home is where people spend the most time.');
  assert.equal(lenses[1]?.summary, 'Donate is the most tapped button.');
  assert.equal(lenses[2]?.summary, 'Playback stall is the most reported app error.');
});

test('a portal failure leads the errors tab', () => {
  const errors = buildOperations({ ...base, portalErrors: ['Reports did not load. missing'] }).find((lens) => lens.id === 'errors');
  assert.match(errors?.summary ?? '', /portal could not load/);
  assert.equal(errors?.details[0]?.label, 'Portal');
});

test('menus count what is on when every published flag is returned', () => {
  const published = Object.fromEntries(APP_RUNTIME_FLAG_GROUPS.map(group => [group.id, Object.fromEntries(group.flags.map(flag => [flag.path.split('.')[1], flag.path !== 'tabs.drip']))]));
  const menus = buildOperations({ ...base, published }).find((lens) => lens.id === 'menus');
  assert.match(menus?.summary ?? '', /menus are on/);
  assert.ok((menus?.details.length ?? 0) > 4);
});

test('tab time is minutes and scroll is a percent, not raw counts', () => {
  const lenses = buildOperations({
    ...base,
    tabs: [{ label: 'Home', value: 180000 }],
    scroll: [{ label: 'Home', value: 64 }],
    usage: { dwell_ms_7d: 600000, avg_scroll_pct_7d: 64, sessions_24h: 3 },
  });
  const where = lenses.find((lens) => lens.id === 'where');
  const tabRanking = where?.rankings.find((ranking) => ranking.source.endsWith('.tabs'));
  const scrollRanking = where?.rankings.find((ranking) => ranking.source.endsWith('.scroll'));
  assert.equal(tabRanking?.kind, 'minutes');
  assert.equal(scrollRanking?.kind, 'percent');
  assert.equal(formatOperationsValue('minutes', 180000), '3 min');
  assert.equal(formatOperationsValue('percent', 64), '64%');
  assert.equal(formatOperationsValue('ms', 850), '850 ms');
  assert.equal(formatOperationsValue('ms', 1250), '1.3 s');
  const dwell = where?.details.find((row) => row.label === 'Time on tabs · 7d');
  assert.equal(dwell?.value, '10 min');
  const scroll = where?.details.find((row) => row.label === 'Average scroll depth · 7d');
  assert.equal(scroll?.value, '64%');
});

test('a failed reports read leaves numbers missing, not zero', () => {
  const lenses = buildOperations({ ...base, reportsOk: false, portalErrors: ['Reports did not load. x'] });
  const where = lenses.find((lens) => lens.id === 'where');
  assert.equal(where?.rankings[0]?.rows, null);
  assert.ok(where?.stats.every((stat) => stat.value === null));
  const errors = lenses.find((lens) => lens.id === 'errors');
  assert.equal(errors?.stats.find((stat) => stat.key === 'stalls_24h')?.value, null);
  assert.equal(errors?.series[0]?.points, null);
});

test('unread menu flags are missing, not all on', () => {
  const menus = buildOperations({ ...base, runtimeOk: false, published: {} }).find((lens) => lens.id === 'menus');
  assert.ok(menus?.splits.length);
  assert.ok(menus?.splits.every((split) => split.on === null && split.off === null));
  assert.match(menus?.summary ?? '', /not read/);
  const read = buildOperations(base).find((lens) => lens.id === 'menus');
  const fanBar = read?.splits.find((split) => split.id === 'tabs');
  assert.equal(fanBar?.off, null);
  assert.equal(fanBar?.on, null);
  assert.equal(read?.details.find(row => row.label.endsWith('Home'))?.value, 'On');
});

test('stalls carry the bad accent and fewer-is-better direction', () => {
  const errors = buildOperations({ ...base, stallSeries: [{ label: 'Mon', value: 0 }, { label: 'Tue', value: 2 }] }).find((lens) => lens.id === 'errors');
  const stalls = errors?.stats.find((stat) => stat.key === 'stalls_24h');
  assert.equal(stalls?.goodDirection, 'down');
  assert.equal(stalls?.spark?.accent, 'bad');
  assert.equal(errors?.series[0]?.accent, 'bad');
});

test('a list missing from a working read is null (missing); a present empty list is [] (empty)', () => {
  const lenses = buildOperations({ ...base, tabs: null, buttons: [], appErrors: null, scroll: [] });
  const where = lenses.find((lens) => lens.id === 'where');
  assert.equal(where?.rankings.find((ranking) => ranking.source.endsWith('.tabs'))?.rows, null);
  assert.deepEqual(where?.rankings.find((ranking) => ranking.source.endsWith('.scroll'))?.rows, []);
  const buttons = lenses.find((lens) => lens.id === 'buttons');
  assert.deepEqual(buttons?.rankings[0]?.rows, []);
  const errors = lenses.find((lens) => lens.id === 'errors');
  assert.equal(errors?.rankings.find((ranking) => ranking.source.endsWith('.issues'))?.rows, null);
});

test('button keys read as words, never as raw event keys', () => {
  // `featureLabel` is still exported here for older callers; the map lives in lib/eventLabels.ts.
  assert.equal(featureLabel('hype.seki'), 'Seki on a Highlight');
  assert.equal(featureLabel('reel.seki'), 'Seki on a Highlight');
  assert.equal(featureLabel('malo'), 'Donate');
  assert.equal(featureLabel('share_qr.copy'), 'Copy the QR donation link');
  assert.equal(featureLabel('spotlight.open_modal'), 'Open Spotlight');
  const buttons = buildOperations({ ...base, buttons: [{ label: 'hype.seki', value: 9 }, { label: 'crew.join', value: 2 }] }).find((lens) => lens.id === 'buttons');
  assert.equal(buttons?.summary, 'Seki on a Highlight is the most tapped button.');
  assert.deepEqual(buttons?.rankings[0]?.rows?.map((row) => row.label), ['Seki on a Highlight', 'Join Crew']);
  assert.ok(buttons?.details.every((row) => !row.label.includes('.')));
});

test('error keys read as words in the headline, the chart and Every row (VISUAL_QA 2026-10-12)', () => {
  const errors = buildOperations({
    ...base,
    appErrors: [
      { label: 'malo.sheet.dismiss_error · home', value: 22 },
      { label: 'upload.retry · upload', value: 31 },
      { label: 'profile bug', value: 9 },
    ],
  }).find((lens) => lens.id === 'errors');
  assert.equal(errors?.summary, 'Upload retry (upload) is the most reported app error.');
  assert.deepEqual(errors?.rankings[0]?.rows?.map((row) => row.label), [
    'Upload retry (upload)',
    'Donate sheet closed with an error (Home)',
    'Open bug reports (Profile)',
  ]);
  assert.deepEqual(errors?.bars.map((row) => row.label), errors?.rankings[0]?.rows?.map((row) => row.label));
  const every = errors?.details.map((row) => row.label) ?? [];
  assert.ok(every.includes('Upload retry (upload)'));
  // Reliability rows keep their "· 24h" names; no row is a raw key.
  assert.ok(every.every((label) => !/[a-z]\.[a-z]/.test(label) && !/ bug$/.test(label)));
  assert.ok(!every.includes('upload.retry · upload'));
});

test('a missing stall count has no hint, like Home (QA #1)', () => {
  const errors = buildOperations({ ...base, reliability: {} }).find((lens) => lens.id === 'errors');
  const stalls = errors?.stats.find((stat) => stat.key === 'stalls_24h');
  assert.equal(stalls?.value, null);
  assert.equal(stalls?.hint, '');
});

test('checkout timings are per step, not one whole checkout (VOICE #24, #25)', () => {
  const errors = buildOperations(base).find((lens) => lens.id === 'errors');
  assert.equal(errors?.stats.find((stat) => stat.key === 'avg_checkout_ms_24h')?.label, 'Average checkout step · 24h');
  assert.equal(errors?.stats.find((stat) => stat.key === 'checkouts_24h')?.label, 'Checkout step timings · 24h');
});

const trivia = {
  prepViews7d: 40, startPresses7d: 22,
  starts7d: 20, answers7d: 80, nexts7d: 60, completes7d: 15, abandons7d: 4, unavailable7d: 1,
  startFailed7d: 0, answerFailed7d: 2, nextFailed7d: 1, explanationFailed7d: 0,
  byPosition7d: [
    { label: 'Question 1', value: 20 }, { label: 'Question 2', value: 18 }, { label: 'Question 3', value: 16 },
    { label: 'Question 4', value: 14 }, { label: 'Question 5', value: 12 },
  ],
  startsByKind7d: [{ label: 'personal', value: 12 }, { label: 'group', value: 8 }],
};

test('trivia funnel tiles join the buttons tab with counts, rate, drop-off and kinds', () => {
  const buttons = buildOperations({ ...base, trivia }).find((lens) => lens.id === 'buttons');
  assert.equal(buttons?.stats.find((stat) => stat.key === 'trivia_prep_views_7d')?.value, 40);
  assert.equal(buttons?.stats.find((stat) => stat.key === 'trivia_start_presses_7d')?.value, 22);
  assert.equal(buttons?.stats.find((stat) => stat.key === 'trivia_starts_7d')?.value, 20);
  assert.equal(buttons?.stats.find((stat) => stat.key === 'trivia_completes_7d')?.value, 15);
  assert.equal(buttons?.stats.find((stat) => stat.key === 'trivia_complete_rate_7d')?.value, 75);
  assert.equal(buttons?.stats.find((stat) => stat.key === 'trivia_abandons_7d')?.value, 4);
  const positions = buttons?.rankings.find((ranking) => ranking.title === 'Answers by question');
  assert.deepEqual(positions?.rows?.map((row) => row.value), [20, 18, 16, 14, 12]);
  const kinds = buttons?.rankings.find((ranking) => ranking.title === 'Rounds by kind');
  assert.deepEqual(kinds?.rows, [{ label: 'Personal rounds', value: 12 }, { label: 'Group rounds', value: 8 }]);
  assert.ok(buttons?.details.some((row) => row.label === 'Trivia answer failures · 7d' && row.value === '2'));
});

test('trivia completion is missing without starts, never 0% it did not return', () => {
  const buttons = buildOperations({ ...base, trivia: { ...trivia, starts7d: 0, completes7d: 0 } }).find((lens) => lens.id === 'buttons');
  assert.equal(buttons?.stats.find((stat) => stat.key === 'trivia_complete_rate_7d')?.value, null);
});

test('callers without trivia or smoothness see the old tiles only', () => {
  const lenses = buildOperations(base);
  const buttons = lenses.find((lens) => lens.id === 'buttons');
  const errors = lenses.find((lens) => lens.id === 'errors');
  assert.equal(buttons?.stats.some((stat) => stat.key.startsWith('trivia_')) ?? false, false);
  assert.equal(buttons?.rankings.some((ranking) => ranking.title === 'Answers by question') ?? false, false);
  assert.equal(errors?.stats.some((stat) => stat.key === 'avg_mount_ms_7d') ?? false, false);
  assert.equal(errors?.rankings.some((ranking) => ranking.title === 'Mount time by screen') ?? false, false);
});

const smoothness = {
  mounts7d: 300, avgMountMs7d: 180,
  bySurface7d: [{ label: 'home', value: 210 }, { label: 'sport-quiz', value: 160 }, { label: 'donate-sheet', value: 140 }],
  appStarts7d: 120, avgStartMs7d: 900,
};

test('smoothness tiles join the errors tab with averages and slowest-first screens', () => {
  const errors = buildOperations({ ...base, smoothness }).find((lens) => lens.id === 'errors');
  assert.equal(errors?.stats.find((stat) => stat.key === 'avg_mount_ms_7d')?.value, 180);
  assert.equal(errors?.stats.find((stat) => stat.key === 'avg_start_ms_7d')?.value, 900);
  assert.equal(errors?.stats.find((stat) => stat.key === 'avg_mount_ms_7d')?.goodDirection, 'down');
  const mounts = errors?.rankings.find((ranking) => ranking.title === 'Mount time by screen');
  assert.deepEqual(mounts?.rows, [
    { label: 'Home', value: 210 },
    { label: 'Sport Pop Quiz', value: 160 },
    { label: 'Donate sheet', value: 140 },
  ]);
  assert.equal(mounts?.kind, 'ms');
  assert.ok(errors?.details.some((row) => row.label === 'Average cold start · 7d'));
});
