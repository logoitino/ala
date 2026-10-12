/**
 * Management desk (`/manage`, shown as Departments). One page for Billing, Marketing, Support,
 * API, and IT. Reads the same reports and revenue the other desks already load. Nothing here
 * writes. Tab time is shown in minutes; a missing key shows "—"; a failed read is an alert.
 * @sideEffects `get_admin_reports` and `get_company_revenue_summary`.
 */
import Link from 'next/link';

import { HBarList, StackedBars, StatTile } from '@/components/charts';
import { Badge, Panel, PortalShell, SectionHeading } from '@/components/PortalShell';
import { formatCompactCount, formatCount, formatMinutes, readKey } from '@/lib/dashboard';
import { APP_API_ROUTES, managementAlerts, managementDeskStatus } from '@/lib/departments';
import { fetchPortalReports, fetchPortalRevenue, formatUsd } from '@/lib/reports';

export const dynamic = 'force-dynamic';

function toneBadge(tone: 'ok' | 'warn' | 'danger') {
  if (tone === 'danger') return 'danger' as const;
  if (tone === 'warn') return 'warn' as const;
  return 'ok' as const;
}

function deskValue(tone: 'ok' | 'warn' | 'danger') {
  return tone === 'danger' ? 'Failed' : tone === 'warn' ? 'Look' : 'Clear';
}

