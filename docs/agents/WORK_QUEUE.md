# Specialist work queue

Last updated: 2026-10-12. Entry point: [STATE.md](../STATE.md). Owners and executable
instructions: [TEAMS.md](TEAMS.md), [TEAM_HIERARCHY.md](TEAM_HIERARCHY.md), and the agent registry.

An app fix is assigned by `CTO`. The CTO names one lead. That lead names one specialist.
The specialist reports to the lead. The lead reports the fix to the CTO. `VP_OPERATIONS` reports to the CTO, checks that each team is still doing its defined job, and updates roles, protocols, and this queue in the same turn they change. `QA` can reject the result.
The owner (`FACILITATOR`) still decides applying SQL, merging, live money, prices, and counsel.

## Current CTO assignment (2026-10-08; ADM-01 added 2026-10-11, updated 2026-10-12)

The build handed to the CTO is the local Wave 0 app, not a new feature.

| Lead | Assignment | Stop |
| --- | --- | --- |
| `QA` | UX-05e: fixture browser pass of the photo-story counter and dots (2026-10-09). Upload steps, tagline placements, live feed, and device paging are still open | Do not call the device pass done. A live feed shows photo stories only after the photo SQL is applied |
| `ENGINEERING` / `HIGHLIGHTS` | Photo-story prefetch and the owner peek card are already in the local tree | Do not reopen them |
| `BACKEND` | Photo-story, account-tag, public-sport, and operator-check-in SQL stay written only | Do not apply SQL unless the owner asks |
| `SECURITY` | Keep the named gaps visible: client `tips` insert, public profile fields, unapplied operator GPS policy | Do not "fix" those by opening RLS |
| `PRODUCT` | No new Later item (Drip fan tab, Aura-card signature, Hudl file import) | Wait for an owner ask |
| `ADMIN` | ADM-01 (2026-10-11): admin portal charts and dashboards, read-only, on the existing `get_admin_reports` / `get_company_revenue_summary` keys. DESIGN builds the chart kit first; PORTAL, ANALYST, ADMIN and COMMERCE then build their own pages. See the ADM-01 row below | No SQL, RPC, grant, new data key, route, write path or dependency. Status: **Done locally 2026-10-12, review accepted; waiting on the owner to commit and merge.** a–e and integration in `a5d0e8f`; fix waves 1–3, event labels and Codex's report format (owner's default on every page) local and uncommitted. Final review: VISUAL_QA ACCEPT, ACCESSIBILITY PASS, QA gates pass (`pnpm check` 443 tests, portal 80/80). P3s open: source/config keys outside Data disclosures (worst on Sign-in, `auth/page.tsx`); `LedgerTables.tsx:87` wrap pattern. Not verified: Enter on a `<summary>`, native devices, hosted data. Owner decisions 2026-10-12 (below): `bigint` overflow fix approved, migration written, staging application pending the owner's paste; Vault family account direction A, built after counsel with STATE §6 item 8; the all-time donation-total list (VOICE #26) is replaced by counts by band, no names (`donation_bands`, same migration; ADMIN and ANALYST switching Trends and Analytics). Nothing merged or deployed |

Next local check, when a browser is up: `QA` → `VISUAL_QA` for the photo-story feed chip, dots, and tagline placements. Device paging stays with `DEVICE_QA`.

Department plans (where each team is, and what it will do before public): [DEPARTMENT_PLANS.md](DEPARTMENT_PLANS.md). The VP of Operations updates that file when a priority moves.

This is the next execution sequence. A named owner owns the outcome and evidence; paired
specialists review their boundary. Staffing a role does not enable a deferred feature.
An agent definition is an instruction file, not a continuously running worker.

## Active Wave 0 work

### ENV-01 — local launch recovery (2026-10-12)

Functional routing remains `CTO` → `OPERATIONS` → `RELIABILITY`, with `QA` review and
`DOCUMENTATION` handoff. This recovery is an owner-authorized Codex outside session;
the registry's pinned Cursor agents were not executed or reassigned.

