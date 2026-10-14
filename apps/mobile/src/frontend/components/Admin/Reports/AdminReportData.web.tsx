/** Expo web Data disclosure uses real table/caption/header semantics and native details keyboard
 * behavior. It shares the same data contract as the native row presentation, with no extra login. */
import type { AdminReportDataProps } from './AdminReportData';
import { REPORT_FONT, REPORT_INK as c } from './reportStyles';

/** @purpose Accessible complete data table whose scrolling stays inside the report figure. */
export function AdminReportData({ title, table, source, initiallyOpen = false }: AdminReportDataProps) {
  const label = table.rows.length ? 'Data' : 'Source';
  return <details open={initiallyOpen || undefined} style={{ width: '100%', minWidth: 0, color: c.soft, fontFamily: REPORT_FONT, fontSize: 12 }}>
    <summary role="button" aria-label={`${label} for ${title}`} style={{ cursor: 'pointer', minHeight: 44, minWidth: 44, padding: '12px 8px', fontWeight: 800, width: 'fit-content' }}>{label}</summary>
    {table.rows.length ? <div style={{ overflowX: 'auto', maxWidth: '100%', border: `1px solid ${c.border}`, borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>
        <caption style={{ textAlign: 'left', padding: 10, fontWeight: 700 }}>{title}: every value</caption>
        <thead style={{ background: c.mutedSurface }}><tr>{table.columns.map((column, i) => <th key={`${column}-${i}`} scope="col" style={{ padding: '10px 12px', fontWeight: 800 }}>{column}</th>)}</tr></thead>
        <tbody>{table.rows.map((row, at) => <tr key={at} style={{ borderTop: `1px solid ${c.border}` }}>{row.map((value, i) => i === 0
          ? <th key={i} scope="row" style={{ padding: '10px 12px', fontWeight: 700 }}>{value}</th>
          : <td key={i} style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{value}</td>)}</tr>)}</tbody>
      </table>
    </div> : null}
    {source ? <p style={{ fontSize: 11, lineHeight: 1.7, overflowWrap: 'break-word' }}><strong>Source: </strong><code>{source}</code></p> : null}
  </details>;
}
