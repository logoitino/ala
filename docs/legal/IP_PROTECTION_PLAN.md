<!-- Internal IP preparation process; source evidence and proposals do not establish legal rights or filings. -->
# Tapua'i intellectual property preparation plan

**Record date:** 2026-10-22. **Workstream:** [IP-01](../agents/IP-01.md).
**Status:** internal preparation; counsel engagement, ownership verification and filing decisions
are not recorded. **Reading audience:** owner, authorized Engineering/Documentation and retained counsel.

The owner reports that no source, demo, deck or app version has been made public as of
2026-10-22. Keep this dated statement; verify sharing, offers, sales, distribution and earlier
events with counsel. It is not proof of repository privacy or absence of prior art.

## 1. Deliverable and scope

Maintain one [counsel packet](IP_COUNSEL_PACKET.md), generated from the
[IP register](ip-register.json), with technical candidates, source fingerprints, rights gaps,
disclosure history, counsel questions and recorded decisions. This is an intake and evidence
document, not a patent application, copyright filing, legal opinion or signed agreement.
Counsel determines the legally required forms, claims, deposit materials and signatures.

Source-code copyright, patentable technical methods, ornamental GUI design, brand marks and
trade secrets have separate requirements. Protect eligible original expression; investigate
qualifying inventions; obtain trademark clearance; decide which know-how should remain secret.
Patent publication can disclose technical details, so counsel chooses compatible protections.

US-first is a planning assumption, not a jurisdiction decision. Counsel must evaluate intended
markets and disclosure/filing rules in every relevant country. Do not postpone a time-sensitive
priority decision while company formation or trademark work proceeds.

## 2. Responsibilities and authority

| Owner | Responsibility | Acceptance evidence |
| --- | --- | --- |
| Owner / FACILITATOR | Choose counsel, jurisdictions, commercial priorities, budget and sharing/filing decisions | Dated owner decisions with approved scope |
| LEGAL → CTO | Coordinate intake, counsel questions and verbatim supplied decisions; retain existing approved-copy limits | Counsel/source reference, date and outstanding questions |
| DOCUMENTATION → ENGINEERING | Maintain factual register and packet on each relevant change; reconcile source drift and supplied evidence | Actual executor, source binding, commands/results and next owner in IP-01 |
| CTO / source feature owners | Explain mechanisms, alternatives, implementation boundaries and experiments; identify human contributions | Versioned disclosure and scoped engineering review |
| CONTENT_RIGHTS / COMPLIANCE with Security | Review supplied provenance, licenses, confidentiality and safe handoff scope | Dated domain review; unknown rights stay unknown |
| Retained registered software patent attorney | Eligibility, novelty/non-obviousness, claims, inventorship, search strategy and patent filings | Counsel's actual written advice and filing receipts |
| Copyright / trademark counsel | Authorship, ownership, registration/deposit, clearance, classes, use basis and assignments | Actual advice, approved materials and receipts |

No new reporting lead or staffed legal department is established. Existing callable agent
definitions are maintenance contracts. Automatic scripts update factual evidence; they do not
engage attorneys, sign agreements, claim privilege, purchase services or make legal decisions.

## 3. Staged work and completion evidence

| Stage | Work | Exit evidence / next decision |
| --- | --- | --- |
| A — Confidential baseline | Review actual repository/provider access and sharing history; inventory people, code, assets and AI involvement | Owner disclosure log and authorized access review; record gaps |
| B — Ownership and technical disclosures | Complete each disclosure below; identify license/assignment gaps and evidence of human contributions | Feature owner reviews exact source fingerprint; rights checklist has a record for each material category |
| C — Counsel intake | Owner retains suitable counsel and approves a scoped packet; counsel reviews jurisdictions, searches and ownership | Engagement and actual intake review recorded; no automatic outside delivery |
| D — Protection decision | Assess each candidate's patent fit/value, copyright scope, trademarks and secret/public choices; separate freedom-to-operate from patentability | Written counsel recommendation, costs/deadlines and owner adopt/revise/decline decision |
| E — Approved preparation and filing | Counsel prepares claims/forms/assignments/deposit; owner approves costs/materials; authorized party files | Official receipt, verified applicant/inventors/authors/assignee and counsel-docketed deadlines |
| F — Continuing maintenance | Review new source, contributors, disclosures, brand changes, offices' correspondence and renewal/response requirements | Dated reviews and actual receipts; changed evidence flags revalidation |

