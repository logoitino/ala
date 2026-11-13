<!-- Current app sign-in setup and evidence; hosted Google configuration and live payments require separate acceptance. -->
# Tapua'i onboarding

This is the starting point for a new engineer. It gets you from clone to a running app, then
points you at the few documents that matter in your first week.

## Start here

**Read in this order** (about an hour):

1. [../README.md](../README.md) — what the product is, the repo map, how we work.
2. This file — setup (sections 1–6 below).
3. [GLOSSARY.md](GLOSSARY.md) — the code says `tips`, `malo` and `reels`; the product says
   donation, Mālo (thanks only) and Highlights. Read this before you read code.
4. [engineering/ARCHITECTURE.md](engineering/ARCHITECTURE.md) — how the apps, Supabase, Stripe and
   Edge Functions connect.
5. [engineering/CONVENTIONS.md](engineering/CONVENTIONS.md) — where code goes and the comment
   standard every file follows.
6. [STATE.md](STATE.md) — what is happening right now. §0 is the hand-off, §5 is the list of
   things that are knowingly broken (do not re-diagnose them), §6 is decisions only the owner
   makes.

Everything else is listed in the [docs index](README.md).

For an outside engineering company, legal reviewer or investor, use the audience reading paths
and evidence requirements in [Innovation and outside handoff](engineering/INNOVATION_AND_HANDOFF.md).
The owner grants the appropriate document subset; this index does not grant access to private material.

**Your first day:**

- [ ] App running in a development client against the development Supabase project (sections 1–4).
      Use a staging preview build for installed-build acceptance; Expo Go covers only supported
      browsing and upload fallback behavior, without native Stripe or video compression.
- [ ] The app checks in section 5 pass on your machine.
- [ ] Read [Innovation and outside handoff](engineering/INNOVATION_AND_HANDOFF.md): explain one feature's source, owner, permissions, failure/recovery path and evidence; record any unclear step.
- [ ] Skim [DATA_MAP.md](engineering/DATA_MAP.md) for the tables you will touch, and read [DATA_GOVERNANCE.md](engineering/DATA_GOVERNANCE.md) before adding a table, function or export (`DATA_GOVERNANCE` is the data control point).
- [ ] You can find, for one screen, its route in `apps/mobile/app/`, its components in
      `src/frontend/components/<Feature>/`, its hook, and the `lib/` call that reaches Supabase.
- [ ] You know the three environments: **development** (your `.env.local`), **staging** (tester
      builds) and **production** (not created yet — see
      [CODE_ORGANIZATION_PLAN.md](engineering/CODE_ORGANIZATION_PLAN.md), readiness phase R3).
- [ ] Small first PR: confirm the active integration branch in `STATE.md` §0; branch from
      `main` after that integration is merged. Keep the header comment true, add a line to
      `STATE.md` §4 if you touched `apps/`, `packages/` or `supabase/`.

Machine-specific traps on the owner's Mac (blocked npm registry, Watchman, no Simulator taps) are
in [STATE.md](STATE.md) §3; they do not apply to a normal laptop.

