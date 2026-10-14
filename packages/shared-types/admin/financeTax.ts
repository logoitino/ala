/**
 * Tax calendar and tax-readiness checklist (BOOKS-02). Owned by TAX, with INFO_RETURNS (W-9 / 1099)
 * and SALES_TAX. Shown on the Taxes tab of the Finance & Books hub. Federal dates assume a calendar
 * year and a single-member LLC filing Schedule C (the Wave 1 plan); the CPA confirms. A date that falls
 * on a weekend, a federal holiday or DC Emancipation Day moves to the next business day.
 * This is preparation for the owner's CPA, not tax advice.
 */
import { INFO_RETURN_REVIEW_CENTS, nextBusinessDay } from './bookkeeping';

export type TaxOwner = 'TAX' | 'INFO_RETURNS' | 'SALES_TAX' | 'BOOKKEEPER' | 'CONTROLLER';

export type TaxDeadline = {
  date: string;
  title: string;
  form: string;
  owner: TaxOwner;
  /** When this deadline applies to Tapua'i. */
  appliesWhen: string;
};

export { nextBusinessDay };

const ESTIMATE_WHEN = "Expected tax for the year is $1,000 or more (safe harbor: pay 100% of last year's tax, 110% above $150,000 AGI); the CPA sets the amount";

/** @purpose Federal deadlines that fall in calendar year `year`, oldest first. */
export function taxCalendar(year: number): TaxDeadline[] {
  const rows: TaxDeadline[] = [
    { date: `${year}-01-15`, title: `Estimated tax, period 4 (Sep–Dec ${year - 1})`, form: '1040-ES', owner: 'TAX', appliesWhen: ESTIMATE_WHEN },
    { date: `${year}-01-31`, title: `1099-NEC to payees and the IRS for ${year - 1}`, form: '1099-NEC', owner: 'INFO_RETURNS', appliesWhen: `A person or business was paid ${'$' + (INFO_RETURN_REVIEW_CENTS / 100).toLocaleString('en-US')} or more for services` },
    { date: `${year}-01-31`, title: `1099-MISC copies to payees for ${year - 1}`, form: '1099-MISC', owner: 'INFO_RETURNS', appliesWhen: 'Rents, prizes or other reportable payments at or above the threshold' },
    { date: `${year}-03-31`, title: `1099-MISC e-filed with the IRS for ${year - 1}`, form: '1099-MISC', owner: 'INFO_RETURNS', appliesWhen: 'Any 1099-MISC was issued' },
    { date: `${year}-04-15`, title: `${year - 1} income tax return (or extension)`, form: '1040 + Schedule C / 4868', owner: 'TAX', appliesWhen: 'Always, once the business exists' },
    { date: `${year}-04-15`, title: `Estimated tax, period 1 (Jan–Mar ${year})`, form: '1040-ES', owner: 'TAX', appliesWhen: ESTIMATE_WHEN },
    { date: `${year}-06-15`, title: `Estimated tax, period 2 (Apr–May ${year})`, form: '1040-ES', owner: 'TAX', appliesWhen: ESTIMATE_WHEN },
    { date: `${year}-09-15`, title: `Estimated tax, period 3 (Jun–Aug ${year})`, form: '1040-ES', owner: 'TAX', appliesWhen: ESTIMATE_WHEN },
    { date: `${year}-10-15`, title: `Extended ${year - 1} return due`, form: '1040 + Schedule C', owner: 'TAX', appliesWhen: 'An extension was filed in April' },
  ];
  return rows.map((row) => ({ ...row, date: nextBusinessDay(row.date) })).sort((a, b) => a.date.localeCompare(b.date));
}

/** @purpose The next `count` deadlines on or after `today`, crossing into next year when needed. */
export function upcomingDeadlines(today: string, count = 4): TaxDeadline[] {
  const year = Number(today.slice(0, 4));
  return [...taxCalendar(year), ...taxCalendar(year + 1)].filter((row) => row.date >= today).slice(0, count);
}

