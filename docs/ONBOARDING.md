# Tapua'i onboarding

Get a new engineer from clone to Metro. Architecture: [DOCUMENTATION.md](../DOCUMENTATION.md). Schema: [SCHEMA.md](SCHEMA.md).

Expo **SDK 57**: [https://docs.expo.dev/versions/v57.0.0/](https://docs.expo.dev/versions/v57.0.0/).

---

## 1. Clone

```bash
git clone <this-repo>
cd ala-sports
```

---

## 2. Install dependencies

```bash
npm install
```

`postinstall` copies `canvaskit.wasm` into `public/` so Expo web can paint the Skia neon border. Native Expo Go does not need that file.

Confirm `babel.config.js` at the **repo root** has `presets: ['babel-preset-expo']`.

---

## 3. Environment variables

```bash
cp .env.example .env.local
```

Set at least:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Use the **anon** key, never the service role. Restart Metro after any `.env.local` change.

Optional (Mālo / Stripe test mode): `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`. Never put `sk_` in `src/frontend/`.

First-time database: run [`src/backend/db/schema.sql`](../src/backend/db/schema.sql) in the Supabase SQL editor. To refresh Aura RPCs on an existing project, run [`supabase/add_user_aura.sql`](../supabase/add_user_aura.sql) (it `DROP FUNCTION`s first to avoid `42P13`). For exclusive paywall tables on an existing project, run [`supabase/subscriptions.sql`](../supabase/subscriptions.sql) then [`supabase/subscriber_requests.sql`](../supabase/subscriber_requests.sql). For the Field Operator scorekeeper on an existing project, run [`supabase/games_operator.sql`](../supabase/games_operator.sql) (`claimed_by`, `is_clock_running`, `update_game_score`, nullable `game_events.player_id`). For dual Fan/Athlete `profiles.roles`, re-run [`supabase/profile_roles.sql`](../supabase/profile_roles.sql). For Athlete conversion (`add_user_role`, `active_role`), re-run [`supabase/add_user_role.sql`](../supabase/add_user_role.sql). For athlete Stripe Connect payouts, re-run [`supabase/stripe_connect.sql`](../supabase/stripe_connect.sql) (`stripe_onboarding_complete`, `payouts_enabled`). For Fan Tip History, re-run [`supabase/get_fan_tip_history.sql`](../supabase/get_fan_tip_history.sql) (creates `public.tips` if missing, then `fan_id` / `reel_id` / `aura_points` and `get_fan_tip_history`). For Local booster sponsorships, re-run [`supabase/sponsorships.sql`](../supabase/sponsorships.sql). For client playback / socket telemetry, re-run [`supabase/telemetry_logs.sql`](../supabase/telemetry_logs.sql). For Reel bookmarks, re-run [`supabase/saved_reels.sql`](../supabase/saved_reels.sql). For Local Explore search, re-run [`supabase/search_local_entities.sql`](../supabase/search_local_entities.sql). For Report / Hide Highlight, re-run [`supabase/report_reel.sql`](../supabase/report_reel.sql) (`is_flagged`, `reported_by`, `report_reel`). For Fan-first Open Vault, re-run [`supabase/toggle_reel_vault_status.sql`](../supabase/toggle_reel_vault_status.sql) (`is_vault_only`, `toggle_reel_vault_status`). For Athlete HS + NCAA team search, re-run [`supabase/schools_and_teams.sql`](../supabase/schools_and_teams.sql) (`schools_and_teams`, `profiles.school_id`, `search_schools_and_teams`).

Stripe Connect Express Account Links are minted by Edge Function `create-stripe-account` (JWT required). The CLI needs a dashboard login (or `SUPABASE_ACCESS_TOKEN`) before secrets or deploys. From the repo root:

```bash
npx supabase login
npx supabase link --project-ref ulfapgtabidorgwfjvwz
npx supabase secrets set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY"
npx supabase functions deploy create-stripe-account
```

Use your real `sk_test_…` from the Stripe Dashboard (or `.env.local`) — not the `sk_test_...` placeholder. `npx supabase login` opens a browser; if you prefer a token, create one at [Account → Access Tokens](https://supabase.com/dashboard/account/tokens) and export `SUPABASE_ACCESS_TOKEN`. Keep `verify_jwt` on. The client sends `Authorization: Bearer` from `session.access_token`. `sk_` never belongs in `src/frontend/`. Metro `POST /api/create-stripe-account` is a signed-in local fallback only. `@react-native-community/netinfo` is required for `OfflineQueue` reconnect flush.

---

## 4. Run Metro

```bash
npx expo start
```

Not `npx expos start`. After Babel or env edits: `npx expo start --clear`.

Scan the QR with **Expo Go (SDK 57)** on the same Wi-Fi, or press `i` / `a` for a simulator. PaymentSheet does not run in the web bundler.

---

## 5. Smoke test

- Guest/Fan: 5-tab hub, Reel swipe, Local cheer poll, Profile Aura card.
- Athlete (Dev switcher): Profile **Account Settings** → Connect Bank Account (native `WebBrowser` + deployed `create-stripe-account` Edge Function + signed-in JWT). Web can open Express but PaymentSheet still does not run in the web bundler.
- Mālo shortcuts need Stripe keys + a signed-in `user.id` for `add_user_aura`. Exclusive `$4.99/mo` on `/athlete/[id]` uses the same PaymentSheet; Aura +100 also needs `user.id`.
- Operator: Role Switcher → PIN in `src/frontend/lib/operator.ts`.

Typecheck: `npx tsc --noEmit`. Front-of-house prices / PIN / Aura facts / athlete sports: `npm run docs:sync` after changing `TIP_AMOUNTS`, exclusive dollars, `SPONSOR_TIERS`, `AURA_TIERS`, `OPERATOR_TEST_PIN`, Connect identity, `ATHLETE_SPORTS`, or `ATHLETE_CLASS_YEARS`. CI runs `npm run docs:check` (also requires `docs/SCHEMA.md` to name every `schema.sql` table and RPC). More failures: [TROUBLESHOOTING.md](../TROUBLESHOOTING.md).