Suggested first cycle: inventory during the first week, then counsel intake when the strongest
disclosures are sufficiently complete. Actual counsel availability and legal deadlines govern;
do not wait for an arbitrary development milestone to ask about disclosure risk.

## 4. Invention disclosure content

The register seeds three investigation candidates, not findings of novelty. Ordinary maps,
sport profiles, navigation, payments and existing access-control patterns require a specific
inventive technical contribution before any patent case is assumed. A combination needs its
own analysis; a new product label alone is not a technical invention.

For every candidate collect:

1. ID/title, feature owner, exact source paths and current fingerprint.
2. Problem, affected users and observed evidence or explicitly hypothetical failure.
3. Baseline and known alternatives, including prior systems/publications with dated citations.
4. Proposed technical distinction, ordered steps, inputs/outputs, state and diagram. Label
   implementation observations, proposed alternatives and uncertain claims separately.
5. Variations and failure cases: offline/reconnect, permission changes, duplicates, denied actors,
   rollback and alternate providers as applicable.
6. Actual experiments/results, commands/date/environment and limits. Existing tests linked in
   the packet are reading references until executed evidence is supplied and reviewed.
7. Human contributors' specific conception/implementation work, dates, employment/contract
   context and any AI assistance. Do not infer inventors or authors from Git authors or AI outputs.
8. Third-party dependencies/content and ownership documents; proposed patent/secret boundaries.
9. Earlier disclosures, confidentiality terms, sales/offers, demos and intended launch dates.
10. Questions for counsel; engineering review bound to the fingerprint; actual counsel/owner decisions.

Use the three populated register records as the disclosure structure. Engineering completes
unknowns using observed behavior, not guessed novelty, inventorship or performance.

## 5. Copyright and ownership preparation

Inventory original code, art, text, audio/video, documentation and GUI assets separately.
For each: record creator/human-authored contribution, creation/publication dates, version,
employment/contract basis, signed assignment/license reference and restrictions. Identify
AI-generated versus human-authored or human-modified material for counsel's analysis.

The package manifests are a dependency inventory only. Audit direct and transitive licenses,
notices, copyleft obligations, upstream patches, provider SDK terms, fonts/icons and copied
examples. Repository possession and package installation do not prove company ownership.
School marks, footage, music and user uploads are not automatically company IP.

Copyright counsel selects eligible works, registration grouping, author/claimant, publication
status, treatment of excluded material, deposit requirements and any permitted trade-secret
redaction. Do not send full source or sensitive material to a registry without reviewed scope.
Signed assignments and personal author/contributor records belong in an approved private
store; the repo register holds only a non-sensitive reference and verification status.

## 6. Patent, design, trademark and trade-secret questions

- **Utility patents:** what precise mechanism is potentially eligible/new/non-obvious, how can
  it be claimed, what evidence supports it, and what is the commercial enforcement value?
  Prior-art research and freedom-to-operate are separate scopes and reports.
- **Provisional strategy:** counsel decides whether a sufficiently enabling disclosure is useful,
  what it supports and the applicable follow-up/foreign deadlines. A provisional is not a grant;
  the usual 12-month follow-up window must be docketed by counsel for actual filings.
- **Inventorship/ownership:** identify qualifying human inventors, applicant/assignee and signed
  assignments under current guidance, including AI-assisted work. Formation timing must not
  silently delay a priority decision.
- **Design patents:** assess original ornamental GUI appearance and drawings, relevant articles,
  prior designs and timing. Standard icons/layout conventions are not presumed protectable.
- **Trademarks:** clear the actual word mark/logo, relevant markets/classes and filing basis.
  A domain or LLC name is not trademark clearance. School/provider marks retain their owners.
- **Trade secrets:** identify selected non-public know-how, access controls, confidentiality terms,
  approved recipients and separation from details counsel decides to publish in patents.

No search, clearance, patentability opinion or ownership determination has been performed by
this local tooling. Counsel verifies current agency guidance and specific deadlines.

## 7. Disclosure and deadline records

Keep append-only records for actual disclosures, decisions and filing milestones; corrections
reference earlier records instead of deleting history. Record date, event kind, authorized
audience/scope, confidentiality evidence and counsel's follow-up. Keep personal contacts,
legal correspondence and agreements in the approved private store, with references here.

