<!-- CHECK-01 cross-check protocol: the change type decides who must check, the check flows up the existing reporting line, and one record proves it ran. agents:check validates the matrix against the registry. -->
# CHECK-01 — Cross-check protocol

**Adopted:** proposed 2026-11-14. The owner decides at merge. **Why:** [CHECK-AUDIT](CHECK-AUDIT.md).
No new roles and no reporting-line changes. The owner (`FACILITATOR`) still decides prices,
counsel, SQL apply, merge and live money. No scheduler, auto-merge or auto-approval.

## The rule

1. **Classify.** The author files a check request in the task's Handoff record ([WORK_QUEUE](WORK_QUEUE.md#handoff-format)),
   naming every matrix row the change touches. The rows decide the checkers; the author never picks them.
2. **Peer check.** Each required checker records `accept`, `reject` or `no-op: <reason>`, with the date
   and the commit checked. Silence is not approval. The checker must be a different session from
   the one that built the change, and may be any session acting in that role.
3. **Lead certification.** The author's lead confirms that every required checker has a verdict
   and that all verdicts are accept or a reasoned no-op. The lead never overrules a domain gate.
4. **CTO.** The CTO accepts or rejects on the record. A rejection returns the work to step 1 with
   the reason. Docs-only changes stop at the lead.
5. **Owner decisions** go to the owner with the record attached: prices, counsel, SQL apply,
   merge and live money. The protocol routes these decisions; it never makes them.
6. **Independent QA** verifies last and can reject after every other check passes. A rejection
   reopens the check set.

**Stale rule.** A new commit to a touched file after a verdict voids that verdict. A bot or Codex
review of an older commit than the merged head is also stale.

**Propagation.** For a shared surface (a row marked ◆), the checkers in that row plus the registry
owner of each touched path must ack. An unacked shared surface means the task is not done. The
existing `EXIT_CHANGE_LOG` and `ARCHITECTURE_CHANGE_LOG` broadcasts stay notices: their wider
notify lists are not required acks. EXIT_SYNC and ARCHITECTURE_SYNC keep announcing as they do today.

**Done** means:
- the code is in and the checks are green
- every required verdict is current
- the lead and the CTO have signed, or the lead alone for docs-only
- every open item is named with a next owner

**Landed without a record.** A change that landed with no record gets a retrospective one. Each
missing verdict is open drift with a next owner. A verdict given after the fact never stands in
for one that should have come before a hosted apply or merge.
**DOCUMENTATION** still receives every feature or fix handoff under the pairing rules. A handoff
is not a verdict.

**Jev** is context for complex forks only. It is recorded in the check record when it was used.
It never counts as a review and is never given secrets, personal data or whole money, auth or legal
modules ([JEV](../engineering/JEV.md)). Bot reviews (Codex on GitHub) are also context, not a role verdict.

**Upkeep.** `VP_OPERATIONS` updates the matrix in the same turn a role, protocol or priority
changes. `pnpm agents:check` fails if a checker is unknown, a row has no checker, or a registry
role is in neither the matrix nor the author pool.

## Review matrix

Each checker checks only what is listed for it in the row. "◆" marks shared surfaces where acks propagate.

