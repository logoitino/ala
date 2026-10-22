/**
 * Read-only tables for the Revenue desk (COMMERCE): the recent `company_revenue_logs` rows from
 * `get_company_revenue_summary.recent` and the latest gifts from `get_admin_malo_breakdown.recent`.
 * Server-Component safe. Times are UTC. Words follow docs/product/VOICE.md: gift, giver, gear goal,
 * and "tip" only for the tip for Tapua'i. Ledger rows are records; none of them means money was paid out.
 *
 * Open table and phone-row dividers follow Home's report format, retaining the legal ledger copy.
 * Phones (under Tailwind `sm`, 640px) get one value row instead of the table, so the amount is
 * visible without a sideways scroll at 375 and 320. From `sm` up the table shows. Only one of the
 * two is displayed (the other is `display: none`), so assistive tech reads the rows once.
 *
 * A missing value is a `Blank`: the dash is aria-hidden and sr-only words say what is missing, like
 * Trends (W3-COMMERCE #3).
 */
import type { ReactNode } from 'react';

import { formatUsd, type MaloTxn, type RevenueLog } from '@/lib/reports';

import { donationChannel, ledgerDetail, streamName, utcStamp } from './revenueModel';

/**
 * Wide table (from `sm` up). The scroll box is a named, focusable region so a keyboard user can
 * scroll it when it overflows (A11Y #7).
 * `rightFrom`: index of the first money column; money columns are right-aligned like their cells.
 */
