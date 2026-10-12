/**
 * Tests for the admin chart kit math (`lib/chartScale.ts`). Run from `apps/admin-portal`:
 * `node --import ./lib/analytics-resolver.mjs --test lib/*.test.ts`.
 * Covers empty, all-zero, single point, missing (null) values, and shares that sum to 100.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  arcPath,
  areaPath,
  columnPath,
  linearScale,
  linePath,
  niceMax,
  niceScale,
  normalizeRow,
  peakIndex,
  sharesTo100,
  slotCenter,
} from './chartScale.ts';

test('niceScale: empty and all-zero series draw a baseline only', () => {
  assert.deepEqual(niceScale([]), { max: 0, step: 0, ticks: [0] });
  assert.deepEqual(niceScale([0, 0, 0]), { max: 0, step: 0, ticks: [0] });
  assert.deepEqual(niceScale([null, null]), { max: 0, step: 0, ticks: [0] });
  assert.equal(niceMax([]), 0);
});

test('niceScale: round tops, and counts never get a fractional step', () => {
  assert.equal(niceMax([0, 3, 1]), 3);
  assert.deepEqual(niceScale([0, 3, 1]).ticks, [0, 1, 2, 3]);
  assert.equal(niceScale([1]).step, 1);
  assert.equal(niceMax([4000, 1200]), 4000);
  assert.equal(niceMax([4321]), 6000);
  assert.equal(niceMax([0.3]), 0.3);
  const big = niceScale([987_654_321]);
  assert.ok(big.max >= 987_654_321);
  assert.equal(big.ticks[big.ticks.length - 1], big.max);
});

test('linearScale clamps and maps a zero domain to the baseline', () => {
  const y = linearScale(100, 200);
  assert.equal(y(50), 100);
  assert.equal(y(150), 200);
  assert.equal(y(-5), 0);
  assert.equal(linearScale(0, 200)(10), 0);
});

test('linePath: single point, gaps for missing days, empty input', () => {
  assert.equal(linePath([], 100, 50), '');
  assert.equal(linePath([null, null], 100, 50), '');
  assert.equal(linePath([5], 100, 50, 10), 'M50 25');
  const gapped = linePath([1, null, 1], 90, 10, 1);
  assert.equal((gapped.match(/M/g) ?? []).length, 2, 'a null day breaks the line');
  assert.ok(!gapped.includes('L'));
  assert.equal(linePath([0, 0], 100, 40), 'M25 40L75 40', 'all-zero sits on the baseline');
});

test('areaPath closes each run on the baseline', () => {
  assert.equal(areaPath([], 100, 40), '');
  const d = areaPath([2, 4], 100, 40, 4);
  assert.ok(d.startsWith('M25 20L75 0'));
  assert.ok(d.endsWith('L75 40L25 40Z'));
});

test('slotCenter and columnPath', () => {
  assert.equal(slotCenter(0, 7, 700), 50);
  assert.equal(slotCenter(6, 7, 700), 650);
  assert.equal(columnPath(0, 10, 100, 0), '');
  assert.ok(columnPath(0, 10, 100, 2, 6).includes('Q'), 'radius clamps to a short column');
});

test('arcPath: empty, partial, and a full ring', () => {
  assert.equal(arcPath(50, 50, 40, 0.2, 0.2), '');
  assert.equal(arcPath(50, 50, 40, 0, 0.25), 'M50 10A40 40 0 0 1 90 50');
  const full = arcPath(50, 50, 40, 0, 1);
  assert.equal((full.match(/A/g) ?? []).length, 2);
});

test('sharesTo100 always sums to 100 and is null when the total is 0', () => {
  assert.equal(sharesTo100([]), null);
  assert.equal(sharesTo100([0, 0]), null);
  assert.equal(sharesTo100([null, 0]), null);
  assert.deepEqual(sharesTo100([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(sharesTo100([5]), [100]);
  assert.deepEqual(sharesTo100([0, 7]), [0, 100]);
  assert.deepEqual(sharesTo100([null, 3, 1]), [0, 75, 25]);
  const cases: number[][] = [
    [1, 2, 3, 4, 5, 6, 7],
    [999, 1, 1],
    [13, 17, 19, 23],
    [0.1, 0.2, 0.7],
    [1, 1, 1, 1, 1, 1],
  ];
  for (const values of cases) {
    const shares = sharesTo100(values)!;
    assert.equal(shares.reduce((sum, value) => sum + value, 0), 100, values.join(','));
  }
});

test('normalizeRow scales to the row peak and keeps missing as null', () => {
  assert.deepEqual(normalizeRow([]), []);
  assert.deepEqual(normalizeRow([0, 0]), [0, 0]);
  assert.deepEqual(normalizeRow([2, 4, null]), [0.5, 1, null]);
  assert.deepEqual(normalizeRow([7]), [1]);
});

test('peakIndex picks the first largest and ignores zero rows', () => {
  assert.equal(peakIndex([]), -1);
  assert.equal(peakIndex([0, 0]), -1);
  assert.equal(peakIndex([1, 3, 3, null]), 1);
});
