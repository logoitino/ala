# Finance operations — the Office of the CFO

Last updated: 2026-10-13. Owner: `CFO`. Kept current by `VP_OPERATIONS` with the CFO.
Accounting rules and the owner guide: [BOOKKEEPING.md](../engineering/design/BOOKKEEPING.md).
Tracker: [BOOKS-01](../agents/BOOKS-01.md). Screens: Expo `/admin/books` (**Finance & Books**).

This is how Tapua'i runs its books, taxes, cash and plans, who owns each part, and how Finance asks
Engineering for data. It is an operating document, not tax or legal advice.

## 1. The team

```text
FACILITATOR — the owner: applies SQL, moves money, engages the CPA and counsel, files, sets prices
├── CFO — Finance and Accounting (this office)
│   ├── CONTROLLER — accounting: chart of accounts, posting rules, statements, close, QuickBooks
│   │   ├── BOOKKEEPER — Stripe fees, expenses, payouts to bank, receipts, Suspense
│   │   └── INTERNAL_CONTROLS — data catalog coverage, reconciliation, closed-month drift, sign-off
│   ├── TAX — every tax area: return lines, estimated tax, tax pack, CPA liaison, 1099-K
│   │   ├── INFO_RETURNS — W-9 and 1099 review for every payee
│   │   └── SALES_TAX — Drip and Vault sales tax, nexus watch, collection plan
│   ├── TREASURY — Stripe balance versus bank, money held for families, payout review
│   └── FPA — budgets, unit economics, plan versus actual
└── CTO — all app and data work
    ├── ENGINEERING
    │   └── FINANCE_DATA — the dev-team engineer who builds Finance's data, checks and exports
    └── COMMERCE — payments engineering (checkout, ledger events, Connect, refunds, reconciliation code)
```

**Taxes are owned by `TAX`.** Accounting works with Finance through the CFO: the Controller and Tax
see every revenue event and every recorded expense in the same journal Treasury and FP&A read.

## 2. Chain of command

| Kind of work | Path | Who accepts |
| --- | --- | --- |
| Accounting, tax, cash or plan decision | owner → CFO → lead (CONTROLLER / TAX / TREASURY / FPA) → specialist; reports go back the same way | CFO, then the owner for anything in §5 |
| New data, check, report or admin screen for Finance | CFO writes a request (§3) → CTO assigns → ENGINEERING → FINANCE_DATA, pairing ADMIN (screens), BACKEND + DATABASE_MIGRATIONS (SQL), LEDGER (money events) → ENGINEERING → CTO | The requesting finance role gives finance acceptance; QA verifies independently; RLS_SECURITY on any authorization change |
| Change to splits, the revenue log, posting rules, payouts or tax wording | Starts with whoever proposes it; COMMERCE (payments) and FINANCE_DATA (data) build it under the CTO | CFO acceptance and CONTROLLER review are required; TAX for tax effect; LEGAL / VOICE for wording |
| A finding (missing row, mismatch, closed month changed) | INTERNAL_CONTROLS → CONTROLLER → CFO; data fixes go to the CTO as a request | CONTROLLER confirms the fix in the Reconcile tab |

A finance role never edits app code; an engineer never changes an accounting rule on their own.

## 3. Requesting data from Engineering

Write the request in `docs/agents/WORK_QUEUE.md` (BOOKS-xx) with:

1. **Question** the data must answer, in finance words.
2. **Source** tables or Stripe objects, if known; FINANCE_DATA confirms against the [data catalog](../../packages/shared-types/admin/financeCatalog.ts).
3. **Definition**: period, population, sign convention, what counts as missing.
4. **Where it shows**: which tab of Finance & Books, and the export it belongs in.
5. **Acceptance**: the test or reconciliation that proves it, and who signs off.

FINANCE_DATA adds the catalog entry, the check and the tests in the same change, and records any new
table or function in the master data map (`docs/engineering/data-ownership.json`, reviewed by
`DATA_GOVERNANCE`, the data control point). A new money column
cannot land without a catalog entry: `pnpm check` fails (`financeData.test.ts`).

## 4. Calendars

