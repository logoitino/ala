# FEED-01 Phase 2 unlock checklist

**Date:** 2026-11-14 14:59 MST (America/Denver)  
**Status:** Engineering prep only. **Do not** set `EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS=1` until
every counsel checkbox below is checked with a dated written answer.  
**Spend:** Keeping the flag OFF is **$0**. Enabling it later is still Wave 0 / free env unless
Expo free build quota runs out or Supabase Free pauses (Pro ~$25/mo). Live Stripe keys are not
this wave.

Phase 1 engineering is **COMPLETE** ([FEED-01-go-live.md](FEED-01-go-live.md)). Phase 2 code
(on-device view/save/hide collectors + ranking bonuses + Phase 3 diversity when the same flag is
on) already lives behind the flag. Flag-off Jest: collectors write nothing; ranking Phase 3 is a
noop (`feedPrefs.collectors.test.ts`, `highlights.feedRanking.test.ts` — re-run 2026-11-14,
11 passed).

## Counsel must answer in writing (owner receives)

From [FEED_INTEREST_PRIVACY_DRAFT.md](../../legal/FEED_INTEREST_PRIVACY_DRAFT.md) / send note:

| # | Question | Answer received? | Date / citation |
| --- | --- | --- | --- |
| 1 | Which view/save/hide signals may apply to **minors**, and what guardian consent is required? | [ ] | |
| 2 | **Retention** limits for views/saves used in ranking | [ ] | |
| 3 | No feed signal shared with / sold to any **third party or ad** system | [ ] | |
| 4 | Approved **“Why this clip”** disclosure wording (published) | [ ] | |

Owner send packet (copy/paste): [FEED-01-counsel-send.md](FEED-01-counsel-send.md).

## After counsel answers — engineering enable sequence

Do these in order. Do **not** skip smoke.

1. Owner records the four answers in this file (or links a counsel email receipt in LEGAL).
2. Owner authorizes the env change (Facilitator).
3. Set `EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS=1` only in the intended env (local / preview first;
   never invent production).
4. Rebuild preview if needed ($0 until Expo free quota ends).
5. DEVICE_QA Phase 2 smoke (below).
6. Update `docs/STATE.md` §4 + this file status to **ENABLED** with commit/env evidence.
7. Phase 3 diversity is the same flag — confirm caps on a ≥20-clip feed before claiming pilot
   metrics (Phase 0 seed is only 5 rows).

## Phase 2 smoke (run only after flag ON)

| # | Check | Pass? |
| --- | --- | --- |
| P2-A | Signed-in: complete a view (≥3s) → AsyncStorage view touch present; guests still write nothing | |
| P2-B | Save a Highlight → save touch present; hide (non–coach-level) → athlete demotion path behaves per design | |
| P2-C | Home order moves with touches; money still never ranks | |
| P2-D | Why-line matches counsel-approved wording | |
| P2-E | Flag back OFF → collectors stop writing; old local history policy per counsel retention answer | |

## What is already true with the flag OFF

- Phase 1 picks / personalization / hide / guest chronological — shipped and smoked.
- Collectors do not persist behavioral history.
- No ads / third-party feed targeting in this build (product fact; counsel still confirms for Phase 2).

## Out of scope until counsel + owner

- Enabling the env flag in any hosted project.
- Publishing Privacy Policy text without counsel rewrite/approval.
- Claiming Phase 0 diversity shares on the 5-clip Wave 0 seed.
