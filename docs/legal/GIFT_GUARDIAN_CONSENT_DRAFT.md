<!-- Proposed guardian text stays separate so old signatures cannot be relabeled as consent to changed terms. -->
# Guardian gift consent — proposed replacement

**Counsel drafting options, 2026-10-22. Not accepted text or permission to use with families.**
This document changes no client, SQL, permission or signed record. LEGAL routes final text;
Minor Safety, Privacy and Custodial review with counsel; owner chooses the lawful business
model and approves publication. See [counsel packet](GIFT_RELEASE_COUNSEL_PACKET.md) G-01–G-04,
[Terms proposals](GIFT_DONATION_TIP_TERMS_DRAFT.md) and [MINOR-01 design](../engineering/design/MINOR_ACCOUNTS_DESIGN.md).

## 1. Frozen baseline — preserve exactly

| Field | Current accepted testing draft |
| --- | --- |
| Client file | `apps/mobile/src/frontend/data/guardianConsent.ts` |
| Version | `2026-10-14-draft` |
| Template SHA-256 | `f39f7c23538fcf209fb368bd56f16250ba685cd7c3a4bf23d94be19cea0caa0f` |
| Matching server contract | `guardian_consent_form_version()` / `guardian_consent_form_sha256()` in `20261014110000_minor_accounts.sql` |
| Template construction | Clause order; each `title: body`, joined by one newline; `{teen}` remains literal for hashing |

The existing testing draft says donations/10% and promises payout approval/handover that still
needs legal and payment resolution. Its source header prohibits real-family use. Exact template
hash was independently recomputed during this review and matched client/server literals.
That match proves source consistency only; it does not establish lawful electronic consent,
real guardian identity, hosted acceptance or permission to publish the form.

## 2. Proposed clauses — counsel selects and finalizes

`{teen}` is a display placeholder. The language below is an editable proposal, not a template
already assigned a version/hash. Bracketed fields and alternatives must be resolved before
creating any executable consent text. Public visibility and money authority remain separate
choices; no preselected consent or blanket commercial/media-rights grant is proposed.

### Who is signing

> I am {teen}'s parent or legal guardian, am at least 18, and have authority to grant the
> permissions I select. I understand that my account identity and my legal authority for
> {teen} are separate checks. I intend the full name I enter to be my electronic signature
> for this form and its selected permissions.

Counsel decides electronic-record/signature consent, access to a copy, withdrawal methods,
identity/relationship proof, custody-conflict handling and state-specific adult capacity.
Typed name, invitation and school badge alone do not prove legal guardianship.

### What I allow — independent selections

**Public-profile permission:**

> I allow {teen} to make the profile and content covered by this permission visible to
> Everyone, including adults, subject to the privacy and safety controls described to us.
> Before selecting this permission, I can review which profile fields and content may be
> public and which existing roster or third-party content is outside this permission.

**Family money permission:**

> If I am the approved guardian on record for {teen}'s family payment account, I allow
> eligible personal gifts for {teen} to be handled under the separately disclosed family
> payment terms. This permission does not itself enable a payout, select a bank account
> or approve a paid performance, endorsement, Subscription or Purchase.

Privacy/Content Rights must supply actual field/media/roster scope and public exceptions;
one public-profile checkbox cannot claim removal of independent lawful third-party material.
Custodial/Connect must reconcile collection, holding and payout eligibility separately.
Counsel must decide whether gifts may be accepted while this permission is absent or stale,
the pending cap/refund deadline and what happens to existing balances.

### Money rules — fixed no-cut direction, unresolved expense/rail terms

**Proposed common clause:**

> A Gift is voluntary personal support for {teen}'s sports costs, such as fees, gear and
> travel. Tapua'i takes no platform share of a Gift and records its full gross amount for
> {teen}'s family. An optional Tip Tapua'i and optional processing-cost contribution are
> separate from the Gift and are not required. Gifts to individual athletes are personal
> gifts and are not tax-deductible.

**Required tax notice, exact in the final form:**

> Gifts to individual athletes are personal gifts and are not tax-deductible.

**Choose one processing clause after actual expense responsibility is approved:**

- **F-A:** “Tapua'i bears actual processing costs not covered by the giver's optional
  contribution, as described in the family payment terms.”
- **F-B:** “Actual processing costs disclosed in the family payment terms may reduce the
  net amount the family receives; Tapua'i takes no platform share. The optional processing
  contribution is an estimate toward those costs.”

**Payout/handover clause — draft only after mechanics and state age are resolved:**

> Money may be paid out only after the required verification, available-balance checks
> and approvals described in the family payment terms. [Describe the athlete's separate
> approval for each withdrawal and its actual enforcement.] Control transfers at
> [counsel-approved age for the applicable state] through [approved provider/account
> process], subject to [specific restrictions and notices].

The existing promise of automatic control at 18 is not final; Utah 21/UTMA, chosen custodial
structure, provider contracts and actual transfer mechanics remain counsel/Treasury decisions.
Blocked payouts do not implement these promises. Identify actual payee/TIN/reporting,
available versus held balance, reserves, refunds/disputes and settlement timing in the linked
terms. Current Vault 80% earnings are a separate Purchase issue, not evidence of family credit.

### What I see

> While our confirmed link is active, I can see {teen}'s privacy settings, safety counts
> and changes recorded after we linked, as described in the supervision screen. I do not
> see the identities of friends through that screen. {teen} can see what that supervision
> screen shares with me. The separate age-specific approval rules shown to us apply to
> making a profile public and allowing friend requests.

