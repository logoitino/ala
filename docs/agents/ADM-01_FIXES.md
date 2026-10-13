# ADM-01 Phase C fix round (ADM-01i) — assigned by ADMIN lead, 2026-10-12

Base commit: a5d0e8f. All paths under apps/admin-portal/ unless noted. Reviewers: QA (ACCEPT, 3 low), VOICE (changes requested), ACCESSIBILITY (FAIL, small fixes), VISUAL_QA (populated screenshots in .smoke/admin-portal-mock/shots-a5d0e8f/, slices in shots/view/).
Rules unchanged: read-only, no SQL, no deps, no chart library, no invented measures, header comments stay, VOICE.md money words.

Owner-held (do NOT decide): (a) whether an all-time athlete-by-donation ranking belongs in the portal at all — for now apply VOICE #26 rename only; (b) SQL `sum(duration_ms)::int` overflow in get_admin_reports — BACKEND, owner approves. **Owner decided both on 2026-10-12** (see [ADM-01.md](ADM-01.md) owner decisions 1–2): (a) the named list is replaced by counts by donation band, no names (`donation_bands`); (b) approved, migration `supabase/migrations/20261012180000_admin_reports_bigint_and_donation_bands.sql` written, staging application pending the owner's paste.

---------------------------------------------------------------
## WAVE 1 (parallel, disjoint)

