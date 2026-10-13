/**
 * Donut for a small partition (at most 3 parts), with the centre figure in HTML and the same
 * legend rules as SplitBar (every part, value, share). Reserved for the ledger: Tapua'i share
 * vs payouts within recorded gross (plus "Recorded gross not split" when they do not add up).
 * Server-Component safe.
 */
import { arcPath } from '../../lib/chartScale';

import { ChartFrame } from './ChartFrame';
import { chartColor, ChartNotice, isNum, LegendRow, show, type ChartFormat } from './shared';
import { splitModel, type SplitPart } from './SplitBar';

export type SplitRingProps = {
  title: string;
  /** Up to 3 parts of one whole. More than 3 is a design error: use SplitBar or HBarList. */
  parts: SplitPart[];
  format: ChartFormat;
  /** Small words in the ring centre, e.g. "Recorded gross". */
  centerLabel: string;
  /**
   * Formatted figure in the ring centre, e.g. "$1,240.00". Pass "—" when missing. The text shrinks
   * with its length to stay inside the hole; for large amounts pass a compact figure (e.g.
   * "$73.7K") and keep the full value in the legend, summary, and Data table.
   */
  centerValue: string;
  totalLabel?: string;
  caption?: string;
  source?: string;
  summary?: string;
  error?: string | null;
};

const SIZE = 148;
const R = 58;
const STROKE = 18;
// 2px separator expressed as a fraction of the ring's circumference.
const GAP_TURN = 2 / (2 * Math.PI * R);
// The hole inside the ring: inner radius R - STROKE/2 = 49px, so the centre text box is inset to it.
const HOLE_INSET = SIZE / 2 - (R - STROKE / 2);

/** Centre figure size by length, so "$73,734.50" fits the 98px hole without breaking. */
function centerSize(text: string): string {
  const length = text.length;
  if (length <= 7) return 'text-base leading-5';
  if (length <= 9) return 'text-sm leading-5';
  if (length <= 11) return 'text-xs leading-4';
  return 'text-[11px] leading-4';
}

/**
 * @purpose Ring partition with a centre figure and a full legend.
 * @param props See `SplitRingProps`.
 * @returns A `ChartFrame` figure.
 */
export function SplitRing({ title, parts, format, centerLabel, centerValue, totalLabel = 'Total', caption, source, summary, error }: SplitRingProps) {
  const model = splitModel(title, parts, format, totalLabel);
  const drawn = parts.filter((part) => isNum(part.value) && part.value > 0);
  const gap = drawn.length > 1 ? GAP_TURN : 0;
  let cursor = 0;
  const arcs = parts.map((part, index) => {
    if (!model.shares || !isNum(part.value) || part.value <= 0 || model.total <= 0) return null;
    const span = part.value / model.total;
    const start = cursor + gap / 2;
    const end = cursor + span - gap / 2;
    cursor += span;
    return { index, d: arcPath(SIZE / 2, SIZE / 2, R, start, Math.max(start + 0.001, end)), part };
  });

  return (
    <ChartFrame title={title} caption={caption} source={source} summary={summary ?? model.sentence} table={model.table} error={error}>
      {model.known.length === 0 ? (
        <ChartNotice kind="missing">This read did not include these numbers.</ChartNotice>
      ) : (
        <div className="flex flex-col items-center gap-5 @sm:flex-row @sm:items-center">
          <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg aria-hidden="true" focusable="false" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="block">
              <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--chart-track)" strokeWidth={STROKE} />
              {arcs.map((arc) =>
                arc && arc.d ? (
                  <path key={arc.index} className="chart-mark" d={arc.d} fill="none" stroke={chartColor(arc.part.color)} strokeWidth={STROKE}>
                    <title>{`${arc.part.label}: ${show(arc.part.value, format)} (${model.shareText(arc.index)})`}</title>
                  </path>
                ) : null,
              )}
            </svg>
            <div className="absolute flex flex-col items-center justify-center px-1 text-center" style={{ inset: HOLE_INSET }}>
              <span className={`chart-tabular ${centerSize(centerValue)} font-extrabold tracking-tight whitespace-nowrap text-[var(--ink)]`}>{centerValue}</span>
              <span className="mt-0.5 text-[10px] leading-3 font-bold text-[var(--text-muted)]">{centerLabel}</span>
            </div>
          </div>
          <ul className="flex w-full min-w-0 flex-col gap-2">
            {parts.map((part, index) => (
              <LegendRow key={`${part.label}-${index}`} color={part.color} label={part.label} value={show(part.value, format)} share={model.shareText(index)} />
            ))}
            {!model.shares ? <li className="text-xs text-[var(--text-muted)]">{totalLabel} is 0, so there are no shares.</li> : null}
          </ul>
        </div>
      )}
    </ChartFrame>
  );
}
