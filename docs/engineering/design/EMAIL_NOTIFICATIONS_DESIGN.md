<!-- Approved notification design with a dated local implementation checkpoint; SQL/provider gates remain separate. -->
# Email, notification inbox and Profile controls

**Status: owner-approved architecture, local implementation in progress, 2026-10-21 UTC.** The owner requested
account-creation emails, donation transaction emails, an inbox and controls over what is notified.
Local source and fan UI implementation is recorded in the [plan](EMAIL_NOTIFICATIONS_IMPLEMENTATION_PLAN.md) and [admin evidence](../evidence/NOTIFY-01-admin.md). Migrations remain unapplied; provider delivery is unavailable.
The owner's latest design answer, "Build it with only security emails on by default," supersedes
the earlier receipt-email-on preference: **every optional email category starts off**, including
welcome and donation emails. Verification/reset remains available. This design is app work;
approval to build is not provider activation, counsel approval or actual delivery evidence.

## 1. Approach and product experience

| Approach | Trade-off |
| --- | --- |
| Add emails independently to signup and checkout | Small initial change, but client retries, returning logins and unconfirmed payments can produce incorrect or duplicate messages; preferences would diverge. |
| **Recommended: one server event pipeline, an Activity inbox and Profile preferences** | More initial backend work; consistent recipient rules, durable delivery evidence and reusable templates across app features. Build email and in-app first. |
| Add email, native push and every integration together | Requires device permissions/tokens and more delivery dependencies before the requested email/inbox can be tested. Push remains the separate SCALE-07 roadmap lane. |

**Profile → Account → Notifications** opens a clearly grouped settings sheet. Each available
category has separate **In app** and **Email** controls, a short explanation and saved/error feedback.
Show the verified-email requirement and current address read-only. The app has no current
change-email flow; do not render a working-looking change action until that separately reviewed
Auth capability exists.
An optional-email master switch disables optional email, preserves category choices and does not
affect security verification/reset messages. A separate in-app master switch suppresses optional
inbox alerts. Both masters preserve stored category choices. Turning a master/category off
suppresses future inbox creation or email sends for that optional channel, including queued work
before send; existing inbox items remain reviewable. Re-enabling applies to future events, with
no automatic backfill of suppressed events. These controls do not delete receipts, block account
access or grant contact permission.
Push controls appear only after a working device delivery contract exists.

**Activity → Notifications** contains newest-first, recipient-only items, unread count, read/unread,
mark all read and archive. Mark all read uses an account-bound server snapshot/cutoff so newly
arriving items stay unread. Archived items are excluded from the default list and unread badge;
read state is separate from archive state. An Archived view can restore an item while preserving
its read state, subject to current source permissions. Pagination is bounded; errors and unavailable service differ from an empty
inbox. Opening Activity alone does not mark every item read. Existing donation history, pending tags,
Crew and workout cards remain factual feature views; label the notification section so derived
activity is not mistaken for unread messages. The current pending-tag count is not an unread count.
New notifications replace a legacy alert presentation only after reconciliation; do not duplicate
the same Crew event in two alert lists. Archive affects the inbox, never the delivery ledger.

## 2. Coverage and recommended defaults

Initial masters permit only explicitly enabled category choices: email master on with every
optional email category off sends no optional mail; in-app master on with the table's available
in-app choices. Unknown or newly introduced categories resolve off in both channels and require
explicit enrollment/opt-in, never inheritance from an older master. These defaults apply when
a category's reviewed source is enabled. Existing invite consent,
sender mutes, blocks, privacy controls and guardian rules continue to take precedence.
Unavailable/future categories cannot silently start delivering after a feature update.

