/**
 * Tests for the portal-wide measure colour map (`lib/measureColors.ts`). Run from
 * `apps/admin-portal`: `node --import ./lib/analytics-resolver.mjs --test lib/*.test.ts`.
 * Pins the pairs that must never collide on a shared chart.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { MEASURE_COLORS, measureColor } from './measureColors.ts';

const KIT_COLORS = new Set(['jade', 'cyan', 'gold', 'violet', 'bad', 'muted']);

test('every measure maps to a chart kit colour', () => {
  for (const [key, color] of Object.entries(MEASURE_COLORS)) assert.ok(KIT_COLORS.has(color), `${key} → ${color}`);
  assert.ok(Object.isFrozen(MEASURE_COLORS));
});

test('pairs drawn together stay distinct', () => {
  assert.notEqual(measureColor('donations'), measureColor('clips'));
  assert.notEqual(measureColor('featureTaps'), measureColor('scrollDepth'));
  assert.notEqual(measureColor('payeeShare'), measureColor('tapuaiShare'));
  assert.notEqual(measureColor('live'), measureColor('parked'));
  const formats = new Set([measureColor('gameDay'), measureColor('trainLikeMe'), measureColor('serveLikeMe')]);
  assert.equal(formats.size, 3);
  const hype = new Set([measureColor('seki'), measureColor('aura'), measureColor('flex')]);
  assert.equal(hype.size, 3);
});

test('bad is reserved for stalls and issues', () => {
  const bad = Object.entries(MEASURE_COLORS).filter(([, color]) => color === 'bad').map(([key]) => key).sort();
  assert.deepEqual(bad, ['issues', 'stalls']);
});
