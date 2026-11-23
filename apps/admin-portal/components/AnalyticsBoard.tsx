/** UX-15 card/type/44px anchor normalization preserves all measure/source/error alternatives and exact dashboard destinations. */
/**
 * Daylight report cards carry the current portal format into each dashboard without changing
 * its measures, source disclosures or navigation.
 * @purpose One analytics dashboard on `/analytics` (owned by ANALYST): the question, a KPI row
 *   of `StatTile`s (and `Meter`s), the charts `lib/analytics.ts` picked for that board, and the
 *   slice of the measure catalog it reads. Also exports `ChartView`, which maps a chart spec to
 *   the inline chart kit in `components/charts`, `ReadAlert`, the failed-read notice that
 *   StatTile and Meter cannot show themselves, and `SourcePath`, which lets an RPC key wrap only
 *   at a dot. Grids stay even: an odd last chart or a meter after a full tile row spans the row,
 *   so the single Live games split fills its row. The "Every measure" list is a `dl` whose `div`
 *   groups hold `dt`/`dd` directly (no nested wrapper), laid out as a two-column grid.
 *   Colours arrive in the specs from `lib/measureColors.ts`. A bars spec may carry its own summary
 *   sentence (the donation bands and their missing note), passed through to `HBarList`.
 *   Server Component: no hooks, no client JS.
 */

import { Fragment } from 'react';

import {
  CompareBars,
  HBarList,
  Meter,
  SplitBar,
  SplitRing,
  StackedBars,
  StatTile,
  TrendChart,
} from '@/components/charts';
import {
  formatChartValue,
  formatTick,
  tickUnitFor,
  type AnalyticsBoard as Board,
  type AnalyticsChart,
  type ReadState,
} from '@/lib/analytics';

/**
 * @purpose Show an RPC path such as `get_admin_reports.usage.dwell_ms_7d` so it wraps only after a
 *   dot (a `<wbr>` there), never in the middle of a key.
 * @param path The source path from the catalog.
 * @returns Inline text with break points.
 */
export function SourcePath({ path }: { path: string }) {
  return (
    <span>
      {path.split('.').map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? '.' : null}
          {index > 0 ? <wbr /> : null}
          <span className="whitespace-nowrap">{part}</span>
        </Fragment>
      ))}
    </span>
  );
}

/**
 * @purpose Render one chart spec with the matching chart kit component.
 * @param chart A spec from `buildAnalytics`.
 * @returns A chart figure.
 */
export function ChartView({ chart }: { chart: AnalyticsChart }) {
  const format = (value: number) => formatChartValue(chart.format, value);
  switch (chart.kind) {
    case 'columns':
    case 'line':
    case 'area':
      return (
        <TrendChart
          title={chart.title}
          windowLabel={chart.windowLabel}
          points={chart.points}
          format={format}
          variant={chart.kind}
          accent={chart.accent}
          source={chart.source}
          error={chart.error}
          tickUnit={tickUnitFor(chart.format)}
          tickFormat={(value) => formatTick(chart.format, value)}
        />
      );
    case 'bars':
      return (
        <HBarList
          title={chart.title}
          caption={chart.caption}
          rows={chart.points}
          format={format}
          accent={chart.accent}
          emptyText={chart.emptyText}
          source={chart.source}
          error={chart.error}
          keepOrder={chart.keepOrder}
          summary={chart.summary}
        />
      );
    case 'split':
      return (
        <SplitBar
          title={chart.title}
          caption={chart.caption}
          parts={chart.parts}
          format={format}
          totalLabel={chart.totalLabel}
          source={chart.source}
          error={chart.error}
        />
      );
    case 'ring':
      return (
        <SplitRing
          title={chart.title}
          caption={chart.caption}
          parts={chart.parts}
          format={format}
          totalLabel={chart.totalLabel}
          centerLabel={chart.centerLabel}
          centerValue={chart.centerValue}
          source={chart.source}
          error={chart.error}
        />
      );
    case 'compare':
      return (
        <CompareBars
          title={chart.title}
          caption={chart.caption}
          current={chart.current}
          previous={chart.previous}
          format={format}
          accent={chart.accent}
          subject={chart.subject}
          sentence={chart.sentence}
          source={chart.source}
          error={chart.error}
        />
      );
    case 'stack':
      return (
        <StackedBars
          title={chart.title}
          caption={chart.caption}
          series={chart.series}
          rows={chart.rows}
          format={format}
          emptyText={chart.emptyText}
          source={chart.source}
          error={chart.error}
        />
      );
  }
}

/**
 * @purpose The read-state notice above a KPI row. StatTile and Meter have no error prop, so a
 *   failed read is said here, once, in words; the tiles then show "—" and "Not in this read".
 * @param state The read state of the RPC behind these numbers.
 * @param error The error text from that read.
 * @param rpc The RPC name, so the reader knows which read failed.
 * @param live True only for the page-top copy, which is announced as an alert.
 * @returns An alert, a setup note, or nothing when the read worked.
 */
