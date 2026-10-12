/**
 * Management desk for the Next admin portal. One page for Billing, Marketing, Support, API, and IT.
 * Reads the same reports and revenue the other desks already load. Nothing here writes.
 * @sideEffects `get_admin_reports` and `get_company_revenue_summary`.
 */
import Link from 'next/link';

import { Badge, BarRow, Panel, PortalShell, SectionHeading, StatCard } from '@/components/PortalShell';
import { APP_API_ROUTES, managementAlerts, managementDeskStatus } from '@/lib/departments';
import { fetchPortalReports, fetchPortalRevenue, formatUsd } from '@/lib/reports';

export const dynamic = 'force-dynamic';

function toneBadge(tone: 'ok' | 'warn' | 'danger') {
  if (tone === 'danger') return 'danger' as const;
  if (tone === 'warn') return 'warn' as const;
  return 'ok' as const;
}

export default async function ManagementPage() {
  const [reports, revenue] = await Promise.all([fetchPortalReports(), fetchPortalRevenue()]);
  const snapshot = {
    reportsError: reports.error,
    revenueError: revenue.error,
    donations7dCents: reports.money.malo_cents_7d ?? 0,
    sessions24h: reports.usage.sessions_24h ?? 0,
    issues24h: reports.usage.issues_24h ?? 0,
    openBugs: reports.usage.feedback_bugs_open ?? 0,
    stalls24h: reports.reliability.stalls_24h ?? 0,
    reconnects24h: reports.reliability.reconnects_24h ?? 0,
  };
  const alerts = managementAlerts(snapshot);
  const desks = managementDeskStatus(snapshot);
  const desk = (id: (typeof desks)[number]['id']) => desks.find((item) => item.id === id)!;

  const streamMax = Math.max(...revenue.streams.map((row) => row.gross_cents), 1);
  const tabMax = Math.max(...reports.tabs.map((row) => row.value), 1);
  const issueMax = Math.max(...reports.issues.map((row) => row.value), 1);

  return (
    <PortalShell active="/manage">
      <p className="mb-6 text-sm leading-6 text-[var(--ink-soft)]">
        Billing, Marketing, Support, API, and IT each have a section on this page.
        Analysts and a partner read the same numbers after an admin signs them in from Expo{' '}
        <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin</code> People. This page does not hand out a
        public data key. Changes stay in Expo <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin</code>.
      </p>

      {alerts.length > 0 ? (
        <div className="mb-8 space-y-2">
          {alerts.map((alert) => (
            <p
              key={alert}
              className="rounded-xl border border-[var(--ember-soft)] bg-[var(--ember-soft)] px-4 py-3 text-sm font-semibold text-[var(--ember)]"
            >
              {alert}
            </p>
          ))}
        </div>
      ) : null}

      <SectionHeading title="Right now" hint={reports.generatedAt ? new Date(reports.generatedAt).toLocaleString() : 'Waiting on a read'} />
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {desks.map((item) => (
          <a key={item.id} href={`#${item.id}`} className="block">
            <StatCard
              label={item.title}
              value={item.tone === 'danger' ? 'Failed' : item.tone === 'warn' ? 'Look' : 'Clear'}
              hint={item.status}
              tone={item.tone === 'ok' ? 'ok' : item.tone === 'warn' ? 'warn' : 'danger'}
            />
          </a>
        ))}
      </div>

      <div className="space-y-10">
        <section id="billing">
          <SectionHeading title="Billing" hint="Ledger is on Revenue" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              title="Donations and revenue"
              kicker="Test mode"
              action={<Badge tone={toneBadge(desk('billing').tone)}>{desk('billing').status}</Badge>}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Donations · 7d" value={formatUsd(snapshot.donations7dCents)} hint="Donation window" tone={snapshot.donations7dCents ? 'ok' : 'neutral'} />
                <StatCard label="Gross" value={formatUsd(revenue.gross_volume_cents)} hint="All streams" tone={revenue.gross_volume_cents ? 'ok' : 'neutral'} />
                <StatCard label="Tapua'i keeps" value={formatUsd(revenue.company_net_cents)} hint="Platform share" tone="neutral" />
              </div>
              <p className="text-sm text-[var(--ink-soft)]">
                Payouts stay blocked in this test. Detail is on <Link href="/money" className="font-extrabold text-[var(--jade)]">Revenue</Link>.
              </p>
            </Panel>
            <Panel title="Streams" kicker="Gross">
              {revenue.streams.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No revenue streams in this read.</p>
              ) : (
                revenue.streams.map((row) => (
                  <BarRow key={row.source} label={row.label} value={row.gross_cents} max={streamMax} formatted={formatUsd(row.gross_cents)} />
                ))
              )}
            </Panel>
          </div>
        </section>

        <section id="marketing">
          <SectionHeading title="Marketing" hint="Behavior is on Trends" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              title="Who showed up"
              kicker="24 hours"
              action={<Badge tone={toneBadge(desk('marketing').tone)}>{desk('marketing').status}</Badge>}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard label="Sessions" value={snapshot.sessions24h.toLocaleString()} hint="Tab sessions" tone={snapshot.sessions24h ? 'ok' : 'neutral'} />
                <StatCard label="Taps" value={(reports.usage.taps_24h ?? 0).toLocaleString()} hint="Feature taps" tone="neutral" />
              </div>
              <p className="text-sm text-[var(--ink-soft)]">
                Detail is on <Link href="/reports" className="font-extrabold text-[var(--jade)]">Trends</Link>.
              </p>
            </Panel>
            <Panel title="Tabs" kicker="Where time went">
              {reports.tabs.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No tab samples in this window yet.</p>
              ) : (
                reports.tabs.map((row) => (
                  <BarRow key={row.label} label={row.label} value={row.value} max={tabMax} formatted={row.value.toLocaleString()} />
                ))
              )}
            </Panel>
          </div>
        </section>

        <section id="support">
          <SectionHeading title="Support" hint="Start with the red and gold lines" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              title="What needs a person"
              kicker="Assist"
              action={<Badge tone={toneBadge(desk('support').tone)}>{desk('support').status}</Badge>}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard label="Issues · 24h" value={snapshot.issues24h.toLocaleString()} hint="Control issues" tone={snapshot.issues24h ? 'warn' : 'ok'} />
                <StatCard label="Open bugs" value={snapshot.openBugs.toLocaleString()} hint="Feedback still open" tone={snapshot.openBugs ? 'warn' : 'ok'} />
              </div>
              <p className="text-sm text-[var(--ink-soft)]">
                A gold or red status is the queue. The clip and the reporter stay on Expo{' '}
                <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin</code> moderation.
              </p>
            </Panel>
            <Panel title="Issue types" kicker="24 hours">
              {reports.issues.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No issue types in this window.</p>
              ) : (
                reports.issues.map((row) => (
                  <BarRow key={row.label} label={row.label} value={row.value} max={issueMax} formatted={row.value.toLocaleString()} />
                ))
              )}
            </Panel>
          </div>
        </section>

        <section id="api">
          <SectionHeading title="API" hint="Reads this portal uses" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              title="Portal reads"
              kicker="Data"
              action={<Badge tone={toneBadge(desk('api').tone)}>{desk('api').status}</Badge>}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2">
                  <span className="text-sm font-bold">get_admin_reports</span>
                  <Badge tone={reports.error ? 'danger' : 'ok'}>{reports.error ? 'Failed' : 'Answered'}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2">
                  <span className="text-sm font-bold">get_company_revenue_summary</span>
                  <Badge tone={revenue.error ? 'danger' : 'ok'}>{revenue.error ? 'Failed' : 'Answered'}</Badge>
                </div>
              </div>
            </Panel>
            <Panel title="App routes" kicker="Named, not called from here">
              {APP_API_ROUTES.map((route) => (
                <div key={route.path} className="rounded-xl border border-[var(--border)] px-3 py-2">
                  <p className="text-sm font-bold">{route.path}</p>
                  <p className="text-xs text-[var(--text-muted)]">{route.note}</p>
                </div>
              ))}
            </Panel>
          </div>
        </section>

        <section id="it">
          <SectionHeading title="IT" hint="Playback and connections" />
          <Panel
            title="The last day"
            kicker="Infrastructure"
            action={<Badge tone={toneBadge(desk('it').tone)}>{desk('it').status}</Badge>}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Stalls · 24h" value={snapshot.stalls24h.toLocaleString()} hint="Playback stalls" tone={snapshot.stalls24h ? 'warn' : 'ok'} />
              <StatCard label="Reconnects · 24h" value={snapshot.reconnects24h.toLocaleString()} hint="Live connections" tone={snapshot.reconnects24h ? 'warn' : 'ok'} />
              <StatCard label="Events · 24h" value={(reports.usage.events_24h ?? 0).toLocaleString()} hint="Telemetry events" tone="neutral" />
            </div>
          </Panel>
        </section>
      </div>
    </PortalShell>
  );
}
