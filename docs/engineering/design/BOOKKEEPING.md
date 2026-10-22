<!-- Historical design decisions remain readable while current monetary instructions follow the gift release contract. -->
# Finance & Books — bookkeeping, taxes, finance data and accounting export (BOOKS-01 / BOOKS-02)

**Monetary wording update, 2026-10-22:** use [VOICE](../../product/VOICE.md) and [COORD-02](../../agents/COORD-02.md).
Older individual-donation,90/10 and Donate-tagline instructions below are superseded history.
Current local-source personal gifts have zero platform cut in both flag states; optional
Tip Tapua'i/processing controls default OFF. Posted history and signed versions remain intact;
hosted rollout, net fees/settlement and final counsel/store decisions remain separate gates.

Last updated: 2026-10-13. Status: **built locally**. Hub at `/admin/books` (**Finance & Books**, Commerce group and the **Finance** lens).
Team and chain of command: [FINANCE_OPERATIONS.md](../../company/FINANCE_OPERATIONS.md) (Office of the CFO; taxes owned by `TAX`).
Migration `supabase/migrations/20261012210000_bookkeeping_ledger.sql` is **written, not applied**.
Tracker: [BOOKS-01](../../agents/BOOKS-01.md). This is not tax or legal advice; every tax line below
is a question to confirm with a CPA, and the money-transmission point is for payments counsel.

## 1. The recommendation in one paragraph

