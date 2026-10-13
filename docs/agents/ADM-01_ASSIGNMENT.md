# CTO assignment ADM-01: admin portal charts and dashboards (2026-10-11)

Owner request (FACILITATOR): "Continue improving the looks of the web admin portal and work through the proper hierarchy to get all the agents activated in making the web admin portal advanced and full of good dashboard graphs and data for data analysis."

Hand this file to every agent named below without changes. Planning only. The CTO edited no code.

## 0. Ground truth checked by the CTO before assigning

- **The earlier session's portal edits are already committed.** `git status` is clean. They landed in `c5a95a8` ("10/11", 25 files under `apps/admin-portal/`, +2009/−214): Home, PortalShell, ColumnChart, AnalyticsBoard, OperationsBoard, `lib/{analytics,dashboard,departments,operations}.ts` with tests, and `/analytics`, `/audience`, `/manage`, `/operations`, `/product` pages. Build on that commit. Do not revert or re-create any of it. The branch is `wave0-custodial-verification`.
- **Baseline portal tests pass.** From `apps/admin-portal`: `node --import ./lib/analytics-resolver.mjs --test lib/*.test.ts` gives 15 tests, 15 pass. The Node on PATH is v25.4.0. STATE §3 says `~/.local/node` is v24, so record which version you ran. No `pnpm` script runs these tests and CI does not run them. Every Phase B/C report must include this command.
- **Data contract.** This is canonical `get_admin_reports` in `apps/mobile/src/backend/db/schema.sql:4785–5034`, parsed by `lib/reports.ts`. Nobody re-queried the hosted database, so a key can still be missing there. A missing key renders `—`, not 0.
  - `engagement`: clips_live, clips_24h, clips_7d, **clips_prev_7d**, seki, aura, flex, hype_votes, saves, crew_follows
  - `money`: malo_cents_all, malo_count_all, malo_cents_24h, malo_count_24h, malo_cents_7d, malo_count_7d, **malo_cents_prev_7d**, avg_tip_cents_7d, queued_payouts, paid_payouts_cents, active_subs
  - `content`: flagged, removed, vault, exclusive_clips, flash_live, spotlight_live, qna, game_play, train_like_me, serve_like_me
  - `audience`: profiles, athletes, verified, admins, schools, pending_verify
  - `live`: live_games, parked_games, poll_votes, active_polls, active_boosters, drip_skus
  - `reliability`: stalls_24h, reconnects_24h, checkouts_24h, avg_checkout_ms_24h, events_24h
  - `usage`: sessions_24h, dwell_ms_24h, dwell_ms_7d, taps_24h, taps_7d, issues_24h, issues_7d, feedback_bugs_open, avg_scroll_pct_7d
  - Leader lists `{label,value}`: `tabs` (value = **sum of dwell ms**, 7d), `features` (tap count, 7d), `issues` (count), `scroll` (value = **average scroll percent**, 7d), `leaders.malo` (cents, top 5 athletes), `leaders.hype` (count, top 5 clips), `leaders.schools` (player rows, top 5)
  - `series` (7 points each, label `Dy`, UTC): `clips` (count), `malo` (cents), `stalls` (count), `dwell` (ms)
  - **Only two measures have a prior week:** clips_7d/clips_prev_7d and malo_cents_7d/malo_cents_prev_7d. No other week-over-week delta is allowed.
  - `get_company_revenue_summary` (schema.sql:9195): gross_volume_cents, company_net_cents, payouts_cents, stripe_paid_cents, `streams[]` {source, label, split, gross_cents, platform_cents, payout_cents, payee} for malo/tip/booster/merch_vault, and `recent[]`
  - `get_admin_malo_breakdown` (Revenue only): by_origin, by_entry {cents,count}, by_day for 14 days. The SQL returns by_day per origin. `parseBreakdown` collapses it to one total per day.
