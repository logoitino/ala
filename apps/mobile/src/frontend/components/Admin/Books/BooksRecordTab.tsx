/**
 * Record & close tab of the Finance & Books hub (BOOKS-01/02; BOOKKEEPER records, CONTROLLER closes):
 * record Stripe fees, expenses, payouts to the bank, booster operator payments and owner money as
 * balanced two-line entries; record a refund of a whole charge (family / athlete / operator share and
 * Tapua'i's share) against the right athlete; void by reversal; close or reopen a finished month and see
 * every past reopen. Writes go only through the admin ledger RPCs.
 */
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AdminBtn, AdminEmpty, AdminField, AdminFieldRow, AdminNotice, AdminPanel, AdminPills, AdminRow, AdminSectionTitle } from '@/components/Admin/AdminChrome';
import { closeLedgerPeriod, recordLedgerEntry, reopenLedgerPeriod, voidLedgerEntry } from '@/lib/bookkeeping';
import {
  booksUsd,
  closeTotals,
  MANUAL_ENTRY_KINDS,
  manualEntryLines,
  PAID_FROM,
  parseUsdCents,
  REFUND_STREAMS,
  refundEntryLines,
  type JournalEntry,
  type ManualEntryInput,
  type Period,
  type PeriodCloseInput,
} from '@tapuai/shared-types/admin/bookkeeping';

type Props = {
  period: Period;
  today: string;
  entries: JournalEntry[];
  manual: ManualEntryInput[];
  closes: PeriodCloseInput[];
  reopens: { period: string; reopened_at: string; reason: string }[];
  /** Athlete reference → name, for the refund athlete picker (names stay on screen). */
  athletes: Record<string, string>;
  manualConfigured: boolean;
  manualReadFailed: boolean;
  blockingCount: number;
  busy: string | null;
  /** Last action result; `action` says which control produced it, so it shows beside that control. */
  message: { text: string; tone: 'ok' | 'warn' | 'danger'; action: string } | null;
  run: (label: string, work: () => Promise<string | void>) => Promise<void>;
};

