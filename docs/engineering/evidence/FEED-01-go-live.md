# FEED-01 go-live packet (Phase 1)

**Date:** 2026-11-14 (America/Denver)  
**Last updated:** 2026-11-14 15:01 MST  
**Branch / PR (evidence closeout):** `cursor/feed-01-device-smoke-9a86` · [#51](https://github.com/logoitino/ala/pull/51)  
**Feature landed via:** stack #39–#46 → density [#47](https://github.com/logoitino/ala/pull/47) on `main`  
**Spend:** Applying the migration in Supabase SQL Editor is **$0** on Wave 0. Preview builds are
**$0** until Expo’s free build quota runs out. Supabase Free can pause; Pro is about **$25/mo**
only if that happens. Live Stripe keys are not this wave. Apple Developer **$99/yr** is already
enrolled. Local smoke is **$0**.

This packet is the owner checklist. It does not merge PRs, apply SQL, or accept legal text.

## Phase 1 engineering status: COMPLETE

All engineering gates for Phase 1 are done. **Phase 2 stays OFF** until counsel returns written
answers (see §4). The only remaining Phase 1 owner action before publishing a Privacy line is
sending the counsel note — that does not block keeping Phase 1 ranking/picks live as shipped.

| Gate | State |
| --- | --- |
| Stack #39–#46 | Merged into density → `main` via [#47](https://github.com/logoitino/ala/pull/47) (`989d74e`) |
| Local ranking / hide / sheet tests | Pass ([FEED-01-phase1-smoke.md](FEED-01-phase1-smoke.md)) |
| Hosted `user_feed_prefs` | **Applied** 2026-11-14 (America/Denver) |
| Signed-in smoke A–D | **PASS** 14:37 MST — [FEED-01-phase1-signed-in-smoke.md](FEED-01-phase1-signed-in-smoke.md) |
| Guest smoke (chronological, no picks) | **PASS** 14:48 MST — same evidence file §E |
| Published Privacy Policy line | **Owner → counsel** — draft + send note ready ([FEED-01-counsel-send.md](FEED-01-counsel-send.md)) |
| Phase 2 flag (`EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS`) | **OFF** — blocked on counsel written answers |

## 1. Merge order (historical — done)

| Order | PR | Branch → base |
| --- | --- | --- |
| 1 | [#39](https://github.com/logoitino/ala/pull/39) | `cursor/popup-polls-quiz-9a86` → `cursor/ui-density-audit-9a86` |
| 2 | [#40](https://github.com/logoitino/ala/pull/40) | `cursor/vault-platform-rails-9a86` → popup-polls |
| 3 | [#42](https://github.com/logoitino/ala/pull/42) | `cursor/web-app-parity-9a86` → vault |
| 4 | [#43](https://github.com/logoitino/ala/pull/43) | `cursor/admin-portal-optimize-9a86` → web-parity |
| 5 | [#44](https://github.com/logoitino/ala/pull/44) | `cursor/app-fluidity-9a86` → admin-portal |
| 6 | [#45](https://github.com/logoitino/ala/pull/45) | `cursor/local-daylight-polish-9a86` → fluidity |
| 7 | [#46](https://github.com/logoitino/ala/pull/46) | `cursor/highlights-interest-feed-9a86` → daylight |

Density → `main` as [#47](https://github.com/logoitino/ala/pull/47).

## 2. Hosted SQL apply (done — $0)

Migration `supabase/migrations/20261114010000_user_feed_prefs.sql` applied on staging/dev.
Anon correctly denied; signed-in owner read/write verified in smoke.

## 3. Device smoke (done on Expo web)

1. Sign in → Settings → Highlights → pick sports/schools → Save. **PASS**
2. Reload → Home reflects picks / why-line. **PASS**
3. Personal feed off → no why-line (newest-first path). **PASS**
4. Hide a clip → stays out after leave/reload. **PASS**
5. Guests chronological; no picks screen; no `user_feed_prefs` traffic. **PASS**

Native iOS/Android not re-run in the Playwright session (web signed-in + guest only).

## 4. Counsel (Phase 1 companion; Phase 2 blocked)

Candidate Privacy Policy line (draft only):
[FEED_INTEREST_PRIVACY_DRAFT.md](../../legal/FEED_INTEREST_PRIVACY_DRAFT.md).

Owner send packet: [FEED-01-counsel-send.md](FEED-01-counsel-send.md).

Phase 2 (`EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS`) stays **OFF** until written answers for minors,
retention, third-party/ad ban, and “Why this clip” wording.

## Ready for next phase?

| Question | Answer |
| --- | --- |
| Engineering ready to leave Phase 1? | **Yes** |
| May turn on Phase 2 flag? | **No** — counsel written answers required first |
| Owner next action | Merge [#51](https://github.com/logoitino/ala/pull/51) evidence if not yet on `main`; send counsel note; keep Phase 2 OFF |
| Phase 2 unlock packet | [FEED-01-phase2-unlock.md](FEED-01-phase2-unlock.md) — fill counsel table, then enable sequence + P2 smoke |

Flag-off collector/ranking Jest re-confirmed 2026-11-14 (11 passed). Demo Fan **Personal feed** restored ON after smoke C (2026-11-14 15:01 MST).