| Category | Examples | In app | Email | Availability/source requirement |
| --- | --- | --- | --- | --- |
| Account welcome and updates | Welcome after confirmed signup; meaningful account changes | On, editable | Off until opt-in | Server account event; verified reachable email before email |
| Donations you make | Donation confirmation | On, editable | Off until opt-in | Authoritative payment purpose, amount and committed donation record |
| Donations you receive | Eligible athlete/guardian notification | On, editable | Off until opt-in | Current recipient ownership and minor/guardian checks |
| Payment updates | Refund/status change affecting your transaction | On, editable | Off until opt-in | Proven provider event plus committed business transition |
| Thanks and social activity | Preset thanks, tags, friend requests | On, editable | Off until opt-in | Authorized source, current contact/privacy rules |
| Crew and followed athletes | Allowed Crew updates, new published Highlights | On, editable | Off until opt-in | Existing follow/mute rules; published-content eligibility |
| Workout invitations | Allowed invitation and response updates | On, editable | Off until opt-in | Existing challenge consent and sender mutes |
| Followed games and school updates | Explicitly followed game updates, relevant school decisions | Off until opt-in | Off until opt-in | Actual follow or authorized school/account relationship |
| Security verification and recovery | Confirm address, reset password | Separate Auth flow | Requested/required by Auth flow | Supabase Auth mail; optional-alert switches do not disable recovery |

Account welcome is optional application mail, distinct from Auth's address confirmation.
Email and in-app choices persist across devices and are enforced on the server, including when
preferences change while a delivery is queued. Existing verified accounts are not mass-enrolled
into a welcome campaign. No live-streaming or longer-video notification source is introduced.

## 3. Event authority and recipients

The first transaction rollout covers donations and their associated payment/refund status.
Drip, sponsorship and subscription/exclusive purchase confirmations need separately enrolled,
committed purpose-specific sources before those categories become available.

- **Account:** one server-recorded welcome event after account activation and eligibility, using
  a stable account event key. Do not send from client `SIGNED_IN`, `isNewAuthUser`,
  `ensureFanProfile`, or a signup response with no session. Those paths also cover returning
  logins, refreshes and profile repair. Pending verification does not mean email is reachable.
- **Donation:** the server must bind the intent to a trusted donation purpose, donor, athlete,
  gift amount, fees/add-ons and currency. A successful processor charge must be reconciled to
  a committed canonical donation before a donation confirmation is queued. Current intent
  metadata and webhook metadata disagree; the target is reused for non-donation purchases.
  `tips`, PaymentSheet return, Connect flags and payment amount alone are insufficient proof.
- **Money commit:** correct the webhook's claim-before-side-effects behavior and ignored database
  errors. A processed-event key is durable only when the required business transition and
  notification intent have committed. Reconcile an uncertain result before retrying. Validate
  current business state/version for reordered success, partial-refund and dispute transitions;
  a delayed success cannot reopen a refunded/disputed donation or repeat refund accounting.
  Recheck that state before sending a queued status notice; suppress an obsolete success notice
  and use the current authorized transition. Retire any
  competing client donation writer in the same change as a new server writer; the mailer never
  creates a second donation, credit or Aura award. Refund events need their own keys and amounts.
- **Money wording:** distinguish donation confirmed, refund recorded and funds available.
  Available balance/payout/KYC messages require their own proven transition; currently blocked
  payouts or an onboarding flag cannot become a payout success notice. A donation receipt does
  not imply a tax deduction. Reviewed templates use the existing donation language.
- **Recipient:** derive permitted recipients from server ownership, verified Auth address and
  current guardian/consent relationships. Never accept a send-to address from a client. A teen
  and guardian are not automatically interchangeable recipients; CUSTODIAL/MINOR_SAFETY review
  determines the permitted notice, including unlink/age transitions before queued delivery.
- **Social:** current source authorization, blocks, sender mutes and content visibility apply
  both when creating and sending. A source review found `thank_donation` can skip its role denial
  when `rally_manager_role` returns NULL. Repair this explicit NULL rejection and verify unrelated
  callers are denied before thank-you events can authorize notifications. No hosted exploit was run.

Until these source conditions are satisfied, affected producers remain off. Local synthetic events
and template previews can exercise the notification pipeline without claiming a real payment or send.

