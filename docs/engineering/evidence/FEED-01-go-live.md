# FEED-01 go-live packet (Phase 1)

**Date:** 2026-11-14 (America/Denver)  
**Branch / PR:** `cursor/highlights-interest-feed-9a86` · [#46](https://github.com/logoitino/ala/pull/46)  
**Spend:** Applying the migration in Supabase SQL Editor is **$0** on Wave 0. Preview builds are
**$0** until Expo’s free build quota runs out. Supabase Free can pause; Pro is about **$25/mo**
only if that happens. Live Stripe keys are not this wave. Apple Developer **$99/yr** is already
enrolled.

This packet is the owner checklist. It does not merge PRs, apply SQL, or accept legal text.

## 1. Merge order (agent cannot merge — GitHub write is owner)

Whole interest-feed stack is green and MERGEABLE as of this note. Merge **bottom-up**; do not
merge #46 ahead of its base:

| Order | PR | Branch → base |
| --- | --- | --- |
| 1 | [#39](https://github.com/logoitino/ala/pull/39) | `cursor/popup-polls-quiz-9a86` → `cursor/ui-density-audit-9a86` |
| 2 | [#40](https://github.com/logoitino/ala/pull/40) | `cursor/vault-platform-rails-9a86` → popup-polls |
| 3 | [#42](https://github.com/logoitino/ala/pull/42) | `cursor/web-app-parity-9a86` → vault |
| 4 | [#43](https://github.com/logoitino/ala/pull/43) | `cursor/admin-portal-optimize-9a86` → web-parity |
| 5 | [#44](https://github.com/logoitino/ala/pull/44) | `cursor/app-fluidity-9a86` → admin-portal |
| 6 | [#45](https://github.com/logoitino/ala/pull/45) | `cursor/local-daylight-polish-9a86` → fluidity |
| 7 | [#46](https://github.com/logoitino/ala/pull/46) | `cursor/highlights-interest-feed-9a86` → daylight |

If the density base (`cursor/ui-density-audit-9a86`) is not yet on `main`, merge that first (or
retarget #39) before this sequence. APP-TEST PRs #35/#36 are separate from this stack.

## 2. Hosted SQL apply (owner — $0)

On the **existing** staging/dev Supabase project (not a fresh schema paste):

1. Supabase → SQL Editor.
2. Paste all of `supabase/migrations/20261114010000_user_feed_prefs.sql`.
3. Run. Expect table `public.user_feed_prefs` + owner RLS (+ Closed accounts policy if
   MINOR-01’s `caller_not_age_blocked()` already exists; otherwise the migration notices and
   skips that policy).
4. Smoke check:

```sql
select to_regclass('public.user_feed_prefs') as table_ok;
select polname from pg_policy where polrelid = 'public.user_feed_prefs'::regclass;
```

Do **not** re-paste full `schema.sql` on a live project. Record the apply time in STATE §4.

## 3. Device smoke (DEVICE_QA — after SQL)

Local Jest already covers ranking, hide storage, and sheet render:
[FEED-01-phase1-smoke.md](FEED-01-phase1-smoke.md). Still required on a signed-in build:

1. Sign in → first-run or Settings → Highlights → pick sports/schools → Save.
2. Kill and relaunch → Home order reflects picks.
3. Settings → Highlights → turn **Personal feed** off → Home is newest-first.
4. Hide a clip → it does not return after leave/relaunch.
5. Guests stay chronological; no picks screen.

## 4. Counsel (Phase 1 companion; Phase 2 blocked)

Candidate Privacy Policy line (draft only):
[FEED_INTEREST_PRIVACY_DRAFT.md](../../legal/FEED_INTEREST_PRIVACY_DRAFT.md).

Phase 2 (`EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS`) stays **OFF** until written answers for minors,
retention, third-party/ad ban, and “Why this clip” wording.

## Status snapshot

| Gate | State |
| --- | --- |
| Stack #39–#46 | Merged into `cursor/ui-density-audit-9a86` via async merge (2026-11-14) |
| Density → `main` | Merged as [#47](https://github.com/logoitino/ala/pull/47) (`989d74e`) |
| Local ranking / hide / sheet tests | Pass |
| Hosted `user_feed_prefs` | **Not applied** — owner SQL Editor next |
| Signed-in device smoke | Blocked on SQL + device |
| Published Privacy Policy line | Open — draft + send note (`FEED-01-counsel-send.md`) |
| Phase 2 flag | OFF |
