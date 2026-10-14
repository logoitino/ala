# BOOKS-01 / BOOKS-02 — Finance & Books: bookkeeping, taxes, finance data and the Office of the CFO

Last updated: 2026-10-13. Status: **built locally; migration revised after review and replayed 72/72 on Postgres; not applied**.
Design and owner guide: [BOOKKEEPING.md](../engineering/design/BOOKKEEPING.md).

Owner request (2026-10-12): organise Tapua'i's money data, prepare it for QuickBooks or a similar
app, help with taxes and revenue, or build simple bookkeeping in the admin. Routing: CTO →
ENGINEERING → ADMIN with COMMERCE (money rules), SHARED_CONTRACTS (shared model), RLS_SECURITY
(migration review) and LEGAL (tax wording) as reviewers.

## Status and shared-file claims

| Session | Claimed paths / responsibility | Status |
| --- | --- | --- |
| Claude (2026-10-12 21:12 MDT) | New: `packages/shared-types/admin/bookkeeping.ts`, `apps/mobile/src/frontend/{lib/bookkeeping.ts,lib/csvExport*.ts,hooks/useBooks.ts,components/Admin/Books/*}`, `app/(admin)/admin/books.tsx`, migration `20261012210000_bookkeeping_ledger.sql`, tests. Shared edits: `lib/admin.ts` (Books nav entry only), `AdminChrome.test.tsx` (Commerce list), `hooks/useTipCheckout.ts` + `lib/finance.ts` (record covered card fee and PaymentIntent id), `types/database.ts` (RPC and column types), `schema.sql`, SCHEMA.md, migrations README | Built locally; `pnpm check` 92 suites / 574 tests and all guards, Next portal tests 86/86, web bundle compiles with the desk. **Claim released 21:40 MDT.** |
| Claude BOOKS-02 (2026-10-13 09:45 MDT) | New: 10 agent files (`cfo`, `controller`, `bookkeeper`, `internal-controls`, `tax`, `info-returns`, `sales-tax`, `treasury`, `fpa`, `finance-data`), `packages/shared-types/admin/{financeCatalog,financeChecks,financeFilters,financeTax}.ts`, `components/Admin/Books/Books{Transactions,Taxes,Reconcile,Data,Record}Tab.tsx`, `lib/__tests__/financeData.test.ts`, `scripts/replay/books01-ledger-replay.mjs`, `docs/company/FINANCE_OPERATIONS.md`, `docs/engineering/BOOKS01_STAGING_REHEARSAL.md`. Shared edits: registry, TEAMS, TEAM_HIERARCHY, EXPERT_STANDARDS, DEPARTMENT_PLANS, WORK_QUEUE (BOOKS-02, W0-10, P1-08 owners), `cto.md` / `vp-operations.md` / `commerce.md` / `engineering.md` (appended notes), `lib/admin.ts` (desk label, Finance lens, analysis links), `AdminLensContext.tsx`, AdminChrome + navigation tests, `lib/bookkeeping.ts`, `BooksScreen.tsx`, `booksSections.ts`, `useTipCheckout.ts`, migration (revised), `schema.sql`, SCHEMA.md, feature-admin.json | Built and re-tested after three independent reviews; **claim released 2026-10-13 10:30 MDT** |

Check file times before editing (TEAMS.md contract item 10). Codex's ADM-02 claim on
`lib/admin.ts` / `AdminChrome` was released at 21:07 before this edit.

## Go-live requirement (owner, 2026-10-12)

The owner wants this in place when Tapua'i goes live, especially the bookkeeping. Tracked as
ROADMAP Wave 1 checklist item 10, WORK_QUEUE W0-10 (staging rehearsal during testing) and P1-08
(production go-live).

## Not done here (owner or another session)

- Apply `20261012210000_bookkeeping_ledger.sql` (owner, staging SQL Editor). Until then the desk
  shows income and payouts only and recording/closing is off.
- RLS_SECURITY review and a Postgres replay of the migration.
- Hosted read with a real admin, browser check of `/admin/books`, native share-sheet export.

## Independent reviews (BOOKS-02, 2026-10-13)

Run through the chain of command as read-only reviews; every finding below was fixed in the same change
unless marked open.

| Reviewer | Result | Fixed |
| --- | --- | --- |
| `RLS_SECURITY` + `DATABASE_MIGRATIONS` | 0 blockers, 6 should-fix | Server-owned `paid_at` (no backdating, backfill); per-month advisory lock on record / void / close / reopen; `card_fee` added to the older `schema.sql` source check so a re-run cannot fail; checkout retries only on missing-column codes and the fee bound is `greatest(500, amount_cents)`; unique PaymentIntent id; `search_path = ''` on every definer function; reversal dates bounded; reserved kinds refused; helpers not client-callable; policies `to authenticated`; card fees as their own revenue-summary stream; reopens kept in `ledger_period_reopens` with the replaced totals. **Open:** the pre-existing "Admin write disbursements" policy lets the `parent` role update any payout row (STATE §5). |
| `CONTROLLER` + `TAX` | 2 blockers, 10 should-fix | Refunds return the whole charge (family / athlete / operator share by athlete reference + Tapua'i share + dispute fee); card processing fees moved out of cost of goods sold (no double count); CSV keeps negative numbers numeric; estimated-tax payment periods (Jan–Mar, Apr–May, Jun–Aug, Sep–Dec) and $1,000 / safe-harbor wording; federal + DC holiday business-day rule; payouts relieve donations then Vault per athlete; booster-operator payment and owner repayment / contribution templates; athlete-below-zero, payout-without-athlete, cash-below-held and negative-row blocks; payee review shows earned and paid with normalized booster names; charges-through-Stripe from income events only; paid withdrawals clear when a matching payout exists. CPA calls recorded, not decided: agent vs principal, Drip inventory method, 2300 vs 3000, royalty threshold for Vault. |
| `QA` | FAIL: 1 P1, 6 P2 | No figures, exports or closing until every source is read; failed reads block exports and discard partial rows; row counts prove completeness; family-typed Rally / gear-goal titles never exported; loading vs missing-migration vs read-error distinguished; filters reset per period; unread withdrawal / filmer sources flagged; results announced beside their action in one live region; `?tab=` follows links; separate void / reopen reasons; share-sheet dismissal reported; finance-lens intro; voided entries excluded from readiness. New data-layer tests. |

Evidence: `docs/engineering/evidence/BOOKS-02-admin.md`; `pnpm check` 100 suites / 683 tests and every
guard; focused finance suites 108/108; replay 72/72.
