# SAFETY-01 app evidence

Local only. The admin checkpoint `2026-10-17T04:25:19Z` stays as recorded.

## Command

```sh
pnpm --filter @tapuai/mobile test -- --watchman=false --no-coverage \
  src/frontend/lib/__tests__/shareCard.test.ts \
  src/frontend/components/BeyondGame/__tests__/BeyondGameParticipant.test.tsx \
  src/frontend/components/Spotlight/__tests__/LeaderboardsBoard.test.tsx \
  src/frontend/components/Challenges/__tests__/Challenges.test.tsx
pnpm --filter @tapuai/mobile typecheck
```

## Result (2026-10-17T04:25:48Z)

- 4 suites / 31 tests, exit 0. Beyond composer still requires both consents. Challenges still allow “I’m in”; the coach notice is an extra line when `coachLevel` is set.
- Mobile `tsc --noEmit` exit 0 in the earlier combined run the same session.
- `comments:check` ok. `data:map:check` ok (111 tables, 3 views, 6 buckets, 560 functions).
- Badge, upload switch, Beyond workout switch, and the report reason that does not hide the clip are in the app. `layouts.coachLevel` hides the switch and the report reason. A label already set stays visible.
- Not run: hosted SQL, device, browser pass of this screen, counsel. Migration `20261017090000` is not applied.
