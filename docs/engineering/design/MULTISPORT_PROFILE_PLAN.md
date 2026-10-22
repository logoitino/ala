<!-- Task ownership and sequential admin checkpoints preserve source and user data. -->
# Multiple sport profiles Implementation Plan

> For agentic workers: use superpowers:executing-plans task by task; each delegated unit has explicit ownership.

**Goal:** Support manually chosen primary plus independently recorded secondary sports.
**Architecture:** Atomic profile-sport RPCs, explicit career/log/media sport tags, guarded client snapshots.
**Tech Stack:** Expo58, React Native0.88, TypeScript, Supabase PostgreSQL, pnpm/Node24; installed sources approved.
**Spec:** [MULTISPORT_PROFILE_DESIGN.md](MULTISPORT_PROFILE_DESIGN.md)

## Global constraints

- Admin-first source/operations verification before fan multi-sport implementation.
- No new packages, hosted SQL, secrets, provider accounts, portal writes or money changes.
- Header comments on touched files; same-turn STATE/index/data/privacy/support/exit documentation.
- Preserve user text scaling,44-point tap targets, primary field artwork and posted-media sport identity.

## Task1: Source, access and admin handling

Owner backend: schema/migration, lib/athleteSports.ts, types/database(.generated).ts, athleteStats.ts,
adminControls.ts/stat tool and source replay/tests. Root: Admin/AthleteSportsTool child in SportsTool and docs.
- [x] Reproduce failures for multiple career rows, tagged logs, stale revision, duplicate/invalid primary and denied/private readers.
- [x] Add participation table, atomic get/set/list RPCs and compatibility primary field; preserve unknown legacy logs while changing career key.
- [x] Add optional recorded reels.sport with validated uploader/admin writes and expose through existing privacy-filtered feed.
- [x] Adapt admin stats calls to explicit sport; old signature cannot relabel/erase another sport. Update generated row/RPC types.
- [x] Build search/edit/correction/report child on /admin/sports; retain draft, single-flight and readback identity.
- [x] Run client/admin regressions and node scripts/replay/athlete-sports-replay.mjs <installed PGlite dist>; independent source/privacy/SUPPORT review.
- [x] Preserve timestamped admin-ready evidence; pnpm feature-admin:check --feature MULTISPORT-01 --require admin-ready.

## Task2: Athlete and public profile flows

Owner client: MySportsModal/useAthleteSports, EditProfileModal, own/public routes, AthleteProfileView,
Auth refresh integration if needed, UploadVideoModal/Composer and reel/clip tagging adapters/tests.
Consumes AthleteSportsSnapshot and confirmed revision-checked save from Task1.
- [x] Reproduce add/remove/primary/replacement/failed-save/Back behavior and stale account/sport requests.
- [x] Add Edit Profile→My sports, existing catalog/team search, atomic save and confirmed profile refresh.
- [x] Add temporary profile chip selection plus explicit credentials props; stable primary hero/field default and separate per-sport Stats.
- [x] Add optional explicit upload sport with retained draft; All includes legacy untagged clips, specific sport filters recorded tags only.
- [x] Use privacy-filtered secondary read in own/public routes, retain exact player ownership and guarded joint loads.
- [x] Run focused forms/routes/stats/reels/Upload and existing regression gates; verify rendered/error/large-font paths locally.

## Task3: Evidence and handoff

Root owns data-ownership/SCHEMA/privacy/sensors/docs, generated map/types integration and independent review.
- [x] Update STATE/history/tester/roadmap and index; regenerate data map/infrastructure/exit/security awareness.
- [x] Run pnpm detection:scan (actual pnpm check plus portal tests), keep unavailable hosted/device evidence explicit.
- [x] Record app-ready later than preserved admin-ready; selected gate, diff/doc checks and release source claims.
