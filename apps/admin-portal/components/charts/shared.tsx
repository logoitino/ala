/**
 * Wrapping money legends keep value/share text on the report surface at enlarged phone text.
 * Shared pieces for the admin chart kit: the colour names, the state notices (missing, empty,
 * error), the legend swatch, and the visually hidden text helper. Server-Component safe: no
 * hooks, no 'use client', no next/* imports. Pages import from `components/charts`, not this file.
 */
import type { ReactNode } from 'react';

/** Chart colours. Maps to the `--chart-*` tokens in `app/globals.css`. `bad` is only for stalls, errors, and failures. */
export type ChartColor = 'jade' | 'cyan' | 'gold' | 'violet' | 'bad' | 'muted';

/** One labelled value. `null` means "not in this read", which is not the same as 0. */
export type ChartPoint = { label: string; value: number | null };

/** Formats a raw value (count, cents, ms) for display. Called only with real numbers, never null. */
export type ChartFormat = (value: number) => string;

const COLOR_VAR: Record<ChartColor, string> = {
  jade: 'var(--chart-1)',
  cyan: 'var(--chart-2)',
  gold: 'var(--chart-3)',
  violet: 'var(--chart-4)',
  bad: 'var(--chart-bad)',
  muted: 'var(--chart-muted)',
};

/** CSS colour for a chart colour name. */
export function chartColor(color: ChartColor = 'jade'): string {
  return COLOR_VAR[color] ?? COLOR_VAR.jade;
}

export const MISSING = '—';
export const MISSING_TEXT = 'Not in this read';

/** Formats a value, or returns the em dash when it is missing. */
export function show(value: number | null | undefined, format: ChartFormat): string {
  return typeof value === 'number' && Number.isFinite(value) ? format(value) : MISSING;
}

export function isNum(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Text that a screen reader reads but the page does not show. */
export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

export type NoticeKind = 'missing' | 'empty' | 'error';

/**
 * @purpose The three non-data states, each with its own look and words so they are never confused
 *   with a real zero: missing (dashed, "Not in this read"), empty (quiet, the caller's empty text),
 *   error (ember tint, "!" glyph, "Could not read").
 */
export function ChartNotice({ kind, children }: { kind: NoticeKind; children?: ReactNode }) {
  if (kind === 'error') {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-xl border border-[var(--ember)]/30 bg-[var(--ember-soft)] px-3 py-3 text-sm text-[var(--ember)]"
      >
        <span aria-hidden="true" className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-[var(--ember)] text-[11px] font-black text-white">
          !
        </span>
        <span>
          <span className="font-extrabold">Could not read. </span>
          {children}
        </span>
      </div>
    );
  }
  if (kind === 'missing') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-sm text-[var(--text-muted)]">
        <span aria-hidden="true" className="text-base font-extrabold text-[var(--ink-soft)]">
          {MISSING}
        </span>
        <span>{children ?? `${MISSING_TEXT}.`}</span>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-4 text-sm text-[var(--text-muted)]">{children ?? 'Nothing to show in this window.'}</div>
  );
}

/** Small colour key. Never the only carrier of meaning: the legend row always prints its label and value. */
export function Swatch({ color }: { color: ChartColor }) {
  return <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: chartColor(color) }} />;
}

/** Legend row shared by SplitBar, SplitRing, and StackedBars. */
export function LegendRow({
  color,
  label,
  value,
  share,
}: {
  color: ChartColor;
  label: string;
  value: string;
  share?: string | null;
}) {
  return (
    <li className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
      <Swatch color={color} />
      <span className="min-w-0 flex-1 basis-[8rem] break-words text-[var(--ink-soft)]">{label}</span>
      <span className="chart-tabular ml-auto flex min-w-0 max-w-full flex-wrap items-baseline justify-end gap-x-3 gap-y-1">
        <span className="min-w-0 break-words font-extrabold text-[var(--ink)]">{value}</span>
        {share != null ? <span className="w-11 shrink-0 text-right text-xs font-bold text-[var(--text-muted)]">{share}</span> : null}
      </span>
    </li>
  );
}
