/**
 * @purpose One analytics dashboard: the question, the headline measure, every measure on that
 *   board, and the charts the report already returns. Inline columns and bars, no chart library.
 */

import { ColumnChart } from '@/components/ColumnChart';
import { BarRow } from '@/components/PortalShell';
import { formatChartValue, type AnalyticsBoard as Board, type AnalyticsChart } from '@/lib/analytics';

function Bars({ chart }: { chart: AnalyticsChart }) {
  const max = Math.max(...chart.points.map((point) => point.value), 1);
  const summary =
    chart.points.length === 0
      ? `${chart.title}. No rows in this read.`
      : `${chart.title}. ${chart.points.map((point) => `${point.label} ${formatChartValue(chart.format, point.value)}`).join(', ')}.`;
  return (
    <figure className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <figcaption className="text-sm font-extrabold tracking-tight">{chart.title}</figcaption>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{chart.caption}</p>
      {chart.points.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">This read did not include these rows.</p>
      ) : (
        <div className="mt-4 space-y-2" role="img" aria-label={summary}>
          {chart.points.map((point) => (
            <BarRow
              key={point.label}
              label={point.label}
              value={point.value}
              max={max}
              formatted={formatChartValue(chart.format, point.value)}
            />
          ))}
        </div>
      )}
    </figure>
  );
}

/**
 * @purpose Render one of the eight analytics dashboards.
 * @param board A board from `buildAnalytics`.
 * @returns The dashboard section.
 */
export function AnalyticsBoard({ board }: { board: Board }) {
  return (
    <section id={board.id} className="scroll-mt-24 rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-4 sm:p-5">
      <p className="text-[11px] font-extrabold tracking-[0.16em] text-[var(--gold)] uppercase">Dashboard</p>
      <h2 className="mt-1 text-xl font-extrabold tracking-tight">{board.title}</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">{board.question}</p>
      <p className="mt-4 text-[11px] font-extrabold tracking-wide text-[var(--text-muted)] uppercase">{board.headlineLabel}</p>
      <p className="text-3xl font-extrabold tracking-tight">{board.headline}</p>
      <p className="mt-1 text-sm leading-5 text-[var(--ink-soft)]">{board.headlineNote}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {board.measures.map((measure) => (
          <div key={measure.key} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-[var(--ink-soft)]">{measure.label}</p>
              <p className="shrink-0 text-sm font-extrabold">{measure.display}</p>
            </div>
            <p className="mt-1 text-xs leading-4 text-[var(--text-muted)]">{measure.note}</p>
          </div>
        ))}
      </div>
      {board.charts.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {board.charts.map((chart) =>
            chart.kind === 'columns' ? (
              <ColumnChart
                key={chart.title}
                title={chart.title}
                points={chart.points}
                formatValue={(value) => formatChartValue(chart.format, value)}
                accent={chart.format === 'cents' ? 'var(--jade)' : chart.title.includes('stall') ? 'var(--ember)' : 'var(--gold)'}
              />
            ) : (
              <Bars key={chart.title} chart={chart} />
            ),
          )}
        </div>
      ) : null}
    </section>
  );
}
