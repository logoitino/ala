# Menu and page style coverage

**Aligned:** 2026-10-07 · UX-02 / UX-03 · Owners: `DESIGN`, `CHECKOUT`, `UPLOAD`, affected surface squads;
`ACCESSIBILITY`, `DEVICE_QA` review; `DOCUMENTATION` keeps this map current.

This is a source inventory of shared presentation coverage. It is not a rendered-device audit.
Every modal-bearing component is listed, including intentional full-screen video/celebration
surfaces. A shared primitive can update many consumers without each file needing a local edit.

## Shared API and design rules

| API | Purpose |
| --- | --- |
| `constants/theme.ts` → `MENU_METRICS` | Sheet 28px, card 20px, control 16px radius; 44px touch-target reference |
| `UI/MenuChrome.tsx` → `MenuBackdrop({ accent? })` | Non-interactive jade/cyan/gold/violet/ember wash with gold/violet accents; hidden from assistive technology |
| `UI/MenuChrome.tsx` → `MenuStepIndicator({ labels, current })` | Named, non-clickable step chips; one-based current stage announced to assistive technology |
| `hooks/useSheetFrame.ts` | Centered sheets up to 440px, compact gutters, home-indicator clearance, common radius/border/shadow |
| `ScreenShell.tsx` / `TabScreen.tsx` | Daylight decoration on light canvases; dark video layouts retain contrast |
| `ScreenHeading.tsx` | Shared kicker/accent dot and heading underline |

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
| `Auth/SoftWallModal.tsx` | shared 440px sheet frame, accent wash | Feature actions/validation retained; native fit unverified. |
| `BackedCelebration.tsx` | shared 440px sheet frame | Existing donation celebration chrome remains; shared frame geometry. |
| `Drip/ProductSheet.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Feedback/SuggestionSheet.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Filmers/FilmerSheet.tsx` | shared 440px sheet frame, accent wash | Feature actions/validation retained; native fit unverified. |
| `Legal/LegalModal.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Local/SponsorshipModal.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Local/TopAuraBoosters.tsx` | shared 440px sheet frame | Tier-based booster colors remain; shared frame geometry. |
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
| `Rally/RallyFillMoment.tsx` | custom full-screen layout | Full-screen goal celebration retains dark high contrast. |
| `Reels/HighlightPickerModal.tsx` | accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Reels/ReelMoreSheet.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Reels/ReelViewModal.tsx` | custom full-screen layout | Full-screen video viewer remains Midnight; playback controls stay visible. |
| `Reels/ReportContentModal.tsx` | shared 440px sheet frame, accent wash, shared metrics | Feature actions/validation retained; native fit unverified. |
| `Reels/UploadVideoModal.tsx` | custom full-screen layout | Feature actions/validation retained; native fit unverified. |
| `Spotlight/SpotlightModal.tsx` | custom full-screen layout | Full-screen award/video reveal; Midnight video contrast retained. |
| `TipSheetModal.tsx` | shared 440px sheet frame | Feature actions/validation retained; native fit unverified. |
| `Verification/SchoolCrest.tsx` | accent wash, shared metrics | Proof sheet receives shared accents; crest colors remain school-owned. |
## Additional shared consumers

`UploadVideoComposer` renders upload progress/wash. `HomeSearchOverlay` receives the menu wash
without hosting a native Modal itself. `UI/EmptyState` uses shared art/card geometry;
`UI/FilterPills` and `UI/SheetHandle` align control geometry. Donate amount chips (`TipButton`)
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
| `Local/GameCard.tsx` / `Local/gamePresentation.ts` | Cyan Local accent, neutral team letter tiles, wrapping school/team names and individual score columns. Scheduled and final states override stale clock data; unknown scores/clocks are not fabricated. |
| `Profile/AthleteProfileView.tsx` / `Profile/ProfileHeroAvatar.tsx` | Compact photo/name hero with known sport, position and class; direct wrapping Goals/Team/owner Manage navigation. Community accounts omit athlete credentials; public athletes do not use the viewer’s private profile metadata. School crest confirmation and Aura/avatar actions remain. |
| `Reels/ReelCard.tsx` / `Reels/ReelActionOverlay.tsx` | Real roster jersey/position beside a larger athlete label; athlete and school allow two lines. Midnight contrast, reactions, donation and profile navigation remain. |
| `Reels/LiveMatchBanner.tsx` | Scoreboard uses the chrome width. Each school is one line beside a fixed score column. Recorded-state rules stay; no default clock or invented live status. |

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

## Evidence and next verification

UX-02 local integration passes both app typechecks and full Jest (50 suites / 242 tests). The latest
recipient callback guard also passes all 8 targeted checkout tests; independent review found
the four checkout issues addressed. Final project guards are recorded in STATE. No native
screenshot, keyboard, reduced-motion, screen-reader or Stripe-device
verification has been recorded for these visual changes; native/device and hosted verification
remain pending. Local web export passed for UX-03 as recorded above. Follow TESTER_SCRIPT's Donate/upload/menu checks
on a small Android phone and registered iPad; record build, viewport, text scale and screenshots.
Press stills are marked stale. No schema, privacy collection, fees, credit path or legal conclusion
changes are implied by this visual pass.


## Read-only admin portal — shared report format (2026-10-12)

Home’s accepted format now supplies the frame, font hierarchy, navigation and open surfaces throughout the portal. Home keeps its distinct community support hero; every other desk retains its own title, content and controls.

| Surfaces | Shared format |
| --- | --- |
| Home, Trends, Audience, Revenue, Health, Product, Analytics, Departments | `PortalShell`: shared report width, scrolling header, underline navigation and bold page titles. |
| Product’s Features, Profile, Sign-in and People desks | Same shell, wrapping subnavigation and open `Panel` sections. |
| Charts, KPI values, meters, ledgers and department status | Open dividers; full summaries, source disclosures, Data rows, missing-state words and legal ledger notes retained. Enlarged text may wrap labels and values. |

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

## Weekly family activities — local source integration

Sport Quiz uses a root account route with ScreenShell, explicit Back and account Home;
the root Stack suppresses its duplicate native header. The optional invitation lives inside
Home measured chrome and existing parent/booster/sponsor/operator HQ scroll content.
Profile keeps a private quiz history link for signed-in account roles. Local dismissal and
server Skip have distinct wording; failed actions keep a notice and Refresh.
Fan Zone discovery is still gated on its independent admin and participant acceptance.
No new bottom tab, forced modal, push permission or money control accompanies these activities.
Device sizing, keyboard/screen-reader and full layout redirects remain release verification.