- **Existing defects found while checking. The owners in Phase B fix them:**
  1. `tabs` values are milliseconds but are shown as raw integers in Trends "Time on tabs" (`reports/page.tsx` LeaderBars), the Health "Where" bars (`OperationsBoard`/`lib/operations.ts`), and the Departments tab bars (`manage/page.tsx:127`). Show minutes.
  2. Trends "Scroll depth" shows a percent average as a bare count. Show `n%`.
  3. Audience "Clip mix" says "Game play". The product label is **Game Day** (STATE 2026-10-07).
  4. `REPORT_LABELS` in `lib/reports.ts` has no entry for clips_prev_7d, malo_cents_prev_7d, qna, game_play, train_like_me, or serve_like_me, so Trends prints keys like "clips prev 7d".
  5. `--text-muted` `#6b7680` is 4.35:1 on `--canvas` and 4.18:1 on `--surface-muted`. That fails WCAG 1.4.3 for small text (AnalyticsBoard sections sit on canvas).
  6. `OperationsBoard` has `role="tablist"` but no `tabpanel`, no `aria-controls`, and no arrow-key support.
  7. `.claude/agents/admin.md` still says "no auth gate at all". `middleware.ts` and `(protected)/layout.tsx` now gate on session plus `profiles.is_admin`. The anon-grant half is BACKEND's and is out of scope. This is stale text for VP_OPERATIONS.
  8. TEAMS.md contradicts itself. Line 352 says all six tabs are PORTAL. Line 507 says Trends is `ADMIN` and Revenue is `COMMERCE`. The registry agrees with line 507: PORTAL's `owns` does not list `reports/` or `money/`. This assignment follows line 507 and the registry.
  9. Out of scope, noted only: `LoginForm.tsx:122,135` uses `focus:outline-none` with only a border-color change. That goes to ADMIN as a follow-up and is not part of this task.

## 1. Lead and reviewers

| Role | Who |
| --- | --- |
| Lead (accountable, integrates, reports to CTO) | **`ADMIN`** (Engineering; reports up through `ENGINEERING`) |
| Phase A build | **`DESIGN`** (reports to CTO) with **`ACCESSIBILITY`** (reports to DESIGN) |
| Phase B builders | **`PORTAL`** and **`ANALYST`** (both report to ADMIN). **`ADMIN`** itself does Trends + `lib/reports.ts`. **`COMMERCE`** does Revenue (`/money`), which it owns per TEAMS:507 |
| Reviewers | `ACCESSIBILITY` (all chart a11y), `DESIGN` (visual integration), `VOICE` (on-screen words, money words), `COMMERCE`/`BILLING` (meaning of revenue numbers), `QA` with `VISUAL_QA` (independent evidence; QA can reject) |
| Docs | **`DOCUMENTATION`** (reports to ENGINEERING) |
| Roles/registry | **`VP_OPERATIONS`**, needed (see §5) |
| Not needed | BACKEND / SECURITY / DATABASE_MIGRATIONS. There is no schema, RPC, grant, or SQL change. If anyone thinks they need a new key, stop and report to ADMIN. Do not write SQL. |

Standing rules for every agent: the portal stays read-only. No chart library or new dependency (the npm registry is blocked, STATE §3). Charts are inline SVG or HTML. No write path, no new RPC, no new public data key or anon export, no new route. No invented measure: an unmeasured rate (daily people, retention, donation conversion, acquisition cost, how long a family stays) stays named and blank, from `UNMEASURED` in `lib/dashboard.ts`. Zero and missing are different states. Money words follow `docs/product/VOICE.md` (Donate / donation). Every new file gets a header comment (CONVENTIONS §5). `comments:check` does not scan the portal, so reviewers check headers by hand.

## 2. Phase A: DESIGN chart kit and tokens (ACCESSIBILITY reviews before Phase B starts)

Task ID **ADM-01a**. DESIGN builds these files. Once they merge, PORTAL owns them (registry update in §5). No other agent edits them during Phase A.

