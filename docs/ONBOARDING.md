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

**Your first day:**

- [ ] App running in Expo Go against the development Supabase project (sections 1–4).
- [ ] `pnpm check` passes on your machine.
- [ ] You can find, for one screen, its route in `apps/mobile/app/`, its components in
      `src/frontend/components/<Feature>/`, its hook, and the `lib/` call that reaches Supabase.
- [ ] You know the three environments: **development** (your `.env.local`), **staging** (tester
      builds) and **production** (not created yet — see
      [CODE_ORGANIZATION_PLAN.md](engineering/CODE_ORGANIZATION_PLAN.md), readiness phase R3).
- [ ] Small first PR: branch from `main`, keep the header comment true, add a line to
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

Do not put `STRIPE_SECRET_KEY` in `.env.local`: Expo writes loaded env values to `.expo/dev/logs/start.log`. Checkout and Connect use the Edge Functions, which read the Supabase secret (`STAGING_RUNBOOK` §secrets). For the local Metro fallback only, keep the key in a private file outside the repo and run `set -a; source ~/.config/ala-sports/stripe-secret.env; set +a; pnpm mobile`. It is server-only for JWT-gated `POST /api/create-payment-intent` and `POST /api/create-payout` (and Connect). Do not set `EXPO_PUBLIC_STRIPE_SECRET_KEY`. Sign in before Mālo or payouts — handlers call `supabase.auth.getUser` on the Bearer token.

### Soft-Wall auth (Supabase Dashboard)

Browse-first guests can open Highlights, cards, and Locker Room without an account. **Donate**, **Join Crew**, and gear-goal donate open `SoftWallModal` (Apple / Google / Magic Link), then resume the intercepted action.

1. Authentication → Providers: enable **Email** (magic link and email sign-up), **Apple**, and **Google**. A Google tap that shows `400` / `validation_failed` means the Google provider toggle is still off — the app never receives an account. Paste the Google Cloud OAuth client id and secret, and allow redirect `alasports://auth/callback`.
2. Authentication → URL Configuration: add redirect `alasports://auth/callback` (and the Expo Go / web redirect AuthSession prints if you test those hosts).
3. Run fan profile bootstrap SQL once: `supabase/auth_fan_profile.sql` (also inlined at the end of `apps/mobile/src/backend/db/schema.sql`).
4. Native Apple Sign In needs a build with the `expo-apple-authentication` plugin (`apps/mobile/app.json`). **Share & Fund ⚡** QR save uses `expo-media-library` (Camera Roll / save-photos permission in `app.json`).
5. **Demo Fan (QA):** SoftWall / Profile → email + password **Sign in**, or **Continue as Demo Fan**. Credentials: `demo@tapuai.app` / `TapuaiDemoFan1!` (overridable via `EXPO_PUBLIC_DEMO_FAN_EMAIL` / `EXPO_PUBLIC_DEMO_FAN_PASSWORD`). Enable Email provider (password). Disable **Confirm email** for first-tap create, or run `supabase/demo_fan_account.sql`.

Client entry points: `apps/mobile/src/frontend/lib/auth.ts`, `AuthContext`, `SoftWallContext`, route `apps/mobile/app/auth/callback.tsx`.

Admin oversight: Expo Coverage → Soft-Wall auth + Profile hamburger/roster, Features Soft-Wall board, Look Profile chrome, People Fans filter. Next portal (`pnpm admin`) Overview / Soft-Wall / Profile / Features / People mirrors live flags + fan/claim counts (`SOFT_WALL_GATES` + `PROFILE_CHROME_FLAGS` in `@tapuai/shared-types`). Grok Bot ALA roles: [`docs/company/ALA_TEAM_BRIEF.md`](company/ALA_TEAM_BRIEF.md).

### Operator console (paused by default)

`layouts.operatorConsole` defaults to **off** in `DEFAULT_APP_RUNTIME`. `/operator` stays in the binary but shows `RuntimePaused` until Admin → **Features** turns it on and you **Publish to app**. Existing remotes that already published `true` keep that value until you flip Features off + Publish.

### Admin portal (Next Soft-Wall plane)

```bash
cp apps/admin-portal/.env.example apps/admin-portal/.env.local
```

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Then `pnpm admin` → http://localhost:3001 — Overview, Soft-Wall, Profile (claimed athletes + Look chrome **toggles**), Features (same flag catalog as Expo Features / Look + Publish to app), People (recent Soft-Wall fans, Claimed / Varsity). Use the same project URL and anon key as `apps/mobile/.env.local`. Games, Drip, Sports, and catalogs remain Expo `/admin`.
---

## 4. Run

**Do not** run `npx expo start` from the repo root. After the monorepo move there is no root `App` / `app.json` — that yields `Unable to resolve module ../../App from …/expo/AppEntry.js`.

```bash
# Expo (fan app + Expo /admin) — always via workspace filter
pnpm mobile
# same as: pnpm start

# or
pnpm mobile:ios
pnpm mobile:web

# Next admin portal stub (port 3001)
pnpm admin
```

Confirm `apps/mobile/babel.config.js` has `presets: ['babel-preset-expo']`.

**iOS Simulator + Expo Go:** Highlights **Library** works. **Record** is blocked — the Simulator camera has no video types and Expo Go 57 aborts. Drag a clip into the Simulator Photos app, or use a physical iPhone. Native `react-native-compressor` needs a dev client (`npx expo prebuild`); Expo Go still uploads the original clip.

After changing media buckets, run `supabase/media_upload.sql` so Storage `reels` + `avatars` and `profiles.avatar_url` exist.

---

## 5. Checks and docs sync

Before every PR:

```bash
pnpm check      # typechecks, mobile tests, and every repo guard CI runs
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
