import Link from 'next/link';

import { Panel, PortalShell, StatCard } from '@/components/PortalShell';
import {
  fetchPortalReports,
  formatReportValue,
  formatUsd,
  labelForReportKey,
  type ReportLeader,
  type ReportSection,
} from '@/lib/reports';

export const dynamic = 'force-dynamic';

function MetricList({ section }: { section: ReportSection }) {
  const rows = Object.entries(section);
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No samples in this window yet.</p>;
  }
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between rounded-xl border border-emerald-900/10 px-3 py-2">
          <dt className="text-sm text-slate-600">{labelForReportKey(key)}</dt>
          <dd className="text-sm font-extrabold">{formatReportValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function LeaderList({ rows, money }: { rows: ReportLeader[]; money?: boolean }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No leaders yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center justify-between rounded-xl border border-emerald-900/10 px-3 py-2">
          <span className="text-sm font-bold">{row.label}</span>
          <span className="text-sm font-extrabold">{money ? formatUsd(row.value) : row.value.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * @purpose Web Reports desk — fan behavior (tabs, taps, issues) + money windows from `get_admin_reports`.
 * @sideEffects Same RPC as Expo `/admin/reports`.
 */
export default async function ReportsPage() {
  const reports = await fetchPortalReports();
  const usage = reports.usage;
  const money = reports.money;

  return (
    <PortalShell active="/reports">
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sessions · 24h"
          value={(usage.sessions_24h ?? 0).toLocaleString()}
          hint="Tab sessions from telemetry"
          tone={usage.sessions_24h ? 'ok' : 'neutral'}
        />
        <StatCard
          label="Taps · 24h"
          value={(usage.taps_24h ?? 0).toLocaleString()}
          hint="Feature taps"
          tone={usage.taps_24h ? 'ok' : 'neutral'}
        />
        <StatCard
          label="Mālo · 7d"
          value={formatUsd(money.malo_cents_7d ?? 0)}
          hint="tips.amount_cents window"
          tone={money.malo_cents_7d ? 'ok' : 'neutral'}
        />
        <StatCard
          label="Issues · 24h"
          value={(usage.issues_24h ?? 0).toLocaleString()}
          hint="Control issues"
          tone={usage.issues_24h ? 'warn' : 'ok'}
        />
      </div>

      {reports.error ? (
        <Panel title="Could not load reports" kicker="RPC">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {reports.error}. Needs <code>get_admin_reports</code> (run <code>supabase/admin_reports.sql</code> +{' '}
            <code>supabase/usage_reports.sql</code>).
          </p>
        </Panel>
      ) : null}

      <p className="mb-6 text-sm text-slate-600">
        Same numbers Expo <code className="rounded bg-emerald-50 px-1.5">/admin/reports</code> reads.{' '}
        {reports.generatedAt ? <>Generated {new Date(reports.generatedAt).toLocaleString()}.</> : null} Ledger detail is
        on <Link href="/money" className="font-extrabold text-[var(--jade)]">Money →</Link>
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Behavior" kicker="Usage">
          <MetricList section={reports.usage} />
        </Panel>
        <Panel title="Reliability" kicker="Playback + checkout">
          <MetricList section={reports.reliability} />
        </Panel>
        <Panel title="Money windows" kicker="Mālo">
          <MetricList section={reports.money} />
        </Panel>
        <Panel title="Engagement" kicker="Highlights ⚡">
          <MetricList section={reports.engagement} />
        </Panel>
        <Panel title="Content" kicker="Vault + flags">
          <MetricList section={reports.content} />
        </Panel>
        <Panel title="Audience" kicker="People">
          <MetricList section={reports.audience} />
        </Panel>
        <Panel title="Live ops" kicker="Local">
          <MetricList section={reports.live} />
        </Panel>
        <Panel title="Time on tabs" kicker="Dwell">
          <LeaderList rows={reports.tabs} />
        </Panel>
        <Panel title="Feature taps" kicker="Controls">
          <LeaderList rows={reports.features} />
        </Panel>
        <Panel title="Control issues" kicker="Friction">
          <LeaderList rows={reports.issues} />
        </Panel>
        <Panel title="Scroll depth" kicker="Feed">
          <LeaderList rows={reports.scroll} />
        </Panel>
        <Panel title="Mālo leaders" kicker="Who the app rewards">
          <LeaderList rows={reports.leaders.malo} money />
        </Panel>
        <Panel title="Hype leaders" kicker="Hottest clips">
          <LeaderList rows={reports.leaders.hype} />
        </Panel>
        <Panel title="Schools" kicker="Athletes by school">
          <LeaderList rows={reports.leaders.schools} />
        </Panel>
      </div>
    </PortalShell>
  );
}
