/**
 * Source-to-ledger reconciliation (BOOKS-02, owned by INTERNAL_CONTROLS, built by FINANCE_DATA).
 * Proves every money row in the app reached the revenue log the books are built from: each gift,
 * optional tip, covered card fee, Vault purchase, booster sponsorship and Drip order must have exactly
 * one matching `company_revenue_logs` row with the same amount. Also flags money that has no posting
 * path yet (paid guardian withdrawals, filmer cash, booster renewals). Pure; the desk passes rows in.
 * A source that could not be read is "unread", never zero.
 */
import type { BookIssue, DisbursementInput, RevenueLogInput } from './bookkeeping';

export type TipSource = { id: string; player_id: string | null; amount_cents: number; platform_tip_cents?: number | null; cover_fee_cents?: number | null; origin?: string | null; entry?: string | null; source_label?: string | null; created_at: string };
export type SubscriptionSource = { id: string; athlete_id: string | null; status?: string | null; created_at: string };
export type SponsorshipSource = { id: string; business_name?: string | null; amount_cents: number; billing_interval?: string | null; status?: string | null; created_at: string };
export type ShopOrderSource = { id: string; product_id?: string | null; amount_cents: number; created_at: string };
export type WithdrawalSource = { id: string; player_id: string | null; amount_cents: number; status: string; created_at: string };
export type FilmerCashSource = { id: string; cash_cents: number; created_at: string };

/** `null` means the read failed or the table is not on this database; `[]` means it was read and is empty. */
export type FinanceSources = {
  tips: TipSource[] | null;
  subscriptions: SubscriptionSource[] | null;
  sponsorships: SponsorshipSource[] | null;
  shopOrders: ShopOrderSource[] | null;
  withdrawals: WithdrawalSource[] | null;
  filmerCash: FilmerCashSource[] | null;
  /** False when the tips read had to drop cover_fee_cents (bookkeeping migration not applied). */
  coverFeeColumn: boolean;
};

export type ReconStatus = 'match' | 'gap' | 'unread';

export type ReconRow = {
  stream: string;
  title: string;
  source: string;
  sourceCount: number;
  sourceCents: number;
  ledgerCount: number;
  ledgerCents: number;
  /** Source ids with no revenue-log row. */
  missing: string[];
  /** Revenue-log source ids with no source row. */
  orphans: string[];
  /** Same id on both sides, different amount. */
  mismatched: { id: string; source: number; ledger: number }[];
  status: ReconStatus;
};

/** Vault price the SQL assumes for every subscription row (`company_revenue.sql`). */
export const VAULT_ASSUMED_CENTS = 499;

type Expected = { id: string; cents: number };

function compare(stream: string, title: string, source: string, expected: Expected[] | null, revenue: RevenueLogInput[]): ReconRow {
  const ledger = revenue.filter((row) => row.source === stream);
  const ledgerById = new Map(ledger.map((row) => [row.source_id || row.id, row]));
  const base = { stream, title, source, ledgerCount: ledger.length, ledgerCents: ledger.reduce((sum, row) => sum + row.gross_cents, 0) };
  if (expected == null) return { ...base, sourceCount: 0, sourceCents: 0, missing: [], orphans: [], mismatched: [], status: 'unread' };
  const expectedIds = new Set(expected.map((row) => row.id));
  const missing: string[] = [];
  const mismatched: ReconRow['mismatched'] = [];
  for (const row of expected) {
    const hit = ledgerById.get(row.id);
    if (!hit) missing.push(row.id);
    else if (hit.gross_cents !== row.cents) mismatched.push({ id: row.id, source: row.cents, ledger: hit.gross_cents });
  }
  const orphans = [...ledgerById.keys()].filter((id) => !expectedIds.has(id));
  return {
    ...base,
    sourceCount: expected.length,
    sourceCents: expected.reduce((sum, row) => sum + row.cents, 0),
    missing,
    orphans,
    mismatched,
    status: missing.length || orphans.length || mismatched.length ? 'gap' : 'match',
  };
}

/**
 * @purpose Reconcile every money source with the revenue log, all time, and list what has no
 *   posting path. Findings use the same severity words as the books' quality checks.
 */
