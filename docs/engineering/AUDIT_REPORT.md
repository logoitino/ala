# Tapua'i interaction audit

**Role:** Lead QA & Mobile Systems  
**Dates:** 2026-09-12 (fan hub haptics) · **2026-09-14 (pnpm monorepo audit)**  
**Verdict:** Fan hub UI remains **ready** for Expo Go smoke. Monorepo layout is **shipped locally** (`apps/mobile`, `apps/admin-portal` stub, `packages/shared-types`). No missing product `onPress` handlers. Every real tap fires `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` unless noted.

**Method (2026-09-14):** Static pass over `apps/mobile/app/` + `apps/mobile/src/frontend/`; `pnpm typecheck` (mobile + admin); `pnpm docs:check`; shared-types import smoke; `sk_test_` / `sk_live_` grep under `apps/mobile/src/frontend/` (clean); stale path sweep of docs / troubleshooting / CI. Not re-run on a physical device here.

> **Sections 1-7 below are the 2026-09-14 snapshot and have not been re-run in full.** They predate Vault playback, ShareQR, Varsity, the avatar picker, the current auth sheet, the 2026-09-25 compliance copy, the motion pass, and the Mālo ledger. Treat them as history. The sections immediately below are current.

---

## Photo-story pager, browser fixture (VISUAL_QA) — 2026-10-09

**Scope:** the feed counter and dots in `PhotoStoryMedia`, not the upload steps and not a live development feed. The photo SQL is still unapplied, so this pass bundled the real component with five fixture photos and did not call Supabase.

**Method.** `.smoke/photo-story/` (git-ignored) bundled `PhotoStoryMedia` with the app Metro config. `fetchStoryPhotos` was replaced with five local photos. Chrome via `playwright-core` opened `http://127.0.0.1:8766` at 320×568 and 375×568, DPR 2, then again at 320 with CSS font size and line height doubled. The run clicked the real Next control and waited for the counter to change.

| Check | Result |
| --- | --- |
| Counter | **Pass.** `1 / 5` on load. After Next, `2 / 5`. Previous is absent on the first photo. |
| Dots | **Pass.** Five dots. The chip's right edge was 308 at a 320-wide viewport and 363 at 375, inside the screen. At 200% text the chip grew to 74×58 and stayed inside 320. |
| Photo bitmap | **Not shown.** The field behind the chip stayed black, and each page logged one `NetworkError`. The counter and paging still ran. This is not evidence that a real JPEG paints. |

**Still open.** Upload steps, reorder, progress, tagline placements, a live feed, and device paging. A live feed needs the photo SQL, which needs the owner.

---

## Owner peek card redesign, browser evidence (VISUAL_QA) — 2026-10-08

