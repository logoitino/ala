/**
 * Books (BOOKS-01): Tapua'i's own double-entry bookkeeping, derived from the money tables the app
 * already writes. Every revenue-log row, paid disbursement and hand-entered expense becomes one
 * balanced journal entry against a fixed chart of accounts. Trial balance, profit and loss, the
 * "held for families" roll-forward, the tax-year pack and the QuickBooks / general-ledger CSV
 * exports are all read from that one journal, so every report agrees with every export.
 *
 * Accounting rules, in plain words (docs/engineering/design/BOOKKEEPING.md):
 * - A gift is mostly not Tapua'i's money. The 90% for the family is a liability ("held for
 *   families") until it is paid out; only the 10% share is Tapua'i income.
 * - Every amount is integer cents. Dates are UTC calendar days (`YYYY-MM-DD`).
 * - Nothing is ever edited in place: a correction is a reversing entry.
 * - A row that does not add up is still posted, with the difference in Suspense, so the books
 *   balance and the problem stays visible instead of disappearing.
 *
 * Pure functions only: no fetching. Money words follow docs/product/VOICE.md — "tip" appears only
 * for the optional tip to Tapua'i.
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type LedgerAccount = {
  code: string;
  name: string;
  type: AccountType;
  /** QuickBooks Online account type (top-level list every QBO company has). */
  qboType: string;
  /** Suggested QuickBooks detail type; pick the closest one if your company file names it differently. */
  qboDetail: string;
  /** Where the total usually lands on a return. Confirm with the CPA once the entity type is set. */
  taxLine: string;
  description: string;
};

/**
 * Chart of accounts. Codes are stable: the SQL seed in
 * `supabase/migrations/20261012210000_bookkeeping_ledger.sql` must list the same codes.
 */
export const CHART_OF_ACCOUNTS: LedgerAccount[] = [
  { code: '1000', name: 'Business bank account', type: 'asset', qboType: 'Bank', qboDetail: 'Checking', taxLine: 'Balance sheet', description: "Tapua'i's operating bank account; Stripe payouts land here." },
  { code: '1010', name: 'Stripe balance', type: 'asset', qboType: 'Bank', qboDetail: 'Cash on hand', taxLine: 'Balance sheet', description: 'Charges collected by Stripe and not yet paid out to the bank.' },
  { code: '1999', name: 'Suspense (needs review)', type: 'asset', qboType: 'Other Current Asset', qboDetail: 'Other Current Assets', taxLine: 'Clear before filing', description: 'Differences on rows that did not add up. Should be zero before a period is closed.' },
  { code: '2000', name: 'Gifts held for families', type: 'liability', qboType: 'Other Current Liability', qboDetail: 'Other Current Liabilities', taxLine: 'Balance sheet (not income)', description: "The family's 90% of each gift, owed until it is paid out." },
  { code: '2010', name: 'Vault earnings held for athletes', type: 'liability', qboType: 'Other Current Liability', qboDetail: 'Other Current Liabilities', taxLine: 'Balance sheet (not income)', description: "The athlete's 80% of Exclusive / Vault sales, owed until it is paid out." },
  { code: '2100', name: 'Booster operator payable', type: 'liability', qboType: 'Other Current Liability', qboDetail: 'Other Current Liabilities', taxLine: 'Balance sheet (not income)', description: "The operator's 85% of booster sponsorships." },
  { code: '2200', name: 'Sales tax payable', type: 'liability', qboType: 'Other Current Liability', qboDetail: 'Sales Tax Payable', taxLine: 'Balance sheet', description: 'Sales tax collected on Drip merchandise. Not collected yet.' },
  { code: '2300', name: 'Owed to owner (expenses paid personally)', type: 'liability', qboType: 'Other Current Liability', qboDetail: 'Other Current Liabilities', taxLine: 'Balance sheet', description: "Business costs the owner paid from a personal card, to be repaid or converted to a contribution." },
  { code: '3000', name: 'Owner contributions', type: 'equity', qboType: 'Equity', qboDetail: "Owner's Equity", taxLine: 'Balance sheet', description: 'Money the owner put into the business.' },
  { code: '3100', name: 'Owner draws', type: 'equity', qboType: 'Equity', qboDetail: "Owner's Equity", taxLine: 'Balance sheet', description: 'Money the owner took out of the business.' },
  { code: '4000', name: 'Platform share of gifts', type: 'revenue', qboType: 'Income', qboDetail: 'Service/Fee Income', taxLine: 'Gross receipts', description: "Tapua'i's disclosed 10% of each gift." },
  { code: '4010', name: "Optional tips to Tapua'i", type: 'revenue', qboType: 'Income', qboDetail: 'Service/Fee Income', taxLine: 'Gross receipts', description: "The optional tip a giver adds for Tapua'i at checkout (100% Tapua'i)." },
  { code: '4020', name: 'Vault platform share', type: 'revenue', qboType: 'Income', qboDetail: 'Service/Fee Income', taxLine: 'Gross receipts', description: "Tapua'i's 20% of Exclusive / Vault sales." },
  { code: '4030', name: 'Booster sponsorship share', type: 'revenue', qboType: 'Income', qboDetail: 'Service/Fee Income', taxLine: 'Gross receipts', description: "Tapua'i's 15% of booster sponsorships." },
  { code: '4040', name: 'Drip merchandise sales', type: 'revenue', qboType: 'Income', qboDetail: 'Sales of Product Income', taxLine: 'Gross receipts (sales tax may apply)', description: 'Drip store orders (100% Tapua\'i).' },
  { code: '4050', name: 'Processing fees covered by givers', type: 'revenue', qboType: 'Income', qboDetail: 'Service/Fee Income', taxLine: 'Gross receipts', description: 'The processing fee a giver chose to cover at checkout; offsets processing fees.' },
  { code: '4900', name: 'Refunds and chargebacks', type: 'revenue', qboType: 'Income', qboDetail: 'Discounts/Refunds Given', taxLine: 'Returns and allowances', description: "Money returned to givers or buyers, Tapua'i's share only." },
  { code: '5000', name: 'Card processing fees', type: 'expense', qboType: 'Expense', qboDetail: 'Bank Charges', taxLine: 'Commissions and fees', description: 'Stripe fees, from the monthly Stripe balance report.' },
  { code: '5010', name: 'Merchandise cost', type: 'expense', qboType: 'Cost of Goods Sold', qboDetail: 'Supplies & Materials - COGS', taxLine: 'Cost of goods sold', description: 'What Drip stock cost Tapua\'i.' },
  { code: '6000', name: 'Software and hosting', type: 'expense', qboType: 'Expense', qboDetail: 'Office/General Administrative Expenses', taxLine: 'Other expenses (software)', description: 'Supabase, Expo, domains and other subscriptions.' },
  { code: '6010', name: 'App store and developer fees', type: 'expense', qboType: 'Expense', qboDetail: 'Dues & subscriptions', taxLine: 'Other expenses', description: 'Apple Developer ($99/yr), Google Play ($25).' },
  { code: '6020', name: 'Legal and professional', type: 'expense', qboType: 'Expense', qboDetail: 'Legal & Professional Fees', taxLine: 'Legal and professional services', description: 'Counsel, CPA, entity filings.' },
  { code: '6030', name: 'Marketing and advertising', type: 'expense', qboType: 'Expense', qboDetail: 'Advertising/Promotional', taxLine: 'Advertising', description: 'Ads, printed QR cards, events.' },
  { code: '6040', name: 'Filmer rewards (paid by Tapua\'i)', type: 'expense', qboType: 'Expense', qboDetail: 'Other Miscellaneous Service Cost', taxLine: 'Contract labor (review 1099)', description: "Future: cash rewards to filmers from Tapua'i's own money, never from a gift." },
  { code: '6050', name: 'Game-day operator fees', type: 'expense', qboType: 'Expense', qboDetail: 'Other Miscellaneous Service Cost', taxLine: 'Contract labor (review 1099)', description: 'Future: payments to game-day stat operators.' },
  { code: '6090', name: 'Other business expenses', type: 'expense', qboType: 'Expense', qboDetail: 'Other Miscellaneous Expense', taxLine: 'Other expenses', description: 'Anything that fits nowhere else; say what it was in the memo.' },
  { code: '6100', name: 'Bank fees', type: 'expense', qboType: 'Expense', qboDetail: 'Bank Charges', taxLine: 'Other expenses', description: 'Bank account and wire fees.' },
];

