# Verifying people who receive donations: SSN, identity and legal guardians (VERIFY-02, plan)

**Owner question (2026-10-14):** a legal parent and an athlete should both be legally verified; earners of donations
should give their Social Security number. How do we verify that, and how are we accountable for it?

**Panel** (owner → CTO → leads): CONNECT, COMMERCE, CUSTODIAL, SECURITY, PRIVACY_ENGINEERING, LEGAL, INFO_RETURNS, TAX,
ATHLETE_VERIFICATION. It builds on [VERIFICATION_AND_SAFE_GROWTH_REVIEW](../../legal/VERIFICATION_AND_SAFE_GROWTH_REVIEW.md)
and [MINOR_ACCOUNTS_DESIGN](MINOR_ACCOUNTS_DESIGN.md). Internet mode was off: every Stripe capability, price and law
below is **unverified, from memory**. This is not legal or tax advice. Status: **owner decided 2026-10-14 (§7: all four recommendations); local build `20261014120000_payee_verification.sql` (VERIFY-02), not applied.**

## 1. What the code does today (found by the panel)

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
