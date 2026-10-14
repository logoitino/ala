/**
 * Books desk data (BOOKS-01): reads every money row the journal is built from, and writes the
 * hand-entered entries and month closes. The posting rules live in
 * `@tapuai/shared-types/admin/bookkeeping`; this file only fetches and calls RPCs.
 * A missing bookkeeping migration is reported as "not switched on", never as an error or as zero.
 * Source tables (tips, subscriptions, sponsorships, shop_orders, custodial withdrawals, filmer rewards)
 * are read too, so the Reconcile tab can prove every money row reached the revenue log (BOOKS-02).
 * @sideEffects `company_revenue_logs`, `disbursements`, `players` and source-table SELECTs; `get_ledger_books`,
 *   `record_ledger_entry`, `void_ledger_entry`, `close_ledger_period`, `reopen_ledger_period` RPCs.
 */
import type {
  BooksInput,
  DisbursementInput,
  ManualEntryInput,
  ManualLineInput,
  PeriodCloseInput,
  RevenueLogInput,
} from '@tapuai/shared-types/admin/bookkeeping';
import type { FinanceSources } from '@tapuai/shared-types/admin/financeChecks';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { isMissingFunction } from '@/lib/dbErrors';

export type BooksSnapshot = {
  configured: boolean;
  input: BooksInput;
  playerNames: Record<string, string>;
  /** The revenue read stopped at its page cap, so totals are incomplete. */
  revenueTruncated: boolean;
  /** Revenue-log rows carry no Stripe payment id yet (tips.stripe_payment_intent_id is not copied into the log). */
  missingPaymentIds: boolean;
  /** False until `20261012210000_bookkeeping_ledger.sql` is applied. */
  manualConfigured: boolean;
  closes: PeriodCloseInput[];
  /** Every reopen of a closed month, with its reason (audit trail). */
  reopens: { period: string; reopened_at: string; reason: string }[];
  queuedPayoutCents: number;
  /** Raw money sources for reconciliation; `null` per source when it could not be read. */
  sources: FinanceSources;
  /** Per-source read problems, by table, for the Reconcile tab. */
  sourceErrors: Record<string, string>;
  errors: { revenue: string | null; disbursements: string | null; manual: string | null };
  readAt: string | null;
};

const PAGE = 1000;
/** 25,000 revenue rows is far beyond Wave 0; past it the desk says the read is incomplete. */
const MAX_PAGES = 25;

export function emptyBooksSnapshot(): BooksSnapshot {
  return {
    configured: isSupabaseConfigured,
    input: { revenue: [], disbursements: [], manual: [] },
    playerNames: {},
    revenueTruncated: false,
    missingPaymentIds: true,
    manualConfigured: false,
    closes: [],
    reopens: [],
    queuedPayoutCents: 0,
    sources: { tips: null, subscriptions: null, sponsorships: null, shopOrders: null, withdrawals: null, filmerCash: null, coverFeeColumn: false },
    sourceErrors: {},
    errors: { revenue: null, disbursements: null, manual: null },
    readAt: null,
  };
}

const int = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
};
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
/** Older log rows only have numeric dollars; newer ones have integer cents. */
const centsOr = (cents: unknown, dollars: unknown): number => (cents != null ? int(cents) : Math.round(Number(dollars ?? 0) * 100) || 0);

function parseRevenue(raw: Record<string, unknown>): RevenueLogInput | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    source: text(raw.source) || text(raw.transaction_type) || 'malo',
    source_id: text(raw.source_id) || null,
    label: text(raw.label),
    gross_cents: centsOr(raw.gross_cents, raw.gross_amount),
    platform_cents: centsOr(raw.platform_cents, raw.platform_cut_amount),
    payout_cents: centsOr(raw.payout_cents, raw.payout_amount),
    payee_kind: text(raw.payee_kind) || 'none',
    player_id: text(raw.player_id) || null,
    created_at: text(raw.created_at),
  };
}

function parseDisbursement(raw: Record<string, unknown>): DisbursementInput | null {
  const id = text(raw.id);
  if (!id) return null;
  return { id, player_id: text(raw.player_id) || null, amount_cents: int(raw.amount_cents), status: text(raw.status), created_at: text(raw.created_at), paid_at: text(raw.paid_at) || null };
}

function parseManual(raw: Record<string, unknown>): ManualEntryInput | null {
  const id = text(raw.id);
  if (!id) return null;
  const lines = Array.isArray(raw.lines) ? (raw.lines as Record<string, unknown>[]) : [];
  return {
    id,
    entry_date: text(raw.entry_date),
    kind: text(raw.kind),
    memo: text(raw.memo),
    reference: text(raw.reference) || null,
    reverses_id: text(raw.reverses_id) || null,
    voided_at: text(raw.voided_at) || null,
    lines: lines.map((line): ManualLineInput => ({ account_code: text(line.account_code), debit_cents: int(line.debit_cents), credit_cents: int(line.credit_cents), memo: text(line.memo) || null, athlete_ref: text(line.athlete_ref) || null })),
  };
}