const ACCOUNT_BY_CODE = new Map(CHART_OF_ACCOUNTS.map((account) => [account.code, account]));

export function ledgerAccount(code: string): LedgerAccount | null {
  return ACCOUNT_BY_CODE.get(code) ?? null;
}

/** Accounts whose normal balance is a debit; the rest are credit-normal. */
export function isDebitNormal(type: AccountType): boolean {
  return type === 'asset' || type === 'expense';
}

export type JournalLine = { account: string; debit: number; credit: number; athleteRef?: string | null; memo?: string };

export type JournalOrigin = 'revenue' | 'disbursement' | 'manual';

export type JournalEntry = {
  id: string;
  /** UTC day, `YYYY-MM-DD`. */
  date: string;
  origin: JournalOrigin;
  /** Revenue stream (`malo`, `tip`, `vault`…), `disbursement`, or the manual entry kind. */
  source: string;
  sourceId: string;
  memo: string;
  lines: JournalLine[];
};

export type BookIssueSeverity = 'block' | 'warn' | 'info';

export type BookIssue = { id: string; severity: BookIssueSeverity; title: string; detail: string; count?: number };

/** A `company_revenue_logs` row as the admin client reads it. */
export type RevenueLogInput = {
  id: string;
  source: string;
  source_id?: string | null;
  label: string;
  gross_cents: number;
  platform_cents: number;
  payout_cents: number;
  payee_kind: string;
  player_id?: string | null;
  created_at: string;
};

export type DisbursementInput = {
  id: string;
  player_id: string | null;
  amount_cents: number;
  status: string;
  created_at: string;
  paid_at?: string | null;
};

export type ManualLineInput = { account_code: string; debit_cents: number; credit_cents: number; memo?: string | null; athlete_ref?: string | null };

export type ManualEntryInput = {
  id: string;
  entry_date: string;
  kind: string;
  memo: string;
  reference?: string | null;
  reverses_id?: string | null;
  voided_at?: string | null;
  lines: ManualLineInput[];
};

export type PeriodCloseInput = { period: string; closed_at: string; note?: string | null; totals?: Record<string, number> | null };

export type BooksInput = {
  revenue: RevenueLogInput[];
  disbursements: DisbursementInput[];
  manual: ManualEntryInput[];
};

/** Pseudonymous athlete reference used in exports, so a minor's name never leaves the admin app. */
export function athleteRef(playerId: string | null | undefined): string | null {
  const clean = (playerId ?? '').replace(/-/g, '').trim();
  return clean ? `ath-${clean.slice(0, 8)}` : null;
}

/** `YYYY-MM-DD` UTC day for an ISO time, or null when it cannot be read. */
export function utcDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : at.toISOString().slice(0, 10);
}

const cents = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/** Revenue stream → [family/payee liability account, Tapua'i income account]. */
const STREAM_ACCOUNTS: Record<string, { payable: string | null; income: string; title: string }> = {
  malo: { payable: '2000', income: '4000', title: 'Gift' },
  tip: { payable: null, income: '4010', title: "Tip to Tapua'i" },
  vault: { payable: '2010', income: '4020', title: 'Vault sale' },
  booster: { payable: '2100', income: '4030', title: 'Booster sponsorship' },
  merch: { payable: null, income: '4040', title: 'Drip order' },
  card_fee: { payable: null, income: '4050', title: 'Processing fee covered by giver' },
};


export function streamTitle(source: string): string {
  return STREAM_ACCOUNTS[source]?.title ?? source;
}

/**
 * @purpose Post one revenue-log row: the whole charge lands in the Stripe balance, the payee's share
 *   becomes a liability and Tapua'i's share becomes income. Mismatches go to Suspense.
 */
export function journalFromRevenue(row: RevenueLogInput): { entry: JournalEntry | null; issues: BookIssue[] } {
  const rule = STREAM_ACCOUNTS[row.source];
  const date = utcDay(row.created_at);
  if (!rule) return { entry: null, issues: [{ id: `unknown-source:${row.id}`, severity: 'block', title: 'Unknown money stream', detail: `Revenue row ${row.id} has source "${row.source}", which the books do not know how to post. It is left out until a rule is added.` }] };
  if (!date) return { entry: null, issues: [{ id: `no-date:${row.id}`, severity: 'block', title: 'Revenue row with no date', detail: `Revenue row ${row.id} has no readable time and is left out.` }] };
  const gross = cents(row.gross_cents);
  const platform = cents(row.platform_cents);
  const payout = cents(row.payout_cents);
  // A negative amount is never clamped away: it is refused and shown, so money cannot vanish quietly.
  if (gross < 0 || platform < 0 || payout < 0) return { entry: null, issues: [{ id: `negative-amount:${row.id}`, severity: 'block', title: 'Revenue row with a negative amount', detail: `${rule.title} ${row.id} has gross ${gross}¢, Tapua'i ${platform}¢, payee ${payout}¢. Refunds are recorded as refund entries, not negative revenue rows; it is left out.` }] };
  if (gross === 0 && platform === 0 && payout === 0) return { entry: null, issues: [] };
  const ref = athleteRef(row.player_id);
  const lines: JournalLine[] = [{ account: '1010', debit: gross, credit: 0, memo: 'Charge collected by Stripe' }];
  const issues: BookIssue[] = [];
  if (rule.payable) {
    if (payout > 0) lines.push({ account: rule.payable, debit: 0, credit: payout, athleteRef: rule.payable === '2100' ? null : ref });
    if (platform > 0) lines.push({ account: rule.income, debit: 0, credit: platform });
  } else {
    // Single-owner streams are all Tapua'i income; a stray payout share is a data problem, not income.
    if (platform + payout > 0) lines.push({ account: rule.income, debit: 0, credit: platform + payout });
    if (payout > 0) issues.push({ id: `payout-on-own-stream:${row.id}`, severity: 'warn', title: 'Payee share on a Tapua\'i-only stream', detail: `${rule.title} ${row.id} records a ${payout}¢ payee share; it is booked as income.` });
  }
  const difference = gross - platform - payout;
  if (difference !== 0) {
    lines.push(difference > 0 ? { account: '1999', debit: 0, credit: difference, memo: 'Split did not add up' } : { account: '1999', debit: -difference, credit: 0, memo: 'Split did not add up' });
    issues.push({ id: `split-mismatch:${row.id}`, severity: 'warn', title: 'Split does not add up', detail: `${rule.title} ${row.id}: gross ${gross}¢ ≠ Tapua'i ${platform}¢ + payee ${payout}¢. The difference is in Suspense.` });
  }
  if (rule.payable && rule.payable !== '2100' && payout > 0 && !ref) {
    issues.push({ id: `no-athlete:${row.id}`, severity: 'warn', title: 'Held money with no athlete', detail: `${rule.title} ${row.id} owes a family or athlete but names no athlete, so it cannot be traced to one account.` });
  }
  return {
    entry: { id: `rev:${row.source}:${row.source_id || row.id}`, date, origin: 'revenue', source: row.source, sourceId: row.source_id || row.id, memo: cleanLabel(row.label) || rule.title, lines },
    issues,
  };
}

