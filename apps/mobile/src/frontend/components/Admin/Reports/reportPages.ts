/** Page-specific report content for Expo admin. All builders consume snapshots from the existing session;
 * no screen queries a database or manufactures absent counts. Named gift-total rankings stay private. */
import {
  MEASURES, buildAnalytics, homeKpis, teamTrends, readKey, formatUsd, formatReportValue, labelForReportKey,
  UNMEASURED, managementDeskStatus, deskLabel, APP_API_ROUTES, streamName, streamSplitText,
     type AnalyticsChart, type AnalyticsPoint, type ChartAccent, type DashboardInput, type MeasureUnit,
  ledgerDetail, originName, entryName, donationChannel, utcStamp, fillDays, shortDay, donationSplit, kpiUsd, payeeName } from '@tapuai/shared-types/admin';
import type { AdminReportData } from '@/lib/adminReports';
import { chartValue, type ReportChart, type ReportTable } from './reportChartModel';

export type AdminReportPage = 'home' | 'trends' | 'audience' | 'revenue' | 'health' | 'product' | 'analytics' | 'departments' | 'features' | 'profile' | 'sign-in' | 'people' | 'coverage';
export type ReportKpi = { label: string; value: string; missing?: boolean; hint?: string; tone?: string; source?: string;
  delta?: { current: number; previous: number } | null; goodDirection?: 'up' | 'down' | 'none'; spark?: { points: AnalyticsPoint[]; format: MeasureUnit; accent: ChartAccent } | null };
export type ReportSection = { id: string; title: string; hint?: string; sentences?: string[]; kpis?: ReportKpi[]; charts?: ReportChart[];
  tables?: { title: string; table: ReportTable; source?: string; initiallyOpen?: boolean }[]; links?: { label: string; href: string }[] };
export const PAGE_TITLES: Record<AdminReportPage, string> = { home: 'A week of community support.', trends: 'Trends', audience: 'Audience', revenue: 'Revenue', health: 'Health',
  product: 'Product', analytics: 'Analytics', departments: 'Departments', features: 'Features', profile: 'Profile', 'sign-in': 'Sign-in', people: 'People', coverage: 'Control map' };
export const PAGE_LEDES: Record<AdminReportPage, string> = {
  home: 'Community report · Last 7 days', trends: 'How the numbers move over the last 7 days.', audience: 'Who is on the platform: profiles, athletes, schools, and the clip mix.',
  revenue: 'Gifts and the ledger, read from the recorded rows.', health: 'Operational checks, time on tabs, taps, and what breaks.',
  product: 'Menus, profile, sign-in, and people. Changes stay in the editing desks.', analytics: 'Dashboards and the measure catalog. Every number names its source.',
  departments: 'Billing, Marketing, Support, API, and IT on one page.', features: 'Which menus are on. Open the Features desk to make changes.',
  profile: 'What the profile screen is allowed to show.', 'sign-in': 'Which actions ask a guest to create an account.', people: 'Who has a profile. Granting access stays in the People desk.', coverage: 'Every fan control, its published setting, telemetry and owning desk.',
};
export const trend = (title: string, points: AnalyticsPoint[] | null, format: MeasureUnit, accent: ChartAccent, source: string, error: string | null = null, kind: 'line' | 'area' | 'columns' = 'line'): AnalyticsChart =>
  ({ id: source + title, title, caption: 'Last 7 days, UTC', source, keys: [source], error, format, accent, kind, points, windowLabel: 'Last 7 days, UTC' });
export const ranking = (title: string, points: AnalyticsPoint[] | null, format: MeasureUnit, accent: ChartAccent, source: string, error: string | null = null, summary?: string): AnalyticsChart =>
  ({ id: source + title, title, caption: 'Recorded rows', source, keys: [source], error, format, accent, kind: 'bars', points, emptyText: 'Nothing in this window', keepOrder: true, summary });
export const comparison = (title: string, current: number | null, previous: number | null, format: MeasureUnit, accent: ChartAccent, source: string, labels = ['This week', 'Prior week'], error: string | null = null): AnalyticsChart =>
  ({ id: source + title, title, caption: labels.join(' / '), source, keys: [source], error, format, accent, kind: 'compare', current: { label: labels[0], value: current }, previous: { label: labels[1], value: previous },
    subject: title, sentence: `${title}: ${labels[0]} ${chartValue(current, format)}; ${labels[1]} ${chartValue(previous, format)}.` });

