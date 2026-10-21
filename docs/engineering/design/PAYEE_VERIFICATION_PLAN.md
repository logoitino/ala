<!-- Owner-approved payee policy plan plus dated app implementation evidence; source findings are not counsel/provider acceptance. -->
# Verifying people who receive donations: SSN, identity and legal guardians (VERIFY-02, plan)

**Owner question (2026-10-14):** a legal parent and an athlete should both be legally verified; earners of donations
should give their Social Security number. How do we verify that, and how are we accountable for it?

**Panel** (owner → CTO → leads): CONNECT, COMMERCE, CUSTODIAL, SECURITY, PRIVACY_ENGINEERING, LEGAL, INFO_RETURNS, TAX,
ATHLETE_VERIFICATION. It builds on [VERIFICATION_AND_SAFE_GROWTH_REVIEW](../../legal/VERIFICATION_AND_SAFE_GROWTH_REVIEW.md)
and [MINOR_ACCOUNTS_DESIGN](MINOR_ACCOUNTS_DESIGN.md). The original panel (sections 1–7) used no internet:
its Stripe capability, price and legal claims are **unverified, from memory**. Section 8 separately
records dated source/SDK investigation and executed local tests. This is not legal or tax advice. Status: **owner decided 2026-10-14 (§7: all four recommendations); VERIFY-02 SQL built locally then.
STATE records development application on 2026-10-17 (not re-queried here); Connect repair/evidence gap in §8.**

## 1. Historical source findings from the 2026-10-14 panel

- **No SSN or tax ID is collected anywhere.** The W-9 item is marked missing
  (`packages/shared-types/admin/financeTax.ts`).
- **"Stripe identity check passed" is really a payouts flag.** `athlete_payout_status` treats
  `profiles.payouts_enabled` as identity, but that flag turns on when Stripe *transfers* are active
  (`supabase/functions/create-stripe-account/index.ts`, `createStripeAccount.ts`). That is not a verified identity or
  TIN.
- **The guardian payee account has no writer.** `custodial_accounts.stripe_connect_id` / `payouts_enabled` are never
  filled in. Connect always opens an account for whoever is signed in and checks no age or guardian rule.
- **Account status is never refreshed from Stripe.** The webhook handles only `payment_intent.succeeded`, so the stored
  flags go stale.
- **An admin can set payout flags by hand, with no record of why.**
- **The Connect account id is readable by anyone** (`profiles.stripe_connect_id`), so new verification state must not
  live on `profiles`.

Payouts are blocked today (503), so none of these moves money yet. They are gates for Wave 1.

## 2. SSN: the earner gives it to Stripe, not to Tapua'i

**Recommendation:** every earner enters their SSN, but in Stripe's hosted onboarding (Connect), never in a Tapua'i
screen or table.

- **What Stripe does with it:** collects name, date of birth, address and SSN; runs its identity check and (from memory)
  an IRS TIN match; issues 1099-Ks from what it collected.
- **What Tapua'i stores:** the provider references (`acct_…`, and an Identity session id if used) and yes/no status
  flags with dates ("identity verified", "TIN verified"). Never the SSN, not even the last 4 digits, and no document
  images.
- **Why:**
  - A table of names and SSNs triggers breach-notice laws in every state, and several states restrict SSN use and
    require a written security programme.
  - A child's SSN is worth more to thieves, because the theft can go unnoticed for years.
  - Stripe already has to collect the SSN to pay anyone out.

## 3. Who the earner is

- **Adult athlete (18 or older):** the earner and the Connect account holder. Their own SSN goes to Stripe.
- **Minor athlete:** the **guardian on record** is the payee (custodial design: one per athlete, the athlete approves
  every withdrawal, control hands over at 18–21). The guardian's own SSN goes to Stripe. If the money lands in a UTMA
  account titled for the minor, the bank collects the minor's SSN under its own rules, not us.
- **For the CPA:** whose TIN goes on the 1099-K or 1099; whether donations to individuals are gifts or income; kiddie
  tax; Vault money.
- **For counsel:** whether holding money makes the guardian a UTMA custodian; the handover age in each state; money
  transmission (STATE §6 item 8).

## 4. What each check proves

| Check | Proves | Does not prove |
| --- | --- | --- |
| Stripe Connect KYC (free with Connect) | A real adult whose name, date of birth and SSN match; their TIN; that they own the bank account | Parenthood; athletic status; which athlete the account is for |
| Stripe Identity (ID + selfie; roughly $1–2 per check, unverified) | The person holds a genuine ID and matches its photo | Parenthood. It also brings biometric-law exposure (e.g. Illinois BIPA). |
| School confirmation (built, in person) | An AD or coach vouches for the athlete on the roster | Legal identity; guardianship |
| Bank custodial-account KYC | The bank checked the custodian | Parenthood (a custodian need not be a parent) |
| Manual document review (birth certificate, court order) | The relationship, if the document is genuine | Authenticity at scale; and it creates sensitive files |

