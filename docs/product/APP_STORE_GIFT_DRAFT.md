<!-- Draft listing/review text is held for owner submission against the actual release build. -->
# App Store gift listing and review notes — draft

**Owner submits; counsel reviews. Draft 2026-10-22, not submitted or approved.**
Supersedes the individual-donation/10%-share copy in [the historical listing](STORE_LISTING.md).
Rules: [VOICE](VOICE.md). Legal clauses: [Terms draft](../legal/GIFT_DONATION_TIP_TERMS_DRAFT.md).

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

## Review notes draft — held until the build supports every claim

> Users send optional monetary gifts to individual athletes; 100% of each gift passes to the receiver (guideline 3.2.1(vii)). No charitable collection occurs in the app; team/club donations run through web checkout.

The submitted build must substantiate this statement. The current test rail's historical
90/10 computation does not. The owner has directed a separate no-cut tip model, default-OFF
`MONETIZATION_TIPS_ENABLED`, before checkout wording is stacked onto that branch.
Processing deductions must be reconciled with the 100% claim; a 100% gross allocation is not
proof of 100% net receipt. Staff must verify the web-only program path, not infer it from
existing booster sponsorship/pass controls.

## Held checkout copy for that release

**Tip Tapua'i (optional)**

> 100% of your gift goes to the athlete's family. Tips go to Tapua'i and keep the platform free for families.

**Cover the processing fee**

These words stay out of checkout until the implementation/flag and disclosure checks pass.
Optional extras start unselected. No store submission, payment activation or approval is
established by this draft, a source check or a test-mode PaymentIntent.
