# Community dashboard implementation plan

> Execute this scoped plan inline using the executing-plans skill. The owner selected the visual on 2026-10-12; no additional design approval is needed. Commits remain with the owner.

**Goal:** Apply the selected “A week of community support.” image to Home, then extend its accepted format across the admin desks at the owner’s request.

**Architecture:** Keep the server-rendered reports/revenue loaders and existing dashboard math. Add optional report presentation to the shared shell and charts so Home can use open typography and dividers. Retain the remaining measured content below the two primary donation/clip stories.

**Tech stack:** Next 15, React 19, TypeScript, Tailwind 4, existing inline SVG chart kit; Node 24.

**Visual specification:** Canva media `MAHX0lvDx3I`, selected by its headline. [Selected image](https://www.canva.com/M/MAHX0lvDx3I). Source pixels: 3456 × 1824, normalized desktop target 1728 × 912. The original screenshot reference is Canva media `MAHX0q3uyAA`. The full generation brief and displayed option mapping are in `community-preview/canva-dashboard-concepts.json`.

## Global constraints

- Read-only portal. No SQL, RPC, grants, write path, new data key, route, or dependency.
- Missing values remain “—”, with spoken missing-state text. Only donations/clips carry prior-week changes.
- Reuse the Island Daylight tokens: donations jade, clips cyan, attention gold, failures ember.
- The header scrolls normally. Preserve navigation, sign out, summaries and native Data disclosures.
- Keep all eight existing KPI meanings and remaining department/measurement content accessible.
- Copy uses Donate/donation. Donation counts are records, never families helped.
- Build in `.smoke/community-portal`, preserving the owner's original dev server.

## Task 1 — Home composition

Files: `app/(protected)/page.tsx`, `components/PortalShell.tsx`, `app/globals.css` under `apps/admin-portal`.

- [x] Add optional shell `presentation?: 'standard' | 'report'` and `heading?: ReactNode`; defaults preserve every existing consumer. A supplied `null` heading suppresses the standard page heading.
- [x] Home renders `<PortalShell active="/" presentation="report" heading={null}>` with one `h1`, “A week of community support.”, a jade donation total, donation count, compact average/clip/tab-open figures and the existing `/reports` View Trends link.
- [x] Reuse `homeKpis(input, formatUsd)` and `weekChange(current, previous)` for visible data. Render plain-language read status; source identifiers remain inside the native data-source disclosure.
- [x] Move the remaining KPI tiles into a quieter grouped list below the primary charts. Retain attention/playback, week overview, unmeasured explanations, trends and departments.
- [x] Use 320/390/768/1728 CSS-pixel checks for readable wrapping, no page overflow and visible keyboard focus.

## Task 2 — Report charts

Files: `components/charts/ChartFrame.tsx`, `components/charts/TrendChart.tsx`.

- [x] Add optional `presentation?: 'card' | 'report'` to both components. The card default remains unchanged. Report figures use the base surface and dividers, preserving summaries, every data row and source keys.
- [x] Add optional `plotHeight?: number` and `annotatePeak?: boolean` to TrendChart. Physical plot height bounds the wide report charts while axis text stays HTML. Peak text uses `peakIndex(values)` and the real formatted point.
- [x] Home donation chart uses area/jade with a peak label; clip chart uses columns/cyan. Each has its own scale. Both suppress the duplicate summed headline using `total="none"`.
- [x] Run the existing portal math/scaling tests and both app typechecks; no new dashboard formulas are needed.

## Task 3 — Verification and handoff

- [x] Attempt the authorized Playwright harness (`.smoke/community-check.cjs`). Chrome launch is blocked by macOS Mach-port permissions. Browser Bridge is available; the final checks use the real local Next app inside same-origin iframe viewports because Bridge viewport emulation resets after an action. Evidence: `.smoke/community-final-*.json`.
- [x] Inspect the selected Canva image after the user allowed `www.canva.com`. The accepted element capture is 1544 × 815; normalize it to 1728 × 912 for the combined source/render comparison in `community-preview/community-comparison.png`.
- [x] Verify data failure/missing states using only the local mock, plus keyboard reachability/focus, mouse Data activation and the normal scrolling header. Enter activation through Bridge did not succeed, and macOS blocks Playwright launch; this is recorded in the QA report.
- [x] Run `pnpm check`, `node --import ./lib/analytics-resolver.mjs --test lib/*.test.ts` from the portal, and an isolated Next build.
- [x] Update STATE §4/header, CHANGELOG, the ADM-01 tracker and `COMMUNITY_DASHBOARD_QA.md`. Record blocked checks honestly; hand off as complete only after visual QA passes.

## Outcome

Local implementation and design QA passed. See [COMMUNITY_DASHBOARD_QA.md](COMMUNITY_DASHBOARD_QA.md) for the combined comparison, data-state captures, verified interactions and the Enter/Playwright tool limitation. The ordinary preview uses synthetic data at port 3032; the owned mock is at 54398. The owner retains commits and deployment.


## Task 4 — Carry the accepted format through all desks (2026-10-12)

The owner explicitly requested the Home format on Trends, Audience, Revenue, Health, Product, Analytics and Departments. This extends the original Home-only scope above.

- [x] Default the shared shell and chart frames to report presentation; preserve Home’s custom hero.
- [x] Use open KPI blocks, meters, panels, Health tabs, Product links and revenue rows. Keep the existing font, palette, real data, disclosures and legal notes.
- [x] Move the anchor reset into Tailwind’s base layer so active and inline link colors follow their declared tokens.
- [x] Compare every desk and Product subpage at desktop and phone widths, inspect dense lower sections, and verify core navigation/Health tabs/Data disclosures.
- [x] Run the repository gates, portal tests and isolated build, then update the QA report and handoff.

Build the extension in `.smoke/format-portal` at port 3033 with the existing synthetic fixture at 54398. The original portal remains untouched by build output; the old 3032 build is the pre-extension comparison.


**Extension outcome:** Local format QA passed. All requested desks and Product subpages share the report frame, navigation, type and open surfaces; Home remains unique. Verified desktop/phone, 320px normal/doubled text, focused views and native controls/focus. Repository check: 443 tests and guards; portal 80/80; final isolated build passes. Seventeen touched source files match the copy. Concurrent Home/chart cleanup is included. Enter/Space remains unverified, and specialist review findings remain open. Ordinary Home preview: port 3033, synthetic data.
