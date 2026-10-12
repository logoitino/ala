/**
 * Tests for the pure parsers and labels in `lib/reports.ts`: missing vs empty lists, missing ledger
 * totals, stream basis points, the donation-breakdown source, and VOICE money words.
 * Run: `node --import ./lib/analytics-resolver.mjs --test lib/*.test.ts`.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { donationSplit } from '../components/revenue/revenueModel.ts';
import {
  MALO_FALLBACK_LIMIT,
  REPORT_LABELS,
  asLeaders,
  asSeries,
  breakdownFromTips,
  maloChannel,
  maloEntryTitle,
  maloOriginTitle,
  parseBreakdown,
  parseReportsPayload,
  parseRevenueSummary,
} from './reports.ts';

test('asLeaders: an absent key is null, a present empty list stays []', () => {
  assert.equal(asLeaders(undefined), null);
  assert.equal(asLeaders(null), null);
  assert.equal(asLeaders({}), null);
  assert.deepEqual(asLeaders([]), []);
  assert.deepEqual(asLeaders([{ label: 'Home', value: 5 }, { value: 3 }, null]), [{ label: 'Home', value: 5 }]);
});

test('asSeries: each absent series is null, a present empty one is []', () => {
  assert.deepEqual(asSeries(undefined), { clips: null, malo: null, stalls: null, dwell: null });
  assert.deepEqual(asSeries({ clips: [], malo: [{ label: 'Mon', value: 100 }] }), {
    clips: [],
    malo: [{ label: 'Mon', value: 100 }],
    stalls: null,
    dwell: null,
  });
});

test('parseReportsPayload: missing lists and leaders are null; present empty lists are []', () => {
  const parsed = parseReportsPayload({ tabs: [], features: [{ label: 'donate.open', value: 2 }], leaders: { malo: [] } });
  assert.deepEqual(parsed.tabs, []);
  assert.deepEqual(parsed.features, [{ label: 'donate.open', value: 2 }]);
  assert.equal(parsed.issues, null);
  assert.equal(parsed.scroll, null);
  assert.deepEqual(parsed.leaders, { malo: [], hype: null, schools: null });
  assert.equal(parsed.series.clips, null);
  const nothing = parseReportsPayload({});
  assert.equal(nothing.tabs, null);
  assert.deepEqual(nothing.leaders, { malo: null, hype: null, schools: null });
});

test('parseRevenueSummary: an absent total is null (shown as —), a recorded 0 stays 0', () => {
  const parsed = parseRevenueSummary({ gross_volume_cents: 0, company_net_cents: 1200 });
  assert.equal(parsed.gross_volume_cents, 0);
  assert.equal(parsed.company_net_cents, 1200);
  assert.equal(parsed.payouts_cents, null);
  assert.equal(parsed.stripe_paid_cents, null);
  // Older payloads in dollars still parse.
  assert.equal(parseRevenueSummary({ total_gross: 12.5 }).gross_volume_cents, 1250);
  assert.equal(parseRevenueSummary({ gross_volume_cents: 'abc' }).gross_volume_cents, null);
});

test('parseRevenueSummary: stream basis points are kept when returned, null when not', () => {
  const parsed = parseRevenueSummary({
    streams: [
      { source: 'malo', label: 'Donations', split: '10% platform / 90% athlete', gross_cents: 1000, platform_cents: 100, payout_cents: 900, platform_bps: 1000, payout_bps: 9000, payee: 'Athlete' },
      { source: 'tip', label: "Optional tips to Tapua'i", gross_cents: 50 },
    ],
  });
  assert.equal(parsed.streams[0].platform_bps, 1000);
  assert.equal(parsed.streams[0].payout_bps, 9000);
  assert.equal(parsed.streams[1].platform_bps, null);
  assert.equal(parsed.streams[1].payout_bps, null);
  assert.equal(donationSplit(parsed.streams)?.policy, "90% to the family account, 10% to Tapua'i");
  const noBps = parseRevenueSummary({ streams: [{ source: 'malo', label: 'Donations', split: 'policy text' }] });
  assert.equal(donationSplit(noBps.streams)?.policy, 'policy text');
});

test('donation breakdown says whether it came from the RPC or the 200-row fallback', () => {
  assert.equal(parseBreakdown({ by_origin: [], by_entry: [], by_day: [], recent: [] }).source, 'rpc');
  const now = Date.parse('2026-10-11T12:00:00Z');
  const fallback = breakdownFromTips(
    [
      { id: 'a', amount_cents: 500, created_at: '2026-10-10T08:00:00Z', origin: 'wishlist', entry: 'qr_link' },
      { id: 'b', amount_cents: 300, created_at: '2026-09-01T08:00:00Z', origin: 'highlight', entry: 'in_app' },
    ],
    now,
  );
  assert.equal(fallback.source, 'fallback');
  assert.deepEqual(fallback.byDay, [{ day: '2026-10-10', cents: 500 }]);
  assert.equal(fallback.byOrigin[0].label, 'Gear goal');
  assert.equal(fallback.byEntry[0].label, 'QR donation link');
  assert.equal(MALO_FALLBACK_LIMIT, 200);
});

test('money labels follow VOICE: donation and gear goal, never "Mālo" or "tip" as the money', () => {
  assert.equal(maloEntryTitle('qr_link'), 'QR donation link');
  assert.equal(maloEntryTitle('in_app'), 'In the app');
  assert.equal(maloOriginTitle('wishlist'), 'Gear goal');
  assert.equal(maloChannel('wishlist', 'qr_link', ''), 'Gear goal via QR');
  for (const [key, label] of Object.entries(REPORT_LABELS)) {
    assert.ok(!/m[aā]lo/i.test(label), `${key}: "${label}" uses Mālo as a money word`);
    assert.ok(!/\btip/i.test(label), `${key}: "${label}" uses tip for a donation`);
  }
});
