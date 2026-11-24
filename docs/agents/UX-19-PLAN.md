<!-- Step-by-step build plan for the owner-approved UX-19 compact fan tabs design. -->
# UX-19 Compact Fan Tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the five fan tabs compact and consistent (one heading style, tighter panels, one frosted adaptive nav bar) without shrinking text or changing behaviour.

**Architecture:** Approach B: hand-tune existing files. One shared *style token* (`SECTION_HEADING` in `theme/fonts.ts`, beside `TYPE`) gives every tab the same heading; no new components. Each task owns one surface and ends with its Jest suite green and a commit.

**Tech Stack:** Expo SDK 58, React Native 0.88, Reanimated 4.7, expo-blur, Jest + RNTL 14, Expo web + browser-bridge for screenshots.

**Spec:** [UX-19.md](UX-19.md)

## Global Constraints

- Text: body `TYPE.body` 14/20, captions `TYPE.caption` 12/16; never smaller; font scaling stays on.
- Every pressable keeps `minHeight: 44` (and `minWidth: 44` for icon-only buttons).
- No data, query, route, telemetry, copy-meaning or behaviour change; no admin, portal, video player or directory restyle.
- Every touched file keeps a header comment that says why (CONVENTIONS §5, `pnpm comments:check`).
- Run Jest from `apps/mobile`: `../../node_modules/.bin/jest --watchman=false <path>`; Node 24 at `~/.local/node/bin`.
- Stage named paths only: `git -c core.fileMode=false add -- <paths>`; never `git add -A`.

## Review Focus

1. **Contrast on the frosted bar:** with tab faces removed, labels must stay readable while the dock is softened during scroll and over bright video → softened backdrop opacity rises to 0.78; Task 3 asserts it.
2. **Large text:** at 200% text the segmented tracks and one-row chips must wrap or scroll, never clip → `flexWrap`/horizontal scroll kept; screenshot pass in Task 8.
3. **Android / Reduce Transparency:** no blur → solid bar in the matching light or dark colour → Task 3 asserts the solid dark colour.
4. **Reduce Motion:** the active pill jumps instead of sliding → existing `placeIndicator` reduce-motion branch kept; Task 3 asserts the pill renders with Reduce Motion on.
5. **Hidden-row semantics:** grouping Activity rows must keep each row's own button role and label → Task 4 asserts the row role/label inside the group.

---

### Task 1: Enrol the presentation exemption and add the heading token

**Files:**
- Modify: `docs/agents/feature-admin.json` (append a feature entry)
- Modify: `apps/mobile/src/frontend/theme/fonts.ts`
- Test: `apps/mobile/src/frontend/theme/__tests__/fonts.test.ts` (create if absent)

**Interfaces:**
- Produces: `SECTION_HEADING: TextStyle` = `{ ...TYPE.section, fontFamily: FONT.displayBold, fontWeight: 'normal', letterSpacing: -0.2 }` (16/21, Bricolage Bold). Callers add `color` and spacing.

- [ ] **Step 1:** Append `UX-19-COMPACT` to `feature-admin.json`, modelled on `UX-18-DENSITY`: `owner: "DESIGN"`, `exemption.kind: "presentation-only"`, reason "Owner asks for compact consistent fan tabs: one heading style, tighter panels and one frosted adaptive nav bar. Text stays 14/12, 44pt actions, no data or operational capability.", `reviewedBy: "Claude Code session (owner-run) and owner design approval 2026-11-23"`, `app.route: "/activity"`, `app.paths` = every file in Tasks 2–7, `readiness.admin.evidence` → `docs/agents/UX-19.md`.
- [ ] **Step 2:** Run `pnpm feature-admin:check --feature UX-19-COMPACT --require admin-ready` from the repo root. Expected: exit 0. (Required before any app edit.)
- [ ] **Step 3: Write the failing test** `it('SECTION_HEADING is the 16/21 Bricolage Bold section style')`: `expect(SECTION_HEADING).toMatchObject({ fontSize: 16, lineHeight: 21, fontFamily: FONT.displayBold, fontWeight: 'normal' })`.
- [ ] **Step 4:** Run it. Expected: FAIL (`SECTION_HEADING` not exported).
- [ ] **Step 5:** Export `SECTION_HEADING` from `theme/fonts.ts` (doc comment: UX-19, one heading style for every fan tab).
- [ ] **Step 6:** Run it. Expected: PASS.
- [ ] **Step 7:** Commit `feat(UX-19): enrol presentation exemption and add SECTION_HEADING`.

