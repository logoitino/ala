/** Existing athlete support screen/helper: visible money copy names personal gifts; identifiers and financial behavior stay unchanged. */
import fs from 'node:fs';
import path from 'node:path';
import {
  CHART_OF_ACCOUNTS,
  athleteHeld,
  athleteRef,
  booksQualityIssues,
  buildJournal,
  chartOfAccountsCsv,
  closeTotals,
  csvCell,
  entriesBetween,
  generalLedgerCsv,
  heldRollForward,
  journalFromDisbursement,
  journalFromRevenue,
  manualEntryLines,
  nextBusinessDay,
  estimatedTaxPeriods,
  parseUsdCents,
  refundEntryLines,
  periodFor,
  profitAndLoss,
  qboJournalCsv,
  shiftPeriod,
  taxSummaryCsv,
  taxYearSummary,
  trialBalance,
  type BooksInput,
  type RevenueLogInput,
} from '@tapuai/shared-types/admin/bookkeeping';

const KALEO = '11111111-2222-3333-4444-555555555555';
const SINA = '99999999-8888-7777-6666-555555555555';

const rev = (over: Partial<RevenueLogInput>): RevenueLogInput => ({
  id: over.id ?? `r-${Math.random()}`,
  source: 'malo',
  label: 'Mālo · Highlight · Kaleo',
  gross_cents: 1000,
  platform_cents: 100,
  payout_cents: 900,
  payee_kind: 'athlete',
  player_id: KALEO,
  created_at: '2026-10-03T18:00:00Z',
  ...over,
});

const sample: BooksInput = {
  revenue: [
    rev({ id: 'd1', source_id: 'tip-1' }),
    rev({ id: 'd2', source_id: 'tip-2', gross_cents: 2500, platform_cents: 250, payout_cents: 2250, player_id: SINA, created_at: '2026-10-04T01:00:00Z' }),
    rev({ id: 't1', source: 'tip', source_id: 'tip-2', label: "Tip to Tapua'i", gross_cents: 250, platform_cents: 250, payout_cents: 0, payee_kind: 'none', created_at: '2026-10-04T01:00:00Z' }),
    rev({ id: 'v1', source: 'vault', label: 'Vault · Kaleo', gross_cents: 499, platform_cents: 100, payout_cents: 399, created_at: '2026-10-05T12:00:00Z' }),
    rev({ id: 'b1', source: 'booster', label: 'Booster · Island Plate Lunch', gross_cents: 10000, platform_cents: 1500, payout_cents: 8500, payee_kind: 'operator', player_id: null, created_at: '2026-10-06T12:00:00Z' }),
    rev({ id: 'm1', source: 'merch', label: 'Drip · Hoodie', gross_cents: 4500, platform_cents: 4500, payout_cents: 0, payee_kind: 'none', player_id: null, created_at: '2026-09-28T12:00:00Z' }),
  ],
  disbursements: [
    { id: 'p1', player_id: KALEO, amount_cents: 500, status: 'paid', created_at: '2026-10-07T12:00:00Z', paid_at: '2026-10-08T09:00:00Z' },
    { id: 'p2', player_id: SINA, amount_cents: 1000, status: 'queued', created_at: '2026-10-07T12:00:00Z' },
  ],
  manual: [
    { id: 'e1', entry_date: '2026-10-31', kind: 'stripe_fees', memo: 'October Stripe fees', reference: 'stripe-oct', lines: [{ account_code: '5000', debit_cents: 180, credit_cents: 0 }, { account_code: '1010', debit_cents: 0, credit_cents: 180 }] },
  ],
};

