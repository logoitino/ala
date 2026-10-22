<!-- Historical design decisions remain readable while current monetary instructions follow the gift release contract. -->
# Figma UI/UX polish checkpoint

**Monetary wording update, 2026-10-22:** use [VOICE](../../product/VOICE.md) and [COORD-02](../../agents/COORD-02.md).
Older individual-donation,90/10 and Donate-tagline instructions below are superseded history.
Current local-source personal gifts have zero platform cut in both flag states; optional
Tip Tapua'i/processing controls default OFF. Posted history and signed versions remain intact;
hosted rollout, net fees/settlement and final counsel/store decisions remain separate gates.

<!-- Actual local presentation handoff; distinguishes Figma operations, source review, tests and browser evidence. -->

**Reviewed:** 2026-10-15, America/Denver. **Executor:** Codex outside-session root, with engineering_review, growth_review and legal_review source reviews. These are actual session reviews, not proof of registry-pinned specialists or human counsel approval.

**Dated local first pass:** 2026-10-16 UTC (2026-10-15 America/Denver), [UX-06](../../agents/UX-06.md). The owner authorized local app polish after the Figma quota limit. Root implemented Beyond presentation; engineering_review implemented shared challenge styling and the factual admin fallback. Codex growth_review independently read that pass's six source files and updated this document. Its source/test acceptance applies to that dated version; the later Calm Island source and current handoff are recorded separately below.

