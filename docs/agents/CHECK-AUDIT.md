<!-- CHECK-01 Phase 0 audit: what cross-checking exists, what the last five landed changes actually got, and where it fails. Evidence only; no protocol here. -->
# CHECK-AUDIT — cross-check audit before CHECK-01

**Date:** 2026-11-14. **Source:** `main` at `076bf0a` (cloud clone of `logoitino/ala`). **Executor:**
Claude Code session `claude/check-01-cross-check`, which also wrote [CHECK-01](CHECK-01.md). An
independent session has not reviewed this audit (see the check record at the end of CHECK-01).

## Sharpest failure

FEED-01 (#47, 132 files, a new RLS table that holds account interest data and was applied to
hosted SQL) landed with no recorded RLS_SECURITY, PRIVACY_ENGINEERING, MINOR_SAFETY or QA verdict.
The same Cursor session wrote its admin-ready and app-ready checkpoints five minutes apart, and
`cursor[bot]` merged it.

## 1. Cross-check mechanisms that exist today (verified against the files)

| Mechanism | Evidence | What it actually enforces |
| --- | --- | --- |
| Reporting chain CTO → lead → specialist → lead → CTO; QA can reject; owner decides money/merge/SQL/counsel | `TEAM_HIERARCHY.md:403`, `TEAMS.md:807` | Prose only. Nothing records whether the chain ran. |
| Pairing rules by change kind (finance, data, schema, money, minors/privacy, docs, QA, concurrency) | `TEAM_HIERARCHY.md:399-411` | Prose only. No per-task verdict format. |
| Per-task cross-team tables (Primary · Pair / independent review · Lead chain) | `TEAM_HIERARCHY.md:357-397` (SAFETY-01, M8-01, GROWTH-01, UX-05a–e, ADM-01, ADM-02, BOOKS, DATA-01, DETECT-02, STANDARD-01, COORD-01) | Names reviewers per task. Does not record their verdicts. No FEED-01 row exists. |
| Self-review disclosure | `TEAM_HIERARCHY.md:365` ("The Cursor session that committed `1231af8` did the build... Separate specialist agents did not run.") | The loophole is disclosed, but nothing stops it. |
| One primary owner + independent reviewer for cross-functional work | `TEAMS.md:796` (call-sheet rule 6), `TEAMS.md:807` | Prose only. |
| Concurrent sessions: claim, check times, never revert; outside edits need owner review | `TEAMS.md:821-825` (item 10) | Prose only. The claims table lives in each task tracker. |
| Handoff format (ID, lead, paired reviewer, paths, acceptance, evidence, next action) | `WORK_QUEUE.md:702-707` | This is the only template. WORK_QUEUE has no "Status template" heading. |
| Exit-plan change notices with an ack line | `EXIT_CHANGE_LOG.md:7` (`reviewed by <CALL> <date>: ok / follow-up`), `TEAMS.md:818` (item 13) | `exit:map:check` fails if a change is not *announced*. It does not check acks. |
| Build-layer change notices with routed tasks and an ack line | `ARCHITECTURE_CHANGE_LOG.md:5-6`, `TEAMS.md:819` (item 14) | `layers:check` fails if a change is not *announced*. It does not check acks. |
| Admin-first feature gate | `FEATURE_ADMIN_WORKFLOW.md`, `feature-admin.json`, `pnpm feature-admin:check` | Checks metadata and evidence paths exist. It cannot tell who wrote them (`FEATURE_ADMIN_WORKFLOW.md:138`). |
| Data control point | `TEAM_HIERARCHY.md:401`, `TEAMS.md:816` (item 11), `pnpm data:map:check` | Structural: an owner entry must exist. A semantic DATA_GOVERNANCE review is not recorded. |
| Infrastructure register | `TEAMS.md:817` (item 12), `pnpm infra:register:check` | Structural: usage must be claimed. An INFRASTRUCTURE review of the diff is not recorded. |
| Jev, decision aid only | `docs/engineering/JEV.md:6-7, 30-32` | Correctly not a reviewer. No change needed. |
| `agents:check` | `package.json:33` (`node scripts/check-agents.mjs`), in `pnpm check` (`package.json:39`) and CI (`.github/workflows/ci-checks.yml:127`) | Exists. It validates unique calls, definition files, frontmatter/model pins, ownership paths, the reporting graph and that TEAMS/TEAM_HIERARCHY name every call. Nothing about reviews. |
| Codex GitHub review bot | Summary comment on every PR from #34 through #50 | An automated code review of one commit. It is not a domain-role verdict. On #48 and #34 it reviewed an older commit than the one merged. |

## 2. The five most recent landed changes on `main`

GitHub reviews: none on any of the five, and no human review comments. Every PR's CI
(`build-and-check`, `source-release`) passed on its head commit.