type BooksTable = 'company_revenue_logs' | 'disbursements' | 'tips' | 'subscriptions' | 'sponsorships' | 'shop_orders' | 'custodial_withdrawals' | 'filmer_rewards';

/**
 * @purpose Read every row of one table in pages. A failed page discards what was read (partial money
 *   rows would look complete), and the exact row count proves completeness even if the server caps a
 *   page below PAGE.
 */
export async function readAllRows(table: BooksTable, columns: string): Promise<{ rows: Record<string, unknown>[]; truncated: boolean; error: string | null }> {
  const rows: Record<string, unknown>[] = [];
  let total: number | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    // Tables outside the generated client types (custodial, filmer) are read through the same bounded query.
    const query = (supabase.from as (name: string) => ReturnType<typeof supabase.from>)(table).select(columns, { count: 'exact' });
    const { data, error, count } = await query.order('created_at', { ascending: true }).order('id', { ascending: true }).range(rows.length, rows.length + PAGE - 1);
    if (error) return { rows: [], truncated: false, error: error.message || `Could not read ${table}.` };
    if (typeof count === 'number') total = count;
    const batch = Array.isArray(data) ? (data as unknown as Record<string, unknown>[]) : [];
    rows.push(...batch);
    if (!batch.length || (total != null ? rows.length >= total : batch.length < PAGE)) return { rows, truncated: false, error: null };
  }
  return { rows, truncated: true, error: null };
}

const num = (value: unknown): number => int(value);
const missingColumn = (message: string | null) => Boolean(message && /cover_fee_cents|column .* does not exist|could not find .* column/i.test(message));

/**
 * @purpose Read each money source table for reconciliation. A failed read leaves that source `null`
 *   (unread) and records why; the books themselves still load.
 * @sideEffects SELECT on tips, subscriptions, sponsorships, shop_orders, custodial_withdrawals, filmer_rewards.
 */
async function readSources(snapshot: BooksSnapshot): Promise<void> {
  const tipColumns = 'id, player_id, amount_cents, platform_tip_cents, origin, entry, source_label, created_at';
  let tips = await readAllRows('tips', `${tipColumns}, cover_fee_cents`);
  snapshot.sources.coverFeeColumn = !tips.error;
  // Before the bookkeeping migration cover_fee_cents does not exist; read the rest and mark the column absent.
  if (tips.error && missingColumn(tips.error)) tips = await readAllRows('tips', tipColumns);
  const [subscriptions, sponsorships, orders, withdrawals, filmer] = await Promise.all([
    readAllRows('subscriptions', 'id, athlete_id, status, created_at'),
    readAllRows('sponsorships', 'id, business_name, amount_cents, billing_interval, status, created_at'),
    readAllRows('shop_orders', 'id, product_id, amount_cents, created_at'),
    readAllRows('custodial_withdrawals', 'id, player_id, amount_cents, status, created_at'),
    readAllRows('filmer_rewards', 'id, cash_cents, created_at'),
  ]);
  const take = <T,>(name: string, read: { rows: Record<string, unknown>[]; truncated: boolean; error: string | null }, map: (row: Record<string, unknown>) => T): T[] | null => {
    if (read.error) { snapshot.sourceErrors[name] = read.error; return null; }
    if (read.truncated) snapshot.sourceErrors[name] = 'Read stopped at its page limit; reconciliation for this source is incomplete.';
    return read.rows.map(map);
  };
  snapshot.sources.tips = take('tips', tips, (r) => ({ id: text(r.id), player_id: text(r.player_id) || null, amount_cents: num(r.amount_cents), platform_tip_cents: num(r.platform_tip_cents), cover_fee_cents: num(r.cover_fee_cents), origin: text(r.origin) || null, entry: text(r.entry) || null, source_label: text(r.source_label) || null, created_at: text(r.created_at) }));
  snapshot.sources.subscriptions = take('subscriptions', subscriptions, (r) => ({ id: text(r.id), athlete_id: text(r.athlete_id) || null, status: text(r.status) || null, created_at: text(r.created_at) }));
  snapshot.sources.sponsorships = take('sponsorships', sponsorships, (r) => ({ id: text(r.id), business_name: text(r.business_name) || null, amount_cents: num(r.amount_cents), billing_interval: text(r.billing_interval) || null, status: text(r.status) || null, created_at: text(r.created_at) }));
  snapshot.sources.shopOrders = take('shop_orders', orders, (r) => ({ id: text(r.id), product_id: text(r.product_id) || null, amount_cents: num(r.amount_cents), created_at: text(r.created_at) }));
  snapshot.sources.withdrawals = take('custodial_withdrawals', withdrawals, (r) => ({ id: text(r.id), player_id: text(r.player_id) || null, amount_cents: num(r.amount_cents), status: text(r.status), created_at: text(r.created_at) }));
  snapshot.sources.filmerCash = take('filmer_rewards', filmer, (r) => ({ id: text(r.id), cash_cents: num(r.cash_cents), created_at: text(r.created_at) }));
}

