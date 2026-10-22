/**
 * Finance data catalog (BOOKS-02, owned by FINANCE_DATA, reviewed by INTERNAL_CONTROLS): every column
 * in the database that holds money or decides where money goes, what it means, its unit, and how the
 * books treat it. A unit test parses `schema.sql` and fails when a money-looking column is not listed
 * here, so a new money field cannot land without Finance knowing how it is booked.
 *
 * Treatments:
 * - `posted` — becomes journal lines (directly, or through `company_revenue_logs`).
 * - `derived` — a running total of rows that are already posted; never posted again.
 * - `control` — decides who may be paid or how money is routed; not an amount.
 * - `not-yet-posted` — real or future money the journal does not book yet. Each has a `gap` and a
 *   reconciliation check, so it is visible instead of silently missing.
 * - `reference` — an id or time used to match money to Stripe or to date it.
 */

export type CatalogTreatment = 'posted' | 'derived' | 'control' | 'not-yet-posted' | 'reference';
export type CatalogUnit = 'cents' | 'dollars' | 'flag' | 'text' | 'count' | 'timestamp';

export type FinanceColumn = {
  table: string;
  column: string;
  unit: CatalogUnit;
  meaning: string;
  treatment: CatalogTreatment;
  /** Revenue stream or account the amount reaches, in plain words. */
  books: string;
  /** Agent call accountable for the meaning of this field. */
  owner: string;
  /** What is missing today, when anything is. */
  gap?: string;
};

/**
 * Column names that look like money or payment routing. The coverage test applies this to every
 * column in `schema.sql`; anything it matches must appear in FINANCE_DATA_CATALOG.
 */
export const MONEY_COLUMN_PATTERN = /(_cents$|amount|price|_fee|payout|revenue|_bps$|dollars|stripe_|paid_at$|payment_intent|_frozen$|funded_by$|backer_count$|billing_interval$)/i;