| Session | Claimed files / responsibility | Status |
| --- | --- | --- |
| Codex root | Local native dependency repair and Metro; STATE, WORK_QUEUE, TROUBLESHOOTING, AUDIT_REPORT | Released 2026-10-12; fresh web/server and iOS development bundles, browser shell, and `pnpm check` 78 suites / 443 tests passed |
| Codex profile_sport_stats | Native loader, installed binary and worker evidence | Read-only review complete; no files changed |
| Codex sports_accessibility_review | Launch context and repeatable diagnostic review | Read-only review complete; no files changed |
| Codex profile_creative_design | `.claude/agents/photo-stories.md`, TESTER_SCRIPT, PHOTO_STORIES_DESIGN, DATA_PRIVACY_MAP | Released 2026-10-12; published-story, video-tag and metadata descriptions reconciled; docs/links/agents checks passed |

Original photo-story work is present locally. UX-05e still owns browser/device acceptance;
written October migrations remain unapplied. This repair does not advance those gates.

**ENV-02 — follow-up for `BACKEND` / `STORAGE`, with `QA` review:** the settled browser
video fails before decoding (media error 4). Its exact legacy MP4 URL responds to HEAD
with 200 and `text/plain`; the current uploader specifies `video/mp4`. Confirm the
stored payload/container and metadata before preparing an object repair. This is a
separate media-source issue; no hosted object was changed during ENV-01. Evidence and
limits are recorded in AUDIT_REPORT. Device and photo-story acceptance remain open.

