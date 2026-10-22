<!-- UX-07 proposal grounded in existing navigation, Calm Island tokens and allowed authored profile data; rendering/privacy verification remains separately evidenced. -->
# Primary tabs and athlete-story UI improvement plan

**Monetary wording update, 2026-10-22:** use [VOICE](../../product/VOICE.md) and [COORD-02](../../agents/COORD-02.md).
Older individual-donation,90/10 and Donate-tagline instructions below are superseded history.
Current local-source personal gifts have zero platform cut in both flag states; optional
Tip Tapua'i/processing controls default OFF. Posted history and signed versions remain intact;
hosted rollout, net fees/settlement and final counsel/store decisions remain separate gates.

**Task:** [UX-07](../../agents/UX-07.md). **Design direction:** the owner's approved Calm Island Daylight.
**Status:** bounded presentation-only scope accepted by actual outside Codex source review at
`2026-10-20T17:45:26Z`; original admin checkpoint recorded at `2026-10-20T17:46:47.469Z`.
Scoped implementation/source review and the full local integration retry passed;
bounded Story/Upload web review and the selected local app-ready checkpoint passed. Documentation
claims released to root integration; native/hosted and broader visual evidence remain separate.
**Goal:** make the current app easier to navigate and real athlete stories easier to find using existing
routes, fields, permissions and actions. Keep one app and the existing data/operational contracts.

## 1. Existing source and design context

- [UX-06](../../agents/UX-06.md) records prior local UI polish and its dated privacy/rights/visual limits.
- [UI_UX_FIGMA_POLISH](UI_UX_FIGMA_POLISH.md) distinguishes earlier Figma drafts, source and visual receipts.
- [MENU_STYLE_MAP](../MENU_STYLE_MAP.md) defines shared page/sheet chrome, tokens and intentional surfaces.
- [VOICE](../../product/VOICE.md) owns money words and the factual support/story message.
- `AthleteProfileView.tsx` already accepts authored `aboutBio` separately from generated `bio`; own profile
  supplies `profiles.bio`. The current authored text stays in the Highlights pane. Independent inspection
  of `(tabs)/user/[id].tsx` confirmed public `aboutBio`/social props come from its public-profile DTO;
  `lib/roster.ts` uses the existing public getter. Root's route explorer confirmed privacy filtering and
  ownership guards. This does not establish hosted policy execution.

This is a source-based baseline. Existing historical screenshots are not fresh audit evidence. Capture the
implemented routes in the same viewport/state before claiming a rendered review. No Figma/cloud operation
or new image/biography asset is part of this documentation assignment.

## 2. Bounded design proposal

| Existing surface | Proposed presentation improvement | Boundary to preserve |
| --- | --- | --- |
| Home / Highlights | Clear heading and current section/filter hierarchy; easier existing athlete/profile entry. | Existing player behavior, selected filters, paging, reactions, story/photo rights and action destinations. |
| Activity | Clear group headings, readable rows and factual empty/error guidance. | Same collections, event meaning, privacy and existing navigation/actions. |
| Upload ＋ | Keep chooser options and short helper copy easy to distinguish and tap. | Same existing composers; draft lifetime, required rights/attestations and review/final-submit sequence. |
| Spotlight | Improve person/title/ranking hierarchy and existing profile links. | Real source values, actual eligibility/status and unknown states; no invented award or engagement claims. |
| Profile / public athlete | Give already displayed authored text a named story section and readable hierarchy in the existing Highlights pane. | Subject-only data, audience/minor/block/school filters, existing panes/controls and current donation/verification semantics. |

Use existing colors/type/spacing/menu metrics and real source assets/icons. Runtime-published theme settings
remain authoritative; source polish does not publish new settings. Keep persistent navigation outside page
scrolling. Existing full-screen video and work-density surfaces retain their specific behavior and contrast.
Root's final path list defines implemented coverage; the proposal does not claim every app screen changed.

The accepted source scope is shared `ScreenHeading.tsx`, `UI/FanTabBar.tsx`, `UI/AnimatedButton.tsx`,
`UI/EmptyState.tsx`, `Profile/AthleteProfileView.tsx`, existing tab routes index/activity/spotlight/
local/index/drip/beyond, `Reels/UploadChoiceSheet.tsx` and `SpotlightAwardCard.tsx` if needed.
Shared targets use 44 points, headings gain semantics/wrapping, and OS Reduce Motion suppresses press
scale and existing tab transitions without changing callbacks. EmptyState retains its existing admin
guard/action while increasing its 40-point target. Spotlight distinguishes pending initial load from
empty results; Drip uses the existing filter selection without adding reset/navigation controls.

