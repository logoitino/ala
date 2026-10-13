/**
 * Daily series chart for the admin portal (7-day `get_admin_reports.series.*`, 14-day Revenue
 * `by_day`). Columns, line, or area in one inline SVG that scales by viewBox; gridline values,
 * day labels, and day values are HTML so they scale with browser zoom. A missing day (null)
 * breaks the line and prints "—"; a zero day sits on the baseline and prints "0".
 * Report presentation is the default on every page (owner decision 2026-10-12): a 144px plot
 * drawn in CSS-pixel units (viewBox height = `plotHeight`, so only the width stretches), which
 * keeps a zero-day stub at 2px and the smallest column at 3px. The hover band uses `--border`
 * so it shows on the page background. Home can request a peak callout: `peakLabelAnchor` pins it
 * to the start or end on the first and last days, and the plot reserves top room for it so it
 * never covers the summary. Axis text and the full Data table remain readable HTML.
 * Server-Component safe: hover uses SVG <title> and CSS only.
 */
import type { ReactNode } from 'react';

import { areaPath, axisLabelMinWidths, columnPath, containerStepFor, linePath, niceScale, peakIndex, peakLabelAnchor, slotCenter } from '../../lib/chartScale';

import { ChartFrame } from './ChartFrame';
import { chartColor, ChartNotice, isNum, show, type ChartColor, type ChartFormat, type ChartPoint } from './shared';

export type TrendVariant = 'columns' | 'line' | 'area';

export type TrendChartProps = {
  title: string;
  /** Plain window, e.g. "Last 7 days, UTC" or "Last 14 days, UTC". Shown with the title. */
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
  /**
   * Passed to `ChartFrame`. `'report'` (default, owner decision 2026-10-12) is the open figure on
   * the page background and defaults `plotHeight` to 144. `'card'` keeps the bordered card and the
   * 600 x 200 viewBox ratio.
   */
  presentation?: 'card' | 'report';
  /**
   * Plot height in CSS pixels. When set, the SVG viewBox is that many units tall, so vertical units
   * equal CSS pixels and only the width stretches (`preserveAspectRatio="none"`). An all-zero
   * series still draws a 64px baseline-only plot. Unset in card mode: the 600 x 200 ratio scales.
   */
  plotHeight?: number;
  /**
   * Label the highest day with "Day · value" above its point. The plot reserves 32px of top room
   * for it, and the first and last days anchor the label start or end (`peakLabelAnchor`) so it
   * stays inside the chart. An all-zero or missing series has no callout. Default false.
   */
  annotatePeak?: boolean;
};

const W = 600;
const PAD_TOP = 10;

// Literal classes per container step so Tailwind sees every class (no built class names).
// Keys are `CONTAINER_STEPS` in lib/chartScale.ts. `display` removes the element (day values);
// `visibility` keeps its line height so a thinned label never pulls the value row up.
const SHOW_FROM: Record<number, { display: string; visibility: string }> = {
  0: { display: 'block', visibility: 'visible' },
  208: { display: 'hidden @min-[13rem]:block', visibility: 'invisible @min-[13rem]:visible' },
  224: { display: 'hidden @min-[14rem]:block', visibility: 'invisible @min-[14rem]:visible' },
  240: { display: 'hidden @min-[15rem]:block', visibility: 'invisible @min-[15rem]:visible' },
  256: { display: 'hidden @3xs:block', visibility: 'invisible @3xs:visible' },
  272: { display: 'hidden @min-[17rem]:block', visibility: 'invisible @min-[17rem]:visible' },
  288: { display: 'hidden @2xs:block', visibility: 'invisible @2xs:visible' },
  304: { display: 'hidden @min-[19rem]:block', visibility: 'invisible @min-[19rem]:visible' },
  320: { display: 'hidden @xs:block', visibility: 'invisible @xs:visible' },
  336: { display: 'hidden @min-[21rem]:block', visibility: 'invisible @min-[21rem]:visible' },
  352: { display: 'hidden @min-[22rem]:block', visibility: 'invisible @min-[22rem]:visible' },
  368: { display: 'hidden @min-[23rem]:block', visibility: 'invisible @min-[23rem]:visible' },
  384: { display: 'hidden @sm:block', visibility: 'invisible @sm:visible' },
  416: { display: 'hidden @min-[26rem]:block', visibility: 'invisible @min-[26rem]:visible' },
  448: { display: 'hidden @md:block', visibility: 'invisible @md:visible' },
  480: { display: 'hidden @min-[30rem]:block', visibility: 'invisible @min-[30rem]:visible' },
  512: { display: 'hidden @lg:block', visibility: 'invisible @lg:visible' },
  576: { display: 'hidden @xl:block', visibility: 'invisible @xl:visible' },
  672: { display: 'hidden @2xl:block', visibility: 'invisible @2xl:visible' },
  768: { display: 'hidden @3xl:block', visibility: 'invisible @3xl:visible' },
  896: { display: 'hidden @4xl:block', visibility: 'invisible @4xl:visible' },
  1024: { display: 'hidden @5xl:block', visibility: 'invisible @5xl:visible' },
  1152: { display: 'hidden @6xl:block', visibility: 'invisible @6xl:visible' },
  1280: { display: 'hidden @7xl:block', visibility: 'invisible @7xl:visible' },
};
const NEVER = { display: 'hidden', visibility: 'invisible' };

