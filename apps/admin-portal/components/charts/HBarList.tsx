/**
 * Ranked horizontal bar list for leader lists (`leaders.*`, `tabs`, `features`, `issues`,
 * `scroll`). Each row prints rank, label, and the formatted value as text; the bar is extra.
 * With `keepOrder` the list is in the caller's order, not a ranking: no rank numbers, no
 * "leads" sentence, and the summary names the largest row by value instead.
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
  /**
   * Keep the caller's order instead of sorting by value (default false: largest first). The list
   * is then not a ranking: rank numbers and the "leads" sentence are dropped.
   */
  keepOrder?: boolean;
};

/** "A", "A and B", "A, B and C": the rows tied at the largest value. */
function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * @purpose Ranked `<ol>` of labelled bars, largest first (or a plain `<ul>` in the caller's order).
 * @param props See `HBarListProps`.
 * @returns A `ChartFrame` figure.
 */
export function HBarList({ title, rows, format, accent = 'jade', limit = 8, emptyText, source, caption, summary, error, keepOrder = false }: HBarListProps) {
  const all = (rows ?? []).filter((row) => row.label.trim());
  const sorted = keepOrder ? all : [...all].sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.label.localeCompare(b.label));
  const shown = sorted.slice(0, Math.max(1, limit));
  const hidden = sorted.length - shown.length;
  const max = Math.max(0, ...sorted.map((row) => (isNum(row.value) ? row.value : 0))) || 1;
  const known = sorted.filter((row) => isNum(row.value));
  // Largest value computed from every row, so it is honest whether or not the list is sorted.
  const peak = known.length ? Math.max(...known.map((row) => row.value as number)) : null;
  const atPeak = peak != null ? known.filter((row) => row.value === peak).map((row) => row.label) : [];
  const color = chartColor(accent);
  const count = `${sorted.length} ${sorted.length === 1 ? 'row' : 'rows'}`;
  const missingCount = sorted.length - known.length;
  const missingText = missingCount > 0 ? ` ${missingCount} not in this read.` : '';

  const sentence =
    summary ??
    (rows == null
      ? `${title}: this read did not include the list.`
      : sorted.length === 0
        ? `${title}: ${emptyText}`
        : peak == null
          ? `${title}: ${count}, none in this read.`
          : peak > 0
            ? keepOrder
              ? `${title}: ${count}. Largest: ${joinNames(atPeak)} at ${format(peak)}.${missingText}`
              : atPeak.length > 1
                ? `${title}: ${count}. ${joinNames(atPeak)} tie for the lead at ${format(peak)}.${missingText}`
                : `${title}: ${count}. ${atPeak[0]} leads at ${format(peak)}.${missingText}`
            : `${title}: ${count}, all at 0.${missingText}`);

  const table = keepOrder
    ? { columns: ['Name', 'Value'], rows: sorted.map((row) => [row.label, show(row.value, format)]) }
    : { columns: ['Rank', 'Name', 'Value'], rows: sorted.map((row, index) => [String(index + 1), row.label, show(row.value, format)]) };
  const List = keepOrder ? 'ul' : 'ol';
  // Bars line up under the label: past the rank column when ranked, flush when not.
  const indent = keepOrder ? '' : 'ml-7';

  return (
    <ChartFrame title={title} caption={caption} source={source} summary={sentence} table={table} error={error}>
      {rows == null ? (
        <ChartNotice kind="missing">This read did not include the list.</ChartNotice>
      ) : sorted.length === 0 ? (
        <ChartNotice kind="empty">{emptyText}</ChartNotice>
      ) : (
        <>
          <List className="flex flex-col gap-3">
            {shown.map((row, index) => {
              const pct = isNum(row.value) ? Math.max(0, Math.min(100, (row.value / max) * 100)) : 0;
              return (
                <li key={`${row.label}-${index}`} className="min-w-0">
                  {/* The row wraps: when label (at least 8rem) and value do not fit, the value drops to its own
                      line, right-aligned, instead of squeezing the label to one character per line. */}
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                    {keepOrder ? null : <span className="chart-tabular w-5 shrink-0 text-right text-xs font-bold text-[var(--text-muted)]">{index + 1}</span>}
                    <span className="min-w-0 flex-1 basis-[8rem] break-words text-[var(--ink-soft)]">{row.label}</span>
                    <span className={`chart-tabular ml-auto shrink-0 font-extrabold whitespace-nowrap ${isNum(row.value) ? 'text-[var(--ink)]' : 'text-[var(--text-muted)]'}`}>
                      {show(row.value, format)}
                    </span>
                  </div>
                  <div aria-hidden="true" className={`mt-1.5 ${indent} h-2 overflow-hidden rounded-full bg-[var(--chart-track)]`}>
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
          </List>
          {hidden > 0 ? <p className={`mt-3 ${indent} text-xs text-[var(--text-muted)]`}>{hidden} more in the Data table.</p> : null}
        </>
      )}
    </ChartFrame>
  );
}