**No check proves legal parenthood on its own.** The plan pairs identity (Stripe) with relationship evidence.

## 5. Proposed tiers (money authority only; sign-up never waits)

- **Tier 0 (built, MINOR-01):** guardian attests, teen confirms, guardian signs the consent. This unlocks supervision
  and a public profile, **never money**.
- **Tier 1, payouts for a minor:** Stripe Connect KYC of the guardian (their SSN to Stripe) **plus** one piece of
  relationship evidence:
  - **(a) Default:** the school confirms the parent on record, in person, through the existing AD / coach flow.
  - **(b) Fallback:** support reviews a birth certificate or court order in a session and does not keep it; we record
    only the reviewer, the time and the result.
  - **(c) Supporting only:** a custodial bank account opened for the athlete.

  Disputes (two guardians, custody orders) hold payouts for support review.
- **Adult athletes:** Stripe Connect KYC (their SSN to Stripe), plus the existing school or identity athlete ladder.

## 6. Accountability (to build once the decisions below are made)

- **Verification record:** an append-only `payee_verifications` table (subject, athlete, role `adult_athlete` /
  `guardian_payee`, provider, method, provider reference, status, checks, `verified_at`, `expires_at`, reviewer,
  reason). No client access; never an SSN.
- **Admin desk:** a payee verification panel. Any override needs a reason and a second admin.
- **Re-verification** when any of these happens: the guardian changes, a link or consent ends, the Connect or bank
  account changes, or the handover age arrives.
- **Payout gate:** `athlete_payout_status` requires a current verified record for the *actual payee*. The transfer
  re-fetches the live Stripe account instead of trusting stored flags. Stripe `account.updated` events are logged.
- **A `pnpm check` guard** that fails on SSN / tax-id columns or inputs and on SSN-shaped strings in source, plus
  redaction of SSN-shaped text in telemetry.
- **Records and sign-off:** data map and privacy map rows; retention set by counsel and the CPA; Stripe Connect and
  Identity terms checked; counsel and CPA sign off before anything goes live.

## 7. Owner decisions (answered 2026-10-14: 1 yes, 2 school + Stripe, 3 disputes only, 4 two admins + reason)

1. SSN goes to Stripe only, never stored by Tapua'i (recommended: yes).
2. Relationship evidence for a guardian's payout authority (recommended: school confirmation by default, document review
   as fallback, attestation never enough on its own).
3. Stripe Identity (ID + selfie, paid per check) on top of Connect KYC, or Connect KYC alone (recommended: Connect alone
   for Wave 1; Identity only for disputes).
4. The admin override of payout flags: remove it, or keep it with two admins and a reason (recommended: two admins and a
   reason).
5. Still open from before: STATE §6 item 8 (how money reaches families), which decides whose TIN is on the tax forms;
   engage counsel and a CPA.

## 8. Connect persistence repair — 2026-10-20 (local app)

**Scope/decision:** repair the existing Connect account/link/status path under CONNECT/COMMERCE,
with Security/Backend/Data review. This is an ordinary repair of existing behavior; no new feature
or collection policy is introduced. According to STATE, VERIFY-02 SQL was applied to development
on 2026-10-17; that hosted state was not queried in this repair. No SQL or provider configuration changes.

### Observed defect and adopted repair

Both Edge and Node adapters ignored profile read/update errors. The Node adapter also used an
ordinary caller session when a service key was absent, although existing payout-field triggers
require trusted server writes. The core minted the Stripe link before storing its account binding.
An unavailable link therefore lost the freshly created account id; database failures could still
return 200 with unpersisted flags/link. Parallel first-onboarding or a delayed status request could
overwrite a newer binding.

- Both server paths require `SUPABASE_SERVICE_ROLE_KEY` for profile access (the mobile `.env.example`
  explains private server-process loading without adding credential values); live user validation
  still runs in its original order and Stripe test-only checks remain. A missing server key returns500
  before protected database work or any Stripe API operation.
- Profile read failures return 503 with fixed safe copy. A missing/nonstring/blank profile id is 403.
  Database error contents are not forwarded through these read/save responses.
