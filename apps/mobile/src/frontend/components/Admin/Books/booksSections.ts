/**
 * Books desk report sections (BOOKS-01): turns the journal into the open report sections the rest of
 * the main admin uses — summary, checks, profit and loss, money held for others, trial balance,
 * journal and the tax-year pack. Pure: the screen passes the snapshot in; nothing is fetched here.
 * Athlete names appear on screen only; exports use the pseudonymous athlete reference.
 */
import {
  athleteHeld,
  athleteRef,
  booksUsd,
  entriesBetween,
  heldRollForward,
  INFO_RETURN_REVIEW_CENTS,
  ledgerAccount,
  profitAndLoss,
  taxYearSummary,
  trialBalance,
  type BookIssue,
  type JournalEntry,
  type Period,
  type RevenueLogInput,
} from '@tapuai/shared-types/admin/bookkeeping';
import type { ReportSection } from '../Reports/reportPages';

export type BooksView = {
  period: Period;
  entries: JournalEntry[];
  issues: BookIssue[];
  revenue: RevenueLogInput[];
  playerNames: Record<string, string>;
};

/** Rows shown in the on-screen journal; the CSV export always has every line. */
export const JOURNAL_SCREEN_LINES = 300;

const SEVERITY_WORD: Record<BookIssue['severity'], string> = { block: 'Stop', warn: 'Review', info: 'Note' };

/** Tab groups of the Finance & Books hub; each tab renders only its own sections. */
export const OVERVIEW_SECTION_IDS = ['summary', 'checks'];
export const STATEMENT_SECTION_IDS = ['pnl', 'held', 'trial', 'journal'];
export const TAX_SECTION_IDS = ['tax'];

/** @purpose Sections for one tab of the hub (`ids` from the constants above). */
export function booksSectionsFor(view: BooksView, ids: string[]): ReportSection[] {
  return booksSections(view).filter((section) => ids.includes(section.id));
}

