<!-- Current shared UI source coverage is separate from dated rendered/native acceptance. -->
# Menu and page style coverage

**Current source alignment:** 2026-11-23 — [UX-19](../agents/UX-19.md) compact consistent fan tabs: one `SECTION_HEADING`, one frosted adaptive fan bar, segment tracks and grouped Activity rows (local source + web captures); [UX-18](../agents/UX-18.md) owner-targeted44pt bars and compact Activity panels locally accepted; [UX-17](../agents/UX-17.md) existing-record directory/selector and distinct poll palette accepted. Current737-source ledger/718 same-byte inherited reviews/19 current changed-new reviews; source review is separate from device/provider or every-function execution. Earlier UX16/13/12/10/06 records remain dated history. Whole-app [LOVABLE_UI_UX_PLAN](design/LOVABLE_UI_UX_PLAN.md), shared Figtree/body14/caption12 and44pt actions remain the standard. Owners: `DESIGN`, `CHECKOUT`, `UPLOAD`, affected surface squads;
`ACCESSIBILITY`, `DEVICE_QA` review; `DOCUMENTATION` keeps this map current.

This is a source inventory of shared presentation coverage. It is not a rendered-device audit.
Every modal-bearing component is listed, including intentional full-screen video/celebration
surfaces. A shared primitive can update many consumers without each file needing a local edit.

