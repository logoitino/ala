/**
 * KPI tile for admin portal dashboards: label, big value, optional week-over-week delta,
 * optional 7-day sparkline, and a hint. Deltas use `weekChange` from `lib/dashboard.ts` and are
 * printed as glyph + sign + words, never colour alone. The open value block and bottom divider
 * match Home so desk grids read as one report rather than repeated floating cards (report format
 * is the default on every page, owner decision 2026-10-12). The value never wraps mid-figure
 * (`whitespace-nowrap`); phones use a smaller display size so enlarged whole-money values fit.
 * The label and hint wrap at word boundaries. Only the two measures with a
 * prior week (clips_7d and malo_cents_7d) may pass `delta`. Server-Component safe.
 */
import { weekChange } from '../../lib/dashboard';

import { Sparkline } from './Sparkline';
import { MISSING, MISSING_TEXT, show, SrOnly, type ChartColor, type ChartFormat, type ChartPoint } from './shared';

export type StatTone = 'neutral' | 'ok' | 'warn' | 'danger';

export type StatTileProps = {
  label: string;
  /** Already formatted value. Ignored when `missing` is true. */
  value: string;
  hint?: string;
  tone?: StatTone;
  /** The key was not in this read: shows "—" and "Not in this read". */
  missing?: boolean;
  /** This week vs the prior week. Null or absent: no delta line. */
  delta?: { current: number; previous: number } | null;
  /** Which way is good. Drives the "better"/"worse" word and the delta colour. Default 'up'. */
  goodDirection?: 'up' | 'down' | 'none';
  /** Decorative 7-day line; its days are repeated as screen-reader text. */
  spark?: { points: ChartPoint[]; format: ChartFormat; accent?: ChartColor };
};

const TONE_DOT: Record<StatTone, string> = {
  neutral: 'var(--chart-grid)',
  ok: 'var(--jade)',
  warn: 'var(--gold)',
  danger: 'var(--ember)',
};

// Tone is never colour alone: warn and danger swap the dot for a "!" badge and add a word for screen readers.
const TONE_WORD: Record<StatTone, string | null> = {
  neutral: null,
  ok: null,
  warn: 'Warning: ',
  danger: 'Problem: ',
};

const TONE_HINT: Record<StatTone, string> = {
  neutral: 'text-[var(--text-muted)]',
  ok: 'text-[var(--text-muted)]',
  warn: 'text-[var(--gold)]',
  danger: 'text-[var(--ember)]',
};

function DeltaLine({ current, previous, goodDirection }: { current: number; previous: number; goodDirection: 'up' | 'down' | 'none' }) {
  if (!(previous > 0)) {
    return <p className="text-xs font-bold text-[var(--text-muted)]">No prior week to compare</p>;
  }
  const change = weekChange(current, previous);
  const percent = change.percent ?? 0;
  if (change.tone === 'flat') {
    return (
      <p className="text-xs font-bold text-[var(--ink-soft)]">
        <span aria-hidden="true">● </span>Flat versus the prior week
      </p>
    );
  }
  const up = change.tone === 'up';
  const good = goodDirection === 'none' ? null : (goodDirection === 'up') === up;
  const color = good == null ? 'text-[var(--ink-soft)]' : good ? 'text-[var(--jade)]' : 'text-[var(--ember)]';
  return (
    <p className={`chart-tabular text-xs font-extrabold ${color}`}>
      <span aria-hidden="true">{up ? '▲' : '▼'} </span>
      {up ? '+' : '−'}
      {Math.abs(percent)}% <span className="font-bold">versus the prior week</span>
      {good == null ? null : <span className="font-bold text-[var(--text-muted)]"> · {good ? 'better' : 'worse'}</span>}
    </p>
  );
}

/**
 * @purpose One open KPI value block. Missing, zero, and a value all look different.
 * @param props See `StatTileProps`.
 * @returns An open value `<div>`; the page decides the grid.
 */
export function StatTile({ label, value, hint, tone = 'neutral', missing = false, delta, goodDirection = 'up', spark }: StatTileProps) {
  const sparkText =
    spark && spark.points.length > 0
      ? `${spark.points.length} days: ${spark.points.map((point) => `${point.label} ${show(point.value, spark.format)}`).join(', ')}.`
      : null;

  return (
    <div className="portal-stat flex min-w-0 flex-col gap-2 border-b border-[var(--border)] py-4">
      <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.08em] text-[var(--text-muted)] uppercase">
        {TONE_WORD[tone] ? (
          <span aria-hidden="true" className="grid size-3.5 shrink-0 place-items-center rounded-full text-[9px] leading-none font-black text-white" style={{ background: TONE_DOT[tone] }}>
            !
          </span>
        ) : (
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: TONE_DOT[tone] }} />
        )}
        <span className="min-w-0 break-words">
          {TONE_WORD[tone] ? <SrOnly>{TONE_WORD[tone]}</SrOnly> : null}
          {label}
        </span>
      </p>
      {/* The value is one unbroken figure: "$12,345.67" must never split across lines. At enlarged
          text the sparkline drops below it instead of forcing the grid wider than the viewport. */}
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <p className={`chart-tabular min-w-0 text-xl leading-tight font-black tracking-tight whitespace-nowrap min-[400px]:text-3xl ${missing ? 'text-[var(--text-muted)]' : 'text-[var(--ink)]'}`}>
          {missing ? MISSING : value}
        </p>
        {!missing && spark && spark.points.length > 0 ? (
          <div className="mb-1 hidden shrink-0 min-[360px]:block">
            <Sparkline points={spark.points} accent={spark.accent ?? 'jade'} />
          </div>
        ) : null}
      </div>
      {!missing && delta ? <DeltaLine current={delta.current} previous={delta.previous} goodDirection={goodDirection} /> : null}
      {missing ? (
        <p className="text-xs text-[var(--text-muted)]">{MISSING_TEXT}</p>
      ) : hint ? (
        <p className={`text-xs leading-4 ${TONE_HINT[tone]}`}>{hint}</p>
      ) : null}
      {!missing && sparkText ? <SrOnly>{sparkText}</SrOnly> : null}
    </div>
  );
}
