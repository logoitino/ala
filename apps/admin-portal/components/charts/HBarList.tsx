/**
 * Ranked horizontal bar list for leader lists (`leaders.*`, `tabs`, `features`, `issues`,
 * `scroll`). Each row prints rank, label, and the formatted value as text; the bar is extra.
 * Replaces PortalShell `BarRow` lists. HTML bars, no SVG needed. Server-Component safe.
 */
import { ChartFrame } from './ChartFrame';
import { chartColor, ChartNotice, isNum, show, type ChartColor, type ChartFormat, type ChartPoint } from './shared';

export type HBarListProps = {
  title: string;
  /** `null` = the list was not in this read. `[]` = read, but nothing in the window (shows `emptyText`). */
  rows: ChartPoint[] | null;
  format: ChartFormat;
  accent?: ChartColor;
  /** Rows drawn as bars. The rest stay in the Data table. Default 8. */
  limit?: number;
  /** Shown when `rows` is an empty list, e.g. "No donations in the last 7 days." */
  emptyText: string;
  source?: string;
  /** Short context under the title, e.g. "Last 7 days · minutes on each tab". */
  caption?: string;
  /** Replaces the generated summary sentence. */
  summary?: string;
  error?: string | null;
  /** Keep the caller's order instead of sorting by value (default false: largest first). */
  keepOrder?: boolean;
};

/**
 * @purpose Ranked `<ol>` of labelled bars, largest first.
 * @param props See `HBarListProps`.
 * @returns A `ChartFrame` figure.
 */
export function HBarList({ title, rows, format, accent = 'jade', limit = 8, emptyText, source, caption, summary, error, keepOrder = false }: HBarListProps) {
  const all = (rows ?? []).filter((row) => row.label.trim());
  const sorted = keepOrder ? all : [...all].sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.label.localeCompare(b.label));
  const shown = sorted.slice(0, Math.max(1, limit));
  const hidden = sorted.length - shown.length;
  const max = Math.max(0, ...sorted.map((row) => (isNum(row.value) ? row.value : 0))) || 1;
  const top = sorted.find((row) => isNum(row.value));
  const color = chartColor(accent);

  const sentence =
    summary ??
    (rows == null
      ? `${title}: this read did not include the list.`
      : sorted.length === 0
        ? `${title}: ${emptyText}`
        : top && (top.value as number) > 0
          ? `${title}: ${sorted.length} ${sorted.length === 1 ? 'row' : 'rows'}. ${top.label} leads at ${format(top.value as number)}.`
          : `${title}: ${sorted.length} ${sorted.length === 1 ? 'row' : 'rows'}, all at 0.`);

  const table = { columns: ['Rank', 'Name', 'Value'], rows: sorted.map((row, index) => [String(index + 1), row.label, show(row.value, format)]) };

  return (
    <ChartFrame title={title} caption={caption} source={source} summary={sentence} table={table} error={error}>
      {rows == null ? (
        <ChartNotice kind="missing">This read did not include the list.</ChartNotice>
      ) : sorted.length === 0 ? (
        <ChartNotice kind="empty">{emptyText}</ChartNotice>
      ) : (
        <>
          <ol className="flex flex-col gap-3">
            {shown.map((row, index) => {
              const pct = isNum(row.value) ? Math.max(0, Math.min(100, (row.value / max) * 100)) : 0;
              return (
                <li key={`${row.label}-${index}`} className="min-w-0">
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="chart-tabular w-5 shrink-0 text-right text-xs font-bold text-[var(--text-muted)]">{index + 1}</span>
                    <span className="min-w-0 flex-1 break-words text-[var(--ink-soft)]">{row.label}</span>
                    <span className={`chart-tabular shrink-0 font-extrabold ${isNum(row.value) ? 'text-[var(--ink)]' : 'text-[var(--text-muted)]'}`}>
                      {show(row.value, format)}
                    </span>
                  </div>
                  <div aria-hidden="true" className="mt-1.5 ml-7 h-2 overflow-hidden rounded-full bg-[var(--chart-track)]">
                    {isNum(row.value) ? (
                      <div
                        className="chart-mark h-full rounded-full"
                        style={{ width: row.value > 0 ? `max(${pct}%, 4px)` : '2px', background: row.value > 0 ? color : 'var(--chart-muted)' }}
                        title={`${row.label}: ${format(row.value)}`}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
          {hidden > 0 ? <p className="mt-3 ml-7 text-xs text-[var(--text-muted)]">{hidden} more in the Data table.</p> : null}
        </>
      )}
    </ChartFrame>
  );
}