export const FINANCE_DATA_CATALOG: FinanceColumn[] = [
  // NOTIFY-01 quotes/processor observations are matching evidence, never another journal writer.
  { table: 'notification_payment_contexts', column: 'payment_intent_id', unit: 'text', meaning: 'Processor PaymentIntent bound to an immutable server-owned gift quote context.', treatment: 'reference', books: 'Matching only; no canonical credit or journal posting', owner: 'RECONCILIATION', gap: 'Trusted runtime quote/persist adapters and atomic canonical credit/outbox integration remain unwired.' },
  { table: 'notification_payment_contexts', column: 'gift_cents', unit: 'cents', meaning: "Quoted gift allocation excluding covered fee and optional tip for Tapua'i.", treatment: 'control', books: 'Quote validation only; received gifts are posted through the canonical ledger', owner: 'COMMERCE', gap: 'Notification authority false; quote context is not a successful gift.' },
  { table: 'notification_payment_contexts', column: 'cover_fee_cents', unit: 'cents', meaning: 'Quoted card-fee allocation the giver chose to cover.', treatment: 'control', books: 'Quote validation only; no fee income is posted from this row', owner: 'COMMERCE' },
  { table: 'notification_payment_contexts', column: 'platform_tip_cents', unit: 'cents', meaning: "Quoted optional tip for Tapua'i allocation within the processor charge.", treatment: 'control', books: 'Quote validation only; no optional-tip income is posted from this row', owner: 'COMMERCE' },
  { table: 'notification_payment_contexts', column: 'total_cents', unit: 'cents', meaning: "Quoted integer total matching gift, covered fee and optional tip for Tapua'i allocations.", treatment: 'control', books: 'Charge validation only; never added to journal totals', owner: 'COMMERCE' },
  { table: 'notification_payment_contexts', column: 'refunded_cents', unit: 'cents', meaning: 'Cumulative verified refund observation retained against the immutable payment context.', treatment: 'reference', books: 'Reconciliation evidence only; does not correct a gift or post a refund', owner: 'RECONCILIATION', gap: 'Canonical refund accounting/outbox integration is absent; observations do not establish completed refund accounting.' },
  { table: 'notification_payment_observations', column: 'refunded_cents', unit: 'cents', meaning: 'Cumulative processor-refund observation for one verified event, including reordered repeats.', treatment: 'reference', books: 'Matching history only; not another refund posting', owner: 'RECONCILIATION', gap: 'Processor observation is not canonical refund accounting or notification authority.' },
  // copy-ok: `tips` is the gift table's code name (docs/product/VOICE.md: code names stay)
  { table: 'tips', column: 'amount_cents', unit: 'cents', meaning: 'Gift amount the family account receives the 90% of (excludes card fee and optional tip).', treatment: 'posted', books: "Gifts stream: 90% to Gifts held for families (2000), 10% to Platform share (4000)", owner: 'LEDGER' },
  { table: 'tips', column: 'platform_tip_cents', unit: 'cents', meaning: "Optional tip for Tapua'i added on top of the gift.", treatment: 'posted', books: "Optional tips to Tapua'i (4010) via revenue row source 'tip'", owner: 'CHECKOUT' },
  { table: 'tips', column: 'cover_fee_cents', unit: 'cents', meaning: 'Processing fee the giver chose to cover, charged on top.', treatment: 'posted', books: "Processing fees covered by givers (4050) via revenue row source 'card_fee'", owner: 'CHECKOUT', gap: 'Recorded only after the bookkeeping migration is applied; earlier gifts have no value.' },
  { table: 'tips', column: 'stripe_payment_intent_id', unit: 'text', meaning: 'Stripe PaymentIntent id for matching a payout to its gifts.', treatment: 'reference', books: 'Matching only', owner: 'RECONCILIATION', gap: 'Not yet copied into company_revenue_logs, so deposits are matched by total.' },
  { table: 'stripe_webhook_events', column: 'payment_intent_id', unit: 'text', meaning: 'Retained legacy PaymentIntent claim from the retired pre-claim webhook writer; not proof of completed processing.', treatment: 'reference', books: 'Historical matching evidence only; no completed credit or receipt is established', owner: 'RECONCILIATION', gap: 'Current webhook no longer writes this table. Retain legacy claims for owner-reviewed reconciliation; canonical business application must be proven separately.' },
  { table: 'company_revenue_logs', column: 'gross_cents', unit: 'cents', meaning: 'Whole charge for one revenue event.', treatment: 'posted', books: 'Stripe balance (1010) debit', owner: 'LEDGER' },
  { table: 'company_revenue_logs', column: 'platform_cents', unit: 'cents', meaning: "Tapua'i's share of the charge.", treatment: 'posted', books: 'Income account for the stream (4000–4050)', owner: 'LEDGER' },
  { table: 'company_revenue_logs', column: 'payout_cents', unit: 'cents', meaning: "Payee's share: family, athlete or booster operator.", treatment: 'posted', books: 'Held liability for the stream (2000 / 2010 / 2100)', owner: 'LEDGER' },
  { table: 'company_revenue_logs', column: 'gross_amount', unit: 'dollars', meaning: 'Legacy dollar copy of gross_cents.', treatment: 'derived', books: 'Read only when gross_cents is missing', owner: 'LEDGER' },
  { table: 'company_revenue_logs', column: 'platform_cut_amount', unit: 'dollars', meaning: 'Legacy dollar copy of platform_cents.', treatment: 'derived', books: 'Read only when platform_cents is missing', owner: 'LEDGER' },
  { table: 'company_revenue_logs', column: 'payout_amount', unit: 'dollars', meaning: 'Legacy dollar copy of payout_cents.', treatment: 'derived', books: 'Read only when payout_cents is missing', owner: 'LEDGER' },
  { table: 'disbursements', column: 'amount_cents', unit: 'cents', meaning: 'Payout to a family account.', treatment: 'posted', books: 'When paid: Gifts held for families (2000) debit, Stripe balance (1010) credit', owner: 'TREASURY' },
  { table: 'disbursements', column: 'paid_at', unit: 'timestamp', meaning: 'When the payout was marked paid.', treatment: 'reference', books: 'Entry date of the payout', owner: 'TREASURY', gap: 'Set only after the bookkeeping migration; earlier payouts use the queued date.' },
  { table: 'shop_orders', column: 'amount_cents', unit: 'cents', meaning: 'Drip order total.', treatment: 'posted', books: 'Drip merchandise sales (4040)', owner: 'DRIP', gap: 'No buyer state recorded, so sales tax by state cannot be computed.' },
  { table: 'shop_products', column: 'price_cents', unit: 'cents', meaning: 'Catalog price of a Drip product.', treatment: 'control', books: 'Not an amount received; orders carry their own total', owner: 'DRIP' },
  { table: 'sponsorships', column: 'amount_cents', unit: 'cents', meaning: 'Booster sponsorship amount per billing interval.', treatment: 'posted', books: 'Booster stream: 85% Booster operator payable (2100), 15% Booster sponsorship share (4030)', owner: 'PARTNERSHIPS' },
  { table: 'sponsorships', column: 'billing_interval', unit: 'text', meaning: 'How often the sponsorship bills (month).', treatment: 'control', books: 'Decides whether renewals should appear', owner: 'PARTNERSHIPS', gap: 'Only the first charge is logged; monthly renewals are not recorded.' },
  { table: 'rallies', column: 'target_cents', unit: 'cents', meaning: 'Rally goal amount.', treatment: 'control', books: 'Not money received', owner: 'RALLY' },
  // copy-ok: `tips` is the gift table's code name (docs/product/VOICE.md: code names stay)
  { table: 'rallies', column: 'raised_cents', unit: 'cents', meaning: 'Running total of gifts tagged to the Rally.', treatment: 'derived', books: 'Already posted through tips', owner: 'RALLY' },
  { table: 'wishlist_items', column: 'target_amount_cents', unit: 'cents', meaning: 'Gear goal amount.', treatment: 'control', books: 'Not money received', owner: 'WISHLIST' },
  // copy-ok: `tips` is the gift table's code name (docs/product/VOICE.md: code names stay)
  { table: 'wishlist_items', column: 'current_amount_cents', unit: 'cents', meaning: 'Running total of gifts to the gear goal.', treatment: 'derived', books: 'Already posted through tips', owner: 'WISHLIST' },
  // copy-ok: `tips` is the gift table's code name (docs/product/VOICE.md: code names stay)
  { table: 'reels', column: 'total_tips_cents', unit: 'cents', meaning: 'Running total of gifts made from a Highlight.', treatment: 'derived', books: 'Already posted through tips', owner: 'HIGHLIGHTS' },
  { table: 'players', column: 'backer_count', unit: 'count', meaning: 'Public count of gifts to an athlete.', treatment: 'derived', books: 'Not money', owner: 'PROFILE' },
  { table: 'custodial_withdrawals', column: 'amount_cents', unit: 'cents', meaning: 'Withdrawal a guardian or adult athlete requests from the family account.', treatment: 'not-yet-posted', books: "Should post like a payout (2000 debit) once paid", owner: 'CUSTODIAL', gap: "Has its own 'paid' status separate from disbursements; a paid withdrawal does not reach the books. Reconcile flags any." },
  { table: 'filmer_rewards', column: 'cash_cents', unit: 'cents', meaning: "Future cash reward to a filmer, from Tapua'i's own money only.", treatment: 'not-yet-posted', books: "Filmer rewards (6040) expense when paid", owner: 'FILMER_REWARDS', gap: 'Always 0 today (not built). Reconcile flags any non-zero row.' },
  { table: 'filmer_rewards', column: 'funded_by', unit: 'text', meaning: "Who pays a filmer reward; must be 'tapuai', never a gift.", treatment: 'control', books: 'Guarantees no gift money pays filmers', owner: 'FILMER_REWARDS' },
  { table: 'ledger_manual_lines', column: 'debit_cents', unit: 'cents', meaning: 'Debit on a recorded entry.', treatment: 'posted', books: 'Posted as recorded', owner: 'CONTROLLER' },
  { table: 'ledger_manual_lines', column: 'credit_cents', unit: 'cents', meaning: 'Credit on a recorded entry.', treatment: 'posted', books: 'Posted as recorded', owner: 'CONTROLLER' },
  { table: 'profiles', column: 'stripe_connect_id', unit: 'text', meaning: 'Stripe Connect account for a payee profile.', treatment: 'control', books: 'Routing only', owner: 'CONNECT' },
  { table: 'profiles', column: 'stripe_onboarding_complete', unit: 'flag', meaning: 'Connect onboarding finished.', treatment: 'control', books: 'Payout readiness', owner: 'CONNECT' },
  { table: 'profiles', column: 'payouts_enabled', unit: 'flag', meaning: 'Stripe allows payouts to this account.', treatment: 'control', books: 'Payout readiness', owner: 'CONNECT' },
  { table: 'profiles', column: 'malo_frozen', unit: 'flag', meaning: 'Compliance freeze: this profile cannot receive gifts.', treatment: 'control', books: 'Blocks new gift rows', owner: 'COMPLIANCE' },
  { table: 'schools_and_teams', column: 'malo_frozen', unit: 'flag', meaning: "Compliance freeze on a school's athletes.", treatment: 'control', books: 'Blocks new gift rows', owner: 'COMPLIANCE' },
  { table: 'custodial_accounts', column: 'stripe_connect_id', unit: 'text', meaning: "Guardian's Connect account for one athlete's money.", treatment: 'control', books: 'Routing only', owner: 'CUSTODIAL' },
  { table: 'custodial_accounts', column: 'payouts_enabled', unit: 'flag', meaning: 'Payouts allowed on the custodial account.', treatment: 'control', books: 'Payout readiness', owner: 'CUSTODIAL' },
  { table: 'payout_flag_overrides', column: 'payouts_enabled', unit: 'flag', meaning: 'The transfers setting a two-admin override asks for (VERIFY-02); applied only after an independent second admin approves. No journal posting or money movement.', treatment: 'control', books: 'Payout readiness', owner: 'CONNECT' },
];

