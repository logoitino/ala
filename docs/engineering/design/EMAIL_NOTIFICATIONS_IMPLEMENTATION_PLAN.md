<!-- App notification implementation ledger and interfaces; local checks do not certify hosted delivery. -->
# Email and notifications implementation plan

> For agentic workers: follow test-driven-development and verification-before-completion, with
> specialist ownership and independent spec/code review after each task. Root integrates the
> shared current-app tree requested by the owner; preserve concurrent edits and make no commits.

**Goal:** Build a recipient-owned notification inbox, Profile preferences and server-authoritative
account/donation notification delivery, with optional emails off by default.

**Architecture:** Shared allowlisted categories and versioned safe templates; app-side SQL owns
recipient preferences, source events, inbox state and durable delivery intents. Staff controls and
Health are implemented before Profile/Activity UI. Auth SMTP stays separate from optional mail.

**Tech:** Installed Node24, pnpm9, Expo58/React Native0.88, TypeScript/Jest, Supabase/PostgreSQL;
no new delivery provider, network dependency, credential or real recipient is needed for local tests.

**Spec:** [EMAIL_NOTIFICATIONS_DESIGN.md](EMAIL_NOTIFICATIONS_DESIGN.md).

## Global constraints and interfaces

- Latest owner choice: every optional email category off, security verification/reset available.
- Existing role pins/reporting, minor/guardian/privacy rules and one money credit path remain authoritative.
- Root owns STATE, CHANGELOG, index, feature registry, shared documentation/role reconciliation and final gates.
- Each worker owns only its assigned files; source headers on every touched file. No provider sends,
  deployment, hosted SQL, credentials, commits or changes to unrelated infrastructure.
- Native push remains SCALE-07. Unsupported category sources stay unavailable on the server.
- Code uses fixed safe error codes, expected-revision preference saves and bounded pagination.
- Notification category IDs: `account`, `donation_receipts`, `donations_received`, `payment_updates`,
  `social`, `crew`, `workouts`, `games`. New unknown categories resolve off.
- Shared `NotificationPreferences`: `revision`, `emailEnabled`, `inAppEnabled`, and category choices
  `{ email: boolean, inApp: boolean }`. Initial email choices all false; games in-app false.
- Client RPCs: `get_notification_preferences`, `save_notification_preferences`,
  `get_notification_inbox`, `set_notification_read`, `mark_all_notifications_read`,
  `set_notification_archived`. All actor identity derives from Auth. Preference/config saves and job retries additionally require a captured expected_actor UUID equal to Auth; it never selects a recipient.
- Staff RPCs: `get_admin_notification_health`, `get_admin_notification_config`,
  `set_admin_notification_config`, `get_admin_notification_jobs`, `retry_notification_job`.
  Existing admin guard, audited writes and fixed repair reasons; no arbitrary recipient/template HTML.
- Service-only producer and worker RPCs must enforce allowlisted event/payload/source authority and
  current recipient rights. The pure worker consumes a typed repository/transport boundary;
  absent transport never produces a fake accepted/delivered result.

## Task 1 — Backend contract, templates and delivery control

Files: new `packages/shared-types/notifications.ts`; new
`supabase/migrations/20261021140000_notifications.sql`; canonical `schema.sql`; new
`supabase/functions/_shared/notifications/` modules; a focused SQL replay and worker/template tests.

- [x] Write failing tests for defaults, invalid/unknown category denial, preference revision conflict,
  recipient-only access, archive/read cutoff, event dedup, worker lease and opt-out during queue.

  ```ts
  expect(makeDefaultNotificationPreferences().categories.donation_receipts.email).toBe(false);
  expect(resolveNotificationChoice(prefs, 'unregistered', 'email')).toBe(false);
  // Releasing a job after its recipient opted out must suppress it without calling transport.send.
  ```

- [x] Run and preserve RED commands/output before implementing each behavior.
- [x] Implement shared contracts, server-only events/outbox, owner RPCs and safe template rendering;
  SQL direct grants cannot bypass current actor, source or preference checks.
- [x] Add a replaceable mail transport, dry-run previews and worker attempt evidence. Unknown outcome
  must stay unknown; only supported stable provider idempotency permits safe reconciliation/retry.