### W1-A  PORTAL (kit + shared lib) — DESIGN/ACCESSIBILITY bar
Files: components/charts/*, lib/chartScale.ts, NEW lib/measureColors.ts, components/PortalShell.tsx, app/layout.tsx.
1. NEW `lib/measureColors.ts`: one colour per measure for the whole portal, exported map + type. Donations jade, Clips cyan, Time on tabs gold, Video stalls / issues bad, Feature taps violet, Scroll depth violet-or-gold (pick one, distinct from taps on shared charts — document), Payee share jade, Tapua'i share gold, Game Day jade / Train Like Me cyan / Serve Like Me gold, Live jade / Parked muted. Wave 2 page owners consume it.
2. StatTile: value must never split mid-number (`$3,18/2.00` at 1024). whitespace-nowrap on value; sparkline shrinks or moves below the value when narrow. Large values may drop cents only via the caller's format (no prop change needed).
3. TrendChart: responsive axis — thin x labels when crowded (every 2nd/3rd), no `truncate` producing "S… O…"; the value row under the axis must not run together ("$404.50$438.00") — hide it when it would collide (values stay in summary/table). 
4. HBarList `keepOrder`: no rank numbers and no "X leads" sentence when rows are not sorted; summary says e.g. "N rows" + largest row honestly computed.
5. SplitRing: centre value must fit inside the ring (no overlap at 1440 for "$73,734.50"): smaller/clamped text, no break-all; callers may pass compact centreValue.
6. ChartFrame: source line must not break mid-identifier (remove break-all; allow wrap at `·`/`.` boundaries, or move source inside the Data disclosure). Keep it visible-or-disclosed consistently (VISUAL #6 suggests behind Data disclosure — do that).
7. StackedBars: after each `{n}%` add `<SrOnly> of this row's total</SrOnly>` (VOICE #37).
8. PortalShell: remove `truncate` on nav links (A11Y #6) so "Audience" never ellipsizes at 320 / 400% zoom; "Sign out" shouldn't orphan awkwardly at 320. Add optional `level` prop to `Panel` (if Panel lives here) — additive.  Subtitles: VOICE #38 → "This week's donations, clips, attention and playback, plus the rates we do not measure."; #39 → "Time on tabs, taps, what breaks, and which menus are on."
9. app/layout.tsx: `title: { default: "Tapua'i Admin Portal", template: "%s · Tapua'i Admin" }` (A11Y #3). Page owners add per-page `metadata.title` in wave 2.
10. Add a favicon if trivial (app/icon.svg using the T brand mark) — VISUAL "favicon 404".
Report exact new/changed props and the colour map API.

### W1-B  ADMIN (lib/reports.ts + LoginForm)
1. Move `STREAM_NAMES`/`streamName` from components/revenue/revenueModel.ts into lib/reports.ts (export it); revenueModel re-exports or imports it. Names: "Donations", "Optional tips for Tapua'i", "Booster sponsorships", "Vault and Drip" (VOICE #1).
2. Add exported `streamSplitText(stream)` building VOICE-approved split text from payout_bps/platform_bps: malo "90% to the family account, 10% to Tapua'i"; tip "100% to Tapua'i (donor's choice)"; booster "85% to the operator, 15% to Tapua'i" (from bps, not hardcoded); bps null → a fixed label for merch_vault ("Vault: 80% athlete, 20% Tapua'i · Drip: 100% Tapua'i" — verify against schema.sql/company_revenue.sql before using) or null. Never return the raw SQL `split` text (VOICE #3, #4).
3. Labels in lib/reports.ts: :202 `Paid out` → `Payouts marked paid` (note "Payout rows marked paid. Should be $0 in Wave 0.") (VOICE #6). Any REPORT_LABELS for checkout already "step" — confirm.
4. LoginForm (A11Y #9): replace `focus:border-[var(--jade)] focus:outline-none` with `focus-visible:border-[var(--jade)]`; sign-in message gets `role={failed ? 'alert' : 'status'}` (or a persistent aria-live container); Password / Magic link toggles get `aria-pressed`.
Extend lib/reports.test.ts for streamName/streamSplitText.

---------------------------------------------------------------
## WAVE 2 (parallel, after wave 1; consume lib/measureColors.ts, streamName, streamSplitText, Panel level)

### W2-PORTAL  pages: app/(protected)/page.tsx, audience, operations (+components/OperationsBoard.tsx, lib/operations.ts), product, manage, lib/dashboard.ts, lib/departments.ts
- Colours from lib/measureColors.ts everywhere (Home clips jade/cyan mismatch, Audience Train Like Me, Health time-by-tab, manage shares swapped vs Revenue).
- Cards must not stretch to the tallest neighbour leaving empty white (Home comparison cards page.tsx:149, "How the team is moving" :236; manage prose cards :105,:145,:178) — `items-start` or give them real content.
- No orphan grids: Health Where 4 tiles in 3-col (OperationsBoard.tsx:135) → 2/4 cols; Buttons tab single half-width chart; Home KPI 2 cols at 1024 (page.tsx:130) → 4 at lg.
- Health Menus: On/Off badge `shrink-0` so it never splits "O/n" (OperationsBoard.tsx:214).
- Health Buttons headline must not print raw event keys like `reel.seki` — map to human labels (fallback: the key in code font, but prefer a label map).
- Health duration format: use one format with Trends (seconds ≥1000 ms, e.g. "1.3 s"); "UI issues" vs Trends "Control issues" → pick one name with ADMIN ("UI issues").
- A11Y #5: role=alert rendered once above the tablist, not inside each panel.
- A11Y #8: page.tsx:272 aria-label on span → `<span aria-hidden="true">—</span><span className="sr-only">No value</span>`.
- Advisory A11Y #4: manage Panel h2 inside h2 sections → level 3.
- Each page exports `metadata = { title: '…' }` (Home, Audience, Health, Product, Departments, plus features/profile/auth/people).
- QA #1 lib/operations.ts:337 stalls hint when missing → '' like dashboard.ts:304.
- QA #2 Billing tile false "No donations in 7 days" when reports read failed (page.tsx:87, manage:48, departments.ts:59) → treat reports error as not read.
- VOICE: #13 (dashboard.ts:312,318), #14–#17 (manage), #24–#25 (operations.ts labels "Average checkout step · 24h", "Checkout step timings · 24h" + hints), #27 weekSentence grammar (dashboard.ts:149,152,155), #28 (dashboard.ts:201), #40 "Look"→"Check", #41 "What changed this week", #42 "Tab activity", #43.
- "48.2K" on manage → full numbers like the rest of the portal.
- Product: sub-nav pills get an active state (aria-current exists — style it).
- Use `streamName` from lib/reports.ts in manage (VOICE #2).

### W2-ANALYST  lib/analytics.ts (+test), components/AnalyticsBoard.tsx, app/(protected)/analytics/page.tsx
- A11Y #1 (hard fail): add `relative` to the three overflow region wrappers (page.tsx:155,:196,:243) so sr-only spans can't escape → no sideways scroll at 320/200%/400%.
- A11Y #2 (hard fail): drop `lg:sticky lg:top-0 lg:z-10 lg:backdrop-blur` from the dashboard switcher (page.tsx:63).
- A11Y #4: "Dashboards" heading level 2 (page.tsx:37). Advisory: "All dashboards" link min-h-6.
- Switcher must not squeeze 10 buttons into one row (lg:grid-cols-10 → wrap cleanly, e.g. grid-cols-2 sm:grid-cols-4 lg:grid-cols-5, or a flex-wrap pill row).
- Colours from lib/measureColors.ts (Donations/Clips swapped, taps/scroll swapped).
- Catalog source keys must not break mid-token (break-all at :184,:223); catalog table usable on phones (value column visible: stack or reorder columns).
- QA #3: formatMeasure('minutes') (lib/analytics.ts:353) uses dashboard.formatMinutes.
- QA note 5: qna label consistent with REPORT_LABELS ("Subscriber Q&A requests"); flash_live note must not claim "Vault" (SQL doesn't filter on vault).
- VOICE: #1 streamName (:669,:902), #5–#12, #26 (analytics :312 → oversight wording), #32 (:314), #34 board "Game day" → "Live games", #35 "Where recorded gross goes".
- Orphan half-width cards: make grids even.
- metadata title "Analytics".
- Update analytics.test.ts where labels/format change.

### W2-ADMIN  app/(protected)/reports/page.tsx (Trends)
- Colours from lib/measureColors.ts.
- A11Y #4: SectionHeading level={2} at reports :210,226,275,301,324,376,486,517,534; Panels under "Every number" level 3.
- A11Y #8: reports:523 aria-label span fix.
- "Generated …" timestamp in UTC like other pages (reports:127).
- Orphans: Fan actions alone in 3-col row; Verified Meter half-empty → even grid.
- HBarList keepOrder lists (reports :449,:461,:472) — kit fix covers rank/leads; mixed-unit counts (poll votes vs active polls) → stat grid instead of one bar scale.
- VOICE #26 (:379–380 → "Largest donation totals (oversight)" / "All time, top 5. For admin review, not a ranking; never shown in the app."), #29 caption, #30 "about the same as", #31 unique titles (pace: "<title>, last 24 hours vs daily average"; CompareBars "Donations, this week vs the prior week" / "Clips, this week vs the prior week"; :409 "Time on each tab"; :419 "Taps by control"), #32 (:399–400 "Schools by athletes listed" / "Top 5 schools · player rows"), #33 (:461,:467 "Local: polls, boosters and shop" / "No Local counts yet.").
- Durations: seconds format consistent with Health (one rule, ≥1000 ms → "1.3 s").
- Trim redundancy modestly: Trends should not repeat Home's exact KPI row AND heat strip AND every chart — keep the analysis (pace, comparisons, rankings, splits, every-number) and drop exact duplicates of Home where a link to Home serves. Use judgement; keep it coherent.
- metadata title "Trends".

### W2-COMMERCE  app/(protected)/money/page.tsx, components/revenue/*
- Colours from lib/measureColors.ts ("Streams by gross" donations cyan → map; payee jade / Tapua'i gold).
- A11Y #4: SectionHeading level={2} (money :97,178,217,309,314).
- A11Y #7: LedgerTables.tsx:16 scroll box `role="region" aria-label={caption} tabIndex={0}`.
- Mobile tables: ledger + latest donations readable at 375/320 (amount visible without sideways scroll — stacked row cards or column reorder).
- Empty card areas: comparison card / "How donors arrived" — items-start or real content.
- Donut centre: pass compact centreValue (e.g. "$73.7K") with full value in the label/summary.
- Large KPI values: whole dollars ($3,182) where cents add nothing; keep cents in tables.
- Use `streamName` + `streamSplitText` from lib/reports.ts (VOICE #3, #4); never print raw `stream.split`.
- VOICE #18 hint, #19 "Payouts marked paid", #20 warn hint, #21 banner conditional when stripePaid > 0, #22 Tapua'i share hint, #23 partial note, #36 "Athletes' family accounts".
- metadata title "Revenue".

## After wave 2: re-review
ACCESSIBILITY re-checks items 1–9; VISUAL_QA re-shoots with .smoke/admin-portal-mock (mock.cjs, cookie.cjs, shoot*.cjs; see its README) at 1440/1024/768/375/320; VOICE spot-checks; QA reruns tsc, portal tests, copy:check, next build (not on :3001's .next — build in a copy or with distDir override), pnpm check.

## Wave 1 results feeding wave 2 (2026-10-12)

W1-B (ADMIN, done): `lib/reports.ts` exports `streamName(source, fallback)` (malo "Donations", tip "Optional tips for Tapua'i", booster "Booster sponsorships", vault "Vault subscriptions", merch "Drip merch", merch_vault "Vault and Drip"), `streamSplitText(stream)` (from bps; null when missing or not summing to 10000; merch_vault fixed "Vault: 80% athlete, 20% Tapua'i · Drip: 100% Tapua'i", confirmed in schema.sql), `REPORT_NOTES.paid_payouts_cents`. revenueModel re-exports `streamName`.
- COMMERCE: switch `donationSplit().policy` fallback (revenueModel.ts) to `streamSplitText(stream)`; never raw `split`.
- ANALYST: `lib/analytics.ts:252` "Paid out" → use `REPORT_LABELS`/`REPORT_NOTES` wording; import `streamName` at :669, :902.
- PORTAL: import `streamName` in manage.
- VOICE (re-review): merch_vault says "athlete" while malo says "family account" — decide.

W1-A (PORTAL, done): `lib/measureColors.ts` exports `MeasureKey`, `MEASURE_COLORS` (donations jade, clips cyan, timeOnTabs gold, stalls/issues bad, featureTaps violet, scrollDepth gold, payeeShare jade, tapuaiShare gold, gameDay jade, trainLikeMe cyan, serveLikeMe gold, live jade, parked muted) and `measureColor(key)`; import from `@/lib/measureColors`. `Panel` gains `level?: 2 | 3` (default 2). Kit: HBarList keepOrder renders an unranked list; ChartFrame source moved inside the Data disclosure; StatTile value never wraps; TrendChart thins axis labels; SplitRing centre fits; StackedBars sr-only suffix; layout title template `%s · Tapua'i Admin` (pages add `metadata.title`). Open for ACCESSIBILITY: on phones Sign out sits on the first row but comes after the tabs in DOM order.

---------------------------------------------------------------
## WAVE 3 (2026-10-12, after the code re-review) — assigned by the session lead for ADMIN

Source: ACCESSIBILITY + VOICE code re-review (ADM-01.md log). The ACCESSIBILITY blocker (sticky header hides focus, WCAG 2.4.11) was already fixed by the Codex session in `components/PortalShell.tsx` — do not re-add sticky positioning. Paths under `apps/admin-portal/`. Line numbers are from the review and may have shifted; match by content.

### W3-ADMIN — `lib/reports.ts` (+ test), `app/(protected)/reports/page.tsx`, `components/LoginForm.tsx`
1. `MERCH_VAULT_SPLIT` (~:476) → `"Vault: 80% recorded for the athlete, 20% to Tapua'i · Drip: 100% to Tapua'i"`. Vault money is recorded with payee_kind `athlete` and is not credited to the custodial family account (`get_custodial_summary` sums only `tips`), so "family account" would be false. Update the doc comment and test.
2. `REPORT_NOTES.paid_payouts_cents` (~:366) → `"Disbursement rows marked paid. Same sum on the Donations and Ledger boards. Should be $0 while payouts are blocked in Wave 0."`
3. `REPORT_LABELS`: ~:203 `'Exclusive rows marked active'`; ~:208 `'Flash unlocks still open'`; ~:209 `'Spotlight awards live today'`; ~:217 `'Admin accounts'`; ~:225 `'Drip products on the rack'`; ~:226 `'Video stalls (24h)'`; ~:231 `'Tab opens (24h)'`; ~:239 `'Average scroll depth (7d)'`.
4. Trends ~:352 "Largest donation totals (oversight)": add `keepOrder` (today it prints rank numbers and "X leads" under a caption that says "not a ranking"). Section ~:350 title `"Top 5 lists"`, hint `"All time. Donation totals are for admin review, not a ranking."`
5. LoginForm (~:144) advisory: two fixed live regions, one `role="alert"` (failures) and one `role="status"` (progress/success), both always mounted, instead of one region switching politeness in the same render.

### W3-ANALYST — `lib/analytics.ts` (+ test), `components/AnalyticsBoard.tsx`
1. ~:296 payee share note → `"Recorded for families, Vault athletes, and booster operators. Nothing is paid out in Wave 0."`
2. ~:297 paid-out note → `"Disbursement rows marked paid. Same sum on the Donations and Ledger boards. Should be $0 while payouts are blocked in Wave 0."`
3. ~:195 Donations board question → `"How much was donated, how often, and are any payouts queued?"`
4. ~:768-777 delete the `bars-gameday` "Around the game" chart (mixed all-time votes with current counts; three of four are already tiles); let the remaining split span the row. ~:219 Live games question → `"Which games are live, and how active are polls, boosters and the shop?"`
5. Names matching Health and Trends: ~:291 `'Checkout step timings, 24 hours'` note `'Donation checkout steps that logged a time in the last day.'`; ~:292 `'Average checkout step, 24 hours'` note `'Mean across every logged checkout step, not one whole checkout.'`; ~:312 `'Time on each tab'`; ~:313 `'Taps by control'`; ~:317 `'Most-hyped clips'`.
6. AnalyticsBoard ~:265-286 advisory: `dt`/`dd` wrapped in a nested `div` inside `<dl>` — valid only as a direct `div` group child of `dl`; fix the structure.

### W3-COMMERCE — `app/(protected)/money/page.tsx`, `components/revenue/*`
1. ~:57 `streamRowLabel` repeats the payee ("Donations · to athlete's family account · 90% to the family account…") → `` `${streamName(...)} · ${split ?? `to ${payeeName(stream.payee)}`}` ``.
2. ~:92 `'Payee share (families, athletes, operators)'`; ~:154 `"Recorded for families, Vault athletes, and booster operators. Test records only; nothing has been paid out."`; ~:148 `"What the ledger records for Tapua'i: its share of donations, tips for Tapua'i, boosters, Vault, and all of Drip"`.
3. Advisory: bare "—" with no words at LedgerTables ~:131 and revenueModel ~:77-79 → aria-hidden dash + sr-only words ("Not in this read"), like Trends' `Blank`.

### W3-PORTAL — `app/(protected)/manage/page.tsx`, `lib/dashboard.ts` (+ test), `app/(protected)/page.tsx`, `profile/page.tsx`, `auth/page.tsx`, `components/PortalShell.tsx` (FlagStatusList only)
1. manage ~:113 → `"Each stream's recorded gross, split into the payee share (families, athletes, operators) and Tapua'i share"`.
2. manage ~:178 hint → `"Start with any desk marked Check or Failed under Right now"`; ~:195 → `"The queue is the open bug reports and UI issues above. Reported clips and who reported them stay in Expo /admin moderation."`
3. dashboard.ts ~:318 → `"Tapua'i share of gross, all streams"` (Home shows a percent; Departments shows dollars and keeps "Tapua'i share, all streams"); ~:324 → `` `The ledger records ${…} for Tapua'i out of ${…} gross across every stream. Donation policy: 90% to the family account, 10% to Tapua'i.` ``
4. Headings: profile ~:81, auth ~:45 and ~:74 — h3 SectionHeading above h2 Panels → SectionHeading level 2, Panels level 3.
5. PortalShell FlagStatusList ~:359-360: `truncate` cuts text → `break-words`. Do not touch the header (Codex removed sticky; keep it static).
6. Home page.tsx ~:290 sr-only "No value" → "Not in this read" (the key was missing from the read) to match Trends and Analytics.