/**
 * @purpose Read every row the books are built from. Each source fails on its own, so a missing
 *   bookkeeping migration still leaves income and payouts readable.
 * @sideEffects SELECTs on `company_revenue_logs` (admin-only RLS), `disbursements`, `players`; RPC `get_ledger_books`.
 */
export async function fetchBooksSnapshot(): Promise<BooksSnapshot> {
  const snapshot = emptyBooksSnapshot();
  if (!isSupabaseConfigured) return snapshot;
  const [revenue, payouts, manual] = await Promise.all([
    readAllRows('company_revenue_logs', 'id, source, source_id, transaction_type, label, gross_cents, platform_cents, payout_cents, gross_amount, platform_cut_amount, payout_amount, payee_kind, player_id, created_at'),
    readAllRows('disbursements', '*'),
    supabase.rpc('get_ledger_books'),
  ]);

  snapshot.input.revenue = revenue.rows.map(parseRevenue).filter((row): row is RevenueLogInput => Boolean(row));
  snapshot.revenueTruncated = revenue.truncated;
  snapshot.errors.revenue = revenue.error;
  snapshot.input.disbursements = payouts.rows.map(parseDisbursement).filter((row): row is DisbursementInput => Boolean(row));
  snapshot.errors.disbursements = payouts.error ?? (payouts.truncated ? 'The payout read stopped at its page limit.' : null);
  snapshot.queuedPayoutCents = snapshot.input.disbursements.filter((row) => row.status === 'queued').reduce((sum, row) => sum + row.amount_cents, 0);

  if (manual.error && !isMissingFunction(manual.error)) snapshot.errors.manual = manual.error.message || 'Could not read recorded entries.';
  let payload: Record<string, unknown> | null = null;
  try {
    const raw: unknown = manual.error ? null : manual.data;
    payload = raw ? ((typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>) : null;
  } catch {
    snapshot.errors.manual = 'Recorded entries came back in a shape the desk cannot read.';
  }
  if (payload) {
    snapshot.manualConfigured = true;
    snapshot.input.manual = (Array.isArray(payload.entries) ? (payload.entries as Record<string, unknown>[]) : []).map(parseManual).filter((row): row is ManualEntryInput => Boolean(row));
    snapshot.reopens = (Array.isArray(payload.reopens) ? (payload.reopens as Record<string, unknown>[]) : []).map((row) => ({ period: text(row.period), reopened_at: text(row.reopened_at), reason: text(row.reason) })).filter((row) => row.period);
    snapshot.closes = (Array.isArray(payload.closes) ? (payload.closes as Record<string, unknown>[]) : []).map((row) => ({
      period: text(row.period),
      closed_at: text(row.closed_at),
      note: text(row.note) || null,
      totals: row.totals && typeof row.totals === 'object' ? Object.fromEntries(Object.entries(row.totals as Record<string, unknown>).map(([code, value]) => [code, int(value)])) : null,
    })).filter((row) => row.period);
  }

  await readSources(snapshot);

  const ids = [...new Set([...snapshot.input.revenue.map((row) => row.player_id), ...snapshot.input.disbursements.map((row) => row.player_id)].filter((id): id is string => Boolean(id)))];
  for (let at = 0; at < ids.length; at += 100) {
    const { data } = await supabase.from('players').select('id, name').in('id', ids.slice(at, at + 100));
    for (const row of (data as { id: string; name: string | null }[] | null) ?? []) snapshot.playerNames[row.id] = row.name?.trim() || 'Athlete';
  }
  snapshot.readAt = new Date().toISOString();
  return snapshot;
}

function fail(error: { message?: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback);
}

/**
 * @purpose Record a balanced hand-entered entry (expense, Stripe fees, payout to bank, owner money).
 * @sideEffects RPC `record_ledger_entry` (admin only; checks balance, accounts and open month).
 */
export async function recordLedgerEntry(input: { date: string; kind: string; memo: string; reference: string; lines: ManualLineInput[] }): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('record_ledger_entry', { p_entry_date: input.date, p_kind: input.kind, p_memo: input.memo, p_reference: input.reference, p_lines: input.lines });
  fail(error, 'Could not record this entry.');
  return String(data ?? '');
}

/**
 * @purpose Void a hand-entered entry by posting its reversal today. Nothing is deleted.
 * @sideEffects RPC `void_ledger_entry`.
 */
export async function voidLedgerEntry(id: string, reason: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('void_ledger_entry', { p_entry_id: id, p_reason: reason });
  fail(error, 'Could not void this entry.');
}

/**
 * @purpose Close a finished month with its per-account totals, so later changes are caught.
 * @sideEffects RPC `close_ledger_period`.
 */
export async function closeLedgerPeriod(period: string, note: string, totals: Record<string, number>): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('close_ledger_period', { p_period: period, p_note: note, p_totals: totals });
  fail(error, 'Could not close this month.');
}

/**
 * @purpose Reopen a closed month, with the reason kept as an audit note.
 * @sideEffects RPC `reopen_ledger_period`.
 */
export async function reopenLedgerPeriod(period: string, reason: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('reopen_ledger_period', { p_period: period, p_reason: reason });
  fail(error, 'Could not reopen this month.');
}