## 4. Backend structure and delivery rules

Keep the implementation small and divided by responsibility:

| Proposed location/resource | Responsibility |
| --- | --- |
| `packages/shared-types/notifications.ts` | Allowlisted categories, channel choices, safe payload shapes and delivery states |
| `supabase/functions/_shared/notifications/` | Event validation, preference decisions, versioned safe templates and delivery adapter contract |
| App-side SQL migration and canonical schema | Recipient-owned preferences/inbox, service-only event/outbox/attempt records and bounded RPCs |
| `apps/mobile/src/frontend/lib/notifications.ts` and `hooks/useNotifications.ts` | One client boundary; session-safe fetch/save/read/archive behavior |
| Profile and Activity feature components | Settings and review, composed by existing routes |
| Expo `/admin/features` Notifications panel | Safe previews, pause and bounded failed-job review; new feature component under `components/Admin/Notifications/` |

Proposed data records are `notification_preferences`, `notification_events`,
`notification_inbox`, `notification_deliveries` and `notification_delivery_attempts`.
These were proposal names at design approval; exact local tables/RPCs are now registered in DATA_MAP and canonical SQL. They are unapplied source, not deployed schema evidence. Events contain allowlisted references/minimal payload, not copied
financial histories or arbitrary HTML. Inbox state and delivery evidence are separate: muting,
reading or archiving an alert cannot erase a payment record or delivery attempt.

Use a unique event/recipient/channel key, transactional enqueue, bounded batches and worker leases.
Recheck current preferences, address verification, suppression and recipient eligibility immediately
before send. Record the rule that suppressed delivery, without sensitive payloads in telemetry.
Opt-out is enforced before send authorization; an external send already accepted or in flight
cannot be recalled. The UI and operational evidence must preserve this limit.
Authenticated clients can read/update only their own preferences and inbox; they cannot enqueue,
choose recipients, modify source events, inspect other users or bypass the worker with direct writes.
Preference writes use an expected revision and a confirmed serialized save per active client;
stale same-account/cross-device writes return a conflict and reload current choices, with visible
feedback rather than silently overwriting newer changes. A failed save is not shown as saved.
Recipient ownership alone does not grant continuing access to referenced financial/content details.
Reauthorize inbox detail reads and linked destinations against current source permissions: guardian
unlink/handover, consent withdrawal or private/deleted content must not leave a cached disclosure.
Show a generic unavailable item when necessary. Preserve the donor's own historical receipt under
its separate access/retention rules. Admin operations require existing server role checks and
audited, bounded actions. Supabase/Stripe security or provider-operated messages outside app controls
must be explained separately; do not claim the optional-email switch controls those systems.
No email-open or click tracking is added by this design.

Start with a dry-run/test transport and a server-only replaceable mail adapter. Do not hand-build
SMTP/TLS or expose provider keys to Expo/Next client code. Supabase Auth SMTP remains a separate
configuration for verification/recovery. A configured adapter and scheduler are needed for real mail.
No real email is sent as part of implementation tests or template previews.

Delivery states distinguish **queued, attempting, accepted, delivered, suppressed, failed and
unknown outcome**. Provider acceptance is not inbox delivery. Use verified provider callbacks for
bounces/complaints/delivery when available; absent evidence remains unknown. A network timeout
may occur after acceptance: reconcile or use supported stable provider idempotency before retrying.
SMTP cannot generally guarantee exactly-once delivery. Retry only bounded, known retryable failures.
Show stuck leases/unknown outcomes to the repair owner rather than blindly sending again.

Optional emails contain a scoped unsubscribe path; mail-scanner GET requests do not change settings.
Use opaque, hashed, expiring tokens with a confirm POST, limited to optional-email preferences.
Register this token resource and its retention if implemented. It never authenticates an account.
Bounces/complaints suppress further optional sends to that address; changing an address requires
fresh verification and an explicit reviewed suppression policy. Do not embed donation amounts,
bank information, sensitive teen details or arbitrary user content in subjects or telemetry.

