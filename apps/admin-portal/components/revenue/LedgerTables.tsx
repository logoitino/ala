/**
 * Read-only tables for the Revenue desk (COMMERCE): the recent `company_revenue_logs` rows from
 * `get_company_revenue_summary.recent` and the latest donations from `get_admin_malo_breakdown.recent`.
 * Server-Component safe. Times are UTC. Words follow docs/product/VOICE.md: donation, donor, gear goal,
 * and "tip" only for the tip for Tapua'i. Ledger rows are records; none of them means money was paid out.
 */
import type { ReactNode } from 'react';

import { formatUsd, type MaloTxn, type RevenueLog } from '@/lib/reports';

import { donationChannel, ledgerDetail, streamName, utcStamp } from './revenueModel';

/** `rightFrom`: index of the first money column; money columns are right-aligned like their cells. */
function Shell({ caption, head, rightFrom, children }: { caption: string; head: string[]; rightFrom: number; children: ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="chart-tabular w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-[var(--surface-muted)]">
          <tr>
            {head.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={`px-3 py-2 text-[11px] font-extrabold tracking-[0.06em] text-[var(--ink-soft)] uppercase ${index >= rightFrom ? 'text-right' : ''}`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Notice({ tone, children }: { tone: 'error' | 'empty'; children: ReactNode }) {
  return tone === 'error' ? (
    <p role="status" className="rounded-xl border border-[var(--ember)]/30 bg-[var(--ember-soft)] px-3 py-3 text-sm text-[var(--ember)]">
      <span className="font-extrabold">Could not read. </span>
      {children}
    </p>
  ) : (
    <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-4 text-sm text-[var(--text-muted)]">{children}</p>
  );
}

/**
 * @purpose Latest ledger rows: stream, detail, gross, Tapua'i share, payee share.
 * @param rows `PortalRevenue.recent` (newest first, up to 40).
 * @param error `PortalRevenue.error`, shown instead of the table.
 */
export function RecentLedgerTable({ rows, error }: { rows: RevenueLog[]; error: string | null }) {
  if (error) return <Notice tone="error">{error}</Notice>;
  if (rows.length === 0) return <Notice tone="empty">No ledger rows yet. A row is written after a test-mode donation, booster, or Vault charge.</Notice>;
  return (
    <Shell caption="Recent ledger rows, newest first, test mode" head={['When (UTC)', 'Stream', 'Detail', 'Gross', "Tapua'i share", 'Payee share']} rightFrom={3}>
      {rows.map((row) => (
        <tr key={row.id} className="border-t border-[var(--border)] align-top">
          <th scope="row" className="px-3 py-2 font-semibold whitespace-nowrap text-[var(--ink-soft)]">
            {utcStamp(row.created_at)}
          </th>
          <td className="px-3 py-2 font-extrabold whitespace-nowrap text-[var(--ink)]">{streamName(row.source, row.source)}</td>
          <td className="px-3 py-2 break-words text-[var(--ink-soft)]">{ledgerDetail(row.source, row.label)}</td>
          <td className="px-3 py-2 text-right font-extrabold whitespace-nowrap text-[var(--ink)]">{formatUsd(row.gross_cents)}</td>
          <td className="px-3 py-2 text-right whitespace-nowrap text-[var(--ink-soft)]">{formatUsd(row.platform_cents)}</td>
          <td className="px-3 py-2 text-right whitespace-nowrap text-[var(--ink-soft)]">{formatUsd(row.payout_cents)}</td>
        </tr>
      ))}
    </Shell>
  );
}

/**
 * @purpose Latest donations: athlete, donor, where it started, linked clip or gear goal, amount.
 * @param rows `PortalMaloBreakdown.recent` (newest first, up to 40).
 * @param error `PortalMaloBreakdown.error`, shown instead of the table.
 */
export function RecentDonationsTable({ rows, error }: { rows: MaloTxn[]; error: string | null }) {
  if (error) return <Notice tone="error">{error}</Notice>;
  if (rows.length === 0) return <Notice tone="empty">No donations yet.</Notice>;
  return (
    <Shell caption="Latest donations, newest first, test mode" head={['When (UTC)', 'Athlete', 'Donor', 'Where it started', 'Linked to', 'Amount']} rightFrom={5}>
      {rows.map((row) => (
        <tr key={row.id} className="border-t border-[var(--border)] align-top">
          <th scope="row" className="px-3 py-2 font-semibold whitespace-nowrap text-[var(--ink-soft)]">
            {utcStamp(row.created_at)}
          </th>
          <td className="px-3 py-2 font-extrabold text-[var(--ink)]">{row.athlete_name}</td>
          <td className="px-3 py-2 text-[var(--ink-soft)]">{row.fan_name}</td>
          <td className="px-3 py-2 text-[var(--ink-soft)]">{donationChannel(row.origin, row.entry, row.source_label)}</td>
          <td className="px-3 py-2 text-xs text-[var(--text-muted)]">
            {row.wishlist_item_id ? `Gear goal ${row.wishlist_item_id.slice(0, 8)}` : row.reel_id ? `Clip ${row.reel_id.slice(0, 8)}` : '—'}
          </td>
          <td className="px-3 py-2 text-right font-extrabold whitespace-nowrap text-[var(--ink)]">{formatUsd(row.amount_cents)}</td>
        </tr>
      ))}
    </Shell>
  );
}