**Current documentation refresh:** outside-session Codex growth_review, assigned in [COORD-01](../../agents/COORD-01.md#whole-team-refresh--2026-10-15-americadenver), checked STATE, source, retained evidence and related product/growth contracts on 2026-10-16 UTC. [TEAM_STATUS](../../agents/TEAM_STATUS.md) briefs all 107 role assignments; it does not prove every role/person executed or received a message. No source, role pin, domain approval or hosted setting changed in this documentation pass.

## Original UX-06 Figma draft

[Tapua’i Sports — UI and UX Polish](https://www.figma.com/design/TF2a8RnUhB2BhU9lEmHpql) was created through the installed Figma plugin. Inspection confirmed one empty design page and available SF Pro Text/Display fonts. Three empty variable collections were created: Tapua’i / Primitives, Tapua’i / Color, Tapua’i / Geometry. The first color-variable operation failed with the Figma View-seat monthly tool-call limit. **No variables, styles, components, screens or screenshots have been produced in Figma.** The later local app screenshots below do not populate that draft.

The connected plan is Enterprise with a View seat. Figma's returned rate-limit documentation states View/Collab seats allow up to 20 calls per month; Full/Dev seats have higher limits. Next owner: account holder connects a Full/Dev-seat account or restores quota; root resumes in this same file. No seat purchase or upgrade was performed.

The owner approved SF Pro for **admin mockups only** because Figma lacks Avenir Next. Production admin typography remains unchanged. At the original checkpoint, Meta browser readiness returned backend_unavailable for all three drivers. Root subsequently used Browser Bridge for local Expo layout captures; native device and assistive-technology verification remain open.

## Current Calm Island continuation — separate source and Figma file

The owner subsequently chose direction A in the separate [Tapua'i — Look & colour refresh](https://www.figma.com/design/cDRhK3YezniS4ODfrA8bVl) file. STATE's October 15 producer receipt records one phone screen bound to a four-mode colour collection: current, A Calm Island, B Ocean Night and C Tapa Sunset. This does not populate the original empty UX-06 draft. The current documentation executor did not inspect the new file through the plugin or independently certify its reported contrast pairs.

Current source uses warm sand-white `#F7F6F2`, ink `#14191B`, brand jade `#0B6E4F`, gold ink `#7F5A00` for awards and LIVE/error ember `#C8102E`. Fan-tab accents are jade with Spotlight's award accent gold; the bar uses one jade active accent and deep-jade Upload. Shared FilterPills/Beyond/game-alert chips use ink fill with white text when selected and white outlined idle controls. Tab pages no longer mount MenuBackdrop; sheets retain one noninteractive wash. Existing heading punctuation remains. Aura tier colours, admin report palette and Next portal were not part of this colour refresh.

The narrow source read confirms `FOCAL`, `LIGHT_COLORS`, `DAYLIGHT_THEME`, the runtime Daylight preset, fan-bar/chip styles and Beyond/legacy plus ChallengeInbox/Settings read-control visibility. ChallengeBar and composer still retain their existing unavailable notices/disabled refresh controls; do not describe every challenge refresh as hidden. Source permissions, paused contributions, required consent and optional profile support are unchanged by the documented presentation scope.

### Current evidence, publication and next owner

- Retained Browser Bridge images exist under `.smoke/redesign/before/` and `after/` for Home, Beyond, Activity, Profile, Local, Spotlight and Drip, with Look captures `look1.png`/`look2.png`. Their existence is not a matched-state, native, large-text or assistive-technology acceptance. STATE attributes these captures to the producer; this documentation read did not repeat browser interaction tests.
- STATE records the producer's Calm Island `pnpm check` EXIT0, 148 suites/1,188 tests and included guards. The independently inspected `.smoke/detection/latest.json` is still the earlier UX-06 run below and predates this new source. Root owns the final COORD-01 full check and independent semantic acceptance; no new suite run is claimed here.
- STATE's dated read-only environment observation reports older published colours overriding five runtime theme fields. The current source confirms the Daylight preset is a draft until published. ADMIN/DESIGN with the owner must review and authorize any Look → Daylight publication per environment; this documentation pass does not publish or recheck hosted/staging settings.
- DESIGN/ACCESSIBILITY/QA own current configured-state and native rendered review. Highlights/Activity/Profile/checkout polish, fan-zone admin range/export/Product integration and generic fan-voting/trivia remain separately scoped work. Existing legal, youth, money, hosted and release gates remain open.

Current key source identities read during this refresh: `theme/motion.ts` SHA-256 `55c3aee0303fa00d574b069887c13005e1ed8cb00b1d5d6137fb13afe351cd9b`; `constants/theme.ts` SHA-256 `7fcfc7c4868d61d97beb75046910cbedd8b04688e45c875102b63fa69f813d35`. These identify the current source read; they do not extend the old UX-06 test manifest to changed files.

## Historical completed local first pass — UX-06

| Surface | Implemented presentation | Source boundaries retained |
| --- | --- | --- |
| Beyond browsing | Compact wrapping category chips; token-based headings, cards, notices and action variants; athlete-profile discovery before shared moments and private history/export sections. | Four existing categories and routes; canonical actor/focus/read lifetimes; explicit loading, source error, paused and page-empty states; Share a moment only with current source permission. |
| Contribution composer | Your moment, Who can see it and Before you submit sections; readable caption/media controls, character count and two separate full attestations; primary Submit for review. | Friends default; teen/unknown accounts friends-only; initially unselected rights/safety choices; staff review before sharing; existing in-memory draft and frozen request/file retry; removal/cleanup truth. |
| Workouts and service | Readable legacy athlete cards with a primary athlete-profile action; existing challenge buttons/feedback use Island Daylight styling and minimum 44-point dimensions. | Profile is the actual discovery/support destination; self-report and private noncash progress; voluntary service; existing selected/disabled, actor, target and callback checks. |
| Admin publication notice | Missing timestamp now says: “No publication timestamp is available. Check the published controls.” | Publish/discard behavior unchanged; absence of a timestamp does not imply all controls are on. |

No new query, storage, permission, runtime switch, payment, report or telemetry is introduced by this patch. Donation composition and the PLAY-01 player were outside the assigned source scope. The current audience buttons use checkbox adornments; a later radio distinction for mutually exclusive Friends/Everyone is a nonblocking design suggestion and is not implemented here.

### Dated UX-06 evidence and limits

- Root's retained `pnpm detection:scan` finished EXIT0 at **2026-10-16T03:10:51.087Z**, run `2026-10-16T03-09-23-674Z-0de446e6-final`, in `.smoke/detection/latest.json`: 148 mobile suites/1,188 tests, 86 Next portal tests, both types and included guards; docs:links 212. No checks skipped or failed. Its 15 existing sensor gaps and `runtimeVerified: false` remain explicit.
- Root reported the focused Beyond run: two suites/20 tests passed. Engineering's retained `UX-06-engineering-focused.log` records two existing Challenge/Admin suites/36 tests passed; its mobile typecheck exited 0. These results were inspected/reported, not rerun by growth_review. Existing AdminChrome tests have no missing-timestamp-copy assertion; that exact string was verified by source/diff review.
- Root captured local `/beyond` at 390 and 320 CSS pixels. Root reported wrapping chips, measured 44-pixel control heights and no horizontal overflow. Growth independently inspected `/tmp/tapuai-beyond-after-320-final.png`, confirming visible wrapped chips and athlete discovery hierarchy. Retained images are [390 baseline](../../../design-preview/ux-06-beyond-before-390.png), [390 after](../../../design-preview/ux-06-beyond-after-390-paused.png) and [320 after](../../../design-preview/ux-06-beyond-after-320-paused.png). Root viewed the 390 pair together; source states differed, so this is not a complete matched-state visual regression. No composite image was produced.
- The local preview lacks configured Supabase environment/migrations, and hidden-tab lifecycle intentionally pauses sources. Earlier transport-only/background clicks did not verify a functional result. Root subsequently observed a visible-page Learning & STEM click: after 150 milliseconds, the workout heading was absent and the page remained visible. A later visible Workouts click restored that heading and the two exact unavailable-migration alerts. These verify those two local category switches. Approved/own posts, composer, native devices, keyboard/screen reader use and hosted behavior need their own evidence.
- Original BEYOND/CHAL admin-first chronology remains intact. Root subsequently reported the selected UX-06 app-ready gate EXIT0 with actual app evidence timestamp **2026-10-16T03:14:52.634Z**, after the presentation exemption checkpoint. This reviewer did not execute that command or issue its metadata; root owns final status/evidence integration. No SQL application, campaign, launch, counsel decision or live money follows from local readiness.

### Historical UX-06 source identities

All paths below are relative to `apps/mobile/src/frontend/components/` in MAIN. Codex growth_review read these files at the UX-06 acceptance checkpoint and computed those SHA-256 identities. Later Calm Island edits supersede several entries; this preserved table is not the current source manifest. No production source was edited by this reviewer.

| Source | SHA-256 |
| --- | --- |
| `BeyondGame/BeyondGameScreen.tsx` | `d422ada92c8e4c8be99e70f7a4fcd3497a23ce43821c4f43c57e2fd74e12b89c` |
| `BeyondGame/BeyondGameComposer.tsx` | `26da644df2a2424688631d54c0fd49bb30dfc04f929a36bfe4785fefecb50ac5` |
| `BeyondGame/BeyondGameStyles.ts` | `9d3f28fcaf6639326bc51540947427dca3a63629dc9468d892814cc641362adf` |
| `BeyondGame/LegacyWorkoutList.tsx` | `462e519a00cb599576296bfe984f557d8061d1179b0b84a72a64ea70f083f00d` |
| `Challenges/ChallengeControls.tsx` | `c37c09b4842ad42aebb1601f49f7bcda9b33dd56c1435ada55e87659035ed757` |
| `Admin/AdminChrome.tsx` | `637b120f643844f086c68f6f388e166dd6116fb549ab736b73cf65a3ce80dfcf` |

## Remaining proposed polish, grounded in current MAIN source

| Surface | Design work to perform | Preserve |
| --- | --- | --- |
| Shared fan controls | Extend the scoped token/action hierarchy to other approved surfaces after actual rendered review. | Accessible labels, selection/disabled states, reduced-motion behavior and focus/draft lifetimes. |
| Beyond follow-through | Validate current approved/own posts, full composer and empty/paused states with controlled source fixtures; consider category-specific introduction and radio audience adornments. | Highlights remains the game showcase; no fan-post recipient association; full consent and current source/actor gates. |
| Highlights / Activity / Profile | Improve existing empty-state hierarchy and make permitted discovery/friend/workout options legible. | Existing navigation, protected media ownership, account gates and private settings. A new discovery CTA needs a verified existing destination and implementation review. |
| Donation review | Prioritize named recipient, sports-cost purpose, exact quote and final total within the established Amount / Options / Review sheet. | 90/10 disclosure; existing tax notice; optional tip for Tapua’i starts at No tip; uncertain-payment state must not encourage another charge. |
| Expo admin | Clear desk search/lenses, draft-versus-live controls, publication state, report source disclosures and repair navigation. | Expo is the production write plane; preserve review/publish/discard semantics and protected roles. |
| Next admin | Keep wide report headers, underline tabs, open panels, accessible data disclosures and current read-only links. | Read-only oversight; Avenir Next in production; no mock publish/toggle authority. |
| Timed trivia | Future proposal: optional invitation, Start reveals question and starts timer; standard 30 seconds with longer accessible option selected beforehand. | Explain leaving the app ends the round; no cheating-detection/app-switch-prevention claim. No MAIN participant trivia implementation was found. |

## Source issues and capability gaps for the design review

1. The original weak inline/outlined hierarchy in Beyond/composer/challenge controls was addressed by the scoped UX-06 source patch above. Rendered review of active contribution/private-history states remains open.
2. Highlights empty copy and Activity empty copy lack clear guidance for casual fans and friends. Growth recommends useful non-donation actions tied to actual permitted routes.
3. The original `AdminChrome.tsx` all-on fallback was corrected in UX-06. Broader admin polish is still proposed; the string correction does not integrate the separate-worktree reports or Product workspace.
4. Current MAIN Product/Reports mounts do not include the earlier fan-zone Product workspace, saved views, custom report date ranges or CSV/XLSX controls. Treat those as unintegrated work/proposals until their source and ownership are reconciled. Do not copy or merge the separate worktree without a scoped handoff.
5. Expo Health has Overview plus Where/Buttons/Errors and thirteen operational checks. Next Health has Where/Buttons/Errors/Menus. Health reports sampled observations; it does not establish complete traffic accounting, billing, legal clearance or release readiness.
6. Removal copy must distinguish hidden, cleanup queued and independently verified deletion; issued/downloaded files cannot be recalled by hiding a post.

## Source and resume path

- Mobile source: `apps/mobile/src/frontend/constants/theme.ts`, `theme/motion.ts`, `components/UI/FanTabBar.tsx`, `components/UI/MenuChrome.tsx`, `components/BeyondGame/`, `components/Challenges/`.
- Admin source: `apps/admin-portal/app/globals.css`, `app/(protected)/product/page.tsx`, `app/(protected)/operations/page.tsx`; mobile `components/Admin/AdminChrome.tsx`, `components/Admin/Reports/`, `components/Admin/Support/SupportScreen.tsx`.
- Existing feature contracts: [Beyond the Game](BEYOND_GAME_DESIGN.md), [implementation plan](BEYOND_GAME_IMPLEMENTATION_PLAN.md), [BEYOND-01](../../agents/BEYOND-01.md), [CHAL-01](../../agents/CHAL-01.md).
- Root/DESIGN owns the remaining Highlights/Activity/Profile and donation design scope plus final UX-06 registry/STATE/menu-map status. QA/DEVICE_QA and ACCESSIBILITY own actual controlled-state, native and assistive-technology evidence. The earlier admin worktree needs a separately owned source/integration handoff; no wholesale copy or merge is accepted here. GROWTH_ANALYTICS brings voluntary fan return, athlete-story discovery, support friction and missing measurements to the existing October 20 packet through MARKETING → CTO → owner; this polish creates no new collector or claimed conversion/retention result.
- After access is restored: inspect the existing draft, finish scoped tokens, create reusable components, build and screenshot each selected flow, then obtain a concrete visual review before broader implementation. Register the presentation-only exemption before source polish; new capabilities retain admin-first gates. Actual source changes require same-turn STATE and retained detection evidence.

**Original checkpoint history:** actual plugin creation/inspection and explicit rate-limit failure; three completed source reviews. No source code had changed at that point. **Dated UX-06 continuation:** local implementation, tests/layout evidence and independent acceptance apply to the six historical identities above. **Current COORD-01 refresh:** the assigned documentation executor changed only the four claimed documentation/role-body paths, with current source/provenance gaps and next owners recorded; final semantic acceptance and root checks are separate. The original Figma draft remains empty, the separate colour file has producer-reported work, and broader polish/release acceptance remain open.
