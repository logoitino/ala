<!-- Source review and owner decision packet; proposed safeguards are not approved legal policy. -->
# Verification, consent and safe growth

**Review date:** 2026-10-13, America/Denver. **App:** Tapua'i Sports (`ala-sports`).
**Accountable packet owner:** GROWTH_ANALYTICS through MARKETING → CTO → owner.
**Actual review execution and receipts:** [GROWTH-01](../agents/GROWTH-01.md).

This answers the owner's request for Legal, Development and Growth/scalability to exchange
recommendations and bring practical decisions to the table. The standing coordination process
is [Growth charter §9](../engineering/GROWTH_CAPACITY_REVIEW.md#9-verification-consent-and-safe-engagement).
The product options below are recommendations. Counsel approves legal conclusions and policy;
domain reviewers accept their controls; the owner records business decisions.

## 1. What exists and what remains open

Tapua'i already defines ENGINEERING, LEGAL, COMPLIANCE, PRIVACY_ENGINEERING, MINOR_SAFETY,
ATHLETE_VERIFICATION, CONNECT, CUSTODIAL and GROWTH_ANALYTICS. The Growth and Capacity Review
already brings product measurements, service capacity and costs to the CTO and owner. The
missing operating link was an explicit, recurring joint review of verification, consent,
safe engagement and the friction those controls create. Role definitions are assignments;
actual review execution must be recorded.

The [current STATE](../STATE.md) records an internal Wave 0 app, Stripe test mode, blocked
payouts and open counsel/public-launch gates. Older athlete verification SQL is recorded as
applied to staging; newer profile privacy, tag approval and minor-account SQL are unapplied.
No hosted configuration, production safety, settlement or device behavior was checked here.

The app includes a school confirmation route, an athlete verification ladder, guardian
money controls, legal acknowledgments and upload-rights confirmations. MINOR-01 adds local
guardian supervision and versioned consent work. The guardian form explicitly remains a
draft for counsel (`2026-10-14-draft`), unsuitable for real-family release. A signed form,
an adult account, a school badge and payment-provider verification prove different things.

**Current owner scope (2026-10-15):** US-only launch planning, Utah first, with the rest of
the country planned through subsequent state reviews. Fans, families, friends and casual
uploaders join athletes; sensitive action gates remain specific to age, content and payment.
No next-state order, all-state cost ranking or legal launch clearance is established. Legal
and school/payment reviewers must verify each actual rollout jurisdiction and model.

**Current-status annotation:** this document's joint source findings are dated 2026-10-13.
Later MINOR-01/VERIFY-02 and local BEYOND-01/CHAL-01 work supersede some incomplete-source
observations. Use [STATE](../STATE.md), [payee verification](../engineering/design/PAYEE_VERIFICATION_PLAN.md),
[minor accounts](../engineering/design/MINOR_ACCOUNTS_DESIGN.md), [BEYOND-01](../agents/BEYOND-01.md)
and [TEAM_STATUS](../agents/TEAM_STATUS.md) for current local assignments and limits. A local
source change is not hosted enforcement or counsel-approved policy. The October 20 joint
Growth/Legal/Engineering packet retains current-law, permission, friction and cost review.

### Source findings from the joint review

The shared working tree was actively changing during this review. These are observed local
findings, not a frozen release certification. Current source/check receipts and review times
are recorded in GROWTH-01; final integration must check the complete current behavior.

| Finding / evidence | Why it matters | Next action and owner |
| --- | --- | --- |
| Private-profile exceptions: `apps/mobile/src/frontend/lib/privacy.ts`, lines 39–40; roster subjects in `docs/engineering/DATA_PRIVACY_MAP.md`, lines 15 and 88 | Some athlete information, approved Highlights, Donate/Rally/gear goals and related public surfaces can remain visible; children can appear on rosters without accounts | Privacy/Minor Safety/Legal define publication permission for each surface, including non-users and media URLs; disclose actual exceptions |
| Guardian draft: `apps/mobile/src/frontend/data/guardianConsent.ts`, lines 27, 31, 39 and 43 | Omits public exceptions; promises payout approval/handover still unresolved; describes blanket withdrawal effects despite a second guardian; retention period not defined | Legal/Custodial/Treasury resolve the actual model and counsel text; Data/Backend define retention and per-permission revocation before release |
| Guardian relationship assertion: minor migration `20261014110000_minor_accounts.sql`, lines 149–164 and 970–985 | Version/hash-bound signatures show what an actor asserted; they do not independently establish guardianship | Legal/Safety set evidence, custody-conflict and appeal rules; Security validates trusted financial guardian changes |
| Identity route vs school dependence: migration `20260929130000_payout_gate_without_school.sql`, lines 133–142, compared with minor migration, lines 292–294, 338–347 and 979–980 | The older gate permits identity verification without school; new donation-consent eligibility requires a verified linked athlete/guardian record, potentially preventing minors using the intended alternative | Engineering/Custodial/Athlete Verification reconcile both routes; Legal/owner choose an approved support-reviewed identity relationship route or explicit school dependence |
| Connect gates: `supabase/functions/create-stripe-account/index.ts`, lines 95–108 and 122–149 | Observed handler does not enforce the planned age/blocked/guardian-authority gates or current Terms version; payment-account creation can differ from minor capability rules | CONNECT/Security/Legal define server gates for each account/payee path and test denied callers before activation |
| Connect readiness/status: the same handler, lines 35–39 and 197–206; minor migration, lines 1446–1452 | Observed readiness can treat active transfers as bank-payout readiness; writes profile flags while custodial payout checks read `custodial_accounts` | CONNECT/Custodial reconcile the exact guardian/athlete account and capability states; verify bank payout readiness independently of transfers |
| Settled family balance: `useTipCheckout.ts`, lines 154–200; `supabase/functions/stripe-webhook/index.ts`, lines 109–149; `apps/mobile/src/backend/api/createPayout.ts`, lines 77–88 | Client records donations after PaymentSheet; dormant webhook processing has partial-write/retry concerns; payouts remain blocked. Eligibility/caps are not an enforced available balance | LEDGER/Checkout/Reconciliation/Refunds/Finance/QA establish one trusted credit path, retry-safe settlement, reserved available balance, refunds/disputes and payout-cap enforcement |
| School authority: verification ladder migration `20260929120000_athlete_verification_ladder.sql`, lines 647–686 and 801–825 | Staff queue uses a bearer token; staff creation records identity fields but genuine employment/authority remains a manual obligation | SCHOOL_PARTNERS/Athlete Verification/Security verify staff authority, token revocation and install-free confirmation access; counsel resolves commercial/NIL/marks permissions |
| Active MINOR integration: `auth.ts`, `SoftWallModal.tsx`, `AuthContext.tsx`, `AgeConfirmModal.tsx`, `minors.ts` and minor migration | Signup code changed during review; age-confirm/context integration remained incomplete at the last engineering observation. Design describes seven-day/instant links while current helpers/SQL use 48-hour invites and teen confirmation | MINOR-01 owners reconcile current onboarding, unknown/not-given states, server enforcement and design; run current gates and hosted/device negatives |
| Rights/removal operations: `docs/engineering/DATA_PRIVACY_MAP.md`, lines 86–89; `docs/legal/LEGAL_BRIEFING.md`, lines 88–89 | Export/deletion, non-user guardian takedown, stored-media removal, video metadata and staffed safety operations have unresolved evidence | Privacy/Content Rights/Storage/Support/Legal scope and verify operations before public expansion |

Existing docs also contain older privacy/age/guardian descriptions, and the draft references
Legal row AA which was absent in the reviewed briefing. Treat this as assigned MINOR-01/legal
documentation reconciliation, rather than evidence of approval. Preserve the existing open
ledger, held-money/refund, App Store fee, state handover and release decisions.

Engineering checked that the three reviewed privacy/tag/minor migrations are included exactly
in canonical SQL. That is a local source-consistency observation, not a runtime or hosted check.

## 2. Recommended verification approach

Use stronger checks when a person requests a sensitive capability. Keep the entry flow
short, explain each blocked action and preserve ordinary permitted participation while a
check is pending. Age and safety defaults apply at entry; payment checks can happen when
the family sets up earnings. Delaying verification must never collect money or expose a
minor before the relevant approved controls are ready.

| Action or claim | Recommended check | How to reduce friction safely | Decision authority |
| --- | --- | --- | --- |
| Guest browsing | Preserve approved browsing access and content protections; counsel reviews guest-data collection | Do not require an account or birth details merely to browse an approved guest surface | Legal/Privacy and Product define permitted access |
| Create an account | Neutral age screen, account security and age-appropriate defaults; resolve unknown-age scope | Avoid requiring government ID from every fan. Preserve sign-up progress and provide correction/support | Legal/Privacy set age obligations; Product and Engineering implement |
| Act as a guardian | Authenticated adult account, teen-approved link and evidence of legal relationship proportionate to the capability | Reuse an accepted relationship record; use additional checks for conflicting claims or money authority. Offer secure manual review | Legal/Minor Safety decide acceptable proof; Security verifies actors |
| Receive money using Stripe | Provider onboarding of the legally correct payee, required identity/business/bank verification, current account capabilities and approved guardian money authority | Use Stripe-hosted or embedded onboarding as appropriate; resume incomplete checks. Keep raw identity/bank documents with the provider where possible | CONNECT/COMMERCE, Finance and payments counsel; confirm exact configuration with Stripe |
| Claim athlete or school affiliation | Claimant identity/relationship and an authorized school confirmer or separately approved alternative | Keep a school badge independent of ordinary participation and, where approved, payout eligibility. Provide a fallback for slow school responses | ATHLETE_VERIFICATION, SCHOOL_PARTNERS and Legal |
| Publish a minor's profile or footage | Age-appropriate permissions, lawful guardian consent where required, athlete assent and upload/content rights | Separate public visibility from payment permission. Show an understandable preview and allow revocation | Legal/Privacy, Minor Safety and Content Rights |
| Donate to a family | Accurate recipient, amount, fees/share, purpose, eligibility and refund/held-money disclosure | Keep optional tip for Tapua'i at No tip. Do not require donor seller onboarding merely because the recipient uses Connect | Commerce/Finance/Legal/Voice |
| Donate to a school or charity | Verify the recipient organization, authorized representative, account and any charitable/tax claims | Reuse an approved organization record; distinct checkout and receipt from family support | Legal, Finance and Partnerships |
| Sponsorship, paid content or NIL | Identify the commercial transaction, eligibility restrictions, disclosures and required reporting | Review an approved template/model once, then escalate exceptions; do not require every athlete to upload education records | Counsel, school/association compliance, Commerce and Finance |

An adult identity check does not prove legal guardianship. A teen-shared invitation and
typed name do not independently prove custody or financial authority. A coach's confirmation
does not replace guardian consent, school-mark licensing or Stripe verification. Likewise,
Stripe verification does not resolve minors' contract rights, custody disputes, athletic
eligibility or whether our money structure is legally appropriate.

Avoid universal school approval as a growth gate where school confirmation is optional.
Display the exact claim a badge supports; do not let it imply safeguarding checks, school
endorsement, permission to use a logo or permission to earn money.

## 3. Consent, notices and controls in the app

Legal should give Engineering a consent inventory: purpose, data collected, affected ages
and jurisdictions, lawful basis, provider/recipient, retention, who can authorize, withdrawal
effect and the versioned text. Consent is not the legal basis for every necessary processing
activity. Essential security, payments and financial records need their own lawful basis and
clear notice; optional tracking must not be bundled into access.

| Location | Notice/control to review | Engineering acceptance evidence |
| --- | --- | --- |
| Sign-up | Age explanation, Terms/Privacy links, short data notice; separate optional choices | Supported age states enforced on the server; existing, OAuth and corrected-age accounts covered |
| Guardian linking | Relationship declaration, teen confirmation, separate public-profile and payment permissions, signature and copy | Actor/relationship authorization, current version/text hash, expiry/replay/conflict checks and revocation evidence |
| Upload and public-profile change | Audience preview, rights/permissions, public visibility and age-appropriate guardian approval | Direct API calls cannot bypass approval; unsafe content stops being accessible, including old media URLs where required |
| Connect onboarding | Who receives money, verification provider, data shared, fees and control/withdrawal rules | Correct recipient account, provider readiness, denied/expired checks and safe retry verified |
| Donate review and receipt | Family recipient, 90/10 model under review, optional platform tip, total, held status/refund conditions, no unapproved tax claim | Charged amount/recipient match the reviewed quote; one settled credit path; accurate failure/refund states |
| Privacy and guardian settings | Understandable visibility, permissions, supervision summary, withdraw/unlink, report/block and support | Revocation stops future restricted actions; custody conflicts and age transition have a reviewed process |
| Optional analytics/marketing | Specific purpose and recipients; separate opt-in where legally required, change choice later | No collection before the applicable choice; refusal/withdrawal works and retention is bounded |
| Account help | Access/export/deletion request and explanation of records legally retained | Authorized request handling, media/provider deletion propagation and retention exceptions verified |

Suggested UI actions, for counsel/design review: **“Link a parent or guardian,” “Review what
you allow,” “Allow a public profile,” “Allow donation payouts,” “Finish bank verification,”
“Review school affiliation,” “Withdraw permission,” “Request a review,”** and **“Report a
safety concern.”** These are suggested labels, not approved policy or newly implemented UI.

## 4. How Growth and Development should address roadblocks

For every material drop-off, Legal states whether the check is a legal obligation, a Stripe
condition, a school/association rule or a company choice, and the permitted alternatives.
Growth identifies where people struggle. Engineering diagnoses UI, network, provider,
authorization and operational causes. The team compares alternatives with the same safety
outcome before recommending a change.

- **Slow guardian setup:** resume the flow, use expiring links with clear recovery, explain
  each permission, show progress and preserve the teen's permitted experience.
- **Slow school response:** queue authorized confirmations, provide status and an approved
  appeal/alternative route. Cap requests and monitor reviewer capacity; no automatic approval
  when a timeout expires.
- **Stripe onboarding failure:** use provider requirement states and webhook updates;
  provide safe re-entry. Verify readiness on the server before money actions.
- **Held donations:** decide whether to accept them at all before approval. Prefer completing
  recipient eligibility before charging if the reviewed held-money model is not ready.
  Any held-money model needs explicit caps, deadlines, refund authority and operational funding.
- **Manual-review overload:** automated low-risk checks, duplicate suppression, bounded queues,
  trained escalation and appeals. Review mismatch/override rates; outsourcing creates privacy,
  security and provider-contract review work.
- **Media growth:** signed/authorized access, processing queues, metadata removal, deletion and
  moderation scale together. Hosting changes must satisfy private-minor access as well as cost.

Measure ordinary permitted engagement separately from optional money/publicity setup. The
engagement funnel runs from eligible sign-up to account ready, resumed action and first permitted
meaningful action. The optional setup funnel runs through guardian invitation → confirmed link →
signed permission → provider onboarding → eligible family activation. State definitions, denominators,
environment, window and missing data. Separate invitation delivery problems from legal refusals
and provider failures. Measure completion time, abandonment reasons, support workload, cost per
verified family, confirmed fraud and appeal-overturn rates alongside permitted retention and
content activity. Current values are unknown; new measurement requires the existing Data/Privacy
and admin-first reviews. Use restricted aggregates, suppress small identifying cohorts and avoid
raw IDs, birth details, payment documents or consent signatures in growth dashboards.

Test understandable language, navigation, save/resume and approved verification channels.
Experiments cannot remove mandatory consent, age safeguards, recipient checks or accurate fee
disclosures. Record success criteria and stop criteria before an experiment: unauthorized public
visibility, revoked consent still effective, wrong recipient, unsafe adult contact, fraud or
review-capacity failure triggers the relevant domain escalation.

## 5. How other platforms approach young users and money

The useful pattern is separate eligibility for using the product, public interaction and
earning/receiving money. Platforms combine age-dependent defaults, limited adult contact,
supervision, feature eligibility and payment verification. A minor appearing in content does
not automatically make them eligible to receive payouts.

**Current-policy verification limitation:** external search returned official source links,
but page bodies were denied by input filtering. Meta CLI discovery supplied no suitable public
policy loader; the Stripe documentation CLI is unavailable. The examples below are background
patterns, not a verified October 2026 policy comparison or permission for Tapua'i's model.

| Platform | Background pattern to validate against current terms | Useful lesson |
| --- | --- | --- |
| YouTube/AdSense | Adult AdSense account holder; a younger creator may use an approved parent/guardian payment relationship. Fan-funding features can have separate age rules | Separate channel participation, feature eligibility and legally responsible payee |
| TikTok | Creator Rewards and LIVE/gifting features use higher age thresholds than ordinary participation; region-specific rules apply | Gate each earning/spending feature separately rather than inferring permission from an account |
| Instagram/Meta | Teen accounts use protective defaults and guardian approval for some younger-teen setting changes | Supervise sensitive changes while preserving age-appropriate autonomy |
| GoFundMe | Fund recipient verification and adult responsibility; fundraising for a child differs from the child independently controlling withdrawals | Separate organizer, beneficiary and payout recipient with accurate purpose/disclosures |
| Stripe | Adult/guardian participation and verification depend on country, account setup and payment arrangement | Confirm the exact permitted minor/payee structure and Connect configuration directly |

Official source pointers for counsel/provider revalidation:

- [Stripe account age requirements](https://support.stripe.com/embedded-connect/questions/age-requirement-to-create-an-account).
- [Google AdSense age requirements](https://support.google.com/adsense/answer/14230?hl=en).
- [TikTok Creator Rewards terms](https://www.tiktok.com/legal/page/global/creator-rewards-program-us/en)
  and [LIVE safety guide](https://www.tiktok.com/safety/en/live-safety-guide).
- [Meta Teen Accounts](https://about.fb.com/news/2024/09/instagram-teen-accounts/).
- [GoFundMe requirements to receive funds](https://support.gofundme.com/hc/en-us/articles/360001977868-Requirements-to-receive-funds).
- [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).

Counsel must check current child/teen privacy and social-media obligations, state law and
litigation, age assurance, biometric/ID handling, consumer protection and applicable school/NIL
rules. An under-13 exclusion needs an effective implementation and an incident/deletion process;
it does not by itself establish COPPA inapplicability. Calling a payment a “donation” does not
determine tax, charitable, athletic or app-store treatment. Family gifts, paid content,
sponsorship/NIL and charitable fundraising must be analyzed separately.

## 6. Decisions to bring to the table

| Priority / decision | Recommendation to consider | What must be resolved before approval | Next accountable owners |
| --- | --- | --- | --- |
| 1. Launch ages, jurisdictions and teen participation | Limited reviewed launch scope; private teen defaults; keep under-13 exclusion | Counsel applicability matrix; consistent signup/OAuth/unknown-age/server behavior and safe public fields/media | Legal/Compliance + Minor Safety; Engineering/Privacy/QA |
| 2. Guardian identity and money authority | Teen-approved supervision plus separately verified financial guardian/payee | Accepted relationship evidence, custody conflicts, revocation, state handover age and lawful funds structure; exact Stripe support | Counsel + CUSTODIAL/CONNECT/COMMERCE + CFO/Treasury |
| 3. School confirmation vs participation/payout | Accurate optional affiliation badge where approved; preserve approved separate payout gate | Authorized confirmer/alternative; badge meaning; school/association NIL and footage/mark permissions | ATHLETE_VERIFICATION/SCHOOL_PARTNERS + Legal |
| 4. Family payment model, fees and held donations | Verify recipients before charging unless a reviewed held-money model is ready | One authoritative settled credit, amount owed, payout gates, caps/refund window, financial reconciliation and App Store 90/10 issue | Commerce/Ledger/Refunds + Finance/payments counsel + Release/QA |
| 5. Final consent/policy and safe-growth experiments | Separate permissions with clear withdrawal; measure and improve approved flows | Counsel-approved text/retention/providers, legal basis, signed version/hash, hosted revocation/access tests, moderation/support capacity | Legal/Privacy + Growth/Engineering/Support + QA |

For each decision record: question; applicable ages/places; evidence; rule classification;
two feasible options with growth/safety/operational cost; recommendation; Legal/domain reviews;
CTO disposition; owner approve/reject/defer; implementation lead; acceptance/rollback; follow-up
date. Reuse GROWTH-01 and the existing feature/decision records.

**Recommended next step:** use the October 20 Growth review to resolve this packet's scope and
order the existing legal, privacy, guardian and payment work. Actual source/review findings and
documentation checks are recorded in GROWTH-01. Public/minor/live-money release requires its
own counsel, domain, hosted/device and owner evidence; this review does not supply that approval.

## 7. Local check results for this review

- `pnpm check` **failed**, exit 2 at mobile TypeScript checking, with 28 diagnostics involving
  the ongoing age/guardian privacy integration. The remaining stages of that run did not execute.
- Separately, `pnpm docs:check` **failed**, exit 1: SCHEMA documentation omits new guardian tables
  and minor-account functions present in canonical SQL. MINOR-01/Backend/Documentation own this drift.
- `pnpm docs:links` **passed**, 190 active Markdown local file destinations at the check time.
- `pnpm agents:check` **passed**, 106 roles, paths, reporting and team documents aligned at the check time.

These counts include the concurrent shared working tree. The log is
`.smoke/support/safe-growth-check.log`; actual Documentation/VP receipts are linked from
GROWTH-01. No hosted, native/device, current-policy or legal release verification was obtained.
