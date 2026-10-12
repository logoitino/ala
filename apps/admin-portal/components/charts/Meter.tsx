/**
 * Part-of-a-whole meter (e.g. verified profiles / all profiles). Percent comes from
 * `sharePercent` in `lib/dashboard.ts`. A whole of 0 or null prints "—" and "No denominator in
 * this read"; a missing part prints "—" and "Not in this read". Text carries the meaning; the
 * bar is aria-hidden. Server-Component safe.
 */
import { sharePercent } from '../../lib/dashboard';

import { chartColor, isNum, MISSING, MISSING_TEXT, show, type ChartColor, type ChartFormat } from './shared';

export type MeterProps = {
  label: string;
  part: number | null;
  whole: number | null;
  format: ChartFormat;
  /** Short context under the numbers, e.g. "Verified profiles of all profiles". */
  hint?: string;
  accent?: ChartColor;
  source?: string;
};

/**
 * @purpose Big percent, "part of whole" in words, and a single bar.
 * @param props See `MeterProps`.
 * @returns A card `<div>`.
 */
export function Meter({ label, part, whole, format, hint, accent = 'jade', source }: MeterProps) {
  const noWhole = !isNum(whole) || whole <= 0;
  const noPart = !isNum(part);
  const pct = noWhole || noPart ? null : sharePercent(part as number, whole as number);
  const status = noWhole ? 'No denominator in this read' : noPart ? MISSING_TEXT : `${show(part, format)} of ${show(whole, format)}`;
  const fill = pct == null ? 0 : Math.min(100, Math.max(0, pct));

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="text-[11px] font-extrabold tracking-[0.08em] text-[var(--text-muted)] uppercase">{label}</p>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className={`chart-tabular text-2xl leading-8 font-extrabold tracking-tight ${pct == null ? 'text-[var(--text-muted)]' : 'text-[var(--ink)]'}`}>
          {pct == null ? MISSING : `${pct}%`}
        </p>
        <p className="chart-tabular text-sm text-[var(--ink-soft)]">{status}</p>
      </div>
      <div aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-[var(--chart-track)]">
        {pct != null ? (
          <div
            className="chart-mark h-full rounded-full"
            style={{ width: pct > 0 ? `max(${fill}%, 4px)` : '2px', background: pct > 0 ? chartColor(accent) : 'var(--chart-muted)' }}
          />
        ) : null}
      </div>
      {hint ? <p className="text-xs leading-4 text-[var(--text-muted)]">{hint}</p> : null}
      {source ? (
        <p className="font-mono text-[11px] break-all text-[var(--text-muted)]">
          <span className="sr-only">Source: </span>
          {source}
        </p>
      ) : null}
    </div>
  );
}