### 2a. Token additions: `apps/admin-portal/app/globals.css` (DESIGN only, frozen after Phase A)

These reuse the mobile Island Daylight inks from `apps/mobile/src/frontend/theme/motion.ts`. Do not invent a second palette. The CTO computed the contrast ratios against white:

```
--text-muted: #5b6670;        /* was #6b7680. 5.50:1 canvas, 5.29:1 surface-muted, 5.17:1 jade-soft */
--cyan: #00707e;  --cyan-soft: #e3f6f8;      /* FOCAL.cyanInk, 5.80:1 */
--violet: #4c1d95; --violet-soft: #f3edff;   /* FOCAL.violetInk, 10.95:1 */
--chart-1: var(--jade); --chart-2: var(--cyan); --chart-3: var(--gold); --chart-4: var(--violet);
--chart-bad: var(--ember);    /* only for stalls / errors / failures, never a neutral category */
--chart-muted: #5b6670;       /* prior week, "other" */
--chart-grid: var(--border);  /* decorative only */
--chart-track: var(--surface-muted);
--chart-gap: var(--surface);  /* 2px separator between stacked segments */
--focus-ring: #00733c;
```

Add a global `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }`. No dark mode in this pass.

### 2b. Files and components

All files are Server-Component-safe: no `'use client'`, no hooks, no `next/*` imports, and data only through props. That lets them render to static markup for the screenshot harness in §4. Every number is `number | null`. `null` renders `—` plus "Not in this read". `0` renders a visible baseline and "0".

