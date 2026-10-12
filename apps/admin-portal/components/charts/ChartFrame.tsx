/**
 * Card wrapper for every chart in the admin portal chart kit. Renders the figure, the title,
 * a visible one-sentence summary, the source key, the plot, and a "Data" table holding every
 * plotted value. The plot itself is aria-hidden, so the summary and table must be complete.
 * Server-Component safe: the Data toggle is a native <details>, no client JS.
 */
import { useId, type ReactNode } from 'react';

import { ChartNotice } from './shared';

export type ChartTable = {
  /** Column headings. The first column holds the row label and is a row header. */
  columns: string[];
  rows: string[][];
};

export type ChartFrameProps = {
  title: string;
  /** Short context under the title, e.g. "Last 7 days, UTC". */
  caption?: string;
  /** Where the numbers come from, e.g. `get_admin_reports.series.malo`. Shown in small mono text. */
  source?: string;
  /** One visible sentence that says what the chart shows. Required: it is the text alternative. */
  summary: string;
  /** Every plotted value. Omitted from the page when it has no rows. */
  table: ChartTable;
  /** Optional headline figure on the right of the title (e.g. a 7-day total). */
  headline?: ReactNode;
  /** A failed read. Replaces the plot with the error notice, replaces the summary, and hides the Data table. */
  error?: string | null;
  children?: ReactNode;
  className?: string;
};

/**
 * @purpose Figure + caption + summary + source + plot + Data table for one chart.
 * @param props See `ChartFrameProps`.
 * @returns A `<figure>` card.
 */
export function ChartFrame({ title, caption, source, summary, table, headline, error, children, className }: ChartFrameProps) {
  // A failed read shows no values anywhere, so the summary and Data table cannot contradict the error.
  const rows = error ? 0 : table.rows.length;
  // Chrome does not name a figure from its figcaption, so the title is also wired by id.
  // useId is safe in Server Components (react-server exports it).
  const titleId = useId();
  return (
    <figure
      aria-labelledby={titleId}
      className={`@container m-0 flex min-w-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 ${className ?? ''}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {/* figcaption must be a direct child of figure (HTML content model). */}
      <figcaption className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p id={titleId} className="text-sm font-extrabold tracking-tight text-[var(--ink)]">
            {title}
          </p>
          {caption ? <p className="mt-0.5 text-xs text-[var(--text-muted)]">{caption}</p> : null}
        </div>
        {headline ? <div className="ml-auto shrink-0 text-right">{headline}</div> : null}
      </figcaption>
      <p className="mt-2 text-sm leading-5 text-[var(--ink-soft)]">{error ? `${title}: the read failed, so no values are shown.` : summary}</p>
      <div className="mt-4 mb-4 min-w-0">{error ? <ChartNotice kind="error">{error}</ChartNotice> : children}</div>
      {(source || rows > 0) && (
        <div className="mt-auto flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-t border-[var(--border)] pt-3">
          {source ? (
            <p className="min-w-0 break-all font-mono text-[11px] leading-6 text-[var(--text-muted)]">
              <span className="sr-only">Source: </span>
              {source}
            </p>
          ) : (
            <span />
          )}
          {rows > 0 ? <DataTable title={title} table={table} /> : null}
        </div>
      )}
    </figure>
  );
}

function DataTable({ title, table }: { title: string; table: ChartTable }) {
  return (
    <details className="chart-disclosure group w-full min-w-0 sm:w-auto sm:max-w-full open:w-full sm:open:w-full">
      <summary className="ml-auto inline-flex min-h-6 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-extrabold text-[var(--ink-soft)] select-none hover:bg-[var(--surface-muted)]">
        <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12" className="chart-disclosure-icon size-3">
          <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Data
        <span className="sr-only"> for {title}</span>
      </summary>
      <div className="mt-2 max-w-full overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="chart-tabular w-full border-collapse text-left text-xs">
          <caption className="sr-only">{title}: every plotted value</caption>
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              {table.columns.map((column, index) => (
                <th key={`${column}-${index}`} scope="col" className={`px-3 py-2 font-extrabold text-[var(--ink-soft)] ${index > 0 ? 'text-right' : ''}`}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-[var(--border)]">
                {row.map((cell, cellIndex) =>
                  cellIndex === 0 ? (
                    <th key={cellIndex} scope="row" className="px-3 py-1.5 font-bold text-[var(--ink)]">
                      {cell}
                    </th>
                  ) : (
                    <td key={cellIndex} className="px-3 py-1.5 text-right whitespace-nowrap text-[var(--ink)]">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