**Monthly close** (shown on the Taxes tab; `MONTHLY_CLOSE_STEPS`): business days 1–3 the
Bookkeeper records Stripe fees, Stripe payouts to the bank and every receipt; day 4 the Controller
checks the Reconcile tab is complete, Suspense is zero and no held account is below zero; day 5 the
Controller closes the month and imports the QuickBooks daily journal. Ten days before each
estimated-tax due date, Tax sends the net for that payment period (Jan–Mar, Apr–May, Jun–Aug, Sep–Dec;
not calendar quarters) to the owner and CPA.

**Tax calendar** (Taxes tab; `taxCalendar`): April 15, June 15, September 15 and January 15 estimated
payments (due when the year's expected tax is $1,000 or more; the CPA sets amounts and safe harbor);
January 31 1099-NEC to payees and the IRS; 1099-MISC copies January 31 and IRS e-file March 31; April 15
the return or extension; October 15 the extended return. A date on a weekend, a federal holiday or DC
Emancipation Day moves to the next business day.

## 5. Only the owner

Applying the bookkeeping migration (or any SQL), recording real entries or closing a real month,
moving or approving money, opening the business bank account and QuickBooks company, forming the LLC
and getting the EIN, engaging a CPA or counsel, filing any return or registration, collecting tax IDs,
and changing a price or split.

## 6. Facts the owner records here

Update this table when a fact changes; the Taxes tab reads them as "Not yet" until then.

| Fact | Value | Recorded |
| --- | --- | --- |
| Legal entity and EIN | Not yet (Wave 1) | — |
| Business bank account | Not yet | — |
| Accounting app company (QuickBooks Online / Wave) | Not yet; practise in a QuickBooks sandbox | — |
| CPA engaged | Not yet | — |
| Stripe mode | Test (Wave 0) | 2026-10-13 |
| Bookkeeping migration on staging | Not applied | 2026-10-13 |

### 6.1 Owner-reported monthly expense baseline — 2026-10-13

Source: the owner's reply to the monthly expenses/cash question: "$200 for ai, hosting
videos: i haven't decided yet, supabase is free". These are reported amounts and plan status;
invoices, usage and bank balances have not been reconciled. This is the source home for these
facts, reused by the Growth review and hosting plan. No real journal entry was recorded.

| Item | Current reported baseline | Evidence or remaining input |
| --- | --- | --- |
| AI tools | Approximately $200/month | Owner report; tools, billing periods, shared/personal allocation, taxes and invoices not supplied |
| Supabase | Free plan; $0 current base subscription reported | Actual invoice/usage, limits and recovery terms not verified; no paid upgrade selected |
| Dedicated video hosting | Undecided | No provider/plan/quote selected; delivery/encoding/storage cost is unknown, not assumed zero |
| Initial infrastructure budget | Up to $50/month | Owner-selected planning ceiling, separate from AI; includes any selected video and other infrastructure services, no new spend approved |
| Available project cash | Not supplied | TREASURY needs cash available for project operations and obligations before a runway calculation |

Known recurring subtotal is approximately **$200/month**, or **$2,400/year**, before other
unreported expenses. Holding AI at that level and using the entire infrastructure allowance
would give a **$250/month / $3,000/year planning envelope**, not current actual spending or a
complete business budget. Domain/build accounts, legal/accounting, memberships, labor, taxes
and other subscriptions still need classification; count annual renewals and existing paid
items separately from new monthly spending. Family-held funds are not operating cash.

Recommendation: retain the present Free backend while suitable for internal testing; choose
video from measured workload and actual quotes within the infrastructure allowance. Review
the $200 AI spend by tool, project share, usage and useful accepted work before adding
subscriptions; reductions are proposals for the owner, not automatic cancellations. FPA and
COST_OPERATIONS bring actuals and a 30/90-day forecast into one Growth packet; TREASURY
supplies unrestricted cash and upcoming obligations. CTO recommends services; owner decides.

## 7. Data access and privacy

Finance & Books is admin-only (RLS and admin-guarded RPCs; replayed on Postgres 2026-10-13). Athlete
names appear on screen only; every export uses a pseudonymous athlete reference, and the QuickBooks
daily file carries no athlete at all. Tax IDs are not collected anywhere in the app until
PRIVACY_ENGINEERING, LEGAL and the owner agree where they live.
