import assert from 'node:assert/strict';
import test from 'node:test';

import { activeDays, homeKpis, sharePercent, tapsPerOpen, teamTrends, weekChange, weekSentence } from './dashboard.ts';

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
