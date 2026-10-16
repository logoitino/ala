/**
 * Tests for the pure parsers and labels in `lib/reports.ts`: missing vs empty lists, missing ledger
 * totals, stream basis points, stream names and split text (Vault "recorded for the athlete", never
 * "family account"), the donation-breakdown source, report labels/notes, and VOICE money words.
 * `donation_bands` (owner decision 2026-10-12): present, missing, partial and malformed payloads,
 * with missing never read as zero.
 * Run: `node --import ./lib/analytics-resolver.mjs --test lib/*.test.ts`.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { donationSplit, streamName as revenueStreamName } from '../components/revenue/revenueModel.ts';
import {
  DONATION_BANDS_MISSING_NOTE,
  MALO_FALLBACK_LIMIT,
  REPORT_LABELS,
  REPORT_NOTES,
  asLeaders,
  asSeries,
  breakdownFromTips,
  donationBandRows,
  donationBandsSentence,
  formatMinutes,
  maloEntryTitle,
  maloOriginTitle,
  parseBreakdown,
  parseDonationBands,
  parseReportsPayload,
  parseRevenueSummary,
  streamName,
  streamSplitText,
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
  // W2-COMMERCE: no basis points → no stated policy; the raw SQL `split` text is never shown (VOICE #3, #4).
  assert.equal(donationSplit(noBps.streams)?.policy, null);
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
  for (const [key, label] of Object.entries(REPORT_LABELS)) {
    assert.ok(!/m[aā]lo/i.test(label), `${key}: "${label}" uses Mālo as a money word`);
    assert.ok(!/\btip/i.test(label), `${key}: "${label}" uses tip for a donation`);
  }
});

test('streamName: VOICE names per source, the RPC label only for an unknown source', () => {
  assert.equal(streamName('malo', 'Mālo Micro-Tips'), 'Donations');
  assert.equal(streamName('tip', "Optional tips to Tapua'i"), "Optional tips for Tapua'i");
  assert.equal(streamName('booster', 'Local District Booster Sponsorships'), 'Booster sponsorships');
  assert.equal(streamName('merch_vault', 'Merch & Vault Subscriptions'), 'Vault and Drip');
  assert.equal(streamName('vault', 'Vault'), 'Vault subscriptions');
  assert.equal(streamName('merch', 'Drip'), 'Drip merch');
  assert.equal(streamName('other', 'Other stream'), 'Other stream');
  // Revenue desk imports the same function.
  assert.equal(revenueStreamName, streamName);
});

test('streamSplitText: built from basis points in VOICE words, never the raw SQL split', () => {
  // Same streams and basis points as get_company_revenue_summary in schema.sql.
  const parsed = parseRevenueSummary({
    streams: [
      { source: 'malo', label: 'Donations', split: '10% platform / 90% athlete', platform_bps: 1000, payout_bps: 9000 },
      { source: 'tip', label: "Optional tips to Tapua'i", split: '100% platform (donor chose it)', platform_bps: 10000, payout_bps: 0 },
      { source: 'booster', label: 'Local District Booster Sponsorships', split: '15% platform / 85% operator', platform_bps: 1500, payout_bps: 8500 },
      { source: 'merch_vault', label: 'Merch & Vault Subscriptions', split: 'Vault 20% / 80% athlete · Drip 100% platform', platform_bps: null, payout_bps: null },
    ],
  });
  const texts = parsed.streams.map((stream) => streamSplitText(stream));
  assert.deepEqual(texts, [
    "90% to the family account, 10% to Tapua'i",
    "100% to Tapua'i (donor's choice)",
    "85% to the operator, 15% to Tapua'i",
    "Vault: 80% recorded for the athlete, 20% to Tapua'i · Drip: 100% to Tapua'i",
  ]);
  // Vault money is recorded for the athlete, not credited to the family account (get_custodial_summary sums only tips).
  assert.ok(!/family account/.test(texts[3] ?? ''), `merch_vault must not claim a family account: ${texts[3]}`);
  // Booster text follows the basis points, not a constant.
  assert.equal(streamSplitText({ source: 'booster', payout_bps: 8000, platform_bps: 2000 }), "80% to the operator, 20% to Tapua'i");
  assert.equal(streamSplitText({ source: 'malo', payout_bps: 8750, platform_bps: 1250 }), "87.5% to the family account, 12.5% to Tapua'i");
  // Missing or inconsistent basis points: null, never the raw split.
  assert.equal(streamSplitText({ source: 'malo', payout_bps: null, platform_bps: null }), null);
  assert.equal(streamSplitText({ source: 'malo' }), null);
  assert.equal(streamSplitText({ source: 'booster', payout_bps: 8500, platform_bps: 1000 }), null);
  assert.equal(streamSplitText({ source: 'tip', payout_bps: 500, platform_bps: 9500 }), null);
  assert.equal(streamSplitText({ source: 'other', payout_bps: 5000, platform_bps: 5000 }), null);
  parsed.streams.forEach((stream, index) => {
    assert.notEqual(texts[index], stream.split);
    assert.ok(!/platform/i.test(texts[index] ?? ''), `SQL word leaked: ${texts[index]}`);
  });
});

test('Payouts marked paid: label and note say what the number is', () => {
  assert.equal(REPORT_LABELS.paid_payouts_cents, 'Payouts marked paid');
  assert.equal(
    REPORT_NOTES.paid_payouts_cents,
    'Disbursement rows marked paid. Same sum on the Donations and Ledger boards. Should be $0 while payouts are blocked in Wave 0.',
  );
  assert.equal(REPORT_LABELS.checkouts_24h, 'Checkout step timings (24h)');
  assert.equal(REPORT_LABELS.avg_checkout_ms_24h, 'Average checkout step (24h)');
});

test('REPORT_LABELS: wave-3 names say what each count is (match Analytics and Health)', () => {
  assert.equal(REPORT_LABELS.active_subs, 'Exclusive rows marked active');
  assert.equal(REPORT_LABELS.flash_live, 'Flash unlocks still open');
  assert.equal(REPORT_LABELS.spotlight_live, 'Spotlight awards live today');
  assert.equal(REPORT_LABELS.admins, 'Admin accounts');
  assert.equal(REPORT_LABELS.drip_skus, 'Drip products on the rack');
  assert.equal(REPORT_LABELS.stalls_24h, 'Video stalls (24h)');
  assert.equal(REPORT_LABELS.sessions_24h, 'Tab opens (24h)');
  assert.equal(REPORT_LABELS.avg_scroll_pct_7d, 'Average scroll depth (7d)');
});

test('formatMinutes matches the dashboard rule so Trends and Home agree', async () => {
  const dashboard = await import('./dashboard.ts');
  for (const ms of [0, 20000, 59999, 60000, 120000, 210000, 90_000_000]) {
    assert.equal(formatMinutes(ms), dashboard.formatMinutes(ms), `${ms} ms`);
  }
  assert.equal(formatMinutes(30000), '<1 min');
});

test('donation_bands present: three whole counts in display order, a 0 stays 0', () => {
  const parsed = parseReportsPayload({ donation_bands: { under_50: 12, '50_to_250': 4, '250_plus': 0 } });
  assert.deepEqual(parsed.donationBands, { under50: 12, from50to250: 4, over250: 0 });
  assert.deepEqual(donationBandRows(parsed.donationBands!), [
    { label: 'Under $50', value: 12 },
    { label: '$50–$250', value: 4 },
    { label: '$250 and up', value: 0 },
  ]);
  assert.equal(
    donationBandsSentence(parsed.donationBands!),
    'Athletes by all-time donations. Under $50: 12 athletes; $50–$250: 4 athletes; $250 and up: 0 athletes.',
  );
  // Postgres bigint may arrive as a numeric string.
  assert.deepEqual(parseDonationBands({ under_50: '3', '50_to_250': 1, '250_plus': '1' }), { under50: 3, from50to250: 1, over250: 1 });
  assert.equal(donationBandsSentence({ under50: 1, from50to250: 1, over250: 1 }).includes('1 athlete;'), true);
});

test('donation_bands missing: null (not three zeros), on an empty read too', () => {
  assert.equal(parseReportsPayload({ money: { malo_cents_all: 100 } }).donationBands, null);
  assert.equal(parseReportsPayload({}).donationBands, null);
  assert.equal(parseReportsPayload(null).donationBands, null);
  assert.equal(parseDonationBands(undefined), null);
  assert.equal(DONATION_BANDS_MISSING_NOTE, 'Needs the 2026-10-12 reports update on this database.');
});

test('donation_bands partial: a band not in the read is null, the others keep their counts', () => {
  const bands = parseDonationBands({ under_50: 7, '250_plus': 2 });
  assert.deepEqual(bands, { under50: 7, from50to250: null, over250: 2 });
  assert.deepEqual(donationBandRows(bands!).map((row) => row.value), [7, null, 2]);
  assert.match(donationBandsSentence(bands!), /\$50–\$250: not in this read/);
  // A bad value in one band is treated as missing, not 0.
  assert.deepEqual(parseDonationBands({ under_50: 7, '50_to_250': 'lots', '250_plus': -1 }), { under50: 7, from50to250: null, over250: null });
});

test('donation_bands malformed: not an object, a list, or none of the three counts is null', () => {
  for (const raw of ['12', 12, true, [], [1, 2, 3], {}, { under_50: null }, { under50: 3, over250: 1 }, { under_50: 'x', '50_to_250': NaN, '250_plus': Infinity }]) {
    assert.equal(parseDonationBands(raw), null, JSON.stringify(raw));
  }
  assert.equal(parseReportsPayload({ donation_bands: [{ label: 'Kaleo', value: 2500 }] }).donationBands, null);
  assert.equal(REPORT_LABELS.donation_bands, 'Athletes by all-time donations');
  assert.match(REPORT_NOTES.donation_bands, /no names/);
  assert.doesNotMatch(REPORT_NOTES.donation_bands, /M\u0101lo|\btip/i);
});
