/**
 * Finance & Books hub (BOOKS-01/02, `/admin/books`): where Finance, Accounting and Tax work in the main
 * admin. One journal (`@tapuai/shared-types/admin/bookkeeping`) feeds eight tabs — Overview,
 * Transactions, Statements, Taxes, Reconcile, Data, Record & close, Export — so the screen, the checks
 * and every export always agree. Each tab names the finance role that owns it (CFO org, TEAMS.md).
 * `?tab=` opens a tab directly (for example `/admin/books?tab=reconcile`).
 * @sideEffects Reads through `useBooks`; writes only through the admin-only ledger RPCs; Export downloads
 *   a CSV on web or opens the share sheet on a phone.
 */
import { useEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { AdminBtn, AdminNotice, AdminPage, AdminPanel, AdminPills } from '@/components/Admin/AdminChrome';
import { AdminReportSection } from '@/components/Admin/Reports/AdminReportSection';
import { useBooks } from '@/hooks/useBooks';
import { exportCsv } from '@/lib/csvExport';
import { tipChannelLabel } from '@/lib/finance';
import {
  athleteRef,
  booksQualityIssues,
  buildJournal,
  chartOfAccountsCsv,
  entriesBetween,
  generalLedgerCsv,
  periodFor,
  qboJournalCsv,
  QBO_MAX_LINES,
  shiftPeriod,
  taxSummaryCsv,
  taxYearSummary,
  type PeriodKind,
} from '@tapuai/shared-types/admin/bookkeeping';
import { channelBySourceId, reconcileSources } from '@tapuai/shared-types/admin/financeChecks';
import { taxReadiness } from '@tapuai/shared-types/admin/financeTax';
import { BooksDataTab } from './BooksDataTab';
import { BooksReconcileTab } from './BooksReconcileTab';
import { BooksRecordTab } from './BooksRecordTab';
import { BooksTaxesTab } from './BooksTaxesTab';
import { BooksTransactionsTab } from './BooksTransactionsTab';
import { booksSectionsFor, OVERVIEW_SECTION_IDS, STATEMENT_SECTION_IDS, TAX_SECTION_IDS } from './booksSections';

const PERIOD_KINDS: { id: PeriodKind; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'year', label: 'Year' },
];

export type BooksTab = 'overview' | 'transactions' | 'statements' | 'taxes' | 'reconcile' | 'data' | 'record' | 'export';

/** Tabs in order, with the finance role accountable for each (docs/agents/TEAMS.md, Finance and Accounting). */
export const BOOKS_TABS: { id: BooksTab; label: string; owner: string }[] = [
  { id: 'overview', label: 'Overview', owner: 'CFO' },
  { id: 'transactions', label: 'Transactions', owner: 'FINANCE_DATA for CONTROLLER' },
  { id: 'statements', label: 'Statements', owner: 'CONTROLLER' },
  { id: 'taxes', label: 'Taxes', owner: 'TAX, with INFO_RETURNS and SALES_TAX' },
  { id: 'reconcile', label: 'Reconcile', owner: 'INTERNAL_CONTROLS' },
  { id: 'data', label: 'Data', owner: 'FINANCE_DATA, reviewed by INTERNAL_CONTROLS' },
  { id: 'record', label: 'Record & close', owner: 'BOOKKEEPER records, CONTROLLER closes' },
  { id: 'export', label: 'Export', owner: 'CONTROLLER' },
];

const today = () => new Date().toISOString().slice(0, 10);

/** Same rule as wallet pay: anything but a live publishable key is Stripe test mode. */
const STRIPE_TEST_MODE = !process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim().startsWith('pk_live_');

/**
 * @purpose Render the Finance & Books hub for the signed-in admin.
 * @sideEffects Ledger RPCs on Record, Void, Close and Reopen; file download or share sheet on Export.
 */