export function reconcileSources(revenue: RevenueLogInput[], src: FinanceSources, payouts: DisbursementInput[] = []): { rows: ReconRow[]; findings: BookIssue[] } {
  const positive = <T,>(rows: T[] | null, pick: (row: T) => Expected | null): Expected[] | null => rows == null ? null : rows.map(pick).filter((row): row is Expected => Boolean(row && row.cents > 0));
  const rows: ReconRow[] = [
    compare('malo', 'Gifts', 'tips.amount_cents', positive(src.tips, (t) => ({ id: t.id, cents: Math.round(t.amount_cents) })), revenue),
    compare('tip', "Optional tips to Tapua'i", 'tips.platform_tip_cents', positive(src.tips, (t) => ({ id: t.id, cents: Math.round(t.platform_tip_cents ?? 0) })), revenue),
    compare('card_fee', 'Processing fees covered by givers', 'tips.cover_fee_cents', src.coverFeeColumn ? positive(src.tips, (t) => ({ id: t.id, cents: Math.round(t.cover_fee_cents ?? 0) })) : null, revenue),
    compare('vault', 'Vault purchases', 'subscriptions (assumed $4.99)', positive(src.subscriptions, (s) => ({ id: s.id, cents: VAULT_ASSUMED_CENTS })), revenue),
    compare('booster', 'Booster sponsorships', 'sponsorships.amount_cents', positive(src.sponsorships, (s) => ({ id: s.id, cents: Math.round(s.amount_cents) })), revenue),
    compare('merch', 'Drip orders', 'shop_orders.amount_cents', positive(src.shopOrders, (o) => ({ id: o.id, cents: Math.round(o.amount_cents) })), revenue),
  ];
  const findings: BookIssue[] = [];
  for (const row of rows) {
    if (row.status === 'unread') {
      findings.push({ id: `recon-unread:${row.stream}`, severity: row.stream === 'card_fee' ? 'info' : 'warn', title: `${row.title}: source not read`, detail: row.stream === 'card_fee' ? 'Covered card fees are recorded only after the bookkeeping migration is applied.' : `Could not read ${row.source}, so these rows cannot be proven complete.` });
      continue;
    }
    if (row.missing.length) findings.push({ id: `recon-missing:${row.stream}`, severity: 'block', title: `${row.title} missing from the revenue log`, detail: `${row.missing.length} source row(s) have no revenue-log row, so the books undercount them. First: ${row.missing.slice(0, 3).join(', ')}.`, count: row.missing.length });
    if (row.mismatched.length) findings.push({ id: `recon-mismatch:${row.stream}`, severity: 'block', title: `${row.title} amounts differ from the revenue log`, detail: `${row.mismatched.length} row(s) disagree. First: ${row.mismatched[0].id} source ${row.mismatched[0].source}¢, log ${row.mismatched[0].ledger}¢.`, count: row.mismatched.length });
    if (row.orphans.length) findings.push({ id: `recon-orphan:${row.stream}`, severity: 'warn', title: `${row.title} in the revenue log with no source row`, detail: `${row.orphans.length} revenue-log row(s) point at a source row that no longer exists (deleted, or written by hand). First: ${row.orphans.slice(0, 3).join(', ')}.`, count: row.orphans.length });
  }
  if (src.withdrawals == null) findings.push({ id: 'recon-unread:withdrawals', severity: 'warn', title: 'Guardian withdrawals: source not read', detail: 'Could not read custodial_withdrawals, so a withdrawal paid outside the books cannot be ruled out.' });
  else {
    // A paid withdrawal is in the books when a paid payout for the same athlete and amount exists; each payout matches once.
    const unused = payouts.filter((row) => row.status === 'paid').map((row) => ({ player: row.player_id, cents: row.amount_cents, used: false }));
    const unmatched = src.withdrawals.filter((row) => row.status === 'paid').filter((row) => {
      const hit = unused.find((p) => !p.used && p.player === row.player_id && p.cents === row.amount_cents);
      if (hit) hit.used = true;
      return !hit;
    });
    if (unmatched.length) findings.push({ id: 'withdrawals-paid-outside-books', severity: 'block', title: 'Guardian withdrawals marked paid outside the books', detail: `${unmatched.length} custodial withdrawal(s) totalling ${unmatched.reduce((sum, row) => sum + row.amount_cents, 0)}¢ are marked paid with no matching paid payout. Record each in Payouts for the same athlete and amount; the finding clears when they match.`, count: unmatched.length });
  }
  if (src.filmerCash == null) findings.push({ id: 'recon-unread:filmer_rewards', severity: 'warn', title: 'Filmer rewards: source not read', detail: 'Could not read filmer_rewards, so unbooked filmer cash cannot be ruled out.' });
  const filmerCash = (src.filmerCash ?? []).filter((row) => row.cash_cents > 0);
  if (filmerCash.length) findings.push({ id: 'filmer-cash-unposted', severity: 'block', title: 'Filmer cash rewards not in the books', detail: `${filmerCash.length} filmer reward(s) carry cash; record them as Filmer rewards (6040) expense.`, count: filmerCash.length });
  const monthly = (src.sponsorships ?? []).filter((row) => (row.billing_interval ?? 'month') === 'month' && (row.status ?? 'active') === 'active');
  if (monthly.length) findings.push({ id: 'booster-renewals', severity: 'warn', title: 'Monthly booster renewals are not logged', detail: `${monthly.length} active monthly sponsorship(s) are logged once, at sign-up. Each later month's charge must be recorded until renewals reach the revenue log.`, count: monthly.length });
  const inactiveVault = (src.subscriptions ?? []).filter((row) => row.status && row.status !== 'active');
  if (inactiveVault.length) findings.push({ id: 'vault-inactive-counted', severity: 'info', title: 'Ended Vault access still counted as a sale', detail: `${inactiveVault.length} Vault row(s) are not active but stay in revenue. Correct by hand if a refund happened.`, count: inactiveVault.length });
  if ((src.subscriptions ?? []).length) findings.push({ id: 'vault-price-assumed', severity: 'info', title: 'Vault price is assumed', detail: `Every Vault row is booked at $${(VAULT_ASSUMED_CENTS / 100).toFixed(2)} because the purchase row stores no price.` });
  return { rows, findings };
}

/** @purpose Channel per gift id ("Highlight via QR · Cleats"), to filter transactions by where giving started. */
export function channelBySourceId(tips: TipSource[] | null, label: (origin: string, entry: string, sourceLabel: string) => string): Record<string, string> {
  return Object.fromEntries((tips ?? []).map((tip) => [tip.id, label(tip.origin ?? 'profile', tip.entry ?? 'in_app', tip.source_label ?? '')]));
}
