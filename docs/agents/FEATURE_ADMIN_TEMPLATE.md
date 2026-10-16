<!-- This template prevents future app work from outrunning operational ownership.
     Examples are planning instructions, never verification evidence. -->
# Future feature admin contract template

Read [the workflow](../engineering/FEATURE_ADMIN_WORKFLOW.md) before implementation.
Add one record to [feature-admin.json](feature-admin.json) for each future feature.
Replace the example ID, owner, descriptions, routes, paths and date with your real plan.
The JSON below is a **planned** example; its future files need not exist yet.

```json
{
  "id": "EVENTS-01",
  "title": "School event announcements",
  "owner": "ADMIN",
  "status": "planned",
  "plannedAt": "2026-10-12T08:00:00Z",
  "exemption": null,
  "source": {
    "description": "School event records are canonical. Describe the table/RPC/config, record scope, bounded reads and unknown/error behavior here.",
    "paths": ["apps/mobile/src/frontend/lib/schoolEvents.ts"]
  },
  "admin": {
    "route": "/admin/events",
    "actions": ["Create and edit a private event draft", "Publish only after reviewed confirmation", "Unpublish and repair an incorrect event"],
    "paths": ["apps/mobile/src/frontend/components/Admin/SchoolEventsTool.tsx"]
  },
  "report": {
    "route": "/admin/analytics",
    "metrics": ["Published event count for the selected UTC week, scoped to authorized schools; source failure is unknown rather than zero. Include a complete Data table and a link to corrective actions."],
    "paths": ["apps/mobile/src/frontend/components/Admin/Reports/schoolEventsModel.ts"]
  },
  "disable": {
    "strategy": "An authorized admin can unpublish an event; drafts remain recoverable. Describe the flag/rollback behavior, fan fallback and any action that still needs owner authorization.",
    "paths": ["apps/mobile/src/frontend/lib/schoolEvents.ts"]
  },
  "access": {
    "roles": ["admin"],
    "deniedBehavior": "Guests and unrelated accounts cannot read private drafts or write events. Describe server/RLS enforcement, sensitive-field visibility and wrong-actor tests.",
    "paths": ["apps/mobile/src/frontend/lib/schoolEvents.ts"]
  },
  "app": {
    "route": "/local",
    "paths": ["apps/mobile/src/frontend/components/Local/SchoolEvents.tsx"]
  },
  "readiness": { "admin": null, "app": null }
}
```

## Every record field

| Field | Required meaning |
| --- | --- |
| `id` | Unique uppercase task-like ID, for example `EVENTS-01`. |
| `title` | Concrete feature name. |
| `owner` | One accountable existing specialist or explicitly named outside session; this does not dispatch a role or change model pins. |
| `status` | `planned`, then `admin-ready`, then `app-ready`. |
| `plannedAt` | Actual enrollment UTC timestamp, before either readiness checkpoint. |
| `exemption` | `null`, or the presentation-only object below. |
| `source.description`, `source.paths` | Canonical data/config ownership and files. Include population, read limits, missing values, source errors and dependencies. |
| `admin.route`, `admin.actions`, `admin.paths` | Expo `/admin` desk, reviewable actions and implementation files. Next remains read-only. |
| `report.route`, `report.metrics`, `report.paths` | Existing primary report, definitions/window/population, complete Data alternative, corrective links and implementation files. Explain a justified lack of a new metric in `metrics`; use an existing report rather than another duplicate dashboard. |
| `disable.strategy`, `disable.paths` | How an authorized operator pauses/removes/repairs the feature, the fan fallback, and the implementation files. Explain a deliberate absence of a runtime flag and the actual rollback path. |
| `access.roles`, `access.deniedBehavior`, `access.paths` | Allowed roles, privacy/denial policy, server enforcement and files. |
| `app.route`, `app.paths` | Planned fan/athlete experience and its files; implement after admin readiness. |
| `readiness.admin` | `null` while planned; actual admin/exemption review timestamp and evidence object once ready. |
| `readiness.app` | `null` until app-ready; actual app check timestamp and evidence object once ready. |
| Each checkpoint's `date` | UTC timestamp, strictly later for app than admin; milliseconds are accepted. |
| Each checkpoint's `evidence` | Nonempty array of `{ "path", "command", "result" }`. |
| Evidence `path` | Nonempty existing local evidence file, using a canonical repo-relative path. |
| Evidence `command` | Exact executed command or reproducible manual review procedure. |
| Evidence `result` | Actual counts/observations, outcome, tested environment and limits; bare `passed`/`OK` or placeholders are insufficient. |

All `paths` arrays are nonempty and contain file paths, never directories, URLs, globs,
line fragments, `./`, `..`, backslashes or absolute paths. An existing file may satisfy
several contracts. A future migration path is a plan; an existing migration proves only
that it was written. Record hosted application and denial evidence separately if required.

## Readiness checkpoint shape

Create an evidence file from the actual run before adding this shape. These example values
are illustrative and must not be copied as completed verification:

```json
{
  "date": "2026-10-12T09:00:00Z",
  "evidence": [
    {
      "path": "docs/engineering/evidence/EVENTS-01-admin.md",
      "command": "node --test scripts/__tests__/school-events.test.mjs",
      "result": "6 local tests passed, 0 failed; exit 0. Hosted writes and device interaction were not run."
    }
  ]
}
```

Save this as `readiness.admin` and advance to `admin-ready` after actual admin checks.
Run the selected admin gate before starting app implementation. Preserve that checkpoint
and its evidence; later add `readiness.app` with a later timestamp and advance to `app-ready`.

## Presentation-only exemption

Only visual/copy/layout changes that introduce **no** data source, business behavior,
write action, access rule, collection or reporting obligation may use this exemption.
The responsible lead/reviewer checks that definition. Use the following shape with the
actual reviewer and specific reason:

```json
{
  "kind": "presentation-only",
  "reason": "Only heading spacing and typography change; data, actions, permissions and reporting definitions stay the same.",
  "reviewedBy": "DESIGN"
}
```

For a qualifying exemption, `source`, `admin`, `report`, `disable` and `access` may be `null`.
Keep `app` populated. Record the exemption review in `readiness.admin`, pass the admin-ready
gate, then implement and verify presentation work before app-ready. The validator checks the
declared reason/reviewer and evidence; the reviewer checks whether the exemption is deserved.

## Required detection and repair review

Pair with SUPPORT before admin-ready. Include the sensor/event/error codes and coverage limits
in `report.metrics`; include broken-sensor/unread behavior, escalation owner, reproduction,
repair and regression evidence in `disable.strategy`. Register sensors or explicit gaps in
[the catalog](../engineering/detection-sensors.json). Preserve privacy and domain reviews.
This is a lead-reviewed semantic requirement; the registry gate checks declared structure.
See [ENGINEERING_SUPPORT.md](../engineering/ENGINEERING_SUPPORT.md).

## Problem, learning and handoff

In the existing task/design/evidence file, include the problem or potential failure, baseline,
options, bounded experiment and success/stop criteria, actual results and lead decision.
Link that document through existing checkpoint evidence rather than add unrecognized JSON fields.
Describe module interfaces, source/owner diagrams, reproducible checks and current gaps so
outside reviewers can follow the work. Follow [INNOVATION_AND_HANDOFF](../engineering/INNOVATION_AND_HANDOFF.md)
for the audience's reading path and approved document scope. These are lead-reviewed requirements.
