# PRIV-01 app-ready evidence (2026-10-14)

Admin checkpoint: [PRIV-01-admin.md](PRIV-01-admin.md). Design: [PROFILE_PRIVACY_DESIGN.md](../design/PROFILE_PRIVACY_DESIGN.md).

## What changed since the admin checkpoint

- **App screens:**
  - Profile → Privacy sheet.
  - Add friend / Requested / Friends ✓ / Block on another user's profile, with the private note.
  - Activity friend requests.
  - The pending vs approved tag chip in the clip overlay (`ReelActionOverlay`).
  - Edit profile keeps the old switches on databases without the update.
- **Stage 2 tag approval** (`20261014100000_tag_approval.sql`): RLS_SECURITY review → fixes → re-review →
  re-re-review.
  - Clients write only the app's `reels` columns.
  - A decline names nobody, even on the uploader's own row.
  - A block's quiet decline looks exactly like a decline and is recorded, so an admin can undo it.
  - Blocking someone who has pending tags works. It used to fail through the tag guard.
  - The athlete can remove an auto-approved tag; admins can undo a rejection; re-confirming keeps the date; operators
    are exempt from the pending cap.
  - RLS_SECURITY confirmed every tag fix. Its last findings were the lock's dangling app calls and the data map, both
    resolved here.
- **Guardian lock removed** (owner 2026-10-14): MINOR-01 supervision and approvals replace it in the SQL, the admin
  desk, the app and the tests.
- **Shared fix:** `untypedRpc` binds `supabase.rpc`, with a regression test.

## Checks run (Node 24.21.0, this Mac, 2026-10-14 ≈04:50 UTC)

| Command | Result |
| --- | --- |
| `pnpm check` | exit 0: 126 suites / 905 tests and every guard |
| `node scripts/replay/schema-replay.mjs /tmp/books01-pg/pkg/package/dist` | 100/100 (PRIV-01 stage 1 and 2 checks plus MINOR-01) |

## Not verified and follow-ups

- **ReelCard chip:** ReelCard does not pass `tagState` yet, because the file sits under PLAY-01's claim (hand-off in
  `docs/agents/PLAY-01.md`).
- **Donations on pending clips:** COMMERCE / CHECKOUT should refuse a donation on a pending clip before charging. The
  app UI already blocks it.
- **Other follow-ups:** private avatar files; leaderboard speed.
- **No device, browser or hosted checks.**
