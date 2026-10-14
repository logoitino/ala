<!-- Local incident evidence stays minimal; source records remain in their existing systems. -->
# Incident record template

Use the [Engineering Support lifecycle](../engineering/ENGINEERING_SUPPORT.md). Save local incident
records under `.smoke/detection/incidents/`; use sanitized task references in WORK_QUEUE for handoff.
Do not copy user reports, identities, private media, tokens or transaction payloads into this template.

- Incident/task ID and stable safe fingerprint:
- Status: detected / triaged / investigating / fixing / verification pending / monitoring / closed / reopened
- Severity and observed impact:
- Source record references (restricted originals, not copied payloads):
- First/last seen (UTC), count and affected environment/build/surface:
- Source status: available / unread / stale / unknown; sensor delivery evidence:
- Primary code owner, SUPPORT specialist, required domain reviewers:
- Synthetic reproduction steps; expected and actual behavior:
- Suspected or confirmed root cause; linked duplicates:
- Changed paths / reviewable patch:
- Failed-before check and evidence:
- Passed-after check and regression evidence (exact command/procedure/results):
- Independent QA/domain acceptance (or pending):
- Deployment/migration state; hosted/device evidence (or pending):
- Recovery observation window and recurrence check:
- Residual risks, next action/owner and closure reason:

An unrun check stays **not run**. Verified local fixes awaiting deployment stay **hosted recovery
pending**. A quiet telemetry feed alone does not establish recovery. Preserve earlier evidence
when an incident is reopened.
