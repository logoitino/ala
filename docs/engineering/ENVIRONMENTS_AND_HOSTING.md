# Environments and hosting — dev, staging, prod, and where they run

**Owner request (2026-10-13):** have a dev server and a prod server, decide whether to stay with Supabase or host
on AWS (EC2) or Azure, and make the whole environment easy to commit changes to (like the 2026-10-13 security and
books migrations, which today wait on someone pasting SQL into a dashboard).

**Status:** plan and recommendation, written 2026-10-13 and revised the same day after two reviews (CTO with
BACKEND / DATABASE_MIGRATIONS; OPERATIONS with CI / RELEASE / COST_OPERATIONS, SECURITY and PRIVACY_ENGINEERING —
both asked for changes, all applied below; both approved the revision). Nothing is created, bought or moved. Hosting, spend, accounts and
applying SQL are the owner's call (`FACILITATOR`). This extends readiness phases R2 (rebuildable database) and R3
(production environment) in [CODE_ORGANIZATION_PLAN.md](CODE_ORGANIZATION_PLAN.md). It reopens, on purpose, the
2026-09-29 note "we are not moving hosts" by giving the owner the options, the cost and a tested exit.

Chain of command: owner → `CTO` (owns the recommendation) → `BACKEND` (`DATABASE_MIGRATIONS`), `OPERATIONS`
(`CI`, `RELEASE`, `COST_OPERATIONS`), `SECURITY`, `PRIVACY_ENGINEERING`, `RELIABILITY`; spend with the CFO's office
(`TREASURY`). `DATA_GOVERNANCE` reviews anything that moves data between environments.

Prices below are from memory, not checked on 2026-10-13. **Verify every number before buying.**