/** Monthly close and tax-prep calendar the Finance team runs (FINANCE_OPERATIONS.md). */
export const MONTHLY_CLOSE_STEPS: { day: string; step: string; owner: TaxOwner }[] = [
  { day: 'Business day 1–3', step: 'Record Stripe fees and Stripe payouts to the bank from the Stripe balance report', owner: 'BOOKKEEPER' },
  { day: 'Business day 1–3', step: 'Record every receipt (software, app stores, counsel, marketing) with a reference', owner: 'BOOKKEEPER' },
  { day: 'Business day 4', step: 'Reconcile tab all green; Suspense zero; no held account below zero', owner: 'CONTROLLER' },
  { day: 'Business day 5', step: 'Close the month; export the QuickBooks daily journal and import it', owner: 'CONTROLLER' },
  { day: '10 days before each estimated-tax due date', step: 'Net for the estimated-tax period (Jan–Mar, Apr–May, Jun–Aug, Sep–Dec) to the owner and CPA', owner: 'TAX' },
  { day: 'Monthly', step: 'Drip and Vault sales by month for the sales-tax watch', owner: 'SALES_TAX' },
  { day: 'Monthly', step: 'Payee year totals against the 1099 review line', owner: 'INFO_RETURNS' },
];

export type ReadinessState = 'ready' | 'partial' | 'missing';

export type TaxReadinessItem = { id: string; item: string; owner: TaxOwner; state: ReadinessState; detail: string };

/**
 * @purpose What is and is not in place for taxes, from facts the desk knows. Owner-side facts (a CPA,
 *   an LLC, a business bank account) are always "missing" until someone records them in FINANCE_OPERATIONS.md.
 */
export function taxReadiness(facts: { manualConfigured: boolean; coverFeeColumn: boolean; hasExpenseEntries: boolean; hasStripeFeeEntries: boolean; liveMode: boolean; payeesOverThreshold: number }): TaxReadinessItem[] {
  return [
    { id: 'books', item: 'Books separate Tapua\'i income from money held for families', owner: 'CONTROLLER', state: 'ready', detail: 'Finance & Books hub; liabilities 2000 / 2010 / 2100.' },
    { id: 'expenses', item: 'Expenses recorded with receipts', owner: 'BOOKKEEPER', state: !facts.manualConfigured ? 'missing' : facts.hasExpenseEntries ? 'ready' : 'partial', detail: facts.manualConfigured ? 'Record every business cost in Record & close.' : 'Needs the bookkeeping migration.' },
    { id: 'stripe-fees', item: 'Stripe processing fees recorded', owner: 'BOOKKEEPER', state: !facts.manualConfigured ? 'missing' : facts.hasStripeFeeEntries ? 'ready' : 'partial', detail: 'Monthly total from Stripe Reports → Balance until per-charge fees exist.' },
    { id: 'card-fees', item: 'Card fees covered by donors captured', owner: 'TAX', state: facts.coverFeeColumn ? 'ready' : 'missing', detail: facts.coverFeeColumn ? 'The donation table records the covered fee.' : 'Needs the bookkeeping migration.' },
    { id: '1099k', item: 'Stripe 1099-K can be reconciled', owner: 'TAX', state: 'partial', detail: 'Tax pack shows charges through Stripe and pass-through money; Stripe payment ids are not yet on revenue rows.' },
    { id: 'w9', item: 'W-9 on file before any payee is paid', owner: 'INFO_RETURNS', state: 'missing', detail: `Not built. ${facts.payeesOverThreshold} payee(s) at or above the review line this year.` },
    { id: 'sales-tax', item: 'Sales tax plan for Drip and Vault', owner: 'SALES_TAX', state: 'missing', detail: 'No buyer state recorded and no collection set up. Drip stays off until decided.' },
    { id: 'entity', item: 'LLC formed, EIN, business bank account', owner: 'TAX', state: 'missing', detail: 'Owner action for Wave 1 (COMPANY_PHASES).' },
    { id: 'cpa', item: 'CPA engaged with the question list', owner: 'TAX', state: 'missing', detail: 'Owner action; questions in BOOKKEEPING.md §8.' },
    { id: 'live', item: 'Books contain real money', owner: 'CONTROLLER', state: facts.liveMode ? 'ready' : 'missing', detail: facts.liveMode ? 'Live Stripe key detected.' : 'Stripe test mode: practice data only.' },
  ];
}

