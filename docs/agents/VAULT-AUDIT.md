<!-- VAULT-01 Phase 0 audit: what the Vault is today, how a pass is paid for and recorded, the fee math, hosted state. Evidence only; the design is in VAULT-01.md. -->
# VAULT-AUDIT — the Vault as it is today

**Date:** 2026-11-14. **Source:** `main` at `0e510fa`. **Hosted read:** staging `ala-sports-staging`,
read-only SQL, 2026-11-14. The development project is **paused** (Supabase status `INACTIVE`), so it was not read.
**Executor:** Claude Code session `claude/vault-01-value-ladder`. No independent session has reviewed this audit yet.

## Sharpest gap

A Vault pass is not tied to a payment: any signed-in account can give itself a pass by inserting its
own `subscriptions` row, and that insert also books a $4.99 sale that never happened.

Evidence:
- The insert policy checks only `auth.uid() = subscriber_id` and that the athlete is not frozen (`schema.sql:4208-4211`; the same check is live on staging). The account can also update its own row (`schema.sql:4214-4220`).
- `authenticated` holds the insert grant (`schema.sql:4367`).
- Trigger `company_revenue_subscriptions_ai` (`schema.sql:5711`) writes a `vault` revenue row for every pass row.
- The PaymentIntent for a pass carries no purpose or pass reference, only the user and player ids (`paymentIntent.ts:117-127`).
- The app inserts the row itself after the payment sheet reports success (`useAthleteSubscription.ts:87-100`).

The value gap sits right behind it. There is nothing in a Vault to buy yet (staging has 0 Vault clips),
and an athlete cannot see or receive Vault earnings.

## 1. What is actually in Vaults (staging, read-only)

| Measure | Value |
| --- | --- |
| Athletes (`players`) | 5 |
| `vault_locked = true` | 5 (the column default; no athlete has opened one) |
| Live clips (`reels`, not removed) | 1 |
| Vault clips (`is_vault_only`) | **0** |
| Files in private bucket `reel_vault` | 0 |
| Passes (`subscriptions`) | 0 |
| Shoutout / Q&A requests (`subscriber_requests`) | 0 |
| `vault` rows in `company_revenue_logs` | 0 |

**Too small to measure.** Wave 0 seed data cannot say what athletes post or what fans buy. Measure on pilot data.

**Content kinds.**
- `ExclusivePost` (`workout` / `pregame` / `qna`, `data/exclusive.ts:8-13`) is a type that nothing uses. There is no post feature.
- A Vault holds **clips only**: Highlights with `is_vault_only`.
- The paywall promises "full game breakdowns and raw practice film" (`data/exclusive.ts:28-30`). No content type, upload label or seed row backs that promise.

**What a fan sees on a locked Vault today** (`Profile/ExclusivePaywall.tsx:31-51`):
- the kicker "Vault 🔒"
- that callout
- the split line
- the buy button

It shows no count and no kinds, so the fan cannot tell whether the Vault is empty.

**Perks that exist.**
- Shoutout / Q&A requests (`lib/subscriptions.ts`).
- Flash Unlock, a real 2-hour window the athlete triggers (`data/exclusive.ts:61-64`).

## 2. Payment path (one pass, end to end)

1. A tap on the paywall, a Highlight chip or the profile calls `beginExclusiveUnlock` (`lib/exclusiveCheckout.ts:47-71`).
2. `decideExclusiveCheckout` (`data/storeCommerce.ts:89-120`) picks the rail:
   - **Web:** Stripe.js Payment Element.
   - **Preview / development native build:** Stripe PaymentSheet, labelled a test checkout.
   - **Production iOS or Android build:** Stripe is **blocked**, and an honest "not available yet" alert is shown.
3. The Soft-Wall sign-in runs, then `useTipCheckout` with `skipBacker: true`. That is the same `create-payment-intent` as gifts, with amount $4.99 and no cover-fee add-on (`lib/exclusiveCheckout.ts:61-68`).
4. On success the app adds +100 Aura to the buyer (`useTipCheckout.ts:142, 271-274`; the toast is at 291-293) and inserts the `subscriptions` row (`useAthleteSubscription.ts:100`).
5. The insert trigger books the sale (`schema.sql:5676-5685`, trigger at `5711-5714`). The backfill `sync_company_revenue_logs()` writes the same row (`schema.sql:31028-31041`).

The Aura grant runs before the pass insert and does not depend on it, so a refused insert still leaves the +100 Aura granted.