Current cross-team direction and assignments: [TEAM_STATUS](../agents/TEAM_STATUS.md); actual documentation/coordination claims and checks: [COORD-01](../agents/COORD-01.md#whole-team-refresh--2026-10-15-americadenver). The 107-role briefing is assignment coverage, not execution or human delivery. The [UI checkpoint](design/UI_UX_FIGMA_POLISH.md) separates the original empty Figma draft, later colour file, local source and rendered evidence.

## UX-21 public profiles and video (2026-11-24)

[UX-21](../agents/UX-21.md) keeps the public photo viewer separate from the owner's picker. Highlight video names use the compact section style, and the reaction controls remain in their own rail. [POST-EDIT-01](../agents/POST-EDIT-01.md) uses one description editor for the Highlight overflow and Beyond's My posts list.

## UX-20 Activity density (2026-11-23)

[UX-20](../agents/UX-20.md) updates the existing Notifications and Your updates panels only. More/Less has its own 44pt box in the header. The inbox track and grouped gift rows keep separate actions, full wrapping text and exact amounts.

## UX-19 compact fan tabs (2026-11-23)

| Surface | Source | Current presentation |
| --- | --- | --- |
| Section headings (Activity, Local, Spotlight boards, Profile Story/Highlights, Notifications, Home kicker) | `theme/fonts.ts` `SECTION_HEADING` | 16/21 Bricolage Bold; Home keeps electric gold on the dark feed |
| Fan page header | `ScreenHeading` | Fan kicker badge on the title row, 32pt underline; role headings unchanged |
| Fan bar | `UI/FanTabBar` | One frosted bar: dark glass on Home, light elsewhere; no per-tab faces; sliding mist pill; 24pt fade above; softened floor 0.78; 44pt targets |
| Notifications | `Activity/NotificationInbox`, `UI/MoreText` | Inbox/Archived segment track, icon Refresh overhanging its line, inline More on the text line; 10/12 padding, shadow only |
| Activity updates | `app/(tabs)/activity.tsx` | One card, hairline-divided rows (10/12 padding) |
| Local | `local/index.tsx`, `Local/LocalHubMenu`, `UI/FilterPills`, `Local/GameCard` | Hub segment track; borderless jade-mist chips; score card HOME/AWAY on team line, venue + boosters one row, shadow only (live keeps ember outline) |
| Spotlight | `Spotlight/LeaderboardsBoard`, `SpotlightAwardCard` | Board chips on one scrolling row (gold-mist, gold selected); borderless rows |
| Profile | `Profile/AthleteProfileView` | Borderless 12pt Story card; compact jade-mist Share |

Text stays 14/20 body and 12/16 captions. Native phone feel and large system text on a device remain owner checks.

## UX-17/18 current bounded acceptance

UX18 supersedes UX16 default46pt dock/feed surfaces with44pt measured controls; the web dock wrapper is50pt including6pt safe footer. Glyph18/Upload16 and22pt disc reduce decoration; Search16 remains inside44pt. Outline edges are absolute and compatible with SDK58 generated RN types. Labels remain12/16 and14/20 Figtree, scalable and wrapped; actual dock94pt under label-only2x at320px demonstrates measured growth rather than clamping. Current390/320 renders have no horizontal overflow and44pt actions. Larger web widths use the existing desktop layout; mobile-height/physical gesture checks remain distinct.

Activity uses6/10pt row padding,30pt decorative icons,14pt titles/amounts and12pt sent-school/time metadata. Thanks/received-gift/tag instructions stay14/20. Inbox padding8/gaps4 and an opt-in inline ordinary explanation remove excess whitespace; other MoreText consumers keep their default stack. Required notices/full body copy and read/archive/refresh/snapshot actions remain. Current320/390 rendered Activity shows honest backend notification-unavailable state. Actual web programmatic scroll advances109px, and More/Less exposes the full explanation; this does not prove Android dragging. At667x320 with all existing Home banners expanded the recovery viewport is18px; the44pt existing scoreboard dismissal remains available. Do not claim that capture fully displays recovery text.

UX17 distinct jade/violet polls preserve5 existing cases and accepted current390 rendering. Existing-source admin99/6 checkpoint precedes participant browsing and optional pending roster selection; independent38 mounted participant cases and serial-save/current-actor/partial-retry checks pass. New directory remains within Local scrolling content and profile choice remains optional; no import, generated identities or automatic verification. Current public catalog10 loaded rows and one school empty-state are observed, not global enrollment or hosted RLS evidence.

Final local integration passes329mobile suites/3116tests,217portaltests, bothTypeScript checks, optimized Nextbuild and currentAndroid/iOS HermesJS exports. SDK overlay correction and old FunFactStep optional-null assertion repairs retain their actual original failures. Full gate stops only at2 unannounced Exit areas; tracked acknowledgement requires new session confirmation. Current737-source ledger retains718 exact-byte prior reviews and19 changed/new source reviews; no native/provider/Instagram parity or execution of every function is inferred. See UX17/18 for original receipts and remaining boundaries.

## Home and Local search

Web desktop/tablet rail now has a dark welcome-style brand header and an expandable Account settings section. The icon rail keeps named buttons, and the full-width rail wraps labels. Existing profile/privacy/notification/capability/legal/deletion panels retain their own validation and writes. The web shell still passes native children through without mounting either rail.

The web workspace follow-up replaces the sidebar action list with a centered overview up to 960px wide. Profile, preferences and account-management cards explain their destinations. Existing Highlights preferences is exposed only while Home is enabled, and its saves continue broadcasting to Home. Closing detail returns to the overview. Scoped web account frames grow to a 760px maximum; standard/native frames and deletion presentation remain unchanged.

Earlier sidebar verification showed the full settings list at desktop width, Notifications opening and closing, and a named 51×52px settings control at 900px without horizontal overflow. At 390px the left rail and its settings control are absent. Local validation passes 336 mobile suites / 3,181 tests, both type checks and the repository check using this checkout's owned source-sync folder.

Current workspace verification: Demo Fan overview renders at 1728px; at 900×600 the overview body scrolls (410px viewport / 681px content), Sign out is reachable and Close remains 44×44px. Notifications measures 760px wide with no horizontal overflow and reports its actual unavailable-source error. Privacy loads in a 760×552px frame and Escape restores the overview; Highlights preferences opens in a 760px frame; its nested picker has a scrollable 322px body and a separately scrollable sports list at 900×600. The checkout-scoped full repository check passes, including 337 mobile suites / 3,185 tests. This is existing-settings presentation work; Codex performed scope, source and documentation review. No new permission, persisted record or operational duty; phone geometry is retained. Hosted delivery and physical phone acceptance are separate.

The compact search field shares icon, type, and close-button spacing across Home's video bar and Local's light header. Recent searches use consistent icon and text columns, growing rows for long labels, and 44pt row and Clear all targets. Local opens recents on focus; Home and Local keep their respective result filters and navigation. Both search drawers use virtualized result rows. See [the device checks](TESTER_SCRIPT.md#home-and-local-search--phone-layout-and-history).

Local web checks at 320px and 390px used three synthetic terms. A long query wrapped while the icon and text columns stayed aligned, standard rows and the Clear all target measured 44px, and there was no horizontal overflow. Android keyboard and font scaling still need a phone check.

## UX-13 review and implementation scope

All724 runtime modules/107 routes have current source-hash review evidence, including43 direct native Modal hosts/44 sites.140 presentation decisions normalize existing Figtree/Bricolage text hierarchy and spacing across Highlights, Local, trivia, challenges, rallies, profile/account, checkout, admin, operator, verification and guardian panels. Smaller decoration leaves readable text and44pt actions; names/labels wrap and long content scrolls within bounded cards. Required rights, consent, fee and safety text remains explicit. ScreenShell's appropriate existing geometry was retained.

Actual local browser fixtures supply18 captures of eight current menus at390×844 and320×568/doubled CSS text, plus short-landscape Legal and Coach move. Captured controls meet44pt minima without horizontal or non-scrollable text clipping. Synthetic Upload Highlight and Coach Close callbacks passed; provider/payment/guardian submissions were not executed. The fixture route is removed. Final mobile314-suite/2,915-test coverage,156portaltests, current Hermes exports and independent ordinary-flow reviews are recorded in [UX-13](../agents/UX-13.md).

These source/fixture/regression results do not measure Instagram parity, native Dynamic Type, physical-device focus/motion, or real provider delivery. Whole-file review depth, AST function inventory and instrumented execution72.19% remain distinct. Original failed/unsupported invocations and the routed Drip size/variant fulfillment-contract gap are retained in the handoff.

## UX-12 current source and verification scope

Highlights rail uses a56pt minimum column with44pt action targets instead of a68pt column; upload-choice decorative icon discs32pt instead of40pt. Reel More, Report and Upload choice bodies are bounded scroll regions with reachable dismissal. Local sponsor/booster avatars are32pt; names and poll vote labels wrap; booster peek uses48pt decoration and a fixed Close. Trivia uses readable brand type with smaller celebrations/progress and lighter cards; timer, consent, answer and Reduce Motion logic are unchanged. Pinned play navigation uses the same destinations; whole buttons wrap at enlarged text without shrinking labels. Shared TYPE raises body13/18→14/20, section15/20→16/21, caption11/15→12/16 and title20/24→20/26.

This supersedes the older density-pass typography figures for touched/shared consumers. It does not change the approved palette, required notices or existing product navigation. Actual browser fixture captures and independent outside review are recorded in UX-12; real native Dynamic Type/motion and measured Instagram parity are separate unverified checks. Payment/consent behavior is covered by existing functional gates, not a new device/payment claim.

## Shared API and design rules

| API | Purpose |
| --- | --- |
| `UI/Kit.tsx` + `constants/theme.ts` → `KIT` | Whole-app action kit (owner 2026-11-04, [LOVABLE_UI_UX_PLAN](design/LOVABLE_UI_UX_PLAN.md)): KitButton variants, KitChip, KitBadge, LivePill, KitProgress; control12 / card14 / sheet20 radii (current source); all button sizes44pt minimum; labels wrap and badges grow with text |
| `constants/theme.ts` → `MENU_METRICS` | Sheet20px, card14px, control12px radius (current source); 44px touch-target reference |
| `UI/MenuChrome.tsx` → `MenuBackdrop({ accent? })` | Non-interactive single soft wash for popup sheets (no dot accents since 2026-10-15); hidden from assistive technology. Tab pages (`TabScreen`, `ScreenShell`) no longer draw it. |
| `UI/MenuChrome.tsx` → `MenuStepIndicator({ labels, current })` | Named, non-clickable step chips; one-based current stage announced to assistive technology |
| `hooks/useSheetFrame.ts` | Centered sheets up to 440px, compact gutters, home-indicator clearance, common radius/border/shadow |
| `hooks/useFanSheetMotion.ts` + `theme/motion.ts` sheet tokens | One open (`SPRING_SHEET`) / close (cubic dismiss) contract for fan bottom sheets; Reduce Motion timing branch. Profile menu settles before nested Soft-Wall. |
| `ScreenShell.tsx` / `TabScreen.tsx` | Calm Island light page canvas without MenuBackdrop/corner decoration; dark video layouts retain contrast |
| `ScreenHeading.tsx` | Wrapping screen header, readable supporting text and decorative accent; published text/gold and caller accent remain authoritative |
| `UI/FanTabBar.tsx` / `UI/AnimatedButton.tsx` | Absolute measured floating fan dock, wrapping labels, selected/disabled semantics,44-point targets and OS Reduce Motion; Home media extends behind it, normal TabScreen reserves actual dock height. |
| `UI/SportIcon.tsx` / `theme/motion.ts` | Decorative installed sport marks beside visible text; neutral fallback, custom volleyball seams; destination ink/mist accents preserve primary field artwork and reward semantics. |

Donation uses Amount → Options → Review in the same popup. Upload uses Video → Details →
Review with optional settings/selection subpages. Persistent navigation stays outside page
scrolling; Back keeps choices and only the final reviewed action starts upload/payment.
Financial disclosures and rights confirmations remain explicit. Closing blocks a new payment,
and payment success remains terminal if recording or counters fail. Replacing an inline recipient
suppresses the previous checkout’s completion and external callbacks. Reduced motion, large text,
keyboard fit and screen-reader behavior require device evidence.

## Modal component inventory

Reconciled direct native Modal inventory: **43 source modules / 44 Modal sites** at the UX-13 baseline. The broader inventory also tracks 62 modules referencing modal/sheet/overlay components; those wrappers are reviewed with their callers. `AthleteProfileView` is an indirect consumer, not an additional native Modal host. Counts include deliberate full-screen video, web payments and menu chrome; source review does not prove native fit.

| Component under `components/` | Source coverage | Notes |
| --- | --- | --- |
| `Auth/AgeConfirmModal.tsx` | shared 440px sheet frame, accent wash | Feature actions/validation retained; native fit unverified. |
| `Auth/SoftWallModal.tsx` | `useFanSheetMotion` + shared 440px sheet frame, accent wash | Feature actions/validation retained; native fit unverified. |
| `BackedCelebration.tsx` | shared 440px sheet frame | Existing donation celebration chrome remains; shared frame geometry. |
| `Challenges/ChallengeSettingsSheet.tsx` | shared sheet frame | Included in whole-app source/function review; rendered and native evidence tracked separately. |
| `Checkout/WebPaymentSheetHost.tsx` | feature-specific panel/frame | Included in whole-app source/function review; rendered and native evidence tracked separately. |
| `Common/WebAppShell.tsx` | feature-specific panel/frame | Included in whole-app source/function review; rendered and native evidence tracked separately. |
| `Drip/ProductSheet.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Feedback/SuggestionSheet.tsx` | shared 440px sheet frame; kind horizontal scroll + where vertical scroll menu | Feature actions/validation retained; native fit unverified. |
| `Filmers/FilmerSheet.tsx` | shared 440px sheet frame, accent wash | Feature actions/validation retained; native fit unverified. |
| `Legal/LegalModal.tsx` | `useFanSheetMotion` + shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Local/SponsorshipModal.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Local/TopAuraBoosters.tsx` | compact Daylight rail cards (sponsor density) + peek sheet | Tier face washes remain; peek uses surface chrome. |
| `Onboarding/WelcomeOverlay.tsx` | shared 440px sheet frame, accent wash | Feature actions/validation retained; native fit unverified. |
| `Operator/OperatorRosterModal.tsx` | accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Operator/PINClaimModal.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Profile/AthleteReelManager.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Profile/AuraCardFlipModal.tsx` | shared sheet frame | Included in whole-app source/function review; rendered and native evidence tracked separately. |
| `Profile/DeleteAccountSheet.tsx` | feature-specific panel/frame | Included in whole-app source/function review; rendered and native evidence tracked separately. |
| `Profile/EditProfileModal.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Profile/HighlightsFeedSettingsSheet.tsx` | feature-specific panel/frame | Included in whole-app source/function review; rendered and native evidence tracked separately. |
| `Profile/LockerRoomWishlist.tsx` | shared 440px sheet frame | Existing tier/goal chrome retains its purpose; shared frame geometry. |
| `Profile/MySportsModal.tsx` | shared sheet frame | Included in whole-app source/function review; rendered and native evidence tracked separately. |
| `Profile/NotificationSettingsSheet.tsx` | shared sheet frame | Included in whole-app source/function review; rendered and native evidence tracked separately. |
| `Profile/PrivacySettingsSheet.tsx` | feature-specific panel/frame | Included in whole-app source/function review; rendered and native evidence tracked separately. |
| `Profile/ProfileMenuSheet.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Profile/RoleSwitcherModal.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Profile/ShareQrModal.tsx` | shared 440px sheet frame | Dark QR card retains scannability/contrast; shared frame only. |
| `Profile/ShareQrModal.web.tsx` | shared 440px sheet frame | Web QR card retains scannability/contrast; shared frame only. |
| `Profile/VerifyAthleteModal.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Rally/CreateRallySheet.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Rally/RallyFillMoment.tsx` | custom full-screen layout | Full-screen goal celebration retains dark high contrast. Share this Rally is the primary button. |
| `Reels/CoachLevelBadge.tsx` | shared sheet frame | Included in whole-app source/function review; rendered and native evidence tracked separately. |
| `Reels/FeedPicksSheet.tsx` | jade wash; sports/schools vertical scroll menus + category horizontal rail (FEED-01) | Replaces pill wrap grids; 44pt rows; native fit unverified. |
| `Reels/HighlightPickerModal.tsx` | accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Reels/ReelMoreSheet.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Reels/ReelViewModal.tsx` | custom full-screen layout | Full-screen video viewer remains Midnight; playback controls stay visible. |
| `Reels/ReportContentModal.tsx` | shared 440px sheet frame; reason vertical scroll menu | Feature actions/validation retained; native fit unverified. |
| `Reels/UploadChoiceSheet.tsx` | shared sheet frame | Included in whole-app source/function review; rendered and native evidence tracked separately. |
| `Reels/UploadVideoModal.tsx` | custom full-screen layout | Feature actions/validation retained; native fit unverified. |
| `SportQuiz/QuestionReport.tsx` | shared sheet frame | Included in whole-app source/function review; rendered and native evidence tracked separately. |
| `Spotlight/SpotlightModal.tsx` | custom full-screen layout | Full-screen award/video reveal; Midnight video contrast retained. |
| `TipSheetModal.tsx` | shared 440px sheet frame | Feature actions/validation retained; native fit unverified. |
| `Verification/SchoolCrest.tsx` | accent wash, shared metrics | Proof sheet receives shared accents; crest colors remain school-owned. |

## Additional shared consumers

`Reels/UploadChoiceSheet.tsx` (2026-10-16): the Upload ＋ chooser uses the shared sheet chrome (`useSheetFrame`, `SheetRise`, `SheetHandle`, one jade `MenuBackdrop` wash) with two full-width options and Cancel; it only chooses which existing composer opens. UX-07 caps it to90% of the current window, scrolls tall text/options/Cancel and leaves its44-point Close handle outside that scroll. Bounded current-component web320x640 CSS-text-scaling/callback review passed; native safe-area/Dynamic Type checks remain separate.

UX-06's dated first pass, followed by Calm Island: `BeyondGame/BeyondGameStyles.ts` binds discovery, composer, legacy athlete cards and
the existing `BeyondButton` to the shared Calm Island colors and MENU_METRICS. `BeyondButton` adds
optional primary/quiet/danger/choice/chip presentation variants; selected/disabled defaults,
button semantics and callbacks stay intact. Caption/media/audience/full-attestation sections
remain in the same draft lifetime. `Challenges/ChallengeControls.tsx` uses the same token
rhythm. See [UX-06](../agents/UX-06.md) for actual source/browser/test evidence and limitations.
Its six-file manifest predates the newer colour edits; preserve that receipt as history rather than asserting current appearance. Source confirms unavailable refresh visibility in Beyond discovery/legacy and ChallengeInbox/Settings; ChallengeBar/composer retain their existing disabled/unavailable controls.

`UploadVideoComposer` renders upload progress/wash. `HomeSearchOverlay` receives the menu wash
without hosting a native Modal itself. `UI/EmptyState` uses shared art/card geometry;
`UI/FilterPills` and `UI/SheetHandle` align control geometry. Since 2026-10-15 every filter chip uses one look (ink fill + white label when selected, white outlined when idle): `FilterPills` no longer takes per-screen `accent` / `mist`, and Beyond / game-alert chips match it. Donate amount chips (`TipButton`)
and optional card-fee control (`FeeCheckbox`) receive consistent colors and larger targets.
The fee control’s accessible label includes the exact optional fee and unchanged family share.
None of these decorative changes changes catalog, amount, rights or payment rules.

## Page families

Fan pages and enabled role HQ screens that consume `ScreenShell`, `TabScreen` or `ScreenHeading`
inherit their shared chrome. A page with a custom root keeps its existing theme tokens; it is
not automatically converted to a stepped popup. Highlights/film playback stays Midnight, the
operator console retains score/clock contrast, and admin desks retain their work density.
Next admin remains read-only; published theme choices are still owned by Expo admin.

## UX-03 sports identity coverage

| Source | Presentation and data rule |
| --- | --- |
| `Local/GameCard.tsx` / `Local/gamePresentation.ts` | Daylight surface for live and scheduled (ember LIVE pill only). Neutral team letter tiles; wrapping school/team names and score columns. Scheduled/final override stale clocks; unknown scores/clocks are not fabricated. |
| `Profile/AthleteProfileView.tsx` / `Profile/ProfileHeroAvatar.tsx` | Compact photo/name hero with known sport, position and class; direct wrapping Goals/Team/owner Manage navigation. Community accounts omit athlete credentials; public athletes do not use the viewer’s private profile metadata. School crest confirmation and Aura/avatar actions remain. |
| `Reels/ReelCard.tsx` / `Reels/ReelActionOverlay.tsx` | Real roster jersey/position beside a larger athlete label; athlete and school allow two lines. Midnight contrast, reactions, donation and profile navigation remain. |
| `Reels/LiveMatchBanner.tsx` | Daylight surface scoreboard (not night scrim). Each school is one line beside a fixed score column. Recorded-state rules stay; no default clock or invented live status. |

UX-03 follow-up evidence: `pnpm check` passes both app typechecks, 55 suites / 261 tests
and all guards. Same-name public-athlete credentials require an exact linked player ID;
community heroes suppress school proof; spoken Local cards include distinct schools.
Scoreboard dismiss has a button role and 44-point target around its compact visual mark.
Browser Bridge now works on this Mac. Controlled real-component fixtures exercise 320/390-pixel
viewports with normal and CSS 200% text; screenshots and exact limitations live in
[AUDIT_REPORT.md](AUDIT_REPORT.md). Narrow large-text failures led to wrapping Local scores and
scrollable Highlight copy/rail below measured feed chrome. Aura effects sit outside rail clipping.
The earlier Expo web export passed (52 static / 3 API bundles). Native readers, Dynamic Type,
playback/paging/owner-peek gestures, haptics and PaymentSheet remain pending. No hosted database,
configuration, dependency, fee or generated product-fact changes.

## Profile navigation follow-up (2026-10-07)

Profile actions retain 44-point targets and short visible labels with named-recipient accessibility.
Highlights / Stats / Goals / Vault / Team / Manage navigation wraps with text growth. Goals contains
wishlist before Rally; Team opens teammates; Manage replaces inline owner tool stacks. Aura uses
the same sport/playbook stat labels as Stats, and Aura points stay separate. Public identity loads
reject stale results; school-visible=false gates crest and roster fallback. The `actionsOnTop` chrome
flag remains backward compatible in storage but no longer relocates compact Profile actions.
Design artifacts and scope are in ARCHITECTURE; browser/device evidence in AUDIT_REPORT.

## Current verification boundary

Calm Island's current `FOCAL`/`LIGHT_COLORS`/`DAYLIGHT_THEME` and the Look Daylight preset are locally implemented; source identity/provenance is in [UI_UX_FIGMA_POLISH](design/UI_UX_FIGMA_POLISH.md). STATE records the producer's 148-suite/1,188-test check and `.smoke/redesign/` captures. The retained UX-06 detection run and older numbers below predate these changes. Root owns the final COORD-01 gate; DESIGN/ACCESSIBILITY/DEVICE_QA own configured-state/native verification. Runtime publication is a separate authorized admin action; the older published five-colour override and staging status were not reverified in this doc pass. No data, consent, money, model or release authority changes follow from palette coverage.

MAIN's existing report/control-map and Books exports remain separate from unintegrated fan-zone custom dates, CSV/XLSX analysis exports and Product personal workspace. Do not treat that separate worktree's screenshots/gates as current MAIN coverage. Review its source/ownership through a scoped handoff first.

## Historical evidence and next verification

UX-02 local integration passes both app typechecks and full Jest (50 suites / 242 tests). The latest
recipient callback guard also passes all 8 targeted checkout tests; independent review found
the four checkout issues addressed. Final project guards are recorded in STATE. No native
screenshot, keyboard, reduced-motion, screen-reader or Stripe-device
verification has been recorded for these visual changes; native/device and hosted verification
remain pending. Local web export passed for UX-03 as recorded above. Follow TESTER_SCRIPT's Donate/upload/menu checks
on a small Android phone and registered iPad; record build, viewport, text scale and screenshots.
Press stills are marked stale. No schema, privacy collection, fees, credit path or legal conclusion
changes are implied by this visual pass.


## Read-only admin portal — Lovable shell (2026-11-04; supersedes 2026-10-12 underline tabs)

Owner Lovable standard: dark left sidebar (top bar below `lg`), Daylight canvas, card panels, jade/gold/ember tokens ([LOVABLE_UI_UX_PLAN](design/LOVABLE_UI_UX_PLAN.md)). Home keeps its distinct community support content; every other desk retains its own title, content and controls. The 2026-10-12 underline-tab report chrome is historical for presentation only.

| Surfaces | Shared format |
| --- | --- |
| Home, Trends, Audience, Revenue, Health, Product, Analytics, Departments | `PortalShell`: dark sidebar nav, Daylight main canvas, bold titles, card panels. |
| Product’s Control map, Features, Profile, Sign-in and People desks | Same shell, nested Product nav. Control map (`/coverage`) lists fan surfaces from `PORTAL_COVERAGE_SURFACES`; live control telemetry stays in Expo `/admin/product/coverage`. |
| Product Expo desk directory | Shared `EXPO_DESKS` catalog on Product overview — read-only paths, no portal writes. |
| Revenue checkout rails note | Honest Gift / Vault 20/80 / web Stripe vs native store-billing copy; Wave 0 test mode banner retained. |
| Charts, KPI values, meters, ledgers and department status | Open card panels; full summaries, source disclosures, Data rows, missing-state words and legal ledger notes retained. Enlarged text may wrap labels and values. |

Local evidence and remaining browser-tool coverage limits: [COMMUNITY_DASHBOARD_QA.md](design/COMMUNITY_DASHBOARD_QA.md).

## Main Expo admin — ADM-02 (2026-10-12)

The owner selected the report format at `http://localhost:3033/` for the main portal.
Expo `/admin` now integrates that reporting experience with its existing editing desks.
Status and fresh evidence: [ADM-02.md](../agents/ADM-02.md).

| Coverage | Ownership and presentation |
| --- | --- |
| Home, Trends, Audience, Revenue, Health, Product, Analytics, Departments | `AdminShell` gates access; `AdminReportHeader` sits inside the page scroll owner. `components/Admin/Reports/` supplies the open report design and universal SVG figures. |
| Product Features, Profile, Sign-in, People, Control map | Oversight views link to the owning editing desks; nested trails identify the current page. |
| All existing Operations/Content/Commerce/Audience/Growth/System desks | Existing controls use `AdminPage` and `AdminChrome` in the selected report palette; immediate edits, drafts, confirmations and explicit Publish remain owned by their tools. |
| QA, Studio and Lab | QA/Studio appear once in Tools; Lab is in the four-tab App setup workspace and searchable by its original name. QA owns incident/queue actions; Lab owns validated draft/feedback actions. Period-wide analysis is in Health/Product. |
| Report values and chart Data | Shared parsers preserve missing/empty/zero and source errors. Summaries and full values accompany charts. |
| Manage desk discovery | Groups browse without leaving the report. Search matches existing names, descriptions and groups inside the chosen lens, including QA/Studio and App setup members. Desk rows use open dividers and retain their original editor routes. View/Group filters avoid repeated menu headings; selecting a desk closes the directory, including the current desk. |
| Long report navigation and refresh | “In this report” shortcuts focus the current scroll owner's sections. Analytics includes both catalogs. Every report, including Home, exposes Refresh and disables it during a read or unavailable access. |
| Financial editing and report ownership | Payouts (`/admin/money`) contains the existing disbursement queue/status controls and links to Revenue/Catalogs. Ledger totals, stream splits, transactions, origins and donation history render in Revenue. Books owns the separate accounting journal, liabilities, closes and exports. |
| Legacy Reports route | `/admin/reports` opens Analytics. It remains resolvable for saved links and is excluded from every editing lens; 18 merged entries remain in Manage desks, covering all 24 saved routes including Books and Reports/Coverage redirects. |

### Current consolidation coverage

| Surface | Complete information and space use |
| --- | --- |
| App setup / Highlights & review | Workspace tabs preserve original editors. Search supports workspace/member labels. Existing lenses filter discovery, with no authorization change. |
| Analytics / Trends / Revenue / Departments | One complete selected board, collapsed global catalogs, unique comparisons and a combined stream chart. All 64 measures plus future numeric keys, four series, distinct windows, full Data/privacy/reconciliation/API details remain. |
| Product Profile / Control map | Six settings once with meanings. Complete control registry and handoffs; shared telemetry readings appear once with surface names, top-eight/partial warnings and unknown missing values. |
| Health | Thirteen nullable operational checks and corrective links; passing checks open on request. Exact low-stock count and normalized runtime state match editor contracts. |
| Moderation / Lab | Complete labeled evidence on phones; wide moderation table and two-column Lab when text fits. Phone/tablet Lab columns keep natural, nonshrinking heights; sibling positions are checked as well as width. Approved readable inks replace pale status text. |
| Future app features | Mandatory enrolled admin-first contract/checkpoints; reuse existing desks/reports. [Workflow](FEATURE_ADMIN_WORKFLOW.md) defines the reviewed presentation-only exemption and gate limitations. |

Source/verification inventory: [ADMIN_DATA_CONSOLIDATION](design/ADMIN_DATA_CONSOLIDATION.md).

## Beyond the Game — local approved navigation

| Surface | Reuse / choice | Verification boundary |
| --- | --- | --- |
| Fan bar | Highlights · Beyond · Activity · Spotlight · Profile; separate existing Upload slot; full accessible Beyond name | Actual RNTL visibility/routing tests; device layout not certified. |
| Drip | Existing route via enabled Profile account-menu item | Existing sheet dismissal sequencing preserved; runtime flag still applies. |
| Beyond categories / posts | Compact wrapping chips, token-based actions, grouped composer and explicit media load | Dated UX-06 account/focus/source tests and narrow 320/390 layout/switch evidence; newer palette requires current rendered review. No new playback controller or behavioral tracking. |
| Legacy workout/service cards | Bounded actor-bound read; existing athlete profile supplies viewing/support | Public cards exclude media URLs, full profiles, new payee selection and rankings. |

This UI is local source, with unapplied migrations/defaultoff contributions. Native/web rendering remains a release check.
## Weekly family activities — local source integration

Sport Quiz uses a root account route with ScreenShell, explicit Back and account Home;
the root Stack suppresses its duplicate native header. The optional invitation lives inside
Home measured chrome and existing parent/booster/sponsor/operator HQ scroll content.
Profile keeps a private quiz history link for signed-in account roles. Local dismissal and
server Skip have distinct wording; failed actions keep a notice and Refresh.
Fan Zone now shares that discovery space after its actual admin and independent participant
acceptance. Its card prioritizes selected-campaign private guardian review, own entry, admitted
open campaign and authorized recap; private guardian recovery is not hidden by participation
dismissal. Profile has a generic Fan Zone entry, not an all-campaign inbox/history. The Fan root
Stack header is suppressed; Back/account Home remain explicit. Source errors stay independent.
No new bottom tab, forced modal, push permission or money control accompanies these activities.
Device sizing, keyboard/screen-reader and full layout redirects remain release verification.

## UX-07 — athlete story and primary-tab source coverage (2026-10-20)

The shared Profile Highlights pane names caller-visible authored biography/links as Story, without
viewer/private fallbacks. Home, Activity, Spotlight, Local, Beyond, Drip and Upload retain existing
sources/destinations with readable headings, factual empty/loading copy and wrapping existing controls.
No new collector or action was added; existing control-map ownership, flags and telemetry remain.
Source review, specific rendered states, failures and native/hosted limits live in [UX-07](../agents/UX-07.md).
Shared primitive changes cover their consumers; this does not claim every desk or sheet was visually audited.


### Current UX-07 rendered follow-up

Actual independent outside Codex review accepted synthetic current-component Story at390px and320px enlarged CSS text, plus normal/enlarged Upload at320x640. Capture URL, viewport and PNG widths match. Existing Highlight/Beyond callback assertions and Cancel event wait completed before a later optional page open failed. A subsequent hidden-subject DOM read succeeded at desktop width; it supplies no narrow visual or hosted-policy acceptance. Final post-scroll `pnpm check` passed212mobile suites/1849tests and all included gates; selected local app-ready passed. Native/assistive checks, configured-theme/full-route visual coverage and engagement outcomes remain unverified. Exact receipts and failure limits: [UX-07](../agents/UX-07.md).

## LOCAL-02 game venue section — 2026-10-21

The guest/Local game page composes `Local/GameVenueCard.tsx` below the scoreboard using existing
Calm Island surface/border/radius tokens and a wrapping 44-point primary action. Venue school,
selectable address and arrival note are separate text; no location is inferred from the home team.
Venue/address unknown states retain the existing game flow; a failed map handoff leaves the
address and retry available. No new sheet or navigation bar. Games uses the existing admin
fields, notice and row report; selected admin-first evidence is in [LOCAL-02](../agents/LOCAL-02.md).
Rendered current-component phone/desktop checks and physical-device gaps are recorded there.

## UX-08 — sport field lines and scoreboard digits (2026-10-21)

Owner chose "both, lightly" inside Calm Island. `Effects/SportField` draws the athlete's or game's surface
(11 kinds from `data/sportField.ts`; unknown sports get a generic field) at 0.08–0.12 opacity behind the compact
athlete hero, the `/gift/[handle]` program header, the featured Spotlight card (award gold, generic field) and
Local `GameCard` (own clipped layer, shadow kept). `SCOREBOARD_DIGITS` (theme) sets tabular, heavy live numbers;
`UI/JerseyBadge` replaces the `#n` pill. Community heroes stay plain. Evidence and review: [UX-08](../agents/UX-08.md).

App-wide (same day, owner request): `ScreenHeading`, Beyond's header and `EmptyState` draw the viewer's field
(`hooks/useViewerSport`; generic for non-athletes) — headings on the right with a left fade, empty cards in their
gold ink. All profile heroes carry a field. `SCOREBOARD_DIGITS` and `JerseyBadge` cover the remaining counts,
amounts and standalone jersey numbers. Video surfaces and admin desks are deliberately unchanged.



### 2026-10-21 — MULTISPORT-01 and UX-09

My Sports uses existing Profile sheet chrome and retained draft Back/Save. Participation corrections reuse
Sports AdminChrome; recorded sport corrections reuse Highlights; unknown/original game log correction reuses
Stats. Local Games/Polls/Boosters retains always-visible short icon labels in a44-point row. Sponsor rail and
sponsor CTA belong under Boosters. Floating fan dock uses56-point body plus safe footer, opaque targets and
background-only scroll softening. That UX-09 checkpoint reserved the footer; owner-approved UX-10 now
overlays full-height Home media and measures clearance only for controls and normal page footers. Existing
destinations/runtime menus are unchanged. Actual local verification/physical gaps are in the feature trackers.


### 2026-10-21 America/Denver — UX-10 sporty presentation continuation

All seven fan destinations compact panels/headings/cards and retain44-point actions/text scaling.
Installed sport icons accompany visible labels; cyan Local, violet Activity/Profile, gold awards and
ember Drip join jade/sand. Absolute dock overlays Home video; actual wrap height clears captions/
reactions/peek and other tab footers, including paused recovery screens. Full-height video/pager/resize
geometry uses one measured screen height. Independent source review accepted actual contrast/footer
repairs. Local browser/Jest receipts and native/system-text gaps: [UX-10](../agents/UX-10.md).

## UX-11 — compact panels and popups (2026-10-21)

Popup frame `useSheetFrame` padding md/xs/sm and `MENU_METRICS` radii 24/16/14; step bar 32pt. `UI/MoreText` is the one
"More / Less" disclosure for non-policy explanations; policy copy stays plain `Text` (guard test). Details: [UX-11](../agents/UX-11.md).


## UX-15 — current Activity, Local polls and admin presentation (2026-11-22)

Activity history matches its inbox namedFigtree faces at existingTYPE14/20body and16/21section; scroll/refresh/data handlers are unchanged while the reported Android gesture failure awaits direct device proof. Local selected choices use dark ink borders plus check/Selected from the existing vote state; full team names, raw shares, cheers-only notice and vote authority remain.

Expo admin headings/report text use current Bricolage/Figtree, warm fixedadmin surfaces and proportional cards. Native financial figures retain their existing fit/accessibility exceptions. Open desk search now shrinks within320px page padding; existing search/filter/navigation behavior and44pt controls remain. Next report/KPI/dashboard wrappers use the same current card standard and existing dashboard anchors grow to44px; source tables, missing/zero/error distinctions, exact measure formats and keyboard/native-details contracts remain.

An explicit full-request Refresh view reads existing protected sources through current server identity/role/MFA checks; it is separate from presentation and cannot authorize access or background polling. Source ownership, current-source independent reviews, synthetic/actual-component captures, full-gate/build results and remaining native/provider limits are recorded in [UX-15](../agents/UX-15.md). Temporary Expo verification source is removed before exports.

UX-15 current local code checkpoint:3029mobile/217portal tests and current Next build/native JS exports pass; the full gate awaits its separate owner-confirmed Exit acknowledgement. Exact current source and supporting-file ledger is in the task evidence; Android touch scrolling remains open. Source review or a browser still does not establish native gesture/provider acceptance.


Web Highlights picks follow-up: the existing workspace scope centers the nested picker at a 760px maximum and uses two columns for sports/schools above 820px window width. Category choices wrap instead of requiring horizontal discovery. A named 44px Back to Highlights settings control replaces the web drag-handle dismissal; Save uses the existing primary color. Native and ordinary first-run retain the original single-column layout, school truncation and category rail. The existing draft, three-item limits, save handler, personalization flag and nested return path remain with their original owners. Presentation review: outside-session Codex/DESIGN; no new data, permission, collection or operational capability. Jev not reached because local SDK/key configuration is absent. Stop after scoped desktop/tablet layout is bounded, short-window actions remain reachable, and responsive draft/limit behavior passes.


Verification of the web picker: 8 mounted cases pass, including native/default scope, limits, responsive draft retention and explicit return without save. The full Ala-scoped repository check passes (337 mobile suites / 3,190 tests). Browser Bridge with Demo Fan confirms the columns and all category controls at 900×600. At 900×400 the panel is 760×352px with 24px gutters, Back is 44px high, Save is 48px high, and the body scrolls (161px viewport / 366px content) with no horizontal overflow. Back → Highlights settings → Done → account overview passed without a settings write. Edit profile opens in a 760×340px frame and Escape restores the overview. Account capability and Legal also load within 760×340px in the short-window check; no role, legal acknowledgement or account write was made. Physical-device acceptance and hosted delivery remain outside this presentation pass.


## Web screen focus review — 2026-11-25

Outside-session Codex reviewed web fan route/menu copy and navigation against a finite goal: each visible panel should add useful context or an action, rather than repeat the page; menus should name their next action and preserve consent, money, privacy and source failures. Existing settings/actions are presented without new permissions or operational capabilities (presentation-only admin-workflow exemption, reviewer/executor Codex in the owner-authorized session). Native UI stays on its existing branch. Jev not reached because its SDK/key configuration remains absent; no score inferred.

| Screen/menu family | Review result and reason |
| --- | --- |
| Highlights, Beyond, search and recent searches | Retain existing feed/search hierarchy. Web Highlights preference copy now explains picks and newest-first once, retaining the no-ad-use notice. |
| Local hub | Omit repeated live games and Aura rankings from the right rail; the page already owns those sections. |
| Schools/teams directory and game detail | Keep complementary summaries; omit the currently opened game. No roster or profile data handler changes. |
| Profile/public profile, Drip/shop, Booster | One shortcut group replaces separate repeated card/button headings; omit the current destination. Profile and Drip published pauses are respected. Vault pause removes the exclusive promise while retaining Profile. |
| Activity, Spotlight, Receipts | Retain purpose, source/empty states, confirmation and financial context. Shared web extras supplies complementary discovery. No notification-source repair is claimed. |
| Tablet extras | 420px cap with fixed named header and Close; navigation dismisses, resize clears old open state. Closed/paused panels do not mount the scoreboard/Aura hooks. |
| Feedback and unavailable features | Web copy gives a next step without Admin publishing instructions. Feedback remains distinct from Report/Hide. Return uses the existing enabled-route helper. Admin instructions and native copy remain. |
| Auth/age/signup; profile/privacy/notifications/roles/verification/sports/legal/deletion | Retain separate access, privacy, consent, capability and destructive-action explanations. Existing enlarged web account frames remain. |
| Upload/picker/edit/report; quiz/report; rally/spotlight; avatar/story/QR | Retain media rights, review, reporting and source explanations; no new action or source contract. |
| Gift/options/review/thanks/receipts; program sponsorship | Retain independently required gift/donation/tax/fee/held notices. Repeated tax text on Profile and Receipts is intentional because each can open independently. |
| Operator PIN/roster | Retain role-specific operating instructions; not fan-only publishing copy. Privileged/admin desks are outside this web fan copy pass. |

Evidence: bounded AST inventory of 219 non-test fan components/tab route modules, 46 direct-modal hosts / 48 sites; literal-copy summaries of modal hosts and routes plus targeted source review. Those counts are inventory, not proof of all render paths or every function. Review artifacts and source hashes are outside the repository at `../ala-post-edit-evidence/web-focus-inventory.json` and `web-focus-copy-review.json`. Five focused mounted suites pass (33 cases): route/flag exclusions, no hidden data-hook mount, error/retry, drawer dismissal/resize, native/default copy and feedback submission via a mock. Mobile typecheck passes. Full repository gate results are recorded in COORD-01.

Current visual verification is unavailable: `meta browser` Bridge readiness succeeds, but page listing fails while minting a delegated credential (network operation not permitted), including the unsandboxed attempt. No current screenshot, keyboard, enlarged-text or live navigation acceptance is claimed. Earlier dated browser evidence is retained for its original source only. Next: app owner/QA run the web steps in TESTER_SCRIPT when the browser connection works.

Separate existing source gap: `useAuraBoosters` retains its canonical fallback behavior (DEV_PERSONAS on unavailable/empty results); `fetchAuraBoard` folds read failure into an empty result. This pass changes when that existing hook mounts, not its data contract. LOCAL/AURA and DATA_GOVERNANCE must review live-vs-fallback labeling/source behavior before production; no real-only ranking or hosted data assurance follows these layout tests.


Final local gate: 340 mobile suites / 3,211 tests and full Ala-scoped repository check passed. Retained detection passed 217 portal tests; default quality gate failed only on the different-checkout source-sync state. The Ala-owned snapshot passed. These are separate outcomes, not a healthy runtime-monitor claim.