### Task 2: Tighter page header

**Files:**
- Modify: `apps/mobile/src/frontend/components/ScreenHeading.tsx`
- Test: `apps/mobile/src/frontend/components/__tests__/ScreenHeading.test.tsx` (create)

- [ ] **Step 1: Write the failing tests:**
  - `it('puts the fan kicker badge on the title row')`: render with `kicker="Friday"`, mocked pathname `/activity`; the header `Text` and kicker `Text` share a parent whose flattened style has `flexDirection: 'row'`.
  - `it('draws a 32pt fan underline and keeps the role heading unchanged')`: fan underline width 32; with pathname `/parent` the kicker stays above the title (no shared row) and the underline width stays 48.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** For fan headings only, wrap the title and kicker badge in a `titleRow` (`flexDirection: 'row'`, `flexWrap: 'wrap'`, `alignItems: 'center'`, `justifyContent: 'space-between'`, `gap: 6`), title first. Add `fanUnderline: { width: 32 }`. Role headings are unchanged. Lede stays `MoreText lines={2}`.
- [ ] **Step 4:** Run the new test plus `Local/__tests__/LocalTab.test.tsx` and `Profile/__tests__/HqLifetime.test.tsx`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(UX-19): compact fan page header`.

### Task 3: One frosted, adaptive nav bar with a sliding pill

**Files:**
- Modify: `apps/mobile/src/frontend/components/UI/FanTabBar.tsx`
- Test: `apps/mobile/src/frontend/components/UI/__tests__/FanTabBar.test.tsx`

**Interfaces:**
- Produces testIDs: `fan-dock-tint` (colour overlay), `fan-dock-pill` (active pill), `fan-dock-fade` (fade above the bar). Existing `fan-dock-wrap` / `fan-dock-backdrop` unchanged.

- [ ] **Step 1: Write the failing tests** (reuse the suite's existing render helper):
  - `it('draws one continuous bar: destinations paint no face of their own')`: for every `tab` role, `StyleSheet.flatten(style).backgroundColor` is `undefined` and `minHeight` is 44.
  - `it('uses dark glass while Home is focused and light glass elsewhere')`: focused `index` → `fan-dock-tint` background `colors.videoSurface`; focused `activity` → the runtime surface colour.
  - `it('keeps the solid dark bar without blur under Reduce Transparency on Home')`: tint opacity 1 and colour `colors.videoSurface`.
  - `it('shows the active pill and the fade, also with Reduce Motion')`: `fan-dock-pill` and `fan-dock-fade` exist; repeat with Reduce Motion mocked true.
  - `it('softened backdrop stays at least 0.78 opaque')`: after the softened trigger the existing test uses, backdrop opacity `>= 0.78`.
- [ ] **Step 2:** Run. Expected: the new cases FAIL; existing cases PASS.
- [ ] **Step 3:** Implement:
  - `dark = state.routes[state.index]?.name === 'index'`.
  - `tabInner`: remove `backgroundColor`, `borderRadius`, `marginHorizontal`.
  - Backdrop: `BlurView tint={dark ? 'dark' : 'light'} intensity={32}`. Overlay (`fan-dock-tint`) colour is `dark ? colors.videoSurface : live.theme.surface`, opacity `solid ? 1 : 0.72`. Border colour is `dark ? KIT.onVideoLine : colors.border`.
  - Softened opacity changes `0.46 → 0.78`.
  - Inactive ink is `dark ? colors.onVideoMuted : colors.textMuted`; active ink is `dark ? colors.glow : TAB_ACCENTS.index.color`. Pass a `dark` prop to `TabButton`. Upload label ink is `dark ? colors.onVideo : FOCAL.jadeInk`.
  - Replace the 2pt top indicator with `fan-dock-pill`: `top: 4, bottom: 4`, `borderRadius: 999`, background `dark ? 'rgba(46,230,166,0.16)' : FOCAL.mistJade`, `zIndex: 0`. In `placeIndicator`, width becomes `box.width - 8` and x becomes `box.x + 4`. Keep the spring and the reduce-motion branches.
  - `fan-dock-fade`: absolute, `bottom: '100%'`, `left: 0`, `right: 0`, `height: 24`, `pointerEvents="none"`. It holds four equal bands of `dark ? colors.videoSurface : live.theme.background` at opacity 0.15 / 0.35 / 0.6 / 0.85, top to bottom.
  - Update the file header (UX-19: one continuous frosted bar; tab faces removed so the blur shows; contrast kept by the 0.78 softened floor).
- [ ] **Step 4:** Run the suite plus `app/(tabs)/__tests__/fan-role-access.test.tsx`. Expected: PASS, including the unchanged `paddingBottom: 34` wrap measurement.
- [ ] **Step 5:** Commit `feat(UX-19): frosted adaptive fan bar with sliding pill`.

### Task 4: Activity and Notifications

**Files:**
- Modify: `apps/mobile/src/frontend/components/Activity/NotificationInbox.tsx`
- Modify: `apps/mobile/app/(tabs)/activity.tsx`
- Modify: `apps/mobile/src/frontend/components/UI/MoreText.tsx` (inline toggle alignment only)
- Modify: `docs/agents/UX-19.md` (Part 2 tint line: the mist sits on the segment track)
- Test: `apps/mobile/src/frontend/components/Activity/__tests__/NotificationInbox.test.tsx`, `apps/mobile/app/(tabs)/__tests__/tab-story-states.test.tsx`

**Interfaces:**
- Consumes: `SECTION_HEADING` (Task 1).
- Produces testIDs: `notification-segments`, `activity-updates-group`.

- [ ] **Step 1: Write the failing tests:**
  - NotificationInbox `it('groups Inbox and Archived in one segment track with Refresh as a 44pt icon button')`: both `Current notifications` and `Archived notifications` tabs are inside `notification-segments`. `Refresh notifications` has no visible `Refresh` text, and its style has `minWidth: 44, minHeight: 44`.
  - tab-story-states `it('groups Activity updates in one card and keeps each row its own button')`: `activity-updates-group` contains the rows. Each pressable row keeps `accessibilityRole="button"` and its label. The `Your updates` header style has `fontFamily: FONT.displayBold`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** NotificationInbox:
  - The heading row holds title, unread count and the Refresh icon button (`Ionicons 'refresh'` 18, `minWidth/minHeight: 44`, no border, same label/handler/disabled state).
  - `notification-segments`: `flexDirection: 'row'`, `backgroundColor: FOCAL.mistJade`, `borderRadius: 12`, `padding: 2`, `gap: 2`. Segments are `flex: 1`, `minHeight: 44`, no border, `borderRadius: 10`. Selected is `backgroundColor: FOCAL.jadeInk` with label `colors.onAccent`; idle label is `colors.textMuted`.
  - Card: `padding: 12`, `gap: 6`, `borderRadius: radii.lg`, `cardShadow`, **no border**.
  - Title uses `SECTION_HEADING`.
- [ ] **Step 4:** MoreText `inlineToggle` style becomes `justifyContent: 'flex-start'` plus `paddingTop: 0`, so "More" sits on the first text line. The 44pt box stays.
- [ ] **Step 5:** activity.tsx:
  - `sectionTitle` becomes `{ ...SECTION_HEADING, color: colors.text, marginTop: 6 }`.
  - Wrap the `items.map` output in `<View testID="activity-updates-group" style={styles.group}>`, with `group: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' }`.
  - `row` drops `borderWidth`, `borderRadius` and its own `backgroundColor`, and becomes `paddingVertical: 10`, `paddingHorizontal: 12`. Rows after the first add `borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border`.
  - `rowActionable` keeps `backgroundColor: FOCAL.mistJade` and drops its border.
  - `content.gap` becomes 8.
