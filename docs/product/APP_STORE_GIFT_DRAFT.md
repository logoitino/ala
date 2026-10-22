<!-- Draft listing/review text is held for owner submission against the actual release build. -->
# App Store gift listing and review notes — draft

**Owner submits; counsel reviews. Draft 2026-10-22, not submitted or approved.**
Supersedes the individual-donation/10%-share copy in [the historical listing](STORE_LISTING.md).
Rules: [VOICE](VOICE.md). Legal clauses: [Terms draft](../legal/GIFT_DONATION_TIP_TERMS_DRAFT.md).
[Counsel packet](../legal/GIFT_RELEASE_COUNSEL_PACKET.md) supplies current source scope,
decision owners and exact alternatives; [guardian proposal](../legal/GIFT_GUARDIAN_CONSENT_DRAFT.md)
is separate from the frozen testing consent. Listing text below is conditional on those decisions.

## Listing draft

**Name:** Tapua'i Sports — owner confirms the final store name.

**Subtitle:** Give. Elevate. Celebrate.

**Promotional text:** Watch Highlights, cheer your school and support an athlete's season
with an optional personal gift. Celebrate their story.

**Description excerpt:**

Watch Game Day, Train Like Me and Serve Like Me Highlights. Cheer your community and send
an optional personal gift to an individual athlete's family for sports costs such as gear,
fees and travel. Gifts to individual athletes are personal gifts and are not tax-deductible.

Giving is separate from subscriptions and digital purchases. It does not buy a performance,
ranking, recruiting opportunity or access to digital content. Optional tips support Tapua'i.
Program/club donations use the program's web checkout and its own status and receipt terms.

**Hold before publication:** the no-digital-benefit line requires resolution of gift-linked
Aura. The program-checkout line requires an actual verified program web route; the reviewed
booster placement flow and `/gift` landing do not establish it. Existing one-time Exclusive
access is a Purchase, not a demonstrated recurring Subscription. Keep unsupported availability
or no-benefit claims out of the final listing.

## Review notes draft — held until the build supports every claim

> Users send optional monetary gifts to individual athletes; 100% of each gift passes to the receiver (guideline 3.2.1(vii)). No charitable collection occurs in the app; team/club donations run through web checkout.

The submitted build must substantiate this statement. Local branch `codex/tip-model` removes
the gift cut independently of default-OFF `MONETIZATION_TIPS_ENABLED`; new gift ledger tests
assign the full gross gift to family liability. Historical posted 90/10 rows remain history.
The migration/Edge rollout and provider verification have not been performed by this change.
Processing deductions must be reconciled with the 100% claim; a 100% gross allocation is not
proof of 100% net receipt. Staff must verify the web-only program path, not infer it from
existing booster sponsorship/pass controls.

### Factual reviewer disclosure to complete after counsel decisions

> In the reviewed local source, gifts assign the full gross amount to family liability with
> zero platform gift share. Optional Tip Tapua'i and estimated processing contributions are
> separate and start unselected; new extras require the published default-OFF flag. Gift
> payments currently award 10 Aura per $1 to the giver and athlete; Aura affects digital card
> borders. One-time Vault access grants digital content through a separate Purchase. Booster
> sponsorship buys advertised branding/placement and Aura. Actual processing/net receipt,
> payout movement and store classification remain under review.

This is source-review wording, not submission-ready release notes. After model/counsel changes,
replace it with verified final-build facts. Native PaymentSheet is unavailable on web in the
reviewed source; a QR/gift landing does not prove completed web collection. Staff must identify
the actual program checkout URL/provider and verify that route independently.

The proposed 3.2.1(vii) note must not assert eligibility while gift-derived benefits, 100% net
receipt or actual payment-party duties remain unresolved. Counsel verifies current applicable
Apple payment/gift/charity/advertising rules and any platform/region differences at review time.
No fresh guideline applicability opinion or Apple response has been obtained by this draft.

## Checkout copy implemented locally for that release

**Tip Tapua'i (optional)**

> 100% of your gift goes to the athlete's family. Tips go to Tapua'i and keep the platform free for families.

**Cover the processing fee**

These words are gated in checkout by the literal published flag; default OFF hides optional
controls and defaults them off. The exact 100% line is accompanied by processing/test-mode
disclosure. Local implementation is not permission to submit it as a verified settlement claim.
Optional extras start unselected. No store submission, payment activation or approval is
established by this draft, a source check or a test-mode PaymentIntent.

Existing gift-linked Aura affects digital profile/card borders. Owner/counsel must review
that consideration before claiming guideline 3.2.1(vii) eligibility or using the no-digital-benefit
listing clauses. This document preserves the requested review-note sentence as a held draft.

## Submitted-build evidence and approval fields

| Review item | Required evidence / current status |
| --- | --- |
| Source/build identity | `[release commit, native build IDs/version, schema/Edge versions and published config hashes pending]` |
| Gift review with extras OFF and ON | `[screens/video: recipient, gift, separate extras, total, tax/held/processing notices, deliberate final action pending]` |
| Provider fee/net model | `[charge/balance transaction, cost payer, family allocation, refund and bank settlement proof pending]` |
| Aura/entitlement treatment | `[owner/counsel decision and actual giver/athlete tier/border/Vault tests pending]` |
| One-time Vault versus premium Subscription | `[actual available product, separate access terms, billing route and price evidence pending]` |
| Sponsorship versus program Donation | `[placement/permissions/paid-route classification; independently verified web organization route/status/receipt pending]` |
| Minor/guardian consent | `[final form/version/hash, current Terms, re-ack, authority/age/withdrawal hosted/device negatives pending]` |
| Store privacy/UGC/age/account handling | `[current accepted disclosures, rights/safety contact and actual scoped controls pending; separate legal gates]` |
| Counsel review | `[reviewer/date, applicable policies/jurisdictions, accepted exact listing/reviewer text and restrictions pending]` |
| Final handoff | `[independent domain/QA/RELEASE evidence, CTO recommendation, owner submission approval pending]` |
| Actual store outcome | `[submission date/reference, reviewer response, approved build/scope pending]` |

Earlier local 266 suites / 2,576 tests and portal 117 checks are linked in the model/app evidence;
this documentation pass does not rerun or extend those receipts. Tests of source allocation do
not supply bank, guardian, native or store approval. Freeze the actual final text/build and
revalidate these fields after every material change before owner-authorized submission.