- [x] Implement account activation producer with server eligibility and no returning-login replay.
  Integrate only sources whose current authorization can be proven; unsupported sources remain off.
- [x] Run actual local SQL replay if an engine exists; record zero SQL cases if it is unavailable.
  Run local worker/template tests and independent Security/Data review; mocks are not RLS proof.

## Task 2 — Donation event authority

Files: money PaymentIntent core, Stripe webhook, donation checkout caller(s), a separate app-side
payment-context migration, canonical schema integration, focused money/checkout/replay tests.

- [ ] Write RED cases: donor/purpose/currency/allocation mismatch, duplicate success, failed business
  commit, partial refunds, reordered success/refund/dispute, and queued stale success.

  ```ts
  // The verified processor event must match server-owned donation purpose and quote allocation.
  expect(await applyPaymentEvent(nonDonationIntent)).toEqual({ notification: 'not_applicable' });
  // A repeated event cannot create another tip, Aura award or receipt delivery intent.
  ```

- [ ] Bind donation purpose, actor, athlete, integer gift/fee/add-on amounts and currency server-side.
- [ ] Commit canonical business transition plus notification intent durably; never mark applied
  before required writes. Retire client donation writes in the same change that enables server credit.
- [ ] Keep provider mode/payout gates intact. Repair NULL-role thank-you denial before a thank-you
  producer is enabled. No hosted payment, refund or donation confirmation is executed here.
- [ ] Run focused tests and independent Finance/Security review. If current trusted integration
  cannot be completed safely, leave that producer explicitly unavailable and record the exact gap.

## Task 3 — Staff contract and admin checkpoint

Files: new `components/Admin/Notifications/NotificationAdminPanel.tsx` and tests; existing
`FeaturesTool.tsx`, `AdminReportHealth.tsx`, client notification SDK and shared data ownership records.

- [x] Write RED tests for admin-only read/write, missing source/config, pause, bounded failed jobs,
  safe retry denial for unknown outcome and generic synthetic previews.

  ```tsx
  // Missing migration must display unavailable, not zero accepted messages or a working Save.
  expect(screen.getByText('Notifications are not available yet')).toBeTruthy();
  ```

- [x] Implement `/admin/features` panel and `/admin/health` window/population definitions with the
  existing complete Data view. Staff cannot send to arbitrary addresses or publish unchecked copy.
- [x] Add fixed Support sensors and exact repair owners. Register data ownership/RPCs, regenerate
  DATA_MAP and reconcile broadened domain responsibilities without changing role/model pins.
- [x] Record actual focused/source/SQL environment evidence, run selected NOTIFY-01 `admin-ready`
  gate and preserve the checkpoint before starting fan-facing implementation. Local fixtures
  establish only their declared contract; deployment/provider/SQL limits stay visible.

## Task 4 — Profile settings and Activity inbox

Files: new `hooks/useNotifications.ts`, Profile notification settings and Activity notification
inbox components/tests; existing profile/activity routes, component docs and COVERAGE_CONTROLS.

- [x] Write RED tests for all optional email defaults off; master/category persistence; conflict/error
  feedback; A→B→A/unmount/rapid saves; mark read/all-read cutoff; archive/restore and denied links.

  ```tsx
  // A rejected revision save must show conflict/current choices and never publish an old success.
  expect(screen.queryByText('Saved')).toBeNull();
  // Existing receipt/history remains accessible after optional channels are disabled.
  ```

- [x] Build settings under Profile Account and bounded inbox under Activity, using one SDK boundary.
  Preserve factual history, current Crew/challenge rules, drafts and existing Auth lifetime guards.
- [x] Map actual control ownership/runtime/error signals; prove missing service, server pause and
  unsupported source availability truthfully without fake empty/working states.
- [x] Run focused UI tests, both app typechecks and current full mobile regression. Verify browser
  paths if available; record ordinary existing-account Auth separately from notification/payment
  provider traffic. Record actual local app gate.

## Task 5 — Independent handoff

- [x] Independent Security/Finance/QA review of exact changed source, then fix/retest concrete findings.
- [x] DOCUMENTATION/VP review implementation/evidence/role reconciliation; root updates STATE§4/header,
  CHANGELOG, index, queue and this ledger with UTC/hash/commands/outcomes and releases claims.