const sectionNames = { money: 'Gifts and payouts', engagement: 'Engagement', audience: 'Audience', content: 'Content', live: 'Live ops', usage: 'Behavior', reliability: 'Reliability' } as const;
export function additionalReportSections(d: AdminReportData): ReportSection[] {
  return Object.entries(sectionNames).map(([id, title]) => {
    const section = d.reports[id as keyof typeof sectionNames];
    const known = new Set(MEASURES.filter(m => m.section === id).map(m => m.key));
    const rows = d.reports.configured && !d.reports.error ? Object.entries(section).filter(([key]) => !known.has(key)).map(([key, value]) => [labelForReportKey(key), formatReportValue(key, value)]) : [];
    return { id: `all-${id}`, title, tables: [{ title, table: { columns: ['Measure', 'Value'], rows }, source: `get_admin_reports.${id}`, initiallyOpen: false }] };
  }).filter(section => section.tables[0].table.rows.length > 0);
}
export function reportInputs(d: AdminReportData) {
  const ok = d.reports.configured && !d.reports.error;
  const n = (section: keyof typeof sectionNames, key: string) => readKey(d.reports[section], key, ok);
  const list = (rows: AnalyticsPoint[] | null) => ok ? rows : null;
  const kpi = (label: string, section: keyof typeof sectionNames, key: string, format: MeasureUnit = 'count', hint?: string): ReportKpi => {
    const value = n(section, key); return { label, value: chartValue(value, format), missing: value == null, hint, source: `get_admin_reports.${section}.${key}` };
  };
  return { ok, n, list, kpi, error: d.reports.error };
}
export function homeInput(d: AdminReportData): DashboardInput {
  const { n } = reportInputs(d); const revenueOk = d.revenue.configured && !d.revenue.error;
  return { donations7dCents: n('money', 'malo_cents_7d'), donationsPrev7dCents: n('money', 'malo_cents_prev_7d'), donationCount7d: n('money', 'malo_count_7d'), avgDonation7dCents: n('money', 'avg_tip_cents_7d'),
    clips7d: n('engagement', 'clips_7d'), clipsPrev7d: n('engagement', 'clips_prev_7d'), sessions24h: n('usage', 'sessions_24h'), dwellMs7d: n('usage', 'dwell_ms_7d'), taps24h: n('usage', 'taps_24h'),
    stalls24h: n('reliability', 'stalls_24h'), flagged: n('content', 'flagged'), openBugs: n('usage', 'feedback_bugs_open'), grossCents: revenueOk ? d.revenue.gross_volume_cents : null, companyNetCents: revenueOk ? d.revenue.company_net_cents : null };
}
export function departmentInput(d: AdminReportData) {
  const { n } = reportInputs(d); const revenueOk = d.revenue.configured && !d.revenue.error;
  return { reportsError: d.reports.error, revenueError: d.revenue.error, donations7dCents: n('money', 'malo_cents_7d'), sessions24h: n('usage', 'sessions_24h'), issues24h: n('usage', 'issues_24h'),
    openBugs: n('usage', 'feedback_bugs_open'), stalls24h: n('reliability', 'stalls_24h'), reconnects24h: n('reliability', 'reconnects_24h'),
    grossCents: revenueOk ? d.revenue.gross_volume_cents : null, companyNetCents: revenueOk ? d.revenue.company_net_cents : null };
}
export const unmeasuredSection = (): ReportSection => ({ id: 'not-measured', title: 'Not measured', sentences: UNMEASURED.map(item => `${item.name}: ${item.why}`) });
function streamChart(d: AdminReportData): AnalyticsChart {
  const streams = d.revenue.configured && !d.revenue.error ? [...d.revenue.streams].sort((a, b) => b.gross_cents - a.gross_cents) : null;
  return { id: 'stream-split', title: 'Split per stream', caption: 'Gross, payee share and Tapua’i share', kind: 'stack', source: 'get_company_revenue_summary.streams', keys: ['streams'],
    error: d.revenue.error, format: 'cents', accent: 'jade', emptyText: 'No streams recorded', series: [{ key: 'payee', label: 'Payee share', color: 'jade' }, { key: 'tapuai', label: "Tapua'i share", color: 'gold' }],
    rows: streams?.map(row => ({ label: `${streamName(row.source, row.label)} · ${streamSplitText(row) ?? `to ${payeeName(row.payee)}`}`, total: row.gross_cents, segments: { payee: row.payout_cents, tapuai: row.platform_cents } })) ?? null };
}