/**
 * Money that has no column of its own and is easy to miss. Shown with the catalog and checked by
 * reconciliation where a check is possible.
 */
export const FINANCE_IMPLIED_MONEY: { source: string; meaning: string; books: string; owner: string; gap: string }[] = [
  { source: 'subscriptions (one row per Vault / Exclusive purchase)', meaning: 'Vault access purchase; the price is not stored on the row.', books: 'Vault stream: 80% Vault earnings held for athletes (2010), 20% Vault platform share (4020)', owner: 'BILLING', gap: 'SQL assumes $4.99 for every row; a price change or cancelled access would be wrong.' },
  { source: 'Stripe processing fees', meaning: 'Fees Stripe keeps on every charge.', books: 'Card processing fees (5000), recorded monthly from the Stripe balance report', owner: 'BOOKKEEPER', gap: 'Not recorded per charge until the webhook path stores balance transactions.' },
  { source: 'Refunds and disputes', meaning: 'Money returned to givers or buyers.', books: "Refunds and chargebacks (4900) for Tapua'i's share; family share corrected in 2000", owner: 'REFUNDS', gap: 'No refund flow exists; recorded by hand only.' },
  { source: 'Business expenses', meaning: 'Software, app-store fees, counsel, marketing.', books: '5010–6100, recorded in the Finance & Books hub', owner: 'BOOKKEEPER', gap: 'Needs the bookkeeping migration to record.' },
];

