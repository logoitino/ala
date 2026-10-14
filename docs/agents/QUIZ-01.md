# QUIZ-01 — Sport Quiz source and timed trivia refinement

**Owner request:** weekly random simple sport questions, with pop quiz badges, baked into the app.
**Earlier implemented direction:** optional weekly Home card; choose sport; one approved random question;
explanation and private noncash completion badge; skip allowed; no payment/vote/Aura effect.
**Primary owner:** POLLS under ENGINEERING, paired ADMIN/AURA. Reviews: Content/VOICE,
MINOR_SAFETY, PRIVACY_ENGINEERING, RLS_SECURITY, DATA_GOVERNANCE, SUPPORT, independent QA.
**Actual runtime:** outside-session Codex, not proof of registry model execution or counsel.
[Design](../engineering/design/SPORT_POP_QUIZ_DESIGN.md) · [Feature contract](feature-admin.json) · [Admin evidence](../engineering/evidence/QUIZ-01-admin.md).

| Stage | Actual status / next owner |
| --- | --- |
| Planned enrollment | Before source; isolated codex/fan-zone checkout. |
| Admin-first | Corrected sourceac509948;34/34 actor checks,2suites30tests; root105/105 canonical/14nav/3map tests. Independent scoped and local Data/Safety/SUPPORT reviews PASS; evidence in QUIZ-01-admin.md. |
| App / final checks | Participant23/23local tests and independent PASS; shared Home/four HQ/profile discovery44/44local tests/typecheck at96e4c3d, independent consumer review PASS including copy9d0e9d8; final full gates pending. |
| Documentation / VP coordination | Required actual receipts at handoff. |

Experiment: existing account week has no sport-learning loop. Compare optional learning prompt
with no prompt using accepted return/completion/support burden measures later; no live baseline
yet. Adopt local implementation only if negative actor, weekly duplicate, content-void and visible
skip/unavailable checks pass. Stop wider enablement if content review or correction is unreliable.
Release remains paused/testing-only: sport facts/terms/retention review, hosted SQL/access/security,
device/accessibility checks, staffing and owner release pending. No hosted changes authorized.

## Latest owner steering — design pending

The owner now requests sports-first timed trivia with broader optional topics, leaving closes
the round, no repeated questions and participation choice; 30 seconds plus a longer option is
confirmed. [Timed trivia proposal](../engineering/design/TIMED_TRIVIA_PROPOSAL.md) recommends
90 seconds, explicit opt-in and a reviewed server bank. Current source remains untimed; it has
no opt-in preference, expiry, abandonment or account family-exposure ledger. Prior admin/source
reviews cover that earlier contract only. Keep app readiness unset for the revised experience;
owner design review, updated admin handling and a new actual admin-ready checkpoint precede
timed participant work. Hosted enablement remains unapproved.