The original actual source-only exemption decision and conditions are recorded in
[UX-07](../../agents/UX-07.md). No material blocker was found in this bounded presentation scope.

## 3. Exemption and implementation order

1. Root records exact paths, existing callbacks/data and the explicit presentation-only reason in the
   feature record before app edits. Independent review verifies unchanged behavior/privacy boundaries.
2. Preserve nonempty exemption evidence and its admin-ready checkpoint under
   [FEATURE_ADMIN_WORKFLOW](../FEATURE_ADMIN_WORKFLOW.md); the app contract remains required.
3. Implement the approved presentation scope. Reuse existing controls/state; record control-map ownership
   and switch/telemetry presence or deliberate absence. Do not add a collector to measure this polish.
4. Run meaningful existing/focused tests and inspect the rendered selected routes. Independently review
   copy/privacy/accessibility, add later app evidence and pass the selected app-ready gate before handoff.
5. Root integrates common state/history/generated records and actual result/limits; code/source checks and
   user/device/release evidence remain distinct. Preserve concurrent work throughout.

Stop and reclassify if work adds data, business behavior, writes, permissions, collection or reporting duty.
An existing private field becoming newly public is an access change. Do not bypass admin-first or existing
money/privacy/security review through a presentation label.

## 4. Copy and data/privacy review criteria

- Use actual authored story text; do not write an athlete's biography or substitute a generated credential
  summary as personal narrative. Empty copy must be factual and optional, with no pressure to disclose.
- Public profiles use the viewed athlete's allowed data, never the signed-in viewer's private profile as a
  fallback. Preserve missing/private/blocked/unknown-age behavior and school visibility restrictions.
- Display only already authorized biography/media/social fields. No private child birth details, contact,
  schedule, guardian/account/financial identifiers or inferred school information enters this presentation.
- Editing remains the existing permitted owner's action. Guests/public viewers never gain editing or another
  account's management controls. Sharing, media publication and account consent rules stay unchanged.
- Donate remains the money verb; existing amount/options/review, 90/10 disclosure, No tip default, recipient
  and held/freeze/payment guards remain. A story never promises recruitment, scholarships or performance pay.
- Preserve unknown/error/status meaning. No fabricated testimonials, supporter counts, engagement growth,
  verification, award, payout or live-game labels are used to make a screen look complete.

## 5. Accessibility and Support review criteria

| Review area | Required checks |
| --- | --- |
| Names / semantics | Clear screen/control labels and roles; selected and disabled states announced; decorative imagery excluded appropriately; no duplicated actionable title. |
| Targets / layout | At least 44×44-point native target reference from `MENU_METRICS`; labels wrap without clipping or overlap at phone widths. WCAG 2.5.8's AA minimum is 24 CSS pixels; do not miscite it as the 44-point native rule. |
| Reflow / text | Normal and large-text/200% web layouts at 320/390 widths; no obscured story, navigation, error or action; actual native Dynamic Type separately tested. |
| Focus / keyboard | Logical reading/focus order, keyboard access, visible focus on web, modal focus/close/return, safe keyboard/inset fit and Back preserving selections/drafts. |
| Contrast / motion | Use current Daylight/video tokens; review text/control/status contrast in actual configured state; honor reduced motion and avoid color-only meaning. |
| Loading / failure | Existing loading/empty/error/unavailable/paused states remain distinct; retry/report paths stay discoverable and usable with their actual disabled/loading rules. |
| Evidence / repair | Tie an issue to exact route/state/source/environment and sanitized reproduction; retain failed/unrun cases and next owner. Revalidate fixes independently; client signals or missing measurements do not establish healthy behavior. |

Source inspection and mocked tests do not certify assistive technology or native fit. Screenshots can prove
visible layout only; VoiceOver/TalkBack, keyboard, gesture/player, device font and configured private-state
checks need actual procedure/results. Existing Support/reporting contracts suffice unless final scope changes
them; this plan introduces no new operational reporting duty.

## 6. Review and evidence handoff

Record final source/controls and actual executor/model/tool/date, review environment, exemption checkpoint,
test commands/counts/results, accepted screenshot paths/states, denied/public/owner/empty cases, unresolved
visual/native/hosted limits and next owner in [UX-07](../../agents/UX-07.md). DESIGN leads visual decisions;
Accessibility, Privacy/Voice and QA retain independent review. No role/protocol change is requested.