export default async function ManagementPage() {
  const [reports, revenue] = await Promise.all([fetchPortalReports(), fetchPortalRevenue()]);
  const reportsOk = reports.configured && !reports.error;
  const revenueOk = revenue.configured && !revenue.error;
  const key = (section: Record<string, number>, name: string) => readKey(section, name, reportsOk);

  const donations7d = key(reports.money, 'malo_cents_7d');
  const sessions24h = key(reports.usage, 'sessions_24h');
  const taps24h = key(reports.usage, 'taps_24h');
  const issues24h = key(reports.usage, 'issues_24h');
  const openBugs = key(reports.usage, 'feedback_bugs_open');
  const stalls24h = key(reports.reliability, 'stalls_24h');
  const reconnects24h = key(reports.reliability, 'reconnects_24h');
  // events_24h lives in `reliability` in get_admin_reports, not `usage`.
  const events24h = key(reports.reliability, 'events_24h');
  const gross = revenueOk ? revenue.gross_volume_cents : null;
  const net = revenueOk ? revenue.company_net_cents : null;

  const snapshot = {
    reportsError: reports.error,
    revenueError: revenue.error,
    donations7dCents: donations7d ?? 0,
    sessions24h: sessions24h ?? 0,
    issues24h: issues24h ?? 0,
    openBugs: openBugs ?? 0,
    stalls24h: stalls24h ?? 0,
    reconnects24h: reconnects24h ?? 0,
  };
  const alerts = managementAlerts(snapshot);
  const desks = managementDeskStatus(snapshot);
  const desk = (id: (typeof desks)[number]['id']) => desks.find((item) => item.id === id)!;
  const count = (value: number | null) => (value == null ? '—' : formatCount(value));
  const usd = (value: number | null) => (value == null ? '—' : formatUsd(value));
  const warnIf = (value: number | null) => (value == null ? 'neutral' : value > 0 ? 'warn' : 'ok');

  return (
    <PortalShell active="/manage">
      <p className="mb-6 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">
        Billing, Marketing, Support, API, and IT each have a section on this page. Analysts and a partner read the same
        numbers after an admin signs them in from Expo <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin</code>{' '}
        People. This page does not hand out a public data key. Changes stay in Expo{' '}
        <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin</code>.
      </p>

      {alerts.length > 0 ? (
        <div role="alert" className="mb-8 space-y-2">
          {alerts.map((alert) => (
            <p key={alert} className="rounded-xl border border-[var(--ember)]/30 bg-[var(--ember-soft)] px-4 py-3 text-sm font-semibold text-[var(--ember)]">
              {alert}
            </p>
          ))}
        </div>
      ) : null}

      <section aria-labelledby="manage-now" className="mb-10">
        <SectionHeading
          id="manage-now"
          level={2}
          title="Right now"
          hint={reports.generatedAt ? `Read at ${new Date(reports.generatedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC` : 'Waiting on a read'}
        />
        <nav aria-label="Departments on this page" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {desks.map((item) => (
            <a key={item.id} href={`#${item.id}`} className="block rounded-2xl">
              <StatTile label={item.title} value={deskValue(item.tone)} hint={item.status} tone={item.tone === 'ok' ? 'ok' : item.tone === 'warn' ? 'warn' : 'danger'} />
            </a>
          ))}
        </nav>
      </section>

      <div className="space-y-12">
        <section id="billing" aria-labelledby="billing-heading" className="scroll-mt-40">
          <SectionHeading id="billing-heading" level={2} title="Billing" hint="Ledger detail is on Revenue" />
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <StatTile label="Donations · 7d" value={usd(donations7d)} missing={donations7d == null} hint="Recorded donations, last 7 days" goodDirection="none" />
            <StatTile label="Gross" value={usd(gross)} missing={gross == null} hint="All streams in the ledger" goodDirection="none" />
            <StatTile label="Tapua'i keeps" value={usd(net)} missing={net == null} hint="Platform share recorded in the ledger" goodDirection="none" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <StackedBars
              title="Streams: Tapua'i share and payouts"
              caption="Each stream's recorded gross, split into what Tapua'i keeps and what is paid out"
              source="get_company_revenue_summary.streams"
              rows={
                revenueOk
                  ? revenue.streams.map((row) => ({
                      label: row.label,
                      segments: { platform: row.platform_cents, payout: row.payout_cents },
                      total: row.gross_cents,
                    }))
                  : null
              }
              series={[
                { key: 'platform', label: "Tapua'i share", color: 'jade' },
                { key: 'payout', label: 'Payouts', color: 'gold' },
              ]}
              format={formatUsd}
              emptyText="No revenue streams in this read."
            />
            <Panel title="Donations and revenue" kicker="Test mode" action={<Badge tone={toneBadge(desk('billing').tone)}>{desk('billing').status}</Badge>}>
              <p className="text-sm leading-6 text-[var(--ink-soft)]">
                Donation policy is 90 to the family. Payouts stay blocked in this test. The full ledger, donations by day, and where
                donations started are on{' '}
                <Link href="/money" className="font-extrabold text-[var(--jade)] underline-offset-2 hover:underline">
                  Revenue
                </Link>
                .
              </p>
            </Panel>
          </div>
        </section>

        <section id="marketing" aria-labelledby="marketing-heading" className="scroll-mt-40">
          <SectionHeading id="marketing-heading" level={2} title="Marketing" hint="Behavior detail is on Trends" />
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <StatTile label="Tab opens · 24h" value={count(sessions24h)} missing={sessions24h == null} hint="Events, not distinct people" goodDirection="none" />
            <StatTile label="Feature taps · 24h" value={count(taps24h)} missing={taps24h == null} hint="Tap events, not people" goodDirection="none" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <HBarList
              title="Time on each tab"
              caption="Last 7 days · minutes, all people together"
              rows={reportsOk ? reports.tabs : null}
              format={formatMinutes}
              accent="jade"
              emptyText="No tab time in the last 7 days."
              source="get_admin_reports.tabs"
            />
            <Panel title="Who showed up" kicker="24 hours" action={<Badge tone={toneBadge(desk('marketing').tone)}>{desk('marketing').status}</Badge>}>
              <p className="text-sm leading-6 text-[var(--ink-soft)]">
                Tab opens and taps are events. The same person can open a tab many times. Daily people and returning people are not
                measured. Detail is on{' '}
                <Link href="/reports" className="font-extrabold text-[var(--jade)] underline-offset-2 hover:underline">
                  Trends
                </Link>{' '}
                and{' '}
                <Link href="/operations" className="font-extrabold text-[var(--jade)] underline-offset-2 hover:underline">
                  Health
                </Link>
                .
              </p>
            </Panel>
          </div>
        </section>

        <section id="support" aria-labelledby="support-heading" className="scroll-mt-40">
          <SectionHeading id="support-heading" level={2} title="Support" hint="Start with the red and gold lines" />
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <StatTile label="UI issues · 24h" value={count(issues24h)} missing={issues24h == null} hint="Control issues reported by the app" tone={warnIf(issues24h)} goodDirection="down" />
            <StatTile label="Open bug reports" value={count(openBugs)} missing={openBugs == null} hint="Feedback not shipped or declined" tone={warnIf(openBugs)} goodDirection="down" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <HBarList
              title="Issue types"
              caption="UI issues in the last 7 days, plus open bug reports"
              rows={reportsOk ? reports.issues : null}
              format={formatCount}
              accent="bad"
              emptyText="No issue types in this window."
              source="get_admin_reports.issues"
            />
            <Panel title="What needs a person" kicker="Assist" action={<Badge tone={toneBadge(desk('support').tone)}>{desk('support').status}</Badge>}>
              <p className="text-sm leading-6 text-[var(--ink-soft)]">
                A gold or red status is the queue. The clip and the reporter stay on Expo{' '}
                <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin</code> moderation.
              </p>
            </Panel>
          </div>
        </section>

        <section id="api" aria-labelledby="api-heading" className="scroll-mt-40">
          <SectionHeading id="api-heading" level={2} title="API" hint="Reads this portal uses" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Portal reads" kicker="Data" action={<Badge tone={toneBadge(desk('api').tone)}>{desk('api').status}</Badge>}>
              <ul className="space-y-2">
                {[
                  { name: 'get_admin_reports', configured: reports.configured, failed: Boolean(reports.error) },
                  { name: 'get_company_revenue_summary', configured: revenue.configured, failed: Boolean(revenue.error) },
                ].map((read) => (
                  <li key={read.name} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2">
                    <code className="text-sm font-bold break-all">{read.name}</code>
                    <Badge tone={read.failed ? 'danger' : read.configured ? 'ok' : 'neutral'}>{read.failed ? 'Failed' : read.configured ? 'Answered' : 'Not connected'}</Badge>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="App routes" kicker="Named, not called from here">
              <ul className="space-y-2">
                {APP_API_ROUTES.map((route) => (
                  <li key={route.path} className="rounded-xl border border-[var(--border)] px-3 py-2">
                    <code className="text-sm font-bold break-all">{route.path}</code>
                    <p className="text-xs text-[var(--text-muted)]">{route.note}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </section>

        <section id="it" aria-labelledby="it-heading" className="scroll-mt-40">
          <SectionHeading id="it-heading" level={2} title="IT" hint="Playback and connections, last 24 hours" />
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone={toneBadge(desk('it').tone)}>{desk('it').status}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Video stalls · 24h" value={count(stalls24h)} missing={stalls24h == null} hint="Playback stalls. Fewer is better." tone={warnIf(stalls24h)} goodDirection="down" />
            <StatTile label="Live reconnects · 24h" value={count(reconnects24h)} missing={reconnects24h == null} hint="Live connection dropped and came back" tone={warnIf(reconnects24h)} goodDirection="down" />
            <StatTile
              label="Telemetry events · 24h"
              value={events24h == null ? '—' : formatCompactCount(events24h)}
              missing={events24h == null}
              hint={events24h == null ? undefined : `${formatCount(events24h)} rows written by the app`}
              goodDirection="none"
            />
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
