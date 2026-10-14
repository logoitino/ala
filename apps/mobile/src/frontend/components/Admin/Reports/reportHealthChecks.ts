/** Operational triage belongs to Health; missing report inputs cannot certify a passing check. */
import type { AdminReportData } from '@/lib/adminReports';
import { countRuntimeChanges, parseAppRuntimeConfig } from '@/lib/runtime';
import { reportInputs } from './reportPages';
export type ReportHealthCheck = { id: string; label: string; status: 'fail' | 'warn' | 'unknown' | 'ok'; detail: string; rule: string; href: string };
/** Retain the thirteen legacy operational rules and make unknown reads a distinct state. */
export function buildReportHealthChecks(data: AdminReportData): ReportHealthCheck[] {
  const { n } = reportInputs(data);
  const band = (value: number, warn: number, fail = Infinity) => value >= fail ? 'fail' : value >= warn ? 'warn' : 'ok';
  const measured = (id: string, label: string, value: number | null, rule: string, href: string, assess: (value: number) => ReportHealthCheck['status'], unit = ''): ReportHealthCheck => ({
    id, label, rule, href, status: value == null ? 'unknown' : assess(value), detail: value == null ? 'Not in this read' : `${value.toLocaleString('en-US')}${unit}`,
  });
  const lowStock = data.stock?.configured && !data.stock.error ? data.stock.lowStock : null;
  const skus = n('live', 'drip_skus');
  const runtimeOk = data.runtime.configured && !data.runtime.error && data.runtime.dirty != null;
  const pending = runtimeOk ? countRuntimeChanges(parseAppRuntimeConfig(data.runtime.draft), parseAppRuntimeConfig(data.runtime.published)) : null;
  const checks: ReportHealthCheck[] = [
    measured('stalls', 'Video stalls', n('reliability', 'stalls_24h'), '24h · Check ≥1; Failed ≥5', '/admin/qa', v => band(v, 1, 5)),
    measured('reconnects', 'Realtime reconnects', n('reliability', 'reconnects_24h'), '24h · Check ≥1; Failed ≥10', '/admin/qa', v => band(v, 1, 10)),
    measured('checkout', 'Donation checkout', n('reliability', 'avg_checkout_ms_24h'), 'Mean logged step, 24h · Check ≥3,000 ms; Failed ≥8,000 ms', '/admin/qa', v => band(v, 3000, 8000), ' ms'),
    measured('flags', 'Open flags', n('content', 'flagged'), 'Current · Check ≥1; Failed ≥8', '/admin/moderation', v => band(v, 1, 8)),
    measured('payouts', 'Queued payouts', n('money', 'queued_payouts'), 'Current · Check when any request is queued; Wave 0 payouts remain blocked', '/admin/money', v => band(v, 1)),
    measured('verify', 'Verify queue', n('audience', 'pending_verify'), 'Current · Check when any verification is pending', '/admin/people', v => band(v, 1)),
    measured('live', 'Live board', n('live', 'live_games'), 'Current · Check when no match is live', '/admin/games', v => v === 0 ? 'warn' : 'ok'),
    { id: 'drip', label: 'Drip rack', href: '/admin/drip', rule: 'Current · Check with no active SKUs or any active inventory between 1 and 7 units',
      status: skus === 0 || (lowStock != null && lowStock > 0) ? 'warn' : skus == null || lowStock == null ? 'unknown' : 'ok',
      detail: `${skus == null ? '—' : skus} active SKUs · ${lowStock == null ? 'stock not in this read' : `${lowStock} low stock`}` },
    measured('uploads', 'Uploads (24h)', n('engagement', 'clips_24h'), '24h · Check when no new clip is uploaded', '/admin/highlights', v => v === 0 ? 'warn' : 'ok'),
    measured('spotlight', 'Spotlight window', n('content', 'spotlight_live'), 'Current · Check when no award is in the live window', '/admin/spotlight', v => v === 0 ? 'warn' : 'ok'),
    { id: 'chrome', label: 'Unpublished changes', href: '/admin/features', rule: 'Draft · Check while changes wait on Publish to app',
      status: !runtimeOk ? 'unknown' : data.runtime.dirty ? 'warn' : 'ok', detail: pending == null ? 'Not in this read' : `${pending} unpublished change${pending === 1 ? '' : 's'}` },
    measured('sessions', 'Tab opens', n('usage', 'sessions_24h'), '24h · Check when no tab-open event is recorded', '/admin/analytics', v => v === 0 ? 'warn' : 'ok'),
    measured('ui-issues', 'Control issues', n('usage', 'issues_24h'), '24h · Check ≥3; Failed ≥12', '/admin/feedback', v => band(v, 3, 12)),
  ];
  const order = { fail: 0, warn: 1, unknown: 2, ok: 3 };
  return checks.sort((a, b) => order[a.status] - order[b.status]);
}
