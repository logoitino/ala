<!-- Local recipient UI/test checkpoint; deployment, business authority and provider delivery are separate. -->
# NOTIFY-01 — local app evidence

## Implemented experience

Profile → Account → Notifications opens recipient-owned server preferences. Every optional
email category starts off; verification/reset uses the separate Auth service. Channel masters
preserve category choices/history. Available categories can be changed as drafts; only a
confirmed revisioned Save is reported saved. A conflict requires explicit reload. Unavailable
sources and paused email cannot look like working delivery. These preferences govern the new
connected notification pipeline; existing Crew/workout invitation queues retain their controls.

Activity → Notifications displays one20-row server page, active inbox unread count, individual
read/unread, active-inbox snapshot mark-all and archive/restore. Archived view identifies the
count as unread in inbox and hides bulk-read/snapshot controls. Both current and retained
bulk-read callbacks are denied in Archived. Restore preserves read state. Only an authorized
row from the current loaded page can open a fixed Profile/Activity/Receipts destination; the
inbox read reauthorizes its source and destination screens retain their own current guards.

Complete Auth/view lifetimes and effect generations guard display, dispatch, publication,
follow-up reads and finally handling. No outgoing account data is substituted for missing
current data. One operation runs per lifetime. Errors are fixed safe copy; no real email,
provider diagnostic, arbitrary destination or payment confirmation is invented.

## Actual verification

| Command/procedure | Observed result |
| --- | --- |
| `CI=1 pnpm --filter @tapuai/mobile test -- --watchman=false --runInBand` | **233 suites /2,287 tests PASS**,0 failed,130.649s; `/tmp/ala-notification-full-final.log` |
| `pnpm --filter @tapuai/mobile typecheck` | exit0; `/tmp/ala-notification-mobile-types-final.log` |
| `pnpm --filter @tapuai/admin-portal typecheck` | exit0; `/tmp/ala-notification-portal-types-final.log` |
| `pnpm --filter @tapuai/shared-types exec tsc --noEmit` | exit0; `/tmp/ala-notification-shared-types-final.log` |
| Hook regressions | **19 PASS**, including stale A→B→A, before-render Auth invalidation, one save, conflict reload, source failure, effect replay, server cutoff and Archived bulk-read denial |
| Profile/Activity component fixtures | **15 PASS**; unsupported/paused sources, safe errors, security copy, read/archive actions and Archived count/bulk scope |
| Notification SDK/admin fixtures | **30 PASS**; expected revision/actor, strict safe parsing, bounded jobs, guarded writes, uncertain retry denial and Health populations |
| Worker/templates/core Node fixtures | **21 PASS**; opt-out at authorization, strict durable confirmations, accepted≠delivered, providerID bounds and timeout uncertainty |
| `CI=1 pnpm --filter @tapuai/mobile test -- --watchman=false --runInBand --runTestsByPath src/frontend/hooks/__tests__/useNotifications.test.tsx src/frontend/lib/__tests__/financeData.test.ts src/frontend/components/Admin/Reports/__tests__/AdminReportScreen.test.tsx 'app/(tabs)/__tests__/profile-quiz-history.test.tsx'` | Integration repairs:4 suites/66 tests PASS,4.77s; `/tmp/ala-notification-regression-fixes.log` |
| Historical Activity route path with `--runTestsByPath` |13 PASS; explicit path avoids parentheses interpreted as a pattern |
| `node scripts/data-map.mjs` |125 tables/views,597 functions,42 unimported exports,0 rule failures; seven temporary now-used SDK triage exceptions removed, functions retained |

Initial full run returned4 failing suites/15 cases: it encountered the newly added Archived
regression before its fix, old Profile/Health fixtures lacking their new independent child
boundaries, and seven new payment proof fields omitted from finance catalog. These were
repaired, rerun focused and then the final full run passed. No failure was hidden/excluded.
The finance catalog now labels quote amounts as controls and observations as matching evidence;
they do not post credits/refunds or prove receipts. Retained legacy webhook claims are explicitly
insufficient proof of completed business processing.

The native test renderer did not replay effects under a StrictMode wrapper; its one-read
prerequisite failure is not behavioral RED. An explicit cleanup/setup sequence fixture then
reproduced stale revision5→0 before the generation fix, and passed afterward. This proves the
modeled lifecycle sequence, not native/browser StrictMode behavior. Archived hook RED recorded
2 unwanted RPCs; GREEN denies both current and retained actions. UI RED found the active-inbox
bulk action in Archived; the fix hides it while preserving individual actions.