describe('posting rules', () => {
  it('splits a gift into the Stripe balance, money held for the family and the 10% share', () => {
    const { entry, issues } = journalFromRevenue(rev({ id: 'd1' }));
    expect(issues).toEqual([]);
    expect(entry!.lines).toEqual([
      expect.objectContaining({ account: '1010', debit: 1000, credit: 0 }),
      expect.objectContaining({ account: '2000', debit: 0, credit: 900, athleteRef: athleteRef(KALEO) }),
      expect.objectContaining({ account: '4000', debit: 0, credit: 100 }),
    ]);
    expect(entry!.date).toBe('2026-10-03');
  });

  it("keeps the athlete's name out of the journal memo", () => {
    expect(journalFromRevenue(rev({ id: 'd1' })).entry!.memo).toBe('Highlight');
    expect(athleteRef(KALEO)).toBe('ath-11111111');
  });

  it('books the optional tip, Drip and booster shares to their own accounts', () => {
    const { entries } = buildJournal(sample);
    const byId = Object.fromEntries(entries.map((entry) => [entry.id, entry]));
    expect(byId['rev:tip:tip-2'].lines.map((line) => line.account)).toEqual(['1010', '4010']);
    expect(byId['rev:merch:m1'].lines.find((line) => line.account === '4040')!.credit).toBe(4500);
    expect(byId['rev:booster:b1'].lines.find((line) => line.account === '2100')).toEqual(expect.objectContaining({ credit: 8500, athleteRef: null }));
    expect(byId['rev:vault:v1'].lines.find((line) => line.account === '2010')!.credit).toBe(399);
  });

  it('puts a split that does not add up into Suspense and still balances', () => {
    const { entry, issues } = journalFromRevenue(rev({ id: 'x', gross_cents: 1000, platform_cents: 100, payout_cents: 880 }));
    const debit = entry!.lines.reduce((sum, line) => sum + line.debit, 0);
    const credit = entry!.lines.reduce((sum, line) => sum + line.credit, 0);
    expect(debit).toBe(credit);
    expect(entry!.lines.find((line) => line.account === '1999')!.credit).toBe(20);
    expect(issues.map((issue) => issue.id)).toEqual(['split-mismatch:x']);
  });

  it('refuses an unknown stream instead of guessing', () => {
    const { entry, issues } = journalFromRevenue(rev({ id: 'u', source: 'nil_deal' }));
    expect(entry).toBeNull();
    expect(issues[0].severity).toBe('block');
  });

  it('posts a payout only once it is paid, on the paid date', () => {
    expect(journalFromDisbursement(sample.disbursements[1])).toBeNull();
    const paid = journalFromDisbursement(sample.disbursements[0])!;
    expect(paid.date).toBe('2026-10-08');
    expect(paid.lines.map((line) => [line.account, line.debit, line.credit])).toEqual([['2000', 500, 0], ['1010', 0, 500]]);
  });
});