/**
 * SQL writes labels like "Mālo · Highlight via QR · New cleats · Kaleo". For gift and Vault labels
 * keep only the channel: the later segments are the athlete's name and free text a family typed (a Rally
 * or gear-goal title), and neither may reach an exported memo. Booster labels keep the business name.
 */
function cleanLabel(label: string): string {
  const parts = label.replace(/^M[aā]lo\s*·\s*/i, '').split('·').map((part) => part.trim()).filter(Boolean);
  if (/^(Highlight|QR link|Wishlist|Live feed|Profile|Rally|Vault)/.test(parts[0] ?? '')) return parts[0];
  return parts.join(' · ');
}

/**
 * @purpose Post a disbursement only once it is marked paid: the athlete's held money goes down with the
 *   Stripe balance. `held` is that athlete's balance in Gifts held (2000) and Vault earnings held
 *   (2010) just before the payout; the payout uses gifts first, then Vault earnings, and anything
 *   beyond both stays on 2000 so the shortfall shows as a negative balance.
 */
export function journalFromDisbursement(row: DisbursementInput, held: { donations: number; vault: number } = { donations: Infinity, vault: 0 }): JournalEntry | null {
  if (row.status !== 'paid') return null;
  const amount = Math.max(0, cents(row.amount_cents));
  const date = utcDay(row.paid_at) ?? utcDay(row.created_at);
  if (!amount || !date) return null;
  const ref = athleteRef(row.player_id);
  const fromDonations = Math.min(amount, Math.max(0, held.donations));
  const fromVault = Math.min(amount - fromDonations, Math.max(0, held.vault));
  const rest = amount - fromDonations - fromVault;
  const debits: JournalLine[] = [];
  if (fromDonations + rest > 0) debits.push({ account: '2000', debit: fromDonations + rest, credit: 0, athleteRef: ref });
  if (fromVault > 0) debits.push({ account: '2010', debit: fromVault, credit: 0, athleteRef: ref });
  return {
    id: `pay:${row.id}`,
    date,
    origin: 'disbursement',
    source: 'disbursement',
    sourceId: row.id,
    memo: 'Payout to family account',
    lines: [...debits, { account: '1010', debit: 0, credit: amount, memo: 'Paid out through Stripe' }],
  };
}

/** @purpose Post a hand-entered entry exactly as recorded (the database already checked it balances). */
export function journalFromManual(row: ManualEntryInput): { entry: JournalEntry | null; issues: BookIssue[] } {
  const date = utcDay(row.entry_date);
  const lines = row.lines.map((line): JournalLine => ({ account: line.account_code, debit: Math.max(0, cents(line.debit_cents)), credit: Math.max(0, cents(line.credit_cents)), memo: line.memo ?? undefined, athleteRef: line.athlete_ref ?? null }));
  const debit = lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit, 0);
  const unknown = lines.filter((line) => !ACCOUNT_BY_CODE.has(line.account));
  if (!date || debit !== credit || debit === 0 || unknown.length) {
    return { entry: null, issues: [{ id: `bad-manual:${row.id}`, severity: 'block', title: 'Recorded entry cannot be posted', detail: `Entry ${row.id} ${!date ? 'has no date' : unknown.length ? `uses unknown account ${unknown[0].account}` : 'does not balance'}; it is left out.` }] };
  }
  return { entry: { id: `man:${row.id}`, date, origin: 'manual', source: row.kind, sourceId: row.id, memo: [row.memo, row.reference ? `Ref ${row.reference}` : ''].filter(Boolean).join(' · '), lines }, issues: [] };
}

/** @purpose Build the whole journal, oldest first, and collect every posting problem. */
export function buildJournal(input: BooksInput): { entries: JournalEntry[]; issues: BookIssue[] } {
  const entries: JournalEntry[] = [];
  const issues: BookIssue[] = [];
  for (const row of input.revenue) {
    const posted = journalFromRevenue(row);
    if (posted.entry) entries.push(posted.entry);
    issues.push(...posted.issues);
  }
  for (const row of input.manual) {
    const posted = journalFromManual(row);
    if (posted.entry) entries.push(posted.entry);
    issues.push(...posted.issues);
  }
  // Payouts are posted in date order against each athlete's held balance on that day, so a payout
  // reduces gifts first, then Vault earnings (journalFromDisbursement).
  const byDate = (a: JournalEntry, b: JournalEntry) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
  entries.sort(byDate);
  const paid = input.disbursements
    .filter((row) => row.status === 'paid')
    .map((row) => ({ row, date: utcDay(row.paid_at) ?? utcDay(row.created_at) ?? '' }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.row.id.localeCompare(b.row.id));
  const balance = new Map<string, { donations: number; vault: number }>();
  const apply = (entry: JournalEntry) => {
    for (const line of entry.lines) {
      if (!line.athleteRef || (line.account !== '2000' && line.account !== '2010')) continue;
      const held = balance.get(line.athleteRef) ?? { donations: 0, vault: 0 };
      if (line.account === '2000') held.donations += line.credit - line.debit;
      else held.vault += line.credit - line.debit;
      balance.set(line.athleteRef, held);
    }
  };
  let next = 0;
  const payouts: JournalEntry[] = [];
  for (const { row, date } of paid) {
    while (next < entries.length && entries[next].date <= date) apply(entries[next++]);
    const ref = athleteRef(row.player_id);
    const entry = journalFromDisbursement(row, ref ? balance.get(ref) ?? { donations: 0, vault: 0 } : undefined);
    if (!entry) continue;
    if (!ref) issues.push({ id: `payout-no-athlete:${row.id}`, severity: 'warn', title: 'Payout with no athlete', detail: `Payout ${row.id} names no athlete, so it reduces no family's held balance.` });
    apply(entry);
    payouts.push(entry);
  }
  entries.push(...payouts);
  entries.sort(byDate);
  return { entries, issues };
}

export type PeriodKind = 'month' | 'quarter' | 'year';
export type Period = { kind: PeriodKind; from: string; to: string; label: string; key: string };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const lastDay = (year: number, month0: number) => new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();

/** @purpose The month / quarter / calendar year containing `anchor` (`YYYY-MM-DD`), with inclusive UTC days. */
export function periodFor(kind: PeriodKind, anchor: string): Period {
  const [y, m] = anchor.split('-').map(Number);
  const year = Number.isFinite(y) ? y : 1970;
  const month0 = Number.isFinite(m) ? Math.min(11, Math.max(0, m - 1)) : 0;
  if (kind === 'year') return { kind, from: `${year}-01-01`, to: `${year}-12-31`, label: String(year), key: String(year) };
  if (kind === 'quarter') {
    const q = Math.floor(month0 / 3);
    const endMonth0 = q * 3 + 2;
    return { kind, from: `${year}-${pad2(q * 3 + 1)}-01`, to: `${year}-${pad2(endMonth0 + 1)}-${pad2(lastDay(year, endMonth0))}`, label: `Q${q + 1} ${year}`, key: `${year}-Q${q + 1}` };
  }
  return { kind, from: `${year}-${pad2(month0 + 1)}-01`, to: `${year}-${pad2(month0 + 1)}-${pad2(lastDay(year, month0))}`, label: `${MONTHS[month0]} ${year}`, key: `${year}-${pad2(month0 + 1)}` };
}

/** @purpose Step a period backwards (-1) or forwards (+1). */
export function shiftPeriod(period: Period, step: number): Period {
  const [y, m] = period.from.split('-').map(Number);
  if (period.kind === 'year') return periodFor('year', `${y + step}-01-01`);
  const months = period.kind === 'quarter' ? 3 * step : step;
  const at = new Date(Date.UTC(y, m - 1 + months, 1));
  return periodFor(period.kind, at.toISOString().slice(0, 10));
}

export function entriesBetween(entries: JournalEntry[], from: string | null, to: string): JournalEntry[] {
  return entries.filter((entry) => (from == null || entry.date >= from) && entry.date <= to);
}

export type BalanceRow = { code: string; name: string; type: AccountType; debit: number; credit: number; balance: number };

/**
 * @purpose Sum every line per account. `balance` is signed toward the account's normal side, so an
 *   asset or expense is positive when debited and a liability, equity or income is positive when credited.
 */
export function trialBalance(entries: JournalEntry[]): { rows: BalanceRow[]; debit: number; credit: number; balanced: boolean } {
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const entry of entries) for (const line of entry.lines) {
    const row = totals.get(line.account) ?? { debit: 0, credit: 0 };
    row.debit += line.debit;
    row.credit += line.credit;
    totals.set(line.account, row);
  }
  const rows = CHART_OF_ACCOUNTS.filter((account) => totals.has(account.code)).map((account) => {
    const { debit, credit } = totals.get(account.code)!;
    return { code: account.code, name: account.name, type: account.type, debit, credit, balance: isDebitNormal(account.type) ? debit - credit : credit - debit };
  });
  const debit = rows.reduce((sum, row) => sum + row.debit, 0);
  const credit = rows.reduce((sum, row) => sum + row.credit, 0);
  return { rows, debit, credit, balanced: debit === credit };
}

