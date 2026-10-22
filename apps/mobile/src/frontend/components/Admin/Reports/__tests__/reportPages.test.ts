/** Regression fixtures cover source keys, gift provenance/privacy and partial oversight reads.
 * Deliberately different totals make a wrong window or hidden roster row observable. */
import { emptyAdminReportData } from '@/lib/adminReports';
import { reportPageSections } from '../reportPages';
import { reportProductSections } from '../reportProductPages';
import { buildReportHealthChecks } from '../reportHealthChecks';

function fixture() {
  const data = emptyAdminReportData();
  data.reports.configured = data.revenue.configured = data.breakdown.configured = true;
  data.reports.audience = { pending_verify: 7 };
  data.reports.money = { malo_cents_7d: 100, malo_cents_all: 3000, queued_payouts: 2 };
  data.reports.content = { game_play: 2, train_like_me: 3, serve_like_me: 4 };
  data.reports.reliability = { events_24h: 92 };
  data.reports.series.malo = [{ label: 'Wrong seven-day source', value: 100 }];
  data.breakdown.byDay = [{ day: '2026-10-01', cents: 2600 }];
  data.breakdown.source = 'rpc';
  data.revenue.gross_volume_cents = 5000; data.revenue.payouts_cents = 1000; data.revenue.company_net_cents = 1000; data.revenue.stripe_paid_cents = 500;
  data.revenue.streams = [{ source: 'malo', label: 'Mālo', split: '', gross_cents: 3000, payout_cents: 2000, platform_cents: 300, payee: 'Athlete' }];
  data.revenue.recent = [{ id: 'ledger', source: 'malo', label: 'Mālo · Highlight · Athlete', gross_cents: 3000, payout_cents: 2000, platform_cents: 300, created_at: '2026-10-01T14:00:00Z' }];
  data.breakdown.recent = [{ id: 'donation', amount_cents: 200, created_at: '2026-10-01T14:00:00Z', origin: 'wishlist', entry: 'qr_link', source_label: 'Shoes', athlete_name: 'Athlete', fan_name: 'Gift sender', reel_id: null, wishlist_item_id: 'goal' }, { id: 'clipdonation', amount_cents: 200, created_at: '2026-10-01T14:00:00Z', origin: 'highlight', entry: 'in_app', source_label: '', athlete_name: 'Athlete', fan_name: 'Gift sender', reel_id: 'clip', wishlist_item_id: null }];
  return data;
}
it('uses the actual verification queue and content category mix, not hype reactions', () => {
  const sections = reportPageSections('audience', fixture());
  expect(sections[0].kpis?.find(row => row.label === 'Verify queue')?.value).toBe('7');
  expect(sections[2].charts?.some(chart => chart.id === 'split-categories')).toBe(true);
  expect(sections[2].charts?.find(chart => chart.id === 'split-categories')).toMatchObject({ parts: [{ key: 'game_play', value: 2 }, { key: 'train_like_me', value: 3 }, { key: 'serve_like_me', value: 4 }] });
});
it('preserves all-time and14-day gift reads, gross remainder, ledger detail and linked media', () => {
  const sections = reportPageSections('revenue', fixture());
  const donation = sections.find(section => section.id === 'donations')!;
  expect(donation.kpis?.find(row => row.label === 'Gifts, all time')?.value).toBe('$30.00');
  expect(donation.charts?.[0]).toMatchObject({ source: 'get_admin_malo_breakdown.by_day', windowLabel: 'Last 14 days, UTC' });
  expect(JSON.stringify(donation.charts?.[0])).not.toContain('Wrong seven-day source');
  expect(JSON.stringify(sections.find(section => section.id === 'ledger'))).toContain('Recorded gross not split');
  expect(JSON.stringify(sections.find(section => section.id === 'test-mode'))).toContain('Some payout rows are marked paid');
  expect(sections.find(section => section.id === 'recent')?.tables?.[0].table.rows[0]).toContain('Highlight · Athlete');
  expect(JSON.stringify(sections.find(section => section.id === 'latest'))).toContain('Highlight');
  expect(JSON.stringify(sections.find(section => section.id === 'latest'))).toContain('Gear goal');
});
it('retains nonfan admin, pending and claimed roster statuses with successful partial counts', () => {
  const data = fixture();
  data.people.configured = data.softWall.configured = true;
  data.softWall.error = 'One unrelated flag read failed'; data.softWall.fanProfiles = 9;
  data.people.people = [{ id: 'admin', full_name: 'Admin Athlete', username: 'captain', role: 'athlete', is_verified: false, verification_status: 'pending', is_admin: true, player_id: 'claimed', created_at: '2026-10-01T14:00:00Z' }];
  const sections = reportProductSections('people', data);
  expect(sections[0].kpis?.find(row => row.label === 'Fan profiles (all)')?.value).toBe('9');
  const text = JSON.stringify(sections[1]);
  for (const words of ['Admin Athlete', 'Admin', 'Varsity pending', 'Claimed roster']) expect(text).toContain(words);
});
it('shows the telemetry event key and the complete Billing totals', () => {
  const sections = reportPageSections('departments', fixture());
  expect(sections.find(section => section.id === 'it')?.kpis?.find(row => row.label === 'Telemetry events · 24h')?.value).toBe('92');
  expect(sections.find(section => section.id === 'billing')?.kpis).toHaveLength(3);
});