Record each actual filing's type, jurisdiction, application/receipt reference, filing date,
applicant/assignee, relevant contributors and counsel-controlled deadlines. Agent reminders
and a JSON due date are not a staffed legal docket or evidence a deadline was met.
Only an actual filing supports a scoped 'patent pending' statement; only an actual grant
supports a corresponding patent claim. Counsel approves public wording and marked scope.

## 8. Documentation automation and agent contract

`pnpm ip:sync` deterministically refreshes the counsel packet from the reviewed input register
and safe source hashes. `pnpm ip:check` verifies currency and structure without changing files.
`pnpm ip:test` checks source drift, preserved decisions, safe inputs and error behavior.

The monitored inventory is version-controlled and non-ignored untracked source under `apps/`,
`packages/`, `supabase/`, plus explicit package/lock manifests. Only approved source extensions
are hashed; environment files, runtime data, media, archives, dependencies/build outputs and
symlinks are excluded or rejected. The packet contains paths/hashes and manually supplied
descriptions, never automatically copied source, database records or credentials.

Specific candidate references have their own digest. A broader inventory digest detects new
source outside those references, but cannot infer a new invention or a behavior change's legal
meaning. DOCUMENTATION reviews scope changes with the feature owner and adds/updates candidates
or rights gaps in the same turn. A review is current only against its exact recorded digest;
changed bytes display a stale review. Historical reviews/decisions remain unchanged.

Triggers:

- `pnpm check`: refresh, then validate/test the packet before the existing full project gates.
- Claude `Stop`: run the local refresh/check hook. Failure reports a repair request; repeat Stop
  does not loop indefinitely. This hook runs only in Claude with the installed configuration.
- CI: read-only freshness/regression checks; stale committed content fails and requires a local refresh.
- Codex/Cursor: same-turn agent instructions and `pnpm check`; no idle paid AI worker is installed.

Automatic facts do not close missing licenses, inventor/author records, counsel decisions or
filing receipts. Unregistered capabilities and ignored/excluded files require human review.
Missing source/invalid input fails explicitly and keeps the previous packet intact. Repair the
input/source, rerun sync/check and record the actual result; do not suppress the missing evidence.

## 9. Safe presentation and handoff checklist

- [ ] Owner-approved access/storage and recipient scope verified; repo filename does not make material private.
- [ ] Packet freshly generated and source versions frozen for this handoff.
- [ ] Feature owners reviewed mechanisms, baseline/alternatives and actual test evidence.
- [ ] Human contributions, assignments, licenses and excluded material reviewed with counsel.
- [ ] Disclosure log checked and intended public launch/distribution dates supplied.
- [ ] Counsel reviewed protection/search options and recorded open questions/deadlines.
- [ ] Owner approved materials, jurisdictions, recipient and costs; sharing approval recorded.
- [ ] Each filing claim has an actual receipt; pending/unknown items remain visible.

Before sharing, place the approved subset in the private legal home described in
[CODE_ORGANIZATION_PLAN](../engineering/CODE_ORGANIZATION_PLAN.md). Internal docs and source
recovery packages can contain restricted information; review recipients/materials, remove
credentials/customer/minor data and use controlled transfer. No automated email or public export.
An internal 'confidential' label neither enforces access nor establishes attorney-client privilege.

## 10. Maintenance and source reading path

On code/dependency/asset/AI-contributor/disclosure changes: DOCUMENTATION updates the register,
feature owner checks technical meaning, LEGAL routes counsel questions, then actual reviews
and owner decisions are recorded. On counsel correspondence or filing receipts: preserve
supplied text, source/date/reference, and docket through counsel. Before every public demo or
handoff: repeat the checklist and revalidate stale evidence. Monthly: owner/LEGAL review all
open items and deadlines; this cadence is an assignment, not proof a scheduled review ran.

Read [STATE](../STATE.md), [architecture](../engineering/ARCHITECTURE.md),
[data ownership](../engineering/DATA_MAP.md), [innovation handoff](../engineering/INNOVATION_AND_HANDOFF.md),
[Legal briefing](LEGAL_BRIEFING.md) and [company phases](../company/COMPANY_PHASES.md).
This IP work does not close the app's minors, privacy, payment or public-launch legal gates.
