# ADM-02 — unified main admin

Last updated: 2026-10-12. Status: **complete locally; hosted/device acceptance remains pending**.
Owner-selected visual reference: `http://localhost:3033/`.
Architecture and acceptance: [MAIN_ADMIN_PORTAL.md](../engineering/design/MAIN_ADMIN_PORTAL.md).

Functional routing is CTO → ENGINEERING → ADMIN, with PORTAL, SHARED_CONTRACTS,
ANALYST and COMMERCE supplying their boundaries. QA/ACCESSIBILITY review; DOCUMENTATION
integrates evidence. These are owner-authorized Codex outside sessions, not execution
or replacement of the registry's pinned Cursor models. No model pins change.

## Status and shared-file claims

| Session | Claimed paths / responsibility | Status |
| --- | --- | --- |
| Codex root | New thin Expo report routes; STATE, architecture, menu map, README index, task queue, team/registry synchronization and integration QA | Integrated; browser comparison and full gate accepted locally; claim released |
| Codex profile_sport_stats | `packages/shared-types/admin/*`, package exports; Next pure-model facades and Revenue helper facade; mobile `lib/adminReports.ts`, `hooks/useAdminReports.ts` and focused tests | 17 data/hook tests, 86 Next model tests, compatibility/resolver review and iOS/Android exports passed; claim released |
| Codex profile_creative_design | New `components/Admin/Reports/*`, report UI tests and scoped admin-route welcome guard | 31 report tests and six welcome tests passed; Home parity, real Expo Slot, real web SVG and full-value regressions accepted; claim released |
| Codex sports_accessibility_review | Navigation in `lib/admin.ts`, shell/chrome, guest Sign-in and related tests | Access, navigation, sign-in and Publish locks accepted; real Slot and explicit web expanded-state corrections verified; claim released |

Check file times before editing. Preserve other sessions' changes. ReportHeader is
exported by AdminChrome and rendered inside each report/tool's scroll owner. Data
comes from `useAdminReports`; no report imports Next server or DOM components.

## Required coverage

- Home, Trends, Audience, Revenue, Health, Product, Analytics and Departments.
- Product Features, Profile, Sign-in and People oversight.
- All saved desk routes: 22 editing/utility desks plus the legacy Reports → Analytics entry; lens filtering, correct nested trails, access gating,
  draft/Publish behavior and existing immediate editing controls.
- Missing/error/zero states, labelled partial donation fallback, full measure catalog,
  donation counts by band without names, chart summaries and complete Data values.
- The selected 3033 report appearance across report and administration pages.

## Evidence

- Before implementation: repo `pnpm check` passed (Node 24.21.0), 78 suites / 443 tests.
- Existing Next model baseline: 86 tests passed; older STATE references to 80 predate
  donation-band test additions.
- Final repo gate: `pnpm check`, **89 suites / 529 tests**, all typechecks and
  documentation/copy/boundary/comment/agent/client-key guards passed. Stable log:
  `/tmp/ala-adm02-complete-check.log`.
- Compatible Next client: **86 model tests** and `pnpm admin:build` passed; logs
  `/tmp/ala-adm02-portal-tests.log` and `/tmp/ala-adm02-next-build.log`.
- Sequential offline iOS/Android exports from the actual mobile project passed:
  2,817 / 2,899 modules, Hermes bytecode 98, 8,600,300 / 8,787,608 bytes.
  Exact commands and captured tool output: `/tmp/ala-adm02-native-final-validation.txt`.
  These bundles include the final report SVG/full-value fixes; the later explicit
  web `aria-expanded` correction is covered by the final typecheck and regression.
- Browser checks used the actual mobile source against a separate synthetic backend:
  all twelve reports at **1440px and 320px**, plus Home/Revenue/Health/Analytics at
  **768px**, had no horizontal page overflow. Complete Data tables, headings and
  titles were inspected. Seven earlier 1720px report reads also passed layout checks.
- Browser findings were reproduced and fixed: Expo 57 Slot rejected array styles;
  first-visit fan welcome covered admin; SVG forwarded native `accessible=false`
  to web; enlarged money values clipped; Manage lacked web expanded semantics.
  Final Home at 1440/320px and Home/Revenue at 320px with doubled CSS text passed
  with no chart error banner or clipped money. Enlarged web values may wrap.
  `.smoke/main-admin/final-qa-results.json` supersedes the earlier defect records.
- Physical Health Left/Right keys change selection/focus with one tab stop, matching
  panel label and visible focus. Data **Space** toggles the native web disclosure
  with a trusted click; complete rows and caption remain present. Data focus stays
  unobscured as the report header scrolls away. Synthetic Home/End select/focus the
  first/last tab. Manage toggles `aria-expanded=false → true → false` in the browser.
