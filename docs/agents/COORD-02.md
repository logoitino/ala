<!-- Current gift release coordination preserves source, counsel and deployment acceptance as separate records. -->
# COORD-02 — Gift release and whole-team handoff

**Record date:** 2026-10-22. **Owner instruction:** finish the remaining documentation and update
the whole team. **Source base:** `codex/tip-model`, checkout commit `4c54606` after source/admin
`e9da05f` and copy-only `5a95152`. This packet is the current reading path; dated COORD-01
receipts remain history. Updating role instructions does not execute those roles or contact people.

## 1. Current contract

- Individual athlete/family support: **Gift**, **Give**, **Send a gift**.
- Program/club charitable support: **Donation**, **Donate to the program**. Web-only checkout
  is the required model; its implementation/availability remains unestablished. Existing paid
  booster placement is not evidence of that charitable capability.
- Platform support: **Tip Tapua'i (optional)**; separate **Cover the processing fee**.
- Premium: **Subscription**; one-time digital extras: **Purchase**, separate from giving.
- Zero platform cut from new personal gifts in both flag states. The default-OFF
  `buttons.MONETIZATION_TIPS_ENABLED` gates optional extras and their copy, not the no-cut rate.
  Full gross family liability is locally verified; actual processing and settlement are not.
- Keep internal identifiers, posted financial history and signed consent versions intact.
  Older donation-everywhere, 90/10 and “Donate. Elevate. Celebrate.” instructions are superseded.

## 2. Read and act in this order

| Order | Primary owner / required partners | Concrete work and acceptance |
| --- | --- | --- |
| 1 — Source and copy | COMMERCE; VOICE, QA, DOCUMENTATION | Use the [copy report](../engineering/evidence/GIFT_LANGUAGE_REPORT.md), [string table](../engineering/evidence/GIFT_CHECKOUT_STRINGS.md), [residual audit](../engineering/evidence/GIFT_CHECKOUT_RESIDUALS.md) and [model report](../engineering/evidence/TIP_MODEL_REPORT.md). Review each current surface and raw internal-key exception; never reintroduce the cut. |
| 2 — Legal classification | LEGAL; COMPLIANCE, CONTENT_RIGHTS, Finance, owner and retained counsel | Review the [counsel packet](../legal/GIFT_RELEASE_COUNSEL_PACKET.md), [guardian draft](../legal/GIFT_GUARDIAN_CONSENT_DRAFT.md), [Terms draft](../legal/GIFT_DONATION_TIP_TERMS_DRAFT.md) and [store draft](../product/APP_STORE_GIFT_DRAFT.md). Record actual decisions on gift-linked Aura, processing claims, guardian versions, booster placement and shared refund wording. Draft preparation is not approval. |
| 3 — Technical rollout | BACKEND; DATABASE_MIGRATIONS, COMMERCE, QA, Security, Data, Infrastructure and Recovery owners | Execute the [rollout runbook](../engineering/GIFT_TIP_ROLLOUT.md) only against a confirmed target and reviewed prerequisite chain. Retain backup/parity, applied schema/source bindings, old-client and concurrent payment evidence. Keep extras OFF and payouts blocked until their actual gates pass. |
| 4 — Accounting/provider proof | RECONCILIATION; LEDGER, Finance, COST_OPERATIONS, payouts owner and payments counsel | Match synthetic gift, tip and cover separately to the provider charge, actual processing fee, original refund allocation and family net. Resolve Connect/item8; local liability tests do not prove transfer or bank settlement. Missing closed rows require reviewed repair. |
| 5 — Data and support | DATA_GOVERNANCE; SUPPORT, THREAT_DETECTION, PRIVACY_ENGINEERING and source owners | Choose abandoned-quote expiry/quota and retention/erasure rules before adding new controls. Preserve issued/paid quotes, original financial records and notification authority. Record missing runtime sensors and paid-but-unsaved repair evidence. |
| 6 — Release and presentation | CTO; QA, MARKETING, LEGAL, DOCUMENTATION and owner | Bind the final build/commit to completed decisions and actual hosted/native evidence. Owner submits the store listing and approves release/sharing. Existing IP packet remains internal until its separate owner/counsel gates pass. |

Existing reporting chains and model pins stay in force. The complete role-specific handoff is
in [.claude/agents](../../.claude/agents), its [registry](../../.claude/agents/registry.json),
[TEAM_STATUS](TEAM_STATUS.md) and [WORK_QUEUE](WORK_QUEUE.md). No unattended paid agent,
provider monitor, outside delivery, counsel engagement or filing is established here.

## 3. Actual execution and ownership

| Work | Actual executor | Exclusive document ownership | Status |
| --- | --- | --- | --- |
| Integration, current entry points and read-only connector checks | Root Codex | COORD-02, STATE, README, CHANGELOG, glossary/onboarding/tester/company/legal status links and final check/source receipts | Complete locally; final receipt below |
| Whole-team role/duty reconciliation | Codex `/root/team_gift_alignment` | 115 role definitions, descriptive registry handoffs and declared team operating documents | Complete:115/115 handoffs; pins/reporting protected |
| Counsel-ready draft preparation | Codex `/root/gift_legal_packet` | New counsel/guardian packets and existing Terms/store drafts | Complete draft preparation; legal decisions remain open |
| Rollout and dependency preparation | Codex `/root/gift_rollout_packet` | Rollout runbook and scoped preflight evidence | Complete local packet/replay; hosted writes remain unperformed |

Actual executors are outside-session Codex workers. Repository roles specify another pinned
runtime; this record does not claim those specialists or retained counsel reviewed the work.

## 4. Read-only environment findings