The local source cache/release carries code/docs as governed source; active concurrent edits retain the
existing exact-source verification limits. New presentation does not authorize publishing runtime themes,
app builds, SQL or live configuration. Root supplies actual implementation evidence before final review.

## 7. Actual scoped implementation handoff

The twelve enrolled app paths were implemented and independently reviewed in local source by outside
Codex `/root/redundancy_documentation` at `2026-10-20T17:52:07Z`. Source Design/Accessibility/privacy/copy/
Support review accepted the described presentation boundaries with no material blocker. Exact root/worker
checks, original admin checkpoint, reviewer results and limits are recorded in [UX-07](../../agents/UX-07.md).

Completed source coverage is common primitives plus Home/Highlights, Activity, Upload chooser, Spotlight,
Profile/public athlete sheet, Local, Drip and Beyond. Story now names the existing subject-only authored
text/social block in Highlights; it neither generates text nor changes the default pane or privacy source.
Existing tab events, admin guards, filters, donation/rights and upload destinations remain. Shared targets,
wrapping/header semantics and reduced-motion feedback improve existing controls. Concurrent Home telemetry
is preserved and excluded from this presentation exemption.

Root's fresh `8083` blank-key fixture replaces a mixed-role `8081` baseline. Final rendered screenshots/
interactions are pending, with native assistive/private/hosted evidence still separate.
The current result does not describe every admin, game, checkout, settings or detail screen as redesigned.

Root's original integration retry records both typechecks, 212 mobile suites / 1,849 tests and all local
guards passing after preserving the first exit-map source-awareness failure and issuing a bounded change
notice. At `2026-10-20T18:04:23Z`, independent source follow-up also accepted AnimatedButton's explicit
web selected/disabled attributes because they mirror existing state while retaining native semantics and
callback guards. Read original paths and raw-source/exact-verification limits in [UX-07](../../agents/UX-07.md).
No blank, timed-out or route-shifted capture is visual acceptance.

Independent source follow-up at `2026-10-20T18:09:04Z` accepted a bounded scroll area for tall upload
chooser content, capped to current window height with the existing dismiss handle outside it. All
existing choices/Cancel callbacks and review copy remain. Actual large-text/safe-area rendering and
final browser evidence still require original receipts; source structure alone proves no fit.

## 8. Actual bounded Story visual review

At `2026-10-20T18:15:52Z`, the independent documentation/accessibility executor viewed root's validated
390-pixel normal-text and 320-pixel/CSS 200% Story PNGs. The normal capture visibly supports the named
Story/readable authored-text hierarchy, selected Highlights and separate factual public-empty section.
The first enlarged capture supports only upper-hero reflow. A subsequent validated lower-scroll capture
was independently reviewed at `2026-10-20T18:21:10Z`: full enlarged Story and public-empty text wrap
readably without clipping. Interactive section navigation and native font scaling remain separate.
All twelve current scoped source hashes matched the original receipt. Exact files, procedures and
remaining native/keyboard/private/hosted/entire-app limits are recorded in [UX-07](../../agents/UX-07.md).

The final post-upload-scroll `pnpm check` passed both typechecks, 212 mobile suites / 1,849 tests and
all included guards. This reviewer read root's original final log/updated integration receipt and verified
all twelve enrolled app hashes still matched. End-of-run source ensure deferred on another capture's
lock (`sourceCurrent: null`, `readyToCutOver: false`); no capture/current-source/exact-release success
is inferred. Validated normal-text Upload at 320×640 visibly includes both choices and Cancel; the enlarged
top/bottom captures confirm bounded scrolling and reachable Cancel/Close. Actual browser assertions
confirmed Highlight/Beyond callbacks and Cancel dismissal before an optional next-page open failed.
The complete QA script exited 1 at that open, so no overall-script or hidden-browser pass is claimed.
The selected local app-ready gate passed
at the actual later checkpoint, with original admin history retained. Concurrent edits and native/hosted/
entire-app visual limits are preserved. See [UX-07](../../agents/UX-07.md) for exact receipts and gate scope.

Final independent review at `2026-10-20T18:24:00Z` accepted the documented local Story/Upload layout
and completed callback evidence, read original failure logs and matched all twelve enrolled app hashes.
Both owned documents are frozen for root integration. Native assistive/font/motion, keyboard/focus,
configured/hosted/private/payment states, every detail/admin/game route and engagement outcomes still
require actual evidence; this bounded polish makes no whole-app accessibility or release guarantee.
