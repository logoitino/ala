# FEED-01 — ready-to-send counsel note

**Date:** 2026-11-14 (America/Denver)  
**Last updated:** 2026-11-14 14:48 MST  
**Status:** Draft handoff text for the owner to send. Not counsel advice. Not accepted policy.  
**Engineering gate:** Phase 1 code, SQL, and smoke A–E are **done**. This note is the remaining
owner action before a published Privacy line; it does **not** unblock Phase 2 by itself —
Phase 2 needs the written answers in item 2 below.

**Spend:** Sending email to counsel is outside Wave 0 product spend. Keeping Phase 2 OFF is **$0**.

Copy/paste into email or your counsel portal. Attach or link:
`docs/legal/FEED_INTEREST_PRIVACY_DRAFT.md` and `docs/engineering/DATA_PRIVACY_MAP.md` (Highlights interest picks row).

---

Subject: Tapua'i — Privacy line for Highlights interest picks (FEED-01 Phase 1)

Hi,

We are preparing to store optional Highlights feed preferences for signed-in users
(`user_feed_prefs`: sports, schools, category lean, personalization on/off).

Product facts:
- Used only to order that user's Home Highlights feed.
- Owner-only RLS; deleted with the account.
- Guests never write this table.
- Not used for ads or third-party targeting in this build.
- A later “implicit signals” ranking phase is built but **disabled** until you confirm the items below.

Engineering status (2026-11-14): hosted table applied; signed-in + guest Expo web smoke passed
(`docs/engineering/evidence/FEED-01-phase1-signed-in-smoke.md`).

Please:
1. Rewrite or approve the candidate Privacy Policy line in the attached draft for Phase 1.
2. Confirm in writing before we enable Phase 2 (`EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS`):
   (a) which view/save/hide signals may apply to minors and what guardian consent is required;
   (b) retention limits for those signals;
   (c) that no feed signal is shared with or sold to any third party or ad system;
   (d) approved “Why this clip” disclosure wording.

We will not turn Phase 2 on until we have your written answers.

Thank you.

---

## Owner send checklist

- [ ] Send the note above to counsel (you — agent has no counsel inbox).
- [x] Keep `EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS` unset / OFF.
- [ ] After counsel returns Phase 1 wording, update the published Privacy Policy (counsel-owned doc).
- [ ] After counsel returns Phase 2 answers (a)–(d), owner may authorize enabling the flag in a later change — not before.
