/** UX-15 enlarges existing dashboard jump targets without changing request reads, measure catalogs, labels or anchor destinations. */
/**
 * Dashboard jump links follow Home's underline navigation and open report spacing.
 * Analytics workspace (`/analytics`, owned by ANALYST). A dashboard switcher (plain anchor links,
 * no client JS, not sticky so it never covers a focused element), a headline row with one KPI per
 * dashboard, the "Week at a glance" heat strip, the eight dashboards, and the measure catalog with
 * each measure's current value (second column, so it shows on phones), key, source RPC, and
 * definition. Scroll regions are `relative` so screen-reader-only text cannot widen the page.
 * Read-only: one `get_admin_reports` read and one `get_company_revenue_summary` read per request.
 * Rates this portal cannot compute stay named and blank.
 */

import type { Metadata } from 'next';
import Link from 'next/link';

import { AnalyticsBoard, ReadAlert, SourcePath } from '@/components/AnalyticsBoard';
import { HeatStrip, StatTile } from '@/components/charts';
import { PortalShell, SectionHeading } from '@/components/PortalShell';
import { buildAnalytics, formatChartValue, GRAIN_LABEL, UNIT_LABEL } from '@/lib/analytics';
import { UNMEASURED } from '@/lib/dashboard';
import { fetchPortalReports, fetchPortalRevenue } from '@/lib/reports';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Analytics' };

const LINK =
  'inline-flex min-h-11 items-center justify-center border-b-2 border-transparent px-3 text-sm font-extrabold text-[var(--ink-soft)] hover:border-[var(--jade)] hover:text-[var(--jade)]';

const TH = 'px-3 py-2 text-left align-bottom font-extrabold';
const TD = 'px-3 py-2 align-top text-[var(--ink-soft)]';

/**
 * @purpose Analytics home. Eight dashboards built from the measure catalog, each one a read of
 *   the app. Missing keys stay blank. Rates this portal cannot compute stay named and empty.
 * @sideEffects `get_admin_reports` and `get_company_revenue_summary` (read-only RPCs).
 */