## Independent reviews

- Client/Auth/QA accepted final lifetime/Archived guards at2026-10-21 15:42:04UTC. Hook SHA256
  `7288cc5e8f94120e62d00a69e3f3da5cdb58d8a4625ef8b1e7b5a892e3e9be5e`;
  Inbox `5d8eaf33782424e4576154c5d3aff31e8f054d1ec32ac4d27db5454c0604ac84`.
- Security/Data accepted delivery-first lock-order source repair at15:30:42UTC, and Finance/Data
  accepted final catalog/legacy-claim meanings at15:45:55UTC. Catalog SHA256
  `eb8cfc016cb7ca8b80b47baee996f12c8b3a7b292d4a418db875f1a433ef338d`;
  ownership `2d8816a3c9ae4ed2ff16a29f82278064c01eb529a644a118cf926b26dc7aca96`.
- Doc/VP reconciled role duties and TESTER_SCRIPT, identified stale design/queue/admin summaries
  and draft-as-saved wording. Root corrected them; final checkpoint/documentation review follows.

Actual outside-session Codex review is not counsel, a repository-pinned specialist run,
unattended monitoring, deployed SQL or provider evidence.115 roles/17 departments and pins/
reporting remain unchanged. NOTIFICATIONS→CREW→PROFILE→ENGINEERING→CTO retains escalation.

## Environment and remaining delivery work

The [admin checkpoint](NOTIFY-01-admin.md) preceded fan implementation at15:31:03UTC. This
app checkpoint is local source/unit readiness against disabled-source contracts. All actual
notification production remains paused. Notification SQL25 plus1 concurrency cases prepared,
**0 executed**; migrations unapplied, generated catalog types unchanged. Written RPC/grant/
search-path/lock-order checks are not SQL authorization or concurrency acceptance.

Account activation is the only implemented reviewed source. Receipt/donation/social/Crew/
workout/game producers are unavailable. Trusted quote/persist runtime adapters and atomic
canonical credit/refund/outbox integration remain unwired; client remains sole credit writer.
Optional email remains blocked until public unsubscribe, configured provider, scheduled/deployed
worker and reviewed suppression/retention policy are implemented and verified. There is no
real email send or provider/bank/payment execution in these tests. Native push remains later.

No automatic retention purge/export/erasure integration or policy/legal approval is asserted.
Official Expo58 docs fetch failed connection; installed SDK references were used. Broad
`pnpm check` is unrun because it includes unrelated infrastructure mutations; scoped app,
role, data, comments, copy, credential and documentation checks are recorded instead.
Browser observations and final selected app gate are appended below. Existing Google/bank/
media deployment/provider checks remain separate from this notification implementation.

## Local app checkpoint — 2026-10-21T15:50:54Z

Local app readiness is recorded after the preserved admin checkpoint and final233-suite run.
The selected metadata gate is `node scripts/check-feature-admin.mjs --feature NOTIFY-01 --require app-ready`.
It validates declared contracts/local evidence, not hosted security or release certification.
Final scoped data/documentation/role/copy/comment checks and browser receipts follow below.

| Final owned source | SHA256 |
| --- | --- |
| `apps/mobile/src/frontend/hooks/useNotifications.ts` | `7288cc5e8f94120e62d00a69e3f3da5cdb58d8a4625ef8b1e7b5a892e3e9be5e` |
| `apps/mobile/src/frontend/lib/notifications.ts` | `5d198e4637f7723cf03b7d186138f433f8e95e2a9610f1f3146a6d7b3bb7d387` |
| `apps/mobile/src/frontend/components/Profile/NotificationSettingsSheet.tsx` | `8b32cceca9f7690321b6fbb8ab499eee82dcdd83ddc3ecbeba78f61a2580ebaf` |
| `apps/mobile/src/frontend/components/Activity/NotificationInbox.tsx` | `5d8eaf33782424e4576154c5d3aff31e8f054d1ec32ac4d27db5454c0604ac84` |
| `supabase/migrations/20261021140000_notifications.sql` | `9201cd14d4a12a925f39fa1a5fadb51df54b170c6905041256b8b861eb1b5de3` |
| `supabase/migrations/20261021150000_notification_payment_context.sql` | `68ca9a81a900fa436f4ab3d6758148f645b764c1c2786ed0d9fac6cc2bca5979` |

## Browser observation and cleanup — 2026-10-21 16:06 UTC

