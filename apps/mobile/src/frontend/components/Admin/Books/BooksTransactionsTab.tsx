/**
 * Transactions tab of the Finance & Books hub (BOOKS-02; owned by FINANCE_DATA, accepted by
 * CONTROLLER): every journal entry as one row that Finance and Accounting can filter by date, kind,
 * stream, channel, account, athlete, side, amount and text, with totals and a CSV of exactly the
 * filtered rows. Athlete names show on screen only; the CSV carries the pseudonymous reference.
 */
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { AdminBtn, AdminField, AdminFieldRow, AdminNotice, AdminPanel, AdminPills } from '@/components/Admin/AdminChrome';
import { AdminReportData } from '@/components/Admin/Reports/AdminReportData';
import { booksUsd, parseUsdCents, type JournalEntry, type JournalOrigin } from '@tapuai/shared-types/admin/bookkeeping';
import {
  filterOptions,
  filterTransactions,
  transactionAmountLine,
  transactionRows,
  transactionsCsv,
  transactionTotals,
  type TransactionFilter,
} from '@tapuai/shared-types/admin/financeFilters';

/** Rows drawn on screen; the export always has every filtered row. */
export const TRANSACTION_SCREEN_ROWS = 200;

type Props = {
  entries: JournalEntry[];
  period: { from: string; to: string; key: string };
  channels: Record<string, string>;
  athleteNames: Record<string, string>;
  busy: boolean;
  onExport: (filename: string, csv: string) => void;
};

const KINDS: { id: 'all' | JournalOrigin; label: string }[] = [
  { id: 'all', label: 'All kinds' },
  { id: 'revenue', label: 'Income events' },
  { id: 'disbursement', label: 'Payouts' },
  { id: 'manual', label: 'Recorded entries' },
];
const SIDES: { id: 'all' | 'tapuai' | 'held'; label: string }[] = [
  { id: 'all', label: 'Any side' },
  { id: 'tapuai', label: "Touches Tapua'i income" },
  { id: 'held', label: 'Touches money held for others' },
];

/** @purpose Filter, total and export journal transactions for the selected period. The hub remounts this tab
 *  per period (`key`), so filters never carry over silently into another period. */
