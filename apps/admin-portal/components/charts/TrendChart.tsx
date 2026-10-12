/**
 * Daily series chart for the admin portal (7-day `get_admin_reports.series.*`, 14-day Revenue
 * `by_day`). Columns, line, or area in one inline SVG that scales by viewBox; gridline values,
 * day labels, and day values are HTML so they scale with browser zoom. A missing day (null)
 * breaks the line and prints "—"; a zero day sits on the baseline and prints "0".
 * Server-Component safe: hover uses SVG <title> and CSS only.
 */
import type { ReactNode } from 'react';

import { areaPath, columnPath, linePath, niceScale, peakIndex, slotCenter } from '../../lib/chartScale';

import { ChartFrame } from './ChartFrame';
import { chartColor, ChartNotice, isNum, show, type ChartColor, type ChartFormat, type ChartPoint } from './shared';

export type TrendVariant = 'columns' | 'line' | 'area';

export type TrendChartProps = {
  title: string;
  /** Plain window, e.g. "Last 7 days, UTC" or "Last 14 days, UTC". Shown under the title. */
  windowLabel: string;
  /** Oldest first. `null` or `[]` means the series was not in this read. */
  points: ChartPoint[] | null;
  format: ChartFormat;
  variant: TrendVariant;
  accent?: ChartColor;
  /** Source key, e.g. `get_admin_reports.series.malo`. */
  source?: string;
  /** Replaces the generated summary sentence. */
  summary?: string;
  /** 'sum' shows a window total in the header and summary (counts, cents, ms). 'none' hides it. */
  total?: 'sum' | 'none';
  /** A failed read; shows the error state instead of the plot. */
  error?: string | null;
  /**
   * Gridline unit, so ticks land on round display numbers. E.g. 60000 when values are ms shown as
   * minutes, 100 when values are cents shown as dollars. Default 1.
   */
  tickUnit?: number;
  /** Formatter for the gridline labels only, e.g. compact "$1.2M". Defaults to `format`. */
  tickFormat?: ChartFormat;
};

const W = 600;
const PAD_TOP = 10;

function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function buildSummary(title: string, windowLabel: string, points: ChartPoint[], format: ChartFormat, sum: number | null): string {
  const real = points.filter((point) => isNum(point.value));
  const missing = points.length - real.length;
  const missingText = missing > 0 ? ` ${missing} ${missing === 1 ? 'day is' : 'days are'} not in this read.` : '';
  if (real.length === 0) return `${title}: this read did not include the series.`;
  const peak = peakIndex(points.map((point) => point.value));
  if (peak < 0) return `${title} was 0 on every day in the ${lower(windowLabel)}.${missingText}`;
  const latest = [...points].reverse().find((point) => isNum(point.value))!;
  const totalText = sum != null ? ` Total ${format(sum)}.` : '';
  return `${title}, ${lower(windowLabel)}.${totalText} Highest on ${points[peak].label} at ${format(points[peak].value as number)}; latest day ${latest.label} at ${format(latest.value as number)}.${missingText}`;
}

/**
 * @purpose One daily series as columns, a line, or a filled area, with gridlines and HTML labels.
 * @param props See `TrendChartProps`.
 * @returns A `ChartFrame` figure.
 */
export function TrendChart({ title, windowLabel, points, format, variant, accent = 'jade', source, summary, total = 'sum', error, tickUnit = 1, tickFormat }: TrendChartProps) {
  const list = points ?? [];
  const values = list.map((point) => point.value);
  const hasData = values.some(isNum);
  const sum = total === 'sum' && hasData ? values.reduce<number>((acc, value) => acc + (isNum(value) ? value : 0), 0) : null;
  const sentence = summary ?? (hasData ? buildSummary(title, windowLabel, list, format, sum) : `${title}: this read did not include the series.`);
  const table = {
    columns: ['Day', title],
    rows: hasData ? list.map((point) => [point.label, show(point.value, format)]) : [],
  };
  const headline: ReactNode =
    sum != null && !error ? (
      <>
        <p className="chart-tabular text-lg leading-6 font-extrabold tracking-tight text-[var(--ink)]">{format(sum)}</p>
        <p className="text-[11px] font-bold text-[var(--text-muted)]">Total</p>
      </>
    ) : null;

  return (
    <ChartFrame title={title} caption={windowLabel} source={source} summary={sentence} table={table} headline={headline} error={error}>
      {hasData ? (
        <Plot points={list} format={format} tickFormat={tickFormat ?? format} variant={variant} accent={accent} tickUnit={tickUnit} />
      ) : (
        <ChartNotice kind="missing">This read did not include the series.</ChartNotice>
      )}
    </ChartFrame>
  );
}