/** Classes that show an element once the chart card's content box is at least `px` wide. */
function showFrom(px: number): { display: string; visibility: string } {
  const step = containerStepFor(px);
  return step == null ? NEVER : (SHOW_FROM[step] ?? NEVER);
}

// Rough glyph widths in CSS px, on the safe side: day labels are 10px bold (uppercase with
// tracking when there are 7 or fewer), day values 11px extrabold tabular.
const LABEL_CHAR_PX = { upper: 7.4, plain: 6.4 };
const VALUE_CHAR_PX = 7.2;
const SLOT_ROOM_PX = 6;

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
export function TrendChart({ title, windowLabel, points, format, variant, accent = 'jade', source, summary, total = 'sum', error, tickUnit = 1, tickFormat, presentation = 'report', plotHeight, annotatePeak = false }: TrendChartProps) {
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
    <ChartFrame title={title} caption={windowLabel} source={source} summary={sentence} table={table} headline={headline} error={error} presentation={presentation}>
      {hasData ? (
        <Plot
          points={list}
          format={format}
          tickFormat={tickFormat ?? format}
          variant={variant}
          accent={accent}
          tickUnit={tickUnit}
          plotHeight={plotHeight ?? (presentation === 'report' ? 144 : undefined)}
          annotatePeak={annotatePeak}
          report={presentation === 'report'}
        />
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
  plotHeight,
  annotatePeak,
  report,
}: {
  points: ChartPoint[];
  format: ChartFormat;
  tickFormat: ChartFormat;
  variant: TrendVariant;
  accent: ChartColor;
  tickUnit: number;
  plotHeight?: number;
  annotatePeak: boolean;
  report: boolean;
}) {
  const values = points.map((point) => point.value);
  const n = points.length;
  const unit = tickUnit > 0 ? tickUnit : 1;
  const unitScale = niceScale(values.map((value) => (isNum(value) ? value / unit : null)), 4);
  const scale = { max: unitScale.max * unit, ticks: unitScale.ticks.map((tick) => tick * unit) };
  // With plotHeight the viewBox is that many units tall, so 1 unit = 1 CSS px vertically and only
  // the width stretches; without it (card) the 600 x 200 box scales as a whole.
  const pxUnits = typeof plotHeight === 'number' && plotHeight > 0;
  // All zero: a short plot with only the baseline, instead of a tall empty box.
  const H = scale.max > 0 ? (pxUnits ? plotHeight : 200) : 64;
  // Smallest non-zero column: 3px in pixel units; 6 units in a scaled card (2px at a 200px plot).
  const minBar = pxUnits ? 3 : 6;
  const PLOT_H = H - PAD_TOP;
  const color = chartColor(accent);
  const yOf = (value: number) => PAD_TOP + PLOT_H - (scale.max > 0 ? (value / scale.max) * PLOT_H : 0);
  const slot = W / n;
  const barW = Math.min(44, slot * 0.58);
  const tickLabels = scale.ticks.map((tick) => ({ tick, text: tickFormat(tick) }));
  const gutter = Math.max(...tickLabels.map((label) => label.text.length), 1);
  const gutterEm = gutter * 0.62 + 0.2;
  const dense = n > 7;
  // Width the day columns do not get: the gridline gutter (11px text) plus the 8px column gap.
  const fixedPx = gutterEm * 11 + 8;
  // Crowded axis: keep every 2nd/4th/… day label (always the newest) instead of truncating.
  const labelChars = Math.max(...points.map((point) => point.label.length), 1);
  const labelPx = labelChars * (dense ? LABEL_CHAR_PX.plain : LABEL_CHAR_PX.upper) + SLOT_ROOM_PX;
  const labelClass = axisLabelMinWidths(n, labelPx, fixedPx).map((px) => showFrom(px).visibility);
  // Day values print under the axis only when every one fits its own slot; otherwise they would
  // run together ("$404.50$438.00"). They always stay in the summary and the Data table.
  const longest = Math.max(...points.map((point) => show(point.value, format).length));
  const valueClass = showFrom(Math.ceil(fixedPx + n * (longest * VALUE_CHAR_PX + SLOT_ROOM_PX))).display;
  const peak = annotatePeak ? peakIndex(values) : -1;
  const peakPoint = peak >= 0 ? points[peak] : null;
  const peakValue = peakPoint && isNum(peakPoint.value) && peakPoint.value > 0 ? peakPoint.value : null;
  // First and last days pin the label's start or end to the point so it never leaves the plot.
  const peakShift = { start: '0%', middle: '-50%', end: '-100%' }[peakLabelAnchor(peak, n)];

  return (
    // pt-8 is the peak label's room (24px label + an 8px gap that clears the point marker), so
    // the label stays inside the figure and below the summary.
    <div className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 ${peakValue != null ? 'pt-8' : ''}`}>
      {/* Gridline values, HTML so they scale with zoom; positioned on the same percentages as the SVG lines. */}
      <div aria-hidden="true" className="chart-tabular relative text-right text-[11px] leading-none text-[var(--text-muted)]" style={{ width: `${gutterEm}em` }}>
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
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full overflow-visible"
          preserveAspectRatio={pxUnits ? 'none' : undefined}
          style={pxUnits ? { height: H } : undefined}
        >
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
                {/* --chart-track is invisible on the canvas (1.04:1), so report figures use --border. */}
                <rect className="chart-band" x={x} y={PAD_TOP} width={slot} height={PLOT_H} rx={6} fill={report ? 'var(--border)' : 'var(--chart-track)'} />
                {variant === 'columns' ? <Column value={point.value} cx={slotCenter(index, n, W)} width={barW} yOf={yOf} color={color} minBar={minBar} /> : null}
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
        {peakPoint && peakValue != null ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute rounded-md px-2 py-1 text-[11px] leading-4 font-extrabold whitespace-nowrap text-white"
            style={{
              left: `${(slotCenter(peak, n, W) / W) * 100}%`,
              top: `${(yOf(peakValue) / H) * 100}%`,
              transform: `translate(${peakShift}, calc(-100% - 8px))`,
              background: color,
            }}
          >
            {peakPoint.label} · {format(peakValue)}
          </span>
        ) : null}
      </div>
      <span />
      <ol className="mt-2 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {points.map((point, index) => (
          // Centred flex column: a label wider than its slot spills evenly into the thinned neighbours
          // instead of being cut. The slot keeps min-w-0 so the grid columns stay equal.
          <li key={`${point.label}-${index}`} className="flex min-w-0 flex-col items-center text-center">
            <span className={`text-[10px] font-bold whitespace-nowrap text-[var(--text-muted)] ${dense ? '' : 'tracking-wide uppercase'} ${labelClass[index]}`}>{point.label}</span>
            <span
              className={`chart-tabular text-[11px] font-extrabold whitespace-nowrap ${isNum(point.value) ? 'text-[var(--ink)]' : 'text-[var(--text-muted)]'} ${valueClass}`}
            >
              {show(point.value, format)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Column({ value, cx, width, yOf, color, minBar }: { value: number | null; cx: number; width: number; yOf: (value: number) => number; color: string; minBar: number }) {
  if (!isNum(value)) return null;
  const base = yOf(0);
  const height = base - yOf(value);
  // Only a real zero gets the stub; a tiny positive day still draws a (minimum-height) column.
  if (value <= 0 || !(height > 0)) {
    // A real zero: a neutral stub on the baseline at full --chart-muted (5.87:1), so 0 is visible,
    // stands out from the 45% baseline, and differs from missing (no mark). A non-scaling 2px
    // stroke stays 2px tall on screen whatever the viewBox scale.
    return <line x1={cx - width / 2} x2={cx + width / 2} y1={base - 1} y2={base - 1} stroke="var(--chart-muted)" strokeWidth={2} vectorEffect="non-scaling-stroke" />;
  }
  return <path className="chart-mark" d={columnPath(cx - width / 2, width, base, Math.max(height, minBar), 6)} fill={color} />;
}
