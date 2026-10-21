# SCALE-03 — Live scores over per-game Broadcast

**Owner approval:** started 2026-10-18 (owner, via the coordinator). **Chain:** CTO → ENGINEERING → REALTIME, with
LOCAL for the Local scoreboard and BACKEND / RLS_SECURITY for the SQL. **Executor:** a Claude Code session acting as
REALTIME. Not committed. No hosted call was made.

**Problem (HOSTING_DECISION_BRIEF §7 item 5).** `useLiveScores` listened to `postgres_changes` on every `games` row
and reread the whole list on any change. On game night every fan rereads every game on every score.

## What was built (local)

| Part | File | State |
| --- | --- | --- |
| Merge and refetch decisions (pure + controller) | `apps/mobile/src/frontend/lib/liveScoreSync.ts` | Built, unit-tested |
| Shared private topics and the switch | `apps/mobile/src/frontend/lib/liveGames.ts` (`subscribeScoreTopic`, `isLiveScoresBroadcastEnabled`) | Built, unit-tested |
| Hook | `apps/mobile/src/frontend/hooks/useLiveScores.ts` (same return shape plus `liveMode`) | Built |
| Server side | `supabase/migrations/20261018120000_live_score_broadcast.sql`, copied onto `schema.sql` | **Written, not applied** |
| Replay | `scripts/replay/schema-replay.mjs` (9 new checks), `realtime.send` stub in `supabase-stubs.mjs` | Run locally on PGlite |

### Topic and payload

- `game_scores_{games.id}`, private, event `score`: `{ "v": 1, "id": "<uuid>", "seq": <live_seq>, "changes": { ... } }`.
  `changes` holds only the scoreboard columns that changed: `home_score`, `away_score`, `quarter`, `status`, `clock`,
  `is_clock_running`, `is_active`, `home_team`, `away_team`, `home_school`, `away_school`, `venue`, `sport`, and
  `updated_at` when it moved with them. `claimed_by` and any other column are never sent. The client drops unknown
  keys and wrong types too.
- `game_scores_index`, private, event `membership`: `{ "v": 1, "id": "<uuid>", "op": "insert" | "delete" | "active" }`.
  The list rereads only on these.
- `games.live_seq` is server-owned. The BEFORE trigger sets 0 on insert and adds 1 only when a scoreboard column
  changes, so one visible change is one number and a client cannot set it. A `claimed_by`-only update sends nothing.

### Client merge rules

Per game, compare `seq` with the last one seen: equal → duplicate, ignored; lower → stale, ignored; next → applied;
higher by more than one → applied (values are absolute) and a reread is scheduled. A change for a game the list does
not hold schedules a reread. `is_active: false` removes the game and leaves its topic; a later `is_active: true`
rereads. Changes that arrive while a reread is in flight are replayed over the snapshot by sequence. Rereads are
coalesced into one timer with jitter (250 ms plus up to 1–2 s) so a stadium does not reread at once.

### Switch and fallback

