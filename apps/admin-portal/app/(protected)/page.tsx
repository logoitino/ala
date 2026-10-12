import Link from 'next/link';

import { ColumnChart } from '@/components/ColumnChart';
import { Panel, PortalShell, SectionHeading, StatCard } from '@/components/PortalShell';
import { homeKpis, teamTrends, UNMEASURED, type DashboardInput } from '@/lib/dashboard';
import { managementDeskStatus } from '@/lib/departments';
import { fetchPortalReports, fetchPortalRevenue, formatUsd } from '@/lib/reports';
import { isAdminPortalConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function minutes(ms: number): string {
  return `${Math.round(ms / 60000).toLocaleString()} min`;
}

/**
 * @purpose Home after sign-in. Eight measured numbers, four 7-day charts, and the industry
 *   measures this portal does not have. Departments stay one link, not a tab.
 * @sideEffects `get_admin_reports` and `get_company_revenue_summary`.
 */
export default async function AdminHomePage() {
  const configured = isAdminPortalConfigured();
  const [reports, revenue] = await Promise.all([fetchPortalReports(), fetchPortalRevenue()]);
  const input: DashboardInput = {
    donations7dCents: reports.money.malo_cents_7d ?? 0,
    donationsPrev7dCents: reports.money.malo_cents_prev_7d ?? 0,
    donationCount7d: reports.money.malo_count_7d ?? 0,
    avgDonation7dCents: reports.money.avg_tip_cents_7d ?? 0,
    clips7d: reports.engagement.clips_7d ?? 0,
    clipsPrev7d: reports.engagement.clips_prev_7d ?? 0,
    sessions24h: reports.usage.sessions_24h ?? 0,
    dwellMs7d: reports.usage.dwell_ms_7d ?? 0,
    taps24h: reports.usage.taps_24h ?? 0,
    stalls24h: reports.reliability.stalls_24h ?? 0,
    flagged: reports.content.flagged ?? 0,
    openBugs: reports.usage.feedback_bugs_open ?? 0,
    grossCents: revenue.gross_volume_cents,
    companyNetCents: revenue.company_net_cents,
  };
  const cards = homeKpis(input, formatUsd);
  const trends = teamTrends(input, reports.series.stalls, formatUsd);
  const desks = managementDeskStatus({
    reportsError: reports.error,
    revenueError: revenue.error,
    donations7dCents: input.donations7dCents,
    sessions24h: input.sessions24h,
    issues24h: reports.usage.issues_24h ?? 0,
    openBugs: input.openBugs,
    stalls24h: input.stalls24h,
    reconnects24h: reports.reliability.reconnects_24h ?? 0,
  });

  return (
    <PortalShell active="/">
      {!configured || reports.error === 'Supabase env missing' ? (
        <Panel title="Connect Supabase" kicker="Setup">
          <p className="text-sm leading-6 text-[var(--ink-soft)]">
            Copy <code className="rounded bg-[var(--jade-soft)] px-1.5">apps/admin-portal/.env.example</code> to{' '}
            <code className="rounded bg-[var(--jade-soft)] px-1.5">.env.local</code> with the same project URL and
            anon key as the mobile app. Then reload.
          </p>
        </Panel>
      ) : null}

      {reports.error && reports.error !== 'Supabase env missing' ? (
        <p className="mb-6 rounded-xl border border-[var(--ember-soft)] bg-[var(--ember-soft)] px-4 py-3 text-sm font-semibold text-[var(--ember)]">
          Reports did not load. {reports.error}
        </p>
      ) : null}
      {revenue.error ? (
        <p className="mb-6 rounded-xl border border-[var(--ember-soft)] bg-[var(--ember-soft)] px-4 py-3 text-sm font-semibold text-[var(--ember)]">
          Revenue did not load. {revenue.error}
        </p>
      ) : null}

      <SectionHeading
        title="Measured this week"
        hint={reports.generatedAt ? new Date(reports.generatedAt).toLocaleString() : 'Waiting on a read'}
      />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} hint={card.hint} tone={card.tone} />
        ))}
      </div>

      <SectionHeading title="Last 7 days" hint="UTC" />
      <div className="mb-8 grid gap-3 lg:grid-cols-2">
        <ColumnChart title="Donations" points={reports.series.malo} formatValue={formatUsd} accent="var(--jade)" />
        <ColumnChart title="Clips uploaded" points={reports.series.clips} formatValue={(value) => value.toLocaleString()} accent="var(--jade)" />
        <ColumnChart title="Time on tabs" points={reports.series.dwell} formatValue={minutes} accent="var(--gold)" />
        <ColumnChart title="Video stalls" points={reports.series.stalls} formatValue={(value) => value.toLocaleString()} accent="var(--ember)" />
      </div>

      <div className="mb-8 grid gap-3 lg:grid-cols-2">
        <Panel title="How the team is moving" kicker="Versus the prior week">
          <ul className="space-y-2">
            {trends.map((line) => (
              <li key={line} className="text-sm leading-6 text-[var(--ink)]">
                {line}
              </li>
            ))}
          </ul>
          <p className="text-sm text-[var(--ink-soft)]">
            Detail is on <Link href="/analytics" className="font-extrabold text-[var(--jade)]">Analytics</Link>,{' '}
            <Link href="/reports" className="font-extrabold text-[var(--jade)]">Trends</Link>,{' '}
            <Link href="/audience" className="font-extrabold text-[var(--jade)]">Audience</Link>, and{' '}
            <Link href="/money" className="font-extrabold text-[var(--jade)]">Revenue</Link>.
          </p>
        </Panel>
        <Panel title="Not measured" kicker="Do not treat a blank as a result">
          <ul className="space-y-3">
            {UNMEASURED.map((gap) => (
              <li key={gap.name}>
                <p className="text-sm font-extrabold">{gap.name}</p>
                <p className="text-sm leading-5 text-[var(--ink-soft)]">{gap.why}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <SectionHeading title="Departments" hint="Status only" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {desks.map((desk) => (
          <Link key={desk.id} href={`/manage#${desk.id}`} className="block">
            <StatCard
              label={desk.title}
              value={desk.tone === 'danger' ? 'Failed' : desk.tone === 'warn' ? 'Look' : 'Clear'}
              hint={desk.status}
              tone={desk.tone === 'ok' ? 'ok' : desk.tone === 'warn' ? 'warn' : 'danger'}
            />
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}
