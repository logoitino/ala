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
- [ ] `pnpm check` passes on your machine.
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

Expo **SDK 57**: [https://docs.expo.dev/versions/v57.0.0/](https://docs.expo.dev/versions/v57.0.0/).

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

Do not put `STRIPE_SECRET_KEY` in `.env.local`: Expo writes loaded env values to `.expo/dev/logs/start.log`. Checkout and Connect use the Edge Functions, which read the Supabase secret (`STAGING_RUNBOOK` §secrets). For the local Metro fallback only, keep the key in a private file outside the repo and run `set -a; source ~/.config/ala-sports/stripe-secret.env; set +a; pnpm mobile`. It is server-only for JWT-gated `POST /api/create-payment-intent` and `POST /api/create-payout` (and Connect). Do not set `EXPO_PUBLIC_STRIPE_SECRET_KEY`. Sign in before Mālo or payouts — checkout verifies the Bearer token locally (falling back to `supabase.auth.getUser`); payouts and Connect always call `getUser`.

### Soft-Wall auth (Supabase Dashboard)

Browse-first guests can open Highlights, cards, and Locker Room without an account. **Donate**, **Join Crew**, and gear-goal donate open `SoftWallModal` (Apple / Google / Magic Link), then resume the intercepted action.

1. Authentication → Providers: enable **Email** (magic link and email sign-up), **Apple**, and **Google**. Checked 2026-10-10: Google is still off on development and staging, so Continue with Google cannot create an account. The app keeps that `provider is not enabled` answer in the sign-in sheet. Paste the Google Cloud OAuth client id and secret, and allow redirect `alasports://auth/callback`.
2. Authentication → URL Configuration: redirect `alasports://auth/callback` (owner added this 2026-10-10). Also allow the Expo Go / web redirect AuthSession prints if you test those hosts.
3. Run fan profile bootstrap SQL once: `supabase/auth_fan_profile.sql` (also inlined at the end of `apps/mobile/src/backend/db/schema.sql`).
4. Native Apple Sign In needs a build with the `expo-apple-authentication` plugin (`apps/mobile/app.json`). **Share & Fund ⚡** QR save uses `expo-media-library` (Camera Roll / save-photos permission in `app.json`).
5. **Demo Fan (QA):** The account sheet shows **Use test account** with `demo@tapuai.app` / `TapuaiDemoFan1!` (overridable via `EXPO_PUBLIC_DEMO_FAN_EMAIL` / `EXPO_PUBLIC_DEMO_FAN_PASSWORD`) until `EXPO_PUBLIC_APP_ENV=production`. Enable Email provider (password). Disable **Confirm email** for first-tap create, or run `supabase/demo_fan_account.sql`.

Client entry points: `apps/mobile/src/frontend/lib/auth.ts`, `AuthContext`, `SoftWallContext`, route `apps/mobile/app/auth/callback.tsx`.

Admin oversight: the main Expo `/admin/product` contains Features, Profile, Sign-in and People reports. Coverage, Features, Look and People remain the owning editors under Manage desks. The compatible Next reporting client (`pnpm admin`) mirrors live flags and fan/claim counts (`SOFT_WALL_GATES` + `PROFILE_CHROME_FLAGS` in `@tapuai/shared-types`). Grok Bot ALA roles: [`docs/company/ALA_TEAM_BRIEF.md`](company/ALA_TEAM_BRIEF.md).

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

After changing media buckets, run `supabase/media_upload.sql` so Storage `reels` + `avatars` and `profiles.avatar_url` exist.

---

## 5. Checks and docs sync

Before every PR:

```bash
pnpm check      # typechecks, mobile tests, docs/links, copy, boundaries, headers, feature registry, data map, agents, client-key guard
```

After changing donation amounts, the 90 / 10 split, Aura tiers, PIN, Connect identity, or Highlight labels:

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