/** @purpose Build the complete content for a particular report; Health/Analytics use their richer builders. */
export function reportPageSections(page: AdminReportPage, d: AdminReportData): ReportSection[] {
  const { n, list, kpi, error, ok } = reportInputs(d);
  const series = d.reports.series;
  if (page === 'home') {
    const cards = homeKpis(homeInput(d), formatUsd);
    return [
      { id: 'donations', title: 'Gifts', charts: [trend('Gifts', list(series.malo), 'cents', 'jade', 'get_admin_reports.series.malo', error, 'area')] },
      { id: 'clips', title: 'Clips', charts: [trend('Clips', list(series.clips), 'count', 'cyan', 'get_admin_reports.series.clips', error, 'columns')] },
      { id: 'rest', title: 'The rest of the picture', kpis: cards.filter(c => !['donations', 'avgDonation', 'clips', 'opens'].includes(c.id)), tables: [{ title: 'Data sources', table: { columns: ['Measure', 'Meaning'], rows: cards.map(c => [c.label, c.hint]) }, source: 'get_admin_reports; get_company_revenue_summary' }] },
      { id: 'attention', title: 'Attention and playback', charts: [trend('Time on tabs', list(series.dwell), 'minutes', 'gold', 'get_admin_reports.series.dwell', error), trend('Video stalls', list(series.stalls), 'count', 'bad', 'get_admin_reports.series.stalls', error, 'columns')] },
      { id: 'glance', title: 'Week at a glance', charts: [{ id: 'week-heat', kind: 'heat', title: 'Week at a glance', caption: 'Last 7 days, UTC', source: 'get_admin_reports.series', error,
        rows: [{ title: 'Gifts', points: list(series.malo), format: 'cents', accent: 'jade' }, { title: 'Clips', points: list(series.clips), format: 'count', accent: 'cyan' }, { title: 'Time on tabs', points: list(series.dwell), format: 'minutes', accent: 'gold' }, { title: 'Stalls', points: list(series.stalls), format: 'count', accent: 'bad' }] }] },
      { id: 'changes', title: 'What changed this week', sentences: teamTrends(homeInput(d), ok ? series.stalls ?? [] : [], formatUsd), links: [{ label: 'Open Trends', href: '/admin/trends' }, { label: 'Open Analytics', href: '/admin/analytics' }] },
      unmeasuredSection(), { id: 'departments', title: 'Departments', kpis: managementDeskStatus(departmentInput(d)).map(desk => ({ label: desk.title, value: deskLabel(desk.tone), hint: desk.status, tone: desk.tone })), links: [{ label: 'Open Departments', href: '/admin/departments' }] },
    ];
  }
  if (page === 'trends') {
    return [
      { id: 'week', title: 'This week against the prior week', hint: 'Only clips and gifts have a prior week in this read', charts: [comparison('Clips', n('engagement', 'clips_7d'), n('engagement', 'clips_prev_7d'), 'count', 'cyan', 'get_admin_reports.engagement', undefined, error), comparison('Gifts', n('money', 'malo_cents_7d'), n('money', 'malo_cents_prev_7d'), 'cents', 'jade', 'get_admin_reports.money', undefined, error)] },
      { id: 'pace', title: 'Last 24 hours against the 7-day daily average', hint: 'Rolling windows, UTC. The average is the 7-day total ÷ 7.', charts: [
        ['Clips uploaded', 'engagement', 'clips', 'count', 'cyan'], ['Gifts', 'money', 'malo_cents', 'cents', 'jade'], ['Feature taps', 'usage', 'taps', 'count', 'violet'], ['UI issues', 'usage', 'issues', 'count', 'bad'], ['Time on tabs', 'usage', 'dwell_ms', 'minutes', 'gold'],
      ].map(([title, section, key, format, accent]) => { const week = n(section as keyof typeof sectionNames, key + '_7d'); return comparison(title, n(section as keyof typeof sectionNames, key + '_24h'), week == null ? null : week / 7, format as MeasureUnit, accent as ChartAccent, `get_admin_reports.${section}.${key}_24h; ${key}_7d`, ['Last 24 hours', '7-day daily average'], error); }) },
      { id: 'analysis', title: 'Explore the underlying data', sentences: ['All daily series, counts, distributions and rankings remain in Analytics. Revenue uses a separate fourteen-day gift read.'], links: [{ label: 'Open Analytics', href: '/admin/analytics' }, { label: 'Open Revenue', href: '/admin/revenue' }, { label: 'Open Health', href: '/admin/health' }] },
    ];
  }
  if (page === 'audience') return [
    { id: 'people', title: 'Who is on the platform', links: [{ label: 'Manage People', href: '/admin/people' }, { label: 'Manage Athletes', href: '/admin/athletes' }, { label: 'Manage Schools', href: '/admin/schools' }], kpis: [kpi('Profiles', 'audience', 'profiles'), kpi('Athletes', 'audience', 'athletes'), kpi('Schools', 'audience', 'schools'), kpi('Verify queue', 'audience', 'pending_verify')] },
    { id: 'verified', title: 'Verification', kpis: [kpi('Admin profiles', 'audience', 'admins', 'count', 'Can open Main Admin')], charts: [{ id: 'verify-meter', kind: 'meter', title: 'Verified profiles', caption: 'Verified profiles, not only athletes', source: 'get_admin_reports.audience', error, part: n('audience', 'verified'), whole: n('audience', 'profiles') }] },
    { id: 'schools', title: 'Schools and clips', charts: [ranking('Schools by athletes listed', list(d.reports.leaders.schools), 'count', 'cyan', 'get_admin_reports.leaders.schools', error), ...buildAnalytics(d.reports, d.revenue).boards.find(b => b.id === 'trust')!.charts.filter(c => c.id === 'split-categories')] },
  ];
  if (page === 'revenue') return revenueSections(d);
  if (page === 'departments') return departmentSections(d);
  return [];
}