- Immediately after Stripe create/retrieve, the core confirms the own-profile account/flags save
  before requesting onboarding, account-update or Express dashboard links. Failed/unmatched saves
  return 503, never a success payload/link. Both `profile.id` and session `user_id` scope the update.
- The update additionally matches the exact previously read `stripe_connect_id` (`IS NULL` for null,
  exact string equality otherwise). This value is captured before the Stripe await separately from
  the trimmed retrieval id. A request losing the binding race cannot overwrite the winner or mint
  its link. A Stripe-retrieved id different from the stored requested id is rejected before writes.
- If link creation fails after the save, the next request resumes the recorded account. Response
  fields and normal status/no-link, dashboard fallback and Terms behavior remain as before.
  Payout handlers still return 503; this repair does not establish payout eligibility.

### Explicit identity/TIN evidence gap

Installed Stripe 22.6.2 source `cjs/resources/V2/Core/Accounts.d.ts` and `AccountPersons.d.ts`
exposes capability/onboarding/requirements information but no affirmative identity/TIN result fields.
Active transfers, no outstanding requirements or an ID-number type are insufficient proof. This
repair does not request identity/id-number fields, collect sensitive values, or invoke
`record_stripe_kyc` with inferred booleans. That existing RPC supersedes earlier current records and
inserts a new record on every call; submitting false/false on each status check would downgrade
existing verified evidence and append repeated pending history. The previously proposed automatic
KYC wiring remains open until CONNECT/Privacy/Finance validate an authoritative provider evidence
source and Backend designs snapshot preservation/deduplication. Stripe Identity remains disputes
only under the original owner decision; no new legal/processor conclusion is made here.

### Actual local verification and limits

The dual-runtime `apps/mobile/src/backend/api/moneyHandlers.test.ts` exercises actual core and
adapters using external Stripe/Supabase boundaries. Persistence regressions failed before the repair
(16 failed / 103 passed, including updated query assertions). Concurrent/replacement regressions
failed before the conditional save (6 failed / 121 passed, including query assertions). Current
focused result: 127 PASS, also independently executed by the Security/Finance/Data reviewer.
Final both-app typechecks PASS, full mobile suite 213 suites / 1,899 tests PASS (103.824s), and 12 scoped app
guards PASS. Source review accepted on 2026-10-20: core`83f0e7ecb9f0`, Node`8a9e19226a0c`,
Edge`f7e60bf9b0af`, tests`7338ee58d189` (SHA256 prefixes). Independent Documentation/Data source review accepted at 2026-10-20 20:42:40 UTC;
that reviewer ran no tests. Final receipts are recorded in STATE §4.

Limitations: local SDK/handler mocks do not prove deployed DB grants/triggers, Stripe permissions,
real account links, or user return behavior. An account created when its database save fails or has
an unknown response can still require provider reconciliation; no automatic provider idempotency
or orphan-account job is introduced. Conditional binding protection does not order separate status
snapshots for the same account. Hosted end-to-end/Finance acceptance and positive KYC evidence
remain open. Tests do not establish release readiness.

## 9. Connect client and profile freshness repair — 2026-10-20 (local app)

### Observed failures and bounded repair

The existing client combined profile and cache flags with Boolean/OR, retained local flags across
accounts, acquired busy only after an asynchronous Terms check, and applied late replies without
ownership checks. Shared AuthContext could publish old-account or reversed refresh results after
profile/team/local awaits and reinstall a delayed bootstrap/sign-in session. These failures were
reproduced through real hook/provider regressions with external Auth/Storage/Stripe boundaries.

- `useStripeConnect` keeps its four existing returned fields. A synchronous operation reference locks before
  the Terms await; a finishing old operation cannot unlock a new account's flight. Every async
  boundary checks its captured owner, epoch, operation and actual provider account-lifetime guard
  before cache/UI/refresh/browser/status/fallback/notice effects.
- Profile identity is `profile.user_id === session.user.id`, with the session and user required to
  agree. A profile's explicit boolean false beats local true. Legacy cache flags may fill absent
  profile fields only for the same Stripe binding; API-fresh flags may fill a currently unavailable
  profile. Cache cannot skip first-onboarding Terms. Malformed flags never become true by coercion.
- Missing-Edge fallback is preserved, with an ownership check before the HTTP replay. Both response
  paths reject explicit errors and require a nonblank account id and actual boolean status fields.
  A malformed otherwise successful Edge response reports failure rather than creating another request.
- Owner-keyed cache writes retain only the same account id and two status flags. Cache/refresh errors
  do not turn a server-confirmed link into an account-creation failure. Guest cache is not read.
