<!-- Test procedures distinguish historical wave checks from current source, provider and device acceptance. -->
# Tester script — Phase 3 internal wave

## Efficient APP-TEST loop — no Exit (2026-11-12)

Use this order on staging `tucioqipfejqqqtuakdi`. Wave 0 costs **$0** (Demo Fan, `4242`, Free
Metro). Do **not** start Exit drills here.

| Step | Where | Status / what to click |
| --- | --- | --- |
| 1. Demo Fan | SoftWall → Use test account / `demo@tapuai.app` | **PASS** (session works) |
| 2. Highlight (C) | Upload → 8s fixture → Publish → Home playback | **PASS** on web; reject 46s / >8MiB |
| 3. Gift charge | Expo web Payment Element **or** Edge + Stripe test | **PASS** 2026-11-16: Demo Fan → Give $5 → `4242` → Mālo toast + `tips` row (PI `pi_3UcXUP4jAsjtyL0Z0SeSCLDw`, **$0**). Optional: native preview PaymentSheet (not Expo Go). |
| 4. Google (A) | Guest → SoftWall → Continue with Google | Popup **PASS**; finish Test-users Gmail signup + resume |
| 5. Bank (B) | Owner only | Connect SQL → deploy `create-stripe-account` (checkout `sk_test_` already on staging). Payouts stay 503. |

