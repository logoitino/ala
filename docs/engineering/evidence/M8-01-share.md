# M8-01 share card evidence

Presentation only. No new table, write, permission, or money path. The phone share sheet uses the Rally title, the athlete’s name, the existing gift link when a handle is already on the card, and the current board leader’s name. Boards still show hype and views only.

Reviewed in the same Cursor session that built it, at the owner’s request on 2026-10-16. This is not an independent review.

## Command

```sh
pnpm --filter @tapuai/mobile test -- --watchman=false --no-coverage \
  src/frontend/lib/__tests__/shareCard.test.ts \
  src/frontend/components/Spotlight/__tests__/LeaderboardsBoard.test.tsx
```

## Result (2026-10-17T04:25:48Z)

- Share lines name the filled Rally and the gift URL, and name a board leader without a dollar amount. Those assertions passed inside the 4-suite / 31-test run (exit 0).
- `RallyFillMoment` shows “Share this Rally”. `LeaderboardsBoard` shows “Share the leader” when the board has a first row. `RallyCard` passes the gift URL when `username` is set. The Highlight meter has no handle, so that share omits the link.
- Not run: a tap on a device or in the browser, Instagram or TikTok layout, backer wall, rivalry takeover, first-backer and hometown badges.
