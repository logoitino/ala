/**
 * Transactions explorer for Finance and Accounting (BOOKS-02, owned by FINANCE_DATA, accepted by
 * CONTROLLER). One row per journal entry, with the fields finance filters on: date range, kind,
 * stream, account touched, channel (where a donation started), athlete, payee side, amount range and
 * free text. The CSV export writes exactly the filtered rows. Pure; no fetching.
 */
import { booksUsd, ledgerAccount, streamTitle, toCsv, type JournalEntry, type JournalOrigin } from './bookkeeping';

export type TransactionRow = {
  entryId: string;
  date: string;
  origin: JournalOrigin;
  /** Revenue stream, `disbursement`, or the recorded-entry kind. */
  stream: string;
  streamTitle: string;
  channel: string;
  athleteRef: string | null;
  /** Debit to the Stripe balance or bank for income; total debits for other entries. */
  amount: number;
  tapuai: number;
  heldForOthers: number;
  accounts: string[];
  memo: string;
  sourceId: string;
};

const INCOME = (code: string) => code.startsWith('4');
const HELD = new Set(['2000', '2010', '2100']);

/** @purpose Summarize each journal entry as one filterable row. */
export function transactionRows(entries: JournalEntry[], channelBySourceId: Record<string, string> = {}): TransactionRow[] {
  return entries.map((entry) => {
    const debit = entry.lines.reduce((sum, line) => sum + line.debit, 0);
    const tapuai = entry.lines.filter((line) => INCOME(line.account)).reduce((sum, line) => sum + line.credit - line.debit, 0);
    const held = entry.lines.filter((line) => HELD.has(line.account)).reduce((sum, line) => sum + line.credit - line.debit, 0);
    const athlete = entry.lines.find((line) => line.athleteRef)?.athleteRef ?? null;
    return {
      entryId: entry.id,
      date: entry.date,
      origin: entry.origin,
      stream: entry.source,
      streamTitle: entry.origin === 'revenue' ? streamTitle(entry.source) : entry.origin === 'disbursement' ? 'Payout' : entry.source.replace(/_/g, ' '),
      channel: channelBySourceId[entry.sourceId] ?? (entry.origin === 'revenue' && ['malo', 'tip', 'card_fee'].includes(entry.source) ? 'Not recorded' : '—'),
      athleteRef: athlete,
      amount: debit,
      tapuai,
      heldForOthers: held,
      accounts: [...new Set(entry.lines.map((line) => line.account))],
      memo: entry.memo,
      sourceId: entry.sourceId,
    };
  });
}

export type TransactionFilter = {
  from?: string;
  to?: string;
  origins?: JournalOrigin[];
  streams?: string[];
  account?: string;
  channel?: string;
  athleteRef?: string;
  side?: 'all' | 'tapuai' | 'held';
  minCents?: number | null;
  maxCents?: number | null;
  text?: string;
};

/** @purpose Apply every filter; empty or missing filters match everything. */
export function filterTransactions(rows: TransactionRow[], filter: TransactionFilter, athleteNames: Record<string, string> = {}): TransactionRow[] {
  const text = filter.text?.trim().toLowerCase() ?? '';
  return rows.filter((row) => {
    if (filter.from && row.date < filter.from) return false;
    if (filter.to && row.date > filter.to) return false;
    if (filter.origins?.length && !filter.origins.includes(row.origin)) return false;
    if (filter.streams?.length && !filter.streams.includes(row.stream)) return false;
    if (filter.account && !row.accounts.includes(filter.account)) return false;
    if (filter.channel && !row.channel.toLowerCase().startsWith(filter.channel.toLowerCase())) return false;
    if (filter.athleteRef && row.athleteRef !== filter.athleteRef) return false;
    if (filter.side === 'tapuai' && row.tapuai === 0) return false;
    if (filter.side === 'held' && row.heldForOthers === 0) return false;
    if (filter.minCents != null && row.amount < filter.minCents) return false;
    if (filter.maxCents != null && row.amount > filter.maxCents) return false;
    if (text) {
      const name = row.athleteRef ? athleteNames[row.athleteRef] ?? '' : '';
      const hay = `${row.memo} ${row.streamTitle} ${row.channel} ${row.sourceId} ${row.entryId} ${name}`.toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });
}

/** @purpose Distinct values present in the rows, for the filter pickers. */
export function filterOptions(rows: TransactionRow[]): { streams: { id: string; label: string }[]; channels: string[]; accounts: { id: string; label: string }[]; athletes: string[] } {
  const streams = new Map<string, string>();
  const channels = new Set<string>();
  const accounts = new Set<string>();
  const athletes = new Set<string>();
  for (const row of rows) {
    streams.set(row.stream, row.streamTitle);
    if (row.channel !== '—') channels.add(row.channel.split(' · ')[0]);
    row.accounts.forEach((code) => accounts.add(code));
    if (row.athleteRef) athletes.add(row.athleteRef);
  }
  return {
    streams: [...streams.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label)),
    channels: [...channels].sort(),
    accounts: [...accounts].sort().map((id) => ({ id, label: `${id} ${ledgerAccount(id)?.name ?? ''}`.trim() })),
    athletes: [...athletes].sort(),
  };
}

export type TransactionTotals = { count: number; amount: number; tapuai: number; heldForOthers: number };

export function transactionTotals(rows: TransactionRow[]): TransactionTotals {
  return rows.reduce((t, row) => ({ count: t.count + 1, amount: t.amount + row.amount, tapuai: t.tapuai + row.tapuai, heldForOthers: t.heldForOthers + row.heldForOthers }), { count: 0, amount: 0, tapuai: 0, heldForOthers: 0 });
}

/** @purpose CSV of exactly the filtered rows; athlete names and family-typed titles are never written, only the reference and channel. */
export function transactionsCsv(rows: TransactionRow[]): string {
  const money = (cents: number) => (cents / 100).toFixed(2);
  return toCsv([
    ['Date', 'Kind', 'Stream', 'Channel', 'Amount', "Tapua'i share", 'Held for others', 'Accounts', 'Athlete ref', 'Memo', 'Source id', 'Entry'],
    // Channel detail after " · " is a Rally or gear-goal title a family typed; only the channel itself is exported.
    ...rows.map((row) => [row.date, row.origin, row.streamTitle, row.channel.split(' · ')[0], money(row.amount), money(row.tapuai), money(row.heldForOthers), row.accounts.join(' '), row.athleteRef ?? '', row.memo, row.sourceId, row.entryId]),
  ]);
}

/** Screen label for one row's amounts: "$10.00 · Tapua'i $1.00 · held $9.00". */
export function transactionAmountLine(row: TransactionRow): string {
  return [booksUsd(row.amount), row.tapuai ? `Tapua'i ${booksUsd(row.tapuai)}` : '', row.heldForOthers ? `held ${booksUsd(row.heldForOthers)}` : ''].filter(Boolean).join(' · ');
}

