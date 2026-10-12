import Link from 'next/link';

import { AnalyticsBoard } from '@/components/AnalyticsBoard';
import { Panel, PortalShell, SectionHeading } from '@/components/PortalShell';
import { buildAnalytics } from '@/lib/analytics';
import { UNMEASURED } from '@/lib/dashboard';
import { fetchPortalReports, fetchPortalRevenue } from '@/lib/reports';

export const dynamic = 'force-dynamic';

/**
 * @purpose Analytics home. Eight dashboards built from the measure catalog, each one a read of
 *   the app. Missing keys stay blank. Rates this portal cannot compute stay named and empty.
 * @sideEffects `get_admin_reports` and `get_company_revenue_summary`.
 */
export default async function AnalyticsPage() {
  const [reports, revenue] = await Promise.all([fetchPortalReports(), fetchPortalRevenue()]);
  const { boards, catalog } = buildAnalytics(reports, revenue);

  return (
    <PortalShell active="/analytics">
      <SectionHeading
        title="Dashboards"
        hint={reports.generatedAt ? new Date(reports.generatedAt).toLocaleString() : 'Waiting on a read'}
      />
      <p className="mb-6 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">
        Eight dashboards. Every number is a named measure from the app. A blank means that measure was not in this read.
        Home, Trends, Audience, and Revenue still show their own slices.{' '}
        <Link href="/" className="font-extrabold text-[var(--jade)]">Back to Home</Link>
      </p>

      {reports.error ? (
        <p className="mb-4 rounded-xl border border-[var(--ember-soft)] bg-[var(--ember-soft)] px-4 py-3 text-sm font-semibold text-[var(--ember)]">
          Reports did not load. {reports.error}
        </p>
      ) : null}
      {revenue.error ? (
        <p className="mb-4 rounded-xl border border-[var(--ember-soft)] bg-[var(--ember-soft)] px-4 py-3 text-sm font-semibold text-[var(--ember)]">
          The ledger did not load. {revenue.error}
        </p>
      ) : null}

      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {boards.map((board) => (
          <a key={board.id} href={`#${board.id}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[11px] font-extrabold tracking-wide text-[var(--text-muted)] uppercase">{board.title}</p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight">{board.headline}</p>
            <p className="mt-1 text-sm leading-5 text-[var(--ink-soft)]">{board.headlineLabel}</p>
          </a>
        ))}
      </div>

      <div className="space-y-6">
        {boards.map((board) => (
          <AnalyticsBoard key={board.id} board={board} />
        ))}
      </div>

      <div className="mt-8 grid gap-3 lg:grid-cols-2">
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
        <Panel title="How to read a measure" kicker="Catalog">
          <p className="text-sm leading-6 text-[var(--ink-soft)]">
            {catalog.length.toLocaleString()} measures across {boards.length} dashboards. Grain is now, 24 hours, 7 days, the week before, or all time.
            Cents are dollars. Minutes are a sum of tab time. A percent here is an average the report already computed, not a conversion rate.
          </p>
        </Panel>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="px-4 py-3 text-left text-sm font-extrabold">Measure catalog</caption>
          <thead className="border-y border-[var(--border)] text-[11px] tracking-wide text-[var(--text-muted)] uppercase">
            <tr>
              <th className="px-4 py-2 font-extrabold">Measure</th>
              <th className="px-4 py-2 font-extrabold">Dashboard</th>
              <th className="px-4 py-2 font-extrabold">Grain</th>
              <th className="px-4 py-2 font-extrabold">Source</th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((row) => (
              <tr key={row.key} className="border-b border-[var(--border)]">
                <th className="px-4 py-2 text-left font-bold" scope="row">{row.label}</th>
                <td className="px-4 py-2 text-[var(--ink-soft)]">{row.board}</td>
                <td className="px-4 py-2 text-[var(--ink-soft)]">{row.grain}</td>
                <td className="px-4 py-2 font-mono text-xs text-[var(--ink-soft)]">{row.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