function Shell({ caption, head, rightFrom, children }: { caption: string; head: string[]; rightFrom: number; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="hidden max-w-full overflow-x-auto border-y border-[var(--border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jade)] sm:block"
    >
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

/** A missing value: the dash is for sighted readers, the words are for screen readers (same as Trends' `Blank`). */
function Blank({ words }: { words: string }) {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{words}</span>
    </>
  );
}

/** Ledger and gift time, or a Blank when the read has no usable time. */
function When({ iso }: { iso: string }) {
  const stamp = utcStamp(iso);
  return stamp ? <>{stamp}</> : <Blank words="Not in this read" />;
}

/**
 * One row as a card (under `sm`): title and amount on the first line, then labelled details.
 * `figure`: a time or amount. It breaks only at spaces (`break-normal`), so "$12,345.67" never splits
 *   mid-figure while "Oct 12, 2:52 PM UTC" can still wrap at enlarged text. Words use `break-words`.
 */
type CardRow = { key: string; title: string; amount: string; details: { label: string; value: ReactNode; figure?: boolean }[] };

function Cards({ caption, rows }: { caption: string; rows: CardRow[] }) {
  return (
    <ul aria-label={caption} className="flex flex-col gap-2 sm:hidden">
      {rows.map((row) => (
        <li key={row.key} className="border-b border-[var(--border)] py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 font-extrabold break-words text-[var(--ink)]">{row.title}</span>
            <span className="chart-tabular shrink-0 font-extrabold whitespace-nowrap text-[var(--ink)]">{row.amount}</span>
          </div>
          {/* The value column never goes below its widest figure, so at enlarged text the label column wraps ("Payee / share") instead of an amount running past the card. */}
          <dl className="mt-1.5 grid grid-cols-[minmax(0,max-content)_minmax(min-content,1fr)] gap-x-3 gap-y-0.5 text-xs">
            {row.details.map((detail) => (
              <div key={detail.label} className="contents">
                <dt className="min-w-0 font-bold break-words text-[var(--text-muted)]">{detail.label}</dt>
                <dd className={`chart-tabular min-w-0 text-[var(--ink-soft)] ${detail.figure ? 'break-normal' : 'break-words'}`}>{detail.value}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
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
  if (rows.length === 0) return <Notice tone="empty">No ledger rows yet. A row is written after a test-mode gift, booster, or Vault charge.</Notice>;
  const caption = 'Recent ledger rows, newest first, test mode';
  const cards: CardRow[] = rows.map((row) => ({
    key: row.id,
    title: streamName(row.source, row.source),
    amount: formatUsd(row.gross_cents),
    details: [
      { label: 'When', value: <When iso={row.created_at} />, figure: true },
      { label: 'Detail', value: ledgerDetail(row.source, row.label) },
      { label: "Tapua'i share", value: formatUsd(row.platform_cents), figure: true },
      { label: 'Payee share', value: formatUsd(row.payout_cents), figure: true },
    ],
  }));
  return (
    <>
      <Cards caption={caption} rows={cards} />
      <Shell caption={caption} head={['When (UTC)', 'Stream', 'Detail', 'Gross', "Tapua'i share", 'Payee share']} rightFrom={3}>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-[var(--border)] align-top">
            <th scope="row" className="px-3 py-2 font-semibold whitespace-nowrap text-[var(--ink-soft)]">
              <When iso={row.created_at} />
            </th>
            <td className="px-3 py-2 font-extrabold whitespace-nowrap text-[var(--ink)]">{streamName(row.source, row.source)}</td>
            <td className="px-3 py-2 break-words text-[var(--ink-soft)]">{ledgerDetail(row.source, row.label)}</td>
            <td className="px-3 py-2 text-right font-extrabold whitespace-nowrap text-[var(--ink)]">{formatUsd(row.gross_cents)}</td>
            <td className="px-3 py-2 text-right whitespace-nowrap text-[var(--ink-soft)]">{formatUsd(row.platform_cents)}</td>
            <td className="px-3 py-2 text-right whitespace-nowrap text-[var(--ink-soft)]">{formatUsd(row.payout_cents)}</td>
          </tr>
        ))}
      </Shell>
    </>
  );
}

/** The gear goal or clip a gift points at, by short id. A gift with neither (a profile or QR
 *  gift) is a Blank that says so, not a bare "—". */
function linkedTo(row: MaloTxn): ReactNode {
  if (row.wishlist_item_id) return `Gear goal ${row.wishlist_item_id.slice(0, 8)}`;
  if (row.reel_id) return `Clip ${row.reel_id.slice(0, 8)}`;
  return <Blank words="Not linked to a clip or gear goal" />;
}

/**
 * @purpose Latest gifts: athlete, giver, where it started, linked clip or gear goal, amount.
 * @param rows `PortalMaloBreakdown.recent` (newest first, up to 40).
 * @param error `PortalMaloBreakdown.error`, shown instead of the table.
 */
export function RecentDonationsTable({ rows, error }: { rows: MaloTxn[]; error: string | null }) {
  if (error) return <Notice tone="error">{error}</Notice>;
  if (rows.length === 0) return <Notice tone="empty">No gifts yet.</Notice>;
  const caption = 'Latest gifts, newest first, test mode';
  const cards: CardRow[] = rows.map((row) => ({
    key: row.id,
    title: row.athlete_name,
    amount: formatUsd(row.amount_cents),
    details: [
      { label: 'When', value: <When iso={row.created_at} />, figure: true },
      { label: 'Giver', value: row.fan_name },
      { label: 'Started', value: donationChannel(row.origin, row.entry, row.source_label) },
      { label: 'Linked to', value: linkedTo(row) },
    ],
  }));
  return (
    <>
      <Cards caption={caption} rows={cards} />
      <Shell caption={caption} head={['When (UTC)', 'Athlete', 'Giver', 'Where it started', 'Linked to', 'Amount']} rightFrom={5}>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-[var(--border)] align-top">
            <th scope="row" className="px-3 py-2 font-semibold whitespace-nowrap text-[var(--ink-soft)]">
              <When iso={row.created_at} />
            </th>
            <td className="px-3 py-2 font-extrabold text-[var(--ink)]">{row.athlete_name}</td>
            <td className="px-3 py-2 text-[var(--ink-soft)]">{row.fan_name}</td>
            <td className="px-3 py-2 text-[var(--ink-soft)]">{donationChannel(row.origin, row.entry, row.source_label)}</td>
            <td className="px-3 py-2 text-xs text-[var(--text-muted)]">
              {linkedTo(row)}
            </td>
            <td className="px-3 py-2 text-right font-extrabold whitespace-nowrap text-[var(--ink)]">{formatUsd(row.amount_cents)}</td>
          </tr>
        ))}
      </Shell>
    </>
  );
}