| File | Component and props | Used for |
| --- | --- | --- |
| `apps/admin-portal/lib/chartScale.ts` | Pure math: `niceMax(values)`, `linearScale(domainMax, rangePx)`, `linePath(points, w, h)`, `arcPath(cx, cy, r, start, end)`, `sharesTo100(values)` (largest remainder, null when the total is 0), `normalizeRow(values)` (0–1 per row). | Every chart |
| `apps/admin-portal/lib/chartScale.test.ts` | `node:test`. Covers empty, all-zero, single point, and that shares always sum to 100. Runs with the resolver command in §0. | |
| `components/charts/ChartFrame.tsx` | `{ title; caption?; source?: string; summary: string; table: {columns: string[]; rows: (string)[][]}; children }`. Renders `<figure>`, `<figcaption>` title, a visible one-sentence `summary`, the source line (e.g. `get_admin_reports.series.malo`), the children, and `<details><summary>Data</summary><table>` holding every plotted value. | Wrapper for all charts |
| `components/charts/StatTile.tsx` | `{ label; value: string; hint?; tone?: 'neutral'\|'ok'\|'warn'\|'danger'; missing?: boolean; delta?: {current:number; previous:number} \| null; goodDirection?: 'up'\|'down'\|'none'; spark?: {points:{label:string;value:number}[]; format:(n:number)=>string} }`. Delta uses `weekChange` from `lib/dashboard.ts` and prints the arrow glyph, sign, and words, e.g. "▲ 12% versus the prior week". A prior week of 0 prints "No prior week to compare" and no percent. The sparkline is `aria-hidden`. Its meaning is in the text "7 days: Mon $0 … Sun $40" inside an `sr-only` span. | KPI rows |
| `components/charts/Sparkline.tsx` | `{ points; accent?: ChartColor; height?: number = 28 }`. Polyline plus a dot on the last point. Decorative inside StatTile only. | |
| `components/charts/TrendChart.tsx` | `{ title; windowLabel: string; points:{label,value}[]; format; variant: 'columns'\|'line'\|'area'; accent?: ChartColor; source? }`. SVG `viewBox` at width 100%. Day labels and values are HTML under the plot, not SVG text, so they scale with zoom. Line and area draw r=3 point markers so a single non-zero day is visible. | 7-day and 14-day series |
| `components/ColumnChart.tsx` (existing, PORTAL-owned) | **DESIGN may only** turn it into a thin wrapper: `ColumnChart(props) → <TrendChart variant="columns" windowLabel="Last 7 days, UTC" …/>`. Keep the exported name and props so `AnalyticsBoard.tsx` and Home keep compiling. Do not delete it this pass. | Back-compat |
| `components/charts/HBarList.tsx` | `{ title; rows:{label,value}[]; format; accent?; limit?; emptyText; source? }`. Ranked `<ol>`. Each row has its label, a formatted value as text, and a bar. Replaces `BarRow` lists. | Leader lists |
| `components/charts/SplitBar.tsx` | `{ title; parts:{label; value:number\|null; color: ChartColor}[]; format; totalLabel? }`. A single 100% bar with 2px `--chart-gap` separators. The legend lists every part (zero parts too) with value and share %. Use only when the parts are a real partition. | Clip category mix, Seki/Aura/Flex mix, live vs parked games, menus on/off |
| `components/charts/SplitRing.tsx` | `{ title; parts (≤3); format; centerLabel; centerValue }`. Donut with the same legend rules as SplitBar. | Ledger only: Tapua'i share vs payouts within gross |
| `components/charts/StackedBars.tsx` | `{ title; series:{key;label;color}[]; rows:{label; segments: Record<key, number>; total?: number}[]; format }`. Horizontal. Each row prints its total and the segment values. | Revenue streams: platform vs payout per stream |
| `components/charts/CompareBars.tsx` | `{ title; current:{label;value}; previous:{label;value}; format }`. Two bars, previous in `--chart-muted`, with the sentence from `weekSentence`. | Only the two prior-week pairs |
| `components/charts/HeatStrip.tsx` | `{ title; rows:{label; points:{label,value}[]; format; accent: ChartColor}[] }`. Rows × 7 days. Intensity is `color-mix(in srgb, var(--chart-n) X%, var(--surface))` normalized per row. Each cell prints its value as text when the width allows. Each row ends with "Peak: Thu, $40", and the Data table has every value. | "Week at a glance": the four series |
| `components/charts/Meter.tsx` | `{ label; part:number\|null; whole:number\|null; format }`. Uses `sharePercent`. When whole is 0 or null it prints "—" and "No denominator in this read". | Verified share |
| `components/charts/index.ts` | Re-exports plus `type ChartColor = 'jade'\|'cyan'\|'gold'\|'violet'\|'bad'\|'muted'`. | |

### 2c. Accessibility requirements (ACCESSIBILITY signs off with file:line before Phase B starts)

1. **Text alternative.** Every chart is a `<figure>` with a `<figcaption>` and a visible summary sentence. Plot SVGs are `aria-hidden="true" focusable="false"`. Every plotted value is in the `<details>` Data table (`<th scope>`, `<caption>`). Hover `title` alone is not enough.
2. **Not color-only.** Values print as text. Deltas carry a glyph, a sign, and words. Stacked and ring segments have gap separators and a legend with values and %. "Bad" direction comes from `goodDirection`, not from the hue.
3. **Contrast.** Marks are ≥3:1 against `--surface` and `--canvas` (WCAG 1.4.11): jade 5.97, cyan 5.80, gold 5.38, violet 10.95, ember 6.64, muted 5.50. Text is ≥4.5:1, which needs the `--text-muted` fix. Grid and track are decorative and carry no meaning.
4. **Reduced motion.** No animation by default. Any transition sits inside `@media (prefers-reduced-motion: no-preference)`. No JS animation.
5. **Keyboard and focus.** The only interactive pieces are `<details>` summaries and OperationsBoard tabs. They need a visible `:focus-visible` ring and targets ≥24×24 CSS px (WCAG 2.2 SC 2.5.8; 44 is the AAA/Apple bar and is not required here).
6. **Reflow.** At 320 px width and 200% zoom there is no horizontal page scroll. Data tables may scroll inside their own `overflow-x-auto`. Labels are HTML so they scale.
7. **Empty, missing, zero, and error** are four distinct visible states.

