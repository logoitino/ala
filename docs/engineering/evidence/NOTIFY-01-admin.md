<!-- Local admin checkpoint receipts; source/unit fixtures never certify deployed RLS or email. -->
# NOTIFY-01 — local admin checkpoint

## Scope

Local Node24 / pnpm9 source contracts and synthetic RPC/transport fixtures. All production
notifications start paused. Auth verification/password reset remains separate. Every optional
email category starts off. Only the account source is implemented; donation/social/Crew/workout/
game notification producers remain unavailable. Native push is deferred.

Staff controls are in Expo `/admin/features`; Health is in `/admin/health`. The Next portal
remains read-only. Staff can preview synthetic templates, pause/configure reviewed sources,
and retry only fixed known retryable failures below three attempts. Unknown outcomes require
provider reconciliation; acceptance is not delivery. Config saves require revision plus a
captured actor equal to Auth, and source availability cannot be changed by a client.

## Actual command receipts

| Command | Observed result |
| --- | --- |
| `CI=1 pnpm --filter @tapuai/mobile test -- --watchman=false --runInBand src/frontend/lib/__tests__/notifications.test.ts src/frontend/components/Admin/Notifications/__tests__/NotificationAdminPanel.test.tsx` | 2 suites /30 tests PASS,0 failed,0 skipped,1.966s; `/tmp/ala-notification-actor-final.log` |
| `pnpm --filter @tapuai/mobile typecheck` | exit0; `/tmp/ala-notification-types-final.log` |
| `pnpm --filter @tapuai/shared-types exec tsc --noEmit` | exit0; `/tmp/ala-notification-shared-types.log` |
| `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test supabase/functions/_shared/notifications/notifications.test.ts supabase/functions/_shared/notifications/templates.test.ts supabase/functions/_shared/notifications/worker.test.ts` | 21 tests PASS,0 failed/skipped; `/tmp/ala-notification-core-final.log` |
| Focused money/checkout six-suite command in implementation handoff | 207 tests PASS; payment authority stays false and client remains sole credit writer |
| `node scripts/data-map.mjs` | source inventory:125 tables/views,597 functions,49 unimported exports,0 rule failures at pre-fan integration |

Behavioral RED receipts exposed missing SDK/admin implementation, stale retained callbacks,
retry-limit/Health semantics, actor arguments and strict worker booleans/provider IDs. Their
fixes passed focused reruns. One final admin test expectation still used the old retry
signature; correcting the expectation produced the30-test receipt above. Native gestures
were not exercised: the retained-callback unit fixture uses a Pressable mock.

## Independent reviews

Client/Auth/QA outside-session Codex `/root/auth_profile_freshness` accepted current SDK/admin
source at2026-10-21 15:28:17UTC: entry/follow-up guards, expected actor, three-attempt limit,
Health eligible-age NULL and unknown provider delivery. SDK SHA256
`5d198e4637f7723cf03b7d186138f433f8e95e2a9610f1f3146a6d7b3bb7d387`;
panel `1b780919237fa99cb675f1426f57ba732a08e8c09685bba1b3fc2cd14bfa611d`;
Health `cb99fc6653e5b4e831da7a18cb2ecdf68c7623bad8b1eb691a57df1a56074a64`.

Security/Finance/Data outside-session Codex `/root/connect_kyc_review` reviewed actor guards,
grants, empty search paths, strict worker confirmations and11 table/29 function ownership
entries at15:28:21UTC. It found an expiry/completion lock-order inversion. SQL owner repaired this before readiness; the later independent repair acceptance is recorded in the checkpoint below.

Doc/VP executor reconciled NOTIFICATIONS role duties without changing115 roles/17 departments,
pins or reporting chain, and passed agents/docs-link checks at14:29:37UTC. Final root docs
and checkpoint reconciliation remain separate.

## SQL and delivery limits

Notification replay declares25 SQL cases plus1 concurrent expiry/completion case, **0 executed**; both SQL RED/GREEN invocations
exit2 because no PostgreSQL/PGlite engine is available. Source signature/grant/canonical
checks pass but do not establish RLS, triggers, transaction or concurrency behavior. Payment
replay is also unexecuted. Migrations are unapplied and generated database types unchanged.

Optional email authorization always refuses with `unsubscribe_unavailable` after stronger
denials. No delivery provider, public unsubscribe endpoint, scheduled worker or deployed
email entry point exists. No real address, send, bank/payment or provider walkthrough was
used. Payment contexts/observations are bounded preparation: runtime trusted quote/persist
adapters and atomic canonical tip/Aura/backer/refund/outbox application remain unwired.
Receipt/payment sources stay unavailable until that single authoritative path is verified.

SUPPORT escalation: fixed client errors and `NOTIF_*` job codes go to NOTIFICATIONS/BACKEND;
AUTH owns account source, COMMERCE/RECONCILIATION money truth. Health is an on-demand snapshot,
not unattended monitoring or provider evidence. All queued includes paused/expired jobs;
oldest eligible age may be NULL. Last24-hour attempt/outcome populations overlap.

## Checkpoint

Local admin checkpoint recorded at **2026-10-21T15:31:03Z**, before fan implementation.
Independent Security source review accepted the lock-order repair at15:30:42UTC. Expiry
recovery takes bounded delivery locks before attempt updates, matching completion; started
expired sends stay unknown/nonretryable. Source analysis is not a concurrency execution.
Migration SHA256 `9201cd14d4a12a925f39fa1a5fadb51df54b170c6905041256b8b861eb1b5de3`;
canonical `3244b370aea3a982c472de267fe1f106c5a062382fd578133f6c21711c2529e9`.
Canonical contains exact migration bytes. Replay declares25 SQL +1 concurrency cases,0 executed.
Portal typecheck also exited0 (`/tmp/ala-notification-portal-types.log`).
This checkpoint establishes disabled-source local staff readiness only. It authorizes building
fan UI against these source/fixture contracts; SQL, email, payment and release gates remain open.
Full broad `pnpm check` is unrun because it includes unrelated infrastructure mutations;
scoped app/type/contract/role/documentation checks are recorded instead. Official Expo58
public docs fetch failed connection; installed SDK references were used.
