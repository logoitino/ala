/**
 * Analytics workspace (`/analytics`, owned by ANALYST). A dashboard switcher (plain anchor links,
 * no client JS), a headline row with one KPI per dashboard, the "Week at a glance" heat strip,
 * the eight dashboards, and the measure catalog with each measure's key, source RPC, definition,
 * and current value. Read-only: one `get_admin_reports` read and one `get_company_revenue_summary`
 * read per request. Rates this portal cannot compute stay named and blank.
 */

import Link from 'next/link';

import { AnalyticsBoard, ReadAlert } from '@/components/AnalyticsBoard';
import { HeatStrip, StatTile } from '@/components/charts';
import { PortalShell, SectionHeading } from '@/components/PortalShell';
import { buildAnalytics, formatChartValue, GRAIN_LABEL, UNIT_LABEL } from '@/lib/analytics';
import { UNMEASURED } from '@/lib/dashboard';
import { fetchPortalReports, fetchPortalRevenue } from '@/lib/reports';

export const dynamic = 'force-dynamic';

const LINK =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-extrabold text-[var(--ink-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]';

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
        className="scroll-mt-4 mb-6 rounded-2xl border border-[var(--border)] bg-[var(--canvas)]/95 p-2 lg:sticky lg:top-0 lg:z-10 lg:backdrop-blur"
      >
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-5 lg:grid-cols-10">
          {boards.map((board) => (
            <li key={board.id}>
              <a href={`#${board.id}`} className={`${LINK} w-full`}>
                {board.title}
              </a>
            </li>
          ))}
          <li>
            <a href="#catalog" className={`${LINK} w-full`}>
              Catalog
            </a>
          </li>
          <li>
            <a href="#not-measured" className={`${LINK} w-full`}>
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
                <a href={`#${board.id}`} className="inline-flex min-h-6 items-center gap-1 self-start rounded-md px-1 text-xs font-extrabold tracking-wide text-[var(--jade)] uppercase hover:underline">
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
          <a href="#dashboards" className="text-xs font-extrabold text-[var(--jade)] hover:underline">
            All dashboards
          </a>
        </div>
        <p className="mb-3 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">
          {catalog.length.toLocaleString('en-US')} measures, {lists.length.toLocaleString('en-US')} daily series and rankings, across {boards.length}{' '}
          dashboards. Dollars are stored as cents. Minutes are a sum of tab time stored as milliseconds. A percent here is an
          average the report already computed, not a conversion rate. Counts are rows or events, not people.
        </p>

        <div role="region" aria-labelledby="measures-caption" tabIndex={0} className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[960px] text-sm">
            <caption id="measures-caption" className="px-3 py-3 text-left text-sm font-extrabold">
              Measures
            </caption>
            <thead className="border-y border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--ink-soft)]">
              <tr>
                <th scope="col" className={TH}>Measure</th>
                <th scope="col" className={TH}>Dashboard</th>
                <th scope="col" className={TH}>Window</th>
                <th scope="col" className={TH}>Unit</th>
                <th scope="col" className={TH}>Source RPC and key</th>
                <th scope="col" className={TH}>Definition</th>
                <th scope="col" className={`${TH} text-right`}>Current value</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((row) => (
                <tr key={row.key} className="border-b border-[var(--border)] last:border-b-0">
                  <th scope="row" className="px-3 py-2 text-left align-top font-bold text-[var(--ink)]">
                    {row.label}
                  </th>
                  <td className={TD}>
                    <a href={`#${row.boardId}`} className="font-bold text-[var(--jade)] hover:underline">
                      {row.board}
                    </a>
                  </td>
                  <td className={TD}>{GRAIN_LABEL[row.grain]}</td>
                  <td className={TD}>{UNIT_LABEL[row.unit]}</td>
                  <td className={`${TD} font-mono text-xs break-all`}>{row.source}</td>
                  <td className={`${TD} max-w-[22rem]`}>{row.note}</td>
                  <td className={`${TD} chart-tabular text-right font-extrabold whitespace-nowrap ${row.missing ? 'text-[var(--text-muted)]' : 'text-[var(--ink)]'}`}>
                    {row.value}
                    {row.missing ? <span className="sr-only"> (not in this read)</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div role="region" aria-labelledby="lists-caption" tabIndex={0} className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[860px] text-sm">
            <caption id="lists-caption" className="px-3 py-3 text-left text-sm font-extrabold">
              Daily series and rankings
            </caption>
            <thead className="border-y border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--ink-soft)]">
              <tr>
                <th scope="col" className={TH}>Name</th>
                <th scope="col" className={TH}>Dashboard</th>
                <th scope="col" className={TH}>Unit</th>
                <th scope="col" className={TH}>Source RPC and key</th>
                <th scope="col" className={TH}>Definition</th>
                <th scope="col" className={`${TH} text-right`}>In this read</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)] last:border-b-0">
                  <th scope="row" className="px-3 py-2 text-left align-top font-bold text-[var(--ink)]">
                    {row.title}
                  </th>
                  <td className={TD}>
                    <a href={`#${row.boardId}`} className="font-bold text-[var(--jade)] hover:underline">
                      {row.board}
                    </a>
                  </td>
                  <td className={TD}>{UNIT_LABEL[row.unit]}</td>
                  <td className={`${TD} font-mono text-xs break-all`}>{row.source}</td>
                  <td className={`${TD} max-w-[24rem]`}>{row.note}</td>
                  <td className={`${TD} chart-tabular text-right font-extrabold whitespace-nowrap ${row.missing ? 'text-[var(--text-muted)]' : 'text-[var(--ink)]'}`}>
                    {row.value}
                    {row.missing ? <span className="sr-only"> (not in this read)</span> : null}
                  </td>
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
        <div role="region" aria-labelledby="unmeasured-caption" tabIndex={0} className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
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
                    —<span className="sr-only"> not measured</span>
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
