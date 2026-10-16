# VERIFY-02 admin-ready and app-ready evidence (2026-10-14)

Feature: payee verification. Covers who may receive an athlete's donations and how they were verified, with SSNs going
to Stripe only, plus the two-admin payout override. Plan and owner decisions:
[PAYEE_VERIFICATION_PLAN.md](../design/PAYEE_VERIFICATION_PLAN.md).

## What was built

- **Source:** `supabase/migrations/20261014120000_payee_verification.sql` (written, **not applied anywhere**), copied
  onto `schema.sql`.
  - **Tables:** append-only `payee_verifications` (no delete or truncate, even by the server) and
    `payout_flag_overrides`.
  - **SSN guard in the database:** `looks_like_ssn()` sits in the CHECK constraints and the RPC messages.
  - **Payee:** `payee_for_player` returns the payee and the account that would be paid.
  - **Payout gate:** `athlete_payout_status` reason `needs_payee_verification`.
  - **Stripe results:** `record_stripe_kyc` is server only.
  - **Payout flags:** the guard allows changes only from the server or from an override approved by an independent
    second admin.
  - **Re-verification:** supersede triggers fire when the guardian on record or the Connect account changes.
- **Admin:** People desk → Privacy & safety → `PayeeReport` (counts) and `PayeeVerificationPanel` for each person:
  - what each payee still needs, plus the check history (never an SSN; documents not kept);
  - record the school's parent confirmation or a document review (never about yourself), with a second admin
    confirming;
  - revoke a check;
  - request or decide an override; there is no button for your own request.
- **App:**
  - Payout hold copy for `needs_payee_verification` (`data/verification.ts`, `AthleteVerificationCard`).
  - Telemetry strips SSN-shaped text (`lib/redact.ts`, `TelemetryManager`).
- **Guard:** `pnpm security:no-ssn` (`scripts/check-no-ssn.mjs`) in `pnpm check` and CI fails on SSN or tax-id fields
  and on SSN-shaped literals in code.
- **Disable / repair:** payouts stay blocked (503) regardless. An admin can revoke a check, and an override needs two
  independent admins. The checks protect money, so there is no switch that loosens them.

## Checks run (Node 24.21.0, this Mac, 2026-10-14 ≈05:34 UTC)

| Command | Result |
| --- | --- |
| `node scripts/replay/schema-replay.mjs /tmp/books01-pg/pkg/package/dist` | 111/111 on PGlite (Postgres 18.6). 11 of the checks are VERIFY-02. They cover: an adult paid only after Stripe identity + TIN; no SSN storable (SSN-shaped text, non-Stripe references, readable RPC refusal); a guardian payee needing identity plus a two-admin relationship check, with a new guardian starting over; no direct admin flag write; overrides needing a reason and an independent second admin; server-only, append-only records; the second-admin rule and revoke; no self-checks; no minor as their own payee; the payee owning the account being paid; the beneficiary unable to approve; SSN-filter forms; no delete, truncate or rewrite. |
| `cd apps/mobile && ../../node_modules/.bin/jest --watchman=false PayeeVerificationPanel payeeVerification redact TelemetryManager` | passed |
| `pnpm check` | exit 0: 129 suites / 914 tests and every guard, including `security:no-ssn` |

## Reviews

- **Panel** (CONNECT, COMMERCE, CUSTODIAL, SECURITY, PRIVACY_ENGINEERING, LEGAL, INFO_RETURNS, TAX,
  ATHLETE_VERIFICATION): recommendation → owner decided all four items (2026-10-14).
- **RLS_SECURITY** with CONNECT and CUSTODIAL: changes needed (3 P1, 2 P2, 3 P3) → all applied and covered by replay
  checks. Not re-reviewed after the fixes.

## Not verified and follow-ups

- **Hosted / Stripe:** no hosted database, no Stripe dashboard, and no real `account.updated` webhook.
  `create-stripe-account` still has to call `record_stripe_kyc` (CONNECT).
- **Payouts:** `createPayout.ts` must pay `payee_for_player`'s account before payouts are unblocked (CONNECT).
- **Unverified Stripe behaviour:** Stripe's TIN-match and account-holder age rules (owner + CONNECT with Stripe).
- **Counsel and CPA:** document-review handling and retention (LEGAL row AA); whose TIN goes on the 1099-K (CPA).
- **Audit:** `custodial_accounts` and the two new tables are not yet in the support audit trigger's scope (THREAT_DETECTION).
- **School confirmation:** confirmation of a parent through the school's own confirmer link is still entered by an admin
  after the AD confirms. A direct school-form path is ATHLETE_VERIFICATION's follow-up.
