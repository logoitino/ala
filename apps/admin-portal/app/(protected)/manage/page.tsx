/**
 * Management desk (`/manage`, shown as Departments). One page for Billing, Marketing, Support,
 * API, and IT. Reads the same reports and revenue the other desks already load. Nothing here
 * writes. Tab time is shown in minutes; a missing key shows "—"; a failed read is an alert, and a
 * failed reports read leaves desk counts null so a desk says "did not load", never "nothing happened".
 * Stream names come from `streamName` (lib/reports.ts) and colours from `lib/measureColors.ts`
 * (payee share jade, Tapua'i share gold, as on Revenue). Counts are full numbers, never "48.2K".
 * Panels sit under each desk's h2, so they are h3; prose cards keep their own height (`items-start`).
 * Support's queue is the open bug reports and UI issues it shows; reported clips stay in Expo /admin.
 * Issue types read as words via `issueLabel` (lib/eventLabels.ts), never "upload.retry · upload".
 * The payee share covers families, Vault athletes and booster operators (W3-PORTAL, 2026-10-12).
 * @sideEffects `get_admin_reports` and `get_company_revenue_summary`.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

import { HBarList, StackedBars, StatTile } from '@/components/charts';
import { Badge, Panel, PortalShell, SectionHeading } from '@/components/PortalShell';
import { formatCount, formatMinutes, readKey } from '@/lib/dashboard';
import { APP_API_ROUTES, deskLabel, managementAlerts, managementDeskStatus, type ManagementSnapshot } from '@/lib/departments';
import { issueLabel, labelRows } from '@/lib/eventLabels';
import { measureColor } from '@/lib/measureColors';
import { fetchPortalReports, fetchPortalRevenue, formatUsd, streamName } from '@/lib/reports';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Departments' };

function toneBadge(tone: 'ok' | 'warn' | 'danger') {
  if (tone === 'danger') return 'danger' as const;
  if (tone === 'warn') return 'warn' as const;
  return 'ok' as const;
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

  // Null stays null (QA #2): a failed reports read is "did not load", not an empty window.
  const snapshot: ManagementSnapshot = {
    reportsError: reports.error,
    revenueError: revenue.error,
    donations7dCents: donations7d,
    sessions24h,
    issues24h,
    openBugs,
    stalls24h,
    reconnects24h,
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
              <StatTile label={item.title} value={deskLabel(item.tone)} hint={item.status} tone={item.tone === 'ok' ? 'ok' : item.tone === 'warn' ? 'warn' : 'danger'} />
            </a>
          ))}
        </nav>
      </section>

      <div className="space-y-12">
        <section id="billing" aria-labelledby="billing-heading" className="scroll-mt-40">
          <SectionHeading id="billing-heading" level={2} title="Billing" hint="Ledger detail is on Revenue" />
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <StatTile label="Gifts · 7d" value={usd(donations7d)} missing={donations7d == null} hint="Recorded gifts, last 7 days" goodDirection="none" />
            <StatTile label="Gross, all streams" value={usd(gross)} missing={gross == null} hint="Recorded gross in the ledger" goodDirection="none" />
            <StatTile label="Tapua'i share, all streams" value={usd(net)} missing={net == null} hint="Recorded for Tapua'i in the ledger" goodDirection="none" />
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <StackedBars
              title="Streams: payee share and Tapua'i share"
              caption="Each stream's recorded gross, split into the payee share (families, athletes, operators) and Tapua'i share"
              source="get_company_revenue_summary.streams"
              rows={
                revenueOk
                  ? revenue.streams.map((row) => ({
                      label: streamName(row.source, row.label),
                      segments: { payout: row.payout_cents, platform: row.platform_cents },
                      total: row.gross_cents,
                    }))
                  : null
              }
              series={[
                { key: 'payout', label: 'Payee share', color: measureColor('payeeShare') },
                { key: 'platform', label: "Tapua'i share", color: measureColor('tapuaiShare') },
              ]}
              format={formatUsd}
              emptyText="No revenue streams in this read."
            />
            <Panel level={3} title="Gifts and revenue" kicker="Test mode" action={<Badge tone={toneBadge(desk('billing').tone)}>{desk('billing').status}</Badge>}>
              <p className="text-sm leading-6 text-[var(--ink-soft)]">
                New gift model: the full gift is allocated to the family account, with no Tapua&apos;i gift cut. Historical allocations are retained. Payouts stay blocked in this test. The full ledger,
                gifts by day, and where gifts started are on{' '}
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
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <HBarList
              title="Time on each tab"
              caption="Last 7 days · minutes, all people together"
              rows={reportsOk ? reports.tabs : null}
              format={formatMinutes}
              accent={measureColor('timeOnTabs')}
              emptyText="No tab time in the last 7 days."
              source="get_admin_reports.tabs"
            />
            <Panel level={3} title="Tab activity" kicker="24 hours" action={<Badge tone={toneBadge(desk('marketing').tone)}>{desk('marketing').status}</Badge>}>
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
          <SectionHeading id="support-heading" level={2} title="Support" hint="Start with any desk marked Check or Failed under Right now" />
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <StatTile label="UI issues · 24h" value={count(issues24h)} missing={issues24h == null} hint="Problems the app logged on a button or screen" tone={warnIf(issues24h)} goodDirection="down" />
            <StatTile label="Open bug reports" value={count(openBugs)} missing={openBugs == null} hint="Feedback not shipped or declined" tone={warnIf(openBugs)} goodDirection="down" />
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <HBarList
              title="Issue types"
              caption="UI issues in the last 7 days, plus open bug reports"
              rows={reportsOk && reports.issues ? labelRows(reports.issues, issueLabel) : null}
              format={formatCount}
              accent={measureColor('issues')}
              emptyText="No issue types in this window."
              source="get_admin_reports.issues"
            />
            <Panel level={3} title="What needs a person" kicker="Assist" action={<Badge tone={toneBadge(desk('support').tone)}>{desk('support').status}</Badge>}>
              <p className="text-sm leading-6 text-[var(--ink-soft)]">
                The queue is the open bug reports and UI issues above. Reported clips and who reported them stay in Expo{' '}
                <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin</code> moderation.
              </p>
            </Panel>
          </div>
        </section>

        <section id="api" aria-labelledby="api-heading" className="scroll-mt-40">
          <SectionHeading id="api-heading" level={2} title="API" hint="Reads this portal uses" />
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Panel level={3} title="Portal reads" kicker="Data" action={<Badge tone={toneBadge(desk('api').tone)}>{desk('api').status}</Badge>}>
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
            <Panel level={3} title="App routes" kicker="Named, not called from here">
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
              value={count(events24h)}
              missing={events24h == null}
              hint={events24h == null ? undefined : 'Rows written by the app'}
              goodDirection="none"
            />
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
