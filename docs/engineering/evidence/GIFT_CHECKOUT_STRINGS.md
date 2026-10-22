<!-- Actual source string-table diff stacked on copy commit 5a95152; code identifiers remain separate. -->
# Gift checkout and tip-model string table

112 user-facing string spans changed/added/removed after the 475-span copy phase.
Comparison: copy commit `5a95152` to final tip-branch source, AST literals/template fragments/JSX,
tests/comments/generated docs/CSS excluded. Multi-part templates count as spans. Insertions/deletions
and replacement spans are paired in source order; this includes admin model/disclosure additions.
Existing protocol identifiers are preserved and excluded from the user-facing count.

| File / current line | Before | After |
| --- | --- | --- |
| `apps/admin-portal/app/(protected)/manage/page.tsx:137` | Current test-mode model: 90% to the family account, 10% to Tapua&amp;apos;i. Payouts stay blocked in this test. The full ledger,<br>                gifts by day, and where gifts started are on | New gift model: the full gift is allocated to the family account, with no Tapua&amp;apos;i gift cut. Historical allocations are retained. Payouts stay blocked in this test. The full ledger,<br>                gifts by day, and where gifts started are on |
| `apps/admin-portal/app/(protected)/money/page.tsx:145` | (added) | Repair uses Expo |
| `apps/admin-portal/app/(protected)/money/page.tsx:146` | (added) | View the Finance handoff. |
| `apps/admin-portal/app/(protected)/money/page.tsx:202` | `Stated policy for this stream: ${ | `Model returned for this stream: ${ |
| `apps/admin-portal/app/(protected)/money/page.tsx:205` | &quot;Tapua&#x27;i share (covers card processing)&quot; | &quot;Historical Tapua&#x27;i gift share&quot; |
| `apps/admin-portal/app/(protected)/money/page.tsx:215` | }%) for Tapua&#x27;i. Both percents are computed from ledger rows, not from the policy.` | }%) for Tapua&#x27;i. Both percents are computed from recorded rows; historical allocations are retained. New gifts use the full family allocation with no Tapua&#x27;i gift cut.` |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:84` | &quot;Enter the tip for Tapua&#x27;i / card fee returned and the dispute fee as dollars and cents.&quot; | &quot;Enter the original Tapua&#x27;i gift share between $0.00 and the charge refunded, using the original recorded revenue row.&quot; |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:86` | (added) | &#x27;Add the original gift receipt or recorded revenue reference. This entry does not automatically reconcile the refund.&#x27; |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:90` | (added) | &quot;Enter the Tapua&#x27;i tip / processing fee returned and the dispute fee as dollars and cents.&quot; |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:124` | &quot;Tip for Tapua&#x27;i or card fee returned too ($)&quot; | &quot;Tapua&#x27;i tip or processing fee returned too ($)&quot; |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:128` | (added) | &quot;Original Tapua&#x27;i gift share ($)&quot; |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:130` | (added) | Copy the platform share from the original recorded revenue row. New gifts under MONEY-TIPS-01 use $0.00;<br>            older gifts may have a recorded share. Enter the original gift receipt or revenue reference below.<br>            This manual entry does not verify the original charge or automatically reconcile a refund. |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:137` | (added) | &#x27;Original gift reference required&#x27; |
| `apps/mobile/src/frontend/components/Admin/Books/booksSections.ts:75` | &quot;Only Tapua&#x27;i&#x27;s shares are income. The family&#x27;s 90% of each gift, the athlete&#x27;s 80% of a Vault sale and the operator&#x27;s 85% of a booster sponsorship are held for them until paid out.&quot; | &quot;New gifts are fully allocated to the family, with no Tapua&#x27;i gift cut; historical allocations remain as recorded. The family&#x27;s gift balance, the athlete&#x27;s 80% of a Vault sale and the operator&#x27;s 85% of a booster sponsorship are held for them until paid out. Only recorded Tapua&#x27;i revenue is income.&quot; |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:42` | (added) | Optional checkout controls |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:46` | (added) | &quot;Tip Tapua&#x27;i (optional) and processing-fee coverage are ON in the published configuration.&quot; |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:48` | (added) | &quot;Tip Tapua&#x27;i (optional) and processing-fee coverage are draft ON, live OFF. Publish is required.&quot; |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:49` | (added) | &quot;Tip Tapua&#x27;i (optional) and processing-fee coverage are OFF (default).&quot; |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:52` | (added) | This flag controls optional tips and processing-fee coverage only. After the MONEY-TIPS-01 migration,<br>          the gift platform share is always zero; turning this flag OFF does not restore the old 90 / 10 model.<br>          Verify the migration and trusted server enforcement before Publish. Stripe remains in test mode and<br>          payouts stay blocked. Actual Stripe processing costs are not measured here. |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:58` | (added) | &quot;Open Money&quot; |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:59` | (added) | &quot;Open Books&quot; |
| `apps/mobile/src/frontend/components/Admin/MoneyTool.tsx:127` | (added) | &quot;Gift revenue repair status is on the existing Revenue report. An absent count is unknown; Finance reviews missing original revenue rows and closed-period repair in Books.&quot; |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:117` | &quot;Tapua&#x27;i share (covers card processing)&quot; | &quot;Historical Tapua&#x27;i gift share&quot; |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:118` | `Stated policy for this stream: ${ | `Model returned for this stream: ${ |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:130` | &#x27;Gifts: 90% to the athlete or family account, 10% to Tapua’i. Vault purchases: 80% recorded for the athlete, 20% to Tapua’i. Drip purchases: 100% to Tapua’i.&#x27; | &#x27;New gifts: full family allocation with no Tapua’i gift cut; historical recorded allocations are retained. Vault purchases: 80% recorded for the athlete, 20% to Tapua’i. Drip purchases: 100% to Tapua’i.&#x27; |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:131` | (added) | &#x27;Gift revenue repair&#x27; |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:131` | (added) | &#x27;Open Books for Finance repair&#x27; |
| `apps/mobile/src/frontend/components/FeeCheckbox.tsx:31` | `Cover card fees (optional): add $${ | `Cover the processing fee: add $${ |
| `apps/mobile/src/frontend/components/FeeCheckbox.tsx:31` | }&#x27;s share stays the same; this helps Tapua&#x27;i pay the card company.` | } toward estimated Stripe processing for ${ |
| `apps/mobile/src/frontend/components/FeeCheckbox.tsx:31` | Add $ | }&#x27;s gift. Optional; actual costs may vary.` |
| `apps/mobile/src/frontend/components/FeeCheckbox.tsx:45` | to cover card fees. | Cover the processing fee |
| `apps/mobile/src/frontend/components/FeeCheckbox.tsx:46` | &amp;apos;s share stays the same — this<br>          helps Tapua&amp;apos;i pay the card company. | Optional: add $ |
| `apps/mobile/src/frontend/components/FeeCheckbox.tsx:46` | (added) | toward estimated Stripe processing for |
| `apps/mobile/src/frontend/components/FeeCheckbox.tsx:46` | (added) | &amp;apos;s gift. Actual costs may vary. |
| `apps/mobile/src/frontend/components/TipButton.tsx:41` | `Donate $${ | `Give $${ |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:124` | Donate to | &#x27;Optional extras are now off. Review your gift total again before giving.&#x27; |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:127` | (added) | &#x27;Your gift total changed. Review it again before giving.&#x27; |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:145` | (added) | &#x27;Your gift total changed. Review it again before giving.&#x27; |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:166` | (added) | Send a gift to |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:170` | Your donation to | Your gift to |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:170` | is on its way. | is recorded. |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:171` | &#x27;Finishing your donation…&#x27; | &#x27;Finishing your gift record…&#x27; |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:171` | &#x27;Your payment went through. Contact support to check your donation before paying again.&#x27; | &#x27;Your payment went through. Contact support to check your gift before paying again.&#x27; |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:175` | Choose your donation | Choose your gift |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:177` | &quot;Custom donation amount&quot; | &quot;Custom gift amount&quot; |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:177` | &quot;Minimum $1.00&quot; | &#x27;Enter $1–$1,000, with up to two decimal places.&#x27; |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:123` | &#x27;Enter $1 or more, with up to two decimal places.&#x27; | (removed) |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:182` | Optional extras | &#x27;Optional extras&#x27; |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:182` | Your donation is $ | &#x27;Your gift&#x27; |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:182` | . You can keep both extras off and continue. | Your gift is $ |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:182` | (added) | &#x27; You can keep both extras off and continue.&#x27; |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:182` | (added) | &#x27; Continue to review before giving.&#x27; |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:191` | Your donation to | Your gift to |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:200` | `Donate $${ | `Send a gift · Pay $${ |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:200` | `Donate $${ | `Send a gift · Pay $${ |
| `apps/mobile/src/frontend/components/TipSheetModal.tsx:189` | `Mālo! Your donation to ${ | `Mālo! Your gift to ${ |
| `apps/mobile/src/frontend/components/TipSheetModal.tsx:189` | } is on its way 🚀` | } is recorded 🚀` |
| `apps/mobile/src/frontend/data/legal.ts:14` | &#x27;Test payment only. This does not send live money. A donation is a gift, not a wager or pay for a play. A school or association may restrict it.&#x27; | &#x27;Test payment only. This does not send live money. A personal gift is not a wager or pay for a play. A school or association may restrict it.&#x27; |
| `apps/mobile/src/frontend/data/legal.ts:17` | &#x27;We record where this donation started — a Highlight, a QR gift link, a wishlist item, a profile, or a live play — and we use that record for your receipt, to account for the athlete, and to see which parts of Tapua\&#x27;i bring in support. Read Terms of Service &amp; NIL Compliance for the full summary.&#x27; | &#x27;We record where this gift started — a Highlight, a QR gift link, a wishlist item, a profile, or a live play — and we use that record for your receipt, to account for the athlete, and to see which parts of Tapua\&#x27;i bring in support. Read Terms of Service &amp; NIL Compliance for the full summary.&#x27; |
| `apps/mobile/src/frontend/data/malo.ts:32` | `Your donation goes to ${ | `Your gift goes to ${ |
| `apps/mobile/src/frontend/data/malo.ts:32` | }&#x27;s family account for their sports costs — not to whoever posted the clip, and never for a play or a stat. Donations to individuals are not tax-deductible.` | }&#x27;s family account for their sports costs — not to whoever posted the clip, and never for a play or a stat. Gifts to individual athletes are personal gifts and are not tax-deductible.` |
| `apps/mobile/src/frontend/data/malo.ts:44` | }% goes to ${ | }% of your gift is allocated to ${ |
| `apps/mobile/src/frontend/data/malo.ts:44` | }&#x27;s family account. Tapua&#x27;i keeps ${ | }&#x27;s family account. Tapua&#x27;i takes no cut.` |
| `apps/mobile/src/frontend/data/malo.ts:55` | }% to run the app.` | &quot;Tip Tapua&#x27;i (optional)&quot; |
| `apps/mobile/src/frontend/data/malo.ts:58` | &quot;Add a tip for Tapua&#x27;i (optional)&quot; | &quot;100% of your gift goes to the athlete&#x27;s family. Tips go to Tapua&#x27;i and keep the platform free for families.&quot; |
| `apps/mobile/src/frontend/data/malo.ts:58` | &quot;Tips keep the app free for families. They go to Tapua&#x27;i, not the athlete, and never come out of your donation.&quot; | (removed) |
| `apps/mobile/src/frontend/data/malo.ts:89` | } card fee` | } toward estimated Stripe processing` |
| `apps/mobile/src/frontend/data/malo.ts:94` | } donation: ${ | } gift: ${ |
| `apps/mobile/src/frontend/data/malo.ts:94` | } to ${ | } allocated to ${ |
| `apps/mobile/src/frontend/data/malo.ts:94` | }&#x27;s family, ${ | }&#x27;s family${ |
| `apps/mobile/src/frontend/data/malo.ts:94` | } to Tapua&#x27;i${ | (removed) |
| `apps/mobile/src/frontend/data/players.ts:27` | &quot;90% of your donation goes to the athlete&#x27;s family account. Tapua&#x27;i keeps 10% to run the app, including card processing. Nothing goes to the person who uploaded the clip.&quot; | &quot;100% of your gift is allocated to the athlete&#x27;s family account. Tapua&#x27;i takes no cut. This is a test-mode allocation, not a completed transfer. Stripe processing costs may reduce the amount available for payout and actual costs may vary. Nothing goes to the person who uploaded the clip.&quot; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:143` | (added) | &#x27;Review your gift&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:143` | (added) | &#x27;Choose a gift from $1 to $1,000 with valid gift options.&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:147` | (added) | &#x27;Review your gift&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:147` | (added) | &#x27;Optional extras are unavailable. Review your gift without extras before continuing.&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:152` | (added) | &#x27;Review your gift&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:152` | (added) | &#x27;Processing-fee coverage is unavailable. Review your gift without coverage.&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:163` | (added) | &#x27;Review your gift&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:163` | (added) | &#x27;The checkout amount changed. Review the current total before continuing.&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:244` | &#x27;Donation not recorded&#x27; | &#x27;Gift not recorded&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:245` | &#x27;Your payment went through, but this athlete cannot currently receive donations. Contact support if this seems wrong.&#x27; | &#x27;Your payment went through, but we could not record this gift. Contact support before paying again.&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:293` | &#x27;Your payment went through, but we could not finish updating your donation. Contact support before paying again.&#x27; | &#x27;Your payment went through, but we could not finish updating your gift. Contact support before paying again.&#x27; |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:286` | &#x27;Amount chips + cover fee — Catalogs&#x27; | &#x27;Gift amount chips — Catalogs&#x27; |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:287` | (added) | &quot;Tip Tapua&#x27;i (optional)&quot; |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:287` | (added) | &#x27;Optional checkout amount; default No tip. Published authority only. No separate tap counter; checkout failures use existing fixed signals.&#x27; |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:288` | (added) | &#x27;Cover the processing fee&#x27; |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:288` | (added) | &#x27;Optional estimated fee coverage; not the actual Stripe cost. Missing published authority stays OFF. No separate tap counter.&#x27; |
| `apps/mobile/src/frontend/lib/custodial.ts:183` | &#x27;All of each gift is recorded for the family account.&#x27; | &#x27;The recorded family share is unavailable. Check the original gift receipts.&#x27; |
| `apps/mobile/src/frontend/lib/custodial.ts:187` | }% of each gift is recorded for the family account. Tapua&#x27;i keeps ${ | (removed) |
| `apps/mobile/src/frontend/lib/custodial.ts:187` | }% to run the app, including card processing.` | (removed) |
| `apps/mobile/src/frontend/lib/custodial.ts:191` | }. Tapua&#x27;i kept ${ | }. Historical Tapua&#x27;i gift share recorded: ${ |
| `apps/mobile/src/frontend/lib/custodial.ts:195` | } to run the app, including card processing.` | (removed) |
| `packages/shared-types/admin/analytics.ts:406` | &#x27;Tapua\&#x27;i share and payee share as parts of recorded gross. Current test-mode model: 90% to the family account, 10% to Tapua\&#x27;i.&#x27; | &#x27;Tapua\&#x27;i share and payee share as parts of recorded gross. New gifts allocate the full gift to the family account with no Tapua\&#x27;i gift cut. Historical allocations are retained.&#x27; |
| `packages/shared-types/admin/analyticsCatalog.ts:300` | &#x27;What the ledger recorded for Tapua\&#x27;i across every stream. Current test-mode model: 90% to the family account, 10% to Tapua\&#x27;i.&#x27; | &#x27;What the ledger recorded for Tapua\&#x27;i across every stream. New gifts allocate the full gift to the family account with no Tapua\&#x27;i gift cut. Historical allocations are retained.&#x27; |
| `packages/shared-types/admin/bookkeeping.ts:43` | &quot;The family&#x27;s 90% of each gift, owed until it is paid out.&quot; | &quot;The family&#x27;s recorded gift allocation, owed until paid out: full new gifts; historical amounts retained.&quot; |
| `packages/shared-types/admin/bookkeeping.ts:50` | &#x27;Platform share of gifts&#x27; | &#x27;Historical platform share of gifts&#x27; |
| `packages/shared-types/admin/bookkeeping.ts:50` | &quot;Tapua&#x27;i&#x27;s disclosed 10% of each gift.&quot; | &quot;Historical recorded platform amounts from gifts. New gifts have no Tapua&#x27;i platform cut.&quot; |
| `packages/shared-types/admin/bookkeeping.ts:731` | (added) | &#x27;Enter the original recorded platform share between $0.00 and the refunded amount.&#x27; |
| `packages/shared-types/admin/dashboard.ts:328` | } gross across every stream. Current test-mode model: 90% to the family account, 10% to Tapua&#x27;i.` | } gross across every stream. New gifts allocate the full gift to the family account with no Tapua&#x27;i gift cut. Historical allocations are retained.` |
| `packages/shared-types/admin/financeCatalog.ts:49` | &#x27;Gift amount the family account receives the 90% of (excludes card fee and optional tip).&#x27; | &#x27;Base gift amount allocated fully to the family account for new gifts (excludes processing-fee coverage and optional tip); historical allocations are retained.&#x27; |
| `packages/shared-types/admin/financeCatalog.ts:49` | &quot;Gifts stream: 90% to Gifts held for families (2000), 10% to Platform share (4000)&quot; | &quot;New gifts: full gift to Gifts held for families (2000); no platform cut. Historical recorded platform allocations remain in account 4000.&quot; |
| `packages/shared-types/admin/reports.ts:592` | (added) | &#x27;Gift revenue repair count is unknown. This read did not establish whether gift revenue rows are missing; Finance must review the source.&#x27; |
| `packages/shared-types/admin/reports.ts:594` | (added) | } gift revenue ${ |
| `packages/shared-types/admin/reports.ts:594` | (added) | &#x27;row is&#x27; |
| `packages/shared-types/admin/reports.ts:594` | (added) | &#x27;rows are&#x27; |
| `packages/shared-types/admin/reports.ts:594` | (added) | } missing. Finance must review and repair the original records; if the original period is closed, obtain approval to reopen it through Books before repair. Historical allocations must stay unchanged.` |
| `packages/shared-types/admin/reports.ts:595` | (added) | &#x27;No missing gift revenue rows were reported in this snapshot. This count does not certify reconciliation or payouts.&#x27; |
| `packages/shared-types/index.ts:328` | (added) | &quot;Tip Tapua&#x27;i (optional) and fee coverage&quot; |
| `packages/shared-types/index.ts:328` | (added) | &#x27;Default OFF. Optional tips and processing-fee coverage only; gift platform share stays zero after MONEY-TIPS-01. Draft until Publish.&#x27; |
| `supabase/functions/_shared/money/paymentIntent.ts:78` | (added) | &quot;Gift allocation required for an optional tip to Tapua&#x27;i.&quot; |
| `supabase/functions/_shared/money/paymentIntent.ts:135` | (added) | &#x27;Payment context unavailable.&#x27; |

## Non-visible source string spans

Model/config/RPC/report identifiers and presentation attributes; not giving labels.

| File / line | Before | After |
| --- | --- | --- |
| `apps/admin-portal/app/(protected)/money/page.tsx:141` | (added) |  |
| `apps/admin-portal/app/(protected)/money/page.tsx:143` | (added) |  |
| `apps/admin-portal/app/(protected)/money/page.tsx:143` | (added) | &quot;status&quot; |
| `apps/admin-portal/app/(protected)/money/page.tsx:143` | (added) | &quot;mb-6 text-sm text-[var(--ink-soft)]&quot; |
| `apps/admin-portal/app/(protected)/money/page.tsx:144` | (added) |  |
| `apps/admin-portal/app/(protected)/money/page.tsx:144` | (added) | &#x27; &#x27; |
| `apps/admin-portal/app/(protected)/money/page.tsx:145` | (added) | /admin/books |
| `apps/admin-portal/app/(protected)/money/page.tsx:145` | (added) | . |
| `apps/admin-portal/app/(protected)/money/page.tsx:145` | (added) | &#x27; &#x27; |
| `apps/admin-portal/app/(protected)/money/page.tsx:146` | (added) |  |
| `apps/admin-portal/app/(protected)/money/page.tsx:146` | (added) | &quot;/manage#billing&quot; |
| `apps/admin-portal/app/(protected)/money/page.tsx:146` | (added) | &quot;font-bold text-[var(--jade)] underline&quot; |
| `apps/admin-portal/components/PortalShell.tsx:329` | &#x27;object&#x27; | (removed) |
| `apps/admin-portal/components/PortalShell.tsx:333` | &#x27;.&#x27; | (removed) |
| `apps/admin-portal/components/PortalShell.tsx:338` | &#x27;boolean&#x27; | (removed) |
| `apps/mobile/babel.config.js:12` | (added) | &#x27;@babel/plugin-proposal-dynamic-import&#x27; |
| `apps/mobile/src/backend/api/createPaymentIntent.ts:10` | (added) | &#x27;@supabase/supabase-js&#x27; |
| `apps/mobile/src/backend/api/createPaymentIntent.ts:18` | (added) | &#x27;../../../../../supabase/functions/_shared/money/serverDonationContext.ts&#x27; |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:58` | (added) | &#x27;0.00&#x27; |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:81` | (added) | &#x27;malo&#x27; |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:82` | (added) | &#x27;malo&#x27; |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:91` | (added) | &#x27;malo&#x27; |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:101` | (added) | &#x27;0.00&#x27; |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:127` | (added) | &#x27;malo&#x27; |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:128` | (added) |  |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:128` | (added) | &quot;decimal-pad&quot; |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:128` | (added) | &quot;0.00&quot; |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:129` | (added) |  |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:134` | (added) |  |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:135` | (added) |  |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:137` | &quot;Optional&quot; | &#x27;malo&#x27; |
| `apps/mobile/src/frontend/components/Admin/Books/BooksRecordTab.tsx:137` | (added) | &#x27;Optional&#x27; |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:29` | (added) | &#x27;buttons.MONETIZATION_TIPS_ENABLED&#x27; |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:30` | (added) | &#x27;buttons.MONETIZATION_TIPS_ENABLED&#x27; |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:38` | (added) |  |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:39` | (added) |  |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:41` | (added) |  |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:42` | (added) |  |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:43` | (added) |  |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:44` | (added) | &#x27;warn&#x27; |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:44` | (added) | &#x27;ok&#x27; |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:51` | (added) |  |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:57` | (added) |  |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:58` | (added) |  |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:58` | (added) | &#x27;/admin/money&#x27; |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:59` | (added) |  |
| `apps/mobile/src/frontend/components/Admin/FeaturesTool.tsx:59` | (added) | &#x27;/admin/books&#x27; |
| `apps/mobile/src/frontend/components/Admin/MoneyTool.tsx:127` | (added) | &quot;warn&quot; |
| `apps/mobile/src/frontend/components/Admin/MoneyTool.tsx:129` | (added) |  |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:131` | (added) | &#x27;gift-revenue-repair&#x27; |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:131` | (added) | &#x27;/admin/books&#x27; |
| `apps/mobile/src/frontend/components/FeeCheckbox.tsx:7` | (added) | &#x27;react&#x27; |
| `apps/mobile/src/frontend/components/FeeCheckbox.tsx:26` | }. ${ | (removed) |
| `apps/mobile/src/frontend/components/FeeCheckbox.tsx:48` | (added) |  |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:116` | (added) | &#x27;&#x27; |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:117` | (added) | &#x27;&#x27; |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:169` | (added) |  |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:169` | (added) | &quot;alert&quot; |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:177` | (added) | &quot;$1.00–$1,000.00&quot; |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:182` | (added) | . |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:183` | (added) |  |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:185` | (added) |  |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:186` | (added) |  |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:28` | &#x27;@/lib/dbErrors&#x27; | (removed) |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:141` | (added) | &#x27;in_app&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:141` | (added) | &#x27;qr_link&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:142` | (added) | &#x27;highlight&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:142` | (added) | &#x27;qr&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:142` | (added) | &#x27;wishlist&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:142` | (added) | &#x27;profile&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:142` | (added) | &#x27;live&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:142` | (added) | &#x27;rally&#x27; |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:207` | &#x27;&#x27; | (removed) |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:210` | &#x27;23514&#x27; | (removed) |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:210` | &#x27;&#x27; | (removed) |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:213` | &#x27;checkout.bookkeeping_fields_rejected&#x27; | (removed) |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:213` | &#x27;donate&#x27; | (removed) |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:214` | &#x27;donation&#x27; | (removed) |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:214` | &#x27;data_invalid&#x27; | (removed) |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:216` | &#x27;tips&#x27; | (removed) |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:219` | &#x27;42703&#x27; | (removed) |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:220` | &#x27;&#x27; | (removed) |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:222` | &#x27;tips&#x27; | (removed) |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:287` | (added) | &#x27;checkout.platform_tip&#x27; |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:287` | (added) | &#x27;profile&#x27; |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:287` | (added) | &#x27;/profile&#x27; |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:287` | (added) | &#x27;/admin/features&#x27; |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:287` | (added) | &#x27;buttons.MONETIZATION_TIPS_ENABLED&#x27; |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:288` | (added) | &#x27;checkout.cover_processing_fee&#x27; |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:288` | (added) | &#x27;profile&#x27; |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:288` | (added) | &#x27;/profile&#x27; |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:288` | (added) | &#x27;/admin/features&#x27; |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:288` | (added) | &#x27;buttons.MONETIZATION_TIPS_ENABLED&#x27; |
| `apps/mobile/src/frontend/lib/custodial.ts:10` | &#x27;@/data/malo&#x27; | (removed) |
| `apps/mobile/src/frontend/lib/custodial.ts:191` | `${ | }.` |
| `apps/mobile/src/frontend/lib/runtime.ts:610` | (added) | &#x27;buttons.MONETIZATION_TIPS_ENABLED&#x27; |
| `apps/mobile/src/frontend/lib/runtime.ts:846` | (added) | &#x27;buttons.MONETIZATION_TIPS_ENABLED&#x27; |
| `packages/shared-types/admin/bookkeeping.ts:733` | (added) | &#x27;malo&#x27; |
| `packages/shared-types/admin/reports.ts:583` | (added) | &#x27;number&#x27; |
| `packages/shared-types/admin/reports.ts:583` | (added) | &#x27;string&#x27; |
| `packages/shared-types/admin/reports.ts:589` | (added) | &#x27;configured&#x27; |
| `packages/shared-types/admin/reports.ts:589` | (added) | &#x27;error&#x27; |
| `packages/shared-types/admin/reports.ts:589` | (added) | &#x27;gift_repair_gap_count&#x27; |
| `packages/shared-types/admin/reports.ts:594` | (added) | `${ |
| `packages/shared-types/index.ts:290` | (added) | &#x27;path&#x27; |
| `packages/shared-types/index.ts:290` | (added) | &#x27;defaultValue&#x27; |
| `packages/shared-types/index.ts:292` | (added) | &#x27;.&#x27; |
| `packages/shared-types/index.ts:295` | (added) | &#x27;object&#x27; |
| `packages/shared-types/index.ts:297` | (added) | &#x27;boolean&#x27; |
| `packages/shared-types/index.ts:328` | (added) | &#x27;buttons.MONETIZATION_TIPS_ENABLED&#x27; |
| `supabase/functions/_shared/money/serverDonationContext.ts:2` | (added) | &#x27;./paymentContext.ts&#x27; |
| `supabase/functions/_shared/money/serverDonationContext.ts:11` | (added) | &#x27;prepare_tip_payment_context&#x27; |
| `supabase/functions/_shared/money/serverDonationContext.ts:19` | (added) | &#x27;payment_context_unavailable&#x27; |
| `supabase/functions/_shared/money/serverDonationContext.ts:20` | (added) | &#x27;record_notification_payment_context&#x27; |
| `supabase/functions/create-payment-intent/index.ts:8` | (added) | &#x27;../_shared/money/serverDonationContext.ts&#x27; |
| `supabase/functions/create-payment-intent/index.ts:97` | (added) | &#x27;SUPABASE_SERVICE_ROLE_KEY&#x27; |
| `supabase/functions/create-payment-intent/index.ts:97` | (added) | &#x27;&#x27; |
