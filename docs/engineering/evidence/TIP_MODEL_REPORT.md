<!-- Local no-cut accounting evidence; gross liability is distinct from processor fees and bank settlement. -->
# No-cut gift and optional tip model — 2026-10-22

Branch: `codex/tip-model`. Copy base: `5a95152`; source/admin checkpoint: `e9da05f`.
Owner directed no cut/no skim independently of Connect item8. No flag was previously present;
this branch creates default-OFF `buttons.MONETIZATION_TIPS_ENABLED`. No hosted migration,
publication, deployment, live-money action or main merge was performed.

## Where the former 10% was computed

The [before-change inventory](TIP_MODEL_BASELINE.md) was reported before changing the split:

- `apps/mobile/src/frontend/data/finance.ts`: 1000 platform /9000 family basis points;
  `splitRevenueCents` and `platformBpsForSource` select the gift rate.
- `data/malo.ts`: `donationBreakdownLine` independently multiplies gift cents by that rate.
- Canonical SQL `company_revenue_bps('malo')`:1000; `record_company_revenue` calculates its share.
- SQL `sync_company_revenue_logs`: four hardcoded1000 expressions; a report read called catch-up
  and could restore the former split even if the main rate alone changed.
- Shared `refundEntryLines`: hardcoded1000 for gifts. Received/custodial functions read stored
  shares or the basis-point fallback; summary metadata described10/90.

There was no Stripe application fee or destination transfer. The cut was a revenue allocation.
Historical applied SQL and posted90/10 rows are retained rather than silently restated.

## Exact change size versus copy base

`git diff 5a95152 4c54606 --numstat -- <listed file>`; this table records the checkout
checkpoint, including truthful comments. COORD-02 later adds one net comment line in each
no-cut SQL file (migration now441 added lines; canonical append444). Executable SQL is unchanged;
containment explicitly forbids restoring the gift cut.
The SQL migration combines the no-cut overrides with the separately authorized tip authority.

| Source file | Added / removed lines | Why |
| --- | --- | --- |
| `apps/mobile/src/frontend/data/finance.ts` | 5 /5 | Two rate values now0/10000; other commercial rates unchanged |
| `packages/shared-types/admin/bookkeeping.ts` | 12 /7 | Default new-gift refund rate0; explicit original recorded share for historical refunds |
| `supabase/migrations/20261022152000_no_cut_gifts_optional_tips.sql` | 440 /0 | No-cut/history-safe catch-up/metadata; immutable quotes, flag authority, bounds and guard |
| `apps/mobile/src/backend/db/schema.sql` | 443 /0 | Header plus exact migration copy; original history retained |
| `supabase/functions/_shared/money/paymentIntent.ts` | 6 /2 | Refuse non-declared optional tips and require prepared quote authority |
| `supabase/functions/_shared/money/serverDonationContext.ts` | 27 /0 | Service-only quote/bind adapter |
| `apps/mobile/src/backend/api/createPaymentIntent.ts` | 10 /1 | Node authority wiring |
| `supabase/functions/create-payment-intent/index.ts` | 9 /1 | Same Edge authority wiring |
| `apps/mobile/src/frontend/lib/custodial.ts` | 5 /9 | Missing family share stays unknown; historical recorded share labeled explicitly |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts` | 60 /49 | Pre-charge bounds/flag/review, same-render mutex, complete paid allocation, gift-only counters and copy |

The pure gift-rate change is two constants plus the gift branch/default rate in SQL/refunds.
Additional SQL prevents report catch-up from undoing it, preserves posted/closed history and
implements safe optional extras. Removing only the constants would have left an active10% path.
Full source/admin and app scopes: [admin evidence](MONEY-TIPS-01-admin.md), [app evidence](MONEY-TIPS-01-app.md).

## Actual local money evidence

| Flag / event | Gift gross | Family ledger | Platform gift share | Extras |
| --- | --- | --- | --- | --- |
| OFF base gift | $50.00 | $50.00 | $0.00 | None; new requested extras denied |
| ON base gift | $50.00 | $50.00 | $0.00 | None by default |
| ON issued quote, then OFF | $50.00 | $50.00 | $0.00 | Original $5 tip +$0.50 estimated cover remain separate; total$55.50 |

Real PostgreSQL replay22/22; backend208 tests; independent quote-cap attack revalidation rejects
both bad inputs before persistence. Original P1 failure retained. First draftON stays publishedOFF
until an actual admin Publish; only literaltrue permits new extras. Wrong actors/allocations,
provisional and duplicate references are denied. The maximum gift100000 cents matches the existing
row cap before charging; covered fees stay within `greatest(500,gift_cents)`. Historic/closed rows
retain original amounts; missing closed rows are counted for Finance repair on existing Revenue.

**Settlement confirmation is unavailable.** These tests confirm100% gross family liability with
zero platform gift cut in both flag states. They do not observe a Stripe capture, actual processor
fee or bank settlement. Current rail charges platform balance and blocks payouts; its configurable
$0.50 cover amount is an estimate/contribution, not a balance-transaction fee. The requested
“100% minus processing” net settlement still requires provider evidence and item8 movement.
The cut has been removed from local source without waiting for that decision.

## Copy and release handoff

[Checkout string table](GIFT_CHECKOUT_STRINGS.md):112 additional user-facing spans; the earlier
[475-span table](GIFT_LANGUAGE_STRINGS.md) stays as copy-phase history. Exact tax notices on athlete
page/receipt, exact tip sentence gatedON, processing estimate disclosure, and new gift terminology.
[Current donat* audit](GIFT_CHECKOUT_RESIDUALS.md):544 source lines individually accounted.
Ambiguous refund reason stays unchanged; frozen signed consent remains a counsel/versioning blocker.

Open: migration/Edge/installed-client rollout, missing-key/paid-record repair, hosted concurrency,
actual fees/settlement, abandoned-context retention/erasure/quota, signed guardian consent and final
Terms/store review. Gift-linked Aura affects digital borders; counsel/owner must classify it before
claiming person-to-person gift eligibility. Booster placement and Vault remain distinct purchases;
no charitable program checkout/receipt was invented. Notification authority remainsfalse and the
webhook stays observation-only. Actual reviews are outside-session Codex, not pinned-domain/counsel acceptance.

Final local full `pnpm check`/retained detection scan PASS:266 mobile suites/2576 tests, portal117,
both typechecks/all required guards; independent checkout71 and family-history21 pass. Selected
app metadata checkpoint preserves earlier admin evidence; no release or settlement approval.

Selected `pnpm feature-admin:check --feature MONEY-TIPS-01 --require app-ready` passed
for25 registered features after the final evidence was recorded. Earlier admin checkpoint preserved.

## Whole-team continuation — COORD-02

The [current packet](../../agents/COORD-02.md) joins115 role handoffs, counsel/guardian drafts
and the [rollout runbook](../GIFT_TIP_ROLLOUT.md). Fresh read-only migration/catalog checks
find no tip/payment-context prerequisites on development or staging. This is new hosted
metadata evidence, not application/settlement proof. Historical source/test receipts above
remain bound to their original versions; the current-turn final gate is recorded in COORD-02.