/** @purpose Tapua'i's own profit and loss: income accounts minus expense accounts, for the entries given. */
export function profitAndLoss(entries: JournalEntry[]): { income: BalanceRow[]; expenses: BalanceRow[]; totalIncome: number; totalExpenses: number; net: number } {
  const { rows } = trialBalance(entries);
  const income = rows.filter((row) => row.type === 'revenue');
  const expenses = rows.filter((row) => row.type === 'expense');
  const totalIncome = income.reduce((sum, row) => sum + row.balance, 0);
  const totalExpenses = expenses.reduce((sum, row) => sum + row.balance, 0);
  return { income, expenses, totalIncome, totalExpenses, net: totalIncome - totalExpenses };
}

export type HeldRoll = { code: string; name: string; opening: number; added: number; paidOut: number; closing: number };

const HELD_ACCOUNTS = ['2000', '2010', '2100'];

/** @purpose Opening balance, money added, money paid out and closing balance for each "held for others" account. */
export function heldRollForward(allEntries: JournalEntry[], period: Pick<Period, 'from' | 'to'>): HeldRoll[] {
  return HELD_ACCOUNTS.map((code) => {
    let opening = 0;
    let added = 0;
    let paidOut = 0;
    for (const entry of allEntries) {
      if (entry.date > period.to) continue;
      for (const line of entry.lines) {
        if (line.account !== code) continue;
        if (entry.date < period.from) opening += line.credit - line.debit;
        else { added += line.credit; paidOut += line.debit; }
      }
    }
    return { code, name: ledgerAccount(code)!.name, opening, added, paidOut, closing: opening + added - paidOut };
  });
}

export type AthleteHeld = { athleteRef: string; playerId: string | null; donations: number; vault: number; paidOut: number; held: number };