Root used only its owned background tab1335872983. The earlier8086 run disconnected from
Metro and produced an error overlay; its screenshot is not acceptance evidence. A fresh
owned Expo web server at `http://[::1]:8087` rendered the current app at a per-tab390×844
viewport. Root used the existing public Demo Fan sign-in, dismissed birth setup with Not now,
then opened Profile → Account → Notifications and Activity. Ordinary existing-account Auth
ran; no account creation, birth write, notification send, payment/bank action or credential
inspection occurred.

The guest menu hid notification settings. After sign-in, the settings sheet showed separate
verification/reset security copy, verified account email and the explicit unavailable-service
state with Reload/Close. Activity showed the Notifications card, Inbox/Archived/Refresh and
the same unavailable state, alongside existing Activity sections. Root viewed both screenshots:
copy wrapped within phone width and neither showed the earlier error overlay. No working
preferences or fabricated inbox rows appeared. These observations cover missing-service UI;
successful save/read/archive, native execution and hosted SQL/provider delivery were not run
in this browser session. Their local behavioral evidence remains the unit fixtures above.

| Viewed browser artifact | SHA256 |
| --- | --- |
| `/tmp/ala-notify-settings-current-mobile.png` | `16bfc2aa1220afd4a4dfaec2f7884fc6e66ef6eb890c064e105b013103c19db4` |
| `/tmp/ala-notify-activity-current-mobile.png` | `1afa8477ad948f57dca582b328dd3a04d05818b327111fb56cf324342552fb4d` |

The final error-level console query returned0 matching entries among17 total log entries;
this does not certify all warnings or framework behavior. DOM/error receipts are retained in
`/tmp/ala-notify-browser-final-{settings-text,activity-text,console}.json`. Root reset its per-tab
viewport and closed only tab1335872983, both confirmed successful. The owned local8087 preview
remains running for testing.

## Final review and scoped guard receipts

Independent read-only Documentation/VP acceptance occurred at2026-10-21 15:53:08UTC after
registry/current-status corrections. It checked all six source hashes above and115 unique
roles/17 departments with pins/reporting preserved. It accepted the documented local contracts;
it did not approve SQL, native, provider, policy or release readiness. Its browser/guard appendix
review is recorded after the actual final checks below.

The initial final scoped guard batch passed11 checks and failed copy once: the quote-total
meaning did not name the recipient of the optional tip. Root corrected only that wording to
name Tapua'i. Copy, role and selected NOTIFY-01 app-ready checks then passed. Final catalog
SHA256 is `055aee757cee457d68987b6aea4bcf6eeac21f4ea778e865ec34cdf7ce86a0a3`; the earlier
Finance acceptance hash above describes its pre-copy-correction source. No money behavior
changed. Actual receipts: `/tmp/ala-notification-final-guards.json` and
`/tmp/ala-notification-recheck-guards.json`.

Passing scoped commands were documentation sync/links, comments, copy, app data boundaries,
client-key and no-SSN checks, roles, selected feature-admin, detection declarations, unused
locals and data-map inventory. They retain declared baseline/gap limits:115 roles,18 feature
records,25 sensors with22 partial/gap declarations,2 unused-local baseline items,122 tables/
3 views/6 buckets/41 switches/597 functions/42 triaged exports. The data-boundary checker
reported0 known route files and37 recorded direct calls outside lib in14 files; its PASS is
not complete route coverage.

At2026-10-21 16:08UTC, post-append documentation sync, local links293files, roles115, selected
NOTIFY-01 app-ready and scoped tracked `git diff --check` all returned0. An explicit12-file
whitespace/final-newline check included new source/evidence files and passed; all six source
hashes above still matched. Actual receipt: `/tmp/ala-notification-post-append-guards.json`.

Independent read-only appendix acceptance occurred at2026-10-21 16:08:39UTC. Root matched
the reviewed evidence SHA256 `23ebe1f9966379ff51829f3a25e8c4ba3d02496c03c6df803e927f490d48add2`,
plan `789b26b9d53658211ce7892a386bfa1053e11bc9a4729a7d6635fea8b65aa83e` and COORD
`36681a429b643f0c9ed87494e903be1892991516e765561ce82962dced75812a` before this receipt.
The reviewer independently matched both screenshot hashes and accepted the documented scope.
Root releases final local integration/documentation claims. Operational delivery and the open
SQL/business/provider/retention/native/release items remain pending; no activation occurred.
