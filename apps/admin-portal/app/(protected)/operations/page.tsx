/**
 * Operations desk. Four tabs break down where people are, which buttons they use, errors, and menus.
 * @sideEffects `get_admin_reports`, `get_company_revenue_summary`, and the published runtime flags.
 */
import Link from 'next/link';

import { OperationsBoard } from '@/components/OperationsBoard';
import { PortalShell } from '@/components/PortalShell';
import { managementAlerts } from '@/lib/departments';
import { buildOperations } from '@/lib/operations';
import { fetchPortalReports, fetchPortalRevenue } from '@/lib/reports';
import { fetchPortalRuntime } from '@/lib/softWall';

export const dynamic = 'force-dynamic';

export default async function OperationsPage() {
  const [reports, revenue, runtime] = await Promise.all([
    fetchPortalReports(),
    fetchPortalRevenue(),
    fetchPortalRuntime(),
  ]);
  const lenses = buildOperations({
    tabs: reports.tabs,
    buttons: reports.features,
    appErrors: reports.issues,
    portalErrors: managementAlerts({
      reportsError: reports.error,
      revenueError: revenue.error,
      donations7dCents: 0,
      sessions24h: 0,
      issues24h: 0,
      openBugs: 0,
      stalls24h: 0,
      reconnects24h: 0,
    }),
    usage: reports.usage,
    reliability: reports.reliability,
    published: runtime.published,
  });

  return (
    <PortalShell active="/operations">
      <p className="mb-6 text-sm leading-6 text-[var(--ink-soft)]">
        Start with the sentence on the open tab. The bars are the ranking. Every row under that is the smaller data.
        Department status stays on <Link href="/manage" className="font-extrabold text-[var(--jade)]">Departments</Link>.
        Menu switches are made in Expo <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin</code>.
      </p>
      {!runtime.configured ? (
        <p className="mb-4 rounded-xl border border-[var(--gold-soft)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold text-[var(--gold)]">
          Menu on and off needs the Supabase connection. The other tabs still show whatever the reports read returned.
        </p>
      ) : null}
      <OperationsBoard lenses={lenses} />
    </PortalShell>
  );
}