/** @purpose Every report section of the Books desk for one period. */
export function booksSections({ period, entries, issues, revenue, playerNames }: BooksView): ReportSection[] {
  const inPeriod = entriesBetween(entries, period.from, period.to);
  const toDate = entriesBetween(entries, null, period.to);
  const pnl = profitAndLoss(inPeriod);
  const held = heldRollForward(entries, period);
  const families = held.filter((row) => row.code !== '2100');
  const sum = (rows: typeof held, key: 'added' | 'paidOut' | 'closing') => rows.reduce((total, row) => total + row[key], 0);
  const tb = trialBalance(toDate);
  const tax = taxYearSummary(entries, Number(period.to.slice(0, 4)), revenue);
  const nameByRef = Object.fromEntries(Object.entries(playerNames).map(([id, name]) => [athleteRef(id)!, name]));
  const athletes = athleteHeld(entries, period.to).filter((row) => row.held !== 0 || row.donations || row.vault);
  const lineCount = inPeriod.reduce((total, entry) => total + entry.lines.length, 0);
  const journalRows: string[][] = [];
  for (const entry of [...inPeriod].reverse()) {
    for (const line of entry.lines) {
      if (journalRows.length >= JOURNAL_SCREEN_LINES) break;
      journalRows.push([entry.date, ledgerAccount(line.account)?.name ?? line.account, line.debit ? booksUsd(line.debit) : '', line.credit ? booksUsd(line.credit) : '', entry.memo, line.athleteRef ? nameByRef[line.athleteRef] ?? line.athleteRef : '']);
    }
  }

  return [
    {
      id: 'summary',
      title: period.label,
      hint: `${inPeriod.length} entries · UTC days ${period.from} to ${period.to}`,
      sentences: [
        "New gifts are fully allocated to the family, with no Tapua'i gift cut; historical allocations remain as recorded. The family's gift balance, the athlete's 80% of a Vault sale and the operator's 85% of a booster sponsorship are held for them until paid out. Only recorded Tapua'i revenue is income.",
      ],
      kpis: [
        { label: "Tapua'i income", value: booksUsd(pnl.totalIncome), hint: "Platform shares, optional tips for Tapua'i, Drip and covered card fees" },
        { label: 'Expenses recorded', value: booksUsd(pnl.totalExpenses), hint: 'Stripe fees and costs entered below' },
        { label: "Net for Tapua'i", value: booksUsd(pnl.net), tone: pnl.net < 0 ? 'warn' : undefined, hint: 'Income minus recorded expenses' },
        { label: 'Received for families', value: booksUsd(sum(families, 'added')), hint: 'Gifts and Vault earnings, not income' },
        { label: 'Paid out to families', value: booksUsd(sum(families, 'paidOut')), hint: 'Payouts marked paid' },
        { label: 'Still held for families', value: booksUsd(sum(families, 'closing')), tone: sum(families, 'closing') < 0 ? 'danger' : undefined, hint: `As of ${period.to}` },
      ],
    },
    {
      id: 'checks',
      title: 'Before you hand this over',
      hint: issues.length ? `${issues.length} to look at` : 'Nothing found',
      sentences: issues.length ? issues.map((issue) => `${SEVERITY_WORD[issue.severity]}: ${issue.title}${issue.count && issue.count > 1 ? ` (${issue.count} rows)` : ''}. ${issue.detail}`) : ['The books balance, nothing is in Suspense and every row posted.'],
    },
    {
      id: 'pnl',
      title: 'Profit and loss',
      hint: period.label,
      tables: [{
        title: `Profit and loss, ${period.label}`,
        initiallyOpen: true,
        source: 'Journal built from company_revenue_logs, disbursements and recorded entries',
        table: {
          columns: ['Account', 'Code', 'Amount'],
          rows: [
            ...pnl.income.map((row) => [row.name, row.code, booksUsd(row.balance)]),
            ['Total income', '', booksUsd(pnl.totalIncome)],
            ...pnl.expenses.map((row) => [row.name, row.code, booksUsd(row.balance)]),
            ['Total expenses', '', booksUsd(pnl.totalExpenses)],
            ["Net for Tapua'i", '', booksUsd(pnl.net)],
          ],
        },
      }],
    },
    {
      id: 'held',
      title: 'Held for families and partners',
      hint: 'Liabilities, not income',
      sentences: ['Each athlete line below is a subledger; together they equal the two family accounts above it.'],
      tables: [
        { title: 'Money held, opening to closing', initiallyOpen: true, table: { columns: ['Account', 'Opening', 'Added', 'Paid out or reduced', 'Closing'], rows: held.map((row) => [row.name, booksUsd(row.opening), booksUsd(row.added), booksUsd(row.paidOut), booksUsd(row.closing)]) } },
        { title: 'Held per athlete', table: { columns: ['Athlete', 'Gifts', 'Vault', 'Paid out', 'Held'], rows: athletes.map((row) => [nameByRef[row.athleteRef] ?? row.athleteRef, booksUsd(row.donations), booksUsd(row.vault), booksUsd(row.paidOut), booksUsd(row.held)]) } },
      ],
    },
    {
      id: 'trial',
      title: 'Trial balance',
      hint: `All entries through ${period.to}`,
      sentences: [tb.balanced ? `Balanced: debits and credits are both ${booksUsd(tb.debit)}.` : `Not balanced: debits ${booksUsd(tb.debit)}, credits ${booksUsd(tb.credit)}.`],
      tables: [{ title: `Trial balance through ${period.to}`, table: { columns: ['Account', 'Code', 'Debits', 'Credits', 'Balance'], rows: tb.rows.map((row) => [row.name, row.code, booksUsd(row.debit), booksUsd(row.credit), booksUsd(row.balance)]) } }],
    },
    {
      id: 'journal',
      title: 'Journal',
      hint: `${lineCount} lines`,
      sentences: [lineCount > JOURNAL_SCREEN_LINES ? `Showing the newest ${JOURNAL_SCREEN_LINES} of ${lineCount} lines. The general ledger export has every line.` : 'Newest first. The general ledger export has the same lines with source ids.'],
      tables: [{ title: `Journal, ${period.label}`, table: { columns: ['Date', 'Account', 'Debit', 'Credit', 'Memo', 'Athlete'], rows: journalRows } }],
    },
    {
      id: 'tax',
      title: `Tax year ${tax.year}`,
      hint: 'For the CPA',
      sentences: [
        "Gross receipts are Tapua'i's shares only. Money held for families passes through and is not income, but Stripe's 1099-K reports the full charges, so give the CPA the pass-through line to reconcile the two.",
        'Gifts to individual athletes are personal gifts and are not tax-deductible.',
        `Payees at or above ${booksUsd(INFO_RETURN_REVIEW_CENTS)} in a year are flagged for 1099 review. Confirm the current threshold and who files with the CPA.`,
        tax.merchSalesByMonth.length ? 'Drip sales are listed by month because sales tax may apply where buyers live; Tapua\'i does not collect it yet.' : 'No Drip sales this year, so there is no sales tax to review.',
      ],
      kpis: [
        { label: 'Gross receipts', value: booksUsd(tax.grossReceipts), hint: "Tapua'i's shares only" },
        { label: 'Net profit', value: booksUsd(tax.net), hint: 'After recorded costs' },
        { label: 'Passed through', value: booksUsd(tax.passThrough.received), hint: 'Owed to families and partners' },
        { label: 'Charges through Stripe', value: booksUsd(tax.stripeGrossEstimate), hint: 'Compare with the 1099-K' },
      ],
      tables: [
        { title: 'Net by estimated-tax payment period', initiallyOpen: true, table: { columns: ['Period', 'Net', 'Payment due'], rows: tax.quarters.map((q) => [q.label, booksUsd(q.net), q.dueDate]) } },
        { title: 'Expenses by return line', table: { columns: ['Line', 'Amount'], rows: tax.expensesByLine.map((line) => [line.taxLine, booksUsd(line.amount)]) } },
        { title: 'Payees to review', table: { columns: ['Payee', 'Kind', 'Earned', 'Paid', '1099 review'], rows: tax.payees.map((payee) => [nameByRef[payee.payee] ?? payee.payee, payee.kind === 'athlete-vault' ? 'Vault earnings' : 'Booster operator share', booksUsd(payee.earned), payee.paid == null ? 'Recorded by hand' : booksUsd(payee.paid), payee.overThreshold ? 'Yes' : 'No']) } },
        { title: 'Drip sales by month', table: { columns: ['Month', 'Sales'], rows: tax.merchSalesByMonth.map((month) => [month.month, booksUsd(month.amount)]) } },
      ],
    },
  ];
}
