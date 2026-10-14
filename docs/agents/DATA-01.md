# DATA-01 — Data governance team and the master data map

Last updated: 2026-10-13. Status: **built locally; every finding closed; archive done (owner approved); closures migration replayed, not applied**.
Handbook: [DATA_GOVERNANCE.md](../engineering/DATA_GOVERNANCE.md). Map: [DATA_MAP.md](../engineering/DATA_MAP.md).

Owner request (2026-10-13): a team that checks where every piece of data goes, that it is connected to
the right teams and functions, and that there is no dead data or dead code; every role must know who the
control person is. Routing: owner → CTO → `DATA_GOVERNANCE` (new lead) → `DATA_LINEAGE`, `CODE_HYGIENE`;
`VP_OPERATIONS` synchronized every role and team document.

## Status and shared-file claims

| Session | Claimed paths / responsibility | Status |
| --- | --- | --- |
| Claude (2026-10-13 10:45 MDT) | New: `scripts/data-map.mjs`, `docs/engineering/{data-ownership.json,DATA_MAP.md,DATA_GOVERNANCE.md}`, three agent files, this tracker. Shared edits: `package.json` (data:map scripts, `pnpm check`), `.github/workflows/ci-checks.yml` (one step), registry, TEAMS (contract item 11), TEAM_HIERARCHY, EXPERT_STANDARDS, DEPARTMENT_PLANS, WORK_QUEUE, a one-paragraph "Data control point" note appended to every agent definition, AGENTS.md, ONBOARDING, GLOSSARY, docs index, FEATURE_ADMIN_WORKFLOW, FINANCE_OPERATIONS, DATA_PRIVACY_MAP (F3), STATE, CHANGELOG; removed three unused exports added by BOOKS-02 | Done locally; claim released 2026-10-13 11:10 MDT |
| Claude closure pass (2026-10-13 11:20 MDT) | Archive pass (55 exports, 4 whole files, test cases) to `archive/dead-code-2026-10-13/`; migration `20261013120000_data_governance_closures.sql` + replay script; `lib/adminControls.ts`, `lib/crew.ts` (alerts); new `AthleteRecordsPanel`, `SchoolStaffPanel`, `OperatorCheckinsPanel`, `components/Activity/CrewAlertsCard`; edits to AthletesTool, SchoolsTool, GamesTool, PeopleTool (Unverify), `(tabs)/activity.tsx`, `AthleteProfileView` (actionsOnTop), MoneyTool / finance / verification / contentRights / portal reports tests; generator (buckets, switches, dropped functions, helper RPCs, comments) | Done locally; claim released 2026-10-13 12:00 MDT |
| Claude QA follow-up (2026-10-13) | Second archive pass (62 archived entries in total), `scripts/check-unused.mjs` + `code:unused` in `pnpm check` and CI, operator check-in table grants, panel stale-state fixes, branding prefill (`fetchSchoolBranding`), Unverify back to badge-only plus "Revoke and unlink", unused locals cleared (QaTool, reportPages), `TelemetryManager` / `OfflineQueue` `dispose()`; tests `PeopleTool.test.tsx`, `DataClosurePanels.test.tsx`, `adminControls.test.ts` | Done locally; claim released |
| Claude archive naming + merges (2026-10-13 13:00 MDT) | Archive files renamed `<name>.archived.<ext>` with headers and a registry entry each (84 entries, 47 files), `archive/sql/` folded into the pass folder, naming rule enforced by `data:map:check`; `lib/dbErrors.ts` (12 copies merged), `hooks/useAdminAction.ts` (4 desks), `mapGameLogs`; operator check-ins 30-day automatic expiry + write-time rounding (`expire_operator_checkins`, `operator_checkins_minimize`) in the closures migration and `schema.sql`; DATA_PRIVACY_MAP, LEGAL row Y | Done locally; claim released |

## Closure pass (2026-10-13, owner: "go all the way … archive as wanted")

62 exports archived with their tests (84 registry entries with helpers, tests and SQL); findings F1–F5 and F7 closed with real readers, writers and admin controls (see DATA_GOVERNANCE.md); Storage buckets and feature switches added to the map. Migration `20261013120000_data_governance_closures.sql` replayed 40/40 on PGlite.

QA follow-up: one security blocker (exact GPS readable from the table) and four P2s fixed, a second archive pass (62 entries in total, 19 exports kept), and the `code:unused` guard. Final local gate: `pnpm check` 103 suites / 700 tests and every guard; Next portal 86/86. **Not verified:** staging application, hosted admin reads, browser or device rendering of the new panels.

## Whole-schema replay and access hardening (2026-10-13 15:00 MDT)

`scripts/replay/schema-replay.mjs` rebuilds the full `schema.sql` (35/35). Findings F8 (books writable through PUBLIC grants; guest-open admin-desk functions) and F9 (claimless requests counted as the SQL Editor) fixed in `20261013210000_function_access_hardening.sql`; RLS_SECURITY approved. `code:unused` fail-open under FORCE_COLOR fixed; `detection:scan` green.

## Security follow-ups and payouts (2026-10-13 19:00 MDT)

Chain of command: owner → CTO → SECURITY → `RLS_SECURITY` (primary owner of both SQL files); reviewers `CUSTODIAL` (via COMMERCE) and `INTERNAL_CONTROLS` (via CONTROLLER → CFO). Executed as Claude reviewer agents reading each role file; results:
- `RLS_SECURITY` first pass on the cap constraints + payout policy: CHANGES NEEDED (service_role lost EXECUTE through PUBLIC, so the Stripe webhook's tip insert would fail the cap CHECK; paid → failed → edit → paid bypass). Fixed: explicit service_role grants on every narrowed function, paid / failed final. Second pass: **APPROVE**, 35/35.
- `CUSTODIAL` + `INTERNAL_CONTROLS`: **APPROVE**; live-money follow-ups recorded as WORK_QUEUE DATA-01-F10a (payout ↔ approved withdrawal, two-person approval, guardian access ending at handover, old/new amounts in the audit trail).
- Replay now mimics Supabase default grants (anon / authenticated / service_role get every new object), which surfaced `increment_backer_count` and three custodial `admin_*` functions still guest-callable on hosted; revoked. Pre-beta rate limits for guest votes / hype: DATA-01-F11.

## Owner decisions needed (remaining)

0. **Apply `20261013210000_function_access_hardening.sql` on staging first, then `20261013220000_disbursements_guardian_scope.sql`** (security; anyone with the public key can write revenue rows today, and any parent can edit any family's payouts).

1. Apply `supabase/migrations/20261013120000_data_governance_closures.sql` (staging SQL Editor) so the new
   admin controls and Crew alert clearing switch on.
2. ~~PRIVACY_ENGINEERING to confirm the 90-day operator check-in retention.~~ Decided 2026-10-13: **30 days, automatic**, rounded when written (built; replay 46/46).
3. Commit: owner chose one coordinated pass after DETECT-02 and PLAY-01 release their claims (2026-10-13); see STATE §5 "Branch integration pending" for the order.
4. PLAY-01 owner: remove the unused `hype` state in `ReelCard` and the two `view` test bindings in `UploadVideoModal.test.tsx`, then drop them from `unusedLocalsBaseline`.