PRs: C [#35](https://github.com/logoitino/ala/pull/35) · A [#36](https://github.com/logoitino/ala/pull/36) · B [#37](https://github.com/logoitino/ala/pull/37).

## Android and caption acceptance — UX-20, UX-21, POST-EDIT-01

Source is merged in [#65](https://github.com/logoitino/ala/pull/65). Record the build or commit, device
model and Android version. Use staging test accounts and synthetic content.

**Android, before the database migration**

1. From `apps/mobile`, run `EXPO_OFFLINE=1 ./node_modules/.bin/expo start --go --lan --port 8082 --max-workers 1`
   if port 8081 is already in use or its Android manifest fails here. Connect the Mac and phone
   to the same Wi-Fi and scan the QR code from that terminal. For an installed build, use a staging preview instead.
2. In Activity, drag on a notification to scroll, switch between Inbox and Archived, and open
   and close More. Repeat with larger system text: controls stay distinct and the last row clears
   the dock. Check with enough rows to scroll; an empty inbox does not verify this case.
3. On another user's profile, open and close a visible photo, including with the Android Back
   button. An avatar hidden by the owner's settings offers no preview. Playable Highlights
   appear above Story. Confirm the owner's photo still opens the regular editing flow.
4. In Home and in the profile's Highlight player, check that names and descriptions remain
   readable above the dock and Seki, Aura and Flex can still be reached. Verify that the duplicate
   reaction badges are gone from beneath the name.

**Staging, after the owner checks and applies the migration**

- Confirm the target is `ala-sports-staging`; the default CLI link may point elsewhere.
  Use the catalog preflight in [POST-EDIT-01](../agents/POST-EDIT-01.md#read-only-staging-preflight).
  If any prerequisite is absent, identify its existing migration before applying the caption migration.
- As the uploader, open a Highlight → More → Edit description, save and reload the feed and
  profile. The revised text persists. As a second test account, including the tagged athlete,
  look for the same menu and confirm Edit description is absent.
- In Beyond with contributions already enabled for the test account, edit an approved synthetic
  post under My posts. It returns to review. The second account no longer sees it in the shared
  feed until a test moderator approves the new revision. Media and audience stay the same.
- Turn off connectivity while saving a synthetic edit. The editor keeps the draft if the save
  cannot be confirmed. Reconnect and refresh before another attempt to learn whether it committed.

## Current giving checks — MONEY-TIPS-01 (2026-10-22)

Use the [rollout runbook](GIFT_TIP_ROLLOUT.md) and [COORD-02](../agents/COORD-02.md) first.
Run these on a confirmed, deployed **test** target after prerequisites are verified. Older
individual-donation/90/10/Donate-tagline scenarios below are retained as superseded history;
they are not current expected results. No test result here establishes App Store approval.

1. Open an athlete page, gift sheet, personal gift receipt, role HQ and matching admin reports.
   Athlete/family money says Gift/Give; the athlete page and receipt say exactly:
   **Gifts to individual athletes are personal gifts and are not tax-deductible.**
2. With the published extras flag OFF, start a new $5 gift. Tip/processing controls and the
   tip-step100% statement are absent. New source allocation is $5 gross family liability/$0
   platform gift share. This verifies a ledger allocation, not bank settlement.
3. Only in the separately approved test run with published extras ON, start a fresh gift.
   **Tip Tapua'i (optional)** starts at No tip; **Cover the processing fee** starts unchecked.
   The tip step contains the exact owner sentence and separate processing/test-rail disclosure:
   **100% of your gift goes to the athlete's family. Tips go to Tapua'i and keep the platform free for families.**
4. Review the gift, optional platform tip, estimated cover contribution and total separately.
   Verify $1/$1000 inclusive limits, changed-total re-review and single final payment action.
   A $5 gift +$0.50 tip +$1 configured cover charges $6.50; gift receipt/Highlight counter records
   $5, family gross liability$5, platform gift share$0. Provider fee is checked separately.
5. Change flag/catalog while the unpaid review is open; require a fresh valid review. After a
   quote is issued or payment succeeds, preserve its original allocation through flag changes.
   Double-tap, reconnect, stale recipient and paid-but-unsaved failure must not invite repayment.
   Reconcile any old-client in-flight payment before admitting the new SQL guard.
6. Inspect historical recorded shares/refunds without repricing. Missing family share remains
   unknown; closed-period missing rows require Finance repair. Flag OFF never restores10%.
7. Classify digital products independently: current Vault is a one-time Purchase; recurring
   premium is Subscription. Record current gift-linked Aura/border behavior for counsel review;
   do not claim “no digital benefit” or person-to-person eligibility until that decision lands.
8. Existing booster logo/placement purchases are not charitable program donations. Test any
   future charitable path only after its separate web implementation/status evidence exists.
   Club-specific receipt wording must not promise an athlete gift deduction.

Keep screenshots/string tables, build/commit, target, flag state, exact cents, failures and
provider/SQL observations with the actual executor. No live card or public submission follows
from these test instructions. Physical-device/provider cases remain unrun in this handoff.

For the trusted first group (team, family, friendly coaches and boosters). Stripe is in **test
mode**: no real money moves. Use card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.

Setup for whoever runs the wave: [STAGING_RUNBOOK.md](STAGING_RUNBOOK.md). Why we are building
this: [STORY.md](../product/STORY.md). Game-day gigs (the operator console) are an upcoming feature and are not part of this wave. Every task below checks one of the four pillars in
[ROADMAP.md](../product/ROADMAP.md) — **Watch & compete** (TikTok), **Rally** (GoFundMe, but better), **Pass it
on** (Train Like Me / Serve Like Me), **Rise** (a touch of Hudl).

**Report everything through the app** (Profile → menu → Send a suggestion). Make sure `buttons.suggest` is on and published before the wave. A screenshot plus one sentence is
perfect. "This felt slow" counts as a bug.

---

## Sport theme and floating dock — UX-10

1. On320/390-point phones, open Home, Activity, Spotlight, Profile, Local, Beyond and Drip.
   Check compact panels, visible sport/icon labels, readable colors and44-point action targets.
2. With a playable Highlight, confirm video reaches behind the floating dock. Caption, reactions,
   swipe hint and athlete peek must remain above it. Scroll between clips, rotate/resize and return:
   paging stays on the active clip and retains one active video.
3. Increase system text size. Labels wrap, dock remains visible, and all final non-video page actions
   scroll clear of the dock. Open athlete peek and confirm its large-text scroll fallback stays usable.
4. On your own and a private public Profile, change temporary sport/Stats chips. Primary sport artwork,
   hidden school/privacy notices and independent Stats remain correct. Check Drip and long names.
5. Check the dock's softened scrolling background, opaque buttons, stop/focus recovery, VoiceOver/
   TalkBack and Reduce Motion on physical devices. Check current published Look colors separately.

Local browser fixtures and source/Jest checks are separate from native system-text, screen-reader,
gesture and hosted acceptance. Actual receipts: [UX-10](../agents/UX-10.md).

## Game venue checks — LOCAL-02 (local implementation; activation pending)

After the owner applies `20261021220000_game_venues.sql` to the approved test environment:

1. In Expo `/admin/games`, save a public stadium/gym, venue school, full address and arrival note.
   Reopen that game and confirm every value was saved. Use a neutral venue distinct from the home school.
2. Open that game as a guest and signed-in fan. Confirm **Where to watch**, wrapping text and
   the address. On a physical iPhone/Android device, tap **Get directions** and verify the actual
   destination/entrance in Apple/Google Maps. Web uses Google Maps. No location permission is requested.
3. Clear the address in admin while the game is open. Confirm directions disappear and a slow
   overview refresh does not restore them. Retain the name, school and arrival note.
4. Simulate map-launch failure in the approved test harness: selectable address remains,
   readable retry appears and repeated taps create one in-flight request.
5. Check hosted fan/operator/anonymous venue writes are denied while existing permitted score
   changes still work. Report inaccurate locations to staff; do not enter private home addresses.

Local component/SQL/browser fixtures pass separately from these hosted/device tasks. Actual
execution and remaining gaps: [LOCAL-02](../agents/LOCAL-02.md).

## Before you start (2 minutes)

1. Install from the link you were sent (iPhone needs your device registered first).
2. Check the installed build against STATE §0. The current internal preview offers the
   test account `demo@tapuai.app`; use its account-sheet action or create your own account.
3. On a current build, account creation uses birth month/year and the existing age rules;
   ordinary sign-in does not repeat the completed check. Use synthetic dates for the focused rehearsal below.

## APP-TEST-C — Expo web Highlight smoke — 2026-11-12 UTC

Executed on `main` `fac733e` against development Supabase via Playwright on Expo web
(`127.0.0.1:8081`). Fixtures under gitignored `.fixtures/ala-sports-test-media-lane-c/`.
Full receipt: [COORD-01 APP-TEST-C](../agents/COORD-01.md#app-test-c-web-smoke--2026-11-12-utc).

| Check | Result |
| --- | --- |
| 8s pick → Details (`· 8s`) → caption + athlete → rights → Publish | **PASS** — Storage 200, `reels` 201 (`357605a8-…`) |
| Home playback of published clip | **PASS** — caption on feed; video `readyState=4`, duration 8s, playing |
| 46s over-limit | **PARTIAL** — not accepted into Details; Alert string not captured on web |
| Google (lane A) / Connect bank (lane B) / native iOS·Android | **UNRUN** (owner / device) |

Wave 0: this web smoke is **$0**. Do not treat as device or public-beta acceptance.

## APP-TEST-01 — local execution, partial checks — 2026-10-21 UTC

The owner confirmed Google OAuth setup is **not completed**. Successful Google signup/sign-in
and native return remain **UNRUN**. The prepared Google guide below is still the next operator
step. Root Codex supplied these actual local results; they do not accept signed-in bank setup,
Stripe operation, SQL behavior or public release.

| Executed local check | Observed result | Scope accepted / remaining evidence |
| --- | --- | --- |
| `POST http://localhost:8086/api/create-stripe-account`, no Authorization header, JSON body `{}` | HTTP 401 JSON with safe sign-in recovery copy. | Unauthenticated local API request denied; signed-in adult/guardian target and provider cases remain unrun. |
| `POST http://localhost:8086/api/create-payment-intent`, no Authorization header, JSON body `{}` | HTTP 401 JSON with safe sign-in recovery copy. | Unauthenticated local API request denied; quotes, payment creation, exactly-once credit and receipts remain separate gates. |
| `POST http://localhost:8086/api/create-payout`, no Authorization header, JSON body `{}` | HTTP 401 JSON with safe sign-in recovery copy. | Unauthenticated local API request denied; this does not exercise the authenticated payout 503 gate or move money. |
| Offline Connect SQL readiness attempt | Command exited 2: external PGlite engine missing; **0 SQL cases executed**, 35 checks prepared. | **BLOCKED**, with no SQL PASS or concurrency/locking acceptance. A prepared case count is not an executed result. |
| Existing Demo Fan through the ordinary Email → Sign in app UI, in the owned `http://[::1]:8086` rehearsal | Sign-in succeeded, the account sheet closed and the interrupted Highlight upload draft resumed. | Existing email-account sign-in and that draft resume only. No Use test account/signup button or new account was used; Google sign-in remains unrun. The birth prompt used Not now, with no birth-record write. No upload/publication occurred in this check. |
| Real library-picker opening from that resumed draft | The picker opened, then closed without selecting the 8s, 46s or padded over-8MiB fixtures. | **PARTIAL:** picker opening only. Actual file metadata, byte/duration rejection, app decoding, upload and publication remain **UNRUN**. |
| Initial owned IPv6 browser `/auth/callback` with synthetic `access_denied` and diagnostic query fields | Safe failure/recovery controls rendered and the diagnostic was absent from the page body, but the query remained in the address. | **Original failure, repaired below.** Safe body text alone did not accept callback recovery. No real OAuth credential or successful Google return was used. |
| Repaired synthetic failed callback, then Back to app and browser Back/Forward | Callback settled at `/auth/callback` with HTTP 200, query cleared, fragment empty, diagnostic absent and recovery visible. Back to app reached Home; browser Back reached the clean callback and Forward reached clean Home. | **PASS for this local synthetic recovery/navigation boundary.** Successful Google, native return and restricted-history cleanup remain separate unrun checks. Not now dismissed the birth overlay without a birth-record write. |

Root's original local HTTP receipt is `/tmp/ala-app-http-auth-20261021.json`; the offline
Connect readiness receipt is `/tmp/app-test-01-connect-readiness.json`, with its original log.
Codex `/root/connect_kyc_review` independently reproduced the three HTTP 401 denials at
**2026-10-21 04:15:21 UTC**. The actual isolated SQL attempt by Codex `/root/connect_client_flow`
at **2026-10-21 04:12:17 UTC** used Node **24.21.0** and
`node apps/mobile/src/backend/db/connectAccountContext.replay.mjs /tmp/tapuai-pglite-verified-dbtwu6km`.
The required external engine was unavailable. Original source SHA256 prefixes were schema `d90fe5186cb3`, harness
`1757aec78304`, and synthetic stubs `a077c5a3968d`.

The isolated browser rehearsal uses `http://[::1]:8086`, because Metro's IPv6 binding refused
`127.0.0.1`. It is distinct from the earlier signed-in `localhost:8086` navigation and from the
Google guide's allowlisted-origin instructions. No successful Google return or acceptance of
the IPv6 origin by the Google/Supabase allowlist is established. An additional Google authorize
HTTP probe was blocked by automatic approval review and did not execute.

Codex `/root/media_flow_map` performed the existing-email sign-in, draft resume and picker
opening in owned tab `1335872973`; screenshot `/tmp/ala-media-existing-test-signin.png`.
The temporary input-interception action executed with an automatic-review caution, not a
rejection; no fixture was selected. The agent removed the handler, closed the picker/draft and
confirmed no file input or password field remained before releasing the tab to root.

Root Codex repaired `apps/mobile/app/auth/callback.tsx` and its tests, preserving browser history
state and cleaning the Router's stored return path. Final callback SHA256 is
`2e074a0cfc4deac4cda5bcbaddfaa8f80281ba616e82e18358b6bce8f250454c`; test SHA256 is
`fe78b2681bc31d26582468db9bfd0f1e3bf08bf6f40c0536c1f0d5a58444f840`.
Independent Codex `/root/connect_kyc_review` recorded **56 tests PASS in 1.788s**, accepted at
**2026-10-21 04:26:52 UTC**. Root's actual full mobile run recorded **226 suites / 2,196 tests PASS
in 151.564 seconds**, exit 0, in `/tmp/ala-app-callback-full-mobile.log`; both app typechecks and
nine scoped app/documentation guards PASS. Independent data-map helper checks passed 4 tests,
with 0 generated-map rule failures. These source checks do not execute Connect SQL or Stripe.

Root viewed the final visible-recovery screenshot,
`/tmp/ala-app-callback-recovery-fixed-20261021.png` (25,777 bytes, SHA256
`35249508e3cd8c2aaa4b7ace146819476d143f1d35e554dcfa6920e85139d0e1`). The earlier failed
screenshot is `/tmp/ala-app-callback-recovery-20261021.png`. Recovery remains available if history
or navigation access is restricted, but address cleanup in that restricted environment is
best-effort and was not verified by this browser run.
This run used a query-based synthetic error; a warm fragment-only routing transition was not tested.

Root also prepared the credential-free private bank template at
`~/.config/ala-sports/app-test-server.env` with mode 0600; it was not filled or activated. Google
configuration, compatible hosted SQL/Edge, signed-in bank/checkout/payout, selected-file media
and native acceptance remain open. No roles, model pins, priorities, schema, Storage paths,
exports or data collection changed in this repair. Actual final integration belongs in
[COORD-01](../agents/COORD-01.md).

The earlier 226-suite/2,193-test source baseline and signed-in localhost navigation remain dated
separately below. Their original receipts are not the final callback repair run.

## NOTIFY-01 — notification settings, inbox and staff rehearsal

**Prepared 2026-10-21 UTC; this walkthrough is not a new execution or final acceptance receipt.**
Use the current [implementation plan](design/EMAIL_NOTIFICATIONS_IMPLEMENTATION_PLAN.md) and
[local admin checkpoint](evidence/NOTIFY-01-admin.md) for actual source/test evidence. The
disabled-source local staff checkpoint preceded fan implementation. A local synthetic RPC
fixture is different from the real connected development database: notification migrations
are **written, not applied**, and their replay declares **25 SQL cases plus 1 concurrency
case, 0 executed**. Missing PostgreSQL/PGlite prevented SQL execution; mocks do not accept
RLS, triggers, transaction atomicity or locking.

All optional email categories start **Off**, including welcome and donation emails.
Verification/password reset uses the separate Auth service and is not disabled by optional
choices; this does not establish configured Auth SMTP delivery. New preferences govern only
the new connected notification sources. Currently only the account source is connected in
local source, and all new delivery channels/categories start paused. Existing Crew alerts,
workout invitations, donation history and pending tags retain their own controls and views.
Phone push remains SCALE-07; there is no native delivery claim.

### Read-only browser walkthrough against the current environment

For root's browser run, inspect navigation and missing/paused states. **Do not save preferences,
change staff configuration, retry jobs, create donations or invoke providers.** Keep private
account addresses and diagnostics out of shared evidence. Real-environment mutation and
delivery checks remain UNRUN unless a later explicitly authorized receipt records them.

1. As the current signed-in account, open **Profile → Account → Notifications**. Check the
   security explanation and read-only address/verification status; no change-email action is
   offered. With missing notification SQL, expect **“Notifications are not available yet.”**,
   a Reload settings action and no invented defaults or working Save choices. Close and reopen;
   ordinary Profile/Account navigation must still work.
2. Open **Activity → Notifications**. A missing source must show unavailable, not
   “No notifications yet” or a fabricated unread count. Existing donation/invitation/tag
   sections remain separate. Refresh must not erase their factual history. A guest must not
   receive another account's inbox or preference controls.
3. With an authorized test admin, open **`/admin/features` → Notifications** and
   **`/admin/health` → Notification delivery**. Missing configuration/SQL must remain
   unavailable rather than zero successful deliveries. The staff desk describes synthetic
   previews, paused mail and missing unsubscribe support; it sends no email. Missing server
   configuration must not produce working save/retry controls. Next oversight remains read-only.
4. Record origin, build/source version, actor class, date, visible states and tool limitations.
   A navigation screenshot does not prove preference persistence, database permissions,
   provider delivery or native behavior.

### Controlled local fixture checks, then separately authorized hosted checks

Run mutations below only through synthetic test repositories/RPC fixtures, or later in an
explicitly approved test environment with applied reviewed SQL and designated accounts.
These procedures are prepared; no new manual result is claimed here.

| Check | Expected behavior |
| --- | --- |
| Initial preferences and paused sources | Every optional category Email is Off; games In-app is Off. Master choices preserve category choices and do not prove delivery. Unconnected/paused categories cannot be switched on; an existing On choice can still be switched off. Unknown categories do not inherit On. |
| Save, failure and revision conflict | Edits remain a draft until Save choices confirms them. Failed saves never claim Saved. A concurrent revision conflict requires Reload settings before reconfirming; no silent cross-device overwrite. Pausing preserves history/choices; resuming is future-only without suppressed-event backfill. |
| Account lifetime | Delay a read/save, close/unmount, switch A→B→A or invoke an old callback. No old preferences, notice, inbox row or write may attach to the new Auth lifetime. A guest/other account cannot access private records. |
| Inbox history and pagination | Use synthetic account items. Inbox/Archived, Mark read/Mark unread, Archive/Restore and Next page work on bounded 20-row pages. Archive removes the item from the default unread count and preserves its read state; restore preserves that state. Refresh returns to the newest page. Receipt/source/delivery records are not deleted. |
| Mark all and opening | Mark all as read uses the last loaded server snapshot, leaving later arrivals unread; the Archived view cannot mark unseen current-inbox rows. Opening an update is separate from marking it read. Only allowed current-account destinations navigate; malformed/unsafe links must not open. Current-source/relationship denial checks are required before connecting future sensitive categories. |
| Staff fixtures and repair | Synthetic previews name the version and say no email sent. Configuration saves use captured actor/revision. Only fixed known-retryable failures below three attempts expose retry; unknown outcomes need reconciliation. No arbitrary recipient, HTML composer or automatic backlog replay exists. |
| Health meaning | “All queued now” includes paused/expired/ineligible jobs. Oldest eligible may be “none eligible.” Last-24-hour attempt/outcome populations overlap and must not be summed. Missing provider evidence makes delivery/bounces unknown; Accepted is not Delivered. Health is an on-demand snapshot, not background monitoring. |

Current delivery gaps are deliberate gates: no configured optional-email provider, public
unsubscribe endpoint, scheduled worker or deployed email entry point exists. Optional-email
authorization refuses with `unsubscribe_unavailable` after stronger denials. No real send is
established by choosing a checkbox or previewing a template. Donation proof preparation keeps
notification authority **hard false**: trusted runtime quote/persist adapters and atomic
canonical donation/Aura/backer/refund/outbox integration remain unwired. The client remains
the sole credit writer; donation/payment receipt sources are unavailable. Do not create a
second charge or credit to test this inbox.

Focused local UI procedure (command prepared here; this documentation pass did not run it):

```sh
CI=1 pnpm --filter @tapuai/mobile test -- --watchman=false --runInBand src/frontend/hooks/__tests__/useNotifications.test.tsx src/frontend/components/Profile/__tests__/NotificationSettingsSheet.test.tsx src/frontend/components/Activity/__tests__/NotificationInbox.test.tsx
```

Route notification failures to NOTIFICATIONS/BACKEND with SUPPORT; AUTH owns account/security
sources and COMMERCE/RECONCILIATION owns money truth. Security, Data/Privacy, Minor/Custodial,
Finance and QA retain independent review. Root records final app/source/browser receipts in
STATE/COORD-01; this procedure does not close hosted SQL, policy, provider, push or release gates.

## Google setup acceptance — browser first, then native

**Prepared 2026-10-21; successful Google signup/sign-in and native return UNRUN.**
**2026-11-12 staging enable:** Auth settings **`google: true`** on `tucioqipfejqqqtuakdi`;
authorize **302** to Google; Soft-Wall **Continue with Google** opens Google Accounts popup;
cancel/close leaves SoftWall retry (**PASS** for provider + popup). Full new/returning Google
account + birth confirm + resume and native return remain **UNRUN**. Follow
[Google operator setup](../ONBOARDING.md#prepare-google-sign-in-for-development--2026-10-21)
and [COORD-01 receipt](../agents/COORD-01.md#app-test-a-google-enabled-smoke--2026-11-12-utc).

1. After operator setup, verify Auth settings on the **same** project as `EXPO_PUBLIC_SUPABASE_URL`
   report Google enabled. Staging Web-client redirect:
   `https://tucioqipfejqqqtuakdi.supabase.co/auth/v1/callback` (development historical:
   `https://ulfapgtabidorgwfjvwz.supabase.co/auth/v1/callback`). Supabase must also allow the exact
   app return (`http://localhost:8086/auth/callback` and, for Cloud Agent web,
   `http://127.0.0.1:8081/auth/callback` + `http://localhost:8081/auth/callback`). Keep credentials
   and callback tokens out of evidence. No service-role or Stripe key required.
2. Start the current browser preview with Node 24 on PATH:

   ```bash
   BROWSER=none pnpm --filter @tapuai/mobile exec expo start --web --localhost --port 8086
   # or port 8081 / http://127.0.0.1:8081 when that is the allowlisted origin
   ```

   Open that origin and allow the Google popup. Record the build/origin;
   an already signed-in browser session is not evidence of a new Google signup.
3. With a Google account allowed by the development testing audience, test **Create an account**
   and **Sign in** separately. New accounts require the existing birth month/year check, create a
   fan profile and require no bank details. Returning users must retain their own canonical profile.
4. Start from an intercepted account-required action. Complete Google and verify the intended
   action/draft resumes. Repeat cancellation and blocked popup recovery; the draft should remain
   and retry should be usable. Check a failed/empty callback with a controlled fixture, without
   pasting real tokens into the URL or bug report.
5. Record successful browser account/session completion separately from provider enablement.
   Provider-disabled or `redirect_uri_mismatch` errors require the setting checks in ONBOARDING;
   they are failures, not accepted signup. Do not change unrelated account/provider settings.
6. Install a current native development client and separately verify its actual generated return,
   normally `alasports://auth/callback`, is allowed in Supabase. Test iOS and Android return,
   cancellation, interrupted-action recovery and sign-out/account switching independently.
   Browser completion does not accept native callbacks; an Expo Go URL may use a different scheme.

Successful Google account completion, provider cancellation/blocked-popup recovery and native
cases remain **UNRUN** until an executor records them. The local synthetic failed-callback
cleanup/navigation result is recorded in APP-TEST-01 above. Bank onboarding has its own
SQL/Edge/private-server prerequisites below; it is not part of creating a Google account.

## Google account to later Stripe test bank — development rehearsal

**Prepared 2026-10-21; manual walkthrough UNRUN.**
**2026-11-12 staging probe (agent env `tucioqipfejqqqtuakdi`):** Connect RPCs and Edge
`create-stripe-account` all **404** — do not start the bank walkthrough until the owner applies
[ONBOARDING bank prep](../ONBOARDING.md#development-account-to-bank-preparation--2026-10-21) and
confirms. Historical guide also names development `ulfapgtabidorgwfjvwz`. Stripe **test mode**
only. Source/build receipts: [STATE.md](../STATE.md) §4 ·
[payee plan](design/PAYEE_VERIFICATION_PLAN.md) §10 ·
[COORD-01 B](../agents/COORD-01.md#app-test-b-connect-prep--2026-11-12-utc). Google provider is
enabled on staging; full Google signup receipt is still separate. Local Metro bank fallback still
needs its private service-role template when not using hosted Edge.

### Operator preparation

1. Follow [ONBOARDING.md](../ONBOARDING.md#development-account-to-bank-preparation--2026-10-21)
   for the reviewed migration, compatible Edge deployment, Google settings and exact callback
   allowlists. Record each result before starting. A local fallback additionally needs the filled
   private copy of `apps/mobile/src/backend/api/test-server.env.example`; hosted Edge already
   receives Supabase's builtin service-role key. Keep server credentials outside Expo env files.
2. Confirm both Stripe publishable and server keys are test keys. Use Stripe's published synthetic
   Connect fixtures in Stripe's portal. Never enter real bank, tax or identity information for this
   rehearsal, or copy it into Tapua'i, screenshots, logs or feedback.
3. Prepare separate synthetic accounts: a new Google fan, an eligible adult athlete, an adult
   guardian, two selected athletes with separate custodial records, an unrelated account and two
   independent admins. Use existing setup/verification paths; do not toggle payout approval to
   make a bank test pass. The guardian fixture needs a current confirmed link, donations consent,
   a verified undisputed athlete, matching roster/custodial ownership, a future handover date and
   current relationship evidence approved by two independent admins in Expo `/admin/people`.
   Guardian consent remains a draft: these are internal synthetic fixtures, not real-family activation.
4. Use a current SDK 58 browser build and a native development client. Older installed previews
   may lack these repairs; Expo Go does not accept native Stripe modules. Record the exact build,
   platform, selected athlete and server source. Use controlled local mocks for malformed responses,
   server failures and delayed requests; do not alter shared hosted data to force those failures.

### Account creation, then optional adult bank setup

1. As a guest, open an account-required action and choose **Create an account → Continue with Google**.
   No email/password fields or bank questions are required. Complete Google and the existing birth
   month/year check with synthetic data; a fresh account is a fan, without an athlete claim or KYC.
   The interrupted action/draft should remain in the browser popup flow. Repeat with **Sign in**.
2. Cancel Google and simulate a blocked popup. Recovery/retry should remain usable, no bank should
   be created and the interrupted draft should remain. A Google server error is not proof of enabled
   provider configuration. On native, separately verify the actual app callback; web success does
   not accept the native return.
3. Sign in as the eligible adult athlete. Open the bank card in Profile management after the
   canonical profile loads. It is optional and separate from account creation. Read Terms and use
   the initially unchecked acknowledgement if needed. The button must wait for current, confirmed
   acceptance; failed or old-version acceptance cannot be waived by a device cache.
4. Choose **Continue to Stripe test bank setup** once. Only a confirmed server binding may produce
   a Stripe portal link. Complete the synthetic portal, then return and refresh status. Describe the
   result as **Stripe test setup submitted** when onboarding reports completion; it does not prove
   bank ownership, identity, TIN or payout eligibility. Cancel and retry as a separate case.
5. On web, verify a fixed `/profile` return. On native, verify the app resumes and requests current
   status. Review **Manage test bank** separately from initial setup; a submitted status must not be
   relabeled as independent verification.

### Guardian setup for exactly one athlete

1. Open `/parent` as the fixture's adult guardian and select the first athlete. Enter the synthetic
   custodial birth date and bank-name answer, choose **Save**, review the handover date, then choose
   **Confirm test record**. This is a record/attestation step, not a Stripe bank connection. Test **Back** before
   confirming; the date correction warning must remain visible on the review step.
2. The separate bank card must check current server status for this exact `playerId` before it
   enables creation. For a compatible unlinked response, accept current Terms if needed and choose
   **Continue to Stripe test bank setup**. Complete or cancel the synthetic Stripe portal.
3. Verify the binding belongs only to that athlete's `custodial_accounts` row. The guardian's own
   Profile binding and the second athlete's binding must remain unchanged. Browser return routes
   to `/parent?playerId=<the selected UUID>`; returning to the second athlete cannot borrow the
   first athlete's status. The custody record, bank-name answer, Stripe binding, provider flags
   and relationship/identity decisions must remain distinguishable.
4. Open the same card as an admin: inspection is read-only. Open it as the athlete before handover
   or an unrelated account: guardian setup must be unavailable. After handover, guardian bank setup
   must stay closed. Do not change real birth dates or relationships for these denial fixtures.

### Required failure and ownership matrix

Full bank/provider/device scenarios below remain **UNRUN manually** until an executor records
actual evidence. The first row names its partial local callback result. Some cases are covered
by synthetic source tests; those receipts belong separately in STATE §4.

| Scenario | Expected result | Manual result |
| --- | --- | --- |
| Google create/sign-in; cancellation, blocked popup and empty/error callback | Bank-free account path; usable recovery; interrupted draft retained in the supported browser flow; no invented athlete/KYC approval. | PARTIAL: synthetic local failed-return cleanup and Back/Forward PASS; successful Google, provider cancellation and blocked-popup cases UNRUN. |
| New account age check; minor attempts self bank setup | Birth month/year rules apply; blocked age/minor cannot open a self bank portal. | UNRUN |
| Terms missing/old version, failed write or stale device acceptance | Current client read and matching account write confirmation required; Retry Terms available; no link on failure. Server first-binding policy still checks a nonnull timestamp only. | UNRUN |
| Guardian status from older Edge, wrong/missing `playerId`, malformed flags, failed status or Edge disappearing after a successful check | Target-specific handshake fails closed; no own-profile fallback or creation replay to an unchecked route. Compatible unlinked responses echo the same athlete; creation stays on the route that passed status. | UNRUN |
| Missing guardian link/consent, revoked or expired evidence, latest relationship pending/failed, dispute, wrong custodian or handover reached | Server denies the selected target; no new binding/link. Existing relationship review is not fabricated from bank status. | UNRUN |
| Missing SQL/local service key, network failure, eligibility change or failed binding save | Fixed actionable error; no portal before confirmed save; retry remains possible. No raw database/provider diagnostics or credentials. | UNRUN |
| Double press; delayed status/setup/Terms/custodial response | One action in flight; stale responses cannot override a newer selection or confirmed status. | UNRUN |
| Sign out, A → B → A account lifetime, athlete switch and unmount while pending | No late navigation, cache write, bank action or displayed result crosses account lifetime/athlete. | UNRUN |
| Cancel portal; submitted setup with transfers disabled; stale cached true versus server false | Refresh actual status, preserve the correct binding, offer truthful retry/manage state; explicit server false wins. | UNRUN |
| Valid native/web return; malformed/repeated athlete return params; non-Stripe portal URL | Valid guardian UUID returns to that athlete; adult/malformed return goes to fixed Profile; arbitrary redirect/portal rejected. | UNRUN |
| Onboarding/transfer capabilities true | No `record_stripe_kyc` inference, bank ownership claim or newly approved identity/TIN/relationship. Existing payout route still returns 503. | UNRUN |
| Keyboard, narrow screen, larger text and VoiceOver/TalkBack | Reach inline birth-date confirmation, Back, Terms and bank retries; labels/disabled state are clear and controls retain at least 44-point targets. Mocked tests do not accept native fit. | UNRUN |
| Optional test checkout/receipt | Separate verified single-credit gate; no new webhook deployment, duplicate credit, live donation or payout inferred from bank setup. | UNRUN |

Bank-only testing does not need a webhook signing secret. A verified payment receipt additionally
needs the correct endpoint signing secret and one reviewed credit path; the existing client-side
donation record and a webhook must not both credit the same payment. Keep that acceptance separate.
Card `4242 4242 4242 4242` is a Stripe **test checkout** card, not a Connect bank or identity fixture.
No real payout, balance verification or handover transfer is accepted by this rehearsal.

### Scoped local checks and evidence

Run from the repository root; these commands check current app source without provider changes:

```bash
pnpm --filter @tapuai/mobile exec jest --runInBand --watchman=false \
  src/backend/api/moneyHandlers.test.ts \
  src/backend/api/session.test.ts \
  src/backend/api/accessToken.test.ts \
  src/frontend/hooks/__tests__/useStripeConnect.test.tsx \
  src/frontend/hooks/__tests__/useCustodial.test.tsx \
  src/frontend/hooks/__tests__/useLegalAck.test.tsx \
  src/frontend/lib/__tests__/custodial.test.ts \
  src/frontend/lib/__tests__/legal.test.ts \
  src/frontend/components/Profile/__tests__/PayoutSetupCard.test.tsx \
  src/frontend/components/Profile/__tests__/StripeConnectReturn.test.tsx \
  src/frontend/components/Custodial/__tests__/GuardianCustodialCard.test.tsx \
  src/frontend/components/Custodial/__tests__/AthleteMoneyCard.test.tsx \
  src/frontend/lib/__tests__/auth.test.ts \
  src/frontend/lib/__tests__/authOAuth.test.ts \
  app/auth/__tests__/callback.test.tsx \
  src/frontend/components/Auth/__tests__/SoftWallModal.test.tsx
pnpm typecheck
pnpm docs:check
pnpm docs:links
pnpm copy:check
pnpm app:data-boundaries
pnpm security:client-keys
pnpm security:no-ssn
```

`moneyHandlers.test.ts` exercises the actual shared money core and Node/Edge adapters with synthetic
providers. It does not execute PostgreSQL. SQL replay for this migration remains blocked locally
by OS PostgreSQL shared-memory permissions and the PGlite download; neither SQL execution nor
concurrent database locking has a passing receipt. Use ONBOARDING §5 for the remaining app guards.

For each executed case record: executor/date, source hash/build, development project, browser/device,
synthetic actor/selected athlete labels, scenario, expected/observed result and redacted screenshot
or log reference. Record failures and UNRUN prerequisites explicitly. Do not attach tokens, callback
credentials, service keys, bank/identity values or raw provider responses. Current source tests and
these prepared steps do not certify hosted Google, deployed Edge/SQL or native Stripe completion.

## Synthetic photo and video upload fixtures — local preparation

The verified fixture folder on the owner's Mac is:

```text
/Users/seiuliian/Downloads/ala-sports-test-media-20261020-002
```

Its `manifest.json` reports **complete**, 13 verified files and no failures, created at
**2026-10-21T03:00:16.329Z** in **14.957 seconds**. The generator used actual macOS ImageIO and
AVFoundation encoding/decoding. This is local file evidence; it does not accept the app's picker,
upload, server rules, decoder playback, object removal or cloud restore. The files contain labelled
synthetic graphics and no real people. The earlier `-001` folder is a partial run and must not be
used as the completed fixture set.

| Fixture | Verified local file | Intended manual case |
| --- | --- | --- |
| `synthetic-story-01.jpg` through `synthetic-story-10.jpg` | Ten distinct 1080 × 1350 JPEGs | One-photo and ten-photo story selection, paging and sanitized upload. |
| `synthetic-video-8s.mp4` | 8-second H.264, 118,185 bytes, 96 decoded frames | A short video within the current client duration/byte caps. |
| `synthetic-video-46s.mp4` | 46-second H.264, 683,984 bytes, 552 decoded frames | Duration rejection when the returned picker asset is still longer than 45 seconds. |
| `synthetic-video-8s-over-8MiB.mp4` | Valid 8-second H.264 with MP4 free-box padding, 8,388,609 bytes, 96 decoded frames | Byte-cap rejection when the bytes submitted remain above 8 MiB. |

On another supported Mac with Xcode Command Line Tools, generate a fresh folder outside the repo:

```bash
pnpm app:test:media --out "$HOME/Downloads/ala-sports-test-media-fresh"
```

The command refuses an existing path and exits with a partial/failure result when native creation
or verification fails. Choose a new path for each run and use only a **complete** manifest; retain
its hashes with the test receipt. Generation is local and does not upload files.

Current local source normalizes web picker seconds and native picker milliseconds explicitly,
carries the normalized duration through submit, and checks it again before compression/Storage.
Unknown, nonfinite, zero or over-45-second metadata is rejected. These client metadata checks do
not establish server file-duration enforcement; actual platform/picker behavior still needs testing.

Manual upload steps, all **UNRUN**:

1. After the appropriate app account/Storage prerequisites are met, select the short MP4 and
   confirm Review/Publish and actual playback. For native selection, import synthetic files into
   the device's photo library. Confirm keyboard/navigation and current rights checks remain usable.
2. Select one JPEG, then all ten; verify ordering, preview/paging, caption/credit and published
   photos. Fail/close an upload and retry as the same owner; actual hidden-row and physical object
   cleanup need the applied cleanup SQL and their own observed receipt.
3. Select the 46-second file without trimming. Verify rejection if the picker returns an asset
   still over 45 seconds. An editor can trim it to 45 seconds or less; acceptance of that shorter
   returned clip is not a duration failure. Record the returned duration/platform for this case.
4. Test the oversized MP4 in the browser, where native compression does not remove its padding,
   or verify the actual resulting byte count before asserting rejection. Native compression may
   produce a valid smaller file that the app should accept. The enforced client byte cap is
   **8 MiB after processing**, not a promise to reject every originally oversized source file.
5. Keep longer-video uploads **off until costs are measured** and live streaming deferred.
   Negative fixtures do not enable either feature. Record actual upload/playback errors and
   platform/build evidence separately from these local file-generation results.

### Observed local navigation — 2026-10-21 UTC

Root checked `http://localhost:8086` at **390 × 844** in a browser with a **previously signed-in
session**; account settings offered Sign out. This was not a fresh guest, signup or auth-gate test.
The observed path was Home → Activity → Spotlight → Profile → Upload → library modal → Cancel
→ account settings. Activity and Spotlight each had a 390-pixel document width; the Activity
screenshot was reviewed. These checks accept only those observed navigation/layout states.

The file dialog was cancelled and left no file input to drive. No media was selected/published,
and actual picker metadata, upload, browser decoding, Google sign-in and Stripe bank writes were
not tested. Their manual cases above remain **UNRUN**.

The original root log `/tmp/app-testing-mobile-final.log` records **226 suites / 2,193 tests PASS**
in **138.861 seconds**. Root also reported both app typechecks and 13 scoped app/source guards
PASS. These are local source checks, separate from the navigation receipt and provider/device
acceptance. Current source hashes and independent review are in
[media plan §6](design/MEDIA_SERVICE_PLAN.md#6-current-app-testing-preparation--2026-10-21-utc).

## Everyone — Watch (does it feel like TikTok?)

1. Open the app and scroll Highlights for two minutes without stopping.
2. Double-tap to drop Aura. Try Seki and Flex. Tap again to take one back.
3. Tap an athlete's name to open their profile, then come back.
4. Hide one clip. Report one clip (pick any reason — it is a test).
5. Post a clip of a teammate and choose that athlete. Then find it on their profile — it should say
   "🎥 Filmed by" you, and after a few friends each watch it for 3+ seconds the ▶ count on the poster goes up.
   On a build with the current upload flow, also try **Tag later** on a video: it can publish without an
   athlete, shows "Not tagged yet", and Donate stays off until an athlete is tagged. Photo stories still
   require an athlete before publishing. Check STATE §0: the October 11 night previews lack Tag later.
6. Tap "🎥 Filmed by" on a friend's clip: send Props (once — the button should lock), and check the
   filmer card on your own Profile (tier, clips, views, Aura from filming). Look for your friend on
   Spotlight → Boards → Top Filmers 🎥.

Tell us: *How long before the first video played? Did anything stutter, go black, or jump? Did the
hype taps feel satisfying? Would you keep scrolling?*

## Browser playback repair follow-up (PLAY-01)

Use a build containing PLAY-01; the older queued previews do not contain this repair.

1. Play a known valid video. Scroll away/back quickly, open/close its profile, and
   toggle sound. Repeat while a clip is loading: no red error overlay should appear
   from an interrupted play request, and an offscreen or locked clip stays paused.
2. Use an existing known failed clip or an approved local invalid-media fixture.
   It shows **This Highlight couldn't play.** and **Retry**, rather than an uncaught
   exception. Retry starts one attempt; leaving the clip still works. A bad hosted
   file can fail again—Retry does not repair its contents or format.
3. Verify keyboard and screen-reader access to **Retry this Highlight**, a minimum
   44-point touch target, and readable text at narrow/large native text sizes.
4. A failed/loading/paused clip contributes no playback time to the view threshold.
   A valid focused unlocked clip still counts after real playback, using the existing
   threshold. Photo stories retain their photo-loaded rule and horizontal paging.
5. On iOS and Android, verify slow replacement, rapid focus changes, lock/unlock and
   returning from the background. Successful bundle exports alone do not accept
   native decoder readiness, VoiceOver/TalkBack or device gestures.

## Profile sport and navigation follow-up (2026-10-07)

1. Use Football, Volleyball, Basketball, and unknown/ambiguous position profiles. Hero, Stats and
   Aura card must share sport. Volleyball uses Matches/Kills/Digs and its measurables; no football
   yards or 40-yard tile. Recorded zeroes remain zero, absent totals are dashes. Change an owner's
   chosen sport: old totals/logs from another sport must not be relabeled.
2. Open Goals directly: wishlist is first, Rally follows; donation review and locks still operate.
   Open Stats: no wishlist below it. Open Team, choose another athlete, and return with Back.
3. Open your exact linked athlete: Manage has inbox/thank-yous/Vault tools. A same-name public
   athlete retains Donate/Join but no owner tools. Community profile shows no borrowed stats.
4. Rapidly switch profiles while requests are slow; old identity/totals must not flash or overwrite
   the new athlete. Hide school: hero/Aura/Team must not restore school/crest from the roster.
5. Check compact hero, wrapping navigation and 44-point controls at narrow/large native text;
   readers announce selected tabs, Aura progress and subscription's one-time price. Check Aura
   identity/stats flip, avatars, payment and native navigation on devices.
6. After approved staging application of `20261007211500_public_profile_sport.sql`, confirm public
   selected sport while private bio/social/stats remain hidden; older DBs must remain usable.
   SQL is prepared locally; this is an unrun hosted acceptance check.

## Sports identity — Local, Profile and Highlights (UX-03)

Historical UX-03 verification passed `pnpm check` (both typechecks, 55 suites / 261 tests and all guards).
Browser Bridge checks and controlled 320/390-pixel fixtures are recorded in [AUDIT_REPORT.md](AUDIT_REPORT.md).
CSS 200% text checks do not certify native font scaling; native checks below remain pending.
Record build, device/viewport, text scale and reader
used; use existing recorded test data or controlled fixtures for missing/scheduled/final states.

1. Open Local with long team and school names. Each score must sit beside its own team, names
   and venue must remain readable, and View game & roster must open the existing game route.
   Letter tiles are neutral identifiers, not confirmed school crests.
2. Check scheduled, live, halftime, final and unavailable data. Scheduled/final must override
   stale running clocks; scheduled scores are dashes, missing live/final scores are unreported,
   recorded zeroes stay zero, and untimed sports do not acquire a clock.
3. Open your athlete profile and another athlete’s profile, including a different athlete with the same name. Check supplied sport/position/class
   only; the other athlete must not inherit your sport/class. Open a community profile: it must
   hide athlete credentials and a favorite athlete’s school-confirmation crest. Test jersey zero, a long name/position, Aura flip and avatar editing;
   school crests must still require the existing confirmation.
4. On Highlights, check actual jersey/position when present and no invented roster details when
   absent. Tap the athlete name, react and open Donate. With a long name, school, caption, account
   mentions and filmer credit, check that the live banner and action rail do not overlap or hide
   necessary controls. Enlarged copy and the rail scroll below the measured header; reach More/Donate
   after scrolling and verify video paging/owner peek still work outside those scroll columns.
   Test narrow screens and large text while playing/paging clips.
5. With VoiceOver/TalkBack, check athlete heading/details, scoreboard status and each team’s
   score, unavailable score wording, profile action disabled state and scoreboard dismissal.

## Upload composer — phone layout and keyboard

1. Tap Upload. The first screen has only video selection. Pick a clip; Details opens with a preview.
2. Add a caption and select the athlete/category. Next stays visible above the home indicator;
   on a short phone with the keyboard open, only this page may need a short scroll.
3. Next opens Review. Open More options to add accounts, a game or Vault access. Tap Done: all choices remain.
4. On Review, each rights confirmation is initially unchecked; Publish requires every
   confirmation applicable to the selected category. Back returns to the same caption and athlete.
5. Replace the clip and return to Review. Rights must be checked again for the new footage.
6. Try a game/athlete search and cancel the library picker. The draft should remain intact.
7. Double-tap Publish: there should be only one upload. If optional mentions fail after upload,
   the clip stays published and the warning identifies the unsaved mentions.
8. Close/reopen the composer. It starts at video selection with the old draft cleared. Check
   screen reader labels, larger text and Android Back on each subpage; no essential action is
   hidden in a long scroll.

Record phone/window size, keyboard state and screenshots. These are device checks; mocked
component tests do not establish visual fit or native picker behavior.

## Beyond on the Highlights bar and the Upload chooser (2026-10-16)

1. On Highlights, the top bar reads **Home | Beyond | Local**. Tap **Beyond**: only workout (💪 Train Like Me) and service (🤝 Serve Like Me) clips play, full screen, with Seki / Aura / Flex and Donate. The clip's badge sits below the banners, not under them.
2. Tap **Fan workouts, service, learning and stories ›** under the bar: the Beyond the Game page opens with **‹ Highlights** at the top. Back returns to Highlights.
3. If there are no workout or service clips, Beyond says so and offers **Share a clip** and **Open Beyond the Game**.
4. The bottom bar is Home · Activity · ＋ · Spotlight · Profile (no Beyond tab).
5. Tap ＋. Where Beyond posting is switched on, a sheet asks **What are you sharing?** — **Highlight** opens the clip composer, **Beyond moment** opens the Beyond composer. Where it is off, ＋ opens the clip composer straight away. Feel question: was it obvious which one to pick?
6. Which of these would you actually say about your workout: "Seki Set", "Extra Rep", "OT" or "Two-a-Day"? Write down the one you remember tomorrow.

## Photo stories in Highlights (UX-05)

Needs `20261007230000_photo_stories.sql` applied to the project the build points at (approved
staging application only). Without it the Upload sheet hides **Photos** and the feed shows
videos only — that is the expected fallback, not a bug. Use photos of yourself, of adults who agree,
or of a teammate whose parent agreed; this is a real public bucket.

1. **Post.** Upload → Media → **Photos**. Pick 5 photos (try 11: the picker should stop at 10).
   Use **Move earlier / Move later** to reorder and **Remove** one. Screen readers should announce
   each button with the photo number.
2. **Describe.** On Details add a caption, tag the athlete, choose **Serve Like Me**, and give two
   photos a description — e.g. *"Our team helped clean the neighborhood park this Saturday."* Try a
   description over 200 characters: it should stop at the limit. Categories read **Game Day**,
   Train Like Me, Serve Like Me (no "Game Play" anywhere — videos too).
3. **Confirm and publish.** Review shows the photo wording *"I took these photos or have permission
   from the people in them."* — unchecked until you tick it. There is no Vault option for photos.
   Publish shows "Uploading photo 2 of 4…". Go Back mid-draft first: the photos and order stay.
   Turn on airplane mode during upload once: nothing should publish half-done, and Retry keeps the draft.
4. **View and swipe.** Find the story in Highlights. Swipe left/right through the photos inside the
   card while up/down still moves between Highlights. The `2 / 4` chip and dots follow you; each
   description shows above the caption. VoiceOver/TalkBack: each photo reads its description (or
   "Photo 2 of 4") and swipe up/down moves between photos. On the athlete's profile grid the poster
   shows the first photo and `📷 4`.
5. **Donate from it.** Tap **Donate** on the photo story: the popup names the **tagged athlete** (not
   you, the poster) and runs the same Amount → Options → Review steps with the 90 / 10 line. Hype,
   save, report and "🎥 Filmed by" work like a clip. Report it once (any reason) and check it leaves
   your feed.
6. **Location check (device).** Post a photo taken with location on. Ask whoever runs the wave to
   download the uploaded file and confirm it has no GPS/EXIF and is not rotated sideways. Record
   phone model and OS — this is the device gate unit tests cannot close.

Tell us: *Was it easy to pick, order and describe photos? Did swiping a story ever fight the feed?
Would you post a Serve Like Me story?*

## The message — Donate. Elevate. Celebrate. (BRAND-01)

1. **Welcome.** Fresh install (or clear app data): the first-open card shows the mission, then
   **Donate. Elevate. Celebrate.** and *Support their journey. Elevate their opportunities.
   Celebrate their story.* The big title above it is still the screen's title.
2. **Donate sheet.** Open Donate anywhere: a small **Donate. Elevate. Celebrate.** line sits at the top
   of the Amount page, above "Choose your donation" and the 90 / 10 line. It is gone on Options and
   Review, which stay plain.
3. **Profile.** Open another athlete's profile: the small line sits under **Donate**. It must not show
   on your own profile, on a community (fan) profile, or when Donate is switched off.
4. With a screen reader the line reads as plain text, not a heading. At large text it wraps and
   never covers Donate or Share.

Tell us: *Did the line make it clearer what Tapua'i is for? Did "Elevate their opportunities" sound
like a promise? (If yes, tell us — that matters.)*

## Donate popup — short steps and review

1. Open Donate from a Highlight, profile, gear goal, Rally and QR link. Confirm the recipient
   and source remain correct while moving through Amount → Options → Review in one popup.
2. Choose a preset, then Custom. Reject blank, zero, negative and malformed amounts. Back/Next
   remains reachable with the keyboard open on a small phone; Back preserves the amount.
3. Options starts at **No tip** for Tapua'i and unchecked card-fee coverage. Choose optional
   amounts, go Back, then forward again: the choices and calculated total remain consistent.
4. Review shows donation, optional tip, optional card-fee amount, total and the 90 / 10 split.
   The gift-held notice remains present when applicable. No payment starts on Next.
5. Tap the final Donate action twice: start one payment. While payment is preparing, Back,
   close and Android Back must not discard checkout. Cancel Stripe: selections remain and
   another attempt is possible. Check failure messaging, retry and one recorded test donation.
6. Close/reopen after cancellation; a new popup starts on Amount with default optional choices.
   Check screen-reader labels and 200% text scaling. Record device/build/window and screenshots.
7. On Review, tap Close and immediately tap Donate while the card slides away. No payment
   should start. Check Android Back and backdrop dismissal as well.
8. With synthetic test data, simulate a recording/counter failure after Stripe succeeds.
   The popup says payment was received and removes Donate; it must not invite another charge.
9. Change the recipient during an inline checkout and let the old test payment finish.
   The new recipient must not show the old thank-you or inherit its donation/count callbacks.
10. Use a screen reader on card-fee coverage: it announces the exact added fee and that
    the family's share stays the same. Record device evidence rather than inferring it from Jest.

## Web sidebar account settings

At desktop and tablet browser widths, expand **Account settings** in the left rail. Check profile, privacy, notifications, account capability and legal controls open their existing panels, Close returns to the page, and labels stay readable in the wide rail. The compact rail must retain accessible button names. Guests see Sign in and legal only; changing accounts must close outgoing private panels. With Profile paused the section is hidden. Confirm the phone app and narrow web layout have no new rail.

## Welcome to Highlights — first phone visit

1. Use a fresh test install or isolated app storage. Open the welcome and tap **Watch highlights**. Expect Home to open on a public Highlight without an optional Spotlight or account prompt on that first clip. Check muted playback and that the athlete and school are legible above the dock.
2. Repeat with a slow or unavailable network. Expect the branded artwork while loading, then the clip or a Retry Highlights button; reconnect and retry. Decorative art should disappear when the actual video plays. A feed with only Vault videos must not open an unlock prompt.
3. Relaunch and confirm the welcome stays dismissed. On another fresh test profile, confirm **Sign in** still opens the existing account sheet.

## Home and Local search — phone layout and history

1. Open Home Search and tap Local's empty search field with existing recent searches. Check that the icons and query labels line up, newest terms are at the top, and longer terms wrap without hiding the trailing arrow. Repeat with Android font size increased and the keyboard open.
2. Open a result in one tab and confirm the query appears in the other. Tap a recent term, scroll the results, and switch the filter or replace the query while a request is pending; previous results should disappear immediately. In Home, check two same-named athletes with different schools can both open.
3. Tap Clear all and confirm the list is empty in both tabs after an app restart. Close search and check the Home feed or Local hub is usable again.

## Shared menus and page energy

Use [MENU_STYLE_MAP.md](MENU_STYLE_MAP.md) to cover every modal family and page shell. Check
rounded cards, jade/cyan/gold/violet accents, readable labels, close controls and visible focus
with reduced motion and larger text. Include Profile menu/edit/Aura, search/report, sign-in,
Rally/thanks, legal/verification, Drip and enabled role HQ menus. Video player and operator/admin
workspaces retain their functional contrast and density. Verify no sheet overlaps the keyboard
or home indicator. A shared token update does not establish device fit for every consumer.

## Fan — Compete (is it fun to root for your school?)

1. Open Spotlight and find this week's standings. Is your school's athlete on it?
2. Home → Local pill: vote in a cheer poll if one is open.
3. Upload a clip from a game (any sport) and tag the athlete in it.

Tell us: *Did you feel like you were competing with the other school's fans? What would make you
check the standings every week? (Most-viewed Highlight and school-vs-school boards are coming —
tell us what you'd want on them.)*

## Fan — Rally (is giving effortless?)

1. From a Highlight, tap **Donate** and donate to that athlete with the test card. Check the sheet says where the donation goes.
2. From an athlete's **profile** (no clip open), donate again.
3. Find an athlete with a Locker goal and donate toward it.
4. Open Profile → Receipts and find all three gifts.
5. Open Activity and check what you see.
6. **Check the sheet.** Before you pay, it should say 90% goes to the athlete's family and 10% to
   Tapua'i. The **tip for Tapua'i** should start at **No tip** and the card-fee box unchecked. Pick 10%
   and tick the box — the breakdown line should add both and show the new total.
7. **Rally.** Find an athlete with a Rally card on their profile. Donate to it — the bar should move
   after the sheet closes. If your donation fills it, you should see confetti.
8. After the athlete thanks you (see Athlete step 7), open Activity: you should see "{athlete} said
   thanks" with their message.

Tell us: *How many taps from "I want to support this kid" to done? Where did you hesitate? Did it
feel like a gift to the athlete, or like paying for a clip? Did it feel exciting when it went
through?*

## Parent (or someone standing in for one)

1. Find your linked athlete and try the consent toggle. You should see **only** athletes linked to
   you, never the whole roster. (We link you after checking who you are.)
2. On your athlete's card, enter their date of birth and answer "Is the payout bank account in the
   athlete's name?" (We strongly encourage yes.)
3. Ask your athlete to approve a small withdrawal, with a note ("cleats"). Then check it says it
   is waiting on them. Try cancelling one too. (Nothing is paid out in this build — it records
   the request only.)
4. **Rally.** On your athlete's Rally card, tap **Start a Rally**, pick "Gear", name it "New cleats",
   goal $30, and start it — it should go live at once. (If your athlete started one, you should see
   **Approve this Rally**.) Share it, then have two test fans fill it.
5. When it fills, tap **Say thanks to everyone 🙏**, pick a clip and a message. Fans should see it on
   the card. Under "Support received", thank one donor with **Say thanks 🙏**.

6. **Share & Donate QR.** Under your athlete, tap **Share & Donate ⚡ · {name}**. Save the QR, then
   open the copied link on a second device signed in as a test fan: it should open **Support {name}**
   with **Donate to {name}**. Donate with the test card; the receipt should say it came via QR. Change
   one letter in the link: the page should say it couldn't find the athlete, with no Donate button.
   (Printed codes open `https://tapuai.app` unless the build sets `EXPO_PUBLIC_WEB_ORIGIN`; that site
   is not hosted yet, so test with the in-app link until it is.)

Tell us: *Would you trust this with your kid's money? What would you need to see first? What would
make you share your kid's page with family?*

## Athlete — Rise (does it make you look recruitable?)

1. Claim your profile and enter your school code (we will give you one directly). Your profile
   should say **Verification pending**, and Activity should tell you gifts are held until your
   school confirms you.
2. **Get confirmed.** On Activity tap **Show my school code**. Show the 6 digits to whoever is
   playing your athletic director or coach; they type it into the school form link we sent them,
   tick "met in person", sign, and tap **Confirm**. Pull to refresh Activity — the card should go
   away and your ⚡ badge turn on. (Confirmers: also try a wrong code and "Not on my roster".)
   Your profile should now show your school's colours behind your photo and the school crest on
   the edge of the ring. Tap the crest — it should say who confirmed you and when.
   (Whoever runs the wave sets the crest first:
   `select public.admin_set_school_branding('<school id>','https://…/logo.png','#1D3F8F','#FFFFFF');`)
2b. **Vouch.** As a confirmed athlete, open Activity: pending teammates at your school appear
   under "Vouch for teammates". Tap **They're on my team** — the count goes up by one.
2c. **Aura card.** On your profile tap **Flip Aura card**, then use **Identity / Stats**
   under the card and swipe the card itself. It should flip every time and nothing should overlap.
3. Upload a Highlight tagged to yourself.
4. Look at your profile's Highlights, Stats and Vault tabs. Lock and unlock a Vault clip.
5. Start Stripe Connect onboarding (test mode — use Stripe's test data, not your real details).
6. Open **Activity**. The card at the top should say who holds your donations and until when. When your
   parent sends a withdrawal request, approve one and decline one. (Needs a verified athlete
   account and a linked parent.)

7. **Say thanks.** On your profile, under "Support received", tap **Say thanks 🙏** on a donation and
   pick a message. It should change to "Thanked ✓". There is no way to type your own message — on
   purpose. Try **Start a Rally** too: it should say it is waiting for your parent or guardian.

Tell us: *Did the money card make it clear the money is yours and nobody can take it without
you? Would you send this profile to a college coach? What is missing? What would make you
proud to share it?*

## Proven athlete — Pass it on (Train Like Me / Serve Like Me)

For an older athlete (college or senior) the younger ones look up to.

1. Upload (+) and pick the **Train Like Me** category: a drill, a workout, a routine.
2. Upload one **Serve Like Me** clip or photo story (it earns double Aura): how you give back (family, church, school, community).
3. Have a younger tester find both clips in the feed.

Tell us: *Would you keep posting these? What would you want fans to be able to ask you? Would you
do a 1-on-1 with a young athlete if the app kept it safe and a parent was there?* Younger testers:
*What would you ask?*

## Booster

1. Home → Local pill → Top Boosters: pick a sponsorship tier and check out with the test card.
2. Find where your business appears afterward.

Tell us: *Would a local business pay for this? What would make matching an athlete's goal
appealing?*

---

## Main admin — ADM-02 hosted and device follow-up

The main application is Expo `/admin`; the local `:3033` report preview supplied the
design. [ADM-02](../agents/ADM-02.md) records local synthetic-data evidence.

1. With a staging admin account, open Home, Trends, Audience, Revenue, Health,
   Product, Analytics and Departments, then all four Product oversight pages.
   Check real source permissions, missing donation-band notices and the ledger's
   test-mode/partial-read notices against the staging data.
2. Use Manage desks and each lens to reach the owning editor. Confirm draft changes
   remain drafts until the reviewed Publish action; perform writes only as part of
   an authorized staging test. Check Back/Home trails and sign-out.
3. Repeat access with a guest, signed-in non-admin and revoked admin. Guests should
   reach the existing sign-in sheet; report data must never cross account changes.
4. On an installed iOS/Android build, check large text, screen-reader summaries,
   complete Data values and native navigation. Bundling alone does not accept this.
5. On the browser, check keyboard Health tabs and Data disclosure, enlarged text,
   full money values and unobscured focus. Record browser-tool limitations separately
   from application failures.

## Engineer/admin telemetry delivery follow-up (HEALTH-01 / DETECT-01-G3)

Use a build containing HEALTH-01. This is the existing QA repair tool under `/admin/qa`,
alongside the aggregate analysis in Health. Run failure injections only in a controlled local
transport fixture or an explicitly authorized test environment; never put real private payloads
into an error probe. Local regression results are in [HEALTH-01](../agents/HEALTH-01.md); the
hosted/device walkthrough below remains unrun until its build/environment evidence is recorded.

1. Open QA on the test device and record the sample time, build and device. A process-local
   delivery view must identify its scope: no previous confirmed delivery is unknown, not proof
   of fleet health. Health remains the source for aggregate periods and operational thresholds.
   An older development singleton without `getHealth` must request a full app reload without
   displaying invented zero counts.
2. Generate one existing synthetic event and flush in the controlled fixture. Confirm successful
   delivery increments only the local delivered count and its timestamp. No new event field,
   personal identifier or raw backend diagnostic should appear in the delivery-health sample.
3. Probe unconfigured, missing-table (`42P01` / `PGRST205`), denied and ordinary failed writes.
   They must remain distinct; a message merely naming `telemetry_logs`, a missing column or
   relationship must not read as a missing table. Rejected rows count loss and are not replayed.
4. Simulate a response lost after a server INSERT and a hung request. The attempted batch must
   never replay; uncertainty is part of dropped, not a separate population to add to it. The
   caller returns after ten seconds and requests abort. If the fixture ignores abort, its
   reservation remains in flight and blocks new sends until it settles; later normal triggers
   can send fresh rows only. Confirm no batch exceeds 15 and queued plus in-flight never exceeds
   120. Overflow increments loss; dropped may exceed accepted because refusal is not admission.
5. Keep one QA source pending or failed while the other completes: the telemetry digest and
   device OfflineQueue must render their own available/unread states independently. Refresh
   repeatedly, change focus and remount during a delayed source read: at most one actual read
   per source may remain pending, including development reload. The UI stops waiting after ten
   seconds but does not cancel transport/release the slot; overlapping requests explain the
   existing pending read. Only real settlement allows a fresh read. No old response may be
   cached/reused or replace the latest sample, including after navigating away.
6. After a later successful delivery, historical failure/time must remain visible. Dispose the
   test logger during a write: buffered rows count loss, unconfirmed attempted rows count
   uncertainty, listeners stop and late success cannot claim delivery. A new process/singleton
   starts fresh counts only after a fresh process/test reset; `getInstance()` retains a disposed
   logger without starting a replacement writer. Neither restores a lost batch or proves
   durable crash intake.
7. Use controlled queued Clear/Unsave actions: labels must describe removal accurately. Keep a
   repair write unresolved: the notice must say its result is unconfirmed and its action lock
   must remain held until real settlement. A read/UI timeout must not unlock or replay it.
   Navigate away before completion: no late follow-up read or success state may appear in a
   newer generation. Replay completion reports the actual remaining count; local labels and
   notices do not change existing offline action semantics or permissions.

Record actual checks/results/date and any unresolved reservation or unavailable source. Route
local failures to TELEMETRY + ADMIN/QA; hosted ingestion/retention to BACKEND + TELEMETRY with
PRIVACY_ENGINEERING, and durable crash intake to RELIABILITY. A successful local sample does
not close those hosted/fleet/device/retention gaps.

## After the session — five questions for everyone

1. In one sentence, what is this app for?
2. What was the best moment?
3. Where did you get stuck or confused?
4. Would you give real money through this to an athlete you know? Why or why not?
5. Who is the first person you would show it to?

## For whoever runs the wave

- Log each P0 (crash, lost money, wrong person charged, data shown to the wrong person) and P1
  (a role can't finish its tasks) from the Admin → Feedback desk.
- **Exit (ROADMAP Phase 3):** every role finishes its tasks with no P0/P1, on a real installed
  build, on staging.
- Ask 3–5 families if they would run a real Rally in the next wave — those become the consented
  stories STORY.md calls for.


## Family activity release rehearsal — FUN-01 / QUIZ-01

These are new required manual checks, not an execution receipt. Local source in codex/fan-zone
is newer than the earlier preview builds. Both pilots start inactive with empty tester cohorts.
Owner-approved hosted SQL/API setup, bounded approved accounts, facts/terms, staffed contact
and school/subject permissions must be ready before an authorized hosted rehearsal. Do not
interpret missing campaigns/questions or an unavailable API as a healthy zero.

1. Check Home, parent/booster/sponsor/operator HQ and profile from each eligible role. Open
   the root activities, use Back and account Home, and check small screens, keyboard and
   screen readers. A guest or unlisted account must not acquire private campaign access.
2. Quiz: choose a sport explicitly; answer one question, including an incorrect answer.
   Check the explanation and private Sport Learner completion badge. Retry a lost answer
   response with the same request/choice; another sport must not issue a second question
   that week. A right answer adds 5 Aura to the card. No money, fan vote or public school points change.
3. Compare local Not now with server-confirmed Skip this week. Simulate a failed Skip/read:
   do not claim it saved. Refresh and check private prior badges/corrections while paused.
   Verify the canonical UTC Monday boundary on the server; device clock is not authority.
4. Fan entry: reserve a private clip revision, check compression/sanitization/verification,
   and interrupt the response. Retry without overwriting the reserved object. Review the
   exact video/caption/scope. Change that scope from another authorized session; the old
   grant must be refused and fresh playback plus confirmation required. Test unavailable
   refresh and ensure an old grant-capable permission panel cannot remain.
5. Teen/guardian: keep assent and grant separate. An active linked guardian can review the
   selected campaign privately even when not enrolled to participate. End/revoke the link
   or change the media revision; subsequent reads/exposure must fail. A different historic
   grant must not silently replace the explicitly relied-on grant.
6. Free ballot: test one account ballot, replacement version, lost response and a second
   device change. The final current ballot comes from a fresh server read, not the replay
   receipt. Check close deadlines, self-vote refusal, invalidated votes, ties, zero votes
   and reviewed recount. Donations must not buy entries, ballots or award advantage.
7. Help & Safety: submit a real bounded concern and save receipt/secret. Check expiry,
   authorized contact and explicit missing guest fallback. Withdraw separately from
   requesting removal; remove every tracked historical revision and confirm actual Storage
   absence before declaring completion. Exercise partial removal and provider failures.
8. Curated story navigation must open the same authorized athlete profile/Donate path.
   Optional private service reflections can be deleted and must add no money, Aura, votes
   or public badge. Change accounts during reads/actions and ensure no old private state,
   draft or late media bytes attach to the new identity.

ADMIN/SUPPORT and independent QA record actual dates, actors, platform, source/deployment
hashes, failures and repair evidence. Legal/Privacy/Minor Safety/Content/Rights/School review
release terms and permissions; Growth checks accepted return/participation/support/cost
measures in the October 20 packet. These source checks do not certify real-world guardianship,
moderation capacity, hosted deletion or growth uplift.


## MULTISPORT-01 / UX-09 — Next local and device checks

1. Athlete Profile → Edit → My Sports: add Basketball beside Football, enter its own team/position/jersey;
   Save keeps Football primary. Switch profile chips and verify credentials/stats/tagged Highlights change,
   field artwork stays primary, and All includes old unassigned content. Remove primary and choose replacement.
2. Keep an unsaved draft through Back/reopen; failed/unavailable/revision-conflict saves preserve it. Switch
   account/athlete while reads/save run; earlier private results must not reappear. Verify school/stats hiding,
   blocks, private accounts and minor/guardian audiences after the owner applies SQL.
3. Upload video and photo: optional explicit sport survives steps/Back, preserves required rights/caption/tag
   checks and atomic insert; missing source blocks the requested tag without losing draft. Reload sport choices retries in place; explicit No sport remains usable. Empty stored catalogs must not offer starter sports.
4. Admin Sports corrects primary/list; Highlights corrects/clears recorded sport; Stats classifies unknown or
   corrects the original sport without replacing id/date/values. Catalog usage includes secondary participation. Retry published choices in either editor and confirm the edited draft survives.
5. Local: Games/Polls/Boosters labels remain visible; sponsor rail/CTA appears in Boosters. Check narrow widths,
   enlarged text, card taps, final item reach and keyboard. Dock icons stay readable when background softens;
   scrolling up/stopping/focusing restores it. Test live Reduce Transparency and Reduce Motion on a phone.

Local tests/replay/render evidence and unapplied SQL/device limitations are recorded in
[MULTISPORT-01](../agents/MULTISPORT-01.md) and [UX-09](../agents/UX-09.md).