- [ ] **Step 6:** Run both suites plus `Activity/__tests__/*` and `UI/__tests__/MoreText*`. Expected: PASS.
- [ ] **Step 7:** Commit `feat(UX-19): compact Activity and notification segments`.

### Task 5: Local

**Files:**
- Modify: `apps/mobile/app/(tabs)/local/index.tsx` (styles `sectionTitle`, `search`, `hubCopy`, `content`)
- Modify: `apps/mobile/src/frontend/components/Local/LocalHubMenu.tsx`
- Modify: `apps/mobile/src/frontend/components/UI/FilterPills.tsx`
- Modify: `apps/mobile/src/frontend/components/Local/GameCard.tsx`
- Test: `apps/mobile/src/frontend/components/Local/__tests__/GameCard.test.tsx`, `apps/mobile/src/frontend/components/Local/__tests__/LocalTab.test.tsx`, `apps/mobile/src/frontend/components/Profile/__tests__/RoleSwitcherModal.directory.test.tsx`

- [ ] **Step 1: Write the failing tests:**
  - LocalTab `it('uses the shared section heading and one Local hub track')`: the `Live matchups` header has `fontFamily: FONT.displayBold` and no `borderLeftWidth`. The `Local hub` tablist style has `backgroundColor: FOCAL.mistJade`.
  - GameCard `it('puts HOME/AWAY on the team line and venue with Boosted by on one row')`: the `HOME` text and the team name share a parent with `flexDirection: 'row'`. `Boosted by` and the venue text share one row.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** local/index.tsx:
  - `sectionTitle` becomes `{ ...SECTION_HEADING, color: colors.text, marginTop: 6 }` (drop the border bar).
  - `search` becomes `{ ...TYPE.body, ...figtree('400') }` (was 13).
  - `hubCopy` becomes `{ ...TYPE.body, ...figtree('600'), color: colors.textMuted }`.
  - `content.gap` becomes 8.
  - `directoryEntry` drops its border and gets `backgroundColor: colors.surface` with `KIT.shadowSoft`.