it('keeps Trends comparisons while using one canonical analysis for static rankings and counts', () => {
  const sections = reportPageSections('trends', fixture());
  expect(sections.map(s => s.id)).toEqual(['week', 'pace', 'analysis']);
  expect(sections[0].charts).toHaveLength(2);
  expect(sections[1].charts).toHaveLength(5);
  expect(sections[2].links?.some(link => link.href === '/admin/analytics')).toBe(true);
});

it('merges stream gross ranking and split metadata into one complete stack', () => {
  const streams = reportPageSections('revenue', fixture()).find(s => s.id === 'streams')!;
  expect(streams.charts).toHaveLength(1);
  expect(streams.tables ?? []).toHaveLength(0);
  expect(streams.charts![0]).toMatchObject({ kind: 'stack', rows: [{ total: 3000, segments: { payee: 2000, tapuai: 300 } }] });
});

it('renders each published Profile setting once with its meaning and keeps distinct population counts', () => {
  const data = fixture(); data.runtime.configured = data.profile.configured = true;
  data.runtime.published = { profile: { showCard: false, showCrew: true, showStats: true, showVault: false, actionsOnTop: false, statsFirst: true } };
  data.profile.claimedAthletes = 3; data.profile.athleteProfiles = 4;
  const sections = reportProductSections('profile', data);
  expect(sections.flatMap(s => s.tables ?? []).flatMap(t => t.table.rows)).toHaveLength(6);
  expect(sections[0].kpis?.map(k => k.value)).toEqual(['3', '4']);
});

it('restores thirteen triage checks without manufacturing healthy missing values', () => {
  const data = fixture();
  const checks = buildReportHealthChecks(data);
  expect(checks).toHaveLength(13);
  expect(checks.find(c => c.id === 'stalls')?.status).toBe('unknown');
  expect(checks.find(c => c.id === 'payouts')).toMatchObject({ status: 'warn', href: '/admin/money' });
  expect(checks.find(c => c.id === 'checkout')?.href).toBe('/admin/qa');
  expect(checks.find(c => c.id === 'drip')?.status).toBe('unknown');
});

it('sorts failures before warnings and measured passes; stock errors prevent a false pass', () => {
  const data = fixture(); data.reports.reliability = { stalls_24h: 5, reconnects_24h: 0, avg_checkout_ms_24h: 3000 };
  data.reports.live = { drip_skus: 4, live_games: 0 };
  data.stock = { configured: true, error: 'Stock denied', lowStock: null };
  const checks = buildReportHealthChecks(data);
  expect(checks[0]).toMatchObject({ id: 'stalls', status: 'fail' });
  expect(checks.find(c => c.id === 'reconnects')?.status).toBe('ok');
  expect(checks.find(c => c.id === 'drip')?.status).toBe('unknown');
  data.stock = { configured: true, error: null, lowStock: 2 };
  expect(buildReportHealthChecks(data).find(c => c.id === 'drip')).toMatchObject({ status: 'warn' });
});

it('keeps partial menu reads unknown in shared Health as well as Product', () => {
  const { menuSplits } = require('@tapuai/shared-types/admin');
  expect(menuSplits({ tabs: { home: false } }, true).find((row: { id: string }) => row.id === 'tabs')).toMatchObject({ on: null, off: null });
});