**Verdict on the prompt's "blocking" test: not blocking.**
- In-app Stripe for the pass exists only in test builds. A store build refuses it (feature `VAULT-RAILS-01`, planned).
- **StoreKit and Play Billing are not built.** A production iOS or Android app cannot sell a pass at all today.
- Android needs Play Billing for the same reason iOS needs IAP (`storeCommerce.ts:80-81`).
- Counsel has not reviewed these rails.

## 3. Fee math at $4.99

**What the code records** (`data/finance.ts:13-14`, `schema.sql:5676-5685`):

| Line | Amount |
| --- | --- |
| Gross | $4.99 |
| Tapua'i (20%) | $1.00 |
| Recorded for the athlete (80%) | $3.99 |

**What the code does not say:**
- **Who absorbs the processor fee.** No Stripe fee is recorded per charge (STATE §5, Books row). Money sits in the platform balance and payouts return 503, so today nothing reaches the athlete.
- **The fee itself.** Stripe's US card rate (2.9% + $0.30, **not in the repo; verify on the Stripe account**) would be about $0.44 on $4.99.

**Net to each side, by rail and by who absorbs the fee.** Arithmetic only. The Apple rates are outside
facts to verify (30% standard; 15% if enrolled in the Small Business Program).

| Rail and rule | Fee | Tapua'i nets | Athlete side |
| --- | --- | --- | --- |
| Web Stripe, fee out of Tapua'i's 20% | $0.44 | **$0.56** | $3.99 |
| Web Stripe, 20/80 of what is left after the fee | $0.44 | $0.91 | $3.64 |
| Apple IAP 30%, athlete keeps $3.99 | $1.50 | **−$0.50 (a loss)** | $3.99 |
| Apple IAP 30%, 20/80 of proceeds | $1.50 | $0.70 | $2.79 |
| Apple IAP 15%, athlete keeps $3.99 | $0.75 | $0.25 | $3.99 |
| Apple IAP 15%, 20/80 of proceeds | $0.75 | $0.85 | $3.39 |

**Two defects found:**
- **The books hardcode $4.99.** The trigger writes `499` cents for every pass (`schema.sql:5679`), and the backfill does the same (`schema.sql:31035-31040`), while the Catalogs desk lets the owner change the price (`CatalogTool.tsx:104`). A published price other than $4.99 would make every Vault row in the books wrong.
- **There are no refunds for a pass.** Nothing revokes a pass or reverses its revenue row on a refund or dispute.

## 4. Hosted state (staging)

- **Tables.** `subscriptions` and `subscriber_requests` are applied. `subscriptions` has 4 policies, and the revenue trigger is present.
- **Price control.** It works in code, but nothing has been published: `published.catalog.exclusiveDollars` is null (last publish 2026-09-23). The app falls back to the code default, $4.99.
- **+100 Aura.** It has no hosted setting (`exclusiveAura` is null), so the code default of 100 applies. The buyer's app grants it after checkout; it is not server-enforced.
- **Vault button.** `buttons.vault` is on.
- **Athlete earnings.** Vault rows live only in `company_revenue_logs` (admin-only). `get_custodial_summary` sums gifts only (STATE §6 item 8), so no athlete or guardian screen shows Vault money.

## 5. Corrections to the Vault prompt's §0

- **Payment path.** It is already gated (§2). The fix the prompt fears is not needed. The missing piece is store billing.
- **Content kinds.** `workout` / `pregame` / `qna` do not exist as content, only as an unused type. Q&A exists as fan *requests*, not athlete posts.
- **Admin portal.** It is not Vault-free: Revenue carries a read-only "Checkout rails" note (STATE §4, 2026-11-13).
- **The price name.** `EXCLUSIVE_MONTHLY_DOLLARS` is misnamed, as the prompt says. `LEGAL_BRIEFING.md:62` and data-ownership entries cite the name, so a rename touches them too.
- **"80% goes to the family."** That is not true yet. The books *record* 80% for the athlete; no money moves (payouts 503; STATE §6 item 8 open). Copy must say "recorded for" until it does.
- **`.cursor/rules/tapuai.mdc`.** It is not tracked in the repository.
- **Owner priority.** STATE §0 says no new product features ahead of APP-TEST lanes A–C. Building new tiers now would break that, so this change stops at audit and design.
- **Development project.** It is paused, so any "hosted" check there must wait for the owner to resume it.