- [ ] **Step 4:** LocalHubMenu. Row: `backgroundColor: FOCAL.mistJade`, `borderRadius: 12`, `padding: 2`, `gap: 2`. Tab: no border, no surface background, `borderRadius: 10`, `minHeight: 44`. Selected: `backgroundColor: FOCAL.jadeInk`, with icon and label `colors.onAccent`.
- [ ] **Step 5:** FilterPills: `pillIdle` becomes `backgroundColor: FOCAL.mistJade`, `borderColor: 'transparent'`; the indicator `backgroundColor` becomes `FOCAL.jadeInk`; `paddingHorizontal` becomes 12. The row already scrolls horizontally.
- [ ] **Step 6:** GameCard:
  - The `side` caption moves into a `nameRow` (`flexDirection: 'row'`, `alignItems: 'baseline'`, `gap: 6`, `flexWrap: 'wrap'`) before `teamName`.
  - The venue row and the sponsor row merge into one `metaRow` (`flexDirection: 'row'`, `flexWrap: 'wrap'`, `alignItems: 'center'`, `gap: 8`), venue first.
  - `card.gap` becomes 6.
  - Accessibility labels unchanged.
- [ ] **Step 7:** Run the three suites plus `Local/__tests__/*`. Expected: PASS.
- [ ] **Step 8:** Commit `feat(UX-19): compact Local hub, chips and score cards`.

### Task 6: Spotlight

**Files:**
- Modify: `apps/mobile/src/frontend/components/Spotlight/LeaderboardsBoard.tsx`
- Modify: `apps/mobile/src/frontend/components/Spotlight/SpotlightAwardCard.tsx`
- Test: `apps/mobile/src/frontend/components/Spotlight/__tests__/LeaderboardsBoard.test.tsx`

- [ ] **Step 1: Write the failing test** `it('shows boards in one scrolling row under the shared heading')`: the `tablist` is inside a horizontal `ScrollView`. The `Boards · This week` style has `fontFamily: FONT.displayBold` and no `textTransform`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** LeaderboardsBoard:
  - `section` becomes `{ ...SECTION_HEADING, color: colors.text }`.
  - Wrap `tabs` in `<ScrollView horizontal showsHorizontalScrollIndicator={false}>`; `tabs` drops `flexWrap` and uses `gap: 6`.
  - `tab` becomes borderless with `backgroundColor: FOCAL.mistGold`, `paddingHorizontal: 12`, `minHeight: 44`. `tabSelected` becomes `backgroundColor: FOCAL.goldInk`, label `colors.onAccent` (gold stays the awards colour).
  - `row` becomes `paddingVertical: 10`, with `borderWidth` removed (keep `cardShadow`). `rowFirst.paddingVertical` becomes 14.
  - `empty.padding` becomes 12.
- [ ] **Step 4:** SpotlightAwardCard: card padding becomes 12 and inner gap 6; gold tint and border kept.
- [ ] **Step 5:** Run the suite plus `app/(tabs)/__tests__/spotlight-recovery.test.tsx`. Expected: PASS.
- [ ] **Step 6:** Commit `feat(UX-19): compact Spotlight boards`.