Expo **SDK 58**: [https://docs.expo.dev/versions/v58.0.0/](https://docs.expo.dev/versions/v58.0.0/).

This repo is a **pnpm monorepo**.

---

## 1. Clone

```bash
git clone <this-repo>
cd ala-sports
```

---

## 2. Install (pnpm)

Use Node 24, matching CI, and the pnpm version in the root `packageManager` field.

```bash
# If `pnpm` is missing from PATH after Corepack prepare:
#   mkdir -p ~/.local/bin && corepack enable --install-directory ~/.local/bin
#   export PATH="$HOME/.local/bin:$PATH"
corepack enable
pnpm install
```

`shamefully-hoist=true` is set in `.npmrc` so Expo Metro resolves workspace deps cleanly.

Mobile `postinstall` copies CanvasKit WASM into `apps/mobile/public/` for Expo web Skia. Native Expo Go does not need that file.

---

## 3. Environment variables

### Mobile (Expo)

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
```

If you already had a root `.env.local` from before the monorepo move, copy it into `apps/mobile/.env.local` instead of committing it.

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
```

Keep `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_WEBHOOK_SECRET` out of
Expo `.env.local` and public variables: Expo writes loaded env values to
`.expo/dev/logs/start.log`. Checkout and Connect normally use Edge Functions; load the Stripe
test secret privately into the selected project's function secrets. Hosted Supabase Edge
already supplies its reserved `SUPABASE_SERVICE_ROLE_KEY`; do not upload that key as a custom
function secret. See [STAGING_RUNBOOK.md](engineering/STAGING_RUNBOOK.md) for the older staging setup.

The local Metro Connect fallback needs a private Stripe test secret and the **same development
project's** service-role key. Prepare a credential-free copy without overwriting an existing file:

```bash
mkdir -p "$HOME/.config/ala-sports"
cp -n apps/mobile/src/backend/api/test-server.env.example "$HOME/.config/ala-sports/app-test-server.env"
chmod 600 "$HOME/.config/ala-sports/app-test-server.env"
```

Fill that file privately before starting the server. Preserve any existing
`~/.config/ala-sports/stripe-secret.env`; the empty template is not a replacement for its secret.
If using the new file, fill its Stripe test and service-role values, then load it only into the
local server's process:

```bash
set -a
source "$HOME/.config/ala-sports/app-test-server.env"
set +a
pnpm mobile
```

Do not print credentials, enable shell tracing, or include them in screenshots or bug reports.
The webhook signing secret is additionally needed for verified payment-receipt testing; it is
not needed merely to open the test bank portal. A missing local service key does not show that
hosted Edge is missing its builtin key. Connect and payouts confirm the session with live
`getUser`; checkout may use the local bearer-token check first. Payouts remain disabled.

### Soft-Wall auth (Supabase Dashboard)

Browse-first guests can open Highlights, cards, and Locker Room without an account. **Donate**, **Join Crew**, and gear-goal donate open `SoftWallModal` (Apple / Google / Magic Link), then resume the intercepted action.

1. Authentication → Providers: configure **Email**, **Apple**, and **Google** for the intended environment. A read-only development Auth settings request returned HTTP 200 around **2026-10-21 03:00 UTC**: Google disabled, Email enabled, signup not disabled. Google OAuth credentials have not been supplied; the setup below is prepared, not performed. The October 10 observation of Google disabled on development/staging is historical; staging was not rechecked now. Store Google credentials only in Supabase's provider settings.
2. Authentication → URL Configuration: allow the **app return URI**, `alasports://auth/callback`, and each exact web/Expo development return used by `authRedirectUri()`. The current local browser setup below uses `http://localhost:8086/auth/callback`. These app returns are distinct from the Google Cloud provider callback. The native scheme was owner-added on 2026-10-10. Test the actual generated URI for each build/host; the app rejects credentials returned to a different origin, scheme or path.
3. Run fan profile bootstrap SQL once: `supabase/legacy/auth_fan_profile.sql` (also inlined at the end of `apps/mobile/src/backend/db/schema.sql`).
4. Native Apple Sign In needs a build with the `expo-apple-authentication` plugin (`apps/mobile/app.json`). **Share & Fund ⚡** QR save uses `expo-media-library` (Camera Roll / save-photos permission in `app.json`).
5. **Demo Fan (QA):** The account sheet shows **Use test account** with `demo@tapuai.app` / `TapuaiDemoFan1!` (overridable via `EXPO_PUBLIC_DEMO_FAN_EMAIL` / `EXPO_PUBLIC_DEMO_FAN_PASSWORD`) until `EXPO_PUBLIC_APP_ENV=production`. Enable Email provider (password). Disable **Confirm email** for first-tap create, or run `supabase/legacy/demo_fan_account.sql`.

Client entry points: `apps/mobile/src/frontend/lib/auth.ts`, `AuthContext`, `SoftWallContext`, route `apps/mobile/app/auth/callback.tsx`.

Admin oversight: the main Expo `/admin/product` contains Features, Profile, Sign-in and People reports. Coverage, Features, Look and People remain the owning editors under Manage desks. The compatible Next reporting client (`pnpm admin`) mirrors live flags and fan/claim counts (`SOFT_WALL_GATES` + `PROFILE_CHROME_FLAGS` in `@tapuai/shared-types`). Grok Bot ALA roles: [`docs/company/ALA_TEAM_BRIEF.md`](company/ALA_TEAM_BRIEF.md).

### Prepare Google sign-in for development — 2026-10-21

These are operator instructions for the existing development Supabase project,
`ulfapgtabidorgwfjvwz`. **No Google Cloud or Supabase setting was changed by preparing them.**
The read-only check above shows Google disabled; redirect allowlists remain unverified.
Google account access requires the owner to create/configure OAuth credentials before the
browser and native acceptance checks can run. Google setup does not need a Supabase service-role
key; the separate local bank fallback still lacks that private key.

Keep the three URLs in their respective settings:

| Setting | Exact value for this development rehearsal |
| --- | --- |
| Google OAuth Web client → Authorized redirect URI | `https://ulfapgtabidorgwfjvwz.supabase.co/auth/v1/callback` |
| Supabase Auth → Redirect URLs, local browser | `http://localhost:8086/auth/callback` |
| Supabase Auth → Redirect URLs, native development client | `alasports://auth/callback` |

The Google callback returns to Supabase, which then returns to the app using `authRedirectUri()`.
Use the same `localhost` hostname, port and `/auth/callback` path throughout browser testing.
Additional build/host returns need their own exact allowlist entry after checking the generated URI.

1. Sign into [Google Cloud Console](https://console.cloud.google.com/) as the intended project
   owner. Select or create the Google Cloud project used for development OAuth; it is separate
   from the existing Supabase project. Open **Google Auth Platform** (or the OAuth consent/client
   pages under **APIs & Services**, depending on the console layout).
2. Complete the OAuth branding/consent setup: use **Tapua'i Sports** as the app name and the
   owner's real support/developer contact. For personal Google accounts, choose **External**
   with **Testing** audience and add each intended tester under **Test users**. Use standard
   sign-in scopes (`openid`, `email`, `profile`). Keep the audience limited to this development
   rehearsal; publishing or broader Google verification is a separate step.
3. Create an OAuth client with type **Web application**, for example **Tapua'i Sports development
   Supabase**. Under **Authorized redirect URIs**, add the exact Supabase callback in the table.
   The current app uses Supabase's browser redirect flow; JavaScript origins are not needed for
   this flow. Save the client and keep its client ID and client secret private during handoff.
4. Open the development project's Supabase Dashboard → **Authentication → Providers / Sign In**
   → **Google**. Enter that Web client's ID and secret, enable Google, then save. Keep the secret
   in the provider settings; it does not belong in Expo public variables, `.env.local`, source
   control, logs, chat or screenshots. If retaining a downloaded OAuth credential file, store it
   outside the repository with private permissions. It is separate from Stripe server configuration.
5. Open **Authentication → URL Configuration → Redirect URLs** and add the two exact app returns
   in the table. Retain the intended Site URL for the development project; this app explicitly
   supplies its callback as `redirectTo` and must not rely on Site URL fallback. Record the saved
   callback/allowlist values without recording the client secret or returned credentials.
6. With Node 24 on PATH and the development public Supabase URL/anon key in the existing mobile
   env file, start the browser preview from the repository root:

   ```bash
   node --version # must show v24.x
   BROWSER=none pnpm --filter @tapuai/mobile exec expo start --web --localhost --port 8086
   ```

   Open `http://localhost:8086` manually and allow the sign-in popup for that origin. If the port
   is occupied, resolve the conflict before using a different origin; update and verify its exact
   callback allowlist if changing ports. Do not source missing bank credentials for this auth check.
   Expo web checkout uses Stripe.js Payment Element (same `create-payment-intent` as native) when
   `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set — test card `4242…`. Desktop layouts use a phone-width
   column; see [WEB_APP_PARITY.md](engineering/design/WEB_APP_PARITY.md).
7. Recheck development Auth settings through the configured app: Google should now report enabled.
   That setting alone is not a successful sign-in receipt. Run the
   [browser Google checks](engineering/TESTER_SCRIPT.md#google-setup-acceptance--browser-first-then-native),
   including a new account, returning account, cancellation and interrupted-action recovery.
   Record the current build, date, origin, observed result and redacted evidence.
8. Separately install a current native development client with the `alasports` scheme and run
   the native callback checks. The same Web OAuth client is used by this browser-based Supabase
   flow. Verify the actual generated return for that binary. Browser success does not accept
   iOS/Android return handling, and an Expo Go return may differ from a development client's scheme.

If setup fails, check the setting named by the error:

| Symptom | Check |
| --- | --- |
| Google remains disabled / provider not enabled | Saved Google provider enablement and the intended development project. |
| Google `redirect_uri_mismatch` | Web OAuth client uses the exact **Supabase** callback above. |
| Google testing access denied | Correct Google account is allowed in the configured testing audience. |
| App returns to the wrong host or callback is refused | Supabase allows the actual app origin/port/path or native scheme generated for this build. |
| Popup blocked or cancelled | Allow popups for the local origin, retry, and verify the interrupted draft remains. |

References: [Supabase Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google)
and [Google OAuth Web flow](https://developers.google.com/identity/protocols/oauth2/web-server).
Account creation stays bank-free and does not grant athlete, identity/TIN or payout approval.

### Google account creation and later bank setup — local repair, 2026-10-20

Google is offered in both **Sign in** and **Create an account**, without requiring email/password
fields. Apple is offered on supported iOS only. New Google users get the existing base fan profile
and post-auth birth month/year checks; Google does not claim athlete status, school confirmation,
identity/TIN verification or payment eligibility. Profile creation requires no bank details.

The browser flow retains its popup and in-memory interrupted action, rather than reloading the app
and losing the draft. Web skips the old network authorize probe before opening the popup; native
keeps its provider probe. A blocked popup gets a retry/settings message. A disabled Google provider
can still show its server error page in the web popup until the hosted provider is configured;
this local source repair does not enable Google. Other slow browser/SDK conditions and real mobile
browser popup behavior still require provider-configured testing.

Callback completion validates the generated return location, rejects repeated credential/error
fields, preserves encoded token/code values, masks provider diagnostics and shares only simultaneous
completion of the same return inside one JS runtime. Pending entries are removed on settlement;
no returned URL, code, token or completed session is added to a new persisted cache. The callback
screen uses current route/browser input, rejects ambiguous params instead of using an old launch
link, avoids stale navigation after unmount, and shows recovery for a failed/empty return. Failed
browser returns preserve the browser's existing history state while removing query/fragment data,
then replace the Router's stored callback route with `/auth/callback`. The clean replacement keeps
failure recovery visible without retrying the consumed return. Cleanup remains best-effort when
browser history or navigation access is restricted; recovery stays available.

**Later callback cleanup repair, 2026-10-21:** the real local browser initially kept a synthetic
error query after rendering safe recovery. The repaired source cleared that query, with an empty
fragment, on the owned IPv6 preview, kept recovery visible, and retained clean addresses through Back to app and
browser Back/Forward. This checks a synthetic failed return, not successful Google operation or
native callbacks. A warm fragment-only routing transition was not tested. Current execution/source receipts are in the
[APP-TEST-01 tester checkpoint](engineering/TESTER_SCRIPT.md#app-test-01--local-execution-partial-checks--2026-10-21-utc).

**Bank setup remains later:** current local source prepares optional Stripe test setup for an
eligible adult athlete and a guardian's explicitly selected athlete. Guardian accounts bind only
to that athlete's custodial record. The development prerequisites and remaining acceptance checks
are in the next section. Signing in with Google proves account access; eligibility and verified
identity/TIN require their separate checks. Payouts remain blocked.

| Historical Google repair handoff | Actual executor / ownership | Status |
| --- | --- | --- |
| App integration, callback/account sheet, STATE/CHANGELOG/this section | Codex `/root`; shared docs claimed 2026-10-21 UTC | Local integration accepted; shared docs claim released |
| OAuth helper and regressions | Codex `/root/auth_profile_freshness` | Local implementation accepted; 28 OAuth regressions PASS |
| Independent Session Security/QA source review | Codex `/root/connect_kyc_review` | Accepted 2026-10-21 01:39:30 UTC; independent 3 suites / 46 tests PASS |
| Independent Documentation/Data review | Codex `/root/photo_cleanup_sql` | Accepted 2026-10-21 01:45:08 UTC; read-only semantic review, no tests rerun |

**Historical Google repair checks (2026-10-21 UTC / October 20 America/Denver):** focused 5 suites / 78 tests
PASS (`/tmp/ala-google-focused-final.log`); full mobile 217 suites / 1,986 tests PASS, 87.633s
(`/tmp/ala-google-mobile-tests.log`); both app typechecks and 12 scoped app checks PASS. Initial
root callback/account-sheet run had 7 failures / 7 passes; repeated Router params failed before
correction. Worker initial OAuth RED: 8 failures / 5 passes; callback validation RED: 6 failures /
15 passes; safe-error RED: 8 failures / 20 passes. Added 28 OAuth, 9 callback and 2 account-sheet
regressions. These checks do not verify hosted provider operation or live money.

Independent Session Security/QA accepted the six source/test files at 2026-10-21 01:39:30 UTC.
Reviewed SHA256 prefixes: auth`5b6b984c5c83`, OAuth tests`d5a2c11d6c32`, callback`364cd3b3816c`,
callback tests`1012292f5356`, account sheet`7bcee737cff3`, sheet tests`b83a59a737ed`.

Local Expo web browser recovery text/screenshot and Back to app → Home verified; the scoped
error-level browser console was empty. The first agent-window open failed with off-screen bounds;
a background owned tab succeeded. Metro recorded an aborted startup request, so the receipt is
limited to the rendered screens/navigation. Launch disabled dotenv and the shell had no public
Supabase variables, but the browser reused existing app state and showed account settings. The
user was not signed out to force account creation. Signup-sheet browser/provider behavior is
unverified; its nine component tests passed. Independent Documentation/Data accepted 2026-10-21 01:45:08 UTC (actual Codex reviewer;
read-only source/docs review, no tests rerun). The owned browser tab and Metro preview were closed. Hosted Google credentials/redirects, real OAuth/native return, Stripe
bank onboarding, actual payout and release acceptance are not verified. Same-return deduplication
is local to one JS runtime; different overlapping sign-ins and separate browser contexts can still
race at the Supabase session boundary. This repair does not serialize every possible login.

### Development account-to-bank preparation — 2026-10-21

The owner selected the existing development project, `ulfapgtabidorgwfjvwz`, with Stripe **test
mode**. This is a local implementation checkpoint. The new database migration is **unapplied**,
the revised `create-stripe-account` Edge Function is **undeployed**, and the provider/device
walkthrough is **UNRUN**. The later read-only development settings check around 2026-10-21
03:00 UTC found Google disabled; the earlier network failures are historical. Google credentials
and redirect allowlists are not configured/verified by these instructions. Local test receipts belong in [STATE.md](STATE.md) §4 and the
[payee plan](engineering/design/PAYEE_VERIFICATION_PLAN.md) §10.

Prepare the development operator steps in this order; these instructions are not an execution receipt:

1. Confirm the app URL/anon key, server project and Stripe test keys refer to the intended
   development setup. Verify Google's provider settings and the actual app return URI in the
   Dashboard before attempting signup. Keep Google/Stripe secrets off the client.
2. Review the new [Connect context migration](../supabase/migrations/20261021120000_connect_account_context.sql)
   and its MINOR-01, VERIFY-02 and custodial prerequisites against the development database.
   Have the database operator apply that reviewed file and record the result. Verify that
   `stripe_connect_context` and `save_stripe_connect_account` deny direct client execution and
   derive the destination from the live authenticated actor. Local SQL replay was blocked by OS
   PostgreSQL shared-memory permissions and the PGlite download; SQL behavior is not yet accepted.
3. Load `STRIPE_SECRET_KEY` privately into development Edge secrets. After the database gate,
   deploy the compatible function and record its source/build receipt:

   ```bash
   supabase functions deploy create-stripe-account --project-ref ulfapgtabidorgwfjvwz
   ```

   Hosted Edge supplies its Supabase keys automatically. For the local Metro fallback, use the
   private template above instead. Merely having a Stripe test secret does not make that fallback ready.
4. Use a current SDK 58 development client or browser build and the focused
   [tester walkthrough](engineering/TESTER_SCRIPT.md#google-account-to-later-stripe-test-bank--development-rehearsal).
   Record Google signup, native/browser return, bank cancellation and confirmed status separately.
   Use synthetic internal guardian fixtures only; guardian consent still awaits counsel.

Account creation never requires bank details. An eligible adult uses their own Profile bank card.
A guardian selects the athlete on `/parent`, confirms the custodial test record and bank-name
answer, then uses the separate **Continue to Stripe test bank setup** action. The record and answer
do not link a bank. The server also requires the current guardian link, donations consent and
relationship evidence approved by two independent admins through the existing `/admin/people`
desk. Admin inspection remains read-only; guardians cannot fall back to their own bank binding.

Guardian creation first checks a compatible status response for the exact selected `playerId`.
Creation stays on the server route that passed that check: a subsequent Edge 404 does not replay
creation through an unchecked local route. Missing, mismatched or older function responses keep
setup blocked. Terms acceptance must be
confirmed for the current account and version on the configured client; a device cache alone
cannot waive it. The server's existing first-binding Terms gate still checks a nonnull timestamp,
not the current version. That server policy limit is unchanged in this repair.

Bank and identity data go to Stripe. Web returns route to the selected guardian athlete or adult
Profile; native returns use the app callback. Provider onboarding/transfer flags do not record
authoritative identity, tax or relationship approval: `record_stripe_kyc` remains unwired, the
verified donation-credit path remains separate, and real payouts still return 503. Test bank
onboarding does not authorize real family activation or money release.

### Operator console (paused by default)

`layouts.operatorConsole` defaults to **off** in `DEFAULT_APP_RUNTIME`. `/operator` stays in the binary but shows `RuntimePaused` until Admin → **Features** turns it on and you **Publish to app**. Existing remotes that already published `true` keep that value until you flip Features off + Publish.

### Main admin and the separate reporting client

Use Expo `/admin` for the main administration experience: reports and analytics in the
owner-selected report design, together with every editing desk. It uses the same
signed-in admin session as Expo. Main report tabs are Home, Trends, Audience, Revenue,
Health and Product; Analytics, Departments and Manage desks are also available.
Features/Look/catalog drafts still require an explicit Publish to app.

The separate Next application is retained for read-only reporting:

```bash
cp apps/admin-portal/.env.example apps/admin-portal/.env.local
```

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Then `pnpm admin` → http://localhost:3001 — Home, Trends, Audience, Revenue, Health,
Product, Analytics and Departments, with Product's Features/Profile/Sign-in/People
oversight. This separate client is read-only. Toggle and Publish to app
from Expo `/admin/features` or `/admin/look`; edit games, Drip, sports and catalogs in Expo
`/admin`. Use the same project URL and anon key as `apps/mobile/.env.local`.
---

## 4. Run

Run Expo from `apps/mobile/` through the workspace commands below. The root `app.json`
(`{"expo": {}}`) is an intentional placeholder; the application config is
`apps/mobile/app.json`. Starting Expo from the root uses the wrong project and can produce
`Unable to resolve module ../../App from …/expo/AppEntry.js`.

```bash
# Expo (fan app + main admin at /admin) — always via workspace filter
pnpm mobile
# same as: pnpm start

# or
pnpm mobile:ios
pnpm mobile:web

# Next read-only admin portal (port 3001)
pnpm admin
```

Confirm `apps/mobile/babel.config.js` has `presets: ['babel-preset-expo']`.

**Native acceptance:** use a development client or staging preview build for Stripe
PaymentSheet and `react-native-compressor`. Expo Go does not include the complete native
module set and does not verify those features. The upload service can upload the original
clip when compression is unavailable.

**iOS Simulator:** use Highlights **Library** with a clip dragged into Photos; Record needs
a physical device. Build a development client with `pnpm mobile:ios` or
`pnpm mobile:android` (requires the native toolchain). Device acceptance still includes
sign-in callbacks, keyboard/layout and a Stripe test payment; web export is a separate check.

After changing media buckets, run `supabase/legacy/media_upload.sql` so Storage `reels` + `avatars` and `profiles.avatar_url` exist.

---

## 5. Checks and docs sync

For app work, run both app typechecks, the mobile tests and the scoped read-only guards:

```bash
pnpm typecheck
pnpm --filter @tapuai/mobile exec jest --runInBand --watchman=false
pnpm docs:check
pnpm docs:links
pnpm copy:check
pnpm life:bank:check
pnpm app:data-boundaries
pnpm comments:check
pnpm feature-admin:check
pnpm data:map:check
pnpm code:unused
pnpm agents:check
pnpm security:client-keys
pnpm security:no-ssn
```

The focused account-to-bank test command and manual acceptance matrix are in
[TESTER_SCRIPT.md](engineering/TESTER_SCRIPT.md#google-account-to-later-stripe-test-bank--development-rehearsal).
Record the source revision, executed results and any concurrent-edit limits; source tests do not
verify a hosted database, Google configuration or Stripe/browser/device completion.

After changing gift amounts, gift/processing allocations, Aura tiers, PIN, Connect identity, or Highlight labels:

```bash
pnpm docs:sync
pnpm docs:check
```

---

## 6. Packages

| Package | Path |
| --- | --- |
| `@tapuai/mobile` | `apps/mobile` |
| `@tapuai/admin-portal` | `apps/admin-portal` |
| `@tapuai/shared-types` | `packages/shared-types` |

Path aliases:

- Mobile: `@/*` → `apps/mobile/src/frontend/*`, `@backend/*` → `apps/mobile/src/backend/*`, `@shared/*` → `packages/shared-types/*`
- Admin: `@/*` → `apps/admin-portal/*`, `@shared/*` → `packages/shared-types/*`

## Current gift-release onboarding — 2026-10-22

Read [COORD-02](agents/COORD-02.md) and the [rollout runbook](engineering/GIFT_TIP_ROLLOUT.md)
before payment work. Athlete support is Gift/Give, program support Donation, platform support
an optional Tip. New local-source gifts have zero platform cut; published extras default OFF.
Both hosted projects currently lack payment-context/tip prerequisites. Do not infer applied
SQL or net settlement from local checks. Older 90/10 instructions are superseded history.
