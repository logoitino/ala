# WEB-DESKTOP-01 — Lovable-outline card feed

**Date:** 2026-11-15 (America/Denver)  
**Branch:** `cursor/web-desktop-card-feed-9a86` (base: `cursor/web-desktop-layout-9a86` / PR #54)  
**Spend:** **$0** (no new Lovable credits). Wave 0 budget unchanged.

## What changed

| Surface | Behavior |
| --- | --- |
| Expo web ≥820 | Home center = `DesktopHighlightFeed`: Highlights title, All/sport pills, scroll cards with poster, Why this clip, Cheer (Seki + Soft-Wall), Send a gift (existing tip sheet) |
| Play | Card play opens `ReelViewModal` for that clip |
| Left rail | Tapua'i brand mark above nav |
| Native + web &lt;820 | Phone vertical pager unchanged |

## Verification

| Check | Result |
| --- | --- |
| Jest `DesktopHighlightFeed` | PASS (filter + gift + guest Why omit) |
| Jest `WebAppShell` | PASS |
| `pnpm comments:check` | PASS |
| `pnpm copy:check` | PASS |
| `tsc` on new card file | PASS after `absoluteFill` fix |

## Review fixes (2026-11-15)

| Finding | Fix |
| --- | --- |
| Guest browse on desktop play | `decideGuestDesktopPlay` + Home `requestDesktopPlay` (same 3-clip Soft-Wall) |
| Gift from playback modal | `onTipped(reelId, cents)` / `onBacked(playerId, count)` from modal + card sheet |
| Spotlight Watch | `jumpToSpotlightClip` → `requestDesktopPlay` when desktop cards |
| Report hide | `ReelViewModal` `onHide` → Home `hideClip` + clear `playClipId` |
| CI `highlights-jump` | Stub `DesktopHighlightFeed` so NetInfo/OfflineQueue does not crash phone-pager suite |

## Hard stops held

- Money rules / VOICE gift wording unchanged; tip still Soft-Wall `malo`.
- No SAMPLE athletes in the live feed; Lovable remains reference.
- Phone density / FanTabBar below 820 unchanged.
