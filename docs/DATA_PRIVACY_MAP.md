# Tapua'i — Data collection map & recommended structure

**Status:** Internal engineering reference, not legal advice, not a Privacy Policy, and not a claim of compliance with any statute. It exists so counsel drafting the real Privacy Policy (`docs/COMPANY_PHASES.md` §L4 item 2) has an accurate starting inventory instead of reconstructing one from the schema by hand, and so this repo has one place to re-check whenever a new table, column, or RPC starts collecting something about a real person.

Read with [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md) (the issue map — COPPA, minors-as-payees, money transmitter, school footage) and [COMPANY_PHASES.md](COMPANY_PHASES.md) (when the real Privacy Policy actually gets drafted, by counsel). This file answers "what do we actually collect today" so that conversation starts from fact, not guesswork.

---

## 1. What we collect, by category

| Category | Where (table / service) | Subject | Notes |
| --- | --- | --- | --- |
| Identity (name, username, avatar, bio, social handles) | `profiles` | Any signed-in user | `bio`/`social_links` are self-authored, hideable per-field (`profile_visibility`) from other *users*, but the base `profiles` row is still publicly `SELECT`-able at the database layer (see §3). |
| Athlete roster identity (real name, jersey, school, physical measurables) | `players` | **Minors**, usually entered by an operator/admin, not the athlete | No sign-in or attestation required for a `players` row to exist — a minor can be named on the roster with zero account of their own. Publicly `SELECT`-able by design (fans browse rosters). |
| Athlete performance data | `athlete_career_stats`, `athlete_game_logs` | Minors | Tied to `player_id`; same public-read posture as `players`. |
| Video content | `reels` (`video_url`, `uploaded_by`, `player_id`) | Minors (subject), any signed-in user (uploader) | Free Highlights sit in a bucket with a public URL; Vault/Exclusive clips use a private bucket + short-lived signed URL (`reel_vault`, `resolvePlaybackUrl`). No EXIF/metadata stripping happens on any upload path today — see §3. |
| Financial / payment records | `tips`, `subscriptions`, `sponsorships`, `disbursements`, `shop_orders` | Payer (any age) + minor recipient | Amounts, timestamps, and (for `tips`) *why* a gift happened (`origin`/`entry`/`source_label`). No card data ever touches the app's own tables — that stays with Stripe. |
| Location | `operator_checkins` (`latitude`, `longitude`) | Field operator (adult, in practice) | Collected once per gig check-in via `expo-location`, persisted indefinitely, no purge job. See §3 for the RLS gap fixed alongside this doc. |
| Behavioral / engagement | `reel_hype_votes`, `saved_reels`, `crew_follows`, `crew_push_queue`, `telemetry_logs`, `app_feedback` | Any signed-in user (and, for `telemetry_logs`/`app_feedback`, sometimes anonymous) | `telemetry_logs` rows are not foreign-keyed to a user id, and guests (no account) can insert them on purpose (browse-first). Row shape is bounded by CHECKs (`20260929190000_telemetry_logs_bounds.sql`, applied to staging): known event types, capped durations, text and payload sizes. Many small valid-looking rows are still possible; per-user logging is an open owner decision (`docs/STATE.md` §6 item 1) and needs Terms copy first. |
| Consent / age state | `profiles.age_confirmed_13_plus`, `players.parental_consent_approved` / `guardian_consent_at` | Minors (subject), parent (actor) | Self-attested boolean only — **no birthdate is ever collected, by design** (data minimization). See §4. |
| Device-local queue | `AsyncStorage` (`OfflineQueue`) | Any signed-in user | Can hold a `userId` plus pending Aura/vote/bookmark/report actions unencrypted on-device until the next successful flush. |

---

## 2. Who we share data with

- **Stripe** — email (for Connect account contact), a Supabase-generated user id in metadata, and payment amounts. No name, DOB, or tax id is sent by this app's code (`createStripeAccount.ts`, `createPaymentIntent.ts`, `payouts.ts`). Stripe Connect Express accounts are built as **US individual** accounts — `LEGAL_BRIEFING.md` §5 already flags this as a likely mismatch for a 16-year-old payee; `COMPANY_PHASES.md` §B2 has the parent-as-payee redesign this needs before minors connect their own account.
- **Supabase Storage** — raw video/image bytes, uploaded verbatim with no metadata stripping (§3).
- No other third party receives personal data today (no analytics SDK, ad network, or data broker found in the dependency tree during this audit).

---

## 3. Concrete gaps found (2026-09-28 audit, re-checked 2026-10-02)

These are structural/engineering facts, not legal conclusions — counsel decides which ones are legally required to fix and on what timeline.