- AuthContext clears/masks outgoing account data, keeps a per-load serial and session epoch through
  profile/query/team/local hydration, and ignores stale bootstrap/sign-in/redirect continuations.
  Its optional internal `isSessionCurrent` callback captures a separate memory account epoch, invalid
  immediately on ownership transitions even before a consumer render. Token refresh within the same
  account keeps that guard valid; native browser backgrounding is not treated as unmount.

Root owns Connect client/regressions and app docs; the actual `auth_profile_freshness` Codex worker
owns AuthContext/provider regressions. Security/Finance/Data source review and DOCUMENTATION review
are independent. No new table, RPC, cache key format, telemetry identity, policy collection, KYC
claim, live provider action or payout enabling. Existing provider behavior in §8 remains authoritative.

### Verification and practical limits

Initial Connect regressions: 17 expected failures / 1 preservation pass after harness cleanup.
Binding replacement, batched turnover and HTTP error regressions each failed before their correction.
AuthContext: initial ten race regressions failed; the account guard addition had two failures and 14
passes before correction. Final focused root result: 2 suites / 48 tests PASS (32 Connect, 16 AuthContext). Both app typechecks
and 12 scoped app guards PASS. Final full mobile suite: 215 suites / 1,947 tests PASS (81.253s).
The earlier full run overlapped the HTTP regression's RED phase (one failed / 1,946 passed); the
finished-copy run above passed. Independent Security/Finance/Data source review accepted at
2026-10-20 21:32:12 UTC; its earlier independent narrow run passed 47 before the small HTTP fix.
Final reviewed SHA256 prefixes: client`14b036035ec2`, client tests`7883f5d15c12`,
AuthContext`462ea66370fa`, provider tests`3d945ed1407c`. Root confirmed exact unchanged source hashes.
Final independent DOCUMENTATION/Data handoff accepted at 2026-10-20 21:35:48 UTC (actual Codex
reviewer; read-only source/documentation review, no tests or external actions). All requested
description corrections were applied before acceptance.

These tests do not verify real Stripe links, native browser return, deployed grants, live profile
reads or release readiness. Requests/browser/cache writes already started before an account switch
cannot be canceled retroactively; follow-up client effects are guarded and keys stay owner-bound.
The existing global `tapuai.athleteOnboarding` team cache still has no owner, so a fresh account without
a school may adopt that earlier local team; binding/migrating that cache requires its focused repair.
Other async profile/role/birth mutations remain outside this read/Connect repair. The pending
Connect flight is guarded by account lifetime, not canceled on a same-owner Stripe binding
replacement; cached/API-local rendering is binding-checked when a current profile exists. Same-account provider
status ordering, KYC evidence and provider orphan-account handling retain §8's open gaps. A token
captured before the Stripe browser may expire before the follow-up status call; normal token refresh
preserves the journey but does not add a server retry or prove real return behavior.

## 10. Google account to Stripe test bank preparation — 2026-10-21 (in progress)

The owner selected the existing development project with Stripe test mode for the walkthrough.
This extends the existing portal: sign-in and creation stay bank-free; an eligible adult athlete
uses their own account, while a guardian explicitly selects the athlete whose custodial account
they manage. Guardian consent remains draft: use synthetic internal fixtures, not real families.
No hosted database/provider change is authorized by this local implementation checkpoint.

### Implementation contract

- Existing `create-stripe-account` accepts optional UUID `playerId`. Live `getUser` determines the
  actor. Two service-only database functions derive the context and atomically save it; neither
  accepts a client-selected guardian/account destination. No new table, column or secret is added.
- Self context requires a recorded adult, open athlete profile and the applicable handover rules.
  Guardian context requires a recorded adult/open guardian, matching roster/custodial ownership,
  a verified, undisputed athlete, confirmed current guardian link and donations consent, current
  relationship evidence approved by two independent admins, and time before custodial handover.
  Bank preparation does not waive a money/compliance freeze or establish payout approval.
- Guardian bindings live only on the selected `custodial_accounts` row. Own-profile bindings are
  never a fallback. Save rechecks current eligibility after Stripe awaits, matches the captured
  profile and exact binding, prevents account reuse across contexts, and finishes before links.
- A first binding must not supersede unrelated existing KYC records. Replacement supersedes only
  records for the old nonnull provider reference; guardian changes retain relationship invalidation.
- Client reads/actions/Terms/browser returns are tied to account lifetime and selected athlete.
  Web bank navigation uses the validated Stripe portal URL; return routes accept only a bounded
  athlete identifier. The guardian view distinguishes custodial records, bank-name attestation,
  Stripe linking, provider capability status, and independent identity/relationship approval.