export function BooksTransactionsTab({ entries, period, channels, athleteNames, busy, onExport }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kind, setKind] = useState<'all' | JournalOrigin>('all');
  const [stream, setStream] = useState('all');
  const [channel, setChannel] = useState('all');
  const [account, setAccount] = useState('all');
  const [athlete, setAthlete] = useState('all');
  const [side, setSide] = useState<'all' | 'tapuai' | 'held'>('all');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [text, setText] = useState('');

  const all = useMemo(() => transactionRows(entries, channels), [entries, channels]);
  const options = useMemo(() => filterOptions(all.filter((row) => row.date >= period.from && row.date <= period.to)), [all, period]);
  const badDate = [from, to].some((value) => value && !/^\d{4}-\d{2}-\d{2}$/.test(value));
  const minCents = min ? parseUsdCents(min) : null;
  const maxCents = max ? parseUsdCents(max) : null;
  const badAmount = (min && minCents == null) || (max && maxCents == null);
  const filter: TransactionFilter = {
    from: from && !badDate ? from : period.from,
    to: to && !badDate ? to : period.to,
    origins: kind === 'all' ? undefined : [kind],
    streams: stream === 'all' ? undefined : [stream],
    channel: channel === 'all' ? undefined : channel,
    account: account === 'all' ? undefined : account,
    athleteRef: athlete === 'all' ? undefined : athlete,
    side,
    minCents,
    maxCents,
    text,
  };
  const rows = useMemo(() => filterTransactions(all, filter, athleteNames).reverse(),
    // The filter object is rebuilt each render; depend on its inputs instead.
    [all, athleteNames, period.from, period.to, from, to, badDate, kind, stream, channel, account, athlete, side, minCents, maxCents, text]);
  const totals = transactionTotals(rows);
  const reset = () => { setFrom(''); setTo(''); setKind('all'); setStream('all'); setChannel('all'); setAccount('all'); setAthlete('all'); setSide('all'); setMin(''); setMax(''); setText(''); };
  const nameOf = (ref: string | null) => (ref ? athleteNames[ref] ?? ref : '');

  return (
    <View style={{ gap: 18 }}>
      <AdminPanel title="Filters">
        <AdminFieldRow>
          <AdminField label={`From (YYYY-MM-DD, default ${period.from})`} value={from} onChangeText={setFrom} placeholder={period.from} />
          <AdminField label={`To (YYYY-MM-DD, default ${period.to})`} value={to} onChangeText={setTo} placeholder={period.to} />
        </AdminFieldRow>
        {badDate ? <AdminNotice tone="warn" text="Dates must look like 2026-10-31; the period dates are used until then." /> : null}
        <AdminPills label="Kind" items={KINDS} value={kind} onChange={setKind} />
        <AdminPills label="Stream" items={[{ id: 'all', label: 'All streams' }, ...options.streams]} value={stream} onChange={setStream} />
        {options.channels.length ? <AdminPills label="Where the gift started" items={[{ id: 'all', label: 'Any channel' }, ...options.channels.map((c) => ({ id: c, label: c }))]} value={channel} onChange={setChannel} /> : null}
        <AdminPills label="Account touched" items={[{ id: 'all', label: 'Any account' }, ...options.accounts]} value={account} onChange={setAccount} />
        {options.athletes.length ? <AdminPills label="Athlete" items={[{ id: 'all', label: 'Every athlete' }, ...options.athletes.map((ref) => ({ id: ref, label: nameOf(ref) }))]} value={athlete} onChange={setAthlete} /> : null}
        <AdminPills label="Side" items={SIDES} value={side} onChange={setSide} />
        <AdminFieldRow>
          <AdminField label="Smallest amount ($)" value={min} onChangeText={setMin} keyboardType="decimal-pad" />
          <AdminField label="Largest amount ($)" value={max} onChangeText={setMax} keyboardType="decimal-pad" />
          <AdminField label="Search memo, id or athlete" value={text} onChangeText={setText} />
        </AdminFieldRow>
        {badAmount ? <AdminNotice tone="warn" text="Amounts must be dollars and cents, like 25 or 25.50." /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <AdminBtn label="Clear filters" onPress={reset} />
          <AdminBtn kind="primary" label={`Export ${totals.count} filtered rows (CSV)`} disabled={busy || !rows.length} onPress={() => onExport(`tapuai-transactions-${period.key}.csv`, transactionsCsv(rows))} />
        </View>
      </AdminPanel>

      <Text accessibilityRole="summary" style={{ fontSize: 15, fontWeight: '800' }}>
        {`${totals.count} transactions · ${booksUsd(totals.amount)} moved · Tapua'i ${booksUsd(totals.tapuai)} · held for others ${booksUsd(totals.heldForOthers)}`}
      </Text>

      <AdminReportData
        title="Filtered transactions"
        initiallyOpen
        source="Journal entries built from company_revenue_logs, paid disbursements and recorded entries; channel from each gift's origin and entry"
        table={{
          columns: ['Date', 'Kind', 'Stream', 'Channel', 'Amounts', 'Athlete', 'Memo'],
          rows: rows.slice(0, TRANSACTION_SCREEN_ROWS).map((row) => [row.date, row.origin === 'revenue' ? 'Income' : row.origin === 'disbursement' ? 'Payout' : 'Recorded', row.streamTitle, row.channel, transactionAmountLine(row), nameOf(row.athleteRef), row.memo]),
        }}
      />
      {rows.length > TRANSACTION_SCREEN_ROWS ? <Text style={{ fontSize: 12 }}>{`Showing the newest ${TRANSACTION_SCREEN_ROWS} of ${rows.length}. The export has every filtered row.`}</Text> : null}
      {!rows.length ? <Text style={{ fontSize: 13 }}>No transactions match these filters in this window.</Text> : null}
    </View>
  );
}
