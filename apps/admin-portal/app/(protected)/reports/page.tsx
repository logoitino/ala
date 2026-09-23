import Link from 'next/link';

import { BarRow, Panel, PortalShell, SectionHeading, StatCard } from '@/components/PortalShell';
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
    return <p className="text-sm text-[var(--text-muted)]">No samples in this window yet.</p>;
  }
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2">
          <dt className="text-sm text-[var(--ink-soft)]">{labelForReportKey(key)}</dt>
          <dd className="text-sm font-extrabold">{formatReportValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function LeaderBars({ rows, money }: { rows: ReportLeader[]; money?: boolean }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No leaders yet.</p>;
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <BarRow
          key={row.label}
          label={row.label}
          value={row.value}
          max={max}
          formatted={money ? formatUsd(row.value) : row.value.toLocaleString()}
        />
      ))}
    </div>
  );
}

/**
 * @purpose Web Reports desk — fan behavior (tabs, taps, issues) + money windows from `get_admin_reports`,
 *   grouped into sections instead of one flat grid of 13 equal-weight panels.
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
          <p className="rounded-xl border border-[var(--gold-soft)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold text-[var(--gold)]">
            {reports.error}. Needs <code>get_admin_reports</code> (run <code>supabase/admin_reports.sql</code> +{' '}
            <code>supabase/usage_reports.sql</code>).
          </p>
        </Panel>
      ) : null}

      <p className="mb-8 text-sm text-[var(--text-muted)]">
        Same numbers Expo <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin/reports</code> reads.{' '}
        {reports.generatedAt ? <>Generated {new Date(reports.generatedAt).toLocaleString()}.</> : null} Ledger detail
        is on <Link href="/money" className="font-extrabold text-[var(--jade)]">Money →</Link>
      </p>

      <div className="space-y-10">
        <section>
          <SectionHeading title="Leaderboards" hint="Who the app rewards and what's hot" />
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Mālo leaders" kicker="Top earners">
              <LeaderBars rows={reports.leaders.malo} money />
            </Panel>
            <Panel title="Hype leaders" kicker="Hottest clips">
              <LeaderBars rows={reports.leaders.hype} />
            </Panel>
            <Panel title="Schools" kicker="Athletes by school">
              <LeaderBars rows={reports.leaders.schools} />
            </Panel>
          </div>
        </section>

        <section>
          <SectionHeading title="Money & engagement" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Money windows" kicker="Mālo">
              <MetricList section={reports.money} />
            </Panel>
            <Panel title="Engagement" kicker="Highlights ⚡">
              <MetricList section={reports.engagement} />
            </Panel>
          </div>
        </section>

        <section>
          <SectionHeading title="Audience & content" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Audience" kicker="People">
              <MetricList section={reports.audience} />
            </Panel>
            <Panel title="Content" kicker="Vault + flags">
              <MetricList section={reports.content} />
            </Panel>
            <Panel title="Live ops" kicker="Local">
              <MetricList section={reports.live} />
            </Panel>
          </div>
        </section>

        <section>
          <SectionHeading title="Behavior" hint="How fans use the app" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Behavior" kicker="Usage">
              <MetricList section={reports.usage} />
            </Panel>
            <Panel title="Time on tabs" kicker="Dwell">
              <LeaderBars rows={reports.tabs} />
            </Panel>
            <Panel title="Feature taps" kicker="Controls">
              <LeaderBars rows={reports.features} />
            </Panel>
            <Panel title="Scroll depth" kicker="Feed">
              <LeaderBars rows={reports.scroll} />
            </Panel>
          </div>
        </section>

        <section>
          <SectionHeading title="Reliability" hint="Playback + checkout friction" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Reliability" kicker="Playback + checkout">
              <MetricList section={reports.reliability} />
            </Panel>
            <Panel title="Control issues" kicker="Friction">
              <LeaderBars rows={reports.issues} />
            </Panel>
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