- Capability flags never invoke `record_stripe_kyc` or claim verified identity/TIN. Payouts remain
  503. Authoritative positive KYC evidence, balance verification and handover transfers remain open.

Signed-in configured client Terms reads require the current server timestamp/version; device-only
cache cannot waive acceptance. Writes must confirm the matching account, timestamp and version
before caching. The existing server first-bank gate still requires a nonnull acknowledgment
timestamp, without independently enforcing the current version; direct API callers retain that
historical policy limit. No new Terms text/version or server policy is introduced here.

### Ownership and verification status

Root owns server core/adapters, integration tests and app documentation/data inventory.
The actual Codex Backend/Data worker owns the new migration, canonical SQL append and replay;
the client worker owns Connect/guardian UI and return tests; the session worker owns custodial
and Terms hooks/regressions. These were actual Codex agents; no prescribed external model execution
is claimed. Local implementation and review are complete; hosted activation remains pending.

Executed local receipts (UTC 2026-10-21):

- Root final mobile run: **223 suites / 2,103 tests PASS** (114.837s),
  `/tmp/ala-account-bank-mobile-final.log`; both app TypeScript checks PASS.
- Root server/custodial/Terms focused run: **5 suites / 214 tests PASS**. Twelve scoped app guards
  PASS: documentation sync/links, copy, life bank SQL source, data boundaries, comments, feature-admin
  tests/check, data-map, agent registry, client credential markers and no-SSN source check.
  These are individual app checks, not a full `pnpm check` or a hosted release gate.
- Independent Security/Finance/Data source acceptance: server **02:25 UTC**, 161 handler and 53
  custodial/Terms checks PASS; final client/custodial/Terms **02:33:54 UTC**, **8 suites / 130 tests
  PASS**. Final review fixes require current Terms before guardian portal management and use the
  latest same-owner session token on native browser return. Reviewed source is bound below.
- Independent Documentation/Data executor `/root/photo_cleanup_review` accepted ONBOARDING and
  TESTER_SCRIPT at **02:30:31 UTC** with 288 local destinations and copy/whitespace checks PASS;
  no Jest execution claimed for that documentation review.
- New SQL replay parses, but execution is **NOT RUN**: local PostgreSQL startup fails OS `shmget`
  permission checks and an alternate engine download fails network permission checks. Single-session
  replay source is not evidence of concurrent locking correctness. Migration is written, not applied.
- Provider sign-in, Stripe portal/browser/native/device and real database walkthrough remain **UNRUN**.
  Payouts remain blocked; capability flags do not establish authoritative KYC evidence.

Selected frozen source SHA256 bindings (full receipts also retained in the worker review):

| File | SHA256 |
| --- | --- |
| `supabase/functions/_shared/money/connect.ts` | `d1ddbe29f9982a635d87f84b55d34fb4b0f6c74ad5279219acdcb46de4c280bd` |
| `supabase/functions/create-stripe-account/index.ts` | `45637295b52c244c32fe8dfd6e2786c0f4e17b7e27932cc6bee65cd1df2ea375` |
| `apps/mobile/src/backend/api/createStripeAccount.ts` | `7469654b29c0580bf09f749ee69ee214a237ef67bd4de3cca3d0cd0bc9b93709` |
| `supabase/migrations/20261021120000_connect_account_context.sql` | `e8878b77feef016f35846eaaf90933e22f63b9fede524e398ecb8d0c44726a61` |
| `hooks/useStripeConnect.ts` (frontend) | `ba96e700cc3084131357a33fb044b1005dc41a14c14b24b5c05fc62e389632fc` |
| `components/Profile/PayoutSetupCard.tsx` (frontend) | `bba87001541a3f27ee22f522015079c213fe8a761a1ccf501e6f505997af195e` |
| `components/Custodial/GuardianCustodialCard.tsx` (frontend) | `5277a2d930c8b1efe2d85836b45af291148744c4cf797e6a3806925e347e0e5a` |
| `apps/mobile/app/stripe-connect.tsx` | `431f7671090051484cf073fa9509ca00fb52eb04b15525b0413352f938439a1e` |
| `lib/legal.ts` (frontend) | `87989e8fcf0fb3e003e5198470b8646b03cd769e68755fa9f19a735a465bc3c3` |

Read-only local configuration inspection found a public Stripe test key and a private Stripe test
secret file; that file lacks a service-role key and webhook secret. Attempts to fetch development
Auth settings were blocked by OS network permissions, including an automatically accepted escalation.
Current Google provider/redirect configuration and hosted migration state remain unverified.