describe('reports', () => {
  const { entries } = buildJournal(sample);
  const october = periodFor('month', '2026-10-12');

  it('balances', () => {
    const tb = trialBalance(entries);
    expect(tb.balanced).toBe(true);
    expect(tb.debit).toBe(tb.credit);
  });

  it("counts only Tapua'i's shares as income", () => {
    const pnl = profitAndLoss(entriesBetween(entries, october.from, october.to));
    expect(pnl.totalIncome).toBe(100 + 250 + 250 + 100 + 1500);
    expect(pnl.totalExpenses).toBe(180);
    expect(pnl.net).toBe(2200 - 180);
  });

  it('rolls money held for families forward from the opening balance', () => {
    const [donations] = heldRollForward(entries, october);
    expect(donations).toEqual(expect.objectContaining({ code: '2000', opening: 0, added: 900 + 2250, paidOut: 500, closing: 2650 }));
    const november = heldRollForward(entries, shiftPeriod(october, 1));
    expect(november[0].opening).toBe(2650);
  });

  it('keeps a per-athlete subledger that matches the control account', () => {
    const rows = athleteHeld(entries, october.to, [KALEO, SINA]);
    expect(rows.find((row) => row.playerId === SINA)!.held).toBe(2250);
    expect(rows.find((row) => row.playerId === KALEO)).toEqual(expect.objectContaining({ donations: 900, vault: 399, paidOut: 500, held: 799 }));
    const control = heldRollForward(entries, october).filter((row) => row.code !== '2100').reduce((sum, row) => sum + row.closing, 0);
    expect(rows.reduce((sum, row) => sum + row.held, 0)).toBe(control);
  });

  it('builds the year-end pack with pass-through money apart from income', () => {
    const tax = taxYearSummary(entries, 2026, sample.revenue);
    expect(tax.grossReceipts).toBe(2200 + 4500);
    // Card processing fees are an ordinary expense (commissions and fees); only Drip stock is cost of goods sold.
    expect(tax.costOfSales).toBe(0);
    expect(tax.expensesByLine).toEqual([{ taxLine: 'Commissions and fees', amount: 180 }]);
    expect(tax.passThrough.received).toBe(900 + 2250 + 399 + 8500);
    expect(tax.stripeGrossEstimate).toBe(1000 + 2500 + 250 + 499 + 10000 + 4500);
    expect(tax.quarters.map((q) => q.dueDate)).toEqual(['2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15']);
    expect(tax.quarters.map((q) => q.label)).toEqual(['Period 1 (Jan–Mar 2026)', 'Period 2 (Apr–May 2026)', 'Period 3 (Jun–Aug 2026)', 'Period 4 (Sep–Dec 2026)']);
    expect(tax.merchSalesByMonth).toEqual([{ month: '2026-09', amount: 4500 }]);
    expect(tax.payees.find((payee) => payee.kind === 'booster-operator')).toEqual(expect.objectContaining({ payee: 'Island Plate Lunch', earned: 8500, paid: null, overThreshold: false }));
    expect(tax.payees.find((payee) => payee.kind === 'athlete-vault')).toEqual(expect.objectContaining({ earned: 399, paid: 0 }));
    expect(taxSummaryCsv(tax)).toContain('Pass-through');
  });
});

describe('periods', () => {
  it('handles month ends, quarters and years', () => {
    expect(periodFor('month', '2028-02-10')).toEqual(expect.objectContaining({ from: '2028-02-01', to: '2028-02-29', label: 'February 2028' }));
    expect(periodFor('quarter', '2026-11-03')).toEqual(expect.objectContaining({ from: '2026-10-01', to: '2026-12-31', label: 'Q4 2026' }));
    expect(shiftPeriod(periodFor('month', '2026-01-15'), -1).key).toBe('2025-12');
    expect(shiftPeriod(periodFor('quarter', '2026-01-15'), -1).label).toBe('Q4 2025');
  });
});

describe('quality checks', () => {
  const { entries, issues } = buildJournal(sample);
  const october = periodFor('month', '2026-10-01');
  const ctx = { period: october, manualConfigured: true, revenueTruncated: false, missingPaymentIds: true, testMode: true, closes: [], queuedPayoutCents: 1000 };

  it('flags test mode, queued payouts and missing payment ids, but not fees once recorded', () => {
    const ids = booksQualityIssues(entries, issues, ctx).map((issue) => issue.id);
    expect(ids).toEqual(expect.arrayContaining(['test-mode', 'queued-payouts', 'no-payment-ids']));
    expect(ids).not.toContain('no-stripe-fees');
  });

  it('asks for Stripe fees when a period has charges but no fee entry', () => {
    const noFees = buildJournal({ ...sample, manual: [] });
    expect(booksQualityIssues(noFees.entries, noFees.issues, ctx).map((issue) => issue.id)).toContain('no-stripe-fees');
  });

  it('notices a closed month that changed after it was closed', () => {
    const totals = closeTotals(entries, '2026-10');
    const quiet = booksQualityIssues(entries, issues, { ...ctx, closes: [{ period: '2026-10', closed_at: '2026-11-01', totals }] });
    expect(quiet.some((issue) => issue.id.startsWith('changed-after-close'))).toBe(false);
    const later = buildJournal({ ...sample, revenue: [...sample.revenue, rev({ id: 'late', created_at: '2026-10-20T00:00:00Z' })] });
    const loud = booksQualityIssues(later.entries, later.issues, { ...ctx, closes: [{ period: '2026-10', closed_at: '2026-11-01', totals }] });
    expect(loud.find((issue) => issue.id === 'changed-after-close:2026-10')!.severity).toBe('block');
  });

  it('blocks when paid out exceeds what was received', () => {
    const over = buildJournal({ revenue: [], manual: [], disbursements: [{ id: 'p', player_id: KALEO, amount_cents: 100, status: 'paid', created_at: '2026-10-02T00:00:00Z' }] });
    expect(booksQualityIssues(over.entries, over.issues, ctx).find((issue) => issue.id === 'negative:2000')!.severity).toBe('block');
  });
});

