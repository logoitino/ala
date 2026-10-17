/**
 * Health desk (`/operations`). Four tabs break down where people spend time, which buttons
 * they use, errors and playback, and which menus are on. Read only. A failed read is one alert
 * above the tabs (OperationsBoard), not one per tab.
 * @sideEffects `get_admin_reports`, `get_company_revenue_summary`, the published runtime flags, a read-only probe of controls whose database update is still waiting, and `get_engineering_support_snapshot` for open failures.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

import { OperationsBoard } from '@/components/OperationsBoard';
import { PortalShell } from '@/components/PortalShell';
import { managementAlerts } from '@/lib/departments';
import { buildOperations } from '@/lib/operations';
import { fetchPortalReports, fetchPortalRevenue } from '@/lib/reports';
import { fetchPortalRuntime } from '@/lib/softWall';
import { fetchFailurePoints } from '@/lib/supportFailures';
import { fetchUnappliedControls } from '@/lib/unappliedControls';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Health' };

export default async function OperationsPage() {
  const [reports, revenue, runtime, unapplied, failures] = await Promise.all([
    fetchPortalReports(),
    fetchPortalRevenue(),
    fetchPortalRuntime(),
    fetchUnappliedControls(),
    fetchFailurePoints(),
  ]);
  const reportsOk = reports.configured && !reports.error;
  const lenses = buildOperations({
    tabs: reports.tabs,
    buttons: reports.features,
    appErrors: reports.issues,
    scroll: reports.scroll,
    dwellSeries: reports.series.dwell,
    stallSeries: reports.series.stalls,
    portalErrors: managementAlerts({
      reportsError: reports.error,
      revenueError: revenue.error,
      // Only the two read errors matter for alerts; counts are not read here, so they stay null.
      donations7dCents: null,
      sessions24h: null,
      issues24h: null,
      openBugs: null,
      stalls24h: null,
      reconnects24h: null,
    }),
    usage: reports.usage,
    reliability: reports.reliability,
    published: runtime.published,
    reportsOk,
    runtimeOk: runtime.configured,
  });

  return (
    <PortalShell active="/operations">
      <p className="mb-6 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">
        Each tab starts with one sentence, then the tiles, the charts, and every smaller row. Use the arrow keys to move
        between tabs. Department status stays on{' '}
        <Link href="/manage" className="font-extrabold text-[var(--jade)] underline-offset-2 hover:underline">
          Departments
        </Link>
        . Menu switches are made in Expo <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin</code>.
      </p>
      {unapplied.configured && unapplied.waiting.length > 0 ? (
        <section className="mb-6 max-w-3xl rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-soft)] px-4 py-3">
          <h2 className="text-base font-extrabold text-[var(--ink)]">Database updates still waiting</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
            Fans do not see these. Open the matching desk in Expo /admin. This page does not change the database.
          </p>
          <ul className="mt-3 space-y-2">
            {unapplied.waiting.map((control) => (
              <li key={control.id} className="text-sm leading-6 text-[var(--ink)]">
                <span className="font-extrabold">{control.label}</span>
                {' · '}
                <code className="rounded bg-white/70 px-1.5">{control.migration}</code>
                {' · Expo '}
                <code className="rounded bg-white/70 px-1.5">{control.adminPath}</code>
                {control.note ? <span className="mt-1 block text-[var(--ink-soft)]">{control.note}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {failures.configured ? (
        <section className="mb-6 max-w-3xl rounded-xl border border-[var(--border)] px-4 py-3">
          <h2 className="text-base font-extrabold text-[var(--ink)]">Points of failure</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
            Open rows from Engineering Support. Review stays in Expo <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin/support</code>. This page does not change them.
          </p>
          {failures.missing ? (
            <p className="mt-3 text-sm leading-6 text-[var(--ink)]">Engineering Support is not on this database yet. It is listed with the waiting updates above.</p>
          ) : failures.unread ? (
            <p className="mt-3 text-sm leading-6 text-[var(--ink)]">Failure counts could not be read. Expo /admin/support is the full desk.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {failures.points.map((point) => (
                <li key={point.id} className="text-sm leading-6 text-[var(--ink)]">
                  <span className="font-extrabold">{point.label}</span>
                  {' · '}
                  {point.count}
                  <span className="mt-0.5 block text-[var(--ink-soft)]">{point.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {!runtime.configured ? (
        <p className="mb-4 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold text-[var(--gold)]">
          Menu on and off needs the Supabase connection. The other tabs still show whatever the reports read returned.
        </p>
      ) : null}
      <OperationsBoard lenses={lenses} />
    </PortalShell>
  );
}