**Scope:** the uncommitted redesign of the swipe-sideways owner card: `ReelOwnerPeek.tsx` (tier-washed header, "On this
clip" row, optional "Posted by", fixed 2 x 2 stats, Join Crew / Donate halves, Open full profile) and the light panel
shell in `ReelPage.tsx` (`styles.panel`, near-opaque Island Daylight card), plus the `AnimatedPressable` `style` /
`contentStyle` split the buttons depend on. **No app code was changed by this pass.**

**Method.** The real `ReelPage` + `ReelOwnerPeek` were bundled for web with the project's own Metro config into a
throwaway page and driven in Google Chrome with `playwright-core` (the MCP browser tools were not exposed to this
agent, so the same Playwright engine was scripted directly). The card was opened by a real mouse swipe left across the
clip (the actual pan gesture), then measured from the DOM and screenshotted at DPR 2. Inputs are synthetic: a bright
sky/white SVG stands in for a photo behind the card (plus a plain dark background for comparison), and the five
Supabase reads (`profiles` verification, `profiles_public` by player and by poster, `get_crew_graph`) are answered by
Playwright from a fake host, with every other non-local request aborted (`blocked: []`; nothing reached a real
backend, no real keys in the bundle, no payments). Fixture stand-ins (not production code paths): `expo-haptics`,
`AuthContext` (signed-out guest) and `SoftWallContext` (no-op `requireAuth`) are stubbed because their native
imports do not bundle in this ad hoc web build. Page height = viewport minus a ~64 pt tab bar and the home-indicator
inset; peek insets are the feed's own (top 108 / bottom 24, and 120 / 58 at 430). A real feed with a taller header
(live banner, polls, Rivalry week) would have a shorter panel than measured here.

**Cases (all open state):** a video with a tag; b video with no tag; c photo story (`mediaType` photo, 5 photos);
d video with a fan "Posted by" (avatar + `@username`); e unconfirmed athlete (`tagStatus: pending`, "Tag" button);
f stress (long name / handle / position / school / tag / poster, 10-photo story, seven-digit stats, 987,654,321 cents).
**Widths/heights:** 320 x 568, 375 x 667, 430 x 932; at 320 also a CSS 200% text stress (font size and line height of
every text node doubled; not native Dynamic Type). Backgrounds: bright for all, dark additionally for a and c.
Each state that scrolls also has a `-scrolled` capture.

| Check | Result |
| --- | --- |
| 2 x 2 stat grid holds | **Pass.** Two columns and two rows of equal-width tiles in every one of the 30 open-state captures, including 320 / 200% and the long-value case f. Tile widths 116 / 134 / 158 at 320 / 375 / 430. |
| Donate (or Tag) and Join Crew are equal halves | **Pass.** Outer and visible box coincide (the `AnimatedPressable` style/contentStyle fix works): 116 + 116, 134 + 134, 158 + 158, 8 gap, equal heights (48; 68 at 200%). Same for the pending "Tag" state. |
| Content fits the panel without scrolling | **Fails at 320 and 375, passes at 430 (a, b, c, e; d and f only fit at 430).** Panel client height is 370 at 320 and 469 at 375, 654 at 430. Content height / overflow: a 575 / 205 and 573 / 104 at 320 / 375; b 172 and 71; c 185 and 84; d 259 and 160; e 173 and 74; f 263 and 180. At 430 overflow is 0 for every case. At 320 / 200% overflow is 405 to 567. Every state remains reachable by scrolling; nothing is unreachable. |
| Primary action visible without scrolling | **Fails at 320 for every case and at 375 for a, c, d, f.** At 320 the Donate row ends 101 to 195 pt below the panel edge. At 375 a and c are cut mid-button (30 and 10 pt past the edge) and d, f are wholly below; only b and e fit. "Open full profile" is below the fold at 375 in every case and visible only at 430. |
| Text clipped | **Fails at 320 (any text size) and at 200%:** the VERIFIED VARSITY badge runs past the panel's right edge (see issue 1). At 200% (320): "Donate" ellipsises to "Don…", the Donations tile reads "$12…" and "DONATI…", the tier pill wraps to two lines and the badge is cut to "VERIFIE". Intentional ellipses (two-line meta, one-line handle, two-line tag, poster name wraps) behave as designed in f. A seven-digit Donations total ("$9876543.21") ellipsises in its tile at 375 on web; on native `adjustsFontSizeToFit` would shrink it (not run here). |
| Photo story reads the same as video | **Pass.** c shows the images icon and "Photo story · 5 photos" under the quoted tag; with no tag (not rendered separately) the kind line is the title. |
| No-tag clip | **Pass.** b shows just "Video highlight" in the clip row; no empty quotes, row shortens, no layout break. |
| "Posted by" | **Pass.** d at 375: avatar + "Posted by @coach_sina" row in the slate wash; no-handle fallback to the name wraps to two lines at 320 (f) without overflow. Costs ~56 pt of height, which is what pushes d past the fold at 375. |
| Pending athlete ("Tag") | **Pass.** e: Tag button is gold-washed with a gold border, same size as Donate; "Open full profile" takes the filled primary style. Header lacks the badge as designed (mock sets pending). |
| Light card over a bright photo | **Pass.** The 0.58 dim layer turns a pure white/sky photo to mid-grey, and the 98% card with its 1 pt border reads clearly at all three widths (a, c dark and bright compared). Cosmetic: because the card is 98% rather than 100% opaque, the clip's edge shows through as a faint vertical seam (x about 455 at 320 / bright) in the lower body area. |
| Header | **Pass at 375 / 430**, with the avatar ring, tier pill, handle and meta all fitting. 44 pt close target confirmed (44 x 44 around a 34 pt disc). At 320 the close button scrolls out of view with the header; dismissing then relies on tapping outside the card. |
| Console | One page error per load: `findNodeHandle is not supported on web` (all 30 loads). Source not isolated; it did not block rendering or the gesture. It may be a web-only reanimated/gesture artifact; native is unaffected by this message. |

**Issues (report only, nothing fixed here).**
1. **Verified badge overflows the card at 320 (Medium).** `VarsityBadge.tsx:60-63` renders the label with no
   `numberOfLines` / shrink, and `ReelOwnerPeek.tsx:251-256` (`nameRow`, `flexWrap: 'wrap'`) cannot narrow it below its
   intrinsic ~190 pt while the identity column is 141 pt wide. Suggest `flexShrink: 1` + `numberOfLines={1}` on the
   compact label, or an icon-only compact badge below 360 pt wide, or put the badge on its own row.
2. **Primary actions sit below the fold on 320 and 375 phones (Medium).** `ReelOwnerPeek.tsx:271` (`body`) and
   `ReelPage.tsx:290` insets (108 top / 24 bottom, panel 370 pt tall at 320). The design wants Donate readable at a
   glance. Options: at `compact` pin the Join Crew / Donate row (and Open full profile) outside the `ScrollView` so
   they never scroll away; or shrink the compact header (avatar ring 84 pt, orb, 12/18 padding) so the first screen
   reaches the buttons; or drop `peekInsetTop` on short heights. Scrolling is also the only way to reach the lower stat
   row in d and f at 375.
3. **Large text truncates the primary action and stats (Medium, CSS stress).** `ReelOwnerPeek.tsx:373` (`Donate`
   `numberOfLines={1}`), `:316-321` (stat value / label). At 200% on 320 these show "Don…", "$12…", "DONATI…". Let the
   Donate / Join Crew labels use `numberOfLines={2}` with a larger `minHeight` (the row already stretches both halves),
   and add `adjustsFontSizeToFit` to the stat label or lower `letterSpacing` / allow two lines for the label.
4. **Close button scrolls off with the header (Low).** `ReelOwnerPeek.tsx:226-237`. Consider a sticky close or rely on
   the dim-area tap documented in `ReelPage.tsx:279`.
5. **Dead space at tall heights (Cosmetic).** At 430 x 932 the `justifyContent: 'center'` body (`:429`) leaves about 65 pt
   above and 100 pt below the content. Top-align or give the clip row more weight if that reads as empty.
6. **Seam from the 98% panel (Cosmetic).** `ReelPage.tsx:358` uses `rgba(243,251,247,0.98)`; use `1` or accept it.

**What this does not prove.** Web rendering at CSS pixels, not native iOS / Android layout. The 200% run is a CSS
stress, not Dynamic Type or Android font scale (RN `fontScale`, `adjustsFontSizeToFit` and `numberOfLines` behave
differently on native). Not exercised: real swipe on a device (nested vertical paging, spring settle, haptics), the
panel enter / `FadeInUp` animations (only the settled frame is captured), VoiceOver / TalkBack order and the modal
trap (`accessibilityViewIsModal`, `aria-hidden` while closed), real photos / video behind the card, a configured
backend (verification, handle, poster, crew counts are canned), the live feed header height, Stripe / donate sheet
opened from the card, and the Follow / Join Crew state ("In Crew"). `DEVICE_QA` still owns native sign-off; `ACCESSIBILITY`
owns the screen-reader criteria.

**Evidence.** Screenshots: `.playwright-mcp/peek/peek-<case>-<width>-<bright|dark>[-text200][-scrolled].png` (case a to f;
widths 320, 375, 430; 53 files including `metrics.json` with panel, scroll, tile and button rects, clipping and
console output). The folder is git-ignored; nothing committed. Throwaway harness and rebuild/run scripts:
`.smoke/peek-ui/` (git-ignored; build with `EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL=https://fixture-supabase.invalid
EXPO_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key node .smoke/peek-ui/build.cjs`, serve with `python3 .smoke/peek-ui/server.py`
from the repo root, then `node .smoke/peek-ui/run.mjs`, which expects `playwright-core` from the local npx cache).
The static server (port 8767) and browsers were stopped; no Metro / Expo dev server was started.

---

## UX-04 sport profiles and navigation — 2026-10-07

Owner screenshot shows a tall centered hero, repeated full-width actions and no direct wishlist
access. Read-through confirmed separate hero/profile sport selection, Football guessing and live
missing stats filled with generated demo values. New contract shares explicit sport/playbook
between hero, Stats and Aura, with real missing values unreported and stale navigation guarded.

Regressions were observed failing before fixes: sport data/fetch17 failures; hook/UI7; identity
navigation/shared-position6; Goals/Manage/mismatched profile3; hidden school1; public route3.
Compact hero identity tests run in both modes. Final automated gate: **60 suites / 311 tests**, both app typechecks and all `pnpm check` guards pass.
Fresh Expo web export passes (52 static / 3 API bundles, dotenv disabled, one worker),
output `/tmp/ala-sports-profile-final-web`. Browser 320 normal/CSS200% checks retain width; final 390 capture shows compact identity,
44-point Donate/Subscribe/Share and wrapping section navigation. Direct Stats shows volleyball
Matches/Kills/Digs/MVP and Height/Vertical Jump, no football labels. Goals opens wishlist ahead of
Rally; Team tap logs `demo-teammate`; Aura flips to Stats and contains Volleyball/Matches Played/Kills/Digs/Aura points with missing values as dashes. Settled Aura screenshot confirms the animated fields are visible. Scratch Goals capture has
wishlist loading (fixture lacks native navigation focus), so item content/payment is not verified.
Final scratch server serves the real Ionicons font; final screenshots verify those glyphs. Evidence: `/tmp/ala-sports-profile-final` (screenshots/callback JSON); normal/CSS200% narrow captures in `/tmp/ala-sports-ux03/profile-new*`. Viewport emulation restored. No PostgreSQL replay or hosted migration application was performed.
`20261007211500_public_profile_sport.sql` is prepared; view column order/bio/social cases match the
existing SELECT with only nullable athlete sport appended. Existing base-table privacy risk remains.

Figma editable public/owner/Aura references and Canva direction are linked in ARCHITECTURE.
Public Figma rendering inspected; final owner/Aura render blocked by View-seat tool limit. Canva
is visual direction, not an exact navigation specification. Browser evidence imports real Profile
components with synthetic inputs, disabled backend and callback logs, using 320/390 normal text
and CSS200% stress. Scratch server icon-font404 means glyphs are not verified by these captures.
Native readers/text scaling, avatar, Aura motion, payments and device navigation remain pending.

---

## UX-03 browser verification — 2026-10-07

**Scope:** sports identity across Local cards, Profile hero and Highlight overlays. Browser Bridge
connected to the owner's Chrome and the existing local Expo server (`localhost:8081`). Controlled
fixtures import the real components; backend writes/payments are replaced by local callback logs.
This is web rendering evidence, not native or hosted acceptance. Browser runs use normal text and
an explicit CSS 200% stress test (font size and line height doubled on rendered text nodes).
The scratch server returns 404 for the Ionicons font request; these captures do not verify icon glyphs.

| Check | Evidence / result |
| --- | --- |
| Initial project gate | `pnpm check`: both typechecks, 53 suites / 256 tests, all guards passed before edits. |
| Identity regressions | New tests failed before fixes: same-name public athlete received viewer sport/class; community hero retained favorite-athlete school proof; Local accessible name omitted distinct schools; close control lacked button role. Exact player link / badge gating / spoken school identity / 44-point close target now pass. |
| Local browser | Existing Expo Local checked at 320 pixels; controlled live/scheduled/final/missing/zero/volleyball rows captured at 320×568 and 390×844, normal and CSS 200%. Found a three-digit enlarged score compressing the name to single letters; `flexWrap` and a minimum identity width fix it. Final 320×568 normal/200% recheck retains document width 320; scores wrap while long names remain readable across lines. |
| Profile browser | Controlled long name/position, jersey zero, confirmed athlete, community and missing metadata rendered at both viewports/text settings with no document horizontal overflow. Identity wraps vertically; photo/crest/editor and actual native typography require devices. |
| Highlights browser | Controlled long athlete/school/position/caption, three account names, filmer and all rail actions. Original 320/200% rendered copy overlapped the scoreboard and enlarged badge overflowed. Fix reserves measured feed header space, bounds copy/rail scrolling and caps scoreboard width. Corrected 320 normal/200% capture has document width 320 and identity top at/below header bottom; rail can scroll to lower controls. |
| Effects/geometry review | QA found and corrected native Yoga width risk in a flex-zero scroll column and Aura clipping; horizontal wrapper allocates width, burst sits outside the scroll viewport. Nested native paging/owner-peek interaction remains unrun. |
| Browser interactions | Local card logs `fixture-game`; Profile flip logs `flip`. At 320/200%, scrolling exposes Highlight profile, Seki, Aura, Flex, filmer, Donate and More; each logs its callback. Dismissal removes the scoreboard close control from the DOM. These are controlled UI callbacks; native navigation, effects and payments still require device verification. |
| Updated automated gate | `pnpm check`: both typechecks, **55 suites / 261 tests**, all docs/links/copy/boundary/comments/agents/client-key guards passed after behavior fixes. Final same-turn gate recorded in STATE. |
| Updated web bundle | Expo web export exits 0 with **52 static routes / 3 API bundles**, dotenv disabled, one worker; output `/tmp/ala-sports-ux03-web`. Confirms bundling; Expo's force-exit message and missing disabled-environment client keys do not establish hosted acceptance. |

**Evidence location:** `/tmp/ala-sports-ux03` has viewport/text screenshots and geometry JSON;
`.smoke/sports-ui` keeps the ignored fixture source/scripts. These scratch files are local and
are not committed evidence. Historical press stills remain stale. No auth/session tokens are
included in evidence. Browser viewport emulation is reset after the run.

**Native checks still required (DEVICE_QA/QA):** Android + registered iPad narrow/large-text,
VoiceOver/TalkBack focus/disabled states, video playback/paging and horizontal owner peek with
nested scroll columns, scoreboard dismissal, camera/avatar editing, haptics and test PaymentSheet.
No SQL/configuration/build publication, real payment or hosted changes were made.

---

## Round 2026-09-25 / 2026-09-28 — button & dead-code pass

**Method (2026-09-25, static):** every pressable-family element in `apps/mobile/app/` + `apps/mobile/src/frontend/` checked for a handler; async press handlers checked for a re-entry guard; every `router` target and `ADMIN_NAV_GROUPS` href resolved against a real route; whole-repo import sweep for unreferenced components.
**Verified and fixed 2026-09-28** with `tsc --noEmit` (mobile + admin) clean, `docs:check` ok, and Jest 45/45.

Clean on the mechanical sweeps: 361 pressable-family elements all have a handler; no unguarded async press handlers; all `router` targets and `ADMIN_NAV_GROUPS` hrefs resolve.

| # | Defect | Severity | Status |
| --- | --- | --- | --- |
| 1 | `app/(tabs)/index.tsx` — Highlights search → tap a clip did nothing when the **All** pill was already active. `jumpToClip` wrote a `pendingClipId` *ref* then called `setFeedFilter('all')`; the resolving effect keyed off `[feed, pageHeight]`, so an unchanged filter left `feed` identical and the effect never re-ran. | Medium | **Fixed** — the pending jump is state, not a ref, and is in the effect's deps. Tapping a feed pill clears a pending jump. |
| 2 | `app/(tabs)/index.tsx` — Spotlight **Watch Full Highlight** silently no-opped from the Highlights tab when the award's clip fell outside the active filter (`jumpToSpotlightClip` ended `if (index < 0) return;`). The Spotlight tab's own `onWatch` already had a fallback chain. | Medium | **Fixed** — falls back to widening the filter to All (via the same pending-jump path), then to the athlete's profile. |
| 3 | `components/Auth/SoftWallModal.tsx` — `canPassword` required the 13+ checkbox, so it gated **Sign in** as well as Create account, retroactively blocking returning email accounts. Contradicted the deliberate design elsewhere: Apple/Google/Demo skip it, new OAuth accounts get `AgeConfirmModal`, and `signInWithEmailPassword` takes the flag as optional. | High (compliance-adjacent) | **Fixed** — the rule moved to `softWallEmailGates` in `lib/auth.ts` and is unit-tested. Sign in is ungated; Create account and magic link keep the gate, because `signUpWithEmailPassword` and `signInWithOtp` can both mint a new row. |
| 4 | Seven components never imported anywhere: `ScoreboardBanner`, `GameEventCard`, `ScoreHeader`, `ReactionButtons`, `HighlightClipCard` (an unused alias re-export of `Reels/ReelCard`), `ScorerHeaderButton`, `Profile/AuraCard`. | Low | **Fixed** — deleted. `Profile/ShareQrModal.web.tsx` was checked and kept: it is a legitimate Metro platform file. |

---

## 0. Monorepo audit (2026-09-14)

| Check | Result |
| --- | --- |
| Layout | Pass — Expo under `apps/mobile/` (`@tapuai/mobile`); Next stub `apps/admin-portal/`; `@tapuai/shared-types`; root `supabase/` + `scripts/` |
| Package manager | Pass — `pnpm-workspace.yaml`, `pnpm-lock.yaml`; root `package-lock.json` removed |
| Typecheck | Pass — `pnpm typecheck` (mobile `tsc` + admin `tsc`) |
| Docs sync | Pass — `pnpm docs:check` |
| Shared types | Pass — mobile `database.ts` re-exports; admin stub page imports `UserRole` / `SpotlightAward` |
| Metro monorepo | Pass — `apps/mobile/metro.config.js` watchFolders + dual `nodeModulesPaths` |
| Secrets in client | Pass — no `sk_test_` / `sk_live_` under `apps/mobile/src/frontend/` |
| Env convention | Pass — `apps/mobile/.env.local` (`EXPO_PUBLIC_*`); `apps/admin-portal/.env.example` (`NEXT_PUBLIC_*`); root `.env.local` gitignored |
| Expo `/admin` | Pass — desks remain in mobile; Next portal is scaffold only (by design) |
| Stale root paths | Fixed this pass — `docs/engineering/TROUBLESHOOTING.md`, `docs/engineering/SCHEMA.md` body refs, `docs/company/INVESTOR.md` / `LEGAL_BRIEFING.md` (`pnpm docs:sync`), `docs/engineering/SYSTEM_OVERVIEW.md` clear command |
| Touchables | Pass — **0** `TouchableOpacity` / `TouchableHighlight` / `TouchableWithoutFeedback` under `apps/mobile/app` + `apps/mobile/src/frontend` |
| Push to origin | **Blocked in agent** — HTTPS remote needs interactive GitHub auth (`gh auth login` or IDE Source Control push). Local `main` stays ahead until pushed |

Day-to-day:

```bash
pnpm install
pnpm mobile          # Expo fan app + Expo /admin
pnpm admin           # Next stub :3001
pnpm typecheck
pnpm docs:check
```

---

## 1. Button inventory

| Primitive | Count / rule | Result |
| --- | --- | --- |
| `TouchableOpacity` / `TouchableHighlight` / `TouchableWithoutFeedback` | Search of `apps/mobile/app/` + `apps/mobile/src/frontend/` | **0** |
| Product `Pressable` | Aliased to `HapticPressable as Pressable` | Pass — Light impact, `disabled` short-circuits `onPress` |
| Raw RN `Pressable` | Only inside `HapticPressable`, `AnimatedButton`, and `AnimatedPressable` | Pass — those are the haptic engines |
| `AnimatedButton` | Tabs, Upload FAB, FilterPills, ExclusivePaywall, Profile Mālo, Local retry | Pass — default haptic Light (`medium`/`selection` aliases) |
| `AnimatedPressable` | Reel Seki / Aura / Flex chips; Drip `GearCard`; cheer options; booster cards | Pass — Light impact except cheer (`haptic="none"` + Medium); chips 0.88 → 1.15 → 1.0; GearCard / boosters 0.96, no overshoot |
| Reel double-tap | `ReelCard` Aura burst | Medium `impactAsync` (explicit exception to Light) |
| Cheer poll vote | `Local/CheerPollCard` option tap | Medium `impactAsync` (`haptic="none"` on `AnimatedPressable` so Light does not double-fire) |
| Profile card flip | `AuraTradingCard` **Flip Card 🔄** / double-tap | Medium `impactAsync` at 90° (`haptic="none"` on the button so Light does not double-fire) |
| Operator callout | `apps/mobile/app/operator/[gameId].tsx` **⚡ Big Play** / TD / Big Hit / Turnover | `notificationAsync(Success)` (`haptic="none"` on `AnimatedPressable`) |
| Live play toast | `Reels/LiveMatchBanner` on `game_events` INSERT (`/game/[id]`) | `notificationAsync(Success)` (not a button; no Light impact) |
| Reel broadcast banner | `ReelCard` on Broadcast `play` | Light `impactAsync` (subtle fan burst) |
| Non-buttons | Tip-sheet backdrop/body | No CTA by design; body uses `haptic="none"` + swallow `onPress` so the sheet does not dismiss when tapping checkout |

Engine:

```
HapticPressable / AnimatedButton / AnimatedPressable
  → impactPress() → Haptics.impactAsync(ImpactFeedbackStyle.Light)
  → onPress (skipped when disabled)
ReelCard double-tap Aura → Haptics.impactAsync(Medium)
CheerPollCard vote → Haptics.impactAsync(Medium)
AuraTradingCard flip midpoint → Haptics.impactAsync(Medium)
Operator callout Broadcast → Haptics.notificationAsync(Success)
LiveMatchBanner play toast → Haptics.notificationAsync(Success)
ReelCard Broadcast banner → Haptics.impactAsync(Light)
```

---

## 2. Audited components

### Fan hub & chrome

| File | Callbacks | Pending disable | Notes |
| --- | --- | --- | --- |
| `FanTabBar.tsx` | Reel / Local / Drip / Profile `navigate`; FAB `openUpload` | N/A (local nav) | FAB is **not** a tab route |
| `apps/mobile/app/(tabs)/_layout.tsx` | Hosts `UploadVideoModal` | Upload Close blocked while uploading | `freezeOnBlur` + `detachInactiveScreens={false}` |
| `apps/mobile/app/(tabs)/index.tsx` | Overlay react / Mālo | `reacting` / `tipping` | UUID reels hit Supabase |
| `apps/mobile/app/(tabs)/local/index.tsx` | Hub pills, GameCard, cheer vote, booster peek, retry | Same-side cheer no-ops | Live Matches / School Polls / Top Boosters; game tap stays in-tab |
| `apps/mobile/app/(tabs)/drip.tsx` | Filter pills, GearCard → ProductSheet, Buy Now | PaymentSheet `busy` | `/shop` redirects here. Stripe native-only. |
| `apps/mobile/app/(tabs)/profile.tsx` | Drop $5 Mālo, Subscribe stub, hub filters, Flip Card | Mālo `busy` | Subscribe is local AsyncStorage, not Stripe. Flip haptic is Medium at 90° |

### Reels, Mālo, upload

| File | Callbacks | Pending disable |
| --- | --- | --- |
| `ReelActionOverlay.tsx` | `@Athlete`, Seki/Aura/Flex, Mālo | Reactions off if `reacting` or no `onReact`; Mālo off if `tipping` / no player |
| `TaggedReelGrid.tsx` | Tile open / lock paywall / modal react | Modal `reacting` during RPC |
| `ReelViewModal.tsx` | Close, paging `ReelCard`s, nested Mālo | Close clears tip sheet; only the focused page plays |
| `UploadVideoModal.tsx` | Close, library/record, tags, submit | Close + iOS swipe ignored while `uploading`; form reset on hide |
| `TipSheetModal` / `MaloTipModal` | Backdrop, Close/Done | Locked while PaymentSheet `busy`; unmount resets checkout; blur backdrop |
| `TipCheckout.tsx` / `TipButton.tsx` | $5 / $10 / $25 / Custom | `disabled={busy}` |
| `ExclusivePaywall.tsx` | Unlock $4.99/mo | `disabled={busy}` |
| `FeeCheckbox.tsx` | Cover fees | Single row handler |
| `BackedCelebration.tsx` | Dismiss | — |

### Operator, roles, guest

| File | Pending disable |
| --- | --- |
| `apps/mobile/app/operator/index.tsx` | Game row opens PIN sheet; GPS `checkingIn` | Claim `claiming` | `PINClaimModal` Light impact per digit |
| `apps/mobile/app/operator/[gameId].tsx` | +1/+3/+6, clock, callouts, roster | `sending` | RPC `update_game_score`; `/operator/console/[gameId]` redirects here |
| `apps/mobile/app/operator/scorer.tsx` | Macros | `sending` | |
| `OperatorRosterModal.tsx` | Close + rows `busy` |
| `apps/mobile/app/(admin)/admin/index.tsx` | Verify / Pay `busyId` |
| `app/(booster)/booster/index.tsx` | Upload / Verify `busy` |
| `app/(sponsor)/sponsor/index.tsx` | Place / Publish / Pause `busy` |
| `app/(parent)/parent/index.tsx` | Consent + payout `busy` |
| `app/athlete/[id].tsx` | Exclusive CTA `busy`; retry `load` |
| `app/(guest)/game/[id].tsx` | Retry; `TabSwitcher` / prefs have `onChange` |
| `app/(guest)/player/[id].tsx` | Retry; HypeBoard `onBump`; TipCheckout `busy` |
| `GameCard.tsx` | Single card `onPress` (no nested CTA) |
| `PlayCard.tsx` | Seki/Aura/Flex + compact Mālo; `reacting` on player hype |

---

## 3. Fixes recorded (this audit)

| Issue | Severity | Fix |
| --- | --- | --- |
| Athlete profile `FilterPills` `onChange={() => undefined}` | Low | Replaced with a static **Tagged Clips** label |
| Overlay reaction chips still tappable when `onReact` missing | Medium | `disabled={!onReact}` |
| Play-card hype could stack RPCs | Low | `reacting` lock around `bumpPlayerHype` |
| Stale HapticPressable JSDoc (“selection”) | Docs | Now documents Light-only engine |

Earlier landings still in tree: `HapticPressable` + Light `impactPress`; PaymentSheet Close lock; upload form reset; GameCard double-press; fee double-toggle; feed/modal reaction locks; operator GPS disable; role-dashboard `busy` gates; reel pause on unmount.

---

## 4. Media & Mālo

### Seki 🤙 / Aura ⚡ / Flex 💪 (video overlays)

```
Reels/ReelCard / TaggedReelGrid
  → bumpReelHype(reelId, kind)
  → rpc increment_reel_hype({ target_reel_id, hype_kind })
  → overlay counts update immediately
```

| Check | Status |
| --- | --- |
| Overlay `onPress` | Pass |
| Light haptic | Pass |
| Instant local +1; `reels` increment in background | Pass (chips no longer wait on RPC) |
| Writes `reels` | Pass for **UUID** ids; fallback `reels.update` if RPC missing |
| Seeded `HIGHLIGHT_CLIPS` (`hl-1`, …) | Known: non-UUID → optimistic UI only |

Guest player `HypeBoard` / `PlayCard` increment **`players`** hype, not `reels` (correct for those routes).

### Mālo $5 / $10 / $25

```
TipButton → useTipCheckout
  → PaymentSheet
  → add_user_aura({ target_user_id, points_to_add: tipAmount * 10 })
  → emitProfileAura + refreshProfile → AuraTradingCard border
```

| Check | Status |
| --- | --- |
| Shortcuts `disabled={busy}` | Pass |
| RPC after successful pay | Pass when signed-in `user.id` |
| Live profile points / 7-tier border | Pass |
| Success extra haptic | `notificationAsync(Success)` after pay; tap itself is Light |
| Web | Alert stub |
| Profile Subscribe ($4.99) | Local stub; paid exclusive is `/athlete/[id]` |

---

## 5. Modals, tabs, sockets

| Surface | State reset | Pending lock |
| --- | --- | --- |
| `UploadVideoModal` | Clip, caption, game, player, errors, progress | Close / swipe ignored while uploading |
| `TipSheetModal` / `MaloTipModal` | Unmounts `TipCheckout`; `delivered`/`busy` reset | Close/backdrop no-op while PaymentSheet open |
| `ReelViewModal` | Nested tip closed; pager unmounts `expo-video` | — |

Tab bar: Reel → Local → Drip → Profile. Already-focused tab does not re-push. Center ⚡ FAB only `openUpload()`.

Realtime teardown:

| Owner | Unmount |
| --- | --- |
| `useLiveScores` | `removeChannel` |
| `useLiveGame` | `removeChannel` |
| `useGameEventBroadcast` | `removeChannel` |
| Operator `game_events_${gameId}` Broadcast | `removeChannel` |
| `useCheerPoll` | `removeChannel` |
| Guest `game/[id]` | `removeChannel` |
| Operator index / console / scorer | `removeChannel` |
| `AuthContext` | `unsubscribe` |

---

## 6. UI readiness

**Ready:** Fan 5-item bar, Reel reactions + Mālo, Upload FAB, exclusive paywall CTA, operator claim/GPS, role-dashboard writes.

**Accepted gaps (not fan-loop blockers):**

1. Seeded demo clips do not write `increment_reel_hype`.
2. Checkout does not insert `public.tips` rows (backer count, reel cents, Drip, and Aura still update).
3. Profile Subscribe ($4.99) is local-only.
4. Haptics no-op on web / some simulators.

---

## 7. Reel feed button audit (2026-09-12 follow-up)

| Surface | Result |
| --- | --- |
| `Gesture.Exclusive(doubleTap, singleTap)` | Pass — single also `requireExternalGestureToFail(doubleTap)`; `maxDistance` / `maxDeltaY` 28 so vertical paging is not a tap |
| Double-tap Aura ⚡ | Pass — floating particle, `Haptics.impactAsync(Medium)`, optimistic `aura_count`, background `increment_reel_hype`, `add_user_aura(+1)` when signed in |
| Seki / Aura / Flex chips | Pass — `AnimatedPressable` `scaleTo={0.88}` `overshoot` (0.88 → 1.15 → 1.0); local +1 then RPC |
| Mālo ⚡ | Pass — opens `MaloTipModal` (`TipSheetModal` alias) with `expo-blur` backdrop |
| Share | Pass — Expo `Share.share` + `formatReelDeepLink` (`alasports://athlete/{id}?reel=`) |
| Bookmark | Pass — `useSavedReel` → `saved_reels` for uuid clips; AsyncStorage for guests / seeded ids |
| Live score banner | Pass — pan activates on swipe-up only (`failOffsetY` down); ✕ / swipe-up set `isDismissed` + Light haptic |

### Device smoke (Expo Go, not web)

- [ ] Uploaded reel: Seki / Aura / Flex persist after pull-to-refresh.
- [ ] Double-tap Aura ⚡: particle + Medium haptic; signed-in fan Aura +1; single tap still mutes (no burst).
- [ ] Mālo ⚡ opens blurred `MaloTipModal`; Share sheet shows `alasports://…` deep link; Save fills bookmark and survives refresh (`saved_reels`).
- [ ] Live score banner: swipe up or ✕ hides it (Light haptic); vertical Reel paging still works from the video.
- [ ] Mālo $5 signed-in: PaymentSheet, +50 Aura, AuraTradingCard border; Close disabled while sheet is open.
- [ ] Upload FAB: Close inert during upload; reopen is a clean form.
- [ ] Reel → Local → Drip → Profile; no Realtime errors in Metro.
- [ ] `/athlete/[id]` exclusive CTA unlocks tiles after pay.
- [ ] Drip Buy Now (Expo Go): PaymentSheet, `add_user_aura` dollars×10, success haptic, **Drip secured ⚡** toast.
- [ ] Local hub: Live Matches / School Polls / Top Boosters pills; cheer vote springs the bar, **+1 Vote ⚡**, `cast_cheer_vote`; booster card peek.
- [ ] Operator: PIN `1234` claims a game; +1/+3/+6 and Start Clock hit `update_game_score`; **⚡ Big Play** Broadcasts to the focused Reel (`⚡ BIG PLAY: Westlake Thunder!`).
