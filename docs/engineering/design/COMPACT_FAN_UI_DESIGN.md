<!-- Approved compact fan presentation; navigation actions and safe-area behavior remain intact. -->
# Compact Local and floating fan navigation

Owner approved implementation 2026-10-21: visible icons/labels, smaller panels/fonts, background fades on scroll.

## Product contract

Local keeps Games/Polls/Boosters as one slim sticky row, icon16-18 and label12, at least44-point tap targets.
Search/header share compact chrome. Region/school filters stay available. Sponsor rail and Become Sponsor action
move into Boosters; Polls prioritize polls. Game cards are directly tappable and keep a small arrow instead of a
second full-width action panel. Names/scores remain readable, no truncated long-school single-letter layouts.
Panel padding10-12, gaps8-10, headings22-24, scores28-30; body14 and secondary12-13 are initial values.
Respect user font scaling; do not introduce global caps to conceal overflow. Shared ScreenHeading becomes compact.

Fan bar keeps Home/Activity/Upload/Spotlight/Profile destinations, SDK58 tabPress behavior and current runtime
flags. Rounded inset floating dock with light blur/transparent background; controls and active marker stay opaque.
Scroll down softens only background; up, stop, focus and interaction restore it. Reduce Motion avoids motion;
Reduce Transparency uses a solid background. Pointer events pass outside the dock; no hidden invisible controls.
Content can reach its final item with safe-area-aware reserved space, and Highlights video geometry remains correct.

## Source and boundaries

No new collection, permission, public data or write responsibility. Presentation-only exemption reviewed before
UI work; existing layout flags and source fallback remain available. Navigation scroll state is in-memory only,
throttled/thresholded to avoid React updates every pixel and reset by route focus. Compose into existing
useSurfaceUsage handler without changing telemetry definitions. Missing provider means inert default behavior.

Owner: DESIGN/MOTION with LOCAL. Main modules: UI/FanTabBar, new FanNavigationContext and scroll helper,
app/(tabs)/_layout, useSurfaceUsage, Local route/GameCard/CheerPollCard/SponsorRailCard and ScreenHeading.
No profile/Auth/SQL/Upload changes owned by this UI task. Tests check unchanged destinations, scroll direction,
stop restore, large fonts/targets and Reduce Transparency; browser checks 320/390/desktop and final content reach.

## Experiment and acceptance

Baseline: full-width64-point bar, Local heading26, search52, card padding16, gaps20 and sponsor rail above polls.
Success: menus remain readable/discoverable, more games fit at default size, final items remain reachable and
opaque controls remain clear over bright/dark content. Floating position must not shrink or cover the video viewport.
Stop/repair: retain solid dock fallback on unsupported blur/transparency; no full-hide navigation experiment.
