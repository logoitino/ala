/**
 * Tiny trend line for a StatTile. Decorative only: it is aria-hidden, and the tile prints the
 * same days as text in an sr-only span. Fixed 112 × height box so the stroke and end dot stay crisp.
 * Server-Component safe.
 */
import { linePath, niceMax, slotCenter } from '../../lib/chartScale';

import { chartColor, type ChartColor, type ChartPoint } from './shared';

const WIDTH = 112;
const PAD = 3;

/**
 * @purpose Polyline with a dot on the last real point. Missing days break the line.
 * @param points Daily values, oldest first.
 * @param accent Chart colour. Defaults to jade.
 * @param height Pixel height, default 28.
 * @returns An SVG, or null when there is nothing to draw.
 */
export function Sparkline({ points, accent = 'jade', height = 28 }: { points: ChartPoint[]; accent?: ChartColor; height?: number }) {
  if (points.length === 0) return null;
  const values = points.map((point) => point.value);
  const max = niceMax(values);
  const plotH = height - PAD * 2;
  const d = linePath(values, WIDTH, plotH, max);
  let last = -1;
  values.forEach((value, index) => {
    if (typeof value === 'number' && Number.isFinite(value)) last = index;
  });
  const color = chartColor(accent);
  const lastValue = last >= 0 ? (values[last] as number) : 0;
  const lastY = PAD + plotH - (max > 0 ? (lastValue / max) * plotH : 0);

  return (
    <svg aria-hidden="true" focusable="false" width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`} className="block shrink-0 overflow-visible">
      <line x1={0} x2={WIDTH} y1={height - PAD} y2={height - PAD} stroke="var(--chart-grid)" strokeWidth={1} />
      {d ? (
        <path
          d={d}
          transform={`translate(0 ${PAD})`}
          fill="none"
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {last >= 0 ? <circle cx={slotCenter(last, values.length, WIDTH)} cy={lastY} r={2.75} fill={color} stroke="var(--surface)" strokeWidth={1.5} /> : null}
    </svg>
  );
}