DESIGN exit evidence: `pnpm --filter @tapuai/admin-portal typecheck` (fallback: `cd apps/admin-portal && ../../node_modules/.bin/tsc --noEmit`); the portal node tests including `chartScale.test.ts`; a list of files changed; the ACCESSIBILITY sign-off. **Phase B does not start until ADMIN confirms Phase A merged locally.** Kit props are frozen after that. A change request goes to PORTAL, now the owner, through ADMIN.

## 3. Phase B: parallel work with disjoint file ownership (task IDs ADM-01b to ADM-01e)

Every chart below names its existing key. Do not add a chart whose key is not in §0.

### ADM-01b PORTAL owns: `app/(protected)/page.tsx`, `audience/page.tsx`, `operations/page.tsx`, `product/page.tsx`, `manage/page.tsx`, `components/PortalShell.tsx`, `components/OperationsBoard.tsx`, `components/ColumnChart.tsx`, `lib/dashboard.ts`, `lib/departments.ts`, `lib/operations.ts` (+ their tests)

- **Home `/`**
  - The eight KPIs become `StatTile`.
  - Donations · 7d: delta malo_cents_7d vs malo_cents_prev_7d, spark `series.malo`.
  - Clips · 7d: delta clips_7d vs clips_prev_7d, spark `series.clips`.
  - Time on tabs · 7d (dwell_ms_7d): spark `series.dwell`, no delta.
  - Video stalls · 24h (stalls_24h): spark `series.stalls`, `goodDirection="down"`, no delta.
  - Average donation, Tab opens · 24h, Taps per tab open, and Recorded platform share get **no spark and no delta**. No series exists for them.
  - The four charts become `TrendChart`: donations `area`/jade, clips `columns`/jade, time on tabs `line`/gold, stalls `columns`/bad.
  - Add `HeatStrip` "Week at a glance" from the same four series.
  - Keep "Not measured", the trends list, and the department tiles.
  - Show `—`, not `$0.00`, when a key is missing. Today `?? 0` hides a missing key. `homeKpis`/`DashboardInput` need `number | null` where the key can be absent. Update `dashboard.test.ts`.
  - `weekChange` and `weekSentence` signatures are frozen because ANALYST imports them.
- **Audience `/audience`**
  - `Meter` for verified share (audience.verified / audience.profiles).
  - `StatTile` for profiles, athletes, schools, pending_verify (`goodDirection` none; warn tone when pending > 0).
  - `HBarList` for leaders.schools.
  - `SplitBar` for clip mix content.game_play / train_like_me / serve_like_me, labelled **Game Day** / Train Like Me / Serve Like Me.
  - Admin count as text.
- **Health `/operations`**
  - `OperationsBoard` bars become `HBarList` with a per-lens format. "Where" shows minutes (fixes defect 1). Buttons and Errors show counts.
  - "Errors" adds `TrendChart` `series.stalls` and `StatTile`s for stalls_24h (spark), reconnects_24h, checkouts_24h, and avg_checkout_ms_24h (ms).
  - "Menus" shows `SplitBar` on/off per flag group from the published runtime flags already read.
  - Fix the tab semantics (defect 6): `role="tabpanel"`, `aria-controls`/`id`, roving tabindex, Left/Right/Home/End keys.
- **Departments `/manage`**: replace `BarRow` lists with `HBarList` (tabs in minutes), billing streams with `StackedBars` (platform_cents vs payout_cents per stream), and KPI `StatCard`s with `StatTile`.
- **Product `/product`**: optional, lowest priority. A `Meter` of menus on per flag group, using `fetchPortalRuntime` as Health already does. If you skip it, say so.
- **PortalShell**: keep `StatCard`, `BarRow`, `Panel`, `SectionHeading`, and `Badge` exported with their current props, because ANALYST, ADMIN, and COMMERCE pages may still import them. Do not change header link order or labels. The Analytics link is shared with ANALYST, so any change needs ANALYST's ack.