- `EXPO_PUBLIC_LIVE_SCORES_BROADCAST` must be exactly `true`; anything else (the default) runs the earlier path:
  `postgres_changes` on `games` → full reread, unchanged. Env-var pattern as `EXPO_PUBLIC_SUPPORT_SENSORS_ENABLED`;
  `app_runtime_config` was not used because the admin portal (another agent's area) reads its flag groups.
- Switch on, migration missing: the private `game_scores_index` join is refused by RLS (`CHANNEL_ERROR` before it ever
  joined), so the controller leaves every topic and starts the earlier path. A first-join network failure takes the
  same safe path.
- Reconnect: a topic that had joined, dropped and rejoined triggers one coalesced reread.
- At most 40 per-game topics (Supabase's default per-client channel limit is about 100); listed games past that are
  reread by a slow poll (60 s plus jitter) while any are uncovered.

## RLS_SECURITY review

Written review of the realtime policy and trigger in `20261018120000_live_score_broadcast.sql` (REALTIME author;
for RLS_SECURITY acceptance, not yet signed by a separate reviewer).

| Question | Finding |
| --- | --- |
| Who can receive? | Policy `Fans receive game score changes`: `for select to anon, authenticated`, `extension = 'broadcast'`, topic matches `^game_scores_(<uuid>|index)$`. Same audience as `games` itself (`Public read games` is `using (true)`), so nothing new is disclosed. The payload is narrower than the row (no `claimed_by`). |
| Who can send? | No INSERT policy is added for these topics. The only existing INSERT policy on `realtime.messages` (`Operators send game_events broadcast`) is limited to `game_events_%`. Replay: a guest and a signed-in fan inserting on `game_scores_<id>` / `game_scores_index` are refused by row-level security. Only the definer trigger writes them. |
| Presence | Excluded by the `extension = 'broadcast'` condition (replay check). |
| Topic shape | Exact anchored regex; a look-alike topic (`game_scores_<uuid>x`) returns nothing in the replay. The client builds topic names only from a plain id (`gameScoresTopic`). |
| Definer function | `games_broadcast_score_change` is `security definer`, `set search_path = ''`, fully qualified names, no caller input besides the row. EXECUTE revoked from `public`, `anon`, `authenticated` on both trigger functions (replay check). A send failure is caught and logged as a warning, so a score write never fails on Realtime. |
| Widening | No existing policy was changed or loosened. `realtime.messages` RLS is not altered (platform-owned). |
| Residual risks for hosted negative tests | (1) Confirm on the hosted project that a **public** (non-private) channel named `game_scores_<id>` is separate from the private topic, so a forged public broadcast cannot reach private subscribers; the client always joins with `private: true`. If "Allow public access" can be turned off for Realtime, consider doing so. (2) Confirm `realtime.send` runs under the trigger's owner on Supabase and the policy admits anon JWTs. (3) A score write now does one extra subtransaction plus one or two `realtime.messages` rows; Supabase prunes that table, but watch its size on game night. |

## Checks actually run (2026-10-18, this session)

Node v25.4.0 (Homebrew; `~/.local/node/bin` is absent in this shell). The tree is shared with concurrent sessions.

| Check | Result |
| --- | --- |
| New unit tests (`liveScoreSync.test.ts` 21, `liveScoreTopics.test.ts` 2) | 23/23 pass |
| Every Jest suite related to the changed files (`--findRelatedTests`: the two above, `portLibMoves`, `LiveMatchBanner`, `game-loading`, `highlights-jump`) | 6 suites / 43 tests pass |
| Full mobile Jest | 186/204 suites, 1,676/1,789 tests pass. The 18 failing suites (`Module "1" is missing from the asset registry` from vector-icon fonts, and `reading 'coachLevel'`) do not import any SCALE-03 file (no overlap with the related-test list); they come from concurrent work in the shared tree |
| Mobile `tsc --noEmit` | Fails only on `src/frontend/data/__tests__/highlights.test.ts` lines 43–44, present before SCALE-03 began. No error in SCALE-03 files, including with `--noUnusedLocals --noUnusedParameters` |
| `pnpm check` | Exit 2 at that pre-existing typecheck error. Every later step run on its own: docs:check, docs:links (248), copy, life bank, data boundaries, comments, feature-admin test/check, data:map (562 functions), recovery, detection test/check, agents (107), client keys, no-ssn, infra register (24 env vars) all pass; `code:unused` cannot run until the typecheck passes. Admin portal `tsc` passes |
| `schema-replay.mjs` (PGlite 0.5.9, hash-pinned like CI) | 119/120. All 9 SCALE-03 checks pass. The one failure, "reactions from before approval count in the week the tag was approved", also fails on the unmodified HEAD schema and script (110/111) late on 2026-10-18; it passed earlier the same day, so it looks week-boundary dependent and is not SCALE-03 |
| `gen-db-types.mjs --check` | Already out of date before SCALE-03 (other unapplied files); not regenerated here. `Game` stays hand-typed; `live_seq` is read through `LiveGameRow` so the drift test is unaffected |

## Not verified

- The migration on any Supabase project (development, staging): not applied, by rule.
- A real private-channel join, `realtime.send` delivery, and the refused-join fallback against hosted Realtime.
- The game-night load test (needs hosted access and a load tool); no fan-count or latency claim is made.
- Devices and the web build with the switch on.
