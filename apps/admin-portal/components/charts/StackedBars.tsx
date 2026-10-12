/**
 * Horizontal stacked bars: one row per item, segments per series, bars scaled to the largest
 * row total. Each row prints its total and every segment value as text. Built for Revenue
 * streams (platform_cents vs payout_cents per stream). Server-Component safe.
 */
import { sharesTo100 } from '../../lib/chartScale';

import { ChartFrame } from './ChartFrame';
import { chartColor, ChartNotice, isNum, show, Swatch, type ChartColor, type ChartFormat } from './shared';

export type StackSeries = { key: string; label: string; color: ChartColor };

export type StackRow = {
  label: string;
  /** Value per series key. A missing key or null prints "—" and is left out of the bar. */
  segments: Record<string, number | null | undefined>;
  /** Recorded row total (e.g. gross_cents). Defaults to the sum of the known segments. */
  total?: number | null;
};

export type StackedBarsProps = {
  title: string;
  series: StackSeries[];
  /** `null` = not in this read. `[]` = read, but no rows (shows `emptyText`). */
  rows: StackRow[] | null;
  format: ChartFormat;
  emptyText?: string;
  caption?: string;
  source?: string;
  summary?: string;
  error?: string | null;
};

function rowTotal(row: StackRow, series: StackSeries[]): number | null {
  if (isNum(row.total ?? null)) return row.total as number;
  const known = series.map((item) => row.segments[item.key]).filter((value): value is number => isNum(value ?? null));
  return known.length ? known.reduce((sum, value) => sum + Math.max(0, value), 0) : null;
}

function remainder(row: StackRow, series: StackSeries[], total: number): number {
  const known = series.reduce((sum, item) => {
    const value = row.segments[item.key] ?? null;
    return sum + (isNum(value) ? Math.max(0, value) : 0);
  }, 0);
  return Math.max(0, total - known);
}

/**
 * @purpose Rows of stacked segments with a legend, per-row totals, and per-segment values.
 * @param props See `StackedBarsProps`.
 * @returns A `ChartFrame` figure.
 */
export function StackedBars({ title, series, rows, format, emptyText = 'Nothing recorded in this window.', caption, source, summary, error }: StackedBarsProps) {
  const list = rows ?? [];
  const totals = list.map((row) => rowTotal(row, series));
  const max = Math.max(0, ...totals.map((total) => total ?? 0));
  const grand = totals.reduce<number>((sum, total) => sum + (total ?? 0), 0);
  const seriesTotals = series.map((item) => list.reduce((sum, row) => sum + (isNum(row.segments[item.key] ?? null) ? Math.max(0, row.segments[item.key] as number) : 0), 0));

  const sentence =
    summary ??
    (rows == null
      ? `${title}: this read did not include these rows.`
      : list.length === 0
        ? `${title}: ${emptyText}`
        : `${title}: ${list.length} ${list.length === 1 ? 'row' : 'rows'}, ${format(grand)} in total. ${series.map((item, index) => `${item.label} ${format(seriesTotals[index])}`).join(', ')}.`);

  const table = {
    columns: ['Row', ...series.map((item) => item.label), 'Total'],
    rows: list.map((row, index) => [row.label, ...series.map((item) => show(row.segments[item.key] ?? null, format)), show(totals[index], format)]),
  };

  return (
    <ChartFrame title={title} caption={caption} source={source} summary={sentence} table={table} error={error}>
      {rows == null ? (
        <ChartNotice kind="missing">This read did not include these rows.</ChartNotice>
      ) : list.length === 0 ? (
        <ChartNotice kind="empty">{emptyText}</ChartNotice>
      ) : (
        <>
          <ul aria-hidden="true" className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-[var(--ink-soft)]">
            {series.map((item) => (
              <li key={item.key} className="flex items-center gap-1.5">
                <Swatch color={item.color} />
                {item.label}
              </li>
            ))}
          </ul>
          <ol className="flex flex-col gap-4">
            {list.map((row, index) => {
              const total = totals[index];
              const width = max > 0 && total != null ? Math.max(0, (total / max) * 100) : 0;
              // Share of the row total, so colour is never the only way to read a segment's size.
              // The unsplit remainder takes its own share, so the printed shares add up to 100.
              const shares =
                total != null && total > 0
                  ? sharesTo100([...series.map((item) => row.segments[item.key] ?? null), remainder(row, series, total)])
                  : null;
              return (
                <li key={`${row.label}-${index}`} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 break-words font-bold text-[var(--ink)]">{row.label}</span>
                    <span className="chart-tabular shrink-0 font-extrabold text-[var(--ink)]">{show(total, format)}</span>
                  </div>
                  <div aria-hidden="true" className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-[var(--chart-track)]">
                    {total != null && total > 0 ? (
                      <div className="flex h-full gap-[2px] bg-[var(--chart-gap)]" style={{ width: `${width}%`, minWidth: 4 }}>
                        {series.map((item) => {
                          const value = row.segments[item.key] ?? null;
                          return isNum(value) && value > 0 ? (
                            <div
                              key={item.key}
                              className="chart-mark h-full"
                              style={{ flexGrow: value, flexBasis: 0, minWidth: 2, background: chartColor(item.color) }}
                              title={`${row.label} · ${item.label}: ${format(value)}`}
                            />
                          ) : null;
                        })}
                        {/* Recorded total above the known segments: keep that share as plain track, not a fake segment. */}
                        {remainder(row, series, total) > 0 ? (
                          <div className="h-full bg-[var(--chart-track)]" style={{ flexGrow: remainder(row, series, total), flexBasis: 0 }} />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <p className="chart-tabular mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--ink-soft)]">
                    {series.map((item, seriesIndex) => (
                      <span key={item.key} className="inline-flex items-center gap-1.5">
                        <Swatch color={item.color} />
                        {item.label} <span className="font-extrabold text-[var(--ink)]">{show(row.segments[item.key] ?? null, format)}</span>
                        {shares && isNum(row.segments[item.key] ?? null) ? <span className="text-[var(--text-muted)]">{shares[seriesIndex]}%</span> : null}
                      </span>
                    ))}
                  </p>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </ChartFrame>
  );
}