Do not build a QuickBooks replacement. Tapua'i's app is the only place that knows the money rules
(90 / 10, held for families, Vault 80 / 20, booster 85 / 15, the optional tip for Tapua'i), so it
should be the **subledger**: it turns every money event into balanced double-entry bookkeeping and
hands a clean, summarized file to an accounting app. **QuickBooks Online** (or Wave, which is free,
or Xero) stays the **book of record**: bank feeds, bank reconciliation, the CPA's login, 1099
e-filing, sales tax and payroll. Building those ourselves is expensive, and errors become a
liability. The Books desk is that subledger, and it already exports QuickBooks-ready files.

## 2. What was wrong with the money data (found 2026-10-12)

| # | Gap | Effect | Fixed here? |
| --- | --- | --- | --- |
| 1 | `company_revenue_logs` is one row per sale (gross / platform / payout), not double-entry | No trial balance, no balance sheet, no audit trail | **Yes** — journal built from it |
| 2 | Family money was never shown as a liability | The full donation looked like Tapua'i income; a 1099-K would be overstated | **Yes** — accounts 2000 / 2010 / 2100 |
| 3 | The card fee a donor covers is charged but recorded nowhere | Stripe deposits never match the books | **Yes** — `tips.cover_fee_cents` + `card_fee` revenue row (after migration) |
| 4 | No Stripe PaymentIntent id on a donation | A payout cannot be traced to its donations | **Yes** — `tips.stripe_payment_intent_id` (after migration) |
| 5 | Stripe's own fees, refunds and chargebacks are not recorded | Income overstated, no expense side | **Partly** — monthly Stripe-fee and refund entries; per-charge fees need the webhook (§7) |
| 6 | Payouts had no paid date | Booked on the day queued | **Yes** — `disbursements.paid_at` (after migration) |
| 7 | `record_company_revenue` upserts can rewrite a past row | Closed months could change silently | **Detected** — month close stores totals; the desk flags any later change |
| 8 | Vault is hard-coded at $4.99 in SQL | Wrong if the price changes | No — §7 |
| 9 | Booster rows record one amount at insert | Monthly renewals are not logged | No — §7 |
| 10 | Days are UTC | A late-evening Mountain-time donation on Dec 31 lands in January | Documented; keep UTC consistently and tell the CPA |

## 3. Chart of accounts

Codes are stable. `CHART_OF_ACCOUNTS` in `packages/shared-types/admin/bookkeeping.ts` and the SQL
seed must list the same codes (a unit test compares them). The CSV export uses the QuickBooks
account-type names; the detail type is a suggestion to pick from in QuickBooks.

| Code | Account | Type | Notes |
| --- | --- | --- | --- |
| 1000 | Business bank account | Asset | Stripe payouts land here |
| 1010 | Stripe balance | Asset | Should equal the Stripe dashboard balance at month end |
| 1999 | Suspense (needs review) | Asset | Rows that did not add up; must be zero before closing |
| 2000 | Donations held for families | Liability | The family's 90%, until paid out. **Not income** |
| 2010 | Vault earnings held for athletes | Liability | The athlete's 80% (owner direction A: to be credited to the family account after counsel) |
| 2100 | Booster operator payable | Liability | The operator's 85% |
| 2200 | Sales tax payable | Liability | Drip; not collected yet |
| 2300 | Owed to owner | Liability | Business costs paid on a personal card |
| 3000 / 3100 | Owner contributions / draws | Equity | |
| 4000 | Platform share of donations | Income | The disclosed 10% |
| 4010 | Optional tips to Tapua'i | Income | 100% Tapua'i |
| 4020 / 4030 / 4040 | Vault share / booster share / Drip sales | Income | 20% / 15% / 100% |
| 4050 | Card fees covered by donors | Income | Offsets 5000 |
| 4900 | Refunds and chargebacks | Contra-income | Tapua'i's share only |
| 5000 | Card processing fees | Expense (commissions and fees) | Dispute fees too |
| 5010 | Merchandise cost | Cost of goods sold | Drip stock |
| 6000–6100 | Software, app-store fees, legal, marketing, filmer rewards (future, Tapua'i money only), game-day operators (future), other, bank fees | Expense | |

## 4. Posting rules

| Event | Debit | Credit |
| --- | --- | --- |
| Donation $10 (10% share) | 1010 $10 | 2000 $9 (athlete ref) · 4000 $1 |
| Optional tip to Tapua'i | 1010 | 4010 |
| Card fee covered by donor | 1010 | 4050 |
| Vault sale $4.99 | 1010 $4.99 | 2010 $3.99 · 4020 $1.00 |
| Booster sponsorship | 1010 | 2100 85% · 4030 15% |
| Drip order | 1010 | 4040 |
| Payout marked paid | 2000, then 2010 for that athlete once donations are used | 1010 |
| Stripe fees (monthly, recorded) | 5000 | 1010 |
| Refund of a $10 donation (recorded) | 2000 $9 (athlete ref) · 4900 $1 (+ any tip for Tapua'i or card fee returned) · 5000 dispute fee | 1010 total |
| Booster operator paid (recorded) | 2100 | 1000 or 1010 |
| Stripe payout to bank (recorded) | 1000 | 1010 |
| Expense paid by owner personally | 6xxx | 2300 |
| Split that does not add up | difference to 1999 Suspense, flagged | |

Nothing is edited in place. A recorded entry is voided by a reversing entry dated in an open month;
a month is reopened only with a written reason, kept as an audit note.

## 5. The hub (`/admin/books`)

Eight tabs, each owned by a finance role (`BOOKS_TABS` in `BooksScreen.tsx`); `?tab=reconcile` opens one directly.

| Tab | Owner | What it holds |
| --- | --- | --- |
| Overview | CFO | Summary figures and every Stop / Review / Note item, including reconciliation findings |
| Transactions | FINANCE_DATA for CONTROLLER | One row per entry; filter by dates, kind, stream, channel, account, athlete, side, amount and text; totals; CSV of exactly the filtered rows |
| Statements | CONTROLLER | Profit and loss, money held for families with per-athlete subledger, trial balance, journal |
| Taxes | TAX (INFO_RETURNS, SALES_TAX) | Tax pack, readiness checklist, federal tax calendar, monthly close steps |
| Reconcile | INTERNAL_CONTROLS | Every source row (donations, optional tips, covered fees, Vault, boosters, Drip) matched to the revenue log; money with no posting path |
| Data | FINANCE_DATA, reviewed by INTERNAL_CONTROLS | The finance data catalog, money with no column, who owns what |
| Record & close | BOOKKEEPER records, CONTROLLER closes | Recorded entries, void by reversal, month close and reopen |
| Export | CONTROLLER | QuickBooks daily / detail journals, general ledger, chart of accounts, tax pack |

**Nothing missing, proved two ways.** (1) The finance data catalog (`packages/shared-types/admin/financeCatalog.ts`)
lists every money column; `financeData.test.ts` parses `schema.sql` and every migration and fails when a
money-looking column is not catalogued, so a new money field cannot ship without Finance knowing how it
is booked. (2) The Reconcile tab compares each source table with `company_revenue_logs` (missing rows,
changed amounts, orphans) and flags money that has no posting path yet: guardian withdrawals marked paid
outside `disbursements`, filmer cash, monthly booster renewals, ended Vault access. A source that cannot
be read is shown as "Not read", never as zero.

### The original desk sections (still on Overview and Statements)

- **Period:** month, quarter or calendar year, with Earlier / Later.
- **Summary:** Tapua'i income, expenses, net, money received for families, paid out, still held.
- **Before you hand this over:** every problem a bookkeeper would push back on, worst first (Stop /
  Review / Note): unbalanced books, Suspense, a held account below zero, unknown streams, an
  incomplete read, no Stripe fees recorded, a closed month that changed, test mode.
- **Profit and loss**, **Held for families and partners** (roll-forward plus a per-athlete
  subledger that adds up to the control account), **Trial balance**, **Journal**.
- **Tax year:** gross receipts (Tapua'i's shares only), net, pass-through money, charges through
  Stripe (to reconcile a 1099-K), quarterly net with estimated-tax due dates, expenses by return
  line, payees to review for 1099s, Drip sales by month for sales tax.
- **Record an entry:** Stripe fees, software, app-store fees, legal, marketing, Drip stock, bank
  fees, other, Stripe payout to bank, owner money in / out, refund. Two balanced lines each.
- **Close the month**, then **Export**: QuickBooks journal (daily summary, recommended), QuickBooks
  journal (one per record), general ledger CSV, chart of accounts, tax pack.

**Privacy:** athlete names appear on screen only. The QuickBooks daily file has no athlete names or
ids. The general ledger and detail files use a pseudonymous reference (`ath-1a2b3c4d`). Exported text
cells that start with `=`, `+`, `-` or `@` are defused so a typed business name cannot run as a
spreadsheet formula.

## 6. Monthly routine for the owner (about 20 minutes)

1. Open `/admin/books`, choose **Month**, step back to last month.
2. In Stripe: **Reports → Balance** for that month. Record the fee total as **Stripe fees**, and each
   payout to the bank as **Stripe payout to bank**. Books' Stripe balance should now equal Stripe's.
3. Record the month's other costs from receipts (Supabase, Expo, Apple, counsel…), choosing
   **Paid from** honestly (bank, Stripe, or the owner's own card).
4. Clear every **Stop** item and Suspense.
5. **Close** the month.
6. Export **QuickBooks journal (daily)**, import it (below), and match the bank deposit in
   QuickBooks to the Stripe payout. Send the general ledger and, at year end, the tax pack to the CPA.

### Importing into QuickBooks Online

1. First time only: export **Chart of accounts** and import it (Settings → Import data → Accounts),
   or create the accounts by hand with the same names.
2. Settings → Import data → **Journal entries** → upload the daily file → map the columns (Journal
   No, Journal Date, Memo, Account, Debits, Credits, Description, Name) → import. QuickBooks takes up
   to 1,000 lines per file; the desk warns when a period is larger, so export by month.
3. Practise in a free QuickBooks sandbox company (developer.intuit.com) while Stripe is in test mode.
   Menu names in QuickBooks change from time to time; the column layout is what matters.

## 7. What to build next, in order

1. **Stripe Connect destination charges** (STATE §6 item 8, already the recommendation). Family money
   then goes straight to the guardian's connected account, never touches Tapua'i's balance, and
   Tapua'i's books only show the 10% application fee. This removes accounts 2000 / 2010 from
   Tapua'i's books, shrinks the 1099-K problem, and is the simplest answer to money-transmission
   risk. Biggest single simplification for taxes.
2. **Webhook-verified amounts** (§6 item 3, Phase 1a): record each charge's real Stripe fee
   (`balance_transaction.fee`), refunds and disputes from Stripe events, copy the PaymentIntent id
   into the revenue log, and retire the client-side `tips` insert. Then Stripe fees post per charge
   and the monthly fee entry goes away.
3. **Append-only revenue log:** stop `record_company_revenue` from rewriting past rows; post
   corrections as new rows.
4. **Real Vault price and booster renewals** in the revenue log instead of `499` and one-time rows.
5. **QuickBooks Online API push:** a Supabase Edge Function with Intuit OAuth 2.0 that posts the
   same daily summaries as `JournalEntry` objects nightly, once a month of manual imports has proven
   the mapping. Needs an Intuit developer app and its production review.
6. **Stripe Tax** (or equivalent) once Drip sells real goods across states.

Third-party Stripe → QuickBooks connectors are an alternative to 5, but they book the whole charge
as Tapua'i's sale unless carefully configured. Tapua'i's journal already knows the split, so pushing
our own summaries is safer.

## 8. Tax questions for the CPA (and counsel)

- **Entity:** the LLC planned for Wave 1. A single-member LLC files on Schedule C by default; the
  `taxLine` hints in the chart follow that until the CPA says otherwise.
- **1099-K:** while money sits in Tapua'i's Stripe balance, Stripe's 1099-K to Tapua'i reports
  every charge, including families' money. The tax pack's "pass-through" and "charges through
  Stripe" lines exist to reconcile that.
- **Information returns:** before paying any person (Vault earnings to athletes, booster operators,
  later filmers and game-day operators), collect a W-9. Payees at or above $2,000 in a year (the
  1099-NEC / 1099-MISC threshold for payments from 2026, up from $600; confirm every January) are
  flagged. Minors' tax forms go through the guardian; counsel to confirm.
- **Sales tax:** Drip is physical merchandise, and states have economic-nexus thresholds. Vault
  access is a digital product some states tax.
- **Donations are not tax-deductible** (already disclosed on the donate sheet). Tapua'i does not
  issue donation receipts for tax purposes.
- **Estimated tax:** quarterly; the desk shows quarterly net with the federal due dates.
- **Money transmission:** holding and paying out other people's money can require licences. Counsel,
  together with §7 item 1.
- **Records:** keep the monthly exports and Stripe reports for at least seven years.

## 9. Verification

- Engine: 23 unit tests (`apps/mobile/src/frontend/lib/__tests__/bookkeeping.test.ts`): posting
  rules, Suspense, unknown streams, trial balance, profit and loss, roll-forward, per-athlete
  subledger equals the control account, tax pack, periods, quality checks, change-after-close,
  manual entries, QuickBooks daily journals balance with no names, CSV formula defusing, and the
  chart of accounts against the SQL seed.
- Desk: 5 component tests (`components/Admin/Books/__tests__/BooksScreen.test.tsx`).
- BOOKS-02 (after review fixes): 108 focused tests across 7 suites — engine (posting, refunds of the
  whole charge, payouts from donations then Vault, athlete/cash coverage, holidays, close fingerprint),
  finance data (catalog coverage, reconciliation incl. withdrawals matched to payouts, filters, privacy),
  data layer (partial-read discard, page counts, missing migration/column/table), hub (loading and
  read-error gates, refund, exports), checkout (narrow retry, rejected field logged), navigation.
- **Postgres replay** (2026-10-13): `scripts/replay/books01-ledger-replay.mjs` on PGlite 0.5.9
  (Postgres 18.6) — 72/72 after the review fixes: applies and re-runs, 27 accounts, balanced/unbalanced/unknown/two-sided/
  oversized/future/blank entries, void and double void, close/reopen/closed-month refusals, audit note,
  admin read, fan and anon denied on every RPC and direct write, RLS hides rows from fans, card-fee row,
  constraint bounds, `paid_at` stamping.
- **Not verified:** the migration on Supabase staging itself (W0-10, [packet](../BOOKS01_STAGING_REHEARSAL.md));
  a hosted read with a real admin; a browser or device render of `/admin/books`; a QuickBooks import.