<!-- check-matrix:start -->
| Change type | Touches | Checkers — what each checks |
| --- | --- | --- |
| Money | checkout, tips, ledger, Connect, refunds, payouts, billing, splits, Rally/wishlist money | `COMMERCE` flow integration · the specific owner (`LEDGER`, `CHECKOUT`, `CONNECT`, `REFUNDS`, `RECONCILIATION`, `CUSTODIAL`, `BILLING`) for the domain invariant · `CFO` + `CONTROLLER` for recording/split acceptance · `RLS_SECURITY` for authorization · `QA` for behavior. Owner decides. |
| Books, tax, finance data | Books desk, revenue log, posting rules, tax wording, finance catalog | `CFO` acceptance · `CONTROLLER` posting rules · `TAX` tax lines/wording (`SALES_TAX` sales tax, `INFO_RETURNS` 1099s when touched) · `INTERNAL_CONTROLS` reconciliation completeness · `FINANCE_DATA` data layer · `QA`. |
| Schema / RPC / Storage / RLS ◆ | `supabase/migrations/`, `schema.sql`, views incl. `reels_feed`, buckets | `BACKEND` design · `DATABASE_MIGRATIONS` order/rollback/canonical copy · `RLS_SECURITY` grants/policies · `DATA_GOVERNANCE` + `DATA_LINEAGE` owner/map entry · `STORAGE` bucket policy · `EXIT_DATABASE` restore/parity impact · `QA`. Owner applies SQL. |
| Minors, footage, marks, privacy | age gates, guardian, personal data, rights, school marks, telemetry identity | `MINOR_SAFETY` minors · `TRUST_SAFETY` safety gate · `MODERATION` reports/hide · `PRIVACY_ENGINEERING` data flow/export/deletion · `CONTENT_RIGHTS` footage/marks · `ATHLETE_VERIFICATION` identity ladder · `LEGAL` + `COMPLIANCE` claims. Counsel and owner decide. |
| Auth / session | sign-in, OAuth return, JWT, role gates | `AUTH` flow · `SESSION_SECURITY` token/redirect integrity · `ONBOARDING` resume/age step · `QA`. |
| Copy and brand | any user-visible words | `VOICE` naming map · `BRAND` placements · `LEGAL` where words make a claim · `ACCESSIBILITY` labels when UI. |
| UI, visual, motion | screens, `UI/Kit`, layout | `DESIGN` plan conformance · `ACCESSIBILITY` labels/targets/contrast · `MOTION` motion/Reduce Motion · `VISUAL_QA` browser evidence · `DEVICE_QA` native-only behavior · `QA`. |
| Shared contracts ◆ | `packages/shared-types/`, generated DB types, theme tokens, `buttons.*` / `EXPO_PUBLIC_*` flags | `SHARED_CONTRACTS` contract · `FULLSTACK` integration · `RUNTIME_CONFIG` flags · `DESIGN` tokens · plus every consuming surface owner acks. |
| New capability (admin-first) | `feature-admin.json` enrollment | Feature owner (author) · `ADMIN` desk/report · `SUPPORT` + `TELEMETRY` detection/repair · `PRODUCT` acceptance · `TEST_AUTOMATION` regression tests · `QA`. Admin-ready and app-ready need a checker other than the author. |
| Media, playback, realtime | upload, video, photos, Realtime, offline queue | `UPLOAD` / `PLAYBACK` / `PHOTO_STORIES` / `VAULT` as touched · `REALTIME` · `OFFLINE` · `MOBILE_PERFORMANCE` memory/frames · `STORAGE` · `QA`. |
| Infra, CI, release, dependencies ◆ | workflows, `package.json`, `patches/`, env vars, EAS/Edge deploy paths | `OPERATIONS` · `CI` gates · `RELEASE` builds/env binding · `INFRASTRUCTURE` register diff · `SUPPLY_CHAIN_SECURITY` deps/patches/workflows · `INFRA_SECURITY` secrets/runners/network · `REDUNDANCY_LEAD` + `EXIT_SYNC` exit-plan impact. |
| Security-sensitive server code | API routes, Edge Functions, detection, recovery tooling | `SECURITY` · `API` contracts · `THREAT_DETECTION` signals · `RECOVERY_SECURITY` + `RECOVERY` backups/restore · `RELIABILITY` failure paths. |
| Growth, cost, spend recommendations | capacity packets, provider choices | `GROWTH_ANALYTICS` packet · `ANALYST` measures · `COST_OPERATIONS` quotes · `FPA` + `TREASURY` cash impact · `CTO` recommends. Owner decides spend. |
| Roles, protocol, priorities ◆ | registry, `.claude/agents/`, TEAMS, hierarchy, queue, this file | `VP_OPERATIONS` alignment · `DOCUMENTATION` · `ARCHITECTURE_SYNC` layer map if the stack moved · `CTO`. |
| Docs-only | docs with no code or behavior change | `DOCUMENTATION` · the owning role · `LEGAL` if legal-facing. No QA gate, and the doc must not claim execution it did not verify. |
<!-- check-matrix:end -->

**Author / surface pool.** These roles are authors, surface owners or leads. They check through
lead certification, or through the propagation rule when another session edits their owned paths.
They are not standing checkers for a whole row:
<!-- check-pool:start -->
`ACCOUNT_TAGS` · `ACTIVITY` · `ATHLETE_STATS` · `AURA` · `BOOKKEEPER` · `CATALOGS` · `CODE_HYGIENE` · `CREW` · `DESIGN_TOOLING` · `DISCOVERY` · `DONATION_THANKS` · `DRIP` · `ENGINEERING` · `EXIT_CLOUD` · `EXIT_SERVICES` · `FILMER_REWARDS` · `HIGHLIGHTS` · `INCIDENT_TRIAGE` · `LEADERBOARDS` · `LOCAL` · `MARKETING` · `NOTIFICATIONS` · `OPERATOR` · `PARTNERSHIPS` · `POLLS` · `PORTAL` · `PROFILE` · `RALLY` · `RECEIPTS` · `RESEARCH` · `ROLE_HQ` · `ROSTERS` · `SCHOOL_PARTNERS` · `SHARING` · `SPONSOR_ADS` · `SPOTLIGHT` · `WISHLIST`
<!-- check-pool:end -->

