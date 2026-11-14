<!-- FEED-01 counsel draft for Highlights interest picks. Not accepted Privacy Policy. -->
# Highlights interest picks — Privacy Policy draft (FEED-01)

**Draft for counsel, 2026-11-14 (America/Denver). Not lawyer-final, accepted Privacy Policy,
or authority to ship to families.** This is a factual candidate for counsel to rewrite.
Bracketed fields need owner/counsel decisions. Do not treat this file as published policy.

**Product facts (from source, not legal conclusions):**

- Table: `public.user_feed_prefs` (migration `20261114010000_user_feed_prefs.sql`).
- Columns: `sports` (≤3), `schools` (≤3), `category_pref`, `personalization_on`, `updated_at`.
- Access: signed-in owner SELECT/INSERT/UPDATE only; cascades on account deletion.
- Use: order that owner's Home Highlights feed only.
- Guests: no picks storage; chronological feed only.
- Phase 2 on-device view/save/hide ranking stays behind `EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS`
  (default OFF) until counsel answers the Phase 2 items below.
- Not used for ads, paid promotion, or third-party targeting in this build.

Inventory: [DATA_PRIVACY_MAP.md](../engineering/DATA_PRIVACY_MAP.md). Evidence:
[FEED-01-phase0.md](../engineering/evidence/FEED-01-phase0.md),
[FEED-01-go-live.md](../engineering/evidence/FEED-01-go-live.md).

## Phase 1 — proposed Privacy Policy line (candidate)

> When you are signed in, you may choose sports, schools, and a Highlights category lean so
> we can order your Home Highlights feed. Those choices are stored on your account, used only
> to personalize that feed for you, and are deleted when your account is deleted. You can turn
> personalization off at any time in Settings → Highlights. We do not use these choices to show
> you ads or to sell or share them with advertisers.

Counsel must approve or rewrite the wording before it appears in any published Privacy Policy
or in-app legal summary. Until then, keep the in-app legal summary labeled as a prototype
(`LEGAL_TERMS_VERSION` remains counsel-owned).

## Phase 2 — still open (do not enable the flag)

Counsel must confirm **in writing** before `EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS` may be turned on:

1. Which implicit signals (completed views, saves, local hides) may be used for viewers who are
   minors, and what guardian consent is required.
2. Retention limits for views/saves used in ranking.
3. That no feed signal is shared with, or sold to, any third party or ad system.
4. Approved “Why this clip” disclosure wording (Phase 1 UI shows a reason line today; counsel
   still owns the published disclosure text).

The prompt author and this draft are not counsel. If counsel has not answered, Phase 2 waits.

## Owner / LEGAL next steps

1. LEGAL routes this draft to counsel with the product facts above.
2. Owner decides when to publish the approved Privacy Policy line.
3. DEVICE_QA runs signed-in device smoke after hosted SQL apply (see go-live evidence).
4. Do not enable Phase 2 collection or ranking until the written answers exist.
