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
| `Reels/LiveMatchBanner.tsx` | Separate team/score rows use the shared recorded-state rules; no default clock or invented live status. Existing live subscription, game navigation and dismissal remain. |

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
