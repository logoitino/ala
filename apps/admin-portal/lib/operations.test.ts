/**
 * Tests for the Health (operations) lenses: summaries, units, missing reads, and menu splits.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOperations, formatOperationsValue, type OperationsInput } from './operations.ts';

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
  assert.equal(lenses[1]?.summary, 'Donate is the button people use the most.');
  assert.equal(lenses[2]?.summary, 'Playback stall is the most reported app error.');
});

test('a portal failure leads the errors tab', () => {
  const errors = buildOperations({ ...base, portalErrors: ['Reports did not load. missing'] }).find((lens) => lens.id === 'errors');
  assert.match(errors?.summary ?? '', /portal could not load/);
  assert.equal(errors?.details[0]?.label, 'Portal');
});

test('menus count what is on', () => {
  const menus = buildOperations(base).find((lens) => lens.id === 'menus');
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
  assert.equal(formatOperationsValue('ms', 1250), '1,250 ms');
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
  assert.equal(fanBar?.off, 1);
  assert.equal((fanBar?.on ?? 0) + (fanBar?.off ?? 0) > 1, true);
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
