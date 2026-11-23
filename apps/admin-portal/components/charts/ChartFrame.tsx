/** UX-15 aligns existing report chrome with current Daylight cards while preserving report/card props, chart summaries, source disclosures and error alternatives. */
/** UX-13 readable controls preserve all consent, money and operator actions.
 * Card wrapper for every chart in the admin portal chart kit. Renders the figure, the title,
 * a visible one-sentence summary, the plot, and a "Data" disclosure holding every plotted value
 * and the source key. The source always sits inside that disclosure (named "Source" when there
 * are no rows to show), so it is disclosed the same way on every card. The plot itself is
 * aria-hidden, so the summary and table must be complete.
 * Report presentation is the default on every page: current Daylight card chrome keeps
 * the title, summary, source and table. Card presentation stays available for embedding. Report mode tags its title
 * `portal-chart-title` and its Data block `portal-chart-data`, so a page can style them by class
 * rather than by child position (Home's lead charts colour the title in `globals.css`).
 * Server-Component safe: the Data toggle is a native <details>, no client JS.
 */
import { Fragment, useId, type ReactNode } from 'react';

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
  /** Where the numbers come from, e.g. `get_admin_reports.series.malo`. Small mono text inside the Data disclosure. */
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
  /**
   * How the figure sits on the page. `'report'` (default): on the
   * Daylight surface with the report title and source hooks. `'card'`: bordered white card
   * with a shadow, for a chart embedded inside another surface. Both keep the summary and Data table.
   */
  presentation?: 'card' | 'report';
};

/**
 * @purpose Figure + caption + summary + source + plot + Data table for one chart.
 * @param props See `ChartFrameProps`.
 * @returns A `<figure>`: report card by default, or embedded card.
 */
export function ChartFrame({ title, caption, source, summary, table, headline, error, children, className, presentation = 'report' }: ChartFrameProps) {
  // A failed read shows no values anywhere, so the summary and Data table cannot contradict the error.
  const rows = error ? 0 : table.rows.length;
  // Chrome does not name a figure from its figcaption, so the title is also wired by id.
  // useId is safe in Server Components (react-server exports it).
  const titleId = useId();
  return (
    <figure
      aria-labelledby={titleId}
      className={`@container m-0 flex min-w-0 flex-col ${presentation === 'report' ? 'portal-chart rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5' : 'rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5'} ${className ?? ''}`}
      style={presentation === 'card' ? { boxShadow: 'var(--shadow-card)' } : undefined}
    >
      {/* figcaption must be a direct child of figure (HTML content model). */}
      <figcaption className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p id={titleId} className={presentation === 'report' ? 'portal-chart-title text-sm font-extrabold tracking-tight text-[var(--ink)]' : 'text-sm font-extrabold tracking-tight text-[var(--ink)]'}>
            {title}
          </p>
          {caption && presentation === 'card' ? <p className="mt-0.5 text-xs text-[var(--text-muted)]">{caption}</p> : null}
        </div>
        {caption && presentation === 'report' ? <p className="text-xs text-[var(--text-muted)]">{caption}</p> : null}
        {headline ? <div className="ml-auto shrink-0 text-right">{headline}</div> : null}
      </figcaption>
      <p className="mt-2 text-sm leading-5 text-[var(--ink-soft)]">{error ? `${title}: the read failed, so no values are shown.` : summary}</p>
      <div className={`min-w-0 ${presentation === 'report' ? 'mt-3 mb-2' : 'mt-4 mb-4'}`}>{error ? <ChartNotice kind="error">{error}</ChartNotice> : children}</div>
      {source || rows > 0 ? (
        <div className={presentation === 'report' ? 'portal-chart-data mt-auto pt-1' : 'mt-auto border-t border-[var(--border)] pt-3'}>
          <DataTable title={title} table={table} rows={rows} source={source} />
        </div>
      ) : null}
    </figure>
  );
}

/**
 * Source keys wrap only at their own boundaries (after ".", ",", "·", "{", "[" and spaces), never
 * inside an identifier like `gross_volume_cents`. A single identifier wider than the card still
 * wraps as a last resort (break-words) rather than pushing the page sideways.
 */
function SourceText({ source }: { source: string }) {
  const parts = source.split(/(?<=[.,·{[])/);
  return (
    <p className="mt-2 min-w-0 font-mono text-[12px] leading-5 break-words text-[var(--text-muted)]">
      <span className="font-sans font-bold">Source: </span>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? <wbr /> : null}
          {part}
        </Fragment>
      ))}
    </p>
  );
}

function DataTable({ title, table, rows, source }: { title: string; table: ChartTable; rows: number; source?: string }) {
  const label = rows > 0 ? 'Data' : 'Source';
  return (
    <details className="chart-disclosure group w-full min-w-0">
      <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-extrabold text-[var(--ink-soft)] select-none hover:bg-[var(--surface-muted)]">
        <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12" className="chart-disclosure-icon size-3">
          <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label}
        <span className="sr-only"> for {title}</span>
      </summary>
      {rows > 0 ? (
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
      ) : null}
      {source ? <SourceText source={source} /> : null}
    </details>
  );
}
