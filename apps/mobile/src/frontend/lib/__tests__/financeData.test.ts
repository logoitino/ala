/** BOOKS-02: the finance data catalog covers every money column in the schema, reconciliation catches
 * missing / changed / orphaned revenue rows and money with no posting path, transactions filter and
 * export exactly what is shown, and the tax calendar is correct. Synthetic data only. */
import fs from 'node:fs';
import path from 'node:path';
import { buildJournal, type RevenueLogInput } from '@tapuai/shared-types/admin/bookkeeping';
import { FINANCE_DATA_CATALOG, MONEY_COLUMN_PATTERN, catalogCoverage, schemaColumnsFromSql } from '@tapuai/shared-types/admin/financeCatalog';
import { VAULT_ASSUMED_CENTS, channelBySourceId, reconcileSources, type FinanceSources } from '@tapuai/shared-types/admin/financeChecks';
import { filterOptions, filterTransactions, transactionRows, transactionsCsv, transactionTotals } from '@tapuai/shared-types/admin/financeFilters';
import { nextBusinessDay, taxCalendar, taxReadiness, upcomingDeadlines } from '@tapuai/shared-types/admin/financeTax';
import { tipChannelLabel } from '@/lib/finance';

const ROOT = path.resolve(__dirname, '../../../../../..');
const schema = fs.readFileSync(path.join(ROOT, 'apps/mobile/src/backend/db/schema.sql'), 'utf8');

