/**
 * "Week at a glance": one row per daily series, one cell per day. Cell tint is
 * `color-mix(<row colour> X%, --surface)`, normalised per row (cents and counts do not share a
 * scale) and capped at 60% so ink text keeps >= 4.5:1 on every tint. Cells print their value
 * when the card is wide enough; every row ends with its peak in words, and the Data table holds
 * every value. Server-Component safe.
 */
import { normalizeRow, peakIndex } from '../../lib/chartScale';

import { ChartFrame } from './ChartFrame';
import { chartColor, isNum, MISSING, show, type ChartColor, type ChartFormat, type ChartPoint } from './shared';

export type HeatRow = {
  label: string;
  /** Oldest first. `[]` = this series was not in the read. */
  points: ChartPoint[];
  format: ChartFormat;
  accent: ChartColor;
};

export type HeatStripProps = {
  title: string;
  rows: HeatRow[];
  caption?: string;
  source?: string;
  summary?: string;
  error?: string | null;
};

// Lightest non-zero tint and the cap. Above ~60% the ink label would drop under 4.5:1 on violet.
const MIN_TINT = 10;
const MAX_TINT = 60;

function peakText(row: HeatRow): string {
  if (!row.points.some((point) => isNum(point.value))) return 'Not in this read';
  const peak = peakIndex(row.points.map((point) => point.value));
  if (peak < 0) return 'All days 0';
  return `Peak: ${row.points[peak].label}, ${row.format(row.points[peak].value as number)}`;
}

/**
 * @purpose Rows × days intensity grid with values as text and a peak line per row.
 * @param props See `HeatStripProps`.
 * @returns A `ChartFrame` figure.
 */
export function HeatStrip({ title, rows, caption, source, summary, error }: HeatStripProps) {
  const days = rows.find((row) => row.points.length > 0)?.points.map((point) => point.label) ?? [];
  const sentence = summary ?? `${title}: ${rows.map((row) => `${row.label}, ${peakText(row).replace('Peak: ', 'peak ')}`).join('; ')}.`;
  const table = {
    columns: ['Series', ...days],
    rows: rows.some((row) => row.points.some((point) => isNum(point.value)))
      ? rows.map((row) => [row.label, ...days.map((_, index) => show(row.points[index]?.value ?? null, row.format))])
      : [],
  };

  return (
    <ChartFrame title={title} caption={caption} source={source} summary={sentence} table={table} error={error}>
      <div className="flex flex-col gap-4">
        {rows.map((row) => {
          const intensity = normalizeRow(row.points.map((point) => point.value));
          const peak = peakIndex(row.points.map((point) => point.value));
          const color = chartColor(row.accent);
          const missingRow = !row.points.some((point) => isNum(point.value));
          return (
            <div key={row.label} className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-bold text-[var(--ink)]">{row.label}</p>
                <p className="chart-tabular text-xs font-bold text-[var(--ink-soft)]">{peakText(row)}</p>
              </div>
              {missingRow ? (
                <div className="flex h-9 items-center rounded-lg border border-dashed border-[var(--border)] px-3 text-xs text-[var(--text-muted)]">
                  <span aria-hidden="true">{MISSING}&nbsp;</span>Not in this read
                </div>
              ) : (
                <ol aria-hidden="true" className="grid gap-1" style={{ gridTemplateColumns: `repeat(${row.points.length}, minmax(0, 1fr))` }}>
                  {row.points.map((point, index) => {
                    const level = intensity[index];
                    const value = point.value;
                    const tint = level == null ? 0 : level === 0 ? 0 : Math.round(MIN_TINT + level * (MAX_TINT - MIN_TINT));
                    const background =
                      level == null ? 'transparent' : level === 0 ? 'var(--chart-track)' : `color-mix(in srgb, ${color} ${tint}%, var(--surface))`;
                    return (
                      <li
                        key={`${point.label}-${index}`}
                        title={`${point.label}: ${show(value, row.format)}`}
                        className={`chart-mark flex h-9 min-w-0 flex-col items-center justify-center rounded-md text-center ${level == null ? 'border border-dashed border-[var(--border)]' : ''}`}
                        style={{ background, boxShadow: index === peak ? `inset 0 0 0 2px var(--ink)` : undefined }}
                      >
                        <span className="block text-[10px] leading-3 font-bold tracking-wide text-[var(--ink)] uppercase @md:hidden">{isNum(value) ? point.label.slice(0, 2) : MISSING}</span>
                        <span className="chart-tabular hidden w-full truncate px-0.5 text-[11px] leading-4 font-extrabold text-[var(--ink)] @md:block">
                          {isNum(value) ? row.format(value) : MISSING}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          );
        })}
        {days.length > 0 ? (
          <ol aria-hidden="true" className="hidden gap-1 @md:grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((day, index) => (
              <li key={`${day}-${index}`} className="truncate text-center text-[10px] font-bold tracking-wide text-[var(--text-muted)] uppercase">
                {day}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </ChartFrame>
  );
}
