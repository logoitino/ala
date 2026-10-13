# Community Home design QA

**Date:** 2026-10-12  
**Scope:** The owner's selected “A week of community support.” direction, implemented in the existing read-only admin Home.  
**final result: passed** — local Home design, responsive layout, data states, mouse controls and keyboard focus. No remaining actionable P0–P2 visual issues; Enter activation has the tool limitation below.

## Visual evidence

- Selected Canva media: [MAHX0lvDx3I](https://www.canva.com/M/MAHX0lvDx3I). The generation was grounded in the actual Home screenshot, media `MAHX0q3uyAA`.
- [Selected reference capture](community-preview/community-selected.png): an actual Browser Bridge image-element screenshot, 1544 × 815; Canva metadata lists the original at 3456 × 1824.
- [Combined comparison](community-preview/community-comparison.png): selected reference on the left, actual rendered Home on the right. Reference normalized to 1728 × 912; real app captured at that same CSS viewport with matching synthetic donation/clip totals and seven daily points. The small aspect ratio difference is under 0.1%.
- [Desktop Home](community-preview/community-home-1728.png), [768px Home](community-preview/community-home-768.png), [390px Home](community-preview/community-home-390.png), [320px Home](community-preview/community-home-320.png).

The accepted browser captures render the real Next production build in a same-origin iframe. Its `innerWidth`, `innerHeight`, URL, heading and page scroll width are checked before and after capture, and the PNG dimensions are checked. This uses actual CSS media queries without resizing the user's browser window. Earlier top-level Browser Bridge viewport emulation reset to the physical window dimensions and was rejected. The authorized Playwright attempt could not launch Chrome because of macOS Mach-port permissions; it is not a passing browser check.

## Fidelity review

| Surface | Review |
| --- | --- |
| Fonts | Existing Avenir Next/system stack, heavy title and donation figure, tabular numeric values, quieter labels. Matches the selected hierarchy; no new font dependency. |
| Spacing | Open overview, full-width donation area chart, compact clip chart with comparison aside. Repeated card chrome removed from the primary report. Chart spacing was tightened after the combined comparison to bring the at-a-glance line into the desktop viewport. |
| Colors | Existing jade `#00733c` for donations, cyan `#00707e` for clips, ink on light canvas. The selected mockup's desaturated generated colors are translated to the established product tokens. White action text explicitly verified against jade. |
| Image quality | Existing product branding and icons retained. The selected design contains no photo or illustration requiring a new raster asset. Charts remain the repository's actual data SVGs, with HTML labels, summaries and native tables. |
| Copy | Exact selected headline. Counts say recorded donations and uploaded clips; tab opens remain events, not distinct people. Real read time and UTC windows replace fixed sample dates. Money formatting retains cents and the existing legal ledger hints. |

## Issues found and fixed

| Priority | Finding | Fix / evidence |
| --- | --- | --- |
| P1 | “View Trends” initially rendered dark text on jade because the global anchor rule overrode a layered utility. | Scoped white foreground rule; browser computed color `rgb(255, 255, 255)` on `rgb(0, 115, 60)`. |
| P2 | Initial hero/chart spacing hid the clip story and later the at-a-glance line below the desktop view. | Reduced hero/plot height and report figure margins. The final combined source/render comparison was reopened and reviewed. Both primary chart stories and the at-a-glance line now fit in the 1728 × 912 view. |
| P2 | At 320px with 200% root text size, the long title word and lower context panels pushed the page sideways; navigation labels also crowded together. | Wrap the title and source labels, use flexible navigation and supporting metric columns, and constrain the Home context grid and headings. The final production build stays within 305px content width in the 320px / 200% text viewport, including the opened source disclosure. |

## Verification

- Isolated Next production build passes; the owner's original dev server and environment file are preserved. Preview uses only owned synthetic Supabase fixtures.
- `pnpm check` passes: 78 suites / 443 tests, both app typechecks, and documentation/copy/boundary/comment/agent/client-key guards.
- Portal Node tests: 72 passed, 0 failed.
- Data formulas, eight KPI meanings, loaders and missing-versus-zero guards are reused. Only donations and clips have prior-week changes.
- Accepted layouts: 1728/768/390/320 × 912 CSS pixels, plus 320px with 200% root text. Before/after viewport and PNG checks pass. [Phone charts](community-preview/community-home-390-report.png) and [enlarged source disclosure](community-preview/community-home-320-large-sources.png).
- Ordinary-page Shift+Tab focuses the donation Data control at y=9.95–33.95, with a visible 2px ring and an unobscured hit target; the scrolling header ends at y=-507. [Focus screenshot](community-preview/community-desktop-keyboard-focus.png). Mouse opening reveals all seven exact daily amounts; View Trends reaches `/reports` with heading “Trends”.
- [Missing keys](community-preview/community-keys-390.png): dashes, missing-count explanation, no chart rows, no alerts. [Failed RPCs](community-preview/community-error-390.png): two failure alerts, dashes, no fabricated zero or chart rows. Normal synthetic data was restored, and the ordinary Home preview was reloaded without the iframe harness.
- Filtered browser console error logs return zero entries. Bridge’s `--count` reports the overall log count, so it was not used as an error count.
- Aggregate evidence: `.smoke/community-browser-final.json`; layout captures in `.smoke/community-final-normal.json`, ordinary-page interactions in `.smoke/community-native-result.json`, read states in `.smoke/community-final-keys.json` / `community-final-error.json`. Earlier rejected route/viewport captures are retained as failed attempts.
- All five changed source files match the isolated build hashes in `.smoke/community-final-source-hashes.json`.

## Follow-up polish

P3: At 320px with 200% root text, the display headline and hero amount wrap. The exact amount also remains in the body summary and native Data table. This extreme display-type layout can be tightened in a later iteration.

## Limits

Browser Bridge did not activate the native disclosure through its Enter or Space commands. Chrome could not launch through Playwright (Mach-port permission), and a separate macOS Launch Services attempt returned -54. Keyboard focus and mouse activation are verified; keyboard activation is not claimed as passing. This limitation does not indicate a known application keyboard defect: the existing native `<details>/<summary>` behavior was retained.


This is a local Home design implementation and synthetic-data verification. It does not approve the remaining ADM-01 department reviews or a release. The owner retains commits, merging and deployment.


# Portal format consistency QA — 2026-10-12

**Scope:** The owner’s follow-up request to carry Home’s format into Trends, Audience, Revenue, Health, Product, Analytics and Departments, including the four Product desks. Home keeps its unique community hero.

**final result: passed** — local format consistency, responsive layout, mouse controls and keyboard focus. The separate full-portal specialist review remains open.

## Comparison target

The accepted rendered Home is the style reference, not a content template for every desk. Each comparison pairs `community-home-1728.png` with an actual sibling page at 1728 × 912 CSS pixels. The old Trends render is also saved for a direct before/after comparison. The intentional differences are each desk’s own title, summaries, measures, legal notes and controls.

The matrix uses the real isolated production app at port 3033 with synthetic data, same-origin iframe viewports and URL/heading/dimension guards. Native interaction checks run on the ordinary page. No real browser window is resized.

## Required fidelity surfaces

| Surface | Review |
| --- | --- |
| Fonts | Shared Avenir Next/system stack, heavy page headings and numeric values, compact uppercase section and figure labels. |
| Spacing | Shared 1680px frame, scrolling header, open chart/KPI/panel surfaces, section gaps and subtle dividers. Home retains its distinct hero composition. |
| Colors | Existing Island Daylight tokens and measure colors. Anchor reset moved into the base layer so declared link foregrounds apply. |
| Image quality | Existing branding/icons and real data SVGs retained; no new raster asset is needed for the format rollout. |
| Copy | Desk content, source keys, full Data tables, missing-state words and Revenue’s test-mode/ledger notes are retained. |

## Verification

The 22 captured views (11 desks/subpages at 1728px and 390px) passed URL, heading, frame size, active-link color, static-header and page-width guards. A separate live-document check passed all 11 pages at 320px with both 16px and 32px root text. The final isolated build and repository gates pass; all 17 touched source files match the build copy. Native checks passed all four Health tabs, Trends Data values/source, Tab/Shift+Tab focus, primary navigation, Product subnavigation, Analytics Catalog and Departments Support links. Eleven focused captures and six final combined-source views were reviewed. Home is restored as an ordinary page with no QA iframe and no error-level console entries. Enter/Space activation retains the earlier Browser Bridge limitation and is not claimed as covered.


## Findings and fixes for the format rollout

| Priority | Finding | Fix / evidence |
| --- | --- | --- |
| P2 | At 320px with doubled text, money legends and stream segments forced Revenue/Analytics to 365px and Departments to 369px. | Wrap legend value/share groups, stacked segment labels and split totals; preserve all numeric values and Data rows. Initial widths are saved in `.smoke/format-small-text-before.json`. |
| P2 | The Trends introduction’s long RPC identifier pushed the enlarged-text page to 326px. | Allow long report content to wrap at the shared main boundary. Root cause read is saved in `.smoke/format-overflow-debug.json`. |
| P2 | Once the numeric overflow was removed, Departments’ panel status actions still forced 369px width. | Constrain the optional action to the panel width. The intermediate finding is saved in `.smoke/format-small-text-after-legends.json`; the final 22 width/text reads fit the 320px viewport. |

The fixes affect presentation only. No measure, series, source key, count, rate, money calculation, RPC or write path was changed for this rollout.


## Final evidence and limits

Combined accepted Home/desk inputs, each 1728 × 912 CSS pixels: [Trends](community-preview/format-compare-reports.png), [Audience](community-preview/format-compare-audience.png), [Revenue](community-preview/format-compare-money.png), [Health](community-preview/format-compare-operations.png), [Product](community-preview/format-compare-product.png), [Analytics](community-preview/format-compare-analytics.png), [Departments](community-preview/format-compare-manage.png). Intentional differences are each desk's content, measures, status notices and controls.

Final combined-source views: [Home](community-preview/format-final-home-desktop.png), [Trends](community-preview/format-final-reports-desktop.png), [Audience phone](community-preview/format-final-audience-phone.png), [Revenue phone](community-preview/format-final-money-phone.png), [Analytics values](community-preview/format-final-analytics-values-phone.png), [Department values at doubled text](community-preview/format-final-department-values-large.png). These follow the concurrent Home/chart cleanup. Native [Data focus/table](community-preview/format-native-data-focus.png) used the existing 1720 × 1152 window, with the summary at y=563.5–587.5 and a 2px focus outline.

The last narrow-layout pass found overflow in unbroken KPI values, Trends' smaller metric rows, Sign-in providers and the Profile fact “Collage first”. Phone KPI values now use 20px display type (30px from 400px), growing to 40px with doubled root text while retaining whole figures. Metric/provider rows wrap at spaces and use open dividers; Profile fact phrases may wrap. All eleven pages fit at 320px with both 16px and 32px root text. Desktop type and the unique Home hero remain distinct from these quieter phone values.

The palette, font family, heading rhythm, open surfaces and source/data copy were reviewed in combined and focused inputs. The existing SVG chart kit and supplied branding/icons are retained; no new raster assets are needed. The concurrent chart cleanup keeps zero marks visible and reserves room for peak labels. The final Home image records that intentional extra peak spacing.

**Remaining P3 polish:** At doubled text, long row labels can wrap sharply and a compact ring-center abbreviation can touch its arc. Full labels/amounts remain in summaries, legends and Data tables. These refinements do not block the requested format rollout.

A preview-process stop interrupted one focused attempt and produced a cross-origin error frame. That attempt is rejected. The preview was restarted as an owned detached process; the unfinished captures and ordinary-page interactions passed. Logs retain the interrupted attempt.

`pnpm check` passes (78 suites / 443 tests, both typechecks and guards), portal tests pass 80/80, and the final isolated Next build passes. All 17 touched source files match the build copy. Preview port 3033 uses synthetic data only. Enter/Space activation remains unverified through Browser Bridge; no full accessibility certification, specialist release approval, commit or deployment is claimed.
