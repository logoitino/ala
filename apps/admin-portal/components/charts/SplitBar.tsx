/**
 * Total labels wrap beside money values so open report figures fit enlarged phone text.
 * One 100% bar split into parts, with 2px `--chart-gap` separators and a legend that lists every
 * part (zero parts too) with its value and share. Use only when the parts are a real partition
 * of one whole (clip mix, Seki/Aura/Flex, live vs parked games, menus on/off).
 * Shares come from `sharesTo100`, so the legend always adds to 100. Server-Component safe.
 */
import { sharesTo100 } from '../../lib/chartScale';

import { ChartFrame } from './ChartFrame';
import { chartColor, ChartNotice, isNum, LegendRow, MISSING, show, type ChartColor, type ChartFormat } from './shared';

export type SplitPart = { label: string; value: number | null; color: ChartColor };

export type SplitBarProps = {
  title: string;
  parts: SplitPart[];
  format: ChartFormat;
  /** Words before the total, e.g. "Clips live". Default "Total". */
  totalLabel?: string;
  caption?: string;
  source?: string;
  summary?: string;
  error?: string | null;
};

/** Shared summary + table + share maths for SplitBar and SplitRing. */
export function splitModel(title: string, parts: SplitPart[], format: ChartFormat, totalLabel: string) {
  const known = parts.filter((part) => isNum(part.value));
  const shares = sharesTo100(parts.map((part) => part.value));
  const total = known.reduce((sum, part) => sum + Math.max(0, part.value as number), 0);
  const missingCount = parts.length - known.length;
  const shareText = (index: number) => (shares && isNum(parts[index].value) ? `${shares[index]}%` : MISSING);
  let sentence: string;
  if (known.length === 0) sentence = `${title}: this read did not include these numbers.`;
  else if (!shares) sentence = `${title}: ${totalLabel.toLowerCase()} is 0, so there are no shares.`;
  else {
    const lead = parts
      .map((part, index) => ({ part, share: shares[index] }))
      .filter(({ part }) => isNum(part.value))
      .map(({ part, share }) => `${part.label} ${share}% (${format(part.value as number)})`)
      .join(', ');
    sentence = `${title}: ${lead}. ${totalLabel} ${format(total)}.`;
  }
  if (missingCount > 0 && known.length > 0) sentence += ` ${missingCount} ${missingCount === 1 ? 'part is' : 'parts are'} not in this read, so shares use the rest.`;
  const table = {
    columns: ['Part', 'Value', 'Share'],
    rows: known.length ? [...parts.map((part, index) => [part.label, show(part.value, format), shareText(index)]), [totalLabel, format(total), shares ? '100%' : MISSING]] : [],
  };
  return { known, shares, total, sentence, table, shareText };
}

/**
 * @purpose Horizontal 100% partition bar with a full legend.
 * @param props See `SplitBarProps`.
 * @returns A `ChartFrame` figure.
 */
export function SplitBar({ title, parts, format, totalLabel = 'Total', caption, source, summary, error }: SplitBarProps) {
  const model = splitModel(title, parts, format, totalLabel);

  return (
    <ChartFrame title={title} caption={caption} source={source} summary={summary ?? model.sentence} table={model.table} error={error}>
      {model.known.length === 0 ? (
        <ChartNotice kind="missing">This read did not include these numbers.</ChartNotice>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full"
            style={{ background: model.shares ? 'var(--chart-gap)' : 'var(--chart-track)' }}
          >
            {model.shares
              ? parts.map((part, index) =>
                  isNum(part.value) && part.value > 0 ? (
                    <div
                      key={`${part.label}-${index}`}
                      className="chart-mark h-full"
                      style={{ flexGrow: part.value, flexBasis: 0, minWidth: 3, background: chartColor(part.color) }}
                      title={`${part.label}: ${format(part.value)} (${model.shareText(index)})`}
                    />
                  ) : null,
                )
              : null}
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {parts.map((part, index) => (
              <LegendRow key={`${part.label}-${index}`} color={part.color} label={part.label} value={show(part.value, format)} share={model.shareText(index)} />
            ))}
          </ul>
          <p className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--border)] pt-2 text-sm">
            <span className="text-[var(--text-muted)]">{totalLabel}</span>
            <span className="chart-tabular shrink-0 whitespace-nowrap font-extrabold text-[var(--ink)]">{format(model.total)}</span>
          </p>
        </>
      )}
    </ChartFrame>
  );
}
