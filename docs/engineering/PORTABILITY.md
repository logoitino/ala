# Portability: staying free to move off any host (PORT-01)

**Owner question (2026-10-14):** we take the recommendation (stay on managed Supabase, a streaming host for video,
self-hosted Supabase as the tested exit; [HOSTING_DECISION_BRIEF.md](HOSTING_DECISION_BRIEF.md) §9). Can we wrap the
database so we can switch easily when the time comes? Do our documentation and code already make services replaceable,
or are we walking into a trap?

This page is the single source on portability; `CODE_ORGANIZATION_PLAN.md` and the hosting brief link here. Owner: `INFRASTRUCTURE` (the scalability team's dev member, 2026-10-14), who also keeps the generated
[INFRASTRUCTURE_REGISTER.md](INFRASTRUCTURE_REGISTER.md) — the live list of what we run and how deeply it is integrated.
CTO review with BACKEND, DATABASE_MIGRATIONS, OPERATIONS and STORAGE: changes needed → applied (2026-10-14).

## Short answer

**Do not wrap the whole database — it is already the portable part.** Our tables, security rules and about 265
functions are plain **PostgreSQL**, which every host offers. Building our own layer that hides Postgres (an ORM or a
private database API) would cost months, move the security rules out of the database, and become a trap of its own.

What ties us to Supabase is **the services around Postgres**: the API the app talks to (PostgREST), sign-in (GoTrue),
live updates (Realtime), file storage, three server functions, and app code that calls these directly. Supabase's pieces
are open source, which gives us two honest exits:

| Exit | What it is | Effort (estimate, unverified) |
| --- | --- | --- |
| **A. Self-hosted Supabase** (AWS, Azure or our own server) | Same Postgres, PostgREST, GoTrue, Realtime and Storage, run by us | Weeks of plumbing: copy the database and files, move secrets, re-point the app's URL and keys, rehearse. No app rewrite. This is the exit the brief recommends drilling. |
| **B. A different provider** (e.g. RDS / Aurora plus other services) | Postgres elsewhere, and replacements for the API, sign-in, live updates and storage | A real project: rewrite `lib/` data calls off PostgREST (or run PostgREST ourselves), migrate users and password hashes and OAuth, replace Realtime and Storage, port the server functions. The database itself moves as is. |

The work below keeps both exits cheap: the database stays standard, and everything vendor-specific sits behind
`lib/` so exit B rewrites one folder, not the app.

## 1. Where we are tied (measured 2026-10-14)

| Dependency | Where / size | Exit A | Exit B |
| --- | --- | --- | --- |
| Postgres tables, RLS, functions | ~66 tables, ~265 functions; only extension `pgcrypto` | Same | Same SQL on any Postgres; proven only on PostgreSQL 18 (PGlite) so far |
| **PostgREST** (the app's API) | Most data access is `.from()` table queries and `.rpc()` calls (76+ `.from()` and ~88 raw `.rpc()` inside `lib/`, 36 through `lib/rpc.ts`); `lib/dbErrors.ts` reads PostgREST error codes; identity reaches SQL through `request.jwt.claims` | Same | Run PostgREST ourselves, or rewrite `lib/` calls |
| Roles and identity in SQL | 271 grants to `anon` / `authenticated` / `service_role`; `auth.uid()` 227 and `auth.role()` 89 uses (`my_profile_id()` 51 more); `is_trusted_server()` | Same | Recreate the three roles and `auth.uid()` / `auth.role()` from a verified token (the replay's 26-line stub shows the shape) |
| **Sign-in** (GoTrue: email, magic link, Apple, Google) | `lib/auth.ts`, `context/AuthContext.tsx`; `auth.users` foreign keys with cascade deletes; `handle_new_auth_user` trigger reading sign-up metadata; grant to `supabase_auth_admin`; checkout verifies ES256 / RS256 session tokens locally against the project's JWKS (`supabase/functions/_shared/money/accessToken.ts`, SCALE-04) and falls back to `supabase.auth.getUser` for HS256 projects, unknown keys or an unreachable JWKS; payouts and Connect account creation always call `getUser`, because a local check cannot see a sign-out before the token expires; admin portal sign-in in `middleware.ts`, `app/auth/callback/route.ts`, `LoginForm`, `SignOutButton` | Same (export users with the database) | Largest piece: migrate users, password hashes and OAuth redirects |
| Live updates (Realtime) | 11 client channels; `realtime.messages` policies, `realtime.topic()`, private broadcast, 4 publication lines | Same | Replace behind hooks / lib |
| File storage | buckets `reels`, `avatars`, `game_highlights`; 21 `storage.foldername` uses and bucket inserts in SQL; **full host URLs stored in `reels.video_url`, `profiles.avatar_url` and booster logos** (story photos store a path; Vault clips store `reelvault:`) | Copy files; old URLs break if the domain changes | Copy files, new resolver |
| Server functions | 3 Deno Edge Functions using the auto-provided `SUPABASE_URL` / keys and `esm.sh` imports; `stripe-webhook` exists only for Deno and `createPayout` only for Node | Same | Port the thin adapters only: the money logic is one runtime-neutral core in `supabase/functions/_shared/money/` that the Edge Functions and the Metro routes both import (SCALE-04) |
| App code calling Supabase directly | **48 uses in 19 files** outside `lib/` (hooks, services, context, one component, admin portal pages; includes direct `@supabase/*` imports); **0 in Expo routes** (was 78 + 16 before the 2026-10-14 moves) | No change | Each is a place to touch |
| Outside Supabase | Expo over-the-air updates (`u.expo.dev`) and planned Expo push (SCALE-07); Stripe Connect accounts and identity checks | — | Separate exit projects if those vendors change |

## 2. What already protects us (evidence)

- **The database rebuilds from the repo on a non-Supabase Postgres.** `scripts/replay/schema-replay.mjs` loads
  `schema.sql` into an empty PostgreSQL 18 (PGlite) with 26 lines standing in for Supabase's `auth`, `storage` and
  `realtime` schemas, applies it twice and runs 111 security and behaviour checks; CI runs it. That stand-in is the start
  of exit B's compatibility layer. Not yet proven on a hosted Postgres 15+.
- **Everything is documented and owned:** every table, function and column (`SCHEMA.md`, `data-ownership.json`,
  `DATA_MAP.md`; `pnpm docs:check`, `pnpm data:map:check`), every change a dated migration with a rollback.
- **Config is environment variables,** not code (`security:client-keys`).
- **Reports read shared contracts** (`packages/shared-types/admin/`), not tables, so a replica or warehouse is a pipe
  later (SCALE-08).
- **Recovery packages** carry source, locked dependencies and migration hashes (`pnpm recovery:package`).
- **The boundary guard (widened 2026-10-14):** `pnpm app:data-boundaries` counts direct database, auth, storage,
  realtime and server-function calls and direct `@supabase/*` imports outside `lib/`, in the app's routes, hooks,
  components, context, services and the admin portal's pages. A file can never gain one; removing one requires lowering
  the baseline (`scripts/app-data-boundary-baseline.json`, `scripts/vendor-boundary-baseline.json`).

## 3. Done in PORT-01 (2026-10-14)

- **`lib/media.ts`** — provider-neutral media references (`sb:<bucket>/<path>`, `reelvault:<path>`, plain URLs) and
  the one public-URL builder. It also recognises legacy full Supabase URLs and rebuilds them for the current host, so old
  rows follow a host move. Uploads (`MediaUploadService`), booster logos (`useSponsorships`) and story photos now build
  URLs only through it. Uploads still *write* full URLs until enough app builds read references (expand, then contract);
  `lib/reels.ts` playback resolution moves to it after PLAY-01 releases that file.
- **`lib/cheerPoll.ts`** — the duplicated `cast_cheer_vote` call and its fallback moved out of a hook and the offline
  queue into one lib module.
- **Direct calls moved into `lib/`** (CODE_HYGIENE with BACKEND): all three operator routes (queries and Realtime into
  `lib/operator.ts`), the offline queue (`lib/reelVotes.ts`, new `lib/savedReels.ts`) and seven hooks (new
  `lib/liveGames.ts`, `lib/localSearch.ts`, `lib/sponsorships.ts`; `lib/cheerPoll.ts`, `lib/aura.ts`). Routes 16 → 0,
  everything else 78 → 48; behaviour unchanged, 6 new tests.
- The guard widened as above; this page replaces the older counts in `CODE_ORGANIZATION_PLAN.md`.

## 4. Next, in order (owners from WORK_QUEUE)

| # | Gap | Fix | Owner | When |
| --- | --- | --- | --- | --- |
| 1 | Full host URLs in rows | SCALE-02, expand then contract. **Done (expand, 2026-10-14):** every avatar and booster-logo display (`ProfileAvatarPicker`, which draws the own and public profile heroes, `GameCard`, the Local tab's Top Boosters) reads through `mediaUri` in `lib/media.ts`, which takes a legacy full URL or an `sb:` reference; uploads (`uploadAvatar`, `uploadSponsorLogo`) write through `mediaValueToStore` behind `MEDIA_WRITE_REFERENCES = false`, so rows still get full URLs. **Remaining, in order, each owner-gated:** (a) a build containing these readers is installed for testers; (b) flip `MEDIA_WRITE_REFERENCES` to `true`, so new avatars and booster logos store `sb:avatars/...`; (c) PLAY-01 releases `lib/reels.ts`, then playback (and the avatars drawn in `components/Reels/*`: `ReelOwnerPeek`, `uploader_avatar_url`) reads through `lib/media.ts` and video uploads store references; (d) a backfill migration rewrites old full Supabase URLs in `profiles.avatar_url`, `sponsorships.logo_url` and `reels.video_url` to `sb:` references (not written yet; needs a rollback and the E1 baseline first) | `HIGHLIGHTS` → `PLAYBACK`, `UPLOAD`, `STORAGE`; `BACKEND` | Before the video host change and before data grows |
| 2 | 48 direct calls (routes now 0) | Move the rest into `lib/` when each file is next touched (`useGameEventBroadcast`, `useFanTipHistory`, `MediaUploadService`, `AuthContext`, the admin portal's sign-in pages; `UploadVideoModal` after PLAY-01); the guard only lets numbers fall | Each feature owner; `CODE_HYGIENE` tracks; `INFRASTRUCTURE` watches | Ongoing, no big-bang refactor |
| 3 | Identity seam | New SQL uses `my_profile_id()` / `is_trusted_server()`, not raw `auth.uid()`. **Server token check done locally 2026-10-14:** `_shared/money/accessToken.ts` verifies ES256 / RS256 session tokens against the project's JWKS with WebCrypto (any GoTrue-compatible issuer works); HS256, unknown keys, an unreachable JWKS or a different issuer fall back to the auth server; checkout only — Connect and payouts always confirm the live session. SECURITY review: approved (issuer fallback and a live-Stripe-key refusal applied). Not yet run on Deno or against a real JWKS | `BACKEND`, `SESSION_SECURITY`; `RLS_SECURITY` reviews | Every new migration. Token check **done locally 2026-10-14** (`_shared/money/accessToken.ts`): checkout only; money-moving routes keep the live `getUser` check |
| 4 | Two copies of the money server code | One handler set with Deno / Node adapters (SCALE-04). **First step done locally 2026-10-14:** validation, quote math, freeze check, Connect gates, payout decision and response shapes live in `supabase/functions/_shared/money/`; characterization tests (`moneyHandlers.test.ts`) pin both runtimes. `stripe-webhook` stays Deno-only and `createPayout` Node-only (no twin built); webhook crediting and the client `tips` retirement remain gated | `COMMERCE`, `API` | Before live money |
| 5 | No rehearsed move | Quarterly exit drill (E3), runbook [EXIT_DRILL.md](EXIT_DRILL.md): local rehearsal now; after E1 stand up self-hosted Supabase from the repo on synthetic data, run the replay and a smoke test, time it | `BACKEND`, `RELIABILITY`, `COST_OPERATIONS` (ENVIRONMENTS_AND_HOSTING E3) | After the E1 baseline |
| 6 | No production baseline | E1 baseline and `migration repair` before any `db push` | `DATABASE_MIGRATIONS` | R2 / E1 |
| 7 | Hand-written database types | **Done locally 2026-10-14:** `scripts/gen-db-types.mjs <pglite dist> [--check]` builds `types/database.generated.ts` from `schema.sql` on PGlite (CI checks it is current); `types/__tests__/databaseDrift.test.ts` fails when the hand-written types name a column the schema lacks (8 found: 1 fixed, 7 allow-listed with reasons). Next: move screens onto the generated types gradually | `DATABASE_MIGRATIONS` | Ongoing |

## 5. Rules that keep it true (every change)

- No vendor SDK (`@supabase/*`, Stripe server keys, a video SDK) outside `lib/`, `services/` or `src/backend/` — the
  Supabase part is enforced by `pnpm app:data-boundaries`.
- Store **references** (ids, keys, `sb:` refs), never a host's full URL; build URLs through `lib/media.ts`.
- New SQL stays standard Postgres plus `pgcrypto`; anything host-specific is named in the migration header.
- Money and server logic live in shared handlers, not one host's function format.
- Every table, function and Storage path is documented and owned (existing checks).

## 6. When to move

Per the brief (§9, owner decision 1, and §10.4): start a review when the loaded monthly cost stays high (the brief's
starting point is about $3k a month for three months, judged on actual cost, not a fixed crossover), when a partner
requires another cloud, or when a capability is missing. When a trigger fires, exit A is weeks of plumbing; exit B is a
planned project concentrated in `lib/`, sign-in, storage and the three functions — not a rewrite of the app or the
database. Prices and timings are unverified estimates (internet mode was off).
