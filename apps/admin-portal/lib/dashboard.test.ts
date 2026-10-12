/**
 * Tests for Home dashboard math: week change, missing keys, and the number formats.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activeDays,
  formatCompactUsd,
  formatMinutes,
  formatPercent,
  homeKpis,
  readKey,
  sharePercent,
  tapsPerOpen,
  teamTrends,
  weekChange,
  weekSentence,
  type DashboardInput,
} from './dashboard.ts';

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

test('a prior week of zero is not a percent', () => {
  const change = weekChange(400, 0);
  assert.equal(change.tone, 'new');
  assert.equal(change.percent, null);
  assert.match(weekSentence('Donations', change, usd), /no percent/);
});

test('week change rounds from the prior week', () => {
  const change = weekChange(150, 100);
  assert.equal(change.percent, 50);
  assert.equal(change.tone, 'up');
  const down = weekChange(50, 100);
  assert.equal(down.percent, -50);
  assert.equal(down.tone, 'down');
});

test('taps per open stays blank when nobody opened a tab', () => {
  assert.equal(tapsPerOpen(4, 0), null);
  assert.equal(tapsPerOpen(3, 2), 1.5);
  assert.equal(sharePercent(1, 0), null);
  assert.equal(sharePercent(1, 4), 25);
});

test('home cards name events as events', () => {
  const cards = homeKpis(
    {
      donations7dCents: 200,
      donationsPrev7dCents: 100,
      donationCount7d: 2,
      avgDonation7dCents: 100,
      clips7d: 1,
      clipsPrev7d: 1,
      sessions24h: 4,
      dwellMs7d: 120000,
      taps24h: 8,
      stalls24h: 1,
      flagged: 0,
      openBugs: 0,
      grossCents: 1000,
      companyNetCents: 100,
    },
    usd,
  );
  const opens = cards.find((card) => card.label.startsWith('Tab opens'));
  assert.equal(opens?.hint, 'Events, not distinct people');
  const share = cards.find((card) => card.label === 'Recorded platform share');
  assert.equal(share?.value, '10%');
  assert.match(share?.hint ?? '', /90 to the family/);
});

test('team trends count stall days and do not invent a stall percent', () => {
  const lines = teamTrends(
    {
      donations7dCents: 0,
      donationsPrev7dCents: 0,
      donationCount7d: 0,
      avgDonation7dCents: 0,
      clips7d: 0,
      clipsPrev7d: 0,
      sessions24h: 0,
      dwellMs7d: 0,
      taps24h: 0,
      stalls24h: 2,
      flagged: 1,
      openBugs: 2,
      grossCents: 0,
      companyNetCents: 0,
    },
    [{ value: 0 }, { value: 2 }, { value: 0 }],
    usd,
  );
  assert.match(lines[2], /1 of the last 3 days/);
  assert.equal(activeDays([{ value: 0 }, { value: 2 }]), 1);
  assert.match(lines[3], /1 flagged clip and 2 open bug reports/);
});

const missing: DashboardInput = {
  donations7dCents: null,
  donationsPrev7dCents: null,
  donationCount7d: null,
  avgDonation7dCents: null,
  clips7d: null,
  clipsPrev7d: null,
  sessions24h: null,
  dwellMs7d: null,
  taps24h: null,
  stalls24h: null,
  flagged: null,
  openBugs: null,
  grossCents: null,
  companyNetCents: null,
};

test('a missing key is a dash, not $0.00, and never carries a delta', () => {
  const cards = homeKpis(missing, usd);
  assert.equal(cards.length, 8);
  for (const card of cards) {
    assert.equal(card.missing, true, card.label);
    assert.equal(card.value, '—', card.label);
    assert.equal(card.delta, null, card.label);
  }
  const lines = teamTrends(missing, [], usd);
  assert.match(lines[0], /not in this read/);
  assert.match(lines[3], /not in this read/);
});

test('only donations and clips get a prior-week delta', () => {
  const cards = homeKpis(
    {
      ...missing,
      donations7dCents: 500,
      donationsPrev7dCents: 0,
      clips7d: 3,
      clipsPrev7d: 2,
      sessions24h: 0,
      taps24h: 0,
      dwellMs7d: 0,
      stalls24h: 0,
      grossCents: 0,
      companyNetCents: 0,
    },
    usd,
  );
  const withDelta = cards.filter((card) => card.delta).map((card) => card.id);
  assert.deepEqual(withDelta, ['donations', 'clips']);
  assert.deepEqual(cards.find((card) => card.id === 'donations')?.delta, { current: 500, previous: 0 });
  // Zero is a value, not missing.
  const stalls = cards.find((card) => card.id === 'stalls');
  assert.equal(stalls?.missing, false);
  assert.equal(stalls?.value, '0');
  assert.equal(stalls?.goodDirection, 'down');
  assert.equal(cards.find((card) => card.id === 'tapsPerOpen')?.value, '—');
  assert.equal(cards.find((card) => card.id === 'platformShare')?.missing, false);
});

test('readKey separates a missing key and a failed read from zero', () => {
  assert.equal(readKey({ a: 0 }, 'a'), 0);
  assert.equal(readKey({ a: 4 }, 'b'), null);
  assert.equal(readKey({ a: 4 }, 'a', false), null);
  assert.equal(readKey(undefined, 'a'), null);
});

test('formats: tab time in minutes, scroll as a percent, compact dollars', () => {
  assert.equal(formatMinutes(0), '0 min');
  assert.equal(formatMinutes(20000), '<1 min');
  assert.equal(formatMinutes(120000), '2 min');
  assert.equal(formatMinutes(90_000_000), '1,500 min');
  assert.equal(formatPercent(42.4), '42%');
  assert.equal(formatCompactUsd(4000), '$40');
  assert.equal(formatCompactUsd(120000), '$1.2K');
});