Counsel/Minor Safety must select the lawful age/action rules; the current under-16 public/open
friend-request approval is source behavior, not an all-state legal conclusion. Privacy must
verify the statement against actual reads and independent guardian visibility.

### Ending this

> Either of us can request the end of our link, and I can withdraw a selected permission
> using [verified account path] or [approved support path]. The app explains the changes
> to profile visibility and future payout eligibility. Withdrawal does not rewrite earlier
> signed records or completed transactions. Existing money, legal retention, other lawful
> publication and another guardian's authority are handled under the disclosed rules.

Counsel selects effect/time of withdrawal, competing guardian permissions and custody-dispute
review. Engineering must verify those effects; do not promise universal deletion, instant
reversal, all profiles private or a payout release that the actual controls cannot perform.

### Records

> I can access a copy of the form I signed, its version, selected permissions and signing
> time through [verified copy/export path]. Tapua'i retains consent and payment records
> for [approved periods and legal bases], under the Privacy Policy. Account deletion or
> withdrawal may leave the limited records required for those purposes; the policy
> explains which records remain and how to request access or correction.

Counsel/Data/Privacy approve concrete retention, minor tolling, actor access, deletion/erasure
and provider scope. “For the period the law requires” is not an implemented retention schedule;
a new paragraph cannot establish account export/deletion or durable copies that are unverified.

### Optional media/rights clarification — separate authority required

> Public-profile or family-money permission does not transfer ownership of {teen}'s
> content or approve every person's image, school mark, music, advertisement or endorsement.
> Any separate rights permission must identify its content, purpose and scope.

CONTENT_RIGHTS/counsel must reconcile upload licenses and minor contract rights with actual
Terms. Existing [IP plan](IP_PROTECTION_PLAN.md) owns copyright/license/disclosure questions;
this clause is not an assignment or patent/copyright determination.

## 3. Required approval record before versioning

| Required field | Record |
| --- | --- |
| Final entity, jurisdictions and permitted age/action scope | `[pending counsel/owner]` |
| Exact approved clauses; F-A/F-B; payout/custody/handover terms | `[pending counsel/Finance/Minor]` |
| E-signature, guardian evidence, public scope and withdrawal decision | `[pending counsel/Privacy/Safety]` |
| Retention/copy/export/provider rules and approved Privacy/Terms | `[pending Data/Privacy/counsel]` |
| Final release version and SHA-256 of exact template | `[not selected; no executable replacement]` |
| Counsel reviewer/date/reference and source/build reviewed | `[pending]` |
| Domain acceptance, CTO recommendation and owner publication approval | `[pending]` |

## 4. Version, acknowledgment and rollout requirements

1. Freeze the counsel-approved wording and clause order, including actual permission scope.
   Assign a new immutable release version. Hash the exact template, not personalized display
   text or this Markdown. Keep the old draft/template/records available as historical evidence.
2. Add a **new** migration updating the server version/hash contract and any required stale
   consent/permission gates. Never edit the applied minor migration. Copy new SQL to canonical
   schema; register changed functions/columns/retention under Data Governance and regenerate
   the map. Counsel/Security review authoritative server actor/time and record protection.
3. Agree the treatment of every prior version before migration: testing consent does not
   authorize live money/public release. Define affected actions, notice, grace/hold policy,
   balances/refunds, old-client behavior and re-ack separately for public and payout permission.
   Changing the signing contract alone does not invalidate old active permissions at every gate.
4. Update the client text/version/hash and current Terms acknowledgment together. Re-ack
   requires an authenticated authorized guardian to review/sign the new exact form, with teen
   confirmation/assent where the approved contract requires it. Do not auto-select permissions,
   auto-sign, silently migrate signatures or transform old donation/10% records into gift/0% consent.
5. Preserve prior signed form/version/hash/actor/time and revocation history; insert a new
   signed record with its actual server time. Existing `record_guardian_consent` revokes prior
   active records as `signed_again`; prove the final multi-guardian/permission behavior and
   access/copy/retention rather than assuming that path completes the new policy.
6. Stage the authorized server/client rollout with current build and schema evidence. Test
   stale/mismatched clients and rollbacks; old clients must get an understandable refresh/hold
   path. Rollback must not reinterpret a newer signature as agreement to earlier terms.
7. Record actual authorized hosted application/readback, device/browser behavior and independent
   Legal/Finance/Minor/Privacy/Security/QA acceptance before any real-family publication.

### Required verification cases — planned, not executed here

- Exact template hash/client/server match; any changed character/order fails old-hash signing.
- Old/draft version and mismatched hash denied; current version accepted only by authorized
  adult/linked guardian; wrong actor and non-guardian money authority denied.
- Separate permissions survive partial selection; decline/withdraw/stale consent changes only
  the approved actions; competing guardian and custody-conflict rules verified.
- Current-consent enforcement at public visibility, collection/hold, Connect and payout gates;
  under-age/unknown-age and teen-confirmation paths; no stale cached client bypass.
- Re-sign preserves original records and adds actual actor/time/version; historical copy is
  accurate and accessible only to authorized actors; no blanket erasure/retention claim.
- OFF/ON extras do not change gift 0/100 allocation or consent scope; quote/paid-record changes
  do not relabel history; payout approval/handover tested only after actual implementation.
- Hosted schema and installed build agree; readable refresh/withdraw/copy flows verified on
  real devices and approved web surfaces; support repair evidence and missing sensors explicit.

This review verifies the frozen **source** hash and prepares the replacement/rollout questions.
It executes none of these future release tests and grants no hosted, legal or payment authority.