export default async function AnalyticsPage() {
  const [reports, revenue] = await Promise.all([fetchPortalReports(), fetchPortalRevenue()]);
  const { boards, catalog, lists, week, reportsState, revenueState } = buildAnalytics(reports, revenue);

  return (
    <PortalShell active="/analytics">
      <SectionHeading
        title="Dashboards"
        level={2}
        hint={reports.generatedAt ? `Read ${new Date(reports.generatedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC` : 'Waiting on a read'}
      />
      <p className="mb-4 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">
        Eight dashboards. Every number is a named measure from the app, listed with its key and source in the{' '}
        <a href="#catalog" className="font-extrabold text-[var(--jade)] underline-offset-2 hover:underline">
          measure catalog
        </a>
        . A blank (—) means that measure was not in this read. It is never a zero. Days are UTC.{' '}
        <Link href="/" className="font-extrabold text-[var(--jade)] underline-offset-2 hover:underline">
          Back to Home
        </Link>
      </p>

      <div className="mb-4 flex flex-col gap-2">
        <ReadAlert state={reportsState === 'error' ? 'error' : 'ok'} error={reports.error} rpc="get_admin_reports" live />
        <ReadAlert state={revenueState === 'error' ? 'error' : 'ok'} error={revenue.error} rpc="get_company_revenue_summary" live />
        {reportsState === 'unconfigured' && revenueState === 'unconfigured' ? (
          <ReadAlert state="unconfigured" error={null} rpc="get_admin_reports or get_company_revenue_summary" />
        ) : null}
      </div>

      <nav
        id="dashboards"
        aria-label="Dashboards"
        className="mb-8 scroll-mt-4 border-y border-[var(--border)] py-2"
      >
        {/* Ten links: 2 rows of 5 from sm up, 5 rows of 2 on phones. Not sticky (A11Y: a sticky bar hid focused content). */}
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-5">
          {boards.map((board) => (
            <li key={board.id}>
              <a href={`#${board.id}`} className={`${LINK} w-full text-center`}>
                {board.title}
              </a>
            </li>
          ))}
          <li>
            <a href="#catalog" className={`${LINK} w-full text-center`}>
              Catalog
            </a>
          </li>
          <li>
            <a href="#not-measured" className={`${LINK} w-full text-center`}>
              Not measured
            </a>
          </li>
        </ul>
      </nav>

      <section aria-labelledby="glance-heading" className="mb-8">
        <h2 id="glance-heading" className="mb-3 text-lg font-extrabold tracking-tight">
          At a glance
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {boards.map((board) => {
            const tile = board.tiles[0];
            return (
              <li key={board.id} className="flex min-w-0 flex-col gap-1.5">
                <a href={`#${board.id}`} className="inline-flex min-h-11 min-w-11 items-center gap-1 self-start rounded-md px-1 text-xs font-extrabold tracking-wide text-[var(--jade)] uppercase hover:underline">
                  {board.title}
                  <span aria-hidden="true">→</span>
                  <span className="sr-only"> dashboard</span>
                </a>
                <StatTile
                  label={tile.label}
                  value={tile.value}
                  missing={tile.missing}
                  hint={tile.hint}
                  tone={tile.tone}
                  delta={tile.delta}
                  goodDirection={tile.goodDirection}
                  spark={
                    tile.spark
                      ? { points: tile.spark.points, format: (value: number) => formatChartValue(tile.spark!.format, value), accent: tile.spark.accent }
                      : undefined
                  }
                />
              </li>
            );
          })}
        </ul>
        <div className="mt-3">
          <HeatStrip
            title="Week at a glance"
            caption="Last 7 days, UTC. Each row is shaded against its own peak, so compare days within a row, not across rows."
            source="get_admin_reports.series.clips · .malo · .dwell · .stalls"
            error={reportsState === 'error' ? reports.error : null}
            rows={week.map((series) => ({
              label: series.title,
              points: series.points ?? [],
              format: (value: number) => formatChartValue(series.format, value),
              accent: series.accent,
            }))}
          />
        </div>
      </section>

      <div className="space-y-6">
        {boards.map((board) => (
          <AnalyticsBoard key={board.id} board={board} />
        ))}
      </div>

      <section id="catalog" aria-labelledby="catalog-heading" className="mt-10 scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="catalog-heading" className="text-lg font-extrabold tracking-tight">
            Measure catalog
          </h2>
          <a href="#dashboards" className="inline-flex min-h-11 min-w-11 items-center rounded-md px-1 text-xs font-extrabold text-[var(--jade)] hover:underline">
            All dashboards<span className="sr-only">, back to the switcher</span>
          </a>
        </div>
        <p className="mb-3 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">
          {catalog.length.toLocaleString('en-US')} measures, {lists.length.toLocaleString('en-US')} daily series and rankings, across {boards.length}{' '}
          dashboards. Dollars are stored as cents. Minutes are a sum of tab time stored as milliseconds. A percent here is an
          average the report already computed, not a conversion rate. Counts are rows or events, not people.
        </p>

        <div role="region" aria-labelledby="measures-caption" tabIndex={0} className="relative max-w-full overflow-x-auto border-y border-[var(--border)]">
          <table className="w-full min-w-[960px] text-sm">
            <caption id="measures-caption" className="px-3 py-3 text-left text-sm font-extrabold">
              Measures
            </caption>
            <thead className="border-y border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--ink-soft)]">
              <tr>
                <th scope="col" className={TH}>Measure</th>
                <th scope="col" className={`${TH} text-right`}>Current value</th>
                <th scope="col" className={TH}>Dashboard</th>
                <th scope="col" className={TH}>Window</th>
                <th scope="col" className={TH}>Unit</th>
                <th scope="col" className={TH}>Source RPC and key</th>
                <th scope="col" className={TH}>Definition</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((row) => (
                <tr key={row.key} className="border-b border-[var(--border)] last:border-b-0">
                  <th scope="row" className="min-w-36 px-3 py-2 text-left align-top font-bold text-[var(--ink)]">
                    {row.label}
                  </th>
                  <td className={`${TD} chart-tabular text-right font-extrabold whitespace-nowrap ${row.missing ? 'text-[var(--text-muted)]' : 'text-[var(--ink)]'}`}>
                    {row.missing ? (
                      <>
                        <span aria-hidden="true">{row.value}</span>
                        <span className="sr-only">Not in this read</span>
                      </>
                    ) : (
                      row.value
                    )}
                  </td>
                  <td className={TD}>
                    <a href={`#${row.boardId}`} className="font-bold text-[var(--jade)] hover:underline">
                      {row.board}
                    </a>
                  </td>
                  <td className={TD}>{GRAIN_LABEL[row.grain]}</td>
                  <td className={TD}>{UNIT_LABEL[row.unit]}</td>
                  <td className={`${TD} font-mono text-xs`}>
                    <SourcePath path={row.source} />
                  </td>
                  <td className={`${TD} max-w-[22rem]`}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div role="region" aria-labelledby="lists-caption" tabIndex={0} className="relative mt-4 max-w-full overflow-x-auto border-y border-[var(--border)]">
          <table className="w-full min-w-[860px] text-sm">
            <caption id="lists-caption" className="px-3 py-3 text-left text-sm font-extrabold">
              Daily series and rankings
            </caption>
            <thead className="border-y border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--ink-soft)]">
              <tr>
                <th scope="col" className={TH}>Name</th>
                <th scope="col" className={`${TH} text-right`}>In this read</th>
                <th scope="col" className={TH}>Dashboard</th>
                <th scope="col" className={TH}>Unit</th>
                <th scope="col" className={TH}>Source RPC and key</th>
                <th scope="col" className={TH}>Definition</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)] last:border-b-0">
                  <th scope="row" className="min-w-36 px-3 py-2 text-left align-top font-bold text-[var(--ink)]">
                    {row.title}
                  </th>
                  <td className={`${TD} chart-tabular text-right font-extrabold whitespace-nowrap ${row.missing ? 'text-[var(--text-muted)]' : 'text-[var(--ink)]'}`}>
                    {row.missing ? (
                      <>
                        <span aria-hidden="true">{row.value}</span>
                        <span className="sr-only">Not in this read</span>
                      </>
                    ) : (
                      row.value
                    )}
                  </td>
                  <td className={TD}>
                    <a href={`#${row.boardId}`} className="font-bold text-[var(--jade)] hover:underline">
                      {row.board}
                    </a>
                  </td>
                  <td className={TD}>{UNIT_LABEL[row.unit]}</td>
                  <td className={`${TD} font-mono text-xs`}>
                    <SourcePath path={row.source} />
                  </td>
                  <td className={`${TD} max-w-[24rem]`}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="not-measured" aria-labelledby="not-measured-heading" className="mt-10 scroll-mt-24">
        <h2 id="not-measured-heading" className="mb-1 text-lg font-extrabold tracking-tight">
          Not measured
        </h2>
        <p className="mb-3 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">
          These rates are named so nobody fills the gap with a guess. No report returns them, so they stay blank. Do not treat a blank as a result.
        </p>
        <div role="region" aria-labelledby="unmeasured-caption" tabIndex={0} className="relative max-w-full overflow-x-auto border-y border-[var(--border)]">
          <table className="w-full min-w-[560px] text-sm">
            <caption id="unmeasured-caption" className="sr-only">
              Rates that are not measured
            </caption>
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--ink-soft)]">
              <tr>
                <th scope="col" className={TH}>Rate</th>
                <th scope="col" className={TH}>Why it is blank</th>
                <th scope="col" className={`${TH} text-right`}>Value</th>
              </tr>
            </thead>
            <tbody>
              {UNMEASURED.map((gap) => (
                <tr key={gap.name} className="border-b border-[var(--border)] last:border-b-0">
                  <th scope="row" className="px-3 py-2 text-left align-top font-bold text-[var(--ink)]">
                    {gap.name}
                  </th>
                  <td className={TD}>{gap.why}</td>
                  <td className={`${TD} text-right font-extrabold text-[var(--text-muted)]`}>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">Not measured</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PortalShell>
  );
}