function revenueSections(d: AdminReportData): ReportSection[] {
  const { n, kpi, list, error } = reportInputs(d); const r = d.revenue; const valid = r.configured && !r.error;
  const money = (label: string, value: number | null, hint: string): ReportKpi => ({ label, value: valid && value != null ? kpiUsd(value) : '—', missing: !valid || value == null, hint });
  const split = (title: string, parts: { key: string; label: string; value: number | null; color: ChartAccent }[], source: string): Extract<AnalyticsChart, { kind: 'split' }> => ({ id: title, title, kind: 'split', caption: 'Recorded rows', source, keys: [source], format: 'cents', accent: 'jade', error: r.error, parts, totalLabel: 'Total' });
  const breakdownOk = d.breakdown.configured && !d.breakdown.error;
  const unsplit = valid && r.gross_volume_cents != null && r.payouts_cents != null && r.company_net_cents != null ? Math.max(0, r.gross_volume_cents - r.payouts_cents - r.company_net_cents) : 0;
  const donations = valid ? donationSplit(r.streams) : null;
  const recordedParts = [{ key: 'payee', label: 'Payee share (families, athletes, operators)', value: valid ? r.payouts_cents : null, color: 'jade' as const }, { key: 'company', label: "Tapua'i share", value: valid ? r.company_net_cents : null, color: 'gold' as const }, ...(unsplit > 0 ? [{ key: 'unsplit', label: 'Recorded gross not split', value: unsplit, color: 'muted' as const }] : [])];
  const ledgerRing: AnalyticsChart = { ...split('Where recorded gross goes', recordedParts, 'get_company_revenue_summary'), kind: 'ring', centerLabel: 'Recorded gross', centerValue: chartValue(valid ? r.gross_volume_cents : null, 'cents') };
  const policySplit = split('Gift split, from the ledger', [{ key: 'family', label: "Athletes' family accounts", value: donations?.family ?? null, color: 'jade' }, { key: 'company', label: "Tapua'i share (covers card processing)", value: donations?.platform ?? null, color: 'gold' }, ...(donations && donations.unsplit > 0 ? [{ key: 'unsplit', label: 'Recorded but not split', value: donations.unsplit, color: 'muted' as const }] : [])], 'get_company_revenue_summary.streams[malo]');
  policySplit.caption = donations?.policy ? `Stated policy for this stream: ${donations.policy}` : 'Gifts stream';
  const daily = trend('Gifts per day', breakdownOk ? fillDays(d.breakdown.byDay).map(day => ({ label: shortDay(day.day), value: day.cents })) : null, 'cents', 'jade', 'get_admin_malo_breakdown.by_day', d.breakdown.error, 'columns');
  if ('windowLabel' in daily) daily.windowLabel = 'Last 14 days, UTC'; daily.caption = 'Last 14 days, UTC';
  const cross = donations && n('money', 'malo_cents_all') != null ? donations.gross - n('money', 'malo_cents_all')! : null;
  const queued = n('money', 'queued_payouts');
  const donationKpi = (label: string, valueKey: string, countKey: string): ReportKpi => {
    const item = kpi(label, 'money', valueKey, 'cents'); const count = n('money', countKey); const value = n('money', valueKey);
    if (value != null) item.value = kpiUsd(value); if (count != null) item.hint = `${count.toLocaleString('en-US')} ${count === 1 ? 'gift' : 'gifts'}`;
    if (valueKey === 'malo_cents_7d') { const previous = n('money', 'malo_cents_prev_7d'); item.delta = value != null && previous != null ? { current: value, previous } : null; item.goodDirection = 'up'; item.spark = list(d.reports.series.malo)?.length ? { points: d.reports.series.malo!, format: 'cents', accent: 'jade' } : null; }
    return item;
  };
  return [
    { id: 'test-mode', title: 'Wave 0 test mode', sentences: [`Stripe is in test mode, so every amount here is a test record and no real money has moved. Payouts are blocked.${queued != null ? ` Queued payout requests: ${queued}.` : ''}${valid && r.stripe_paid_cents! > 0 ? ' Some payout rows are marked paid. Check them before trusting this banner.' : ' Nothing has been sent to a family, athlete, or operator.'}`, 'Gifts: 90% to the athlete or family account, 10% to Tapua’i. Vault purchases: 80% recorded for the athlete, 20% to Tapua’i. Drip purchases: 100% to Tapua’i.'] },
    { id: 'ledger', title: 'Ledger totals', kpis: [money('Gross volume', r.gross_volume_cents, 'Recorded ledger gross'), money("Tapua'i share", r.company_net_cents, 'Recorded for Tapua’i'), money('Payee share recorded', r.payouts_cents, 'Recorded share, not proof of a payout'), { ...money('Payouts marked paid', r.stripe_paid_cents, valid && r.stripe_paid_cents! > 0 ? 'Should be $0 while payouts are blocked. Check the paid rows in the disbursements table.' : 'Stays $0 while payouts are blocked in Wave 0'), tone: valid && r.stripe_paid_cents! > 0 ? 'warn' : 'neutral' }],
      // copy-ok: 'tips' is the raw SQL source shown to staff; visible identifier leak is recorded in the copy report.
    charts: [ledgerRing, policySplit], sentences: cross == null ? [] : [`Cross-check: the ledger records ${formatUsd(donations!.gross)} in gifts and the tips table holds ${formatUsd(n('money', 'malo_cents_all')!)}. ${cross === 0 ? 'They match.' : `They differ by ${formatUsd(Math.abs(cross))}. Check company_revenue_logs.`}`] },
    { id: 'streams', title: 'Streams', hint: 'Ordered by gross; complete splits are in Data', charts: [streamChart(d)] },
    { id: 'donations', title: 'Gifts', kpis: [donationKpi('Gifts, last 7 days', 'malo_cents_7d', 'malo_count_7d'), donationKpi('Gifts, last 24 hours', 'malo_cents_24h', 'malo_count_24h'), { ...kpi('Average gift, 7 days', 'money', 'avg_tip_cents_7d', 'cents'), hint: 'Mean amount per gift' }, donationKpi('Gifts, all time', 'malo_cents_all', 'malo_count_all')],
      charts: [daily, comparison('This week versus the prior week', n('money', 'malo_cents_7d'), n('money', 'malo_cents_prev_7d'), 'cents', 'jade', 'get_admin_reports.money', ['Last 7 days', 'Prior 7 days'], error),
        ranking('Where gifts start', breakdownOk ? d.breakdown.byOrigin.map(row => ({ label: `${originName(row.key)} (${row.count} ${row.count === 1 ? 'gift' : 'gifts'})`, value: row.cents })) : null, 'cents', 'jade', 'get_admin_malo_breakdown.by_origin', d.breakdown.error), ranking('How gift senders arrived', breakdownOk ? d.breakdown.byEntry.map(row => ({ label: `${entryName(row.key)} (${row.count} ${row.count === 1 ? 'gift' : 'gifts'})`, value: row.cents })) : null, 'cents', 'jade', 'get_admin_malo_breakdown.by_entry', d.breakdown.error)],
      sentences: d.breakdown.source === 'fallback' ? ['Partial: only the last 200 gifts were read. Daily totals, origins and arrivals count only those rows. A day can show $0 when its gifts are older than these 200.'] : [] },
    { id: 'recent', title: 'Recent ledger', sentences: valid && !r.recent.length ? ['No ledger rows yet. A row is written after a test-mode gift, booster, or Vault charge.'] : [], tables: [{ title: 'Recent ledger', source: 'get_company_revenue_summary.recent', initiallyOpen: true, table: { columns: ['When (UTC)', 'Stream', 'Detail', 'Gross', "Tapua'i share", 'Payee share'], rows: valid ? r.recent.slice(0, 40).map(row => [utcStamp(row.created_at) ?? 'Not in this read', streamName(row.source, row.source), ledgerDetail(row.source, row.label), chartValue(row.gross_cents, 'cents'), chartValue(row.platform_cents, 'cents'), chartValue(row.payout_cents, 'cents')]) : [] } }] },
    { id: 'latest', title: 'Latest gifts', sentences: breakdownOk && !d.breakdown.recent.length ? ['No gifts yet.'] : [], tables: [{ title: 'Latest gifts', source: d.breakdown.source === 'fallback' ? 'tips' : 'get_admin_malo_breakdown.recent', initiallyOpen: true, table: { columns: ['When (UTC)', 'Athlete', 'Gift sender', 'Where it started', 'Linked to', 'Amount'], rows: breakdownOk ? d.breakdown.recent.slice(0, 40).map(row => [utcStamp(row.created_at) ?? 'Not in this read', row.athlete_name, row.fan_name, donationChannel(row.origin, row.entry, row.source_label), row.wishlist_item_id ? `Gear goal ${row.wishlist_item_id.slice(0, 8)}` : row.reel_id ? `Clip ${row.reel_id.slice(0, 8)}` : 'Not linked to a clip or gear goal', formatUsd(row.amount_cents)]) : [] } }] },
  ];
}