### ADM-01c ANALYST owns: `lib/analytics.ts`, `lib/analytics.test.ts`, `components/AnalyticsBoard.tsx`, `app/(protected)/analytics/page.tsx`

- Extend `AnalyticsChart.kind` to `'columns'|'line'|'area'|'bars'|'split'|'compare'|'stack'|'ring'` and `format` to add `'percent'|'milliseconds'`. Each chart keeps its source string.
- **Highlights**: `TrendChart` series.clips. `CompareBars` clips_7d vs clips_prev_7d. `SplitBar` engagement.seki/aura/flex ("Hype on live clips"). `HBarList` leaders.hype.
- **Donations**: headline `StatTile` malo_cents_7d with delta vs malo_cents_prev_7d and spark series.malo. `TrendChart` series.malo (area). `CompareBars` the same pair. `HBarList` leaders.malo (cents).
- **Audience**: `Meter` verified/profiles. `HBarList` leaders.schools.
- **Attention**: `TrendChart` series.dwell (minutes). `HBarList` tabs (minutes), features (count), and **scroll** (percent). Add `scroll` to `RANKINGS` with the note "Average scroll sample per surface, 7 days. Not a share of people." This is an existing key, not a new measure.
- **Trust**: `SplitBar` game_play/train_like_me/serve_like_me (Game Day label). `HBarList` of flagged, removed, vault, exclusive_clips, flash_live. These are not a partition, so not a split.
- **Game day**: `SplitBar` live_games vs parked_games (a partition of `games` by is_active). `HBarList` of the other live counts.
- **Playback**: `TrendChart` series.stalls (bad). `HBarList` issues.
- **Ledger**: `SplitRing` company_net_cents vs payouts_cents. The center shows gross_volume_cents. If gross ≠ net + payouts, the remainder is a third part labelled "Recorded gross not split". `StackedBars` per stream.
- **Page top**: board cards become `StatTile`s (only Highlights and Donations get a delta). Add a `HeatStrip` of the four series.
- **Catalog**: unchanged in meaning. `MEASURES` gains no key that is not in §0. Tests: every chart's points come from a §0 key, a missing key gives `—`, and a prior week of 0 gives no percent.

### ADM-01d ADMIN (lead) owns: `app/(protected)/reports/page.tsx` (Trends), `lib/reports.ts`

- `lib/reports.ts`: **additive labels only** in `REPORT_LABELS` (defect 4). Use "Game Day clips" for game_play. Do not change any fetch, parse, or type that PORTAL, ANALYST, or COMMERCE consume. If a consumer needs a type change, the consumer asks ADMIN first.
- Trends: `LeaderBars` become `HBarList`. Tabs show minutes and scroll shows percent (defects 1 and 2). Add the four `TrendChart`s.
- Add a "Last 24 hours against the 7-day daily average" `CompareBars` row for clips_24h vs clips_7d/7, malo_cents_24h vs malo_cents_7d/7, taps_24h vs taps_7d/7, issues_24h vs issues_7d/7, and dwell_ms_24h vs dwell_ms_7d/7. The caption must say "The 24 hours are inside the 7 days. This is pace, not growth." ANALYST reviews this caption.
- `MetricList` stays.

### ADM-01e COMMERCE owns: `app/(protected)/money/page.tsx` (Revenue)

- KPI cards become `StatTile`.
- `SplitRing` net vs payouts within gross, as on Ledger.
- `StackedBars` for streams.
- The "Last 14 days" horizontal bars become `TrendChart` `columns` from `byDay` (cents, `windowLabel="Last 14 days, UTC"`).
- `HBarList` for byOrigin and byEntry (cents with count).
- **Not this pass**: a per-origin stacked day chart needs a parse change in `lib/reports.ts`. Ask ADMIN, ADM-01f+.
- VOICE reviews "gift / gifts", "Company net", and "Platform cut". BILLING/COMMERCE confirm each label means what the ledger records. The 90 / 10 policy line stays.

