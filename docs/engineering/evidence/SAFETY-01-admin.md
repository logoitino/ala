# SAFETY-01 admin evidence

Local only. Migration `20261017090000_coach_level_label.sql` is written and copied onto `schema.sql`. It was not applied to development, staging, or production, and it was not replayed on PGlite in this session.

## Command

```sh
node scripts/data-map.mjs
pnpm --filter @tapuai/mobile typecheck
pnpm --filter @tapuai/mobile test -- --watchman=false --no-coverage \
  src/frontend/components/Admin/__tests__/SafetyLabelPanel.test.tsx
```

## Result (2026-10-17T04:25:19Z)

- Data map: 114 tables/views, 560 functions, 0 rule failures. `safety_label_events` is owned by HIGHLIGHTS.
- Mobile `tsc --noEmit`: exit 0.
- `SafetyLabelPanel` test: a missing `coach_label_desk` shows “Coach-level counts are unknown” and does not show 0.
- Highlights desk mounts `SafetyLabelPanel` with add/remove (reason at least 8 characters), suggestion list, and the latest events.
- Not run: hosted SQL, actor replay, device, counsel sign-off. Challenge exclusion and teen pre-publish review stay open.