export function ReadAlert({ state, error, rpc, live = false }: { state: ReadState; error: string | null; rpc: string; live?: boolean }) {
  if (state === 'error') {
    return (
      // Only the page-top copy is live, so a screen reader hears one alert per failed read, not eight.
      <div role={live ? 'alert' : undefined} className="flex items-start gap-2 rounded-xl border border-[var(--ember)]/30 bg-[var(--ember-soft)] px-3 py-3 text-sm text-[var(--ember)]">
        <span aria-hidden="true" className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-[var(--ember)] text-[11px] font-black text-white">
          !
        </span>
        <span>
          <span className="font-extrabold">Could not read {rpc}. </span>
          {error ?? 'No reason was returned.'} No number below is a zero. Each blank means the read failed.
        </span>
      </div>
    );
  }
  if (state === 'unconfigured') {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] px-3 py-3 text-sm text-[var(--text-muted)]">
        No database is set for this portal, so {rpc} was not read. Every number below stays blank.
      </div>
    );
  }
  return null;
}

/**
 * @purpose Render one of the eight analytics dashboards.
 * @param board A board from `buildAnalytics`.
 * @returns The dashboard section, anchored by its id for the dashboard switcher.
 */
export function AnalyticsBoard({ board }: { board: Board }) {
  const headingId = `${board.id}-heading`;
  return (
    <section id={board.id} aria-labelledby={headingId} className="portal-panel scroll-mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="text-xs leading-4 font-bold tracking-wide text-[var(--ink-soft)]">Dashboard</p>
          <h2 id={headingId} className="mt-1 text-xl font-extrabold tracking-tight">
            {board.title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">{board.question}</p>
        </div>
        <a href="#dashboards" className="inline-flex min-h-11 min-w-11 items-center rounded-md px-3 py-2 text-xs font-extrabold text-[var(--jade)] hover:bg-[var(--surface-muted)]">
          All dashboards<span className="sr-only">, back to the switcher</span>
        </a>
      </div>

      {board.state !== 'ok' ? (
        <div className="mt-4">
          <ReadAlert state={board.state} error={board.error} rpc={board.rpc} />
        </div>
      ) : null}

      <h3 className="sr-only">Headline numbers</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {board.tiles.map((tile) => (
          <StatTile
            key={tile.key}
            label={tile.label}
            value={tile.value}
            missing={tile.missing}
            hint={tile.hint}
            tone={tile.tone}
            delta={tile.delta}
            goodDirection={tile.goodDirection}
            spark={
              tile.spark
                ? {
                    points: tile.spark.points,
                    format: (value: number) => formatChartValue(tile.spark!.format, value),
                    accent: tile.spark.accent,
                  }
                : undefined
            }
          />
        ))}
        {board.meters.map((meter) => (
          // A meter after a full row of tiles takes the whole next row, so no row is left half empty.
          <div key={meter.label} className={board.tiles.length % 4 === 0 ? 'min-w-0 sm:col-span-2 xl:col-span-4' : 'min-w-0'}>
            <Meter
              label={meter.label}
              part={meter.part}
              whole={meter.whole}
              format={(value) => formatChartValue('count', value)}
              hint={meter.hint}
              source={meter.source}
            />
          </div>
        ))}
      </div>

      <h3 className="sr-only">Charts</h3>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {board.charts.map((chart, index) => (
          // An odd last chart spans both columns so no card sits alone at half width.
          <div key={chart.id} className={board.charts.length % 2 === 1 && index === board.charts.length - 1 ? 'min-w-0 lg:col-span-2' : 'min-w-0'}>
            <ChartView chart={chart} />
          </div>
        ))}
      </div>

      <details className="chart-disclosure mt-5 border-t border-[var(--border)]">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm font-extrabold text-[var(--ink)] select-none hover:bg-[var(--surface-muted)]">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12" className="chart-disclosure-icon size-3">
            <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Every measure on {board.title} ({board.measures.length})
        </summary>
        <dl className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
          {board.measures.map((measure) => (
            // dt and every dd are direct children of this group div, the only wrapper HTML allows
            // inside a dl. A two-column grid keeps the label and value on one line without a
            // nested div; the note and source span both columns below them.
            <div key={measure.key} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-[var(--border)] py-3">
              <dt className="min-w-0 text-sm text-[var(--ink-soft)]">{measure.label}</dt>
              <dd className={`chart-tabular text-sm font-extrabold ${measure.missing ? 'text-[var(--text-muted)]' : 'text-[var(--ink)]'}`}>
                {measure.missing ? (
                  <>
                    <span aria-hidden="true">{measure.display}</span>
                    <span className="sr-only">Not in this read</span>
                  </>
                ) : (
                  measure.display
                )}
              </dd>
              <dd className="col-span-2 mt-1 text-xs leading-4 text-[var(--text-muted)]">{measure.note}</dd>
              <dd className="col-span-2 mt-1 font-mono text-xs leading-4 text-[var(--text-muted)]">
                <span className="sr-only">Source: </span>
                <SourcePath path={measure.source} />
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
