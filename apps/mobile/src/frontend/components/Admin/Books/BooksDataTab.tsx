/**
 * Data tab of the Finance & Books hub (BOOKS-02; owned by FINANCE_DATA, reviewed by
 * INTERNAL_CONTROLS): the finance data catalog — every money column, what it means, how the books
 * treat it and what is still missing — plus money with no column of its own and who owns each area.
 * A unit test keeps the catalog in step with `schema.sql`.
 */
import { View } from 'react-native';

import { AdminReportSection } from '@/components/Admin/Reports/AdminReportSection';
import type { ReportSection } from '@/components/Admin/Reports/reportPages';
import { FINANCE_DATA_CATALOG, FINANCE_IMPLIED_MONEY, type CatalogTreatment } from '@tapuai/shared-types/admin/financeCatalog';

const TREATMENT_WORD: Record<CatalogTreatment, string> = { posted: 'Posted', derived: 'Running total (already posted)', control: 'Routing or limit', 'not-yet-posted': 'Not booked yet', reference: 'Matching reference' };

/** Who owns what in Finance and Accounting, as shown to the team. */
export const FINANCE_TEAM: [string, string, string][] = [
  ['CFO', 'Owner', 'Head of Finance and Accounting; accepts money-recording changes; requests data through the CTO'],
  ['CONTROLLER', 'CFO', 'Chart of accounts, posting rules, statements, month-end close, QuickBooks export'],
  ['BOOKKEEPER', 'CONTROLLER', 'Stripe fees, expenses, payouts to bank, receipts, Suspense'],
  ['INTERNAL_CONTROLS', 'CONTROLLER', 'Data catalog coverage, reconciliation, closed-month drift, sign-off before close'],
  ['TAX', 'CFO', 'All taxes: return lines, estimated tax, tax pack, CPA liaison, 1099-K reconciliation'],
  ['INFO_RETURNS', 'TAX', 'W-9 and 1099 review for every payee'],
  ['SALES_TAX', 'TAX', 'Drip and Vault sales tax, nexus watch, collection plan'],
  ['TREASURY', 'CFO', 'Stripe balance versus bank, money held for families, payout review'],
  ['FPA', 'CFO', 'Budgets, unit economics, plan versus actual'],
  ['FINANCE_DATA', 'ENGINEERING (CTO)', 'Dev-team engineer building this data, the checks and the exports for Finance'],
];

/** @purpose Catalog, implied money and team ownership tables. */
export function BooksDataTab() {
  const gaps = FINANCE_DATA_CATALOG.filter((row) => row.gap).length + FINANCE_IMPLIED_MONEY.length;
  const sections: ReportSection[] = [
    {
      id: 'catalog',
      title: 'Finance data catalog',
      hint: `${FINANCE_DATA_CATALOG.length} money columns · ${gaps} with a known gap`,
      sentences: ['Every column that holds money or decides where it goes. A new money column cannot land without an entry here: the check suite compares this list with the database schema.'],
      tables: [{ title: 'Money columns', initiallyOpen: true, source: 'packages/shared-types/admin/financeCatalog.ts', table: { columns: ['Table', 'Column', 'Unit', 'Treatment', 'Books', 'Owner', 'Known gap'], rows: FINANCE_DATA_CATALOG.map((row) => [row.table, row.column, row.unit, TREATMENT_WORD[row.treatment], row.books, row.owner, row.gap ?? '']) } }],
    },
    {
      id: 'implied',
      title: 'Money with no column of its own',
      tables: [{ title: 'Implied money', initiallyOpen: true, table: { columns: ['Source', 'Meaning', 'Books', 'Owner', 'Gap'], rows: FINANCE_IMPLIED_MONEY.map((row) => [row.source, row.meaning, row.books, row.owner, row.gap]) } }],
    },
    {
      id: 'team',
      title: 'Who owns what',
      sentences: ['Finance work runs owner → CFO → lead → specialist. Data and screens for Finance are requested by the CFO and assigned by the CTO to FINANCE_DATA; the requesting finance role accepts the result.'],
      tables: [{ title: 'Finance and Accounting team', initiallyOpen: true, table: { columns: ['Role', 'Reports to', 'Owns'], rows: FINANCE_TEAM } }],
    },
  ];
  return <View style={{ gap: 28 }}>{sections.map((section) => <AdminReportSection key={section.id} section={section} />)}</View>;
}