Checked via authenticated Supabase MCP on 2026-10-22: development
`ulfapgtabidorgwfjvwz` has 74 migration records; staging `tucioqipfejqqqtuakdi` has 27.
Both latest records are `20261022140000`; the no-cut/tip migration `20261022152000` is absent.
Catalog reads find `app_runtime_config`, but no `notification_payment_contexts`,
`monetization_tips_enabled()`, exact
`prepare_tip_payment_context(uuid,uuid,bigint,boolean,numeric)` or named payment-context guard.
An earlier integer-signature probe was replaced by this exact-signature check.

Deployed checkout metadata: development version1, staging version2, JWT verification enabled;
their bundle SHA-256 is `944d7502bd23ce469ab0632cb4376dc933bbca2b2ebfb62b59652e942adddee3`.
Contents were not read, and version metadata does not establish behavior or source parity.
These findings identify missing prerequisites; they do not authorize a blind catch-up or certify
either environment. No hosted writes, test charges or provider configuration ran in this handoff.

Stripe MCP requires reauthentication. GitHub authenticates as `logoitino`, but search of
`repo:logoitino/ala` reports nonexistent/inaccessible resources and direct repository read returns404. Repository visibility and
publishing access remain unverified. Exact Expo58 and Supabase changelog public GETs failed
with curl7; requests sent no project data or credentials. The previously approved installed-SDK
exception remains the documentation basis; Supabase MCP documentation search is available.

Private bounded receipts: `.smoke/gift-release/hosted-preflight.json` and worker result JSON.
Only catalog/deployment metadata was queried; no account, payment or family rows were read.

## 5. Verification and claim release

Actual integrated `/usr/bin/caffeinate -i pnpm detection:scan` PASS, run
`2026-10-22T15-52-42-421Z-4ae21522-final`, completed **2026-10-22T15:55:03.197Z**.
The full `pnpm check` quality gate and117/117 portal tests passed; skipped=[], failures=[].
All25 declared partial/gap sensors remain explicit and runtimeVerified=false. The bounded
quality-gate log retains its final64,000 characters; the prior266-suite/2576-test count is
kept as checkout history rather than inferred from this truncated output. Current docs links
pass324 active Markdown files, roles115, comment/IP/source/Data/infra/exit checks pass.

Whole-team reconciliation verifies115/115 definitions and descriptive registry handoffs across
17 departments; protected role/model/reporting/ownership/frontmatter fields match their baseline.
122 tracked team files changed;214 explicitly historical/superseded references remain.
Fresh local PostgreSQL replay22/22 and all three runbook read-only SQL blocks passed. These
are local tests; no provider charge, hosted apply, transfer or bank receipt is implied.

Independent legal preparation review accepted the drafts with no blocking issue. Independent
handoff review found a wrong processing-key map and unsupported collected/guardian-held/payout
claims in the glossary. Root corrected them to `coverFees` / `tips.cover_fee_cents` and recorded
liability/intended setup; actual readback accepted H-01/H-02. Root also clarified that program
web checkout is a required, unestablished capability. The two SQL changes were independently
verified comment-only versus4c54606; containment never restores a gift cut. Original findings
and readback hashes remain in `.smoke/gift-release/independent-handoff-review.json` and
`independent-legal-review.json`. No test assertion or executable payment logic changed here.

A further function-definition classification read was rejected by the PreToolUse data-exfiltration
hook. No result or hosted rate conclusion was obtained. Safer exact relation/signature/trigger
catalog checks completed instead; paid/customer data and raw function bodies were not fetched.
An early links check ran before the rollout documents existed and failed only for those missing
files; integrated and final appended-document checks resolved that gap.

After glossary/receipt-only corrections, root reruns scoped documentation/roles/IP checks and
refreshes exact private source custody. Local implementation/documentation/review claims are
released to the next owners below; that release is not production or counsel acceptance.

Current next owners remain the rows above. Counsel approval, actual Stripe fees/net settlement,
targeted SQL/Edge rollout, physical-device/store and IP filing acceptance remain unverified.

## 6. Parallel Soft-Wall / EAS checkpoint (2026-10-24) — does not close gift release

Outside-session cloud agent on `cursor/soft-wall-resume-polish-9a86` (PR #12) synced the
115-role / 17-department hierarchy gates to the Soft-Wall resume + EAS preview tip without
changing role pins, reporting chains or COORD-02 gift duties:

| Gate | Result |
| --- | --- |
| `pnpm agents:check` | 115 roles OK |
| `pnpm docs:links` / `feature-admin:check` / `ip:check` / `exit:map:check` / `security:infra:check` / `infra:register:check` | PASS |
| Exit plan | `4fc54275bb8d` announced (`EXIT_CHANGE_LOG`, announcer `cloud-agent soft-wall-eas-checkpoint`) |
| Prior green EAS preview | Android `42e81674`, iOS `d4a153a0` (Stripe 0.83, arm ABIs, Gradle workers=2, `$StripeDisableSPM`) |
| UX on tip after those builds | Birth-year partial digits; Profile hamburger in hero + scrolling categorized sheet |
| Resubmit from hierarchy tip `43d3146` | iOS **FINISHED** `09de0497` (IPA above in STATE §4); Android blocked — Expo Free Android quota exhausted until 2026-11-01 (no paid upgrade without owner) |

**Departments notified for review against current tip (not acceptance):** AUTH, PROFILE, ONBOARDING,
MINOR_SAFETY, RELEASE, OPERATIONS, DESIGN, QA / DEVICE_QA, REDUNDANCY_LEAD / EXIT_SYNC,
INFRASTRUCTURE, SECURITY partners, DOCUMENTATION, VP_OPERATIONS, COST_OPERATIONS (Expo Free
quota). Gift counsel, hosted tip rollout, Connect settlement and store submission remain with
the rows in §2.
