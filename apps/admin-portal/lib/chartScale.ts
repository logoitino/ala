/**
 * Chart math for the admin portal chart kit (`components/charts/*`). Pure functions, no React,
 * no DOM, so `node --test` covers them and every chart scales the same way.
 * Rule: `null` means "not in this read" and is never treated as 0. Shares come only from a
 * total above zero.
 */

export type ChartValue = number | null;

export type NiceScale = {
  /** Top of the axis. 0 when every value is 0 or missing, so the chart draws a baseline only. */
  max: number;
  /** Distance between gridlines. 0 when `max` is 0. */
  step: number;
  /** Gridline values from 0 to `max`, inclusive. `[0]` when `max` is 0. */
  ticks: number[];
};

function finite(values: ChartValue[]): number[] {
  return values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

/**
 * @purpose Pick a round axis top and gridline step (1, 2, 5 × 10^k) above the largest value.
 *   Integer data never gets a fractional step, so a count axis does not read "2.5 clips".
 * @param values Plotted values. Nulls and negatives are ignored (the portal plots counts, cents, ms).
 * @param tickCount Roughly how many gridlines above zero.
 * @returns The axis max, the step, and the tick values.
 */
export function niceScale(values: ChartValue[], tickCount = 4): NiceScale {
  const nums = finite(values).map((value) => Math.max(0, value));
  const top = nums.length ? Math.max(...nums) : 0;
  if (top <= 0) return { max: 0, step: 0, ticks: [0] };
  const integers = nums.every((value) => Number.isInteger(value));
  const raw = top / Math.max(1, tickCount);
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  let step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
  if (integers && step < 1) step = 1;
  const max = Math.ceil(top / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= max + step / 2; tick += step) ticks.push(Number(tick.toPrecision(12)));
  return { max: Number(max.toPrecision(12)), step, ticks };
}

/**
 * @purpose Round axis top for a set of values (shorthand for `niceScale(values).max`).
 * @param values Plotted values; nulls ignored.
 * @returns 0 when there is nothing above zero.
 */
export function niceMax(values: ChartValue[]): number {
  return niceScale(values).max;
}

/**
 * @purpose Map a value in [0, domainMax] to pixels in [0, rangePx]. Clamped at both ends.
 * @param domainMax Top of the axis. A max of 0 maps everything to 0 (baseline only).
 * @param rangePx Plot height or width in viewBox units.
 * @returns A function from value to length.
 */
export function linearScale(domainMax: number, rangePx: number): (value: number) => number {
  if (!(domainMax > 0)) return () => 0;
  return (value: number) => Math.min(rangePx, Math.max(0, (value / domainMax) * rangePx));
}

/**
 * @purpose X centre of slot `index` when `count` equal slots fill `width`. Columns, line points,
 *   and the HTML day labels all use this so they line up at any zoom.
 */
export function slotCenter(index: number, count: number, width: number): number {
  if (count <= 0) return 0;
  return (width / count) * (index + 0.5);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * @purpose SVG path for a line through equal slots. A null value breaks the line, so a missing
 *   day never looks like a dip to zero.
 * @param values One value per slot.
 * @param width viewBox width.
 * @param height viewBox height (y grows downward; 0 sits on the bottom edge).
 * @param max Axis top; defaults to `niceMax(values)`.
 * @returns A `d` string, or '' when nothing is plottable.
 */
export function linePath(values: ChartValue[], width: number, height: number, max = niceMax(values)): string {
  const y = linearScale(max, height);
  let d = '';
  let open = false;
  values.forEach((value, index) => {
    if (value == null || !Number.isFinite(value)) {
      open = false;
      return;
    }
    const px = round(slotCenter(index, values.length, width));
    const py = round(height - y(value));
    d += `${open ? 'L' : 'M'}${px} ${py}`;
    open = true;
  });
  return d;
}

/**
 * @purpose Filled area under `linePath`, one closed shape per unbroken run of values.
 * @returns A `d` string, or '' when nothing is plottable.
 */
export function areaPath(values: ChartValue[], width: number, height: number, max = niceMax(values)): string {
  const y = linearScale(max, height);
  const runs: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  values.forEach((value, index) => {
    if (value == null || !Number.isFinite(value)) {
      if (run.length) runs.push(run);
      run = [];
      return;
    }
    run.push({ x: round(slotCenter(index, values.length, width)), y: round(height - y(value)) });
  });
  if (run.length) runs.push(run);
  return runs
    .map((points) => {
      const first = points[0];
      const last = points[points.length - 1];
      const top = points.map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join('');
      return `${top}L${last.x} ${height}L${first.x} ${height}Z`;
    })
    .join('');
}

/**
 * @purpose Column with rounded top corners, flat on the baseline.
 * @param x Left edge.
 * @param width Column width.
 * @param baseY Baseline y (bottom of the plot).
 * @param barHeight Column height; 0 returns ''.
 * @param radius Corner radius, clamped to the column size.
 */
export function columnPath(x: number, width: number, baseY: number, barHeight: number, radius = 4): string {
  if (!(barHeight > 0) || !(width > 0)) return '';
  const r = Math.min(radius, width / 2, barHeight);
  const top = baseY - barHeight;
  const right = x + width;
  return [
    `M${round(x)} ${round(baseY)}`,
    `L${round(x)} ${round(top + r)}`,
    `Q${round(x)} ${round(top)} ${round(x + r)} ${round(top)}`,
    `L${round(right - r)} ${round(top)}`,
    `Q${round(right)} ${round(top)} ${round(right)} ${round(top + r)}`,
    `L${round(right)} ${round(baseY)}`,
    'Z',
  ].join('');
}

/**
 * @purpose Circular arc for a ring segment, drawn as a stroke. Angles are fractions of a turn:
 *   0 is 12 o'clock and the arc runs clockwise. A full turn is drawn as two halves because a
 *   single SVG arc with equal end points draws nothing.
 * @param cx Centre x. @param cy Centre y. @param r Radius.
 * @param start Start, 0–1. @param end End, 0–1.
 * @returns A `d` string, or '' when the arc is empty.
 */
export function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const span = end - start;
  if (!(span > 0) || !(r > 0)) return '';
  const point = (turn: number) => {
    const angle = turn * 2 * Math.PI - Math.PI / 2;
    return `${round(cx + r * Math.cos(angle))} ${round(cy + r * Math.sin(angle))}`;
  };
  if (span >= 0.9999) {
    return `M${point(start)}A${r} ${r} 0 1 1 ${point(start + 0.5)}A${r} ${r} 0 1 1 ${point(start)}`;
  }
  const large = span > 0.5 ? 1 : 0;
  return `M${point(start)}A${r} ${r} 0 ${large} 1 ${point(end)}`;
}

/**
 * @purpose Whole-number shares that always sum to exactly 100 (largest-remainder method), so a
 *   legend never reads 33 + 33 + 33.
 * @param values Part sizes. Null and negative count as 0.
 * @returns One integer percent per value, or null when the total is 0 (no shares exist).
 */
export function sharesTo100(values: ChartValue[]): number[] | null {
  const parts = values.map((value) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0));
  const total = parts.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;
  const exact = parts.map((value) => (value / total) * 100);
  const floors = exact.map((value) => Math.floor(value));
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index] += 1;
    left -= 1;
  }
  return floors;
}

/**
 * @purpose Scale a row to 0–1 against its own peak (HeatStrip intensity). Rows are normalized
 *   separately because cents and counts do not share a scale.
 * @param values One row. Nulls stay null.
 * @returns 0–1 per value; all zeros when the row peak is 0.
 */
export function normalizeRow(values: ChartValue[]): (number | null)[] {
  const peak = Math.max(0, ...finite(values));
  return values.map((value) => {
    if (value == null || !Number.isFinite(value)) return null;
    return peak > 0 ? Math.max(0, value) / peak : 0;
  });
}

/**
 * @purpose Index of the largest value, first one on a tie. -1 when nothing is above zero.
 */
export function peakIndex(values: ChartValue[]): number {
  let best = -1;
  let top = 0;
  values.forEach((value, index) => {
    if (typeof value === 'number' && Number.isFinite(value) && value > top) {
      top = value;
      best = index;
    }
  });
  return best;
}