Retention needs DATA_GOVERNANCE/PRIVACY_ENGINEERING review before real collection. Proposed
operational windows: 90 days for inbox alerts and 30 days for sanitized delivery-attempt diagnostics;
receipt/ledger retention remains under Finance's existing policy. Durable dedup/event references
must outlive permitted replay windows; do not erase them on inbox archive or diagnostic expiry.
These windows are design proposals, not automatic deletion authority or legal retention claims.

## 5. Staff operations and rollout order

Accountable specialist: **NOTIFICATIONS → CREW → PROFILE → ENGINEERING → CTO**.
AUTH owns account sources; RECEIPTS/LEDGER/RECONCILIATION through COMMERCE own donation truth;
PROFILE owns controls; API/BACKEND and ADMIN/RUNTIME_CONFIG own delivery and staff controls.
Independent review includes RLS_SECURITY/SESSION_SECURITY, DATA_GOVERNANCE/PRIVACY_ENGINEERING,
LEGAL/COMPLIANCE, MINOR_SAFETY/CUSTODIAL, VOICE, SUPPORT/TELEMETRY and QA. These are repository
responsibilities; current review executors are outside-session Codex, not proof those roles ran.

1. Owner approved this design with optional emails off. Review welcome, receipt, unsubscribe
   and settings copy before real delivery activation.
2. Enroll NOTIFY-01 as `planned` before implementation using the existing feature-admin workflow.
   Register data ownership and explicitly map each Profile/Activity control in `COVERAGE_CONTROLS`.
   DOCUMENTATION/VP_OPERATIONS reconcile the broadened NOTIFICATIONS, AUTH, PROFILE, Finance,
   BACKEND/API and ADMIN duties in definitions, registry, TEAMS/hierarchy and WORK_QUEUE in that
   same implementation change. Preserve existing role/model pins and reporting; current
   NOTIFICATIONS's approval-time Crew-only charter did not establish email ownership; the current charter is reconciled, with no role/pin/reporting change.
3. Build source contracts, preferences/inbox RPCs, event/outbox worker, test adapter, templates,
   source repairs and Expo staff controls **before the fan UI**. Next remains read-only oversight.
4. Staff can preview versioned templates with synthetic fixtures, view per-category availability,
   pause email/inbox production, inspect bounded sanitized failures and safely retry only proven
   retryable jobs. No arbitrary-recipient mail composer or unsupervised bulk-send control.
   Resume does not automatically replay an old backlog: apply eligibility/expiry policy explicitly.
5. Add Health and Support sensors, then independent source/data/Finance/QA review and an actual
   scoped `admin-ready` checkpoint. Do not advance merely because SQL was written.
6. Build Profile controls and Activity inbox against that contract; verify save/read/archive, denied
   access, missing/error states, pause behavior and account switches before local `app-ready`.
7. Configure the development mail provider/Auth SMTP, apply reviewed SQL and verify actual delivery
   only with designated test recipients. Hosted activation, policy approval and release remain
   separate from local code readiness. Native push follows SCALE-07 later.

Operational integration targets are the existing Expo route
`apps/mobile/app/(admin)/admin/features.tsx` and a proposed
`apps/mobile/src/frontend/components/Admin/Notifications/NotificationAdminPanel.tsx`.
The planned source/control contract must specify server configuration for category/channel
availability and template version selection before admin readiness; it cannot rely on client flags.
Reuse `/admin/health` through `apps/mobile/src/frontend/components/Admin/Reports/AdminReportHealth.tsx`
as the primary Health report and its existing Data alternative. Next's reports remain read-only.

Report a defined current queue snapshot (pending count and oldest eligible pending),
and a 24-hour attempt/event window for attempted, accepted, delivered, suppressed, failed,
bounced and unknown outcomes. State populations, units and provider evidence availability.
Do not add statuses into a misleading total: a message can be accepted and later delivered.
Fixed sanitized sensor codes cover enqueue failure, stuck lease, unknown send outcome, preference
save failure and provider suppression. NOTIFICATIONS owns delivery repair; COMMERCE owns money
reconciliation; AUTH owns verification/recovery. Support receives reproduction and before/after evidence.

