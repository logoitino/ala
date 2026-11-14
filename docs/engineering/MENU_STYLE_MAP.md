<!-- Current shared UI source coverage is separate from dated rendered/native acceptance. -->
# Menu and page style coverage

**Current source alignment:** 2026-11-04 · Whole-app [LOVABLE_UI_UX_PLAN](design/LOVABLE_UI_UX_PLAN.md) (`UI/Kit`, Daylight + night moments, jade/gold/ember). UX-10 per-tab violet accents and the 2026-10-12 portal underline-tab chrome are superseded where they conflict; UX-06/Calm Island history retained below. Owners: `DESIGN`, `CHECKOUT`, `UPLOAD`, affected surface squads;
`ACCESSIBILITY`, `DEVICE_QA` review; `DOCUMENTATION` keeps this map current.

This is a source inventory of shared presentation coverage. It is not a rendered-device audit.
Every modal-bearing component is listed, including intentional full-screen video/celebration
surfaces. A shared primitive can update many consumers without each file needing a local edit.

Current cross-team direction and assignments: [TEAM_STATUS](../agents/TEAM_STATUS.md); actual documentation/coordination claims and checks: [COORD-01](../agents/COORD-01.md#whole-team-refresh--2026-10-15-americadenver). The 107-role briefing is assignment coverage, not execution or human delivery. The [UI checkpoint](design/UI_UX_FIGMA_POLISH.md) separates the original empty Figma draft, later colour file, local source and rendered evidence.

## Shared API and design rules

| API | Purpose |
| --- | --- |
| `UI/Kit.tsx` + `constants/theme.ts` → `KIT` | Whole-app action kit (owner 2026-11-04, [LOVABLE_UI_UX_PLAN](design/LOVABLE_UI_UX_PLAN.md)): KitButton variants, KitChip, KitBadge, LivePill, KitProgress; control 14 / card 16 / sheet 24 radii |
| `constants/theme.ts` → `MENU_METRICS` | Sheet 28px, card 20px, control 16px radius; 44px touch-target reference |
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

31 modal-bearing source components, including native/web QR variants. Upload step chips and
wash are rendered by its child `UploadVideoComposer`; donation steps live in child `TipCheckout`.

| Component under `components/` | Source coverage | Notes |
| --- | --- | --- |
| `Auth/AgeConfirmModal.tsx` | shared 440px sheet frame, accent wash | Feature actions/validation retained; native fit unverified. |
| `Auth/SoftWallModal.tsx` | `useFanSheetMotion` + shared 440px sheet frame, accent wash | Feature actions/validation retained; native fit unverified. |
| `BackedCelebration.tsx` | shared 440px sheet frame | Existing donation celebration chrome remains; shared frame geometry. |
| `Drip/ProductSheet.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Feedback/SuggestionSheet.tsx` | shared 440px sheet frame; kind horizontal scroll + where vertical scroll menu | Feature actions/validation retained; native fit unverified. |
| `Filmers/FilmerSheet.tsx` | shared 440px sheet frame, accent wash | Feature actions/validation retained; native fit unverified. |
| `Legal/LegalModal.tsx` | `useFanSheetMotion` + shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Local/SponsorshipModal.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Local/TopAuraBoosters.tsx` | compact Daylight rail cards (sponsor density) + peek sheet | Tier face washes remain; peek uses surface chrome. |
| `Onboarding/WelcomeOverlay.tsx` | shared 440px sheet frame, accent wash | Feature actions/validation retained; native fit unverified. |
| `Operator/OperatorRosterModal.tsx` | accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Operator/PINClaimModal.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Profile/AthleteProfileView.tsx` | shared 440px sheet frame | Aura collectible keeps tier chrome; shared frame geometry. |
| `Profile/AthleteReelManager.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Profile/EditProfileModal.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Profile/LockerRoomWishlist.tsx` | shared 440px sheet frame | Existing tier/goal chrome retains its purpose; shared frame geometry. |
| `Profile/ProfileMenuSheet.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Profile/RoleSwitcherModal.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Profile/ShareQrModal.tsx` | shared 440px sheet frame | Dark QR card retains scannability/contrast; shared frame only. |
| `Profile/ShareQrModal.web.tsx` | shared 440px sheet frame | Web QR card retains scannability/contrast; shared frame only. |
| `Profile/VerifyAthleteModal.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Rally/CreateRallySheet.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Rally/RallyFillMoment.tsx` | custom full-screen layout | Full-screen goal celebration retains dark high contrast. Share this Rally is the primary button. |
| `Reels/HighlightPickerModal.tsx` | accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Reels/ReelMoreSheet.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Reels/ReelViewModal.tsx` | custom full-screen layout | Full-screen video viewer remains Midnight; playback controls stay visible. |
| `Reels/ReportContentModal.tsx` | shared 440px sheet frame; reason vertical scroll menu | Feature actions/validation retained; native fit unverified. |
| `Reels/UploadVideoModal.tsx` | custom full-screen layout | Feature actions/validation retained; native fit unverified. |
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

