<!-- Approved manual sport identity design; local implementation and hosted activation remain separate. -->
# Multiple sports and manually chosen primary sport

Owner approved implementation on 2026-10-21 after choosing manual primary and compact labeled menus.

## Product contract

One account/player identity has up to 16 sport entries. Exactly one selected entry is primary.
Adding a sport preserves primary; removing primary requires choosing a remaining replacement before Save.
Primary remains the existing profiles.athlete_sport default for viewer field artwork; profile chip selection
is temporary display state and never persists a primary change. Brand/Aura colors keep their existing meaning.
Each entry has sport, school/team directory id, position and jersey; class year and physicals stay shared.
First onboarding remains supported and existing single-sport profiles fall back without inventing secondary sports.

Sport-specific career rows and tagged game logs prevent relabeling another sport's numbers. Career writes remain
admin-only. New nullable reels.sport is a recorded Highlight tag; untagged history stays in All and is never
inferred from a mutable primary. Upload can explicitly select a sport; optional sport preserves draft/rights flow.
All sport chips show all public Highlight categories eligible for that sport; Vault rules remain unchanged.

## Source and interfaces

New profile sport participation records are owned by PROFILE/ROSTERS. Existing school directory and active
sport catalog remain authoritative choices. Write forms read stored choices through useStoredSportChoices; starter playbooks do not authorize additions or media tags. Ready-empty catalogs preserve existing participation corrections; unavailable catalogs keep drafts and block sport saves. Explicit unassigned media remains usable without catalog availability. A trusted managed opt-in marker allows legacy onboarding updates to advance revision before first opt-in;
after opt-in, direct primary/credential mutation is rejected. Atomic revision-checked writes return a confirmed snapshot; draft
values stay on failure. Owner/account generation and request identity prevent stale refreshes across accounts.

Client lib/athleteSports.ts exposes AthleteSportEntry {sport,schoolId,teamName,position,jersey},
AthleteSportsSnapshot {profileId,primarySport,revision,sports}, fetchAthleteSports(profileId?),
saveAthleteSports(profileId,primarySport,sports,expectedRevision), and bounded fetchAdminAthleteSports(query).
JSON RPC snapshot shape: {profile_id,primary_sport,revision,sports:[{sport,school_id,team_name,position,jersey}]}.
Admin list rows add full_name, player_id and username. Save returns the same confirmed snapshot.
RPC names: get_athlete_sports, set_athlete_sports, admin_list_athlete_sports (arguments fixed with backend owner).

Admin corrections live inside existing Expo /admin/sports; career/log administration stays in its existing
AdminDataStats surface. No new portal writes or duplicate dashboard. Staff can replace/correct a primary/list
and sport-tagged stats/Highlights; removing a sport participation does not delete recorded stats or media.

## Access, failure and repair

Only self athlete or a database-guarded admin can mutate participation; this does not grant roster verification.
Guardians retain existing read/privacy rights; no additional guardian write permission is introduced.
Public readers go through existing viewer/account/block/minor privacy rules. Team metadata obeys school
visibility; stats/jersey/position obey corresponding stats/school rules. Blocked/unrelated private readers
receive no leaked secondary records. Base participation table has no blanket public SELECT/write grants.

A missing migration returns an explicit unavailable edit state and legacy display; it never silently discards
secondary requested values. Validation bounds and unique canonical sport names are enforced server-side.
Revision conflict retains draft and requests reload; safe fixed telemetry codes contain no student/team payloads.
Support routes correction to /admin/sports, using existing Health issues and bounded tests; hosted signals stay unknown.
No SQL application, provider configuration or release is authorized by local implementation.

## Verification and experiment

Baseline: singular profile sport, one career row/player, untagged game logs/reels and single-sport onboarding.
Alternative automatic seasonal primary was rejected by owner; manually selected primary keeps artwork predictable.
Success: two sports retain independent credentials/stats, chip switches never change primary, denied/private actors
cannot see/write forbidden rows, old profiles read safely, drafts survive failure and Back, and old untagged logs remain unknown until explicitly classified.
Stop/repair: show source unavailability, keep old profile display and retain draft; staff correct selected sport source.
Run focused client/admin/async/privacy tests and actual full-canonical PGlite SQL replay before admin-ready, then fan
regressions/browser and pnpm detection:scan/pnpm check. Hosted application/denial and physical device remain separate.


Admin repair is part of this implementation: existing Highlights editor exposes recorded sport read/compare/save
(including explicit Unassigned), and the existing Stats panel exposes bounded unknown original logs and
old-sport compare/save classification/correction. Staff review the original record; no remove/recreate or
primary-based inference is used. Save invalidates prior admin searches, and complete normalized readback
must match submitted identity/primary/list/credentials before acknowledging. Explicit reads validate target id.
