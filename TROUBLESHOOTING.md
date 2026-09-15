# Tapua'i Diagnostic & Troubleshooting Playbook

Pair with [docs/ONBOARDING.md](docs/ONBOARDING.md). Prefer running [`apps/mobile/src/backend/db/schema.sql`](apps/mobile/src/backend/db/schema.sql) over one-off policies when the project is empty. This is a **pnpm monorepo** — run Expo from the repo root with `pnpm mobile`.

---

## 1. Empty roster / “No player found”

**Cause:** RLS without a public `SELECT` on `players`, missing seed rows, or the wrong athlete route (`/player/:id` vs `/athlete/:id`).

**Fix (players read):**

```sql
alter table public.players enable row level security;

drop policy if exists "Public read players" on public.players;
create policy "Public read players" on public.players
  for select using (true);
```

Then confirm rows exist (`select id, name from public.players limit 5`).

---

## 2. Empty Local games

**Cause:** Missing `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `apps/mobile/.env.local`, `games` not seeded, or `is_active = false`.

**Fix:** Restart Expo after `.env.local` edits. Seed from `schema.sql` or `supabase/games.sql`. Realtime: add `public.games` to `supabase_realtime`.

---

## 3. Metro `transformFile` undefined

**Cause:** Babel cannot resolve `babel-preset-expo` from `apps/mobile/`.

**Fix:** Confirm `apps/mobile/babel.config.js` has `presets: ['babel-preset-expo']`, run `pnpm install` at the repo root, then `pnpm mobile` (or `pnpm --filter @tapuai/mobile start -- --clear`).

---

## 4. Reel crash / black video

**Cause:** `expo-av` player or `useCaching: true` on `expo-video`.

**Fix:** Playback through `expo-video` only. The app already calls `clearVideoCacheAsync` on the Reel tab. `expo-av` may remain in `package.json` — do not import it for the feed.

---

## 5. Upload fails

**Cause:** Missing Storage bucket `game_highlights`, or upload without a tagged player / active game / caption.

**Fix:** Run `supabase/reels.sql`. Confirm the bucket is public and policies allow SELECT + INSERT on `storage.objects` for that `bucket_id`.

---

## 6. PaymentSheet never opens / payment 500

**Cause:** Web stub (`stripe.web.ts`); missing `STRIPE_SECRET_KEY` in `apps/mobile/.env.local`; amount &lt; 50 cents.

**Fix:** Expo Go on iOS/Android. Secret in `apps/mobile/.env.local` (not under `apps/mobile/src/frontend/`). Client calls `POST /api/create-payment-intent` — not the unused `supabase/functions/create-payment-intent` Edge Function.

---

## 6b. Connect Bank Account does not open / flags stay false

**Cause:** Missing `STRIPE_SECRET_KEY`; `profiles.stripe_onboarding_complete` column not applied; web popup blocked (`ERR_WEB_BROWSER_BLOCKED`); Express onboarding left unfinished (`details_submitted` is still false).

**Fix:** Re-run `supabase/stripe_connect.sql`. Restart Metro after env changes. Use Expo Go so `openAuthSessionAsync` can return to `alasports://stripe-connect`. Complete the Stripe Express form; dismiss still re-fetches account status.

---

## 7. Aura / leaderboard does not move after Mālo

**Cause:** Guest session (no `user.id` → RPC skipped); `add_user_aura` not applied; covering the $0.50 fee does not add Aura.

**Fix:** Run `supabase/add_user_aura.sql`. Sign in. Leaderboard reads `profiles.aura_points` — incremental SQL does not create `profiles` (use canonical `schema.sql`). Empty `profiles` falls back to dev personas in the UI.

---

## 8. Athlete HQ Mālo list stays empty

**Cause:** `useTipCheckout` never inserts `public.tips`. Profile/HQ `select * from tips` will not grow.

**Workaround:** Treat `players.backer_count` and `reels.total_tips_cents` as the live counters until a ledger insert is added.

---

## 9. Cheer poll does not save

**Cause:** Table is SELECT-only. Votes must go through `cast_cheer_vote`. Missing execute grant or Realtime publication.

**Fix:** Run `supabase/cheer_polls.sql`. Add `cheer_polls` to `supabase_realtime`.

---

## 10. Operator cannot save score / clock

**Cause:** RLS blocking `games` UPDATE, or not on `/operator/console/[gameId]`.

**Fix:** Demo policies allow `anon` updates (see `schema.sql`). Confirm `EXPO_PUBLIC_SUPABASE_*` and that the claimed game `id` matches. PIN is `OPERATOR_TEST_PIN` in `apps/mobile/src/frontend/lib/operator.ts`.
