# Tapua'i onboarding

Get a new engineer from clone to Metro (mobile) and the Next admin stub. Architecture: [ARCHITECTURE.md](ARCHITECTURE.md) · [DOCUMENTATION.md](../DOCUMENTATION.md). Schema: [SCHEMA.md](SCHEMA.md).

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
STRIPE_SECRET_KEY=sk_test_your_secret_key
```

### Soft-Wall auth (Supabase Dashboard)

Browse-first guests can open Highlights, cards, and Locker Room without an account. **Mālo**, **Join Crew**, and **Chip In** open `SoftWallModal` (Apple / Google / Magic Link), then resume the intercepted action.

1. Authentication → Providers: enable **Email** (magic link), **Apple**, and **Google**.
2. Authentication → URL Configuration: add redirect `alasports://auth/callback` (and the Expo Go / web redirect AuthSession prints if you test those hosts).
3. Run fan profile bootstrap SQL once: `supabase/auth_fan_profile.sql` (also inlined at the end of `apps/mobile/src/backend/db/schema.sql`).
4. Native Apple Sign In needs a build with the `expo-apple-authentication` plugin (`apps/mobile/app.json`).
5. **Demo Fan (QA):** SoftWall / Profile → email + password **Sign in**, or **Continue as Demo Fan**. Credentials: `demo@tapuai.app` / `TapuaiDemoFan1!` (overridable via `EXPO_PUBLIC_DEMO_FAN_EMAIL` / `EXPO_PUBLIC_DEMO_FAN_PASSWORD`). Enable Email provider (password). Disable **Confirm email** for first-tap create, or run `supabase/demo_fan_account.sql`.

Client entry points: `apps/mobile/src/frontend/lib/auth.ts`, `AuthContext`, `SoftWallContext`, route `apps/mobile/app/auth/callback.tsx`.

Admin oversight: Expo Coverage → Soft-Wall auth, Features Soft-Wall board, People Fans filter. Next portal (`pnpm admin`) Overview / Soft-Wall / Features / People mirrors live flags + fan counts (`SOFT_WALL_GATES` in `@tapuai/shared-types`).

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

Then `pnpm admin` → http://localhost:3001 — Overview, Soft-Wall, Features (draft Soft-Wall related flags + Publish), People (recent Soft-Wall fans).
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

---

## 5. Docs sync

After changing Mālo prices, Aura tiers, PIN, Connect identity, or Highlight labels:

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
