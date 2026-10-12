import assert from 'node:assert/strict';
import test from 'node:test';

import { BOARDS, MEASURES, SERIES, buildAnalytics, formatMeasure } from './analytics.ts';
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
  series: { clips: [], malo: [], stalls: [], dwell: [] },
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

test('the catalog names every report key once and every board has a headline', () => {
  const keys = MEASURES.map((measure) => measure.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(BOARDS.length, 8);
  assert.equal(SERIES.length, 4);
  for (const board of BOARDS) {
    assert.ok(MEASURES.some((measure) => measure.key === board.headlineKey && measure.board === board.id));
  }
  assert.ok(MEASURES.some((measure) => measure.key === 'clips_7d'));
  assert.ok(MEASURES.some((measure) => measure.key === 'malo_cents_prev_7d'));
  assert.equal(MEASURES.filter((measure) => measure.section === 'revenue').length, 4);
});

test('a missing measure stays blank and a recorded zero stays zero', () => {
  const { boards } = buildAnalytics(
    { ...emptyReports, engagement: { clips_7d: 0 } },
    emptyRevenue,
  );
  const highlights = boards.find((board) => board.id === 'highlights');
  assert.equal(highlights?.headline, '0');
  assert.equal(highlights?.measures.find((measure) => measure.key === 'clips_live')?.display, '—');
  assert.equal(highlights?.measures.find((measure) => measure.key === 'clips_7d')?.display, '0');
});

test('donation week change uses the prior week and does not invent a percent from zero', () => {
  const up = buildAnalytics(
    { ...emptyReports, money: { malo_cents_7d: 1500, malo_cents_prev_7d: 1000 } },
    emptyRevenue,
  ).boards.find((board) => board.id === 'donations');
  assert.match(up?.headlineNote ?? '', /up 50%/);
  const fresh = buildAnalytics(
    { ...emptyReports, money: { malo_cents_7d: 1500, malo_cents_prev_7d: 0 } },
    emptyRevenue,
  ).boards.find((board) => board.id === 'donations');
  assert.match(fresh?.headlineNote ?? '', /no percent/);
  assert.equal(formatMeasure('cents', 1500), '$15.00');
});

test('a failed read does not turn the ledger into zeros', () => {
  const { boards, catalog } = buildAnalytics(emptyReports, { ...emptyRevenue, configured: true, error: 'down' });
  const ledger = boards.find((board) => board.id === 'ledger');
  assert.equal(ledger?.headline, '—');
  assert.equal(ledger?.charts.length, 0);
  assert.equal(catalog.length, MEASURES.length);
  assert.match(catalog.find((row) => row.key === 'sessions_24h')?.note ?? '', /not distinct people/);
});
