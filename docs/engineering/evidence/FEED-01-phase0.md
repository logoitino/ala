# FEED-01 Phase 0 — Home feed measurement (dev only)

**Date:** 2026-11-14 (America/Denver)  
**Scope:** Local-only debug report on `rankHomeFeed` output. Never shipped to users; never sent to any server.

## Wave 0 finding

Seeded `HIGHLIGHT_CLIPS` in `apps/mobile/src/frontend/data/highlights.ts` has **5** demo rows. That is below the Phase 0 sample of 20.

`measureHomeFeedTop()` therefore reports:

| Metric | Value (seeded Home, empty Crew) |
| --- | --- |
| sampleSize | 5 |
| top20 | 5 |
| top3AthleteShare | 0.6 (over 5 only — not a pilot share) |
| top2SchoolShare | 0.6 (over 5 only) |
| olderThan48hShare | 1.0 (seeded demo ages) |
| zeroHypeShare | 1.0 |
| crewInFirst5 | 0 |
| note | Only 5 clips available (Wave 0). Re-measure on the first pilot school's `reels_feed` once it has ≥20 rows. |

**Do not invent production shares.** Re-run on pilot-school staging data:

1. Sign in on a build with `__DEV__` (Home logs `[FEED-01 Phase 0]` via `measureHomeFeedTop`).
2. Or call `measureHomeFeedTop(rankHomeFeed(clips, context), context)` in a Jest fixture built from staging rows.

## Ranking unit evidence (this PR)

`apps/mobile/src/frontend/data/__tests__/highlights.feedRanking.test.ts`:

- Picks beat bare recency
- Crew outranks picks
- Money (`totalTipsCents`) never changes order
- Personalization off → newest-first
- Determinism
- `pinFeedOrder` still holds after hype change
- Phase 3 diversity caps when `EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS=1`
- Phase 3 noop when flag off

## Counsel gates still open (Phase 2 must stay OFF)

1. Privacy-policy line for stored picks (Phase 1 ship companion — owner/counsel wording).
2. Implicit signals for minors / guardian consent.
3. Retention limits for views/saves used in ranking.
4. No third-party / ad sharing of feed signals (confirm in writing).
5. Approved “Why this clip” disclosure wording.

## Codex follow-up (2026-11-14)

- Phase 2 **collection** (`rememberFeedViewTouch` / save / hide demotion) is gated by the same env flag as ranking — no AsyncStorage behavioral history while the flag is off.
- Restrictive `Closed accounts` policy added to the migration when `caller_not_age_blocked` exists.
- Feature-admin presentation-only exemption removed; `/admin/highlights` `FeedInterestPanel` + coverage `home_feed_interest`.
- Prefs broadcast so Home refreshes after Profile Settings save.