| PR (merged) | Change type | Should have checked (existing tables) | Actually checked | Missing |
| --- | --- | --- | --- | --- |
| #50 WebAppShell hydration (2026-11-14, owner merge) | UI/web layout + shared hook | DESIGN, ACCESSIBILITY, VISUAL_QA, QA (`TEAMS.md:820` item 15) | Codex bot on head `7fdddda`; CI | DESIGN, ACCESSIBILITY, VISUAL_QA verdicts. STATE §4 says "Reload Expo web to verify": unrun. |
| #48 FEED-01 counsel send note (2026-11-14, owner merge) | Docs-only, legal-facing | DOCUMENTATION, HIGHLIGHTS, LEGAL | Codex bot on `4d80732`; merged head `c34951f` | The bot review was stale (an older commit). No LEGAL acknowledgment of a note addressed to counsel. |
| #49 FEED-01 picks scroll menus (2026-11-14, owner merge) | UI | DESIGN, ACCESSIBILITY, VISUAL_QA, QA, HIGHLIGHTS | Codex bot on head `6aceda4`; CI; Jest | DESIGN, ACCESSIBILITY, VISUAL_QA verdicts. |
| #47 FEED-01 stack #39–#46 (2026-11-14, **merged by `cursor[bot]`**) | Schema/RLS + minor/privacy + shared contracts + admin feature + UI + env flag | BACKEND, DATABASE_MIGRATIONS, RLS_SECURITY, DATA_GOVERNANCE, PRIVACY_ENGINEERING, MINOR_SAFETY, LEGAL/COMPLIANCE, SHARED_CONTRACTS, ADMIN, SUPPORT, INFRASTRUCTURE, DESIGN, ACCESSIBILITY, QA (`TEAM_HIERARCHY.md:399-408`) | Codex bot on head `33aac2e`; CI; a DEVICE_QA-labelled local Jest note (`FEED-01-phase1-smoke.md:6`) | Every named domain verdict. Admin-ready `03:35:07Z` and app-ready `03:40:07Z` cite the same evidence file (`feature-admin.json:73-87`). No WORK_QUEUE entry and no cross-team row. The hosted SQL apply (owner) had no RLS_SECURITY record attached. The migration header still says "Applied: not applied" (`20261114010000_user_feed_prefs.sql:5`), while STATE §4 says it was applied. |
| #34 UI density pass (2026-11-11, owner merge) | Theme tokens (`theme.ts`, `fonts.ts`, `Kit.tsx`) + 30 surfaces | DESIGN, ACCESSIBILITY, VISUAL_QA, QA and every consuming surface owner | Codex bot on `4f37523`; merged head `2fe5e76` | The bot review was stale. There was no token-change notice to surface owners. `DENSITY_AUDIT.md:100` defers screenshot evidence to a device that this environment cannot drive. |

## 3. Change types the current tables do not cover

Checked against `TEAM_HIERARCHY.md:399-411` and `TEAMS.md` items 1–15:

- **Theme tokens / `UI/Kit` / motion tokens.** Item 15 says Design integrates and accessibility
  "owes evidence". There is no rule that a token change notifies the screens that consume it (#34).
- **Shared types and contracts** (`packages/shared-types/`, generated DB types, admin directories).
  SHARED_CONTRACTS is named in tables, but no pairing rule requires it.
- **Views such as `reels_feed`.** These are covered only as "schema". The 2026-10-21 `reels_feed`
  embed break shows that the consumer owners also need notice.
- **Copy / VOICE wording.** `voice.md` says "after any UI copy change", but no pairing rule makes it
  a gate. `copy:check` is word-level only.
- **CI workflows, dependencies, patches, env vars.** Item 12 asks INFRASTRUCTURE to review the
  register diff. SUPPLY_CHAIN_SECURITY and INFRA_SECURITY have no trigger.
- **Runtime/feature flags** (`buttons.*`, `EXPO_PUBLIC_*` gates). RUNTIME_CONFIG is never named
  as a reviewer.
- **Auth / session / OAuth return.** This is not a pairing row, although APP-TEST lane A changes it.
- **Admin-first feature checkpoints.** The gate cannot tell when the author signs off both checkpoints.
- **Merge actor.** Nothing says a bot may not merge, although the owner decides merges.

## 4. Propagation: the existing ack mechanism is not being used

- `EXIT_CHANGE_LOG.md` has 121 notices. Only 4 have any `reviewed by` line (12 lines in total).
  None has been added since 2026-10-21 (`EXIT_CHANGE_LOG.md:884`).
- `ARCHITECTURE_CHANGE_LOG.md` has 3 notices. Each one notifies 88 roles for a migration-count
  change, which leaves 1,320 open checkboxes and 0 ticked.
- **Implication for CHECK-01.** "Every notified role must ack" applied to these broadcasts would
  mean no task is ever done. CHECK-01 therefore requires acks only from the matrix checkers for
  the change, and leaves the logs as notices.

## 5. Corrections to the cross-check prompt's §0

- **Role count.** The registry has **116** roles, not 115. `TEAM_HIERARCHY.md:631` still says
  "107 callable agents" (fixed in this change). COORD-02's "115" remains a dated record.
- **`.cursor/rules/tapuai.mdc` is not tracked in the repository.** Tracked rules are
  `documentation.mdc`, `front-docs.mdc`, `jev.mdc` and `spend.mdc`. CHECK-01 adds a tracked
  `cross-check.mdc` instead of editing an untracked local file. Any local `tapuai.mdc` hard
  stops are untouched.
- **WORK_QUEUE has no "Status template".** The check-record fields go in its **Handoff format**
  section. The claims "Status table" lives in each task tracker (`TEAMS.md:822`).
- **`agents:check` exists and runs in CI**, so the matrix coverage check extends it.
- **Propagation with acks already exists** (§4). The gap is that the acks are never collected,
  not that the mechanism is missing.