1. **Fixed in SQL, not yet applied:** `operator_checkins` (GPS coordinates) had a policy of `using (true) with check (true)` — no role check at all, weaker than its own sibling table `operator_gigs`. Any signed-in account, not just an operator, could read every check-in's location or write fabricated ones. `supabase/migrations/20261002120000_operator_checkins_role_check.sql` brings it to parity with `operator_gigs`'s existing (already-documented, already-accepted-for-internal-testing) anon/operator/admin check — see `docs/ROADMAP.md`'s Phase 5 "First hard blocker" note, which this now matches rather than falls short of. Not applied to any Supabase project yet.
2. **Not fixed, needs a product decision:** `profiles` and `players` both keep a blanket `using (true)` SELECT policy — the entire row, including `profiles.stripe_connect_id`, is publicly readable. This is the same gap `docs/ROADMAP.md` Phase 0 item 4 already tracks; the `profiles_public` view added for the bio/social-links feature (Round 34) does **not** close it. `players`' openness is a separate, more defensible case — school rosters are meant to be publicly browsable — but a minor's physical measurables (height/weight/40-yard time) being part of that public row is worth a specific counsel read.
3. **Not fixed, needs a product decision:** no EXIF/location metadata stripping on any upload path (`MediaUploadService.ts`). A camera-recorded Highlight can carry embedded GPS in its raw file, uploaded unmodified to a bucket with a public URL for free clips. Stripping this is a bounded engineering task (re-encode or strip metadata server-side, or client-side before upload) whenever it's prioritized.
4. **Not fixed, needs a product + legal decision:** no account-deletion or personal-data-export path exists anywhere in the app — confirmed by exhaustive grep, zero hits. Building this is a real feature, not a quick patch, because deletion has to decide what happens to rows a deleted user is linked to that other people depend on (a `tips` row an athlete's accounting relies on, a `players` row other fans follow, a `reels` row tagging someone else). A reasonable shape once scoped: soft-delete/anonymize `profiles` (null out `full_name`/`avatar_url`/`bio`, keep the row for FK integrity) rather than hard-delete, keep financial records (`tips`, `disbursements`) intact for the athlete's own accounting and any tax reporting, and let the requester see exactly what would be kept and why before confirming.
5. **Not fixed, already known:** `players` rows (a minor's name, school, physical stats) can exist with no linked `profiles`/auth account and no attestation of any kind — the COPPA-adjacent age gate on `profiles.age_confirmed_13_plus` never applies to a roster entry an operator or admin creates directly.
6. **Not fixed, already known and explicitly out of scope for engineering to build unprompted:** no CSAM/content-moderation pipeline beyond `reels.is_flagged` + `reported_by` — `docs/LEGAL_BRIEFING.md` and `docs/COMPANY_PHASES.md` already say this is "a vendor plus a policy," not a schema change.

---

## 4. Recommended structure (for counsel to review, not a certification)

A reasonable, defensible shape for a product that collects data from and about minors, based on the well-known general principles behind COPPA and typical state privacy statutes — **not** a claim that this shape satisfies any specific one:

1. **Data minimization, already partly in place** — no birthdate is collected (§1), only a self-attested 13+ checkbox. Keep this pattern: prefer "is this true" booleans over exact personal facts wherever a boolean serves the same product need.
2. **Separate the athlete's public identity from their account.** A `players` row is roster/public-identity data (name, school, jersey) that the product needs to be public for fans to find and follow. Personal *account* data (email, payment info, consent state) should stay behind the `profiles`/auth boundary it already does — the open item is narrowing what of `profiles` itself is public (§3.2), not making rosters private.
3. **Collect location only for the purpose stated, and only from the role that needs it.** `operator_checkins` is scoped correctly in *purpose* (a gig check-in) — item §3.1 closes the *access* gap; a retention limit (e.g., purge check-ins after a season) is a reasonable next step once a product owner decides how long that data is actually useful.
4. **A visible, working way to delete an account and export what's held.** This is close to a baseline expectation across US state privacy laws (and a hard COPPA requirement for a child's data specifically) even before counsel finalizes which statutes formally apply — §3.4 has a starting shape.
5. **Strip or avoid collecting metadata the product doesn't need.** EXIF/location in an uploaded video is a byproduct of the phone's camera, not something the product asks for — stripping it (§3.3) removes a category of personal data with no feature cost.
6. **Consent for a minor's data should be a real, re-checkable record, not a single boolean set once.** `players.parental_consent_approved` is already named in `docs/COMPANY_PHASES.md` §L4 item 3 as needing to become more than a boolean — this doc adds no new requirement there, just cites it as directly relevant to this same data-map exercise.

---

## 5. Keeping this current

Whenever a new table, column, Storage bucket, or RPC starts holding personal data about a real person, add a row to §1 here in the same pass — mirroring how `docs/ROADMAP.md`'s security sweep gets re-run when a new table/RPC/Realtime channel lands. This file and that one should stay siblings: one asks "can this be faked or stolen," the other asks "should we be holding this at all, and for how long."
