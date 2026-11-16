<!-- FEED-ENDLESS Phase 0 — measure first; no design until §0 diffs are accepted. -->
# FEED-ENDLESS — Phase 0 audit

**Date:** 2026-11-16 (America/Denver)  
**Executor:** cloud agent on `cursor/feed-endless-audit-9a86`  
**Checkout:** `origin/main` (post APP-TEST gift #57)  
**Database the app reads:** staging `tucioqipfejqqqtuakdi` via `apps/mobile/.env.local`  
**Spend:** **$0** (docs + local Metro / Playwright only). Wave 0 budget unchanged.

This audit is numbers and file facts. Where the owner prompt §0 (2026-11-15) differs from
live source, **the file wins**. Differences are listed first. Phase 1 design
(`FEED-ENDLESS-01.md`) is **held** until those diffs are acknowledged.

---

## 0. §0 vs live files (file wins)

| §0 claim | Live on this checkout | Verdict |
| --- | --- | --- |
| `apps/mobile/app/(tabs)/index.tsx` is **802** lines | **1010** lines (`wc -l`) | Diff — FEED-01 + WEB-DESKTOP grew Home |
| Mac ranker only `{ crewIds, school }`; main ahead | This checkout **is** `main` with Phase 1 prefs + “Why this clip” already in `highlights.ts` | Diff — no separate Mac ranker here; owner Mac must pull `main` before Phase 1 design |
| Main head `0e510fa` added prefs scoring | Prefs / Why-this-clip landed in **`d6d7426`** (2026-11-14). `0e510fa` = merge #51 device-smoke after Phase 1 finished. Stack land = **`989d74e`** (#47) | Diff — cite `d6d7426` / #47 for prefs code |
| Staging ~5 athletes, 0 Vault (PR #53) | `players` **5**; Vault playable in feed **0** | Match |
| Pool small → cycles through all videos | **No cycle / refill / `onEndReached` exists** | Match gap |
| Guest: opened clip + 2 swipes → SoftWall | `GUEST_FREE_HIGHLIGHTS = 3` in `guestBrowse.ts`; wired in `index.tsx` | Match in code |
| Pager is TikTok-shaped; endless is not | Phone pager = vertical `Animated.FlatList` + `ReelPage`. Expo web **≥820** uses `DesktopHighlightFeed` cards (not the phone pager) | Diff — §0 omitted desktop card path |

**Stop for design:** Phase 1 (`FEED-ENDLESS-01.md`) waits until FACILITATOR accepts the line-count / Mac-reconcile / commit-cite / desktop-path corrections above. Audit continues with measurements.

---

## 1. How big is the pool?

Measured against **`reels_feed`** (what `fetchReels` / `queryReels` reads), Demo Fan JWT and anon.

| Metric | Value |
| --- | --- |
| `reels_feed` rows (Demo Fan, Prefer count=exact) | **1** (`content-range: 0-0/1`) |
| Playable with non-null `video_url`, not removed/flagged | **1** |
| Category of that clip | `game_play` |
| Distinct `player_id` on playable | **1** (Jordan Blake `bfb339a8-…`) |
| Vault / exclusive rows in this feed read | **0** |
| `players` rows visible to Demo Fan | **5** |
| Anon `reels_feed` playable | **1** (same clip) |
| Seeded `HIGHLIGHT_CLIPS` (empty `videoUrl`, samples only) | **5** (`hl-1`…`hl-5`) |

`homePagerClips` (`highlights.ts`): if any uploaded clip is playable, **samples are dropped**.
Today that means the Home list is **1 real clip**, not 5 samples.

**When the feed runs out today:** after **1** page on this database. There is no second page,
no refill, and no reshuffle.

`reels_feed.sport` is **missing** on this hosted schema (PostgREST `42703`); client tiers fall
back. Do not assume sport breakdown from SQL on this project until the column/view matches
canonical schema.

Prior FEED-01 Phase 0 (`FEED-01-phase0.md`) measured **5 seeded** rows with empty uploads —
that report is about samples, not this project’s current upload pool.

---

## 2. What happens at the end today?

### Code (authoritative)

- `useReels` (`hooks/useReels.ts`): one `fetchReels()` on mount + pull-to-refresh. **No**
  pagination cursor, **no** `fetchMore`.
- Home `Animated.FlatList` (`index.tsx` ~681+): `data={feed}`, paging, **no `onEndReached`**,
  no append path. Confirmed with `rg onEndReached` → no matches in `index.tsx`.
- Ranking: `rankHomeFeed` / `rankHomeFeedWithReasons` + `pinFeedOrder` once per clip-id set /
  context / pull-refresh — **not** on hype taps.

### Signed-in / guest observation (Expo web phone width 390, 2026-11-16)

| Build | What the fan sees | Swipes before end |
| --- | --- | --- |
| Guest, pool = 1 playable | Full-screen Jordan Blake Highlight; swipe/wheel does **not** advance to another clip | **0** further clips (list length 1) |
| Guest SoftWall from browse | Needs `distinctClipsSeen > 3`. With pool = 1, seen size stays **1** → SoftWall **does not** fire from swiping alone | SoftWall gated by **count of distinct clips**, not time |
| Signed-in Demo Fan (same pool) | Same single-clip pager end; pull-to-refresh reloads the same one | **0** further clips |

Empty mid-session: only if `feed.length === 0` → `HomeFeedEmpty`. Not hit while the one
playable upload remains.

Desktop web ≥820: card feed (`DesktopHighlightFeed`) scrolls the same underlying clip list;
end-of-list is still the finite ranked array — also no endless refill.

---

## 3. Signals — both lists

### Exist today (file / column or store)

| Signal | Where |
| --- | --- |
| View count | `reels.view_count` / mapped `clip.viewCount` (`lib/reels.ts`) — **not** used in `scoreHomeFeedItem` |
| Seki / Aura / Flex counts | `reels.seki_count` / `aura_count` / `flex_count` → hype term capped at **32** in `scoreHomeFeedItem` |
| Created-at freshness | `clip.createdAt` → up to **+18** |
| Category | `clip.category` (Serve Like Me **+28**; pick lean **+20**) |
| Sport | `clip.sport` when present; pick match **+40** (hosted `reels_feed.sport` missing here) |
| School | player / clip school; viewer school **+45**, picks **+35**, cap **60** |
| Crew follows | `crew_follows` → `fetchSquadAthleteIds` → **+90** |
| Flash Unlock | `clip.flashUnlockUntil` → **+22** |
| Explicit picks | `user_feed_prefs` + `useFeedPrefs` / `lib/feedPrefs.ts` (Phase 1) |
| Why this clip | `FeedReasonCode` + `whyThisClipLine` (signed-in; guests hidden) |
| Hide | `tapuai.hiddenReels` / `reelHiddenForUser` — removed from list, not a rank weight while Phase 2 off |
| Money on clip | `total_tips_cents` present on rows — **never read by ranker** (hard rule) |

### Do not exist (would need capture / counsel for persistence)

| Signal | Notes |
| --- | --- |
| Watch time / completion / rewatch | No session completion set for ranking while Phase 2 flag off |
| Skip / fast-scroll interest | Not captured for ranking |
| Share / follow-in-feed as rank inputs | Follow exists as Crew graph; not an in-session rank adjustment beyond Crew set refresh |
| Per-user cross-session history | Phase 2 `ImplicitFeedSignals` types exist; gated by `EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS` default **OFF** |
| Seen-tracking for endless cycle | **No** session seen-set for refill/cycle (only guest SoftWall set + hide list) |
| Endless queue / cycle / diversity slots shipping | Diversity helper exists but only runs when implicit flag ON |

### Cheapest signal to use first (no new table, no counsel clearance)

**In-memory session seen-set + hide (already device-local)** for queue/cycle decisions.
Explicit picks and Crew/school already ship without new tables. Do **not** turn on
`EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS` or persist views/saves until counsel clears the five FEED-01
items.

---

## 4. Reconcile Mac vs main

| Item | Fact |
| --- | --- |
| Prefs + Why-this-clip commit | `d6d7426eee53ac2673b2d2c87988fffe144b1a04` — *Add FEED-01 interest-based Highlights Home ranking (Phase 1).* |
| Stack on main | PR [#47](https://github.com/logoitino/ala/pull/47) merge `989d74e` (2026-11-14) |
| Phase 1 finished / smoke | PR #51 merge `0e510fa` — **not** the prefs introduction |
| This cloud checkout | Already on `main` with `HomeFeedContext.prefs`, `rankHomeFeedWithReasons`, Feed picks sheet, settings, Phase 2 types behind flag |
| Owner Mac | If still on pre-`d6d7426` ranker `{ crewIds, school }` only → **pull / rebase onto current `main` before Phase 1 design**. This audit does not invent Mac file contents |

---

## 5. Single sharpest gap

**The Home pager already feels like TikTok to swipe, but the list is a one-shot ranked array with no refill or cycle — on today’s staging pool that means the feed dies after one clip.**

---

## 6. Ranking weights (live `scoreHomeFeedItem`, for Phase 1 design input)

Rules-based, client-side, money never ranks:

| Factor | Points |
| --- | --- |
| Crew | +90 |
| School (viewer / picks, capped) | up to 60 |
| Serve Like Me | +28 |
| Flash Unlock | +22 |
| Seki play / seki≥3 | +16 |
| Hype (Seki+Aura+Flex)×2 | capped 32 |
| Freshness | up to +18 |
| Sport pick | +40 |
| Category pick | +20 |
| Implicit (flag OFF) | views/saves/seen/hide demote — **not applied** |

`pinFeedOrder` still re-applies order to fresh objects so hype taps do not move the under-finger clip.

---

## 7. Constraints carried into Phase 1 (unchanged)

- Guest wall stays (`GUEST_FREE_HIGHLIGHTS = 3`); endless must not bypass SoftWall.
- Vault locked clips never play in public feed; Flash-Unlock for Crew in window.
- Aura double-tap = cheering; Aura-from-giving stays out of this feed.
- Money never ranks; no ad targeting from feed signals.
- FEED-01 Phase 1 finished; Phase 2 stays OFF pending counsel.
- Do not rewrite VOICE / tip model / Vault ladder / FEED-01 charter — endless queue only.

---

## 8. Next (held)

1. FACILITATOR accepts §0 corrections in section 0.  
2. Then write `docs/agents/FEED-ENDLESS-01.md` (queue + Layer A/B + T1–T4 owner decisions) — **design only, no build**.  
3. Build only after owner approves T1–T4 on a branch from the same HEAD testers use.

**Not verified here:** native iOS/Android rubber-band at list end; pilot-school pool ≥20;
hosted `reels_feed.sport` once schema matches.