function departmentSections(d: AdminReportData): ReportSection[] {
  const { kpi } = reportInputs(d); const desks = managementDeskStatus(departmentInput(d));
  const totals = departmentInput(d);
  return [
    { id: 'now', title: 'Right now', kpis: desks.map(row => ({ label: row.title, value: deskLabel(row.tone), hint: row.status, tone: row.tone })) },
    { id: 'billing', title: 'Billing', kpis: [{ label: 'Gifts · 7d', value: chartValue(totals.donations7dCents, 'cents'), missing: totals.donations7dCents == null }, { label: 'Gross volume', value: chartValue(totals.grossCents, 'cents'), missing: totals.grossCents == null }, { label: "Tapua'i share", value: chartValue(totals.companyNetCents, 'cents'), missing: totals.companyNetCents == null }], sentences: ['Gifts and revenue are recorded amounts. Vault remains recorded for the athlete; family routing is pending counsel and implementation.'], links: [{ label: 'Open Revenue', href: '/admin/revenue' }] },
    { id: 'marketing', title: 'Marketing', kpis: [kpi('Tab opens · 24h', 'usage', 'sessions_24h', 'count', 'Events, not distinct people'), kpi('Feature taps · 24h', 'usage', 'taps_24h', 'count', 'Tap events, not people')], links: [{ label: 'Attention in Health', href: '/admin/health' }] },
    { id: 'support', title: 'Support', kpis: [kpi('UI issues · 24h', 'usage', 'issues_24h'), kpi('Open bug reports', 'usage', 'feedback_bugs_open')], sentences: ['What needs a person: start with the Check or Failed departments above. Reports and moderation remain human review work.'], links: [{ label: 'Open Feedback desk', href: '/admin/feedback' }, { label: 'Errors in Health', href: '/admin/health' }] },
    { id: 'api', title: 'API', sentences: ['Portal reads: report snapshots use the signed-in admin session. No public export or service credentials.'], tables: [{ title: 'Portal reads', source: 'Existing admin RPCs', table: { columns: ['Read', 'Status'], rows: [['get_admin_reports', d.reports.error ?? (d.reports.configured ? 'Read available' : 'Not configured')], ['get_company_revenue_summary', d.revenue.error ?? (d.revenue.configured ? 'Read available' : 'Not configured')]] }, initiallyOpen: true }, { title: 'App routes', source: 'API route directory; named here, not called', table: { columns: ['Route', 'Purpose'], rows: APP_API_ROUTES.map(row => [row.path, row.note]) }, initiallyOpen: true }] },
    { id: 'it', title: 'IT', kpis: [kpi('Video stalls · 24h', 'reliability', 'stalls_24h'), kpi('Live reconnects · 24h', 'reliability', 'reconnects_24h'), kpi('Telemetry events · 24h', 'reliability', 'events_24h')], sentences: ['Playback and live connections: fewer stalls and reconnects is better. Native and hosted readiness are separate checks.'], links: [{ label: 'Open Health', href: '/admin/health' }] },
  ];
}