Phase B report, from each owner to ADMIN: task ID; files changed; which §0 key feeds each chart; the typecheck and node test commands with counts; open risks; disposition.

## 4. Phase C: independent review (ADMIN requests; QA can reject)

Run from repo root unless noted. Name the command, the counts, the Node version, and the date. Prefix `PATH=$HOME/.local/node/bin:$PATH` per STATE §3.

| Reviewer | Evidence required |
| --- | --- |
| **QA** (lead gate) | `pnpm --filter @tapuai/admin-portal typecheck`; portal tests `cd apps/admin-portal && node --import ./lib/analytics-resolver.mjs --test lib/*.test.ts` (baseline 15, report new total); `pnpm typecheck`; `pnpm docs:check`; `pnpm docs:links`; `pnpm copy:check`; `pnpm comments:check`; `pnpm agents:check` (registry changes); `pnpm check` (includes the mobile Jest; last recorded 74 suites / 416 tests); `pnpm --filter @tapuai/admin-portal build` (a real `next build`). Grep proof that no `rpc(`/`.from(`/`insert`/`update`/`upsert`/`delete` was added under `apps/admin-portal` and no dependency was added to `package.json`. Numbered pass/fail plus file:line. |
| **VISUAL_QA** (reports to QA) | Screenshots in `.playwright-mcp/` or `.smoke/admin-charts/` (git-ignored, not committed) at 320 / 768 / 1280 widths and 200% zoom, with results in `docs/engineering/AUDIT_REPORT.md`. **How to reach the portal without an admin session:** `middleware.ts` redirects every protected path to `/login` when Supabase env is set, and `(protected)/layout.tsx` requires `profiles.is_admin`. Both skip the gate when `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are empty. `@next/env` does not overwrite a variable already defined in the shell (checked in `@next/env@15.5.25`). So `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= pnpm admin` renders every page in the **unconfigured / empty-state** mode with no database read. That gives evidence for empty, missing, and setup states. **Populated charts:** do not sign in to development or staging data (VISUAL_QA's role forbids staging/production data, and admin credentials are the owner's). Build a fixture harness under `.smoke/admin-charts/`: transpile `components/charts/*` with `../../node_modules/.bin/tsc --jsx react-jsx` into the harness, render fixtures with `react-dom/server` `renderToStaticMarkup`, link the compiled CSS from `.next/static/css` after `next build`, and screenshot it. Fixtures must cover zero, missing, single point, all-equal, large values, and long labels. A screenshot plan without a run is not a pass. |
| **ACCESSIBILITY** | Re-audit the Phase B pages against §2c with file:line. Keyboard-only pass on OperationsBoard tabs and every `<details>` Data control. Contrast of any new token use. Reduced motion (emulate `prefers-reduced-motion: reduce`). A screen-reader spot check with VoiceOver on macOS Safari against the empty-state server and the fixture harness; say which ones were actually run. |
| **VOICE** | Every new on-screen string. `copy:check` scans only `apps/admin-portal/app`, **not** `components/`, so review `components/charts/*`, `AnalyticsBoard.tsx`, and `OperationsBoard.tsx` by hand. Donate/donation wording, the Game Day label, and no "conversion/retention/DAU" wording on a count. |
| **DESIGN** | Visual integration across pages: one palette, ember only for bad, consistent tile and chart rhythm. |

The CTO will not accept: a typecheck standing in for a build, a build standing in for screenshots, or screenshots of real hosted data.

## 5. Phase D: DOCUMENTATION in the same turn as the code (ADM-01g)

- `docs/STATE.md`: one §4 line (newest first) and a bumped **Last updated**. Say what the charts are, that no SQL was applied, and which checks ran with counts. Name what was not verified: hosted keys, a signed-in populated render, native readers. Prune §4 to about 15 entries and move the overflow to CHANGELOG. Correct §2's stale "7 real pages (Overview / Reports / …)" to the current tabs.
- `CHANGELOG.md`: dated entry. This is user-visible to admins.
- `docs/engineering/AUDIT_REPORT.md`: VISUAL_QA writes its own section and DOCUMENTATION links it.
- `docs/agents/TEAMS.md` §ADMIN: one line saying `components/charts/` and `lib/chartScale.ts` are owned by PORTAL, built by DESIGN, with ACCESSIBILITY as reviewer. This changes ownership, so it is VP_OPERATIONS's edit (below). DOCUMENTATION syncs the wording.
- `AGENTS.md`: the portal row only if new folder lists are kept there (they are not for the portal today). Most likely no change; say so.
- Run `pnpm docs:check`, `pnpm docs:links`, `pnpm copy:check`, `pnpm comments:check`, and `pnpm agents:check`.

**VP_OPERATIONS is needed** (ADM-01h), same turn:
1. Add `apps/admin-portal/components/charts` and `apps/admin-portal/lib/chartScale.ts` (+ test) to PORTAL's `owns` in `.claude/agents/registry.json` and to `.claude/agents/portal.md` key files.
2. Reconcile TEAMS.md:352 with :507, so that Trends is `ADMIN` and Revenue is `COMMERCE`.
3. Replace the stale "no auth gate" paragraph in `.claude/agents/admin.md` with the current state: the session plus `is_admin` gate exists, and anon grants are still BACKEND's open half.
4. Add the ADM-01 rows to `docs/agents/WORK_QUEUE.md` "Current CTO assignment".

The TEAM_HIERARCHY tree does not change because no agent moves. Run `pnpm agents:check`.

## 6. Shared files and conflict rules

| File | Owner (only writer) | Others |
| --- | --- | --- |
| `app/globals.css` | DESIGN in Phase A, then frozen | Request a change through ADMIN |
| `components/charts/*`, `lib/chartScale.ts(+test)` | DESIGN in Phase A, then **PORTAL** | ANALYST/ADMIN/COMMERCE import only. A prop change goes through PORTAL via ADMIN |
| `components/ColumnChart.tsx` | PORTAL (DESIGN may wrap it once in Phase A) | AnalyticsBoard imports it, so the exported name and props stay |
| `components/PortalShell.tsx` | PORTAL | Exports frozen. The Analytics header link needs ANALYST's ack |
| `lib/dashboard.ts` | PORTAL | `weekChange`/`weekSentence`/`sharePercent`/`UNMEASURED` signatures are frozen (ANALYST imports them) |
| `lib/reports.ts` | ADMIN | Labels are additive only. A type or parse change needs ADMIN's approval first |
| `lib/analytics.ts`, `AnalyticsBoard.tsx`, `analytics/page.tsx` | ANALYST | |
| `reports/page.tsx` | ADMIN | |
| `money/page.tsx` | COMMERCE | |
| `operations`, `audience`, `manage`, `product`, Home pages; `OperationsBoard.tsx`; `lib/{operations,departments}.ts` | PORTAL | |
| `features`, `profile`, `auth`, `people` pages | Not in scope (ADMIN / PROFILE / AUTH) | Do not touch |
| `middleware.ts`, `lib/authz.ts`, `lib/supabase*.ts`, `(protected)/layout.tsx` | Not in scope | Do not touch |
| `docs/STATE.md`, `CHANGELOG.md` | DOCUMENTATION | Owners send it facts |
| registry, agent files, TEAMS, WORK_QUEUE | VP_OPERATIONS | |
| `AUDIT_REPORT.md` visual section | VISUAL_QA | |

Commit by path, never `git add -A`. Do not push or merge; those are the owner's calls. The CTO calls ADM-01 done only when QA's numbered gate passes, the build and screenshots actually ran, and every unrun check is named.
