# FEED-01 Phase 1 Signed-In Device Smoke Test Results

**Date:** 2026-11-14 14:37 MST (Saturday, November 14, 2026, America/Denver)  
**Commit:** `076bf0a40fb8eee40c3f5d86b029b0e043b5a2bd` (tracks `main`)  
**Branch:** `cursor/feed-01-device-smoke-9a86`  
**URL:** http://127.0.0.1:8081/ (Expo web)  
**Device:** Chromium via Playwright MCP (Linux cloud agent)  
**Account:** Demo Fan (`demo@tapuai.app`) · user_id `4ee7be1a-29f6-4cc4-8054-43703b1be68d`  
**Tester:** DEVICE_QA (autonomous agent)  
**Spend:** $0 (Wave 0 local web smoke). Expo free quota and free Supabase pause are the only ways this stops being free.

---

## Test Results Summary

| Test | Description | Result | Notes |
|------|-------------|--------|-------|
| **A** | Sign in & configure Highlights picks | **PASS** | Sports Lacrosse / Football / Basketball + school ALA Hawks saved; Home why-line **Your school** |
| **B** | Selections persist after reload | **PASS** | After full navigation reload, why-line remained; Edit picks still **Sports · 3 of 3 · Lacrosse, Football, Basketball** |
| **C** | Toggle Personal feed OFF | **PASS** | Switch unchecked; `user_feed_prefs` upsert 200; Home why-line gone (newest-first, no ranking label) |
| **D** | Report-Hide a Highlight | **PASS** | Reason Other → Report and hide; Home **0 clips**; leave/return + reload still hidden; `tapuai.hiddenReels` = `["357605a8-de27-4e8b-ab30-b20ab151246c"]` |

**Overall Status:** PASS — Wave 0 signed-in smoke A–D complete on Expo web.

Earlier ComputerUse attempt on this branch was **BLOCKED** by Xfce dock overlap on bottom Fan Dock. This run used Playwright (accessibility clicks), which bypasses the OS dock hit-target problem.

---

## Detailed Test Execution

### Pre-Test Setup

1. Expo web already running (`expo-web-feed01` tmux → `:8081`).
2. Signed in as **Demo Fan** via Soft Wall → Demo Fan (session refresh_token 200).
3. Dismissed Sport Quiz / overlays as needed.
4. `user_feed_prefs` hosted table already applied (GET/POST 200 for this user).
5. `EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS` not enabled (Phase 2 stays OFF).

### Test A: Configure Highlights picks → Home why-line

**Status:** PASS

1. Profile → Open account settings → **Highlights** → **Edit Highlights picks**.
2. Selected **Football** and **Basketball** (kept Lacrosse + school **ALA Hawks**). Header: `Sports · 3 of 3 · Lacrosse, Football, Basketball`.
3. **Save Highlights picks** → POST `user_feed_prefs?on_conflict=user_id` → **200**.
4. Done → Home: Jordan Blake clip shows `Why this clip: Your school`.

**Evidence:** `feed-01-signed-in-smoke/feed-01-smoke-a-picks.png`, `feed-01-smoke-a-why-line.png`

### Test B: Persist after reload

**Status:** PASS

1. Navigated to `/` (full page load).
2. Why-line **Your school** still present on Jordan Blake.
3. Profile → Settings → Highlights → Edit picks still shows **Lacrosse, Football, Basketball** + ALA Hawks.

**Evidence:** `feed-01-smoke-b-after-reload.png`, `feed-01-smoke-b-picks-persist.png`

### Test C: Personal feed OFF → newest-first (no why-line)

**Status:** PASS

1. Settings → Highlights → toggled **Personal feed** off (switch no longer checked).
2. Upsert `user_feed_prefs` → **200**.
3. Home: no `Why this clip` / `Your school` text. Clip still visible (only one seeded row).

**Evidence:** `feed-01-smoke-c-personal-off.png`, `feed-01-smoke-c-home-no-why.png`

**Note:** Demo Fan **Personal feed left OFF** after this test so the receipt matches the account. Flip it back on in Settings → Highlights if needed for other demos.

### Test D: Report / Hide

**Status:** PASS

1. Home → More options → Report / Hide → reason **Other** (not coach-level) → **Report and hide**.
2. Home counter went to **Home, 0 clips**; Jordan Blake gone.
3. Activity → Home: still 0 clips / no Jordan Blake.
4. Full reload: still **Home, 0 clips**; `localStorage tapuai.hiddenReels` = `["357605a8-de27-4e8b-ab30-b20ab151246c"]`.

**Evidence:** `feed-01-smoke-d-hidden.png`, `feed-01-smoke-d-after-reload.png`

---

## Environment notes

- Console noise unrelated to A–D: `reels_feed` 400 on some select shapes, `get_reel_account_tags` / `quiz_snapshot` 404 (known staging gaps). Feed still ranked from available seed + prefs.
- FEED-01 console sample logs present (`[FEED-01 Phase 0]` sampleSize 1 after hide/filter).
- Native iOS/Android not run in this session — web signed-in pass only.
- Guests chronological / no picks screen not re-run here (covered in earlier Phase 1 local notes).

---

## Conclusion

Signed-in Wave 0 smoke **A–D passed** on Expo web with Demo Fan against hosted `user_feed_prefs`. Remaining FEED-01 owner items: counsel Privacy send (`FEED-01-counsel-send.md`); Phase 2 flag stays OFF.
