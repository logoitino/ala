<!-- Source-bound counsel intake separates proposed clauses from signed records and unverified release claims. -->
# Gift release — counsel review packet

**Prepared:** 2026-10-22. **Source:** local `codex/tip-model`; exact reviewed file hashes and
consent-template verification: `.smoke/gift-release/legal-packet-results.json`.
**Status:** internal drafting and source review; no counsel opinion, approved agreement,
provider settlement, store submission or release approval. LEGAL routes to CTO and owner.
Owner approves counsel engagement and the material/recipient scope before external delivery.

## 1. Reading order and factual scope

Read [STATE §6](../STATE.md#6-open-decisions-owners-call--do-not-default-these),
[VOICE](../product/VOICE.md), [model report](../engineering/evidence/TIP_MODEL_REPORT.md),
[Terms proposals](GIFT_DONATION_TIP_TERMS_DRAFT.md),
[guardian proposals](GIFT_GUARDIAN_CONSENT_DRAFT.md) and
[store draft](../product/APP_STORE_GIFT_DRAFT.md). Older dated donation/90–10 decisions in
[LEGAL_BRIEFING](LEGAL_BRIEFING.md) remain history; the October 22 owner instruction controls
new gift wording and the local no-cut allocation. This packet reviews those sources, not all
app legal, security or tax obligations.

| Transaction | Current source facts | Drafting and release consequence |
| --- | --- | --- |
| Individual athlete/family **Gift / Give / Send a gift** | Full gross gift is family liability, zero platform gift share with extras OFF or ON. `data/finance.ts`; no-cut migration | No charity or deduction promise; distinguish recorded liability from actual receipt. No local gift skim is authorized |
| **Tip Tapua'i (optional)** | Extra above the gift; 100% platform allocation. Literal published `buttons.MONETIZATION_TIPS_ENABLED === true` admits new extras; default OFF; No tip default | Separate voluntary support; no access/entitlement promised. OFF does not restore a gift cut |
| **Cover the processing fee** | Separate unchecked option; published flat `maloFeeDollars` is an estimate/contribution, not a Stripe balance-transaction fee | Explain amount and actual fee payer; never equate covered amount with verified processor expense |
| Booster club/program **Donation / Donate to the program** | Owner requires web-only program collection. No genuine charitable checkout/receipt is established by this review | Verify recipient, authority, processor path, status and receipt before advertising availability or deductibility |
| Existing booster sponsorship | Native one-time PaymentSheet with `skipBacker`, business/logo, school, tier and Aura; advertised branding/placement. Local rate 15% platform/85% operator | Commercial placement needs separate terms, permissions and store classification. It is not evidence of a charitable Donation |
| Existing Vault/Exclusive **Purchase** | One-time PaymentIntent; default $4.99 and 100 Aura, overridable published catalog; active pass stored in `subscriptions`. Local rate 20% platform/80% athlete | Paid digital access has separate entitlement/store/refund terms. A table name or `billing_interval` does not establish recurring billing |
| Athlete premium **Subscription** | Required vocabulary for a distinct premium product; existing Exclusive charge is one-time | Do not advertise auto-renewal, a renewal period or a built recurring plan without implementation evidence |

Source paths in this table are expanded in §6. Numbers describe reviewed defaults and allocations,
not an agreed production price, current hosted configuration, actual fees or observed delivery.

**Required individual tax notice, exact:**

> Gifts to individual athletes are personal gifts and are not tax-deductible.

The notice appears locally on athlete page, gift receipt and checkout Review. It does not decide
recipient income treatment, giver reporting, Form1099 obligations, NIL eligibility or custody law.
Tax/Info Returns and counsel/CPA must determine those questions for the actual payee/rail.

## 2. Actual payment model and the 100% claim

The local server creates a platform PaymentIntent without a destination transfer or application
fee; the client still inserts `tips` after PaymentSheet. New service quotes bind the gift and
optional extras; they do not authorize notifications or add a second credit writer. Payouts
remain blocked. The no-cut migration and Edge rollout remain pending in the cited evidence.
Local SQL replay 22/22 and full project 266 suites / 2,576 tests, portal 117 are retained earlier
execution receipts in the model/app reports; this documentation review did not rerun them.

For a $50 gift, family ledger allocation is $50 and platform gift allocation $0 with either flag.
An issued ON quote may separately retain a $5 tip and $0.50 estimated cover after flag OFF;
the $55.50 charge is not a $55.50 gift. Posted historical 90/10 rows keep their original shares;
missing historical family shares remain unknown. No history is repriced by a new disclosure.

**Unverified:** actual capture, Stripe fees, payout/bank fees, net family proceeds, settlement
timing, reserves and refund/dispute loss allocation. Gross 100% allocation is not100% bank receipt.
Item 8 remains the owner/payments-counsel choice: destination charges versus a reviewed platform
balance/ledger model, including the actual merchant and guardian account. No agreement may
describe Tapua'i as operationally uninvolved before those responsibilities are reconciled.

### Exact drafting choices for fee and platform responsibility

The zero gift cut is already the owner direction. These choices decide expense responsibility
and truthful release wording; each requires Finance cost/provider evidence and an owner decision.

| Choice | Proposed clause | Conditions and decision owner |
| --- | --- | --- |
| F-A: platform bears uncovered actual expense | “Tapua'i allocates the full gift to the athlete's family and bears processing costs not covered by your optional contribution. Any Tip Tapua'i is separate.” | Confirm actual rail, expense funding, refunds and bank fees; COMMERCE/CFO → counsel → owner. A net 100% claim still needs bank evidence |
| F-B: disclosed actual processing expense affects net proceeds | “Tapua'i takes no share of your gift. The full gross gift is recorded for the family; actual processing costs may reduce the amount received. Your optional processing contribution helps cover those costs.” | Identify exactly which costs, payer and calculation before release; no unspecified platform fee. Counsel/store review must decide if the proposed gift route remains available |
| P-A: limited platform role, only if accurate | “Tapua'i provides the platform on which users choose whether and to whom to give; it is not a charity. Its payment, recordkeeping, refund and dispute responsibilities are described below.” | Safer drafting basis pending actual responsibilities; counsel supplies entity and duties |
| P-B: owner-requested non-party clause | “Tapua'i is a platform, not a charity, and is not a party to any Gift.” | Hold unless counsel confirms consistency with merchant/platform balance, custodial, refund and dispute obligations. Do not present it as an observed fact |

**Requested exact tip-step sentence, release claim pending:**

> 100% of your gift goes to the athlete's family. Tips go to Tapua'i and keep the platform free for families.

It is implemented locally only behind the literal-true flag with processing/test disclosures.
Counsel must reconcile both the 100% and “free for families” claims with actual costs and separate
paid offerings; nearby disclosure alone does not establish either claim. A final approved clause
may require an owner-reviewed copy change. No choice here changes the source or activates extras.

## 3. Gift-linked Aura and separate digital products

`data/players.ts` awards 10 Aura per $1. `useTipCheckout.ts` awards the giver and, after a saved
gift, the distinct athlete; `lib/aura.ts` maps totals to seven tiers. `Profile/AuraTradingCard.tsx`
uses those tiers for border/color/glow and other card chrome. Existing gifts therefore affect
digital presentation. Current no-digital-consideration clauses are proposals, not a finding that
this build satisfies a person-to-person gift exception. Non-cash points can still be relevant.

| Aura option | Proposed text / implementation condition | Decision owners |
| --- | --- | --- |
| A-A: separate gifts from benefits | “Giving does not grant Aura, digital content, profile upgrades or preferential access.” Publish only after gift-derived awards and all downstream benefits are removed/separated with compatibility and history review | Owner chooses model; AURA/HIGHLIGHTS/COMMERCE implement under admin-first/domain review; QA verifies both flag states; counsel reviews actual build |
| A-B: preserve current relationship for review | “A gift currently awards Aura to the giver and athlete; Aura changes digital card presentation. It does not represent cash.” This is factual reviewer disclosure, not an approved exemption or public promise | Counsel classifies under current applicable store rules; owner decides gift-route, benefit and billing changes; RELEASE/QA verify resulting build |

Separately, existing Vault access is a **Purchase**, grants digital access and may award 100 Aura;
the new gift rate does not change its 20/80 allocation. STATE item8's earlier owner direction
to credit Vault earnings to the family account remains pending implementation/rail review;
current custodial summaries are not proof that those earnings arrive there. Sponsorship includes
paid placement/Aura, not pure giving. Counsel must assess all submitted routes and terms;
neither a Gift label nor putting a purchase on another screen resolves store consideration.

## 4. Frozen guardian consent and replacement plan

Current client/server accepted draft contract:

- Version: `2026-10-14-draft`.
- Template SHA-256: `f39f7c23538fcf209fb368bd56f16250ba685cd7c3a4bf23d94be19cea0caa0f`.
- Template: `data/guardianConsent.ts`; server version/hash functions and record gate:
  `20261014110000_minor_accounts.sql`. The header explicitly prohibits real-family use.
- The “Money rules” clause says Tapua'i keeps 10%, including processing. It also promises teen
  payout approval and control transfer at 18/or the state's age. No new gift wording may silently
  restate that signed text. The transfer age/mechanics remain unresolved (including Utah 21).
- `lib/minors.ts` sends exact version/hash with each signature; the server rejects mismatches,
  revokes the prior active form as `signed_again`, inserts a new record and logs supervision.
  Existing signed fields are protected. These are source observations, not hosted enforcement.

[Guardian proposal](GIFT_GUARDIAN_CONSENT_DRAFT.md) supplies exact replacement wording and
decision points without selecting a release version/hash. Counsel/Minor Safety/Custodial must
resolve age, custody authority, public-profile exceptions, electronic signature, fee/payee terms,
retention, withdrawal and existing-record treatment. Existing test signature is not real consent
to changed economics or a substitute for approved live text.

After approval: a new immutable version/template hash and new migration, canonical schema copy,
Data ownership/map review, current Terms acknowledgment, actual server/client rollout and
re-acknowledgment plan are required. Version/hash replacement alone does not prove every
privileged operation rejects an old consent. Engineer/Security must trace and test each read
gate. Preserve original signed text/version/time and separately record new consent; no backfill
that pretends the signer read the replacement. Detailed rollout and negative cases are in the
guardian proposal; none has been executed by this packet.

## 5. Counsel decision register and publication blockers

| ID | Required decision / evidence | Accountable reviewers | Current record |
| --- | --- | --- | --- |
| G-01 | Entity, merchant, payment-party duties and item8 rail, including adult/minor/Vault payees | LEGAL/payments counsel; COMMERCE/CONNECT/CUSTODIAL/TREASURY; owner | Open; chosen option/reference: `[pending]` |
| G-02 | Exact processing/net/100%/free wording; payer, quote-versus-actual costs, bank fees, refunds/disputes, hold cap/window | COMMERCE/CFO/REFUNDS/RECONCILIATION; counsel/CPA; owner | Open; provider evidence/reference: `[pending]` |
| G-03 | Gift-linked Aura and digital billing/entitlement route, including one-time Vault and sponsorship placement | LEGAL/counsel; AURA/VAULT/SPONSOR_ADS/COMMERCE; QA/RELEASE; owner | Open; A-A/A-B/build decision: `[pending]` |
| G-04 | Guardian final clauses, verified authority, age/state handover, e-signature, re-ack and separate public/money permissions | LEGAL/COMPLIANCE/MINOR_SAFETY/PRIVACY_ENGINEERING/CUSTODIAL; counsel; owner | Open; approved text/version: `[pending]` |
| G-05 | Real program Donation web route, legal recipient/status, authorized school/club and receipt/deduction wording; placement terms separately | LEGAL/PARTNERSHIPS/SCHOOL_PARTNERS/CFO/TAX; counsel/CPA; owner | Open; route/status evidence: `[pending]` |
| G-06 | Athletic/NIL/association/state restrictions, no pay-for-play/outcome claims; preset thanks and rights | LEGAL/COMPLIANCE/CONTENT_RIGHTS/MINOR_SAFETY/VOICE; owner | Open; accepted jurisdiction/action scope: `[pending]` |
| G-07 | Agreement/consent/payment records, minimal logging, retained quote/paid-record repair and retention/erasure/access | Data/Privacy/Security/SUPPORT/Finance; counsel; QA | Open; policy and tested controls: `[pending]` |
| G-08 | Final store clauses/listing/reviewer notes and actual configured native/web/build evidence | LEGAL/counsel + MARKETING/RELEASE/QA; owner submits | Open; build/version/screens/approval: `[pending]` |

**Publication blocked:** final Terms/guardian consent, expense/net claims, Aura/store
classification, genuine club route, approved jurisdiction and verified hosted/provider/build
controls remain open. The app's source and local tests do not complete these gates. Counsel
must verify the current store policies and applicable law at review time; guideline numbers in
the drafts are questions for review, not conclusions from a fresh policy/legal review here.

### Review and owner approval record — fill only from actual supplied evidence

- Counsel engagement/reviewer, date, jurisdiction and reviewed source/build: `[pending]`.
- Counsel decisions by G-ID, approved exact text and restrictions: `[pending]`.
- Independent Finance/Privacy/Minor/Security/QA reviewers and original receipts: `[pending]`.
- CTO recommendation and owner-selected options/approved release scope/date: `[pending]`.
- Approved Terms version/hash, guardian version/hash and rollout/re-ack evidence: `[pending]`.
- Store submission, reviewer response and any actual release authorization: `[pending]`.

## 6. Source reading map and evidence limits

Paths below are the actual bounded review scope. The private JSON records file-byte hashes,
the independently recomputed consent-template hash, checks and residual decisions. Changing
these bytes requires revalidation; the packet does not certify their behavior in production.

| Source | Reviewed responsibility |
| --- | --- |
| [finance.ts](../../apps/mobile/src/frontend/data/finance.ts) · [malo.ts](../../apps/mobile/src/frontend/data/malo.ts) · [players.ts](../../apps/mobile/src/frontend/data/players.ts) | Splits, exact copy, gift-linked Aura rate |
| [useTipCheckout.ts](../../apps/mobile/src/frontend/hooks/useTipCheckout.ts) · [paymentIntent.ts](../../supabase/functions/_shared/money/paymentIntent.ts) · [payout.ts](../../supabase/functions/_shared/money/payout.ts) | Actual gift/purchase charge, Aura/recording and blocked payout paths |
| [no-cut migration](../../supabase/migrations/20261022152000_no_cut_gifts_optional_tips.sql) | Unconditional rate, historical preservation, literal flag and estimated quote |
| [guardianConsent.ts](../../apps/mobile/src/frontend/data/guardianConsent.ts) · [minors.ts](../../apps/mobile/src/frontend/lib/minors.ts) · [minor migration](../../supabase/migrations/20261014110000_minor_accounts.sql) | Frozen version/hash, signature inputs and server record gate |
| [aura.ts](../../apps/mobile/src/frontend/lib/aura.ts) · [AuraTradingCard.tsx](../../apps/mobile/src/frontend/components/Profile/AuraTradingCard.tsx) | Tier/border digital consequences |
| [exclusive.ts](../../apps/mobile/src/frontend/data/exclusive.ts) · [ExclusivePaywall.tsx](../../apps/mobile/src/frontend/components/Profile/ExclusivePaywall.tsx) · [subscriptions.ts](../../apps/mobile/src/frontend/lib/subscriptions.ts) · [useAthleteSubscription.ts](../../apps/mobile/src/frontend/hooks/useAthleteSubscription.ts) | One-time copy, access-pass recording/cache; no verified recurring charge |
| [SponsorshipModal.tsx](../../apps/mobile/src/frontend/components/Local/SponsorshipModal.tsx) · [sponsorship tiers](../../apps/mobile/src/frontend/data/sponsorships.ts) · [useSponsorships.ts](../../apps/mobile/src/frontend/hooks/useSponsorships.ts) · [sponsorships.ts](../../apps/mobile/src/frontend/lib/sponsorships.ts) | Native commercial placement, Aura and stored sponsorship metadata |
| [stripe.web.ts](../../apps/mobile/src/frontend/lib/stripe.web.ts) · [stripeStub.ts](../../apps/mobile/src/frontend/lib/stripeStub.ts) | Web has no functional native PaymentSheet; `/gift` page alone is not web collection proof |

Scope includes source excerpts and retained reports; no account/customer/minor records or
credentials are copied. No external delivery, provider action, SQL application or commit occurs.
Role names identify required review ownership; this executor is outside-session Codex, not
a pinned specialist, staffed counsel review or all-role execution.

## 7. Rights and IP cross-reference

Content-rights, school marks, footage/music and permission to publish an athlete story are
pertinent to Highlights, Vault and sponsorship. Consent to money/public visibility does not
transfer copyright or approve commercial endorsement. Use the existing
[IP protection plan](IP_PROTECTION_PLAN.md), [IP counsel packet](IP_COUNSEL_PACKET.md) and
[register](ip-register.json) for contributor/license/disclosure records. This packet creates
no patent candidate, assignment, clearance, novelty/ownership conclusion or filing claim.
Before a public demo/source handoff, LEGAL and owner review the existing disclosure/access
checklist and supplied rights records; payment approval does not approve an IP disclosure.