/** @purpose Per-athlete subledger of money held for them, up to `to` (inclusive). */
export function athleteHeld(allEntries: JournalEntry[], to: string, playerIds: (string | null | undefined)[] = []): AthleteHeld[] {
  const idByRef = new Map(playerIds.filter((id): id is string => Boolean(id)).map((id) => [athleteRef(id)!, id]));
  const rows = new Map<string, AthleteHeld>();
  for (const entry of allEntries) {
    if (entry.date > to) continue;
    for (const line of entry.lines) {
      if (!line.athleteRef || (line.account !== '2000' && line.account !== '2010')) continue;
      const row = rows.get(line.athleteRef) ?? { athleteRef: line.athleteRef, playerId: idByRef.get(line.athleteRef) ?? null, donations: 0, vault: 0, paidOut: 0, held: 0 };
      if (line.account === '2000') row.donations += line.credit;
      else row.vault += line.credit;
      row.paidOut += line.debit;
      row.held += line.credit - line.debit;
      rows.set(line.athleteRef, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.held - a.held || a.athleteRef.localeCompare(b.athleteRef));
}

/**
 * Information-return review line. The IRS threshold for 1099-NEC / 1099-MISC is $2,000 for payments
 * made from 2026 (it was $600). Confirm the current figure with the CPA each January. Royalty-type
 * payments (possibly Vault earnings) report from $10 on 1099-MISC, and payments made through Stripe
 * Connect are reported by Stripe on a 1099-K instead; both are CPA calls the review table names.
 */
export const INFO_RETURN_REVIEW_CENTS = 200000;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const nthWeekday = (year: number, month0: number, weekday: number, n: number) => {
  const first = new Date(Date.UTC(year, month0, 1));
  return iso(new Date(Date.UTC(year, month0, 1 + ((weekday - first.getUTCDay() + 7) % 7) + (n - 1) * 7)));
};
const lastWeekday = (year: number, month0: number, weekday: number) => {
  const last = new Date(Date.UTC(year, month0 + 1, 0));
  return iso(new Date(Date.UTC(year, month0, last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7))));
};
/** A fixed-date holiday on a Saturday is observed Friday; on a Sunday, Monday. */
const observed = (day: string) => {
  const at = new Date(`${day}T00:00:00Z`);
  if (at.getUTCDay() === 6) at.setUTCDate(at.getUTCDate() - 1);
  else if (at.getUTCDay() === 0) at.setUTCDate(at.getUTCDate() + 1);
  return iso(at);
};

/**
 * @purpose Federal legal holidays (observed) plus DC Emancipation Day (April 16, observed), which the
 *   IRS also honours when a deadline falls on it. Used to move a tax deadline to the next business day.
 */
export function federalHolidays(year: number): Set<string> {
  return new Set([
    observed(`${year}-01-01`), nthWeekday(year, 0, 1, 3), nthWeekday(year, 1, 1, 3), lastWeekday(year, 4, 1),
    observed(`${year}-06-19`), observed(`${year}-07-04`), nthWeekday(year, 8, 1, 1), nthWeekday(year, 9, 1, 2),
    observed(`${year}-11-11`), nthWeekday(year, 10, 4, 4), observed(`${year}-12-25`), observed(`${year}-04-16`),
    observed(`${year + 1}-01-01`),
  ]);
}

/** @purpose A deadline that falls on a weekend or a federal / DC holiday moves to the next business day. */
export function nextBusinessDay(day: string): string {
  const at = new Date(`${day}T00:00:00Z`);
  for (;;) {
    const text = iso(at);
    const weekend = at.getUTCDay() === 0 || at.getUTCDay() === 6;
    if (!weekend && !federalHolidays(at.getUTCFullYear()).has(text)) return text;
    at.setUTCDate(at.getUTCDate() + 1);
  }
}

/**
 * Federal estimated-tax payment periods for a calendar year. They are not calendar quarters:
 * Jan–Mar (due Apr 15), Apr–May (Jun 15), Jun–Aug (Sep 15), Sep–Dec (Jan 15 of the next year).
 */
export function estimatedTaxPeriods(year: number): { label: string; from: string; to: string; dueDate: string }[] {
  return [
    { label: `Period 1 (Jan–Mar ${year})`, from: `${year}-01-01`, to: `${year}-03-31`, dueDate: nextBusinessDay(`${year}-04-15`) },
    { label: `Period 2 (Apr–May ${year})`, from: `${year}-04-01`, to: `${year}-05-31`, dueDate: nextBusinessDay(`${year}-06-15`) },
    { label: `Period 3 (Jun–Aug ${year})`, from: `${year}-06-01`, to: `${year}-08-31`, dueDate: nextBusinessDay(`${year}-09-15`) },
    { label: `Period 4 (Sep–Dec ${year})`, from: `${year}-09-01`, to: `${year}-12-31`, dueDate: nextBusinessDay(`${year + 1}-01-15`) },
  ];
}


export type PayeeReview = { payee: string; kind: 'athlete-vault' | 'booster-operator'; earned: number; paid: number | null; overThreshold: boolean };

export type TaxYearSummary = {
  year: number;
  grossReceipts: number;
  refunds: number;
  costOfSales: number;
  expensesByLine: { taxLine: string; amount: number }[];
  net: number;
  quarters: { label: string; net: number; dueDate: string }[];
  passThrough: { received: number; paidOut: number; heldAtYearEnd: number };
  stripeGrossEstimate: number;
  merchSalesByMonth: { month: string; amount: number }[];
  payees: PayeeReview[];
};

/** Booster payees are keyed on a typed business name; normalize so "Plate Lunch, LLC." and "plate lunch llc" match. */
const payeeKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * @purpose The numbers a CPA asks for at year end, read from the journal: Tapua'i's own receipts, cost
 *   of goods sold (Drip stock only) and other expenses by return line, net per estimated-tax payment
 *   period, money that only passed through (so a Stripe 1099-K can be reconciled), Drip sales by month
 *   for sales tax, and payees to review with what they earned and what they were paid.
 */
export function taxYearSummary(allEntries: JournalEntry[], year: number, revenue: RevenueLogInput[] = []): TaxYearSummary {
  const yearPeriod = periodFor('year', `${year}-01-01`);
  const inYear = entriesBetween(allEntries, yearPeriod.from, yearPeriod.to);
  const pnl = profitAndLoss(inYear);
  const refunds = pnl.income.filter((row) => row.code === '4900').reduce((sum, row) => sum - row.balance, 0);
  const grossReceipts = pnl.income.filter((row) => row.code !== '4900').reduce((sum, row) => sum + row.balance, 0);
  // Only merchandise cost is cost of goods sold; card processing fees are an ordinary expense (commissions and fees).
  const costOfSales = pnl.expenses.filter((row) => row.code === '5010').reduce((sum, row) => sum + row.balance, 0);
  const byLine = new Map<string, number>();
  for (const row of pnl.expenses) {
    if (row.code === '5010') continue;
    const line = ledgerAccount(row.code)?.taxLine ?? 'Other expenses';
    byLine.set(line, (byLine.get(line) ?? 0) + row.balance);
  }
  const quarters = estimatedTaxPeriods(year).map((period) => ({ label: period.label, net: profitAndLoss(entriesBetween(allEntries, period.from, period.to)).net, dueDate: period.dueDate }));
  const held = heldRollForward(allEntries, yearPeriod);
  // Charges collected = the gross of income events only; recorded entries (reversals, refunds) do not count.
  const stripeGrossEstimate = inYear.filter((entry) => entry.origin === 'revenue').reduce((sum, entry) => sum + entry.lines.filter((line) => line.account === '1010').reduce((t, line) => t + line.debit, 0), 0);
  const merch = new Map<string, number>();
  for (const entry of inYear) for (const line of entry.lines) if (line.account === '4040') merch.set(entry.date.slice(0, 7), (merch.get(entry.date.slice(0, 7)) ?? 0) + line.credit - line.debit);
  const payees = new Map<string, PayeeReview>();
  for (const entry of inYear) for (const line of entry.lines) {
    if (line.account === '2010' && line.athleteRef) {
      const row = payees.get(line.athleteRef) ?? { payee: line.athleteRef, kind: 'athlete-vault' as const, earned: 0, paid: 0, overThreshold: false };
      row.earned += line.credit;
      row.paid = (row.paid ?? 0) + line.debit;
      payees.set(line.athleteRef, row);
    }
  }
  const boosterNames = new Map(revenue.filter((row) => row.source === 'booster').map((row) => [row.source_id || row.id, row.label.replace(/^Booster\s*·\s*/i, '').trim() || 'Local booster']));
  for (const entry of inYear) {
    if (entry.source !== 'booster') continue;
    const name = boosterNames.get(entry.sourceId) ?? (entry.memo.replace(/^Booster\s*·\s*/i, '').trim() || 'Local booster');
    const earned = entry.lines.filter((line) => line.account === '2100').reduce((sum, line) => sum + line.credit, 0);
    const key = `booster:${payeeKey(name)}`;
    // Booster payouts are recorded by hand without a payee, so only earnings can be totalled per operator.
    const row = payees.get(key) ?? { payee: name, kind: 'booster-operator' as const, earned: 0, paid: null, overThreshold: false };
    row.earned += earned;
    payees.set(key, row);
  }
  return {
    year,
    grossReceipts,
    refunds,
    costOfSales,
    expensesByLine: [...byLine.entries()].map(([taxLine, amount]) => ({ taxLine, amount })).sort((a, b) => b.amount - a.amount),
    net: pnl.net,
    quarters,
    passThrough: {
      received: held.reduce((sum, row) => sum + row.added, 0),
      paidOut: held.reduce((sum, row) => sum + row.paidOut, 0),
      heldAtYearEnd: held.reduce((sum, row) => sum + row.closing, 0),
    },
    stripeGrossEstimate,
    merchSalesByMonth: [...merch.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount })),
    payees: [...payees.values()].map((row) => ({ ...row, overThreshold: (row.paid ?? row.earned) >= INFO_RETURN_REVIEW_CENTS })).sort((a, b) => b.earned - a.earned),
  };
}