## 6. Acceptance tests and readiness limits

- Returning sign-in/refresh does not send a welcome; one eligible confirmed activation does.
- Duplicate payment/events do not duplicate business writes or inbox/delivery intents; a failed
  commit remains retryable. Non-donation purchases, add-ons and partial refunds retain correct meaning.
- Delayed success after refund/dispute cannot revive a donation or duplicate refund accounting;
  a queued success with changed business state is suppressed or replaced by the current notice.
- Unknown provider outcome is not marked delivered or blindly retried; lease expiry is recoverable.
- Opt-out or guardian/consent/block changes while queued are enforced before delivery.
- One account cannot read/write another's preferences/inbox or enqueue arbitrary notifications.
- Inbox detail reads and deep links deny access after guardian/content permission changes;
  the donor's own authorized historical receipt remains distinct from guardian access.
- Mark-read/archive preserves source and delivery evidence; unread counts reflect actual unread items.
- Mark all read leaves concurrently arriving items unread; archive removes items from the default badge.
- Channel off preserves choices/history, suppresses queued/future optional delivery and never backfills
  on resume. A cross-device revision conflict cannot silently overwrite a newer preference save.
- A→B→A switching, unmount and rapid preference saves cannot apply stale results to another session.
- Missing service/configuration, save failure, expired source and global pause have truthful app/admin states.
- Templates escape user content, keep sensitive data out of subjects/logs and render unsubscribe safely.
- Auth verification/recovery remains usable when optional channels are disabled.

Run meaningful local unit/integration checks and actual SQL negative/replay tests where an engine is
available. Fixture mocks are not SQL/RLS or concurrency proof. Real SMTP/provider acceptance,
delivery/bounce evidence, configured hosted source execution, device push and counsel approval
have no receipt yet. The design alone establishes no readiness; dated local checkpoints are in the implementation evidence and do not certify release.

## 7. Approval-time source review

Read-only maps completed by Codex `/root/auth_profile_freshness`, `/root/connect_kyc_review`
and `/root/photo_cleanup_review` on 2026-10-21 UTC. Approval-time findings included local-only game
filters, derived Activity/pending tags, persisted Crew queue without external push, missing unified
preferences, server payment attribution/commit gaps and the NULL-role thank-you denial gap.
Auth SMTP instructions already exist in STAGING_RUNBOOK; configured delivery is unverified.
Actual assignments, independent draft reviews and checks are recorded in
[COORD-01](../../agents/COORD-01.md). Further design review is not implementation acceptance.

## 8. Current local implementation — 2026-10-21

Source/SDK/staff checkpoint passed15:31:03UTC before fan UI. Shared safe templates and durable
worker contract, new-account producer, own revisioned preferences/read/archive/cutoff RPCs,
Expo staff controls/Health, Profile sheet and Activity inbox are implemented locally. Only the
account notification source is available in the source contract; all production starts paused.
Every optional email is blocked pending unsubscribe/provider support. Native push remains later.
Donation proof contexts/observations are prepared but authority is false; canonical atomic
credit/refund/outbox transition and trusted runtime adapters remain unwired. Existing client
credit writer remains sole writer. No real notification, money or SQL execution is claimed.

Profile controls govern the new connected notification pipeline; legacy Crew/workout queues
retain their current controls. Editable draft choices become confirmed only after Save succeeds.
Archived view identifies the active inbox unread count and has no bulk-read action; restoring
an item preserves its read state. Mark-all is limited to the active-inbox server snapshot.
Local hook/unit/source checks and actual no-write browser observations are recorded separately.
SQL25 plus1 concurrency cases prepared,0 executed; retention/export/counsel and hosted delivery
checks remain open. Proposed retention windows above are not an automatic purge implementation.
