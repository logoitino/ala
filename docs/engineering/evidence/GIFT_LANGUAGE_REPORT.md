<!-- Source-bound copy review; language does not establish tax, store or payment acceptance. -->
# Gift-language report — 2026-10-22

## Copy phase

**475 production string spans changed;161 test string spans updated.** The
[before/after table](GIFT_LANGUAGE_STRINGS.md) lists every changed production string and the
old-copy test files. Mobile, Expo admin, Next admin, shared notification subjects/bodies and
runtime defaults use individual Gift/Give language. One-time Exclusive access uses Purchase;
protocol names, identifiers, amounts, routing, schema and money calculations are preserved.

Two exact notices placed: `Profile/AthleteProfileView.tsx` beneath Give, and
`Profile/ReceiptCard.tsx` on each individual gift receipt:

> Gifts to individual athletes are personal gifts and are not tax-deductible.

Counsel drafts: [Gift/Donation/Tip Terms](../../legal/GIFT_DONATION_TIP_TERMS_DRAFT.md) and
[App Store listing/review notes](../../product/APP_STORE_GIFT_DRAFT.md). These are not final
Terms, approved disclosures or submitted listings. Older donation-everywhere/10%-share framing
is explicitly superseded, with history retained.

## Residual audit and owner classification

The [raw donat* audit](GIFT_LANGUAGE_RESIDUALS.md) accounts for595matching production source
lines; the string table separately classifies118parsed literals/JSX spans. Most are unchanged
API/source/module/type identifiers or source comments. Exceptions are explicit:

- **Checkout held by owner sequencing:** TipCheckout, TipSheetModal, TipButton, useTipCheckout
  and their checkout disclosure constants. No100%statement, new tip title or fee-cover wording
  has been inserted into checkout. Shared gift CTA/brand defaults also serve existing checkout
  headers; these vocabulary constants do not change the held calculation/disclosure copy.
- **Frozen signed guardian consent:** `data/guardianConsent.ts` retains donation language.
  Updating the signed version/hash and acknowledgment needs its own reviewed migration.
- **Owner to classify:** `Admin/Books/BooksRecordTab.tsx` “Refund, donor request” covers gifts
  and purchases, so it remains unchanged.
- **Visible internal identifiers:** staff source labels such as `donation_bands`, raw `tips`
  and notification category names; Life-question banned-word explanations; Support's raw
  feature-code search example. These describe actual unchanged validators/protocols.
- **Hosted/stored strings:** published Look copy overrides source defaults; saved source labels,
  notifications and preset thanks may contain historical wording. No database content was
  rewritten. Existing SQL-generated policy/error text remains a separate server dependency.
- **Booster classification:** the current booster flow buys sponsorship placement and pays an
  operator; it is not a demonstrated charitable program checkout. Owner must classify any
  proposed club donation separately. No program donation receipt exists in the scanned giving
  screens, so club-specific deductibility text is drafted rather than falsely added to a
  sponsorship receipt. Tapua'i makes no athlete-gift deduction promise.

## Verification

Actual Codex worker checks: mobile8suites/61tests; portal106tests passed. AST comparisons for
owned mobile107files and admin32files found unchanged identifiers/control flow/numeric values.
Root's two notice placements add presentation text only. Source copy guard passed after adding
backend/shared scan coverage and documenting a raw staff `tips` source identifier.
The first full run caught7old-copy assertions in2suites (a shared CTA and backend messages);
these were updated without changing the tested behavior. Final full `pnpm check`: **PASS** (262mobile suites /2,499tests, both typechecks and all
mandatory guards; private source ensure returned current). Portal106tests also passed. No hosted/device/store/payment acceptance.

## Next: separate no-cut tip model

Owner corrected the original assumption: no tip branch/monetization flag exists. The next
branch creates default-OFF `MONETIZATION_TIPS_ENABLED`; it removes the individual-gift cut
regardless of flag state, then checkout copy is stacked onto that implementation.
The [baseline inventory](TIP_MODEL_BASELINE.md) was supplied **before any split change**: frontend finance constants/splitter;
checkout breakdown; SQL `company_revenue_bps` and `record_company_revenue`;
`sync_company_revenue_logs` (four hardcoded1000expressions); shared `refundEntryLines`;
received/custodial fallbacks and report metadata. Applied migrations stay historical.

The existing rail charges platform Stripe balance, records family liability and blocks
payouts. It does not retain actual per-charge processing fees. A local100%gross allocation
cannot prove bank settlement or100%net after Stripe processing. Item8money movement and
processor disclosure remain explicit dependencies; they do not postpone removing the cut.
Counsel owns final Terms, tax/status language, eligibility, signed consent and store review.