export function BooksScreen() {
  const books = useBooks();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<BooksTab>(() => (BOOKS_TABS.some((item) => item.id === params.tab) ? params.tab as BooksTab : 'overview'));
  // A link opened while the hub is already showing still switches tabs.
  useEffect(() => { if (BOOKS_TABS.some((item) => item.id === params.tab)) setTab(params.tab as BooksTab); }, [params.tab]);
  const [kind, setKind] = useState<PeriodKind>('month');
  const [anchor, setAnchor] = useState(today);
  const period = useMemo(() => periodFor(kind, anchor), [kind, anchor]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'warn' | 'danger'; action: string } | null>(null);

  const journal = useMemo(() => buildJournal(books.input), [books.input]);
  const recon = useMemo(() => reconcileSources(books.input.revenue, books.sources, books.input.disbursements), [books.input.revenue, books.sources, books.input.disbursements]);
  const loaded = Boolean(books.readAt);
  const readErrors = useMemo(() => Object.fromEntries([
    ['Revenue log', books.errors.revenue], ['Payouts', books.errors.disbursements], ['Recorded entries', books.errors.manual],
  ].filter((pair): pair is [string, string] => Boolean(pair[1]))), [books.errors]);
  const issues = useMemo(() => {
    const quality = booksQualityIssues(journal.entries, journal.issues, {
      period, manualConfigured: books.manualConfigured, revenueTruncated: books.revenueTruncated, missingPaymentIds: books.missingPaymentIds,
      testMode: STRIPE_TEST_MODE, closes: books.closes, queuedPayoutCents: books.queuedPayoutCents, loaded, readErrors,
    });
    const rank = { block: 0, warn: 1, info: 2 } as const;
    return [...quality, ...recon.findings].sort((a, b) => rank[a.severity] - rank[b.severity]);
  }, [journal, recon, period, books.manualConfigured, books.revenueTruncated, books.missingPaymentIds, books.closes, books.queuedPayoutCents, loaded, readErrors]);
  const view = useMemo(() => ({ period, entries: journal.entries, issues, revenue: books.input.revenue, playerNames: books.playerNames }), [period, journal, issues, books.input.revenue, books.playerNames]);
  const inPeriod = useMemo(() => entriesBetween(journal.entries, period.from, period.to), [journal, period]);
  const channels = useMemo(() => channelBySourceId(books.sources.tips, tipChannelLabel), [books.sources.tips]);
  const athleteNames = useMemo(() => Object.fromEntries(Object.entries(books.playerNames).map(([id, name]) => [athleteRef(id)!, name])), [books.playerNames]);
  const year = Number(period.to.slice(0, 4));
  const tax = useMemo(() => taxYearSummary(journal.entries, year, books.input.revenue), [journal, year, books.input.revenue]);
  const liveManual = books.input.manual.filter((row) => !row.voided_at && !row.reverses_id);
  const readiness = taxReadiness({
    manualConfigured: books.manualConfigured,
    coverFeeColumn: books.sources.coverFeeColumn,
    hasExpenseEntries: liveManual.some((row) => row.lines.some((line) => line.account_code.startsWith('6') || line.account_code === '5010')),
    hasStripeFeeEntries: liveManual.some((row) => row.lines.some((line) => line.account_code === '5000')),
    liveMode: !STRIPE_TEST_MODE,
    payeesOverThreshold: tax.payees.filter((payee) => payee.overThreshold).length,
  });
  const blocking = issues.filter((issue) => issue.severity === 'block');
  // No file leaves the hub while figures are incomplete: not yet read, a read failed or stopped early, or unbalanced.
  const exportBlocked = !loaded || blocking.some((issue) => issue.id === 'unbalanced' || issue.id === 'truncated' || issue.id === 'not-loaded' || issue.id.startsWith('read-failed'));
  const sourceErrors = [books.errors.revenue && `Revenue log: ${books.errors.revenue}`, books.errors.disbursements && `Payouts: ${books.errors.disbursements}`, books.errors.manual && `Recorded entries: ${books.errors.manual}`].filter(Boolean) as string[];
  const owner = BOOKS_TABS.find((item) => item.id === tab)!.owner;

  const run = async (label: string, work: () => Promise<string | void>, reload = true) => {
    setBusy(label);
    setMessage(null);
    try {
      const done = await work();
      setMessage({ text: done || 'Saved.', tone: 'ok', action: label });
      if (reload) await books.refresh();
    } catch (caught) {
      setMessage({ text: caught instanceof Error ? caught.message : 'That did not work.', tone: 'danger', action: label });
    } finally {
      setBusy(null);
    }
  };

  // An export changes nothing, so the books are not re-read.
  const download = (label: string, filename: string, csv: () => string) => run(label, async () => {
    const how = await exportCsv(filename, csv());
    return how === 'downloaded' ? `Downloaded ${filename}.` : how === 'dismissed' ? `${filename} was not shared.` : `Shared ${filename}.`;
  }, false);

  const qboDaily = qboJournalCsv(inPeriod, 'daily');

  return (
    <AdminPage
      title="Finance & Books"
      lede="Where Finance, Accounting and Tax work: what Tapua'i earned, what it holds for families, whether every dollar reached the books, taxes, and the files QuickBooks or the CPA needs."
      refreshing={books.loading}
      onRefresh={() => { void books.refresh(); }}
    >
      {books.disabledReason ? <AdminNotice tone="warn" text={books.disabledReason} /> : null}
      {!books.configured ? <AdminNotice tone="warn" text="Supabase is not configured in this build, so there are no books to read." /> : null}
      {sourceErrors.map((text) => <AdminNotice key={text} tone="danger" text={`${text} The figures below leave this source out.`} />)}

      <AdminPanel>
        <AdminPills label="Period" items={PERIOD_KINDS} value={kind} onChange={setKind} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <AdminBtn label="‹ Earlier" onPress={() => setAnchor(shiftPeriod(period, -1).from)} />
          <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800' }}>{period.label}</Text>
          <AdminBtn label="Later ›" onPress={() => setAnchor(shiftPeriod(period, 1).from)} disabled={period.to >= today()} />
          <AdminBtn label={books.loading ? 'Reading…' : 'Refresh'} onPress={() => { void books.refresh(); }} disabled={!books.enabled || books.loading} />
        </View>
        {books.readAt ? <Text style={{ fontSize: 12 }}>Read {books.readAt.slice(0, 16).replace('T', ' ')} UTC · {books.input.revenue.length} revenue rows · {books.input.disbursements.length} payouts · {books.input.manual.length} recorded entries · {blocking.length} to fix</Text> : null}
      </AdminPanel>

      {books.enabled ? <>
        <AdminPills label="Section" items={BOOKS_TABS.map(({ id, label }) => ({ id, label }))} value={tab} onChange={setTab} />
        <Text style={{ fontSize: 12 }}>{`Owned by ${owner}`}</Text>
      </> : null}

      {/* Record, void, close and file exports announce their result beside their own control (one live region each);
          the filtered-transactions export reports here, above its tab. */}
      {message?.action === 'transactions' ? <View accessibilityLiveRegion="polite" aria-live="polite"><AdminNotice text={message.text} tone={message.tone} /></View> : null}

      {books.enabled && !loaded ? <AdminNotice tone="warn" text={books.loading ? 'Reading the books… Figures, exports and closing appear once every source is read.' : 'The books have not been read yet. Refresh to read them.'} /> : null}

      {books.enabled && loaded && tab === 'overview' ? <View style={{ gap: 28 }}>{booksSectionsFor(view, OVERVIEW_SECTION_IDS).map((section) => <AdminReportSection key={section.id} section={section} />)}</View> : null}
      {books.enabled && loaded && tab === 'transactions' ? <BooksTransactionsTab key={period.key} entries={journal.entries} period={period} channels={channels} athleteNames={athleteNames} busy={busy != null || exportBlocked} onExport={(filename, csv) => { void download('transactions', filename, () => csv); }} /> : null}
      {books.enabled && loaded && tab === 'statements' ? <View style={{ gap: 28 }}>{booksSectionsFor(view, STATEMENT_SECTION_IDS).map((section) => <AdminReportSection key={section.id} section={section} />)}</View> : null}
      {books.enabled && loaded && tab === 'taxes' ? <BooksTaxesTab taxSections={booksSectionsFor(view, TAX_SECTION_IDS)} readiness={readiness} year={year} today={today()} /> : null}
      {books.enabled && loaded && tab === 'reconcile' ? <BooksReconcileTab rows={recon.rows} findings={recon.findings} sourceErrors={books.sourceErrors} /> : null}
      {books.enabled && loaded && tab === 'data' ? <BooksDataTab /> : null}
      {books.enabled && loaded && tab === 'record' ? <BooksRecordTab period={period} today={today()} entries={journal.entries} manual={books.input.manual} closes={books.closes} reopens={books.reopens} athletes={athleteNames} manualConfigured={books.manualConfigured} manualReadFailed={Boolean(books.errors.manual)} blockingCount={blocking.length} busy={busy} message={message} run={run} /> : null}
      {books.enabled && loaded && tab === 'export' ? <AdminPanel>
        <Text style={{ fontSize: 14 }}>QuickBooks Online: Settings → Import data → Journal entries, then the chart of accounts first if the accounts are new. The daily file rolls each day into one journal per stream, with no athlete names or ids. Filtered transactions export from the Transactions tab.</Text>
        {exportBlocked ? <AdminNotice tone="danger" text="Exports are off until every source is read completely and the books balance. Chart of accounts stays available." /> : null}
        {qboDaily.lines > QBO_MAX_LINES ? <AdminNotice tone="warn" text={`This period has ${qboDaily.lines} QuickBooks lines; QuickBooks imports up to ${QBO_MAX_LINES} per file. Export by month instead.`} /> : null}
        {STRIPE_TEST_MODE ? <AdminNotice tone="warn" text="Stripe is in test mode. Use these files to practise the import in a QuickBooks sandbox company, not your real books." /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <AdminBtn kind="primary" label="QuickBooks journal (daily)" disabled={exportBlocked || busy != null || !inPeriod.length} onPress={() => { void download('qbo', `tapuai-quickbooks-journal-${period.key}.csv`, () => qboDaily.csv); }} />
          <AdminBtn label="QuickBooks journal (each record)" disabled={exportBlocked || busy != null || !inPeriod.length} onPress={() => { void download('qbo-detail', `tapuai-quickbooks-journal-detail-${period.key}.csv`, () => qboJournalCsv(inPeriod, 'detail').csv); }} />
          <AdminBtn label="General ledger (CSV)" disabled={exportBlocked || busy != null || !inPeriod.length} onPress={() => { void download('gl', `tapuai-general-ledger-${period.key}.csv`, () => generalLedgerCsv(inPeriod)); }} />
          <AdminBtn label="Chart of accounts" disabled={busy != null} onPress={() => { void download('coa', 'tapuai-chart-of-accounts.csv', chartOfAccountsCsv); }} />
          <AdminBtn label={`Tax pack ${year}`} disabled={exportBlocked || busy != null} onPress={() => { void download('tax', `tapuai-tax-pack-${year}.csv`, () => taxSummaryCsv(tax)); }} />
        </View>
        {message && ['qbo', 'qbo-detail', 'gl', 'coa', 'tax'].includes(message.action) ? <View accessibilityLiveRegion="polite" aria-live="polite"><AdminNotice text={message.text} tone={message.tone} /></View> : null}
        {Platform.OS !== 'web' ? <Text style={{ fontSize: 12 }}>On a phone the file opens in the share sheet; send it to yourself or save it to Files. The browser admin downloads a .csv.</Text> : null}
      </AdminPanel> : null}
    </AdminPage>
  );
}