function Plot({
  points,
  format,
  tickFormat,
  variant,
  accent,
  tickUnit,
}: {
  points: ChartPoint[];
  format: ChartFormat;
  tickFormat: ChartFormat;
  variant: TrendVariant;
  accent: ChartColor;
  tickUnit: number;
}) {
  const values = points.map((point) => point.value);
  const n = points.length;
  const unit = tickUnit > 0 ? tickUnit : 1;
  const unitScale = niceScale(values.map((value) => (isNum(value) ? value / unit : null)), 4);
  const scale = { max: unitScale.max * unit, ticks: unitScale.ticks.map((tick) => tick * unit) };
  // All zero: a short plot with only the baseline, instead of a tall empty box.
  const H = scale.max > 0 ? 200 : 64;
  const PLOT_H = H - PAD_TOP;
  const color = chartColor(accent);
  const yOf = (value: number) => PAD_TOP + PLOT_H - (scale.max > 0 ? (value / scale.max) * PLOT_H : 0);
  const slot = W / n;
  const barW = Math.min(44, slot * 0.58);
  const tickLabels = scale.ticks.map((tick) => ({ tick, text: tickFormat(tick) }));
  const gutter = Math.max(...tickLabels.map((label) => label.text.length), 1);
  const dense = n > 7;
  // Long values (big dollar amounts) only print under the plot when the card is wide; they stay in the Data table.
  const longest = Math.max(...points.map((point) => show(point.value, format).length));
  const valueClass = dense || longest > 8 ? 'hidden @2xl:block' : longest > 6 ? 'hidden @md:block' : 'hidden @xs:block';

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
      {/* Gridline values, HTML so they scale with zoom; positioned on the same percentages as the SVG lines. */}
      <div aria-hidden="true" className="chart-tabular relative text-right text-[11px] leading-none text-[var(--text-muted)]" style={{ width: `${gutter * 0.62 + 0.2}em` }}>
        {tickLabels.map(({ tick, text }, index) => (
          <span
            key={tick}
            // On a narrow card the plot is short, so every other inner label hides to keep them apart.
            className={`absolute right-0 -translate-y-1/2 whitespace-nowrap ${index > 0 && index < tickLabels.length - 1 && (index % 2 === 1 || tickLabels.length % 2 === 0) ? 'hidden @md:block' : ''}`}
            style={{ top: `${(yOf(tick) / H) * 100}%` }}
          >
            {text}
          </span>
        ))}
      </div>
      <div className="relative min-w-0">
        <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible">
          {scale.ticks.map((tick) => (
            <line
              key={tick}
              x1={0}
              x2={W}
              y1={yOf(tick)}
              y2={yOf(tick)}
              stroke={tick === 0 ? 'var(--chart-muted)' : 'var(--chart-grid)'}
              strokeOpacity={tick === 0 ? 0.45 : 1}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={tick === 0 ? undefined : '3 4'}
            />
          ))}
          {points.map((point, index) => {
            const x = slot * index;
            const label = `${point.label}: ${show(point.value, format)}`;
            return (
              <g key={`band-${index}`} className="chart-slot">
                <title>{label}</title>
                <rect className="chart-band" x={x} y={PAD_TOP} width={slot} height={PLOT_H} rx={6} fill="var(--chart-track)" />
                {variant === 'columns' ? <Column value={point.value} cx={slotCenter(index, n, W)} width={barW} yOf={yOf} color={color} /> : null}
                {/* Transparent hit area so hover works over the whole day, not just the mark. */}
                <rect x={x} y={0} width={slot} height={H} fill="transparent" />
              </g>
            );
          })}
          {variant !== 'columns' ? (
            <g pointerEvents="none">
              {variant === 'area' ? (
                <path d={areaPath(values, W, PLOT_H, scale.max)} transform={`translate(0 ${PAD_TOP})`} fill={color} fillOpacity={0.12} />
              ) : null}
              <path
                d={linePath(values, W, PLOT_H, scale.max)}
                transform={`translate(0 ${PAD_TOP})`}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {points.map((point, index) =>
                isNum(point.value) ? (
                  // Zero-length round-capped strokes with non-scaling width: the point marker stays
                  // 8px on screen at any card width, so a single non-zero day is always visible.
                  <g key={`dot-${index}`}>
                    <path d={`M${slotCenter(index, n, W)} ${yOf(point.value)}h0`} stroke="var(--surface)" strokeWidth={11} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    <path d={`M${slotCenter(index, n, W)} ${yOf(point.value)}h0`} stroke={color} strokeWidth={7} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  </g>
                ) : null,
              )}
            </g>
          ) : null}
        </svg>
      </div>
      <span />
      <ol className="mt-2 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {points.map((point, index) => (
          <li key={`${point.label}-${index}`} className="min-w-0 text-center">
            <span className={`block truncate text-[10px] font-bold text-[var(--text-muted)] ${dense ? '' : 'tracking-wide uppercase'}`}>{point.label}</span>
            <span
              className={`chart-tabular block truncate text-[11px] font-extrabold ${isNum(point.value) ? 'text-[var(--ink)]' : 'text-[var(--text-muted)]'} ${valueClass}`}
            >
              {show(point.value, format)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Column({ value, cx, width, yOf, color }: { value: number | null; cx: number; width: number; yOf: (value: number) => number; color: string }) {
  if (!isNum(value)) return null;
  const base = yOf(0);
  const height = base - yOf(value);
  if (height <= 0.5) {
    // A real zero: a short neutral stub on the baseline at full --chart-muted (5.87:1), so 0 is visible,
    // stands out from the 45% baseline, and differs from missing (no mark).
    return <rect x={cx - width / 2} y={base - 2} width={width} height={2} rx={1} fill="var(--chart-muted)" />;
  }
  return <path className="chart-mark" d={columnPath(cx - width / 2, width, base, Math.max(height, 3), 6)} fill={color} />;
}