- [x] Run scoped documentation, feature-admin, comments, copy, boundary, data-map and role guards.
  Full broad `pnpm check` remains unrun if it would mutate unrelated infrastructure; say so.
- [x] Report implemented behavior separately from unapplied migrations, provider delivery and release.

## Execution ledger

- 2026-10-21: owner approved architecture with **only security emails on by default**. Optional
  receipt/welcome/social emails therefore start off. Initial draft source maps and independent
  architectural reviews are in COORD-01. Implementation not started at plan enrollment.

- 2026-10-21 15:28UTC: shared core21 tests, bounded money preparation207 tests, SDK/admin30 tests and mobile/shared/portal typechecks have passed locally. Independent client source review accepted latest actor/Health fixes. Security source review found expiry/completion lock-order inversion; SQL owner is repairing it before the admin checkpoint. SQL24 cases prepared,0 executed; payment replay also unexecuted. No fan UI started yet.

### Fan implementation interface (root/worker boundary)

`useNotificationSettings(visible)` returns confirmed `preferences`, editable `draft`,
`availability`, `loading`, `busy`, `error`, `notice`, `dirty`, `conflicted`, `reload()`,
`save()`, `setChannelEnabled(channel,value)` and `setCategory(id,channel,value)`.
No missing source produces defaults or success. Conflicted saves require explicit reload.

`useNotificationInbox(enabled=true)` returns `page`, `archived`, `loading`, `busy`, `error`,
`notice`, `reload()`, `nextPage()`, `showArchived(value)`, `setRead(id,value)`,
`setArchived(id,value)`, `markAllRead()` and `openItem(id,navigate)`.
Each response replaces one20-row page; mutation reloads current first page and server unread
count. Mark-all uses the previously issued server snapshot, preserving later arrivals.

Both hooks isolate the complete Auth lifetime and visible owner, check current session before
any request and after awaits, stop on unmount, and permit one active operation per lifetime.
Settings saves pass captured actor plus revision. UI renders real availability, never a fake
working email or push system. Existing receipt/timeline and actionable Crew/challenge queues
remain distinct; these preferences currently govern only the new reviewed notification sources.

### Current task disposition — 2026-10-21

| Task | Actual status | Remaining evidence/work |
| --- | --- | --- |
| Backend contracts/templates/worker | Local implementation and21 Node cases pass; source reviewed | SQL25 plus1 concurrency cases prepared,0 executed; real provider/unsubscribe/deployed scheduler still absent |
| Donation authority | Bounded quote/processor proof preparation and207 focused cases pass | Authority false; trusted runtime adapters and atomic canonical credit/refund/outbox remain unwired; client sole writer |
| Admin/source checkpoint | Local disabled-source admin-ready15:31:03UTC; source/data/actor/Health/lock-order reviews accepted | Not SQL/provider or release certification |
| Profile/Activity | Hook19, UI15, SDK/admin30 tests and full233 suites/2,287 tests pass; both app/shared typechecks pass | Browser/hosted/device scope recorded in app evidence; optional email and unsupported sources unavailable |
| Handoff | Local records sealed; Security, Finance, client QA and Doc/VP executed with actual receipts; final appendix accepted16:08:39UTC | Operational/legal activation stays open; implemented behavior and remaining delivery work are reported separately |

Final post-append checks at2026-10-21 16:08UTC passed documentation sync/293 local-link files,
115-role agreement, selected NOTIFY-01 app-ready and scoped tracked `git diff --check`.
An explicit12-file whitespace/final-newline check also passed for new source/evidence files,
and all six recorded source hashes still matched. Receipt:
`/tmp/ala-notification-post-append-guards.json`. This seals local testing records only; the
open Task2 business commit and delivery/provider/SQL items above retain their owners.

Checkboxes above mean the described local preparation/fixture step was performed; they do not
convert prepared SQL cases into executed tests. Task2 business commit/retired client writer
boxes intentionally remain open. Declared future email/financial/provider work is not completed
merely because the UI can describe its unavailable state. No optional emails or financial
provider actions were executed. Final procedures and outcomes: [app evidence](../evidence/NOTIFY-01-app.md).