- Browser Bridge's Home command fails and End does not deliver a usable key;
  Enter delivered key events but no native Data activation. Physical Home/End and
  Data Enter therefore remain unverified. No native device interaction or hosted
  admin-role/data/write acceptance was performed. Use the [tester follow-up](../engineering/TESTER_SCRIPT.md).

Main application: `http://localhost:8081/admin`. Compatible Next reporting client:
`http://localhost:3001`. The owner-selected `:3033` remains a design preview.
Reports require an authenticated admin profile; the existing Studio shell exception
does not grant report access, and explains that limitation explicitly.

Nothing is committed, merged, deployed or published by this assignment.


## Continued main admin improvements — 2026-10-12

Codex root owns `AdminChrome`, report screen/section/analytics/chart presentation and
their existing focused tests for this continuation; other sessions’ data, route and
access work is preserved. Groups now browse before navigation; desk search stays
inside the lens directory; long reports have scoped section shortcuts; Home has a
locked Refresh action; Revenue’s SVG origin warning is corrected. Local acceptance
passed: 89 suites / 535 tests, 29 responsive reads, 11 browser behavior checks and
iOS/Android HBC exports. Eight source/test hashes were unchanged during final checks.
The claim is released. Reviewed comparisons and limits are in
[MAIN_ADMIN_PORTAL](../engineering/design/MAIN_ADMIN_PORTAL.md).
No new route, database operation, package, price or publication was introduced.

## Manage desks and data ownership — 2026-10-12

Codex root owns this bounded continuation: `AdminChrome`, `MoneyTool`, the legacy
`ReportsTool`/route, `lib/admin` navigation and their focused tests. Other report
models, authentication, SQL and payment policy remain owned by existing components.
The UI has 22 editing/utility destinations and keeps the saved Reports address as an
Analytics redirect. Money reads disbursements rather than another financial report.
The directory opens on request, has one Tools group and closes on any desk selection.
Local acceptance: `pnpm check` 90 suites / 544 tests; 40 focused regressions, ten
browser behavior checks and eight responsive reads passed. Nested phone filter
clipping was reproduced and corrected; final bounds checks include each control.
No financial browser writes occurred. Reviewed comparisons and limits are in
MAIN_ADMIN_PORTAL and STATE. The source claim is released.

## Data consolidation — claim released after local acceptance

2026-10-12: Codex root owns report presentation/builders, nullable report stock read,
Manage workspace navigation (excluding Books nav ownership), Lab/QA/Coverage utility
cleanup, responsive moderation and focused tests. Future feature workflow has a separate
Codex worker claim in ADMIN_DATA_CONSOLIDATION. Preserve concurrent BOOKS-01 files.
Architecture/plan: [ADMIN_DATA_CONSOLIDATION](../engineering/design/ADMIN_DATA_CONSOLIDATION.md).


Local continuation accepted: Manage has 18 entries and preserves all 24 saved addresses
including concurrent Books and the Reports/Coverage redirects. Product Control map is
report 13. Complete analytics/source/privacy/windows and operational actions remain.
The future-feature contract/checkpoint workflow is integrated in agent instructions and
`pnpm check`; the initial empty registry certifies no existing feature.

Fresh evidence: 96 suites / 611 app tests, 13 workflow tests and all project guards; Next
86 tests; 56 responsive reads and 19 interactions, including physical Analytics arrows
and a trusted scoped Control map Profile click. Source reviewers accepted data preservation.
Detailed capture/ownership/tool limits: ADMIN_DATA_CONSOLIDATION and MAIN_ADMIN_PORTAL.
The implementation claims are released. Hosted data/authorization/write acceptance,
installed-device checks and concurrent BOOKS-01 acceptance remain separate. No SQL,
publication, live financial action, commit, merge or deployment occurred.


Final phone review also caught and fixed Lab editor/feedback overlap. Column editors
now keep their natural height; desktop keeps equal columns. The direct geometry
regression and full gate pass. Evidence: ADMIN_DATA_CONSOLIDATION / MAIN_ADMIN_PORTAL
and `.smoke/main-admin/consolidate-lab-layout-final.json`.


Final local total: **60 responsive/geometry checks** (56 broad reads + four Lab
sibling-geometry checks), **19 interactions**, and **32 stable reviewed source hashes**.
Ordinary sample Home is restored with its heading at y=162 and no test iframe. Aggregate
evidence: `.smoke/main-admin/consolidate-acceptance.json`; reviewed captures are in
MAIN_ADMIN_PORTAL. This acceptance covers local source and fixtures.