**Owner budget follow-up:** initial infrastructure ceiling **$50/month or less**. The phased
recommendation and cost assumptions are in [HOSTING_DECISION_BRIEF §10](HOSTING_DECISION_BRIEF.md#10-owner-budget-follow-up--50month-and-phased-expansion).
Use inexpensive local dev/staging and compare one paid backend; required production recovery
may need a higher approved budget. E1/E2/E3 below remain proposed and unprovisioned. This does
not approve a vendor, higher spend or an automatic later move to AWS/Azure. Fresh Claude review
and current official pricing remain blocked/pending as recorded in that follow-up.

**Every engineer's recommendation, total cost including our time, video pricing, what future-proof means for our
code and what breaks first as we expand:** [HOSTING_DECISION_BRIEF.md](HOSTING_DECISION_BRIEF.md) (49 roles in five
panels plus market research, 2026-10-13). All roles recommend option A; none backs B as the operating mode or C now.

---

**Ongoing recommendation owner:** [Growth and Capacity Review](GROWTH_CAPACITY_REVIEW.md),
led by GROWTH_ANALYTICS with cost/reliability/data/finance evidence. It reviews each service's
actual usage, accepted targets and verified costs/limits and brings one packet to CTO/owner.
The initial review reports missing live metrics; setup does not establish scheduled collection,
a paid plan or automatic migration. Actual setup: [GROWTH-01](../agents/GROWTH-01.md).

## 1. What we run on today (measured 2026-10-13)

| Piece | Today | How tied to Supabase |
| --- | --- | --- |
| Database | Postgres on Supabase: 54 tables, 199 functions, 101 RLS policies, 174 security definer functions | Plain Postgres, but security leans on Supabase's request identity: `auth.uid()` 182×, `auth.role()` 80×; a trigger on `auth.users`; policies on `storage.objects` and `realtime.messages` |
| Sign-in | Supabase Auth: Apple, Google, magic link, password (11 client call sites) | Tight: sessions, JWTs, `auth.users`, provider settings and redirect URLs live in the dashboard |
| Files | Storage buckets `reels`, `avatars`, `game_highlights`, private `reel_vault` (48 SQL refs; 9 client calls through `MediaUploadService`) | Medium: one service file plus storage policies; **`reels.video_url` stores the full `<project>.supabase.co` URL** |
| Live updates | Supabase Realtime (11 channels in hooks/lib) | Medium |
| Server code | 3 Edge Functions (Deno): payment intent, Stripe account, Stripe webhook (**not deployed; do not deploy** until Phase 1a, STATE §0) | Low: plain HTTP handlers |
| Admin portal (Next.js, read-only) | Runs locally; not hosted | None |
| Projects | Development `ulfapgtabidorgwfjvwz` (lacks the September SQL), staging `tucioqipfejqqqtuakdi`; **no production** | — |
| App builds | EAS profiles `development` / `preview` / `production`. Until 2026-10-13 they set only `APP_ENV`, which nothing read, so a production build would have shown the demo sign-in; now each also sets `EXPO_PUBLIC_APP_ENV` (test `appEnv.test.ts`). `app.json` is static | — |
| Database changes | Migrations written in `supabase/migrations/` but **pasted by hand** into the SQL Editor; 52 loose legacy `supabase/*.sql` files; Supabase's migration history table on staging is empty or partial | — |
| Proof the schema rebuilds | `scripts/replay/schema-replay.mjs` (PGlite, mimics Supabase default grants, 35/35) plus three migration replays — **now in CI** (hash-pinned PGlite 0.5.9) | — |
| CI | `ci-checks.yml` on `main` and `dev` pushes / PRs; read-only permissions; no deploy jobs | — |

## 2. The hosting options

| | **A. Stay on managed Supabase** (recommended now) | **B. Self-host Supabase on AWS EC2 or an Azure VM** | **C. AWS or Azure managed services** (RDS / Azure Database for PostgreSQL + Cognito / Entra + S3 / Blob + own API) |
| --- | --- | --- | --- |
| App code change | None | No app code change, but: a new URL and keys (new build or OTA update); move `auth.users` and Storage objects; rewrite stored public URLs (`reels.video_url`); everyone signs in again (new JWT secret); our own SMTP for magic links; Apple / Google redirect setup; an S3 Storage backend; Edge Functions as an edge-runtime container; backups and PITR are ours | Large: new auth, storage, realtime and API layer; RLS kept or rewritten; the same URL rewrite; months |
| Who runs it | Supabase (patching, backups, failover) | **Us**: OS and Postgres upgrades, TLS, backups, monitoring, on-call | Shared: the cloud runs the pieces, we run the glue and the API |
| Monthly cost, rough | Prod ≈ $30–60 without PITR, ≈ $135–175 with PITR (PITR ≈ $100 and needs Small compute or larger); egress over 250 GB ≈ $0.09/GB. Dev + staging: $0 in a separate **Free organization** (no backups; pause after ~7 idle days), or ≈ $10 each in the Pro organization (no pausing) | VM ≈ $30–70 + disk + snapshots + WAL backups to S3 + static IP or load balancer + egress; a second VM for failover doubles it; **our time ≈ 10–20 h/month for one node, 20–40 h with failover** (RELIABILITY; was 4–8) | DB ≈ $15–60 (Multi-AZ doubles it), auth per active user, storage + CDN egress, API compute, NAT gateway ≈ $32; plus build time |
| Biggest risk | Vendor pricing or limits; outages outside our control | A single VM is a single point of failure; a missed patch is ours; minors' data on a box we secure | Rewrite risk and time-to-market; security model re-done |
| Exit path | → B with no app rewrite (same open-source stack), → C by rewriting `lib/` | → A or C | — |

Shared lines for every option: custom email (SMTP) $0–20, error monitoring $0–26, the EAS plan ($0 / $19 / $199;
the free plan's 30 builds a month run out fast if we build on every merge), and the GitHub plan (§4.7).

**AWS or Azure, if we ever leave:** AWS by default. Managed Supabase runs on AWS, so a hybrid (video on
S3/CloudFront) or a later lift-and-shift stays in one network and region. Choose Azure only for a concrete reason:
a school-district or partner requirement for Microsoft, or meaningfully larger credits (AWS Activate, Microsoft
for Startups and Supabase all offer startup credits worth applying for).

**Video is the real cost driver, not the database.** Highlight playback bandwidth will dwarf database spend. That
decision is already open (STATE §6 item 2: Cloudflare Stream or Mux) and is independent of where the database
lives. The media panel recommends **Mux (Basic) for Wave 1**, Cloudflare Stream second, and re-pricing at S2 (Bunny or
CloudFront for new uploads), behind one `media_ref` adapter ([brief §2](HOSTING_DECISION_BRIEF.md)).

### Recommendation (CTO; reviewers concur)

1. **Stay on managed Supabase for Wave 0 and Wave 1**: dev / staging / prod. Cheapest in money and time; the
   security model built so far carries over unchanged.
2. **Keep option B as a tested exit, not a plan.** Same open-source stack, so no app rewrite; the move work is in
   the B row above. Prove it once a quarter on synthetic data (§5, E3).
3. **Revisit only on a trigger** (§6). Option C is a rewrite and nothing known today justifies it.

## 3. Environment design

| | Local | Development | Staging | Production |
| --- | --- | --- | --- | --- |
| Purpose | One engineer's machine | Shared sandbox | Release candidate; mirrors prod settings | Real families and money |
| Database | PGlite replays; Supabase CLI local stack (`supabase start`) where Docker exists | Supabase `ulfapgtabidorgwfjvwz`, **rebuilt from the baseline first** (it lacks the September SQL) | Supabase `tucioqipfejqqqtuakdi` | **New** Supabase Pro project, US region (cannot change later) |
| Data | Synthetic seed | Synthetic seed only | **Real tester accounts and consented clips** (STAGING_RUNBOOK §4b, minors with parent OK). Personal data: named access, deletion on request, never copied to dev | Real. Never copied down |
| Stripe | test | test | test | live — only after STATE §6 items 8 and 9 |
| App build | Expo dev client | EAS `development` (needs its own channel), "Tapua'i Dev" | EAS `preview`, "Tapua'i Beta" | EAS `production`, "Tapua'i" |
| Database changes arrive | replay | CI on merge to `main` | CI on merge to `main`, behind an owner approval | CI on a release tag, behind an owner approval |
| Who has access | engineer | engineers | named engineers (personal data) | owner + named on-call, MFA |
| Backups | — | none | daily (only on a paid plan) | daily + PITR; restore drill into an isolated, then deleted, project |

Seed rules (`DATA_GOVERNANCE`, `PRIVACY_ENGINEERING`): fictional people and schools (no name resembling a real
school), `example.com` emails, no demo PIN, and the seed **never runs against a hosted project** (local `db reset`
only).

Side-by-side builds need `app.config.ts` reading `APP_ENV` (R3) and, per Dev/Beta bundle ID, its own Apple and
Google sign-in client IDs and redirect scheme — otherwise `signInWithIdToken` fails on those builds.

## 4. Making changes easy to ship (the pipeline)

Goal: shipping a database change like `20261013210000_function_access_hardening.sql` becomes **merge a PR, approve
a deployment**, not paste SQL into dashboards.

```
branch ──PR──▶ CI: pnpm check, schema + migration replays,  ──merge──▶ main ──▶ dev (auto)
               `supabase db reset` on a local stack                          └─▶ staging (owner approves in GitHub)
tag vX.Y ──▶ CI posts `db push --dry-run` for prod ──▶ owner approves ("Review deployments", web or mobile) ──▶ prod
```

1. **Pull request:** `pnpm check`, the PGlite replays (in CI now), and after E1 a real `supabase start` +
   `supabase db reset` from the baseline on the GitHub runner (Docker is available there).
2. **Merge to `main`:** CI applies new migrations to development, then — after the owner approves the staging
   environment (applying SQL to a hosted project stays the owner's call) — to staging. Edge Functions deploy from
   an explicit **allowlist** (`create-payment-intent`, `create-stripe-account`); `stripe-webhook` is excluded until
   Phase 1a. JavaScript-only changes ship as an `eas update` to the preview channel; a new EAS build only when native
   code changes (`runtimeVersion` policy `fingerprint`).
3. **Release tag:** the prod job posts the `db push --dry-run` list, waits for the owner's approval, then applies the
   same migrations and functions. App updates use `eas update --channel production --environment production`
   (public `EXPO_PUBLIC_*` values are baked in at update time, so the EAS production environment must also set
   `EXPO_PUBLIC_APP_ENV=production`).
4. **Migrations stay backward-compatible** (expand, then contract): old store builds stay installed for weeks and
   keep calling the database. Rolling the app back (`eas update:republish` of the previous update group) never undoes
   a migration; a bad migration is undone by a new one (every header carries its rollback).
5. **Project settings as code:** auth providers, redirect URLs, SMTP, Realtime "private only" and function settings
   go into `supabase/config.toml`, starting from the hosted settings (not CLI defaults). `[functions.stripe-webhook]
   verify_jwt = false` is required before it is ever deployed, or Stripe gets 401. `supabase config push` to prod only
   after review. Supabase's built-in email cannot serve production magic links: production needs SMTP.
6. **Secrets and access:** Supabase personal access tokens cover a whole account, so use one bot account per
   organization (dev/staging, prod) with the least role that works; MFA everywhere. The service-role key is never
   put in GitHub. Client keys live in EAS environment variables; Stripe and webhook secrets in Supabase secrets per
   project; nothing in the repo or `.env.local`. No MCP server is ever configured against production. An Expo robot token can publish to any channel, so the
   production-capable `EXPO_TOKEN` lives only in the GitHub `production` environment. A new
   production project may only issue the new `sb_publishable` / `sb_secret` keys, while the Edge Functions read
   `SUPABASE_ANON_KEY` / `SERVICE_ROLE_KEY`; check before E2.
7. **Approvals on a private repo:** branch protection, environments and required reviewers need a paid GitHub plan
   (required reviewers on private repos may need Enterprise). Fallback if not bought: tag rulesets plus an
   environment limited to `v*` tags, and the owner as the only one who can push tags.
8. **Audit:** a release log (tag, commit, migrations, approver, and the EAS update group IDs for dev, staging and prod); CODEOWNERS for
   `supabase/migrations/` and `.github/workflows/`; actions pinned by commit SHA; never `pull_request_target`;
   `permissions: contents: read` by default (set on `ci-checks.yml` 2026-10-13); no SQL Editor changes on prod
   except a logged break-glass.

## 5. Phases (each can stop safely; cost noted)

| Phase | What | Needs | Cost | Owners |
| --- | --- | --- | --- | --- |
| **E0 — no-regret, local** | Done 2026-10-13: replays in CI (hash-pinned PGlite), CI read-only permissions, `EXPO_PUBLIC_APP_ENV` in every EAS profile with a test. Next: `app.config.ts` reading `APP_ENV`; synthetic `seed.sql` (rules in §3) with the demo account moved into it; move the 52 legacy files to `supabase/legacy/`; a channel for the `development` profile; switch `app.json` `runtimeVersion` from `appVersion` to `fingerprint` (needs a new store build); CODEOWNERS | Engineers; Dev/Beta bundle IDs and the final prod bundle ID are owner decisions | $0 | `RELEASE`, `CI`, `DATABASE_MIGRATIONS`, `BACKEND` |
| **E1 — baseline, then automated dev + staging** | **Step 0 (read-only):** list staging's `supabase_migrations.schema_migrations` and compare with the migrations README. **Step 1:** `supabase db dump` staging into `<ts>_baseline.sql` timestamped after the last staging-applied file; add by hand what the dump skips (the `auth.users` trigger, `storage.objects` and `realtime.messages` policies) and check it on a local stack; classify every migration file as in the dump or not **by checking its objects in the dump, not by the README** (some files may have been pasted without being recorded, which the Step 3 dry-run cannot catch); move the files the dump contains to `supabase/migrations-history/`; re-timestamp only files not in the dump, after the baseline. **Step 2:** `supabase migration repair --status reverted` for history rows with no local file, `--status applied <baseline>`. **Step 3:** `supabase db push --dry-run` must list only unapplied files. **Step 4:** rebuild development from the baseline (synthetic data). **Step 5:** `config.toml` from hosted settings; deploy jobs (dev auto, staging behind approval). No more SQL Editor pastes | Owner: bot accounts and secrets in GitHub / Supabase; GitHub plan decision | $0 (Free org) or ≈ $20/mo (dev + staging in Pro org) + GitHub plan | `DATABASE_MIGRATIONS`, `CI`, `SECURITY` |
| **E2 — production** | New Supabase Pro project (US region); production hardening from STATE §5 (private buckets, no anon bypass, no demo PIN or built-in demo password, webhook crediting); SMTP; PITR and a restore drill; error monitoring; release-tag pipeline with owner approval; processor list updated | Wave 1 decision, counsel items, spend approval, store accounts | ≈ $30–60/mo, ≈ $135–175 with PITR, plus shared lines (§2) | `CTO`, `RELIABILITY`, `SECURITY`, `PRIVACY_ENGINEERING`, `TREASURY` |
| **E3 — exit drill (quarterly)** | Stand up self-hosted Supabase (Docker) on a temporary AWS VM from the repo alone: baseline, seed, Edge Functions, one sign-in, one upload; tear it down; record the result. **Synthetic data only** (then AWS is not a processor of real data) | E1 baseline; a machine with Docker and AWS access | a few dollars per drill | `BACKEND`, `RELIABILITY`, `COST_OPERATIONS` |

## 6. When to revisit the host (triggers)

- The Supabase bill stays above a line the owner sets — the operations panel suggests **≈$3k/mo for three months**
  to start a review — and a costed option B or C is cheaper including our time (market research puts the real
  crossover near $10–15k/mo).
- A partner, school district, counsel or insurer requires something Supabase cannot provide (data residency,
  contract terms, a certification).
- A hard limit (connections, Realtime, storage) that a higher plan does not fix.
- Material changes to Supabase pricing or terms.

## 7. Privacy notes (PRIVACY_ENGINEERING)

E2 adds processors to [DATA_PRIVACY_MAP.md](DATA_PRIVACY_MAP.md) §2: error monitoring, the SMTP provider, any admin
portal host — and Expo, which is not listed today. AWS or Azure becomes a processor only if real data lands there.
Backups keep deleted data for 7+ days; disclose that in the privacy policy. Restore drills go into an isolated project
that is deleted afterwards, never into staging.

## 8. Keeping a move cheap

In place: dated migrations with headers; the data map and schema docs in CI; screens call `lib/` or `hooks/`, never
the client directly (`app:data-boundaries`); uploads through `MediaUploadService`; one "not applied yet" check
(`lib/dbErrors.ts`); the whole-schema rebuild in CI. Gaps: 2 operator route files with direct calls; legacy loose SQL
files; no baseline, generated types or seed (R2); full Supabase URLs stored in `reels.video_url`; static `app.json`;
the exit drill has never run.

## 9. Owner decisions needed

1. Confirm option A (managed Supabase) for Wave 0–1, with B as the tested exit.
2. Dev and staging: separate Free organization ($0, no backups, pauses) or inside the Pro organization (≈ $10 each).
3. GitHub plan for protected branches, environments and required reviewers — or the tag-ruleset fallback (§4.7).
4. Bundle IDs: final production ID (`com.logoitino.ala-sports` is permanent once published) and Dev/Beta IDs.
5. Store accounts: personal or LLC Apple / Google developer accounts (LLC needs a D-U-N-S number; a new personal
   Google Play account needs 12 testers for 14 days); store review takes 1–3 days and TestFlight external testing
   has its own review.
6. Production region (US), Supabase spend cap on or off, EAS plan, whether and where to host the admin portal.
7. The cost trigger line (§6) and which startup credits to apply for.
8. E1 start: create the bot accounts and add the secrets (or name who may). E2 timing follows the Wave 1 live-money
   decision (STATE §6 items 8 and 9).
9. CI also runs on a `dev` branch: keep it as an integration branch or drop it.
