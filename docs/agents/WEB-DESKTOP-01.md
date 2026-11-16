# WEB-DESKTOP-01 — Desktop web layout (design proposal)

**Status:** **FINISHED** (shell PR #54 + card-feed PR #55). Owner merges #54 then #55.  
**Receipt:** [WEB-DESKTOP-01-finish.md](../engineering/evidence/WEB-DESKTOP-01-finish.md) · [WEB-DESKTOP-01-card-feed.md](../engineering/evidence/WEB-DESKTOP-01-card-feed.md).  
**Lovable:** [Tapua'i Web Desktop](https://lovable.dev/projects/55b66713-1e11-484e-a8a9-7520ad55b7eb) (3 credits, 2026-11-15) — reference outline (W4); live center is Expo cards, not SAMPLE stubs.  
**Depends on:** [WEB-DESKTOP-AUDIT.md](WEB-DESKTOP-AUDIT.md) (Phase 0 measured 2026-11-15).  
**Prior shell:** Extend `WebAppShell` (phone column today) — see audit §1. Do not add a second shell.  
**Related:** [WEB_APP_PARITY.md](../engineering/design/WEB_APP_PARITY.md) (Phase 1 Stripe.js + phone column — shipping history, not the three-panel target).  
**Spend:** Docs **$0**. Lovable prototype uses workspace credits — **price not listed** in ROADMAP Wave 0 table (confirm vendor plan). Preview rebuild **$0** until Expo free quota ends.

Owner ask (2026-11-15): on website, use the whole browser — Facebook-style, multiple panels at once — without changing the mobile app, money rules, or VOICE wording.

---

## Owner decisions (FACILITATOR)

| ID | Decision | Options | Owner choice | Date |
| --- | --- | --- | --- | --- |
| **W1** | Three-panel map + breakpoints | Approve as written below / revise map / defer | **Approve as written** | 2026-11-15 (continue) |
| **W2** | Panels per role | Approve table below / revise | **Approve table as written** | 2026-11-15 (continue) |
| **W3** | Right-rail launch set | Live + Boosters + Vault preview + school; or smaller set (name which) | **Live + Boosters + Vault preview + school + Drip peek** | 2026-11-15 (continue) |
| **W4** | Lovable | Build target vs reference-only; zip missing from git — supply path? | **Reference-first prototype** (greenfield; zip still missing from git); repo extends `WebAppShell` — Lovable is not a live fork | 2026-11-15 (continue) |

---

## Proposed layout (W1)

### Shape

```
≥1280 px
┌──────────┬─────────────────────┬──────────────────┐
│ Left rail│ Center (~600–680)   │ Right rail       │
│ nav + HQ │ Highlights feed     │ Live & close     │
│ + Crew   │ picks + Why clip    │                  │
└──────────┴─────────────────────┴──────────────────┘

820–1279 px
┌────┬─────────────────────┐     Right → toggle drawer
│icon│ Center feed         │
│rail│                     │
└────┴─────────────────────┘

<820 px
  Current mobile web/native: bottom FanTabBar, unchanged density.
```

### Breakpoints (build order: desktop → tablet → preserve phone)

| Width | Layout |
| --- | --- |
| **≥1280** | Three panels |
| **820–1279** | Two panels: left collapses to icons; right becomes a toggle |
| **&lt;820** | Mobile layout unchanged (same tabs, bottom bar, density). Note: today web still clamps to 430 even at 820 — Phase 3 must not regress native; web tablet behavior follows W1 |

Touch targets stay **44** on touch. Pointer-only desktop chrome may go to **32** minimum where platform is genuinely pointer (never below 32).

### Left rail — navigation and shortcuts

Links (not a bottom bar): Highlights, Local, Spotlight, Drip, Activity, Receipts, Profile; role HQs the signed-in user has (Athlete / Parent / Booster / Admin); Crew shortcuts (followed athletes). Collapses to icons below 1280; hides below 820 (mobile bar takes over).

**One honest line:** “Jump to every fan surface and your role desk without leaving the desktop chrome.”

### Center — the feed

Highlights with explicit picks and “Why this clip”; readable column **~600–680 px** (not a full-width video river). Main tab stays the main tab — feed is center, never a sidebar. Gift / Vault / booster checkout overlays open here or as modals — never a sticky money rail.

**One honest line:** “Watch and personalize Highlights the same way as Home today, with room to read.”

### Right rail — live and close (W3)

Default launch proposal: Live matchups, Top Aura Boosters, Vault locked preview (clip count per V2 when available), founding-school booster page entry, Drip peek. Things a fan checks between clips without leaving the feed.

**One honest line:** “See live Local and nearby support surfaces while the clip stays put.”

If a line cannot be backed by real data for a panel, that panel stays out of launch (audit §3).

---

## Roles (W2)

| Role | Left | Center | Right | Notes |
| --- | --- | --- | --- | --- |
| **Guest** | Highlights, Local, Spotlight, Profile/Sign-in | Public feed (browse-first Soft-Wall) | Live + Boosters (public); no private Vault contents | Soft-Wall first action, never a paywall as first screen |
| **Fan** | Full fan links + Crew | Feed | Live, Boosters, Vault preview of focused athlete when known, Drip if on | Give stays on athlete/gift surfaces, not a Give on Vault |
| **Guardian / Parent** | + Parent HQ | Feed | Same as fan; custodial stays in HQ / overlays | Money honesty unchanged |
| **Athlete** | + Athlete HQ | Feed | Vault preview of **own** vault state | Vault screen never carries Give |
| **Booster** | + Booster HQ | Feed | School / booster page prominent | Program **Donation** web-only checkout |
| **Admin** | + Admin link into Expo `/admin` | Prefer not to force admin desks into fan right rail | Admin stays Expo `/admin` + Next portal | Do not merge admin-portal into fan shell |

---

## Where money sits

| Flow | Where | Rules |
| --- | --- | --- |
| Athlete **Gift** | Center overlay / existing TipSheet → Stripe.js | 0% cut; tip optional never preselected for pilot; VOICE |
| Vault **Exclusive** | Center / existing Exclusive paywall → Stripe.js | V1–V6; no Give on Vault |
| Booster / school **Donation** | Web checkout only (existing) | Never invent in-app store loophole |
| Tip Tapua'i / fee cover | Existing options step | Optional; fee ≠ tip |

No new payment surface in Lovable or this shell. Keep `WebPaymentSheetHost` / `stripe.web.ts`.

---

## Implementation sketch (Phase 3 — after W1–W4)

1. Branch from tester HEAD; snapshot first.
2. **Extend** `WebAppShell`: when web && width ≥1280 (or approved breakpoints), render left | center | right; when &lt;820 keep current phone behavior (remove accidental 430 waste on web tablet only if W1 says so — native untouched).
3. Wire panels to **real** hooks/data (`useLiveScores`, boosters, feed ranking with money never ranking, Vault preview counts). No invented athletes/counts.
4. Preserve Soft-Wall, Stripe.js, density tokens, brand fonts.
5. Verify: `pnpm check`, `pnpm copy:check`, VOICE on new lines; smoke at 1920 / 1440 / 1280 / 820 + phone regression; before/after width table vs audit §2.

Out of scope: VOICE.md rewrite, tip model, feed Phase 2 flag, Aura-from-giving, tagging/RLS, new agent roles.

---

## Phase 2 — Lovable (after W1–W4)

1. Paste guardrails (gift ≠ donation; tip never preselected for pilot; Oct 24 direction / formal decision still open — do not call it settled law).
2. Paste this design.
3. Prototype only: no live keys, no real writes, sample athletes labeled as samples.
4. Review at 1920 / 1440 / 1280 / 820 vs audit width table; fix brand/density drift in Lovable before repo port.
5. **W4:** if zip still missing, prototype is greenfield from this doc + LOVABLE_UI_UX_PLAN — say so in the Lovable session.

**About to spend (when Phase 2 starts):** Lovable workspace credits — **price not written** in `docs/product/ROADMAP.md` Wave 0 table; confirm on Lovable billing before running. Expo/Supabase/Stripe test remain free this wave.

---

## Accessibility (done criteria for build)

Keyboard order: left → center → right. Visible focus. Screen reader follows that order. Public feed and Give (on gift/athlete surfaces) never hidden behind a paywall.

---

## Open (not decided here)

- Counsel: FEED-01 Phase 2; gift/Aura/store claims; tip never-preselected formal close.
- Owner: W1–W4; Lovable zip path; whether web tablet (&lt;900) should stop clamping to 430 before three-panel ships.
- APP-TEST A–C and iOS ad hoc install remain the active app-test queue alongside this design track.
