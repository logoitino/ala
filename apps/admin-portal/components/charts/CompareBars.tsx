/**
 * Two horizontal bars, current vs previous, with the previous one in `--chart-muted` and a
 * plain sentence. By default the sentence is `weekSentence` from `lib/dashboard.ts`, which is
 * only true for the two real prior-week pairs (clips_7d / clips_prev_7d and malo_cents_7d /
 * malo_cents_prev_7d). Any other comparison must pass its own `sentence`. Server-Component safe.
 */
import { weekChange, weekSentence } from '../../lib/dashboard';

import { ChartFrame } from './ChartFrame';
import { chartColor, ChartNotice, isNum, show, type ChartColor, type ChartFormat } from './shared';

export type CompareSide = { label: string; value: number | null };

export type CompareBarsProps = {
  title: string;
  current: CompareSide;
  previous: CompareSide;
  format: ChartFormat;
  /** Colour of the current bar. Default jade. The previous bar is always `muted`. */
  accent?: ChartColor;
  /** Noun for the default sentence ("Clips uploaded", "Donations"). Defaults to `title`. */
  subject?: string;
  /** Replaces the week sentence. Required for anything that is not a prior-week pair (e.g. 24h vs 7-day average). */
  sentence?: string;
  caption?: string;
  source?: string;
  error?: string | null;
};

/**
 * @purpose Current vs previous, as two labelled bars plus one sentence.
 * @param props See `CompareBarsProps`.
 * @returns A `ChartFrame` figure.
 */
export function CompareBars({ title, current, previous, format, accent = 'jade', subject, sentence, caption, source, error }: CompareBarsProps) {
  const both = isNum(current.value) && isNum(previous.value);
  const text =
    sentence ??
    (both
      ? weekSentence(subject ?? title, weekChange(current.value as number, previous.value as number), format)
      : `${subject ?? title}: one side of this comparison is not in this read, so there is no change to report.`);
  const max = Math.max(isNum(current.value) ? current.value : 0, isNum(previous.value) ? previous.value : 0);
  const rows: { side: CompareSide; color: string; muted: boolean }[] = [
    { side: current, color: chartColor(accent), muted: false },
    { side: previous, color: chartColor('muted'), muted: true },
  ];
  const table = {
    columns: ['Period', 'Value'],
    rows: isNum(current.value) || isNum(previous.value) ? rows.map(({ side }) => [side.label, show(side.value, format)]) : [],
  };

  return (
    <ChartFrame title={title} caption={caption} source={source} summary={text} table={table} error={error}>
      {!isNum(current.value) && !isNum(previous.value) ? (
        <ChartNotice kind="missing">This read did not include either number.</ChartNotice>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ side, color, muted }) => {
            const pct = isNum(side.value) && max > 0 ? (side.value / max) * 100 : 0;
            return (
              <li key={side.label} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className={`min-w-0 break-words ${muted ? 'text-[var(--text-muted)]' : 'font-bold text-[var(--ink)]'}`}>{side.label}</span>
                  <span className={`chart-tabular shrink-0 font-extrabold ${isNum(side.value) ? 'text-[var(--ink)]' : 'text-[var(--text-muted)]'}`}>{show(side.value, format)}</span>
                </div>
                <div aria-hidden="true" className="mt-1.5 h-3 overflow-hidden rounded-full bg-[var(--chart-track)]">
                  {isNum(side.value) ? (
                    <div
                      className="chart-mark h-full rounded-full"
                      style={{ width: side.value > 0 ? `max(${pct}%, 4px)` : '2px', background: side.value > 0 ? color : 'var(--chart-muted)' }}
                      title={`${side.label}: ${format(side.value)}`}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ChartFrame>
  );
}