export type BooksQualityContext = {
  period: Pick<Period, 'from' | 'to' | 'key' | 'kind'>;
  /** False until the bookkeeping migration is applied (no hand-entered entries or closes yet). */
  manualConfigured: boolean;
  /** True when the revenue read stopped at its page cap. */
  revenueTruncated: boolean;
  /** True when the revenue rows carry no Stripe payment id to match against deposits. */
  missingPaymentIds: boolean;
  /** Stripe is still in test mode (Wave 0). */
  testMode: boolean;
  closes: PeriodCloseInput[];
  queuedPayoutCents: number;
  /** False until the first read finishes; nothing is complete before that. */
  loaded?: boolean;
  /** Sources whose read failed or stopped early, with the reason. Any entry blocks exports and closes. */
  readErrors?: Record<string, string>;
};

/** @purpose Everything a bookkeeper would push back on, worst first, for the selected period. */
export function booksQualityIssues(entries: JournalEntry[], postingIssues: BookIssue[], ctx: BooksQualityContext): BookIssue[] {
  const issues: BookIssue[] = [];
  const loaded = ctx.loaded ?? true;
  if (!loaded) issues.push({ id: 'not-loaded', severity: 'block', title: 'The books have not been read yet', detail: 'Wait for the read to finish; every figure would show as zero until then.' });
  for (const [source, reason] of Object.entries(ctx.readErrors ?? {})) issues.push({ id: `read-failed:${source}`, severity: 'block', title: `${source} could not be read completely`, detail: `${reason} Figures that depend on it are incomplete, so exports and closing are off.` });
  if (ctx.testMode) issues.push({ id: 'test-mode', severity: 'info', title: 'Practice books', detail: 'Stripe is in test mode, so these entries are practice data. Do not file or import them as real money.' });
  const inPeriod = entriesBetween(entries, ctx.period.from, ctx.period.to);
  const toDate = entriesBetween(entries, null, ctx.period.to);
  const { balanced, debit, credit } = trialBalance(entries);
  if (!balanced) issues.push({ id: 'unbalanced', severity: 'block', title: 'Books do not balance', detail: `Debits ${debit}¢ and credits ${credit}¢ differ. Nothing should be exported until this is fixed.` });
  const tb = trialBalance(toDate).rows;
  const balanceOf = (code: string) => tb.find((row) => row.code === code)?.balance ?? 0;
  if (balanceOf('1999') !== 0) issues.push({ id: 'suspense', severity: 'warn', title: 'Suspense is not zero', detail: 'Some rows did not add up. Review them and clear Suspense with a correcting entry before closing the period.' });
  const negative = heldRollForward(entries, ctx.period).filter((row) => row.closing < 0);
  for (const row of negative) issues.push({ id: `negative:${row.code}`, severity: 'block', title: `${row.name} is below zero`, detail: 'More was paid out than was recorded as received. A gift or sale is missing from the books, or a payout was marked paid twice.' });
  const shortAthletes = athleteHeld(entries, ctx.period.to).filter((row) => row.held < 0);
  if (shortAthletes.length) issues.push({ id: 'athlete-below-zero', severity: 'block', title: 'An athlete was paid more than was held for them', detail: `${shortAthletes.length} athlete account(s) are below zero (${shortAthletes.slice(0, 3).map((row) => `${row.athleteRef} ${row.held}¢`).join(', ')}). Another family's money covered the difference.`, count: shortAthletes.length });
  // Money held for others must stay in cash; anything less means it was spent as Tapua'i's own.
  const cash = balanceOf('1000') + balanceOf('1010');
  const heldTotal = balanceOf('2000') + balanceOf('2010') + balanceOf('2100');
  if (loaded && heldTotal > 0 && cash < heldTotal) issues.push({ id: 'cash-below-held', severity: 'block', title: 'Cash is less than the money held for others', detail: `Bank and Stripe total ${cash}¢ but ${heldTotal}¢ is held for families, athletes and operators. Record any owner contribution or missing deposit; otherwise family money was spent.` });
  const grouped = new Map<string, BookIssue & { count: number }>();
  for (const issue of postingIssues) {
    const key = issue.id.split(':')[0];
    const existing = grouped.get(key);
    if (existing) existing.count += 1;
    else grouped.set(key, { ...issue, id: key, count: 1 });
  }
  issues.push(...grouped.values());
  if (ctx.revenueTruncated) issues.push({ id: 'truncated', severity: 'block', title: 'Not every revenue row was read', detail: 'The read stopped at its page limit, so totals are incomplete. Narrow the period or raise the limit before exporting.' });
  const hasFees = inPeriod.some((entry) => entry.lines.some((line) => line.account === '5000'));
  const hasCharges = inPeriod.some((entry) => entry.origin === 'revenue');
  if (hasCharges && !hasFees) issues.push({ id: 'no-stripe-fees', severity: 'warn', title: 'No card processing fees recorded', detail: "Stripe kept fees on these charges. Record the period's total from the Stripe balance report (Reports → Balance) as a Card processing fees entry." });
  if (loaded && !ctx.manualConfigured && !ctx.readErrors?.['Recorded entries']) issues.push({ id: 'manual-off', severity: 'info', title: 'Expenses and closes are not switched on', detail: 'Apply the bookkeeping migration to record expenses, Stripe fees and month closes. Until then the books show income and payouts only.' });
  if (ctx.missingPaymentIds && hasCharges) issues.push({ id: 'no-payment-ids', severity: 'info', title: 'Deposits cannot be matched charge by charge', detail: 'Revenue rows do not carry the Stripe payment id yet, so match Stripe payouts to the bank by total.' });
  if (ctx.queuedPayoutCents > 0) issues.push({ id: 'queued-payouts', severity: 'info', title: 'Payouts queued, not paid', detail: 'Queued payouts stay in money held for families until they are marked paid.' });
  for (const close of ctx.closes) {
    if (!close.totals) continue;
    const now = closeTotals(entries, close.period);
    const keys = new Set([...Object.keys(now), ...Object.keys(close.totals)]);
    const changed = [...keys].some((key) => (now[key] ?? 0) !== (close.totals![key] ?? 0));
    if (changed) issues.push({ id: `changed-after-close:${close.period}`, severity: 'block', title: `${periodFor('month', `${close.period}-01`).label} changed after it was closed`, detail: 'An entry in a closed month was added, removed or moved between accounts or athletes. Find it, then post the correction in an open month.' });
  }
  const rank: Record<BookIssueSeverity, number> = { block: 0, warn: 1, info: 2 };
  return issues.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/**
 * @purpose The fingerprint stored when a month is closed: net movement per account, the number of
 *   entries (`entries`) and each athlete's net held movement (`athlete:<ref>`), so a swap between two
 *   athletes or an added-and-removed pair is still caught later.
 */
export function closeTotals(entries: JournalEntry[], monthKey: string): Record<string, number> {
  const range = periodFor('month', `${monthKey}-01`);
  const inMonth = entriesBetween(entries, range.from, range.to);
  const totals: Record<string, number> = Object.fromEntries(trialBalance(inMonth).rows.map((row) => [row.code, row.debit - row.credit]));
  totals.entries = inMonth.length;
  for (const entry of inMonth) for (const line of entry.lines) {
    if (!line.athleteRef) continue;
    const key = `athlete:${line.athleteRef}`;
    totals[key] = (totals[key] ?? 0) + line.credit - line.debit;
  }
  return totals;
}

/** Hand-entered entry templates for the Books form. Each is a two-line entry; refunds use `refundEntryLines`. */
export type ManualKind = { id: string; label: string; debit: string; credit: string | null; hint: string };

export const MANUAL_ENTRY_KINDS: ManualKind[] = [
  { id: 'stripe_fees', label: 'Stripe fees', debit: '5000', credit: '1010', hint: 'Monthly total from the Stripe balance report.' },
  { id: 'software', label: 'Software and hosting', debit: '6000', credit: null, hint: 'Supabase, Expo, domains.' },
  { id: 'developer_fees', label: 'App store fees', debit: '6010', credit: null, hint: 'Apple Developer, Google Play.' },
  { id: 'professional', label: 'Legal and professional', debit: '6020', credit: null, hint: 'Counsel, CPA, filings.' },
  { id: 'marketing', label: 'Marketing', debit: '6030', credit: null, hint: 'Ads, QR cards, events.' },
  { id: 'merch_cost', label: 'Drip stock cost', debit: '5010', credit: null, hint: 'What merchandise cost Tapua\'i.' },
  { id: 'bank_fees', label: 'Bank fees', debit: '6100', credit: null, hint: 'Account and wire fees.' },
  { id: 'other_expense', label: 'Other expense', debit: '6090', credit: null, hint: 'Say what it was in the memo.' },
  { id: 'stripe_payout', label: 'Stripe payout to bank', debit: '1000', credit: '1010', hint: 'Stripe moved the balance to the bank.' },
  { id: 'pay_booster_operator', label: 'Pay a booster operator', debit: '2100', credit: null, hint: "The operator's 85%; name the operator in the memo." },
  { id: 'owner_contribution', label: 'Owner put money in', debit: '1000', credit: '3000', hint: 'A deposit from the owner.' },
  { id: 'owner_draw', label: 'Owner took money out', debit: '3100', credit: '1000', hint: 'A withdrawal for the owner.' },
  { id: 'repay_owner', label: 'Repay the owner', debit: '2300', credit: '1000', hint: 'Pays back costs the owner covered personally.' },
  { id: 'owner_cost_to_contribution', label: 'Owner costs become a contribution', debit: '2300', credit: '3000', hint: 'The owner will not be repaid; ask the CPA which they prefer.' },
  { id: 'refund', label: 'Refund a gift or sale', debit: '4900', credit: '1010', hint: "Returns the whole charge: Tapua'i's share and the family's, athlete's or operator's share." },
];

/** Where an expense was paid from. */
export const PAID_FROM: { id: string; label: string; account: string }[] = [
  { id: 'bank', label: 'Business bank', account: '1000' },
  { id: 'stripe', label: 'Stripe balance', account: '1010' },
  { id: 'owner', label: 'Owner paid personally', account: '2300' },
];

/** @purpose Two balanced lines for a template, or an error sentence the form shows instead. */
export function manualEntryLines(kindId: string, amountCents: number, paidFromId: string): { lines: ManualLineInput[] } | { error: string } {
  const kind = MANUAL_ENTRY_KINDS.find((item) => item.id === kindId);
  if (!kind) return { error: 'Choose what this entry is for.' };
  if (kind.id === 'refund') return { error: 'Use the refund fields: stream, amount refunded and athlete.' };
  const amount = Math.round(amountCents);
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter an amount above $0.00.' };
  if (amount > 100_000_000) return { error: 'Enter an amount of $1,000,000 or less.' };
  const credit = kind.credit ?? PAID_FROM.find((item) => item.id === paidFromId)?.account;
  if (!credit) return { error: 'Choose where it was paid from.' };
  if (credit === '2300' && kind.debit.startsWith('2')) return { error: 'A payout to someone else cannot be paid from the owner\'s own card; choose the bank or Stripe.' };
  return { lines: [{ account_code: kind.debit, debit_cents: amount, credit_cents: 0 }, { account_code: credit, debit_cents: 0, credit_cents: amount }] };
}

/** Streams a refund can reverse, with the payee's held account. */
export const REFUND_STREAMS: { id: string; label: string; payable: string | null }[] = [
  { id: 'malo', label: 'Gift', payable: '2000' },
  { id: 'vault', label: 'Vault sale', payable: '2010' },
  { id: 'booster', label: 'Booster sponsorship', payable: '2100' },
  { id: 'merch', label: 'Drip order', payable: null },
];

/**
 * @purpose Balanced lines for a refund of a whole charge. The payee's share (at the stream's split)
 *   comes back out of what is held for them, with the athlete reference; Tapua'i's share, plus any
 *   optional tip or covered card fee returned with it, is contra-income (4900); the Stripe balance pays
 *   the gross. A dispute fee Stripe charged is a processing fee (5000).
 */
export function refundEntryLines(input: { stream: string; grossCents: number; extraTapuaiCents?: number; disputeFeeCents?: number; athleteRef?: string | null }): { lines: ManualLineInput[] } | { error: string } {
  const stream = REFUND_STREAMS.find((item) => item.id === input.stream);
  if (!stream) return { error: 'Choose what was refunded.' };
  const gross = Math.round(input.grossCents);
  const extra = Math.max(0, Math.round(input.extraTapuaiCents ?? 0));
  const dispute = Math.max(0, Math.round(input.disputeFeeCents ?? 0));
  if (!Number.isFinite(gross) || gross <= 0) return { error: 'Enter the refunded amount above $0.00.' };
  if (gross + extra + dispute > 100_000_000) return { error: 'Enter an amount of $1,000,000 or less.' };
  const ref = input.athleteRef?.trim() || null;
  if ((stream.payable === '2000' || stream.payable === '2010') && !ref) return { error: 'Choose the athlete whose money is being returned.' };
  const bps = stream.id === 'malo' ? 1000 : stream.id === 'vault' ? 2000 : stream.id === 'booster' ? 1500 : 10000;
  const platform = Math.round((gross * bps) / 10000);
  const payee = gross - platform;
  const lines: ManualLineInput[] = [];
  if (stream.payable && payee > 0) lines.push({ account_code: stream.payable, debit_cents: payee, credit_cents: 0, athlete_ref: stream.payable === '2100' ? null : ref });
  if (platform + extra > 0) lines.push({ account_code: '4900', debit_cents: platform + extra + (stream.payable ? 0 : payee), credit_cents: 0 });
  if (dispute > 0) lines.push({ account_code: '5000', debit_cents: dispute, credit_cents: 0, memo: 'Dispute fee' });
  lines.push({ account_code: '1010', debit_cents: 0, credit_cents: gross + extra + dispute });
  return { lines };
}

/** "$1,234.56" (or "−$12.00") for on-screen tables. */
export function booksUsd(amount: number): string {
  const abs = Math.abs(amount) / 100;
  const text = abs.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return amount < 0 ? `−${text}` : text;
}

/** @purpose Parse "12", "12.5", "$1,234.56" into cents; null when it is not a plain amount. */
export function parseUsdCents(text: string): number | null {
  const clean = text.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

// ---------------------------------------------------------------------------------------------
// CSV exports
// ---------------------------------------------------------------------------------------------

/** Plain dollars for CSV ("1234.56"); no currency sign or thousands separator, so imports parse. */
const csvMoney = (amount: number) => (amount === 0 ? '' : (amount / 100).toFixed(2));

/**
 * @purpose One CSV cell. Quotes when needed, and defuses text a spreadsheet would run as a formula
 *   (a booster's business name is typed by a person, so "=HYPERLINK(…)" must stay text).
 */
export function csvCell(value: string | number): string {
  let text = String(value ?? '');
  // Plain numbers (including negatives such as a loss or a payout's "-5.00") stay numbers.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number)[][]): string {
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** QuickBooks wants MM/DD/YYYY. */
const qboDate = (day: string) => `${day.slice(5, 7)}/${day.slice(8, 10)}/${day.slice(0, 4)}`;

/** QuickBooks Online journal-entry import accepts up to 1,000 lines per file. */
export const QBO_MAX_LINES = 1000;

/**
 * @purpose QuickBooks Online "Import journal entries" CSV. `daily` (recommended) rolls each day's
 *   entries of one kind into a single journal with one line per account, the way payment apps feed
 *   accounting software; it keeps athlete names and ids out of QuickBooks entirely. `detail` writes
 *   one journal per source row with the pseudonymous athlete reference in the description.
 */
export function qboJournalCsv(entries: JournalEntry[], mode: 'daily' | 'detail' = 'daily'): { csv: string; lines: number; journals: number } {
  const rows: (string | number)[][] = [['Journal No', 'Journal Date', 'Memo', 'Account', 'Debits', 'Credits', 'Description', 'Name']];
  let journals = 0;
  if (mode === 'detail') {
    for (const entry of entries) {
      journals += 1;
      const no = `TP-${entry.date.replace(/-/g, '')}-${entry.id.split(':').pop()!.replace(/-/g, '').slice(0, 8)}`;
      for (const line of entry.lines) rows.push([no, qboDate(entry.date), entry.memo, ledgerAccount(line.account)?.name ?? line.account, csvMoney(line.debit), csvMoney(line.credit), [line.memo, line.athleteRef].filter(Boolean).join(' · '), '']);
    }
  } else {
    const groups = new Map<string, { date: string; group: string; count: number; net: Map<string, number> }>();
    for (const entry of entries) {
      const group = entry.origin === 'revenue' ? entry.source : entry.origin === 'disbursement' ? 'payout' : 'manual';
      const key = `${entry.date}|${group}`;
      const bucket = groups.get(key) ?? { date: entry.date, group, count: 0, net: new Map<string, number>() };
      bucket.count += 1;
      for (const line of entry.lines) bucket.net.set(line.account, (bucket.net.get(line.account) ?? 0) + line.debit - line.credit);
      groups.set(key, bucket);
    }
    for (const bucket of [...groups.values()].sort((a, b) => a.date.localeCompare(b.date) || a.group.localeCompare(b.group))) {
      const nonZero = [...bucket.net.entries()].filter(([, amount]) => amount !== 0);
      if (!nonZero.length) continue;
      journals += 1;
      const title = bucket.group === 'payout' ? 'Payouts to family accounts' : bucket.group === 'manual' ? 'Recorded entries' : `${streamTitle(bucket.group)}s`;
      const no = `TP-${bucket.date.replace(/-/g, '')}-${bucket.group.toUpperCase().slice(0, 6)}`;
      const memo = `Tapua'i ${title} · ${bucket.count} record${bucket.count === 1 ? '' : 's'}`;
      for (const [code, amount] of nonZero.sort(([a], [b]) => a.localeCompare(b))) {
        rows.push([no, qboDate(bucket.date), memo, ledgerAccount(code)?.name ?? code, csvMoney(amount > 0 ? amount : 0), csvMoney(amount < 0 ? -amount : 0), ledgerAccount(code)?.description ?? '', '']);
      }
    }
  }
  return { csv: toCsv(rows), lines: rows.length - 1, journals };
}

/** @purpose Every journal line, for a CPA, Xero, Wave or any spreadsheet. */
export function generalLedgerCsv(entries: JournalEntry[]): string {
  const rows: (string | number)[][] = [['Date', 'Entry', 'Kind', 'Source', 'Source id', 'Account code', 'Account', 'Debit', 'Credit', 'Memo', 'Athlete ref']];
  for (const entry of entries) for (const line of entry.lines) {
    rows.push([entry.date, entry.id, entry.origin, entry.source, entry.sourceId, line.account, ledgerAccount(line.account)?.name ?? line.account, csvMoney(line.debit), csvMoney(line.credit), [entry.memo, line.memo].filter(Boolean).join(' · '), line.athleteRef ?? '']);
  }
  return toCsv(rows);
}

/** @purpose Chart of accounts in the QuickBooks Online account-import layout. */
export function chartOfAccountsCsv(): string {
  return toCsv([['Account Number', 'Account Name', 'Type', 'Detail Type', 'Description'], ...CHART_OF_ACCOUNTS.map((account) => [account.code, account.name, account.qboType, account.qboDetail, account.description])]);
}

/** @purpose The year-end pack as one CSV a CPA can open: receipts, expenses by line, quarters, pass-through, payees. */
export function taxSummaryCsv(summary: TaxYearSummary): string {
  const rows: (string | number)[][] = [['Section', 'Line', 'Amount', 'Note']];
  rows.push(['Income', "Gross receipts (Tapua'i share only)", csvMoney(summary.grossReceipts), "Platform shares, optional tips for Tapua'i, Vault share, booster share, Drip, giver-covered processing fees"]);
  rows.push(['Income', 'Returns and allowances', csvMoney(summary.refunds), '']);
  rows.push(['Cost of goods sold', 'Drip stock cost', csvMoney(summary.costOfSales), 'Merchandise only; card processing fees are under Expenses (commissions and fees)']);
  for (const line of summary.expensesByLine) rows.push(['Expenses', line.taxLine, csvMoney(line.amount), '']);
  rows.push(['Result', 'Net profit', (summary.net / 100).toFixed(2), '']);
  for (const quarter of summary.quarters) rows.push(['Net profit by estimated-tax period', quarter.label, (quarter.net / 100).toFixed(2), `Estimated payment due ${quarter.dueDate} if the year's expected tax is $1,000 or more (CPA sets the amount)`]);
  rows.push(['Pass-through', 'Received for families, athletes and operators', csvMoney(summary.passThrough.received), 'Not income: owed to others']);
  rows.push(['Pass-through', 'Paid out', csvMoney(summary.passThrough.paidOut), '']);
  rows.push(['Pass-through', 'Still held at year end', (summary.passThrough.heldAtYearEnd / 100).toFixed(2), 'Liability on the balance sheet']);
  rows.push(['Reconcile', 'Charges collected through Stripe', csvMoney(summary.stripeGrossEstimate), "Compare with Stripe's 1099-K gross, which is not reduced by refunds; Stripe may issue none below $20,000 and 200 payments"]);
  for (const month of summary.merchSalesByMonth) rows.push(['Sales tax watch', `Drip sales ${month.month}`, csvMoney(month.amount), 'Sales tax not collected yet']);
  for (const payee of summary.payees) rows.push(['Payee review', payee.payee, csvMoney(payee.paid ?? payee.earned), `${payee.kind === 'athlete-vault' ? 'Vault earnings' : 'Booster operator share'} · ${payee.paid == null ? 'earned (payments recorded by hand)' : `paid; earned ${(payee.earned / 100).toFixed(2)}`}${payee.overThreshold ? ' · at or above the 1099 review line' : ''}`]);
  return toCsv(rows);
}
