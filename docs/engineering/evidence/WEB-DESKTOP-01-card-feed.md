# WEB-DESKTOP-01 — Lovable-outline card feed

**Date:** 2026-11-15 (America/Denver)  
**Status:** **FINISHED** on `cursor/web-desktop-card-feed-9a86` / PR [#55](https://github.com/logoitino/ala/pull/55)  
**Base:** `cursor/web-desktop-layout-9a86` / PR [#54](https://github.com/logoitino/ala/pull/54)  
**Spend:** **$0** (no new Lovable credits). Wave 0 budget unchanged.

## What changed

| Surface | Behavior |
| --- | --- |
| Expo web ≥820 | Home center = `DesktopHighlightFeed`: Highlights title, All/sport pills, scroll cards with poster, Why this clip, Cheer (Seki + Soft-Wall), Send a gift (existing tip sheet) |
| Play | Card play opens `ReelViewModal` for that clip; Home owns guest browse + Spotlight Watch |
| Left rail | Tapua'i brand mark; real Crew shortcuts via `fetchCrewShortcuts` (empty / sign-in lines when none) |
| Right rail | Live / Boosters / Vault pointer / Booster / Drip (shell PR #54) |
| Native + web &lt;820 | Phone vertical pager + FanTabBar unchanged |

## Review fixes (Codex P2)

| Finding | Fix |
| --- | --- |
| Guest browse on desktop play | `decideGuestDesktopPlay` + Home `requestDesktopPlay` (same 3-clip Soft-Wall) |
| Gift from playback modal | `onTipped(reelId, cents)` / `onBacked(playerId, count)` from modal + card sheet |
| Spotlight Watch | `jumpToSpotlightClip` → `requestDesktopPlay` when desktop cards |
| Report hide | `ReelViewModal` `onHide` → Home `hideClip` + clear `playClipId` |
| CI `highlights-jump` | Stub `DesktopHighlightFeed` so NetInfo/OfflineQueue does not crash phone-pager suite |

## Verification

| Check | Result |
| --- | --- |
| Jest `DesktopHighlightFeed` + `guestBrowse` + `crewShortcuts` | PASS |
| Jest `highlights-jump` (phone) | PASS with desktop stub |
| `pnpm comments:check` / `pnpm copy:check` | PASS |
| Mobile typecheck | PASS |
| CI `build-and-check` + source-release | PASS on currency commit |
| Playwright 1920 | Shell + Main + Highlights card column + Extras; Crew shortcuts present; bottom dock **hidden** — `web-desktop-card-feed/1920.png` |
| Playwright 820 | Icon left rail + card feed + “Open extras panel” FAB — `820.png` |
| Playwright 390 | Phone Home chrome + FanTabBar (Home/Activity/Upload/Spotlight/Profile); rails **absent** — `390.png` |

## Hard stops held

- Money rules / VOICE gift wording unchanged; tip still Soft-Wall `malo`.
- No SAMPLE athletes in the live feed; Lovable remains reference.
- Phone density / FanTabBar below 820 unchanged.

## Owner only

Merge **#54** then **#55**. Engineering done on branch.
