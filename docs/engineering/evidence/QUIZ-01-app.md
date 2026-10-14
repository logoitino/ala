# QUIZ-01 local participant evidence

Source is built in the isolated `codex/fan-zone` checkout. Final combined checks and the
recorded app-ready gate remain pending. This record does not activate a pilot.

[Design](../design/SPORT_POP_QUIZ_DESIGN.md) · [Admin checkpoint](QUIZ-01-admin.md)
· [Owner ledger](../../agents/QUIZ-01.md).

## Actual participant flow

A dismissible Home or role HQ invitation opens `/sport-quiz`. Choosing a sport explicitly
requests one server-random approved question version for the canonical account/UTC week.
Four choices lead to the committed explanation and a private Sport Learner completion badge,
including an incorrect answer. Badge history and void corrections use actual server records.
Profile has a private history link. Back and account Home remain available.

Not now is local mounted presentation state, scoped to identity and the returned server week;
it may reappear after remount. Skip this week is described as saved only after server confirmation.
Unconfirmed Skip has its own notice and Refresh. Account changes discard prior source and
pending answers. An uncertain answer retains the same choice and request ID for retry.
Focus, foreground and weekly renewal read only; no automatic question start or push prompt.

The badge has no cash, Aura, donation, ballot or school-ranking effect. No athlete/payee verification
is added to this learning path. Existing age/account restrictions and empty paused tester settings apply.

## Checks and independent review

| Scope | Actual local evidence |
| --- | --- |
| Participant hook/screen | Commit df1cfc1; two Jest suites23tests and mobile typecheck pass; account/read/write/retry/Skip/explanation/history/leave behavior. |
| Participant review | Independent outside-session Codex specification/quality PASS; task-7-review.md, exact seven source paths, no Important/Critical finding. |
| Home/HQ/profile integration | Commit96e4c3d; six focused suites44tests and mobile typecheck pass. Includes measured Home chrome, four actual HQs, seven profile roles, failed Skip and source isolation. |
| Control-map copy follow-up | Commit9d0e9d8;33hints and one existing assertion name sport_quiz_settings; focused existing test passes. |
| Consumer review | Independent task-8-quiz-review.md PASS for specification/quality, exact15source paths plus copy follow-up. Root read the full receipt. |

Private reports under `.superpowers/sdd/FAN_ZONE_IMPLEMENTATION_PLAN/` retain exact source/package
hashes and distinguish reviewer commands from worker test runs. Actual hosted, full layout/device,
keyboard/screen-reader, content-fact, jurisdiction/terms/retention and staffed operations remain release work.
The final full `pnpm check` and selected app-ready validation will be added after all required source integration.