## Check-record template

Copy into the task's Handoff record:

```text
Check record — <task ID>
Change type(s): <matrix rows> · Files: <paths>
Author: <ROLE> · session <executor/runtime> · commit <sha>
Checkers: <ROLE>: accept|reject|no-op <reason> · <date> · <commit checked>   (one line each)
Shared-surface acks: <ROLE>: ack|object · <date> · <commit>
Lead: <ROLE> <date> · CTO: accept|reject <date> (or n/a: docs-only)
Owner decision: <decision> <date> (or none needed)
Jev / bot context: <optional, not a review>
Open drift → next owner: <item> → <ROLE>
```

## Retrospective dry run — FEED-01 (#47, merged `989d74e`)

| Required (rows: Schema ◆, Minors/privacy, Shared contracts ◆, New capability, UI, Copy) | Actually checked | Verdict |
| --- | --- | --- |
| BACKEND, DATABASE_MIGRATIONS, RLS_SECURITY, DATA_GOVERNANCE, DATA_LINEAGE, STORAGE (no-op), EXIT_DATABASE | `data:map:check`, the generated-types gate and an exit notice, all structural. No role verdict. | **Missing** |
| MINOR_SAFETY, TRUST_SAFETY, PRIVACY_ENGINEERING, LEGAL, COMPLIANCE | A privacy draft and a counsel send note exist. No verdict. | **Missing**. Counsel is owner-gated and correctly still open. |
| SHARED_CONTRACTS, FULLSTACK, RUNTIME_CONFIG (`EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS`) + consuming owners | None | **Missing** |
| ADMIN, SUPPORT, TELEMETRY, PRODUCT, a non-author for admin-ready/app-ready | The author wrote both checkpoints 5 minutes apart | **Missing** |
| DESIGN, ACCESSIBILITY, VISUAL_QA, DEVICE_QA, VOICE | Local Jest only. Device smoke is open. | **Missing** |
| QA (last) | CI green on `33aac2e`; Codex bot on the same head (context) | Not a QA verdict |
| Lead (HIGHLIGHTS → ENGINEERING) · CTO · owner merge | None recorded. Merged by `cursor[bot]`. Owner applied SQL with no RLS record attached. | **Fails** |

**Result:** under CHECK-01, FEED-01 would not be done. The record shows 25+ missing verdicts, plus
a stale migration header ("Applied: not applied" against STATE's "applied"). Next owners:
RLS_SECURITY and PRIVACY_ENGINEERING review the applied table first, then HIGHLIGHTS collects the rest.

## This change's own check record (live trial starts here)

```text
Check record — CHECK-01
Change type(s): Roles, protocol, priorities ◆ ; Infra, CI (agents:check script) ◆ · Files: docs/agents/CHECK-01.md, CHECK-AUDIT.md, TEAM_HIERARCHY.md, TEAMS.md, WORK_QUEUE.md, .cursor/rules/cross-check.mdc, scripts/check-agents.mjs
Author: VP_OPERATIONS function performed by this session · Claude Code (claude/check-01-cross-check)
Checkers: VP_OPERATIONS, DOCUMENTATION, CTO, CI, SUPPLY_CHAIN_SECURITY, ARCHITECTURE_SYNC (no-op expected): pending — must be a different session
Lead: pending · CTO: pending · Owner decision: merge pending
Verdicts on c0ca0c5 (2026-11-14; separate Claude general-purpose agent sessions performing each role, not the pinned models, which were unavailable):
  VP_OPERATIONS accept · DOCUMENTATION accept · CI accept · SUPPLY_CHAIN_SECURITY accept
  These became stale under the stale rule when the follow-up commit changed CHECK-01, check-agents.mjs, WORK_QUEUE and CHECK-AUDIT; re-checks are recorded on the PR.
ARCHITECTURE_SYNC: no-op — no stack layer moved
Open drift → next owner:
  live trial recorded in WORK_QUEUE "FEED-01 — retrospective check record" → HIGHLIGHTS
  the first new task after merge runs end to end → VP_OPERATIONS
```