### Task 7: Profile and Home

**Files:**
- Modify: `apps/mobile/src/frontend/components/Profile/AthleteProfileView.tsx` (`sectionTitle`, `story`, `quickActions`/`shareHit`)
- Modify: `apps/mobile/src/frontend/components/Profile/ProfileHeroAvatar.tsx` (hero padding)
- Modify: `apps/mobile/src/frontend/components/Filmers/FilmerCard.tsx`
- Modify: `apps/mobile/src/frontend/components/Reels/HomeCampaignCopy.tsx`, `apps/mobile/src/frontend/components/Reels/LiveMatchBanner.tsx`, `apps/mobile/src/frontend/components/Local/RivalryWeekBanner.tsx`
- Test: `apps/mobile/src/frontend/components/Profile/__tests__/ProfileHeroAvatar.test.tsx`, `apps/mobile/src/frontend/components/Reels/__tests__/LiveMatchBanner.test.tsx`, `apps/mobile/app/(tabs)/__tests__/public-profile-navigation.test.tsx`

- [ ] **Step 1: Write the failing test** in public-profile-navigation `it('uses the shared section heading for Story and Highlights')`: both headers have `fontFamily: FONT.displayBold` and `fontSize: 16`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** AthleteProfileView:
  - `sectionTitle` becomes `{ ...SECTION_HEADING, color: colors.text }`.
  - The `story` card uses `padding: 12` and `gap: 4`, with no `minHeight`.
  - `quickActions` becomes `flexDirection: 'row'`, `flexWrap: 'wrap'`, `gap: 8`, so Share sits beside the support action. `shareHit` becomes `minHeight: 44`, `paddingHorizontal: 12`.
- [ ] **Step 4:** ProfileHeroAvatar card padding becomes 12 and its stat row gap 8. FilmerCard padding becomes 12, gap 6, and the gap before its button becomes 8.
- [ ] **Step 5:** Home:
  - The HomeCampaignCopy kicker becomes `{ ...SECTION_HEADING, color: colors.onVideo }`, with no uppercase. Its lede stays `TYPE.body`.
  - LiveMatchBanner and RivalryWeekBanner: vertical padding becomes 8 and inner gap 4. Score digits and the rivalry tint stay.
- [ ] **Step 6:** Run the three suites plus `Filmers/__tests__/*`, `Local/__tests__/RivalryWeekBanner.test.tsx` and `app/(tabs)/__tests__/highlights-jump.test.tsx`. Expected: PASS.
- [ ] **Step 7:** Commit `feat(UX-19): compact Profile and Home headings and banners`.

### Task 8: Screenshots, full gate and records

**Files:**
- Modify: `docs/agents/UX-19.md` (Results), `docs/agents/feature-admin.json` (app-ready evidence), `docs/STATE.md` (§4 + Last updated), `CHANGELOG.md`, `docs/engineering/MENU_STYLE_MAP.md`, generated IP/exit files.

- [ ] **Step 1:** With Expo web on :8091, capture Home, Activity, Local, Spotlight and Profile at 390×844 and 320×640, plus Activity and Local at 200% text (`document.documentElement.style.fontSize='200%'`), into `/tmp/ux19-shots/after-*.png`. Also capture Drip, Home search and the role switcher (the other FilterPills users). Check that every tab heading matches, there's no clipping or horizontal overflow, and the bar is dark on Home and light elsewhere.
- [ ] **Step 2:** Run the full `pnpm check` from the repo root, finishing with `exit:sync ensure --state-dir "$HOME/Library/Application Support/Tapuai/exit-source-documents-ala"`. Expected: every step exits 0. Regenerate stale generated files (`node scripts/data-map.mjs`, `pnpm security:infra`, `pnpm ip:sync`) and re-run until clean.
- [ ] **Step 3:** Run `pnpm exit:map --acknowledge --by "Claude Code session 2026-11-23 (UX-19)"`, then add app-ready evidence and run `pnpm feature-admin:check --feature UX-19-COMPACT --require app-ready`. Expected: exit 0.
- [ ] **Step 4:** Write the UX-19 Results (screens, test counts, gaps: native feel is the owner's phone check), a STATE §4 line + Last updated, a CHANGELOG entry and the MENU_STYLE_MAP rows.
- [ ] **Step 5:** Commit `docs(UX-19): results, records and gate currency`. Do not push: publishing is the owner's call.