describe('manual entries', () => {
  it('builds two balanced lines and explains a bad amount', () => {
    expect(manualEntryLines('software', 2500, 'owner')).toEqual({ lines: [{ account_code: '6000', debit_cents: 2500, credit_cents: 0 }, { account_code: '2300', debit_cents: 0, credit_cents: 2500 }] });
    expect(manualEntryLines('stripe_fees', 180, 'bank')).toEqual({ lines: [expect.objectContaining({ account_code: '5000' }), expect.objectContaining({ account_code: '1010' })] });
    expect(manualEntryLines('software', 0, 'bank')).toEqual({ error: expect.stringMatching(/above/) });
    expect(manualEntryLines('nope', 100, 'bank')).toEqual({ error: expect.any(String) });
    expect(manualEntryLines('refund', 100, 'bank')).toEqual({ error: expect.stringMatching(/refund fields/) });
    expect(manualEntryLines('pay_booster_operator', 100, 'owner')).toEqual({ error: expect.stringMatching(/owner/) });
    expect(manualEntryLines('repay_owner', 100, 'bank')).toEqual({ lines: [expect.objectContaining({ account_code: '2300' }), expect.objectContaining({ account_code: '1000' })] });
  });

  it('parses typed dollar amounts', () => {
    expect(parseUsdCents('$1,234.5')).toBe(123450);
    expect(parseUsdCents('99')).toBe(9900);
    expect(parseUsdCents('12.345')).toBeNull();
    expect(parseUsdCents('-5')).toBeNull();
  });
});

describe('exports', () => {
  const { entries } = buildJournal(sample);

  it('rolls each day into one balanced QuickBooks journal with no athlete names or ids', () => {
    const { csv, journals } = qboJournalCsv(entries, 'daily');
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('Journal No,Journal Date,Memo,Account,Debits,Credits,Description,Name');
    expect(lines.some((line) => line.startsWith('TP-20261003-MALO,10/03/2026'))).toBe(true);
    expect(csv).not.toMatch(/Kaleo|ath-|11111111/);
    expect(journals).toBeGreaterThan(0);
    const totals = new Map<string, number>();
    for (const line of lines.slice(1)) {
      const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((cell) => cell.replace(/,$/, ''));
      totals.set(cells[0], (totals.get(cells[0]) ?? 0) + Math.round(Number(cells[4] || 0) * 100) - Math.round(Number(cells[5] || 0) * 100));
    }
    expect([...totals.values()].every((net) => net === 0)).toBe(true);
  });

  it('writes every line in the general ledger export', () => {
    const csv = generalLedgerCsv(entries);
    expect(csv.trim().split('\r\n')).toHaveLength(1 + entries.reduce((sum, entry) => sum + entry.lines.length, 0));
    expect(csv).toContain('ath-11111111');
  });

  it('defuses spreadsheet formulas and quotes commas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('Plate Lunch, LLC')).toBe('"Plate Lunch, LLC"');
    expect(csvCell(12)).toBe('12');
  });

  it('exports the chart of accounts in the QuickBooks layout', () => {
    const csv = chartOfAccountsCsv();
    expect(csv.split('\r\n')[0]).toBe('Account Number,Account Name,Type,Detail Type,Description');
    expect(csv).toContain('2000,Gifts held for families,Other Current Liability');
  });
});

