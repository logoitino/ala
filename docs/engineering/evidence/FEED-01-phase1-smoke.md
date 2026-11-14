# FEED-01 Phase 1 — local Highlights smoke

**Date:** 2026-11-14  
**Branch:** `cursor/highlights-interest-feed-9a86`  
**Starting commit:** `c0d4f02` (Refresh IP counsel packet inventory hash for source-release verify.)  
**Runner:** DEVICE_QA session on this checkout. Node `v22.23.4` (repo local setup asks for Node 24; this machine only had 22).  
**Spend:** $0. Wave 0 local Jest only. Apple Developer $99/yr is already enrolled. Supabase, Expo, and Stripe test mode stay free. No preview build, no hosted SQL, no live keys.

This note records what ran. It does not apply `user_feed_prefs`, merge a pull request, or add a privacy or legal conclusion. Counsel items already listed in [FEED-01-phase0.md](FEED-01-phase0.md) stay open.

## What ran

Metro / Expo web was **not** started.

- `apps/mobile/.env.local` is present (`EXPO_PUBLIC_APP_ENV`, Supabase URL and anon key, Stripe publishable key). Values were not printed.
- The leftover tmux session `expo-web-apptest-c` (12 Nov 2026) had already aborted: `FATAL ERROR: Ineffective mark-compacts near heap limit`. It was not serving a page.
- `free` showed about 2.6 Gi available. A new web bundle was not started, so this session would not repeat that heap abort.

Command (from `apps/mobile`, 2026-11-14):

```bash
pnpm exec jest --watchman=false --forceExit \
  src/frontend/data/__tests__/highlights.feedRanking.test.ts \
  src/frontend/lib/__tests__/feedPrefs.collectors.test.ts \
  src/frontend/lib/__tests__/hiddenReels.hide.test.ts \
  src/frontend/components/Reels/__tests__/FeedPicksSheet.test.tsx
```

**Result:** 4 suites, 17 tests, all passed. Time about 6.5 s. Jest then force-exited (open handles). No browser, no simulator, no physical device.

| Suite | Role in this smoke |
| --- | --- |
| `highlights.feedRanking.test.ts` | Existing ranking tests, including personalization off → newest-first. |
| `feedPrefs.collectors.test.ts` | Existing Phase 2 collector gate. Flag off writes no view/save/hide history. |
| `hiddenReels.hide.test.ts` | New. `hideReelLocally` writes `tapuai.hiddenReels`; `reelHiddenForUser` drops that id. Named `hide` so the exit scanner does not treat `.local.` as a secret path. |
| `FeedPicksSheet.test.tsx` | New. Sheet and Settings → Highlights render when `visible` is set. Not a signed-in session. |

## Pass / fail

### 1. Signed-in user opens Highlights feed picks

**Not passed** as a signed-in journey.

Component render **passed**:

- `FeedPicksSheet` with `visible` shows “Shape your Highlights”, sport and school chips, “Save Highlights picks”, and “Not now”.
- `visible={false}` renders nothing.
- `HighlightsFeedSettingsSheet` shows “Personal feed” and “Edit sports, schools & lean”. Pressing that label opens “Edit Highlights picks” without “Not now”.

Not exercised: sign-in, Home first-run, Profile menu, or a save to `user_feed_prefs`.

### 2. Personalization off falls back to newest-first

**Passed** in existing Jest `personalization off returns newest-first`.

The case ranks an older Football/Crew clip and a newer Soccer clip with `personalizationOn: false` and expects `['new', 'old']`. The Settings switch was not toggled on a live Home feed.

### 3. Hide keeps the clip out (local AsyncStorage)

**Passed** for the local storage contract. **Not passed** as a tapped report on a running feed or after relaunch.

`hiddenReels.hide.test.ts` checks:

- `hideReelLocally('hl-seed-1')` stores that id under `tapuai.hiddenReels`.
- `readHiddenReelIds()` returns it.
- `reelHiddenForUser` is true for that id and false for another id.
- A second hide does not duplicate the id.
- A blank id writes nothing.

Home (`app/(tabs)/index.tsx`) loads `readHiddenReelIds()` and drops matches with `reelHiddenForUser`. `ReelCard` `confirmReport` calls `hideReelLocally` before `onHide`, except `coach_level`. That button path was not clicked in this run. Phase 2 athlete demotion (`rememberFeedHideAthlete`) stays off while `EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS` is off; the existing collector test still expects an empty store in that state.

## Gaps for DEVICE_QA on a real build

1. Sign in on a dev build (email until Google is enabled). Open Home while signed in. With `user_feed_prefs` applied and empty picks, the first-run `FeedPicksSheet` should appear once. Without that migration, `fetchFeedPrefs` reports the table missing and `promptOpen` stays false, so first-run will not show. Settings → Highlights (Profile menu, signed-in only) should still open, and Save should show the “not available on this database yet” line until the owner applies the migration.
2. Turn **Personal feed** off, return to Home, and confirm order is newest-first on a feed that is not five seeded clips. Seeded `HIGHLIGHT_CLIPS` is still 5 rows (Phase 0).
3. Hide a clip from the report control (not the coach-level reason). Leave Home and come back, then kill and relaunch. The same clip stays out of Home and of `ReelViewModal`. Confirm `tapuai.hiddenReels` on that device. Do not treat Phase 2 athlete demotion as on.
4. iOS and Android, VoiceOver / TalkBack, and Dynamic Type are unrun. A desktop browser, if Metro is started later, is still not a device pass.
5. Do not apply hosted SQL or merge from this smoke.