export type CoverageResult = { missing: { table: string; column: string }[]; stale: { table: string; column: string }[] };

/**
 * @purpose Compare money-looking schema columns with the catalog. `missing` = in the schema but not
 *   catalogued (a finance blind spot); `stale` = catalogued but no longer in the schema.
 */
export function catalogCoverage(schemaColumns: { table: string; column: string }[]): CoverageResult {
  const key = (row: { table: string; column: string }) => `${row.table}.${row.column}`;
  const moneyInSchema = schemaColumns.filter((row) => MONEY_COLUMN_PATTERN.test(row.column));
  const catalogued = new Set(FINANCE_DATA_CATALOG.map(key));
  const inSchema = new Set(schemaColumns.map(key));
  const seen = new Set<string>();
  const missing = moneyInSchema.filter((row) => { const k = key(row); if (catalogued.has(k) || seen.has(k)) return false; seen.add(k); return true; });
  const stale = FINANCE_DATA_CATALOG.filter((row) => !inSchema.has(key(row))).map(({ table, column }) => ({ table, column }));
  return { missing, stale };
}

/** @purpose `create table` and `add column` declarations in a SQL file, as table/column pairs. */
export function schemaColumnsFromSql(sql: string): { table: string; column: string }[] {
  const out: { table: string; column: string }[] = [];
  const skip = new Set(['constraint', 'check', 'primary', 'unique', 'foreign', 'exclude', 'like']);
  for (const block of sql.matchAll(/create table if not exists (?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
    for (const line of block[2].split('\n')) {
      const column = line.match(/^\s*"?(\w+)"?\s+\w+/)?.[1];
      if (column && !skip.has(column.toLowerCase())) out.push({ table: block[1], column });
    }
  }
  for (const add of sql.matchAll(/alter table (?:if exists )?(?:only )?(?:public\.)?(\w+)\s+add column if not exists "?(\w+)"?/gi)) out.push({ table: add[1], column: add[2] });
  return out;
}