describe('chart of accounts', () => {
  it('matches the codes seeded by the bookkeeping migration', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../../../../../../supabase/migrations/20261012210000_bookkeeping_ledger.sql'), 'utf8');
    const seed = sql.slice(sql.indexOf('insert into public.ledger_accounts'), sql.indexOf('on conflict (code)'));
    const seeded = [...seed.matchAll(/\('(\d{4})',\s*'[^']*(?:''[^']*)*',\s*'(\w+)'/g)].map((match) => `${match[1]}:${match[2]}`).sort();
    expect(seeded).toEqual(CHART_OF_ACCOUNTS.map((account) => `${account.code}:${account.type}`).sort());
  });
});

describe('review fixes (CONTROLLER / TAX / QA, 2026-10-13)', () => {
  it('refunds the whole charge: family share back out of held money for that athlete, Tapua\'i share to contra-income', () => {
    const built = refundEntryLines({ stream: 'malo', grossCents: 10000, extraTapuaiCents: 500, disputeFeeCents: 1500, athleteRef: 'ath-11111111' });
    expect(built).toEqual({ lines: [
      { account_code: '2000', debit_cents: 9000, credit_cents: 0, athlete_ref: 'ath-11111111' },
      { account_code: '4900', debit_cents: 1500, credit_cents: 0 },
      { account_code: '5000', debit_cents: 1500, credit_cents: 0, memo: 'Dispute fee' },
      { account_code: '1010', debit_cents: 0, credit_cents: 12000 },
    ] });
    expect(refundEntryLines({ stream: 'malo', grossCents: 100 })).toEqual({ error: expect.stringMatching(/athlete/) });
    expect(refundEntryLines({ stream: 'merch', grossCents: 4500 })).toEqual({ lines: [{ account_code: '4900', debit_cents: 4500, credit_cents: 0 }, { account_code: '1010', debit_cents: 0, credit_cents: 4500 }] });
    const { entries } = buildJournal({ ...sample, manual: [{ id: 'r1', entry_date: '2026-10-20', kind: 'refund', memo: 'Refund', lines: (refundEntryLines({ stream: 'malo', grossCents: 1000, athleteRef: athleteRef(KALEO) }) as { lines: never[] }).lines }] });
    expect(athleteHeld(entries, '2026-10-31').find((row) => row.athleteRef === athleteRef(KALEO))!.held).toBe(799 - 900);
  });

  it('pays an athlete out of gifts first, then Vault earnings', () => {
    const { entries } = buildJournal({ ...sample, disbursements: [{ id: 'big', player_id: KALEO, amount_cents: 1299, status: 'paid', created_at: '2026-10-10T00:00:00Z' }] });
    const payout = entries.find((entry) => entry.id === 'pay:big')!;
    expect(payout.lines.map((line) => [line.account, line.debit, line.credit])).toEqual([['2000', 900, 0], ['2010', 399, 0], ['1010', 0, 1299]]);
    expect(athleteHeld(entries, '2026-10-31').find((row) => row.playerId === null && row.athleteRef === athleteRef(KALEO))?.held ?? athleteHeld(entries, '2026-10-31', [KALEO]).find((row) => row.playerId === KALEO)!.held).toBe(0);
  });

  it('blocks when one athlete was paid more than was held for them, even if the account total is positive', () => {
    const { entries, issues } = buildJournal({ ...sample, disbursements: [{ id: 'over', player_id: KALEO, amount_cents: 2000, status: 'paid', created_at: '2026-10-10T00:00:00Z' }] });
    const found = booksQualityIssues(entries, issues, { period: periodFor('month', '2026-10-01'), manualConfigured: true, revenueTruncated: false, missingPaymentIds: false, testMode: false, closes: [], queuedPayoutCents: 0 });
    expect(found.find((issue) => issue.id === 'athlete-below-zero')!.severity).toBe('block');
  });

  it('blocks when cash is less than the money held for others', () => {
    const { entries, issues } = buildJournal({ ...sample, manual: [{ id: 'draw', entry_date: '2026-10-21', kind: 'owner_draw', memo: 'Draw', lines: [{ account_code: '3100', debit_cents: 15000, credit_cents: 0 }, { account_code: '1010', debit_cents: 0, credit_cents: 15000 }] }] });
    const found = booksQualityIssues(entries, issues, { period: periodFor('month', '2026-10-01'), manualConfigured: true, revenueTruncated: false, missingPaymentIds: false, testMode: false, closes: [], queuedPayoutCents: 0 });
    expect(found.find((issue) => issue.id === 'cash-below-held')!.severity).toBe('block');
  });

  it('refuses a negative revenue row instead of clamping it away', () => {
    const { entry, issues } = journalFromRevenue(rev({ id: 'neg', gross_cents: -1000, platform_cents: -100, payout_cents: -900 }));
    expect(entry).toBeNull();
    expect(issues[0]).toEqual(expect.objectContaining({ severity: 'block', id: 'negative-amount:neg' }));
  });

  it('keeps a family-typed Rally or gear-goal title and the athlete name out of memos', () => {
    expect(journalFromRevenue(rev({ id: 'r', label: 'Mālo · Rally · New cleats for Kaleo · Kaleo' })).entry!.memo).toBe('Rally');
    expect(journalFromRevenue(rev({ id: 'b', source: 'booster', label: 'Booster · Plate Lunch', payee_kind: 'operator', player_id: null, gross_cents: 1000, platform_cents: 150, payout_cents: 850 })).entry!.memo).toBe('Booster · Plate Lunch');
  });

  it('keeps negative numbers numeric in CSV', () => {
    expect(csvCell('-5.00')).toBe('-5.00');
    expect(csvCell('-cmd')).toBe("'-cmd");
  });

  it('moves deadlines off weekends and federal / DC holidays', () => {
    expect(nextBusinessDay('2028-01-15')).toBe('2028-01-18'); // Saturday, then MLK Day
    expect(nextBusinessDay('2028-04-15')).toBe('2028-04-18'); // Saturday, then Emancipation Day observed
    expect(nextBusinessDay('2026-04-15')).toBe('2026-04-15');
    expect(estimatedTaxPeriods(2027).map((p) => p.dueDate)).toEqual(['2027-04-15', '2027-06-15', '2027-09-15', '2028-01-18']);
  });

  it('catches money moved between athletes in a closed month', () => {
    const { entries, issues } = buildJournal(sample);
    const totals = closeTotals(entries, '2026-10');
    expect(totals.entries).toBeGreaterThan(0);
    const swapped = entries.map((entry) => entry.id === 'rev:malo:tip-1' ? { ...entry, lines: entry.lines.map((line) => line.athleteRef ? { ...line, athleteRef: athleteRef(SINA) } : line) } : entry);
    const found = booksQualityIssues(swapped, issues, { period: periodFor('month', '2026-10-01'), manualConfigured: true, revenueTruncated: false, missingPaymentIds: false, testMode: false, closes: [{ period: '2026-10', closed_at: '2026-11-01', totals }], queuedPayoutCents: 0 });
    expect(found.some((issue) => issue.id === 'changed-after-close:2026-10')).toBe(true);
  });

  it('blocks exports until the books are read and every source read completely', () => {
    const { entries, issues } = buildJournal(sample);
    const found = booksQualityIssues(entries, issues, { period: periodFor('month', '2026-10-01'), manualConfigured: false, revenueTruncated: false, missingPaymentIds: false, testMode: false, closes: [], queuedPayoutCents: 0, loaded: false, readErrors: { Payouts: 'permission denied' } });
    expect(found.filter((issue) => issue.severity === 'block').map((issue) => issue.id)).toEqual(expect.arrayContaining(['not-loaded', 'read-failed:Payouts']));
    expect(found.some((issue) => issue.id === 'manual-off')).toBe(false);
  });
});