| ID | Owner and review | Task | Acceptance / evidence | Status |
| --- | --- | --- | --- | --- |
| ADM-01 | Lead `ADMIN`. a `DESIGN` + `ACCESSIBILITY`; b `PORTAL`; c `ANALYST`; d `ADMIN`; e `COMMERCE`; g `DOCUMENTATION`; h `VP_OPERATIONS`. `ACCESSIBILITY`, `DESIGN`, `VOICE`, `COMMERCE`/`BILLING`, `QA` + `VISUAL_QA` review | Admin portal charts and dashboards. **a** chart kit (`components/charts/*`, `lib/chartScale.ts` + test) and `globals.css` tokens (`--text-muted` contrast fix, `:focus-visible`); **b** Home, Audience, Health, Departments, Product and the shell (minutes on tab time, Game Day label, OperationsBoard tab semantics, `—` for a missing key); **c** `/analytics` eight dashboards on the kit; **d** Trends (`/reports`) and additive `REPORT_LABELS` in `lib/reports.ts` (minutes, `n%` scroll, 24 h pace row); **e** Revenue (`/money`); **f** reserved: a per-origin day chart needs a `lib/reports.ts` parse change, not this pass; **g** STATE §4, CHANGELOG, AUDIT_REPORT link; **h** registry `owns`: `components/charts` and `lib/chartScale.ts` (+ test) to `PORTAL` (`DESIGN` and `ACCESSIBILITY` review any prop or visual change), `components/revenue` to `COMMERCE` | Every chart names a key from the CTO's §0 contract; only clips and donations get a prior-week delta; missing ≠ zero; each chart has a figure, summary, and a Data table; no chart library, no new dependency, no write path, no new route. Each owner reports typecheck plus `node --import ./lib/analytics-resolver.mjs --test lib/*.test.ts` (baseline 15/15, Node version named). QA gate: portal typecheck and a real `next build`, `pnpm check`, docs/copy/comments/agents checks, grep proof of no new `rpc(`/writes, VISUAL_QA screenshots at 320/768/1280 and 200% zoom on the empty-state server and a fixture harness (no hosted data) | **Live status and resume steps: [ADM-01.md](ADM-01.md).** Assigned 2026-10-11. Baseline `c5a95a8`. Roles reconciled (Trends `ADMIN`, Revenue `COMMERCE`, admin.md auth paragraph). Status 2026-10-12 (from ADMIN's reports): a–e and g done locally (chart kit in `a5d0e8f`); integration done; Phase C review (`QA`, `VISUAL_QA`, `VOICE`, `ACCESSIBILITY`) in progress; f not this pass. h done 2026-10-12: chart kit owned by `PORTAL`, `components/revenue` by `COMMERCE` in registry, portal.md, commerce.md and TEAMS.md. Not merged, not deployed. **Update 2026-10-12:** Phase C review done (QA ACCEPT, VOICE changes, ACCESSIBILITY FAIL on small fixes, VISUAL_QA defects). Fix waves 1–3 done locally, uncommitted, portal tests 72/72. New shared modules (PORTAL): `lib/measureColors.ts` + test, one colour per measure, and `peakLabelAnchor` in `lib/chartScale.ts`; `lib/eventLabels.ts` + test (plain words for telemetry keys) is on disk and still being finished. Codex UI/UX follow-up: sticky header removed (WCAG 2.4.11), Community Impact Home built from an owner-selected Canva design, report format (wide header, underline tabs, open panels, report charts) being applied to every tab, adopted by owner decision as the default everywhere. **Status: Done locally 2026-10-12, review accepted; waiting on the owner to commit and merge.** `lib/eventLabels.ts` wired in; report format on every page; final browser review VISUAL_QA ACCEPT (after one P2 fix: Health counts split at 320px) and ACCESSIBILITY PASS; `pnpm check` 78 suites / 443 tests and portal 80/80 pass; STATE, CHANGELOG and AUDIT_REPORT updated. P3s open: source/config keys visible outside Data disclosures (worst on Sign-in, `auth/page.tsx`); `LedgerTables.tsx:87` detail values share the old wrap pattern (did not split). Not verified: Enter on a `<summary>`, native devices, hosted data. Owner decisions 2026-10-12: `get_admin_reports` `bigint` overflow approved (migration written; staging application pending the owner's paste); Vault money in the custodial family account, direction A, built after counsel with STATE §6 item 8; the all-time donation-total list (VOICE #26) replaced by counts by band, no names |
| UX-05a | `DATABASE_MIGRATIONS`, `BACKEND`; `RLS_SECURITY`, `STORAGE` review | Photo stories schema: `20261007230000_photo_stories.sql` (`reels.media_type`/`photo_count`, `reel_photos`, `set_reel_photos` RPC, `reel_photos_feed`, extended `reels_feed`) per [PHOTO_STORIES_DESIGN.md](../engineering/design/PHOTO_STORIES_DESIGN.md) | RLS on `reel_photos` with owner/admin select and no direct writes; RPC enforces caller = uploader, `photo_story` type, 1–10 items, anchored own-folder Storage paths, publish-once, descriptions ≤ 200; feed views gate `image_path`/`cover_path` like `video_url`; existing `reels_feed` columns unchanged in order; mirrored in `schema.sql`, `types/database.ts`, SCHEMA.md, migrations README with rollback; `pnpm docs:check`. Written ≠ applied: no hosted application without authorization | Complete locally 2026-10-07 (QA path/publish-once fixes included). SQL not applied. RLS replay pending |
| UX-05b | `PHOTO_STORIES`, `UPLOAD`; `CONTENT_RIGHTS`, `MINOR_SAFETY`, `ACCESSIBILITY` review | Photo story upload: Media `Video \| Photos` switch, pick/reorder/remove up to 10, per-photo descriptions, metadata stripping, Storage upload and `set_reel_photos` | Photos hidden when RPC/columns missing; ≥ 1 photo, caption, athlete tag, photo rights wording required; Vault hidden; `exif: false` + `stripJpegMetadata` unit tests prove GPS/EXIF/XMP removed and image data intact; `Uploading photo 2 of 5`; partial failure publishes nothing and retry keeps the draft; draft survives Back; 44-point labelled Move earlier/later; `movePhoto` and fallback tests pass | Complete locally 2026-10-07. Photos stay hidden until SQL is applied. Device picker/orientation pending |
| UX-05c | `HIGHLIGHTS`, `PLAYBACK`; `DESIGN`, `ACCESSIBILITY` review | Photo story feed, profile grid poster and the **Game Day** label (stored `game_play`) | `PhotoStoryMedia.tsx` replaces the video area for `isPhotoStory`; horizontal paging inside the vertical pager; `2 / 5` chip, dots and current description; per-photo labels/adjustable actions; photos load when current card; the pager prefetches the photo story immediately above and below; rail/donate/report/credit unchanged; 3-second view rule; missing columns treated as video; `TaggedReelGrid` uses `coverUrl` + `📷 n` (pair PROFILE); "Game Play" shown as "Game Day" everywhere with no data migration | Complete locally 2026-10-07 (Game Day label included). Neighbor photo stories are prefetched into the session cache. Device paging pending |
| UX-05d | `VOICE`, `MARKETING`; `LEGAL`, `PRIVACY_ENGINEERING`, `DOCUMENTATION` review | Photo story copy, legal and privacy documentation | `pnpm copy:check` clean; Donate-only money words on story cards; LEGAL row: "Elevate their opportunities" promises no recruiting/scholarship/exposure outcome; DATA_PRIVACY_MAP lists photos, per-photo descriptions and the metadata rule; GLOSSARY/TESTER_SCRIPT updated; generated facts and counsel conclusions untouched | Complete locally 2026-10-07 (LEGAL rows U–W). Nothing published externally |
| UX-05e | `QA`, `VISUAL_QA`, `DEVICE_QA` | Independent verification of UX-05a–d and BRAND-01 placements | Jest/typecheck/guards actually run; VISUAL_QA Playwright evidence on Expo web at narrow widths and large text (upload steps, reorder, progress, feed chip/dots, tagline placements) recorded in AUDIT_REPORT; DEVICE_QA native picker, orientation after stripping and paging on real devices or explicitly pending; unapplied migration reported as not verified | 2026-10-09: Jest 6 suites / 60 tests. Fixture browser pass of the feed counter and five dots at 320 and 375, including 320 at 200% CSS text; Next moves 1/5 to 2/5. Photo bitmap did not paint. Upload steps, reorder, progress, tagline placements, live feed, and device checks still open. SQL not applied |
| BRAND-01 | `BRAND`, `VOICE`; `LEGAL` review | Place the owner-approved message "Donate. Elevate. Celebrate." — *Support their journey. Elevate their opportunities. Celebrate their story.* | Exact wording in VOICE.md tagline section and the approved placements only: welcome overlay (`ONBOARDING`), donate sheet header (`CHECKOUT`), athlete profile donate area (`PROFILE`), STORY/PUBLIC and store copy (`STORE_LISTING.md`); no outcome promise; `pnpm copy:check` and `pnpm docs:check` pass; VOICE and LEGAL sign-off recorded; nothing published externally | Complete locally 2026-10-07 in the four approved placements. Not published to a store |
| TOOL-01 | `DESIGN_TOOLING`; `ENGINEERING` review | MCP tooling for UI/UX: project `.mcp.json` (Playwright, Expo, Canva, read-only Supabase dev) and user-level Figma, documented in [TOOLING.md](../engineering/TOOLING.md) | Each server's purpose, users and safety limits documented; Supabase pinned to development with `read_only=true`; no staging/production connection, write token or EAS build/submission without owner approval; Playwright evidence path (`.playwright-mcp/`, git-ignored) usable by VISUAL_QA | Configured locally; servers load on next Claude Code start in the repo; OAuth for Canva/Expo/Supabase pending owner sign-in |
| UX-03 | `LOCAL`, `PROFILE`, `HIGHLIGHTS`, `DESIGN`, `DOCUMENTATION`; `ACCESSIBILITY`, `QA`, `DEVICE_QA` review | Strengthen sports identity across game cards, profile hero and Highlight overlays | Scores tied to full team names; scheduled/final states beat stale clocks; missing values not invented; known athlete credentials only; community credentials hidden; confirmed crests preserved; profile/reaction/donation actions retained | Complete locally: `pnpm check` passes both typechecks, 53 suites / 256 tests and all guards; 17 targeted Local/Profile/Reel/banner tests; QA boundary fixes verified; web export passes (52 static / 3 API). Browser follow-up: 55 suites / 261 tests; identity/crest/spoken-school/close regressions fixed; controlled narrow/large-text browser checks and fixes recorded in AUDIT_REPORT. Native readers/text scaling/playback-paging gestures and hosted verification pending |
| UX-04 | `PROFILE` primary; `ATHLETE_STATS`, `AURA`, `DESIGN`, `DOCUMENTATION`; `QA`, `ACCESSIBILITY`, `VOICE` review | Match sport stats/Aura and compact owner/public navigation | One sport/playbook, honest missing data; direct Goals/Team/Manage, exact ownership, stale navigation guarded; hidden schools retained | Implemented locally; final evidence in AUDIT_REPORT. Public sport migration prepared, unapplied. Native and PostgreSQL/hosted replay pending |
| UX-02 | `CHECKOUT`, `DESIGN`, `UPLOAD`, `DOCUMENTATION`; `VOICE`, `ACCESSIBILITY`, `QA`, `DEVICE_QA` review | Compact Donate in one popup; playful Daylight upload/menu/page consistency; synchronize every team handoff | Amount/Options/Review; fixed navigation; choices preserved on Back; explicit totals/split/No tip default; final-action-only payment; no duplicate/dismissal during payment or payment during close; successful payment terminal on recording failure; old recipient completion/callbacks suppressed; exact fee accessible label; shared coverage inventory and device gaps recorded | Complete locally: full Jest 50 suites / 242 tests; latest checkout guard 8 targeted tests; both app typechecks pass; four review findings addressed. Native visual/accessibility/payment, hosted and build verification pending |
| UX-01 | `UPLOAD`, `DESIGN`, `ACCESSIBILITY`, `QA` | Replace long upload form with compact video/details/review steps and optional settings | Fixed header/footer; draft preserved on Back; picker cancel harmless; athlete/caption/rights required; optional tags/game/Vault retained; no duplicate publish; screen/keyboard device checks explicitly recorded | Complete locally: 7 upload scenarios; 47 suites / 228 tests and mobile typecheck pass; native/keyboard checks pending |
| W0-01 | `PRODUCT`, `ENGINEERING`, `CI`, `QA` | Expand functional ownership, agent definitions and hierarchy; validate registry in CI | 83 registry calls have files, valid reporting leads, existing ownership paths and matching team document entries; semantic ownership independently reviewed | Complete locally; registry and ownership review passed |
| W0-02 | `LOCAL`, `FULLSTACK`, `REALTIME`, `QA` | Remove direct database access from guest game/player routes | Route exceptions fall from 8 to 6; preserve match/feed errors and cached roster fallback; late live joins stop after cleanup | Complete locally; route/data-layer regressions and final checks pass |
| W0-03 | `ACCOUNT_TAGS`, `UPLOAD`, `BACKEND`, `RLS_SECURITY`, `QA` | Repair account-tag reliability before applying its October SQL | Real attach failures distinguished from missing SQL; failed confirmation remains pending; no false success for stale/wrong actor; concurrent tags serialized to max 3 | Complete locally; helper/inbox/upload regressions pass; SQL concurrency/RLS execution pending |
| W0-04 | `PRIVACY_ENGINEERING`, `CUSTODIAL`, `COMPLIANCE`, `QA` | Correct privacy inventory and historical readiness claims | DOB exception, custodial records, mentions, reports and school contacts listed; recorded staging readiness separated from fresh verification | Corrected locally; no remote verification |
| W0-05 | `AUTH`, `RELEASE`, `CHECKOUT`, `DEVICE_QA` | Verify installed-build staging sign-in and test checkout | Identify build/project; email callback returns signed in; test donation records once using current client credit path; no live-money assertion | Ready for staged device run; hosted config not checked this session |
| W0-06 | `STORAGE`, `VAULT`, `DATABASE_MIGRATIONS`, `RLS_SECURITY`, `QA` | Review and prepare private Vault bucket setup | Private bucket and correct policy/dependency order; uploader/entitled viewer allowed, unrelated account denied; public uploads still work | Staging bucket recorded missing; setup not applied |
| W0-07 | `DATABASE_MIGRATIONS`, `OPERATOR`, `RLS_SECURITY`, `QA` | Validate operator check-in role policy migration | Signed-in fan denied GPS reads/inserts; operator/admin allowed; anon demo exception explicitly internal-only; rollback verified | `20261002120000` written, not applied; SQL execution pending |
| W0-08 | `ACCOUNT_TAGS`, `DATABASE_MIGRATIONS`, `RLS_SECURITY`, `TEST_AUTOMATION` | Validate and stage account-tag migration after W0-03 | Two-user pending/privacy/confirm/reject tests, wrong actor denied, parallel writes max 3, athlete remains donation recipient | Local fix first; database execution pending |
| W0-09 | `DEVICE_QA`, `QA`, feature owners | Run enabled-role device smoke | Android + registered iPad evidence for upload, rights/reports, donation, receipts, Rally/thanks, profile, retry; every P0/P1 assigned | Pending real devices; [TESTER_SCRIPT.md](../engineering/TESTER_SCRIPT.md) |

Phase 2 local gate passed 2026-10-10 (`pnpm check`, 72 suites / 414 tests). Run W0-05 through W0-09 on the current previews linked in STATE §0 and record the actual installed build. The October 11 night previews omit later Tag-later changes; the October 1 installs omit the subsequent UI work. Applying SQL,
changing hosted configuration, publishing a build, and live money have distinct gates; a local
passing Jest run does not certify any of them. Current build links are in STATE §0.

## Engineering readiness (R1–R4)

The plan and its checklists live in
[CODE_ORGANIZATION_PLAN.md](../engineering/CODE_ORGANIZATION_PLAN.md). These are not the product
phases in ROADMAP. R3 (production) waits on R2 and on the Wave 1 owner decisions.

| ID | Owner and review | Task | Acceptance / evidence | Status |
| --- | --- | --- | --- | --- |
| R1-01 | `ENGINEERING`, `DOCUMENTATION`; `QA` review | Repo and docs tidy for outside engineers | Topic commits; clutter in `archive/`; docs in engineering/product/legal/company/agents with 0 broken links; README, docs index, GLOSSARY, ONBOARDING start-here; `pnpm check` | Done locally 2026-10-07; `pnpm check` passes |
| R1-02 | Owner; `RELEASE`, `CI` | Merge `wave0-custodial-verification` into `main`, push, protect `main` | PR merged with CI green; `main` requires PR + passing checks; no direct pushes | Needs owner approval and GitHub access |
| R1-03 | Owner; `COMPLIANCE`, `DOCUMENTATION` | Move `docs/legal/` and `docs/company/` to a private location before outside access | Folders replaced by a pointer README; links updated; `pnpm check` passes | Waiting on owner choice of location |
| R2-01 | `DATABASE_MIGRATIONS`, `BACKEND`; `RLS_SECURITY` review | Supabase CLI layout: `config.toml`, synthetic `seed.sql` (Demo Fan, demo PIN, sample games/clips) | `supabase db reset` builds a working dev database from the repo alone | Not started; CLI not installable on the owner's Mac (run in CI or elsewhere) |
| R2-02 | `DATABASE_MIGRATIONS`, `RELEASE` | Authorized staging snapshot; baseline cutoff/replay and hosted history reconciliation plan; compare `schema.sql`; legacy SQL to `supabase/legacy/` | Snapshot-covered migrations are not replayed; auth/Storage/Realtime prerequisites documented; every difference resolved or listed; loose files archived with README (52 is the historical count); hosted history writes separately authorized | Not started; authorized database access and reconciliation review required |
| R2-03 | `SHARED_CONTRACTS`, `CI` | Generate `types/database.ts` and `schema.sql`; CI fails on drift; replay agreed baseline and later migrations in an isolated Supabase stack | Generated headers; drift check, clean `supabase db reset`, synthetic seed and auth/Storage policy checks green in CI; plain Postgres alone is insufficient | Not started |
| R3-01 | `RELEASE`, `FULLSTACK`; `SESSION_SECURITY` review | `app.config.ts` per `APP_ENV` (name, bundle ID, icon, scheme); EAS env vars per profile | Dev, preview and production builds install side by side and point at the right project | Not started |
| R3-02 | Owner; `RELEASE`, `RLS_SECURITY`, `STORAGE`, `RECOVERY` | Production Supabase project with secrets, private buckets, backups and restore drill | Migrations applied by CI; no anon bypass or demo PIN; restore drill recorded | Gated on R2 and STATE §6 items 8–9 |
| R3-03 | `CI`, `RELEASE`, `RELIABILITY` | Deploy pipeline: `main` → staging, release tag → production; error monitoring | A tagged release reaches production with no manual SQL; errors visible per environment | Not started |
| R4-01 | `API`, `BACKEND`; `QA` review | Retire Expo API routes in `apps/mobile/src/backend/api/` in favour of the Edge Functions | Checkout, Connect and payouts work on every project with the routes removed; tests updated | Not started; confirm Edge Function secrets on each project first |
| R4-02 | `CI`, `ENGINEERING` | ESLint + Prettier enforced in CI | Config committed; CI lint step green; formatting PR is behaviour-free | Not started; needs a machine with npm registry access |
| R4-03 | `ENGINEERING`, feature owners; `TEST_AUTOMATION` | Split 900+ line files; route data debt to zero; screen tests for donate/upload/sign-in; admin-portal tests | One behaviour-free PR per split; `app:data-boundaries` baseline at 0; new suites green | Started 2026-10-10. Route debt is the two operator screens (7 calls). Athlete, parent, Profile, and the public athlete sheet moved into `lib/`. File splits and screen tests are still open |

### Organization review evidence — 2026-10-07

- Tracked active Markdown relative file links resolve (0 broken links). Workspace/build paths
  exclude `archive/`; setup and phase instructions were reconciled with the current code.
- Expo web export passed locally with `EXPO_NO_DOTENV=1`: 52 static routes and 3 API routes.
- Separate iOS/Android one-worker exports passed with Hermes bytecode (8.2 MB / 8.4 MB);
  signed native binaries and device interaction are not verified by those exports.
- Next optimized build passed locally for all routes. These are local build checks; hosted
  credentials, installed-build sign-in, native layouts and test-payment acceptance remain pending.
- Final `pnpm check` passed both app typechecks, 50 suites / 242 tests and all guards,
  including `docs:links` and `security:client-keys`; both new guards also rejected invalid fixtures.
- Next sequence: finish/review R1 locally, prepare the R2 baseline and clean replay plan, then
  R3 after its owner/Wave 1 gates. Independent R4 splits/tests may accompany R2.

## Specialist backlog beyond the immediate sequence

| Function | Accountable specialist | Next bounded assignment |
| --- | --- | --- |
| Search and low-view discovery | `DISCOVERY` | Verify existing query/filter empty/error behavior; low-view lane remains later |
| Notification queue | `NOTIFICATIONS` | Inventory `crew_push_queue` producers/consumers and delivery guarantees; do not add unsolicited messaging |
| Shared schema contracts | `SHARED_CONTRACTS` | Map manually maintained types to current RPCs and prepare generation check without pretending a live dump exists |
| Video/feed performance | `MOBILE_PERFORMANCE`, `PLAYBACK` | Capture real-device load, player teardown, dropped frames and memory for enabled feed |
| Backup and restore | `RECOVERY` | Prepare staging restore drill using synthetic data and explicit RPO/RTO targets; no uptime promise |
| Costs | `COST_OPERATIONS` | Estimate current storage/bandwidth/build use from verifiable inputs; no service purchase |
| Vault disclosure | `BILLING`, `VOICE`, `LEGAL` | Fan labels now match the one-time Exclusive charge. Upload and Vault copy name one-time Exclusive access and the price without `/mo`. Auto-renewal disclosure stays off |
| Gear goals and receipts | `WISHLIST`, `RECEIPTS` | Verify donation-linked totals and receipt state against test payments; ledger limitations explicit |
| Moderation and minor safety | `MODERATION`, `MINOR_SAFETY`, `CONTENT_RIGHTS` | Local Open flags columns show the report reason and whether an athlete or guardian reported the clip. Strikes and appeals are still unbuilt. Authorized review and escalation evidence before public video remain open. |
| Support and research | `SUPPORT`, `RESEARCH`, `MARKETING` | Prepare internal tester triage and consent-aware feedback plan; contact requires authorization |

## Scope next, before public release

| ID | Lead and review | Deliverable | Acceptance / dependency |
| --- | --- | --- | --- |
| P1-01 | `PRIVACY_ENGINEERING`, `BACKEND`, `FULLSTACK`, `LEGAL` | Account export/deletion design | Identity authorization, other people's clip/roster relationships, Stripe/Storage processing, financial retention and requester disclosure agreed before destructive implementation |
| P1-02 | `RLS_SECURITY`, `AUTH`, `PROFILE`, `PRIVACY_ENGINEERING` | Public profile field allowlist | All public readers mapped; owner/admin self-read preserved; sensitive fields unavailable through base table as well as view; staging authorization tests |
| P1-03 | `UPLOAD`, `STORAGE`, `PRIVACY_ENGINEERING` | Upload metadata removal plan | Photo/video GPS and EXIF inspected before/after; native/web paths and compression failures covered; approved fallback cannot expose raw metadata silently |
| P1-04 | `PRIVACY_ENGINEERING`, `OPERATOR`, `CUSTODIAL`, `ATHLETE_VERIFICATION` | GPS/verification/DOB retention and correction plan | Purpose, duration, authorized correction, audit record and deletion schedule assigned; counsel reviews requirements |
| P1-05 | `LEDGER`, `CHECKOUT`, `RECONCILIATION`, `BACKEND`, `QA` | One authoritative payment credit path | Verified payment/replay/retry produces exactly one donation credit; client write retired in same rollout; reconciliation and rollback specified; do not deploy crediting independently |
| P1-06 | `SESSION_SECURITY`, `ADMIN`, `OPERATOR`, `RLS_SECURITY` | Real operator/Studio sessions | Every affected anon policy mapped and removed together with role-based clients; unauthorized RPC/table callers denied |
| P1-07 | `TELEMETRY`, `PRIVACY_ENGINEERING`, `BACKEND` | Telemetry identity implementation plan | Privacy disclosure and admin-only reads agreed before user/session identifiers are collected; bounded events and consent posture preserved |

## Compliance routing note — 2026-10-10

What the app already does, and which team may do the next product work, is in [LEGAL_BRIEFING.md](../legal/LEGAL_BRIEFING.md) under "Compliance routing — 2026-10-10". That note does not finish counsel's documents. P1-01 and the owner decisions below stay open. No new task id.

## Decisions held with the owner

| Decision | Preparing team | Required decision / evidence |
| --- | --- | --- |
| Family payment routing and guardian handover | Finance, custodial, Legal | Destination-charge vs platform ledger model; state age rules; verified approvals and Stripe mechanics |
| Held donation cap/refund window | Finance, Trust & Safety, Legal | Cap/window and refund authority; ledger design |
| App Store donation/fee treatment | Finance, Legal, Release | Counsel disposition on disclosed 90 / 10 and optional tip; approved implementation before live money |
| Video host | Media, Reliability, Finance | Mux/Cloudflare comparison using actual playback/entitlement/bandwidth requirements; owner selects |
| Apple wallet and iPhone distribution | Release, Checkout | Merchant ID/certificate and device registration controlled by account owner |
| Public safety/consent process | Trust & Safety, Legal, Partnerships | Human moderation, school/association permissions, minor consent and escalation contacts |
| Admin reports overflow fix (ADM-01, 2026-10-12) | Database (`BACKEND`, `DATABASE_MIGRATIONS`), Security | `get_admin_reports` `sum(duration_ms)::int` overflows past about 596 hours of tab time in a window and fails every portal page. Fix is a `bigint` cast in a new migration. **Approved 2026-10-12; migration written; staging application pending the owner's paste.** `supabase/migrations/20261012180000_admin_reports_bigint_and_donation_bands.sql` (`DATABASE_MIGRATIONS`) also adds `donation_bands`, the counts by band (no names) that replace the all-time donation-total list (VOICE #26, owner 2026-10-12). The owner applies it on staging (`tucioqipfejqqqtuakdi`) through the SQL Editor; this Mac has no database credentials. Not applied anywhere yet |
| Vault money and the family account (ADM-01, 2026-10-12) | Finance (`COMMERCE`, `CUSTODIAL`, `LEDGER`), Legal | The ledger records the Vault 80% for the athlete (`payee_kind` `athlete`), but `get_custodial_summary` sums only `tips`, so it never reaches the custodial family account. Copy says "recorded for the athlete" until it is built. **Direction chosen: A; build after counsel with item 8** (owner 2026-10-12): Vault/Exclusive money is treated like donations, credited to the same custodial family account under the same guardian rules. Nothing is built in Wave 0 (test mode); finalised with STATE §6 item 8 when the owner meets payments counsel |

Drip activation, filmer cash, fan signatures, free-text athlete/fan messaging, paid sessions,
game-day gigs and savings custody remain in their recorded later waves. Their specialists can
prepare scoped reviews; implementation starts only when that item is authorized.

## Handoff format

Use `ID`, lead, paired reviewer, paths, acceptance, current evidence, and next action when
dispatching. Before editing shared files, agree on ownership and claim them in the task tracker's Status table; release the claim when done. Another tool's session (Codex, Cursor, a person) may be editing the same tree: check file times before each edit, never revert its work without the owner, and ask the owner when two sessions hold conflicting instructions (TEAMS.md, Specialist operating contract, item 10). Each result states exactly what
was tested, what remains unverified, and whether it is merely written or actually applied.
`QA` owns the final release gate; department completion does not override it.