describe('finance data catalog', () => {
  it('lists every money-looking column in schema.sql, and nothing that is gone', () => {
    const coverage = catalogCoverage(schemaColumnsFromSql(schema));
    expect(coverage.missing).toEqual([]);
    expect(coverage.stale).toEqual([]);
  });

  it('includes every migration not yet copied onto schema.sql', () => {
    const migrations = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).filter((file) => file.endsWith('.sql'));
    const columns = migrations.flatMap((file) => schemaColumnsFromSql(fs.readFileSync(path.join(ROOT, 'supabase/migrations', file), 'utf8')));
    expect(catalogCoverage([...schemaColumnsFromSql(schema), ...columns]).missing).toEqual([]);
  });

  it('flags a new money column the moment it is added', () => {
    const coverage = catalogCoverage([...schemaColumnsFromSql(schema), { table: 'tips', column: 'refund_cents' }]);
    expect(coverage.missing).toEqual([{ table: 'tips', column: 'refund_cents' }]);
  });

  it('gives every entry an owner, a meaning and a books treatment, once', () => {
    const keys = FINANCE_DATA_CATALOG.map((row) => `${row.table}.${row.column}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const row of FINANCE_DATA_CATALOG) {
      expect(row.owner).toMatch(/^[A-Z_]+$/);
      expect(row.meaning.length).toBeGreaterThan(10);
      expect(row.books.length).toBeGreaterThan(3);
      if (row.treatment === 'not-yet-posted') expect(row.gap).toBeTruthy();
    }
    expect(MONEY_COLUMN_PATTERN.test('amount_cents')).toBe(true);
    expect(MONEY_COLUMN_PATTERN.test('aura_points')).toBe(false);
  });
});

const tip = (id: string, amount: number, extra: Partial<{ platform_tip_cents: number; cover_fee_cents: number; origin: string; entry: string; source_label: string }> = {}) =>
  ({ id, player_id: 'p1', amount_cents: amount, created_at: '2026-10-02T00:00:00Z', ...extra });
const log = (source: string, sourceId: string, gross: number, platform = gross, payout = 0): RevenueLogInput =>
  ({ id: `log-${source}-${sourceId}`, source, source_id: sourceId, label: source, gross_cents: gross, platform_cents: platform, payout_cents: payout, payee_kind: 'none', player_id: 'p1', created_at: '2026-10-02T00:00:00Z' });

const sources = (over: Partial<FinanceSources> = {}): FinanceSources => ({
  tips: [tip('t1', 1000, { platform_tip_cents: 100, cover_fee_cents: 59, origin: 'highlight', entry: 'qr_link' }), tip('t2', 2500, { origin: 'rally', source_label: 'Cleats' })],
  subscriptions: [{ id: 's1', athlete_id: 'p1', status: 'active', created_at: '2026-10-03T00:00:00Z' }],
  sponsorships: [{ id: 'b1', business_name: 'Plate Lunch', amount_cents: 10000, billing_interval: 'once', status: 'active', created_at: '2026-10-03T00:00:00Z' }],
  shopOrders: [{ id: 'o1', product_id: 'hoodie', amount_cents: 4500, created_at: '2026-10-03T00:00:00Z' }],
  withdrawals: [],
  filmerCash: [],
  coverFeeColumn: true,
  ...over,
});
const fullLog = (): RevenueLogInput[] => [
  log('malo', 't1', 1000, 100, 900), log('malo', 't2', 2500, 250, 2250), log('tip', 't1', 100), log('card_fee', 't1', 59),
  log('vault', 's1', VAULT_ASSUMED_CENTS, 100, 399), log('booster', 'b1', 10000, 1500, 8500), log('merch', 'o1', 4500),
];

describe('source-to-ledger reconciliation', () => {
  it('reports every stream complete when each source row has one matching log row', () => {
    const { rows, findings } = reconcileSources(fullLog(), sources());
    expect(rows.map((row) => [row.stream, row.status])).toEqual([['malo', 'match'], ['tip', 'match'], ['card_fee', 'match'], ['vault', 'match'], ['booster', 'match'], ['merch', 'match']]);
    expect(findings.filter((f) => f.severity !== 'info')).toEqual([]);
  });

  it('catches a gift missing from the log, a changed amount and an orphan row', () => {
    const revenue = fullLog().filter((row) => !(row.source === 'malo' && row.source_id === 't2')).map((row) => (row.source === 'merch' ? { ...row, gross_cents: 4000 } : row));
    revenue.push(log('tip', 'gone', 50));
    const { rows, findings } = reconcileSources(revenue, sources());
    expect(rows.find((row) => row.stream === 'malo')).toEqual(expect.objectContaining({ status: 'gap', missing: ['t2'] }));
    expect(rows.find((row) => row.stream === 'merch')!.mismatched).toEqual([{ id: 'o1', source: 4500, ledger: 4000 }]);
    expect(rows.find((row) => row.stream === 'tip')!.orphans).toEqual(['gone']);
    expect(findings.map((f) => f.id)).toEqual(expect.arrayContaining(['recon-missing:malo', 'recon-mismatch:merch', 'recon-orphan:tip']));
    expect(findings.find((f) => f.id === 'recon-missing:malo')!.severity).toBe('block');
  });

  it('shows an unread source as unread, never as zero', () => {
    const { rows, findings } = reconcileSources(fullLog(), sources({ shopOrders: null, coverFeeColumn: false }));
    expect(rows.find((row) => row.stream === 'merch')).toEqual(expect.objectContaining({ status: 'unread', sourceCount: 0 }));
    expect(rows.find((row) => row.stream === 'card_fee')!.status).toBe('unread');
    expect(findings.find((f) => f.id === 'recon-unread:merch')!.severity).toBe('warn');
    expect(findings.find((f) => f.id === 'recon-unread:card_fee')!.severity).toBe('info');
  });

  it('flags money with no posting path: paid withdrawals, filmer cash, monthly renewals, ended Vault access', () => {
    const { findings } = reconcileSources(fullLog(), sources({
      withdrawals: [{ id: 'w1', player_id: 'p1', amount_cents: 2000, status: 'paid', created_at: '2026-10-05T00:00:00Z' }, { id: 'w2', player_id: 'p1', amount_cents: 500, status: 'pending_athlete', created_at: '2026-10-05T00:00:00Z' }],
      filmerCash: [{ id: 'f1', cash_cents: 500, created_at: '2026-10-05T00:00:00Z' }, { id: 'f2', cash_cents: 0, created_at: '2026-10-05T00:00:00Z' }],
      sponsorships: [{ id: 'b1', business_name: 'Plate Lunch', amount_cents: 10000, billing_interval: 'month', status: 'active', created_at: '2026-10-03T00:00:00Z' }],
      subscriptions: [{ id: 's1', athlete_id: 'p1', status: 'cancelled', created_at: '2026-10-03T00:00:00Z' }],
    }));
    const byId = Object.fromEntries(findings.map((f) => [f.id, f]));
    expect(byId['withdrawals-paid-outside-books']).toEqual(expect.objectContaining({ severity: 'block', count: 1 }));
    expect(byId['filmer-cash-unposted'].count).toBe(1);
    expect(byId['booster-renewals'].severity).toBe('warn');
    expect(byId['vault-inactive-counted'].severity).toBe('info');
  });

  it('clears a paid withdrawal once a matching payout is recorded, and flags unread withdrawal / filmer sources', () => {
    const withdrawals = [{ id: 'w1', player_id: 'p1', amount_cents: 2000, status: 'paid', created_at: '2026-10-05T00:00:00Z' }];
    const matched = reconcileSources(fullLog(), sources({ withdrawals }), [{ id: 'd1', player_id: 'p1', amount_cents: 2000, status: 'paid', created_at: '2026-10-06T00:00:00Z' }]);
    expect(matched.findings.some((f) => f.id === 'withdrawals-paid-outside-books')).toBe(false);
    const unread = reconcileSources(fullLog(), sources({ withdrawals: null, filmerCash: null }));
    expect(unread.findings.map((f) => f.id)).toEqual(expect.arrayContaining(['recon-unread:withdrawals', 'recon-unread:filmer_rewards']));
  });
});

describe('transactions explorer', () => {
  const revenue = fullLog();
  const { entries } = buildJournal({ revenue, disbursements: [{ id: 'p1', player_id: 'p1', amount_cents: 500, status: 'paid', created_at: '2026-10-09T00:00:00Z' }], manual: [] });
  const channels = channelBySourceId(sources().tips, tipChannelLabel);
  const rows = transactionRows(entries, channels);

  it('summarizes each entry with its channel and both sides of the split', () => {
    const donation = rows.find((row) => row.entryId === 'rev:malo:t1')!;
    expect(donation).toEqual(expect.objectContaining({ channel: 'Highlight via QR', amount: 1000, tapuai: 100, heldForOthers: 900, streamTitle: 'Gift' }));
    expect(rows.find((row) => row.entryId === 'rev:malo:t2')!.channel).toBe('Rally · Cleats');
    expect(rows.find((row) => row.origin === 'disbursement')!.heldForOthers).toBe(-500);
  });

  it('filters by stream, channel, account, side, amount and text', () => {
    expect(filterTransactions(rows, { streams: ['malo'] })).toHaveLength(2);
    expect(filterTransactions(rows, { channel: 'Rally' }).map((row) => row.sourceId)).toEqual(['t2']);
    expect(filterTransactions(rows, { account: '2100' }).map((row) => row.stream)).toEqual(['booster']);
    expect(filterTransactions(rows, { side: 'held' }).every((row) => row.heldForOthers !== 0)).toBe(true);
    expect(filterTransactions(rows, { minCents: 4500, maxCents: 10000 }).map((row) => row.stream).sort()).toEqual(['booster', 'merch']);
    expect(filterTransactions(rows, { origins: ['disbursement'] })).toHaveLength(1);
    expect(filterTransactions(rows, { text: 'kaleo' }, { 'ath-p1': 'Kaleo' }).length).toBeGreaterThan(0);
    expect(filterTransactions(rows, { from: '2026-10-09', to: '2026-10-09' })).toHaveLength(1);
  });

  it('offers only values present, totals what is shown and exports exactly the filtered rows without names', () => {
    const options = filterOptions(rows);
    expect(options.channels).toEqual(['Highlight via QR', 'Rally']);
    expect(options.accounts.map((a) => a.id)).toContain('4010');
    const shown = filterTransactions(rows, { streams: ['malo'] });
    expect(transactionTotals(shown)).toEqual({ count: 2, amount: 3500, tapuai: 350, heldForOthers: 3150 });
    const csv = transactionsCsv(shown);
    expect(csv.trim().split('\r\n')).toHaveLength(3);
    expect(csv).not.toMatch(/Kaleo/);
    // The Rally title a family typed shows on screen but never reaches the export.
    expect(csv).toContain('Rally');
    expect(csv).not.toContain('Cleats');
  });
});

describe('tax calendar and readiness', () => {
  it('moves weekend and holiday deadlines to the next business day', () => {
    expect(nextBusinessDay('2026-01-31')).toBe('2026-02-02');
    expect(nextBusinessDay('2026-04-15')).toBe('2026-04-15');
    expect(taxCalendar(2028).find((row) => row.title.startsWith('Estimated tax, period 4'))!.date).toBe('2028-01-18');
  });

  it('lists the federal deadlines in order and crosses into next year', () => {
    const dates = taxCalendar(2026).map((row) => row.date);
    expect([...dates].sort()).toEqual(dates);
    expect(taxCalendar(2026).filter((row) => row.form === '1040-ES')).toHaveLength(4);
    const next = upcomingDeadlines('2026-12-20', 3);
    expect(next[0].date.startsWith('2027-01')).toBe(true);
  });

  it('marks owner-side items missing and data items from facts', () => {
    const items = taxReadiness({ manualConfigured: true, coverFeeColumn: false, hasExpenseEntries: true, hasStripeFeeEntries: false, liveMode: false, payeesOverThreshold: 2 });
    const byId = Object.fromEntries(items.map((item) => [item.id, item]));
    expect(byId.expenses.state).toBe('ready');
    expect(byId['stripe-fees'].state).toBe('partial');
    expect(byId['card-fees'].state).toBe('missing');
    expect(byId.cpa.state).toBe('missing');
    expect(byId.w9.detail).toMatch(/2 payee/);
  });
});
