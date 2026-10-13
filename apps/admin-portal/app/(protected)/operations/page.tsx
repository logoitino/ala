/**
 * Health desk (`/operations`). Four tabs break down where people spend time, which buttons
 * they use, errors and playback, and which menus are on. Read only. A failed read is one alert
 * above the tabs (OperationsBoard), not one per tab.
 * @sideEffects `get_admin_reports`, `get_company_revenue_summary`, and the published runtime flags.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

import { OperationsBoard } from '@/components/OperationsBoard';
import { PortalShell } from '@/components/PortalShell';
import { managementAlerts } from '@/lib/departments';
import { buildOperations } from '@/lib/operations';
import { fetchPortalReports, fetchPortalRevenue } from '@/lib/reports';
import { fetchPortalRuntime } from '@/lib/softWall';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Health' };

export default async function OperationsPage() {
  const [reports, revenue, runtime] = await Promise.all([
    fetchPortalReports(),
    fetchPortalRevenue(),
    fetchPortalRuntime(),
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
      {!runtime.configured ? (
        <p className="mb-4 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold text-[var(--gold)]">
          Menu on and off needs the Supabase connection. The other tabs still show whatever the reports read returned.
        </p>
      ) : null}
      <OperationsBoard lenses={lenses} />
    </PortalShell>
  );
}