/** @purpose Recording form (with refunds), recorded-entry list with Void, and the month close. */
export function BooksRecordTab({ period, today, entries, manual, closes, reopens, athletes, manualConfigured, manualReadFailed, blockingCount, busy, message, run }: Props) {
  const [entryKind, setEntryKind] = useState('stripe_fees');
  const [paidFrom, setPaidFrom] = useState('bank');
  const [entryDate, setEntryDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [reference, setReference] = useState('');
  const [refundStream, setRefundStream] = useState('malo');
  const [refundAthlete, setRefundAthlete] = useState('');
  const [refundExtra, setRefundExtra] = useState('');
  const [disputeFee, setDisputeFee] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const template = MANUAL_ENTRY_KINDS.find((item) => item.id === entryKind)!;
  const isRefund = entryKind === 'refund';
  const refundNeedsAthlete = refundStream === 'malo' || refundStream === 'vault';
  const inPeriod = manual.filter((row) => row.entry_date >= period.from && row.entry_date <= period.to);
  const closed = period.kind === 'month' ? closes.find((close) => close.period === period.key) : undefined;
  const monthFinished = period.kind === 'month' && period.to < today;
  const pastReopens = reopens.filter((row) => period.kind !== 'month' || row.period === period.key);
  const athleteOptions = Object.entries(athletes).map(([ref, name]) => ({ id: ref, label: name })).sort((a, b) => a.label.localeCompare(b.label));
  const resultFor = (actions: string[]) => message && actions.includes(message.action)
    ? <View accessibilityLiveRegion="polite" aria-live="polite"><AdminNotice text={message.text} tone={message.tone} /></View> : null;
  const entryIds = inPeriod.map((row) => row.id);

  const record = () => run('record', async () => {
    const cents = parseUsdCents(amount);
    if (cents == null) throw new Error('Enter the amount as dollars and cents, like 42.50.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) throw new Error('Enter the date as YYYY-MM-DD.');
    if (!memo.trim()) throw new Error('Say what it was in the memo, like "Supabase Pro, October".');
    let built: ReturnType<typeof manualEntryLines>;
    if (isRefund) {
      const extra = refundExtra ? parseUsdCents(refundExtra) : 0;
      const dispute = disputeFee ? parseUsdCents(disputeFee) : 0;
      if (extra == null || dispute == null) throw new Error("Enter the tip for Tapua'i / card fee returned and the dispute fee as dollars and cents.");
      built = refundEntryLines({ stream: refundStream, grossCents: cents, extraTapuaiCents: extra, disputeFeeCents: dispute, athleteRef: refundNeedsAthlete ? refundAthlete : null });
    } else {
      built = manualEntryLines(entryKind, cents, paidFrom);
    }
    if ('error' in built) throw new Error(built.error);
    await recordLedgerEntry({ date: entryDate, kind: entryKind, memo: memo.trim(), reference: reference.trim(), lines: built.lines });
    setAmount('');
    setMemo('');
    setReference('');
    setRefundExtra('');
    setDisputeFee('');
    return `Recorded ${booksUsd(cents)} · ${template.label}.`;
  });

  return (
    <>
      <AdminSectionTitle>Record an entry</AdminSectionTitle>
      <AdminPanel>
        {manualReadFailed ? <AdminNotice tone="danger" text="Recorded entries could not be read, so recording is off until a refresh succeeds." /> : !manualConfigured ? <AdminNotice tone="warn" text="Recording is off until the bookkeeping migration (20261012210000_bookkeeping_ledger.sql) is applied. Income and payouts still work." /> : null}
        <AdminPills label="What is it?" items={MANUAL_ENTRY_KINDS.map(({ id, label }) => ({ id, label }))} value={entryKind} onChange={setEntryKind} />
        <Text style={{ fontSize: 13 }}>{template.hint}</Text>
        {isRefund ? <>
          <AdminPills label="What was refunded?" items={REFUND_STREAMS.map(({ id, label }) => ({ id, label }))} value={refundStream} onChange={setRefundStream} />
          {refundNeedsAthlete ? athleteOptions.length
            ? <AdminPills label="Whose money is returned?" items={athleteOptions} value={refundAthlete} onChange={setRefundAthlete} />
            : <AdminNotice tone="warn" text="No athlete has money held in the books yet, so there is nothing to refund from." /> : null}
        </> : template.credit == null ? <AdminPills label="Paid from" items={PAID_FROM.filter((item) => !(item.id === 'owner' && template.debit.startsWith('2'))).map(({ id, label }) => ({ id, label }))} value={paidFrom} onChange={setPaidFrom} /> : null}
        <AdminFieldRow>
          <AdminField label="Date (YYYY-MM-DD, UTC)" value={entryDate} onChangeText={setEntryDate} />
          <AdminField label={isRefund ? 'Charge refunded ($)' : 'Amount ($)'} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="42.50" />
        </AdminFieldRow>
        {isRefund ? <AdminFieldRow>
          <AdminField label="Tip for Tapua'i or card fee returned too ($)" value={refundExtra} onChangeText={setRefundExtra} keyboardType="decimal-pad" placeholder="0.00" />
          <AdminField label="Stripe dispute fee ($)" value={disputeFee} onChangeText={setDisputeFee} keyboardType="decimal-pad" placeholder="0.00" />
        </AdminFieldRow> : null}
        <AdminFieldRow>
          <AdminField label="Memo" value={memo} onChangeText={setMemo} autoCapitalize="sentences" placeholder={isRefund ? 'Refund, donor request' : 'Supabase Pro, October'} />
          <AdminField label="Receipt, invoice or Stripe id" value={reference} onChangeText={setReference} placeholder="Optional" />
        </AdminFieldRow>
        <AdminBtn kind="primary" label={busy === 'record' ? 'Recording…' : 'Record entry'} onPress={() => { void record(); }} disabled={!manualConfigured || manualReadFailed || busy != null} />
        {resultFor(['record'])}
      </AdminPanel>

      <AdminSectionTitle>{`Recorded entries · ${period.label}`}</AdminSectionTitle>
      <AdminPanel>
        {inPeriod.length === 0 ? <AdminEmpty text={manualConfigured ? 'No recorded entries in this period.' : 'Recorded entries appear here once the migration is applied.'} /> : null}
        {inPeriod.length > 0 ? <AdminField label="Reason for voiding (needed to void)" value={voidReason} onChangeText={setVoidReason} autoCapitalize="sentences" /> : null}
        {inPeriod.map((row) => {
          const total = row.lines.reduce((sum, line) => sum + line.debit_cents, 0);
          const state = row.reverses_id ? 'Reversal' : row.voided_at ? 'Voided' : null;
          return <AdminRow key={row.id} title={`${row.entry_date} · ${booksUsd(total)} · ${MANUAL_ENTRY_KINDS.find((item) => item.id === row.kind)?.label ?? row.kind}`} meta={[row.memo, row.reference ? `Ref ${row.reference}` : '', state].filter(Boolean).join(' · ')}>
            {!state ? <AdminBtn kind="danger" label={busy === row.id ? 'Voiding…' : 'Void'} disabled={!voidReason.trim() || busy != null} onPress={() => { void run(row.id, async () => { await voidLedgerEntry(row.id, voidReason.trim()); setVoidReason(''); return 'Voided. A reversing entry was posted today.'; }); }} /> : null}
          </AdminRow>;
        })}
        {resultFor(entryIds)}
      </AdminPanel>

      <AdminSectionTitle>Close the month</AdminSectionTitle>
      <AdminPanel>
        {period.kind !== 'month' ? <Text style={{ fontSize: 14 }}>Choose Month in the period picker to close or reopen a month.</Text> : closed ? <>
          <Text style={{ fontSize: 14 }}>{`${period.label} was closed ${closed.closed_at.slice(0, 10)}${closed.note ? ` · ${closed.note}` : ''}. Recorded entries cannot be dated into it.`}</Text>
          <AdminField label="Reason for reopening" value={reopenReason} onChangeText={setReopenReason} autoCapitalize="sentences" />
          <AdminBtn label={busy === 'reopen' ? 'Reopening…' : `Reopen ${period.label}`} disabled={!reopenReason.trim() || busy != null} onPress={() => { void run('reopen', async () => { await reopenLedgerPeriod(period.key, reopenReason.trim()); setReopenReason(''); return `${period.label} is open again.`; }); }} />
        </> : <>
          <Text style={{ fontSize: 14 }}>Close a finished month after Stripe fees are recorded, the Reconcile tab is complete, Suspense is zero and the Stripe payout total matches the bank. The hub then warns if anything in that month changes later.</Text>
          {blockingCount ? <AdminNotice tone="warn" text={`Fix the ${blockingCount} "Stop" item${blockingCount === 1 ? '' : 's'} on Overview before closing.`} /> : null}
          <AdminBtn kind="primary" label={busy === 'close' ? 'Closing…' : `Close ${period.label}`} disabled={!manualConfigured || !monthFinished || blockingCount > 0 || busy != null}
            onPress={() => { void run('close', async () => { await closeLedgerPeriod(period.key, '', closeTotals(entries, period.key)); return `${period.label} is closed.`; }); }} />
          {!monthFinished ? <Text style={{ fontSize: 12 }}>Only a finished month can be closed.</Text> : null}
        </>}
        {resultFor(['close', 'reopen'])}
        {pastReopens.length ? <Text style={{ fontSize: 12 }}>{`Reopened before: ${pastReopens.map((row) => `${row.period} on ${row.reopened_at.slice(0, 10)} (${row.reason})`).join('; ')}`}</Text> : null}
      </AdminPanel>
    </>
  );
}
