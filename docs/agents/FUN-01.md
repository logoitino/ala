# FUN-01 — Fan Zone pilot

**Owner authorization:** the owner approved the recommended family-fun build, including fan submissions and free voting, then added weekly sport quizzes. Both remain part of this task.
**Source status:** local source, independent participant/shared/whole-branch reviews and root full check pass in isolated `codex/fan-zone`. Actual selected app-ready passes at metadata date 2026-10-14T14:49:04Z after admin-ready 2026-10-14T13:42:36Z. Actual Documentation and VP role reviews pass; final status continuation is retained. No hosted deployment or applied migration.
**Primary owner:** POLLS under ENGINEERING, paired with ADMIN / UPLOAD / FULLSTACK.
**Required reviews:** MINOR_SAFETY, PRIVACY_ENGINEERING, RLS_SECURITY, DATA_GOVERNANCE,
MODERATION, SUPPORT, VOICE, independent QA; DOCUMENTATION and VP_OPERATIONS perform actual handoff.
**Actual executor:** outside-session Codex root and specifically assigned Codex agents, not evidence of pinned registry runtimes or counsel.

[Design](../engineering/design/FAN_ZONE_DESIGN.md) · [Implementation plan](../engineering/design/FAN_ZONE_IMPLEMENTATION_PLAN.md)
· [Feature contract](feature-admin.json) · [Product direction](../product/FAMILY_FUN_PLAYBOOK.md#12-refinement-one-welcoming-weekly-experience)

## Experiment and progress

Observed gap: existing fan uploads and simple counters do not implement private fan-award review,
entry-specific teen permission or auditable free ballots. Alternatives were staff awards and
fan voting; owner chose fan voting. Bounded first experiment is a testing-only Game/Week campaign,
at most 100 entries, optional stories/service and no new cash/badge ledger. Success is locally
proven state/permission/ballot/media behavior and an operable corrective desk before fan UI.
Stop wider opening if safety/removal/review capacity or integrity is unavailable. Actual live
completion/repeat/donation/burden baselines are unknown. Growth retains the Oct20 joint review.

| Stage | Actual result / next owner |
| --- | --- |
| Isolated source snapshot | Branch codex/fan-zone baseline 8ebcf6b; original dirty source preserved; dependencies linked locally with workspace package pointers rebound to this checkout. |
| Baseline repair | Existing Finance coverage failed on payout_flag_overrides.payouts_enabled (3 tests). Added one catalog control entry; focused financeData 15/15 pass. Root final full combined check exits0 (148 suites/1,146 assertions and all guards). No SQL/payee behavior change. |
| Enrollment/design | Planned before Fan Zone source. Actual admin-ready recorded at 2026-10-14T13:42:36Z before participant source. |
| Backend/media | Fix commit766e0ff:135/135 actors,14/14 API,105/105 canonical; independent spec/quality PASS in task-1-2-round1-review.md (local source correction scope). |
| Admin | Correction920bc8d passes 154 actor and 45 SDK/admin checks and independent specification/quality/Data/Safety/SUPPORT acceptance. Root canonical replay passes 105 checks; actual selected admin-ready gate passes at 2026-10-14T13:42:36Z. |
| Fan UI | Task4 bcb898c plus 070a58b: 35 hook/screen tests and mobile typecheck pass. Separate video a4f4acd: 13 tests and producer PASS. T4-I1 stale recovery correction independently passes specification/quality and local Data/Safety/SUPPORT; shared discovery 8179b7b is built with 53 final affected checks plus one coverage test and mobile typecheck; independent consumer review PASS at 8179b7b. |
| Documentation / coordination / final QA | Root full check PASS (148 suites/1,146 assertions, all guards); independent whole-branch/Data/Safety/SUPPORT and actual Documentation/VP scope reviews PASS; selected local Fan app-ready PASS. Final status continuation retained. |

QUIZ-01 separately implements the owner-added weekly sport pop quiz and private noncash learning badge. It does not change the fan-award recap into Aura/cash. [Quiz design](../engineering/design/SPORT_POP_QUIZ_DESIGN.md).

## Release boundaries

Countries/ages, approved contest/consent/retention/notice wording, legal guardian assurance,
moderator staffing/support capacity, school permissions, API origin/server secrets/deployment,
provider/cost/storage-delivery quotas, hosted access/removal/recovery, actual browser/device
playback and final owner release remain open. This task does not implement earnings or launch
cash prizes, donation-linked voting, teen DM contact or mandatory public service posts.
