<!-- Current bounded raw donat* scan; frozen consent and unresolved classification remain explicit. -->
# Remaining donat* matches after checkout integration

544 matching source lines. Scope: all tracked mobile/admin/shared JS/TS/JSON and
Edge TS, excluding tests. This scan includes imports, identifiers and comments; it is not a
claim that naming changes resolve stored data or historical server text. Every match is below.
Frozen guardian consent, mixed refund reason and raw staff validator/source names are explicit
exceptions in [the report](GIFT_LANGUAGE_REPORT.md). Canonical SQL/applied migrations retain historical
internal names and server text; current money overrides are separately reviewed in the model report.

| File / current line | Source text | Classification |
| --- | --- | --- |
| `apps/admin-portal/app/(protected)/manage/page.tsx:41` | const donations7d = key(reports.money, &#x27;malo_cents_7d&#x27;); | internal identifier/comment |
| `apps/admin-portal/app/(protected)/manage/page.tsx:57` | donations7dCents: donations7d, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/manage/page.tsx:110` | &lt;StatTile label=&quot;Gifts · 7d&quot; value={usd(donations7d)} missing={donations7d == null} hint=&quot;Recorded gifts, last 7 days&quot; goodDirection=&quot;none&quot; /&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:18` | import { RecentDonationsTable, RecentLedgerTable } from &#x27;@/components/revenue/LedgerTables&#x27;; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:21` | donationSplit, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:48` | const DONATIONS = measureColor(&#x27;donations&#x27;); | internal identifier |
| `apps/admin-portal/app/(protected)/money/page.tsx:83` | const donations7d = m(&#x27;malo_cents_7d&#x27;); | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:84` | const donationsPrev7d = m(&#x27;malo_cents_prev_7d&#x27;); | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:102` | const split = revenueOk ? donationSplit(revenue.streams) : null; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:110` | const ledgerDonations = split?.gross ?? null; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:111` | const crossGap = tipsAll != null &amp;&amp; ledgerDonations != null ? ledgerDonations - tipsAll : null; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:223` | Cross-check: the ledger records {usd(ledgerDonations ?? 0)} in gifts and the gifts table holds {usd(tipsAll ?? 0)}.{&#x27; &#x27;} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:261` | accent={DONATIONS} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:273` | value={donations7d != null ? kpiUsd(donations7d) : &#x27;&#x27;} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:274` | missing={donations7d == null} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:275` | delta={donations7d != null &amp;&amp; donationsPrev7d != null ? { current: donations7d, previous: donationsPrev7d } : null} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:277` | spark={sparkPoints.length &gt; 0 ? { points: sparkPoints, format: usd, accent: DONATIONS } : undefined} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:323` | accent={DONATIONS} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:331` | current={{ label: &#x27;Last 7 days&#x27;, value: donations7d }} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:332` | previous={{ label: &#x27;Prior 7 days&#x27;, value: donationsPrev7d }} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:346` | accent={DONATIONS} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:356` | accent={DONATIONS} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:370` | &lt;RecentDonationsTable rows={malo.recent} error={malo.error} /&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/operations/page.tsx:45` | donations7dCents: null, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:92` | donations7dCents: key(reports.money, &#x27;malo_cents_7d&#x27;), | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:93` | donationsPrev7dCents: key(reports.money, &#x27;malo_cents_prev_7d&#x27;), | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:94` | donationCount7d: key(reports.money, &#x27;malo_count_7d&#x27;), | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:95` | avgDonation7dCents: key(reports.money, &#x27;avg_tip_cents_7d&#x27;), | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:115` | const DONATIONS = measureColor(&#x27;donations&#x27;); | internal identifier |
| `apps/admin-portal/app/(protected)/page.tsx:121` | const donationCard = cards.find((card) =&gt; card.id === &#x27;donations&#x27;)!; | internal identifier |
| `apps/admin-portal/app/(protected)/page.tsx:125` | const overviewCards = cards.filter((card) =&gt; [&#x27;avgDonation&#x27;, &#x27;clips&#x27;, &#x27;opens&#x27;].includes(card.id)); | internal identifier |
| `apps/admin-portal/app/(protected)/page.tsx:132` | donations7dCents: input.donations7dCents, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:151` | &lt;MetricValue card={donationCard} /&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:154` | {isMeasured(input.donationCount7d) ? `${formatCount(input.donationCount7d)} ${input.donationCount7d === 1 ? &#x27;gift&#x27; : &#x27;gifts&#x27;} recorded` : &#x27;Gift count not in this read&#x27;} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:155` | &lt;span className=&quot;mt-1 block text-xs font-normal text-[var(--jade)] sm:mt-0 sm:inline&quot;&gt; · &lt;WeeklyChange card={donationCard} /&gt;&lt;/span&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:204` | accent={DONATIONS} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:243` | &lt;p className=&quot;break-words&quot;&gt;{isMeasured(input.donations7dCents) &amp;&amp; isMeasured(input.clips7d) ? `${formatUsd(input.donations7dCents)} in recorded gifts and ${formatCount(input.clips7d)} ${input.clips7d === 1 ? &#x27;clip&#x27; : &#x27;clips&#x27;} uploaded over the last 7 days.` : &#x27;One or more weekly totals were not in this read.&#x27;}&lt;/p&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:271` | &lt;p className=&quot;mt-3 text-sm&quot;&gt;Prior 7 days — gifts: {isMeasured(input.donationsPrev7dCents) ? formatUsd(input.donationsPrev7dCents) : &#x27;Not in this read&#x27;}; clips: {isMeasured(input.clipsPrev7d) ? formatCount(input.clipsPrev7d) : &#x27;Not in this read&#x27;}.&lt;/p&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:306` | { label: &#x27;Gifts&#x27;, points: malo ?? [], format: formatUsd, accent: DONATIONS }, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:8` | * `get_admin_reports` section as returned. When `donation_bands` is missing (migration not applied) | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:23` | DONATION_BANDS_MISSING_NOTE, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:24` | DONATION_BANDS_TITLE, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:26` | donationBandRows, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:27` | donationBandsSentence, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:138` | const donations7d = n(money, &#x27;malo_cents_7d&#x27;); | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:139` | const donationsPrev = n(money, &#x27;malo_cents_prev_7d&#x27;); | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:155` | paceRow(&#x27;Gifts&#x27;, n(money, &#x27;malo_cents_24h&#x27;), donations7d, formatUsd, measureColor(&#x27;donations&#x27;), &#x27;malo_cents_24h · malo_cents_7d&#x27;), | internal identifier |
| `apps/admin-portal/app/(protected)/reports/page.tsx:177` | const bands = read ? reports.donationBands : null; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:178` | const bandRows: ChartPoint[] &#124; null = bands ? donationBandRows(bands) : null; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:179` | const bandsSummary = !read ? undefined : bands ? donationBandsSentence(bands) : `${DONATION_BANDS_TITLE}: not in this read. ${DONATION_BANDS_MISSING_NOTE}`; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:225` | accent={measureColor(&#x27;donations&#x27;)} | internal identifier |
| `apps/admin-portal/app/(protected)/reports/page.tsx:279` | current={{ label: &#x27;Last 7 days&#x27;, value: donations7d }} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:280` | previous={{ label: &#x27;Prior 7 days&#x27;, value: donationsPrev }} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:282` | accent={measureColor(&#x27;donations&#x27;)} | internal identifier |
| `apps/admin-portal/app/(protected)/reports/page.tsx:374` | title={DONATION_BANDS_TITLE} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:380` | accent={measureColor(&#x27;donations&#x27;)} | internal identifier |
| `apps/admin-portal/app/(protected)/reports/page.tsx:383` | source=&quot;get_admin_reports.donation_bands · under_50 · 50_to_250 · 250_plus&quot; | internal identifier |
| `apps/admin-portal/app/(protected)/reports/page.tsx:545` | &lt;Panel title={DONATION_BANDS_TITLE} kicker=&quot;Gift bands&quot; level={3}&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:547` | &lt;p className=&quot;text-sm text-[var(--text-muted)]&quot;&gt;Not in this read. {DONATION_BANDS_MISSING_NOTE}&lt;/p&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:549` | &lt;CountList rows={bandRows ?? donationBandRows({ under50: null, from50to250: null, over250: null })} /&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:551` | &lt;p className=&quot;mt-3 text-xs leading-4 text-[var(--text-muted)]&quot;&gt;{REPORT_NOTES.donation_bands}&lt;/p&gt; | internal identifier/comment |
| `apps/admin-portal/components/AnalyticsBoard.tsx:13` | *   sentence (the donation bands and their missing note), passed through to `HBarList`. | internal identifier/comment |
| `apps/admin-portal/components/charts/CompareBars.tsx:21` | /** Noun for the default sentence (&quot;Clips uploaded&quot;, &quot;Donations&quot;). Defaults to `title`. */ | internal identifier/comment |
| `apps/admin-portal/components/charts/HBarList.tsx:19` | /** Shown when `rows` is an empty list, e.g. &quot;No donations in the last 7 days.&quot; */ | internal identifier/comment |
| `apps/admin-portal/components/revenue/LedgerTables.tsx:19` | import { donationChannel, ledgerDetail, streamName, utcStamp } from &#x27;./revenueModel&#x27;; | internal identifier/comment |
| `apps/admin-portal/components/revenue/LedgerTables.tsx:167` | export function RecentDonationsTable({ rows, error }: { rows: MaloTxn[]; error: string &#124; null }) { | internal identifier/comment |
| `apps/admin-portal/components/revenue/LedgerTables.tsx:178` | { label: &#x27;Started&#x27;, value: donationChannel(row.origin, row.entry, row.source_label) }, | internal identifier/comment |
| `apps/admin-portal/components/revenue/LedgerTables.tsx:193` | &lt;td className=&quot;px-3 py-2 text-[var(--ink-soft)]&quot;&gt;{donationChannel(row.origin, row.entry, row.source_label)}&lt;/td&gt; | internal identifier/comment |
| `apps/mobile/app/(parent)/parent/index.tsx:162` | {/* Rally goal (start / approve / close / thank) and donations to say thanks for. */} | internal identifier/comment |
| `apps/mobile/app/(tabs)/index.tsx:74` | * @purpose Full-screen Home feed: Home mix, a Beyond switch (workout + service Highlights, with a link to the Beyond the Game page for fan posts), clip + athlete search, and a Local jump. All and Seki stay off the bar until a later pass. Exclusive mute/Aura gestures, live score banner, donation sheet, Player of the Week spotlight. A guest can watch the opened Highlight and two more swipes, then the account sheet. Pages ride `ReelPage` for card-deck depth on vertical paging and swipe left / right to peek the athlete who owns the clip. | internal identifier/comment |
| `apps/mobile/app/api/create-payment-intent+api.ts:2` | * Expo API route (Metro only): POST creates a Stripe PaymentIntent for a donation. | internal identifier/comment |
| `apps/mobile/app/gift/[handle].tsx:31` | * donate straight from the scan, open the athlete profile, or pass the QR on. | internal identifier/comment |
| `apps/mobile/app/gift/[handle].tsx:33` | * @sideEffects `get_public_profiles` + `players` lookup; donate sheet tagged `origin=qr` / `entry=qr_link` behind the soft wall. | internal identifier/comment |
| `apps/mobile/app/gift/[handle].tsx:44` | const [donateOpen, setDonateOpen] = useState(false); | internal identifier/comment |
| `apps/mobile/app/gift/[handle].tsx:59` | const donate = () =&gt; { | internal identifier/comment |
| `apps/mobile/app/gift/[handle].tsx:65` | resume: () =&gt; setDonateOpen(true), | internal identifier/comment |
| `apps/mobile/app/gift/[handle].tsx:95` | onPress={donate} | internal identifier/comment |
| `apps/mobile/app/gift/[handle].tsx:139` | player={donateOpen ? found.player : null} | internal identifier/comment |
| `apps/mobile/app/gift/[handle].tsx:142` | onClose={() =&gt; setDonateOpen(false)} | internal identifier/comment |
| `apps/mobile/src/backend/api/createPaymentIntent.ts:18` | import { serverDonationContextAdapter } from &#x27;../../../../../supabase/functions/_shared/money/serverDonationContext.ts&#x27;; | internal identifier/protocol reference |
| `apps/mobile/src/backend/api/createPaymentIntent.ts:25` | * @purpose Mint a Stripe PaymentIntent (test mode) for donation / exclusive / Drip / booster checkout. | internal identifier/comment |
| `apps/mobile/src/backend/api/createPaymentIntent.ts:30` | *   compliance — LEGAL_BRIEFING.md §8 item 5: the only point where a donation can be rejected before the card is | internal identifier/comment |
| `apps/mobile/src/backend/api/createPaymentIntent.ts:63` | donationContext: serverDonationContextAdapter(serviceKey | internal identifier/protocol reference |
| `apps/mobile/src/frontend/components/Admin/Books/booksSections.ts:59` | const athletes = athleteHeld(entries, period.to).filter((row) =&gt; row.held !== 0 &#124;&#124; row.donations &#124;&#124; row.vault); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Books/booksSections.ts:119` | { title: &#x27;Held per athlete&#x27;, table: { columns: [&#x27;Athlete&#x27;, &#x27;Gifts&#x27;, &#x27;Vault&#x27;, &#x27;Paid out&#x27;, &#x27;Held&#x27;], rows: athletes.map((row) =&gt; [nameByRef[row.athleteRef] ?? row.athleteRef, booksUsd(row.donations), booksUsd(row.vault), booksUsd(row.paidOut), booksUsd(row.held)]) } }, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/MinorAccountsPanel.tsx:63` | { label: &#x27;Consent: payouts&#x27;, value: report.teensDonationsConsent }, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/MinorAccountsPanel.tsx:128` | {`Consent ${consent.formVersion} signed ${day(consent.signedAt)} by ${consent.signerName} (${consent.relationship === &#x27;parent&#x27; ? &#x27;parent&#x27; : &#x27;legal guardian&#x27;}): public profile ${consent.allowsPublicProfile ? &#x27;yes&#x27; : &#x27;no&#x27;}, payouts ${consent.allowsDonations ? &#x27;yes&#x27; : &#x27;no&#x27;}${consent.revokedAt ? ` · ended ${day(consent.revokedAt)} (${consent.revokeReason ?? &#x27;&#x27;})` : &#x27;&#x27;}`} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Notifications/NotificationAdminPanel.tsx:3` | * Source authority is server-owned; staff cannot enable an unimplemented donation source or send mail here. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/PayeeVerificationPanel.tsx:3` | * athletes whose donations would go to them (as the athlete or the guardian on record), what each payee still needs, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/AdminReportHome.tsx:22` | /** @purpose Home&#x27;s h1, donation amount/count/change, three overview measures and primary Trends link. */ | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/AdminReportHome.tsx:25` | const input = homeInput(data); const cards = homeKpis(input, formatUsd); const donation = cards.find(card =&gt; card.id === &#x27;donations&#x27;)!; | internal identifier |
| `apps/mobile/src/frontend/components/Admin/Reports/AdminReportHome.tsx:31` | &lt;Text style={[s.heroValue, { fontSize: width &lt; 640 ? 48 : 60, minWidth: 0, maxWidth: &#x27;100%&#x27;, flexShrink: 1 }]} numberOfLines={Platform.OS === &#x27;web&#x27; ? undefined : 1} adjustsFontSizeToFit={Platform.OS !== &#x27;web&#x27;} minimumFontScale={0.6} accessibilityLabel={`Gifts this week: ${donation.missing ? &#x27;Not in this read&#x27; : donation.value}`}&gt;{donation.value}&lt;/Text&gt; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/AdminReportHome.tsx:32` | &lt;View style={[s.row, { gap: 6 }]}&gt;&lt;Text style={s.strong}&gt;{isMeasured(input.donationCount7d) ? `${formatCount(input.donationCount7d)} ${input.donationCount7d === 1 ? &#x27;gift&#x27; : &#x27;gifts&#x27;} recorded` : &#x27;Gift count not in this read&#x27;}&lt;/Text&gt; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/AdminReportHome.tsx:33` | &lt;Text style={[s.small, { color: c.jade }]}&gt;{weeklyChange(donation)}&lt;/Text&gt;&lt;/View&gt; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/AdminReportHome.tsx:36` | {cards.filter(card =&gt; [&#x27;avgDonation&#x27;, &#x27;clips&#x27;, &#x27;opens&#x27;].includes(card.id)).map(card =&gt; &lt;View key={card.id} style={{ flexGrow: 1, flexBasis: &#x27;28%&#x27;, minWidth: 144, borderLeftWidth: 1, borderLeftColor: c.border, paddingLeft: 16, gap: 8 }}&gt; | internal identifier |
| `apps/mobile/src/frontend/components/Admin/Reports/AdminReportHome.tsx:65` | &lt;Text style={s.kicker}&gt;At a glance&lt;/Text&gt;&lt;Text style={s.sentence}&gt;{isMeasured(input.donations7dCents) &amp;&amp; isMeasured(input.clips7d) ? `${formatUsd(input.donations7dCents)} in recorded gifts and ${formatCount(input.clips7d)} ${input.clips7d === 1 ? &#x27;clip&#x27; : &#x27;clips&#x27;} uploaded over the last 7 days.` : &#x27;One or more weekly totals were not in this read.&#x27;}&lt;/Text&gt; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:8` | ledgerDetail, originName, entryName, donationChannel, utcStamp, fillDays, shortDay, donationSplit, giftRepairGapNotice, kpiUsd, payeeName } from &#x27;@tapuai/shared-types/admin&#x27;; | internal identifier/protocol reference |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:54` | return { donations7dCents: n(&#x27;money&#x27;, &#x27;malo_cents_7d&#x27;), donationsPrev7dCents: n(&#x27;money&#x27;, &#x27;malo_cents_prev_7d&#x27;), donationCount7d: n(&#x27;money&#x27;, &#x27;malo_count_7d&#x27;), avgDonation7dCents: n(&#x27;money&#x27;, &#x27;avg_tip_cents_7d&#x27;), | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:60` | return { reportsError: d.reports.error, revenueError: d.revenue.error, donations7dCents: n(&#x27;money&#x27;, &#x27;malo_cents_7d&#x27;), sessions24h: n(&#x27;usage&#x27;, &#x27;sessions_24h&#x27;), issues24h: n(&#x27;usage&#x27;, &#x27;issues_24h&#x27;), | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:79` | { id: &#x27;donations&#x27;, title: &#x27;Gifts&#x27;, charts: [trend(&#x27;Gifts&#x27;, list(series.malo), &#x27;cents&#x27;, &#x27;jade&#x27;, &#x27;get_admin_reports.series.malo&#x27;, error, &#x27;area&#x27;)] }, | internal identifier |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:81` | { id: &#x27;rest&#x27;, title: &#x27;The rest of the picture&#x27;, kpis: cards.filter(c =&gt; ![&#x27;donations&#x27;, &#x27;avgDonation&#x27;, &#x27;clips&#x27;, &#x27;opens&#x27;].includes(c.id)), tables: [{ title: &#x27;Data sources&#x27;, table: { columns: [&#x27;Measure&#x27;, &#x27;Meaning&#x27;], rows: cards.map(c =&gt; [c.label, c.hint]) }, source: &#x27;get_admin_reports; get_company_revenue_summary&#x27; }] }, | internal identifier |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:114` | const donations = valid ? donationSplit(r.streams) : null; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:117` | const policySplit = split(&#x27;Gift split, from the ledger&#x27;, [{ key: &#x27;family&#x27;, label: &quot;Athletes&#x27; family accounts&quot;, value: donations?.family ?? null, color: &#x27;jade&#x27; }, { key: &#x27;company&#x27;, label: &quot;Historical Tapua&#x27;i gift share&quot;, value: donations?.platform ?? null, color: &#x27;gold&#x27; }, ...(donations &amp;&amp; donations.unsplit &gt; 0 ? [{ key: &#x27;unsplit&#x27;, label: &#x27;Recorded but not split&#x27;, value: donations.unsplit, color: &#x27;muted&#x27; as const }] : [])], &#x27;get_company_revenue_summary.streams[malo]&#x27;); | internal identifier/protocol reference |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:118` | policySplit.caption = donations?.policy ? `Model returned for this stream: ${donations.policy}` : &#x27;Gifts stream&#x27;; | internal identifier/protocol reference |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:121` | const cross = donations &amp;&amp; n(&#x27;money&#x27;, &#x27;malo_cents_all&#x27;) != null ? donations.gross - n(&#x27;money&#x27;, &#x27;malo_cents_all&#x27;)! : null; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:123` | const donationKpi = (label: string, valueKey: string, countKey: string): ReportKpi =&gt; { | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:134` | charts: [ledgerRing, policySplit], sentences: cross == null ? [] : [`Cross-check: the ledger records ${formatUsd(donations!.gross)} in gifts and the tips table holds ${formatUsd(n(&#x27;money&#x27;, &#x27;malo_cents_all&#x27;)!)}. ${cross === 0 ? &#x27;They match.&#x27; : `They differ by ${formatUsd(Math.abs(cross))}. Check company_revenue_logs.`}`] }, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:136` | { id: &#x27;donations&#x27;, title: &#x27;Gifts&#x27;, kpis: [donationKpi(&#x27;Gifts, last 7 days&#x27;, &#x27;malo_cents_7d&#x27;, &#x27;malo_count_7d&#x27;), donationKpi(&#x27;Gifts, last 24 hours&#x27;, &#x27;malo_cents_24h&#x27;, &#x27;malo_count_24h&#x27;), { ...kpi(&#x27;Average gift, 7 days&#x27;, &#x27;money&#x27;, &#x27;avg_tip_cents_7d&#x27;, &#x27;cents&#x27;), hint: &#x27;Mean amount per gift&#x27; }, donationKpi(&#x27;Gifts, all time&#x27;, &#x27;malo_cents_all&#x27;, &#x27;malo_count_all&#x27;)], | internal identifier |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:141` | { id: &#x27;latest&#x27;, title: &#x27;Latest gifts&#x27;, sentences: breakdownOk &amp;&amp; !d.breakdown.recent.length ? [&#x27;No gifts yet.&#x27;] : [], tables: [{ title: &#x27;Latest gifts&#x27;, source: d.breakdown.source === &#x27;fallback&#x27; ? &#x27;tips&#x27; : &#x27;get_admin_malo_breakdown.recent&#x27;, initiallyOpen: true, table: { columns: [&#x27;When (UTC)&#x27;, &#x27;Athlete&#x27;, &#x27;Gift sender&#x27;, &#x27;Where it started&#x27;, &#x27;Linked to&#x27;, &#x27;Amount&#x27;], rows: breakdownOk ? d.breakdown.recent.slice(0, 40).map(row =&gt; [utcStamp(row.created_at) ?? &#x27;Not in this read&#x27;, row.athlete_name, row.fan_name, donationChannel(row.origin, row.entry, row.source_label), row.wishlist_item_id ? `Gear goal ${row.wishlist_item_id.slice(0, 8)}` : row.reel_id ? `Clip ${row.reel_id.slice(0, 8)}` : &#x27;Not linked to a clip or gear goal&#x27;, formatUsd(row.amount_cents)]) : [] } }] }, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:150` | { id: &#x27;billing&#x27;, title: &#x27;Billing&#x27;, kpis: [{ label: &#x27;Gifts · 7d&#x27;, value: chartValue(totals.donations7dCents, &#x27;cents&#x27;), missing: totals.donations7dCents == null }, { label: &#x27;Gross volume&#x27;, value: chartValue(totals.grossCents, &#x27;cents&#x27;), missing: totals.grossCents == null }, { label: &quot;Tapua&#x27;i share&quot;, value: chartValue(totals.companyNetCents, &#x27;cents&#x27;), missing: totals.companyNetCents == null }], sentences: [&#x27;Gifts and revenue are recorded amounts. Vault remains recorded for the athlete; family routing is pending counsel and implementation.&#x27;], links: [{ label: &#x27;Open Revenue&#x27;, href: &#x27;/admin/revenue&#x27; }] }, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/SportQuiz/SportQuizLifeQuestion.tsx:28` | &lt;Text&gt;Every Life question is for everyone 13+. Keep it a simple fact anyone can check. At approval the server refuses: &quot;you should / must / need to&quot; advice, brand names, Tapua&#x27;i money words (Tapua&#x27;i, donation, donor, Rally, family account, payout, Aura, gift and the thank-you word), NIL or eligibility, tax, loans, credit scores or APR, any money amount, price, percentage, rate or &quot;k / grand / million&quot; figure, and years. Scam Defense explanations end &quot;Tell a trusted adult and use Report.&quot; Prompts stay within 120 characters and explanations within 200.&lt;/Text&gt; | visible internal vocabulary |
| `apps/mobile/src/frontend/components/Admin/SportQuiz/triviaDesk.ts:31` | tapuai_money_word: &#x27;No Tapua’i money words (donation, donor, Rally, family account, payout, Aura, gift, the thank-you word).&#x27;, | visible internal vocabulary |
| `apps/mobile/src/frontend/components/Admin/Support/SupportFlowTab.tsx:23` | &lt;AdminField label=&quot;Find a data source or team&quot; value={query} onChangeText={setQuery} placeholder=&quot;For example: donation, support, ledger, security&quot; /&gt; | visible internal vocabulary |
| `apps/mobile/src/frontend/components/Admin/Support/SupportIssuesTab.tsx:9` | const featureSources: Record&lt;string, string&gt; = { highlights: &#x27;reels&#x27;, activity: &#x27;tips&#x27;, local: &#x27;games&#x27;, spotlight: &#x27;spotlight_awards&#x27;, drip: &#x27;shop_products&#x27;, profile: &#x27;profiles&#x27;, auth: &#x27;profiles&#x27;, donation: &#x27;tips&#x27;, payouts: &#x27;disbursements&#x27;, operator: &#x27;game_events&#x27;, upload: &#x27;reels&#x27;, admin: &#x27;app_runtime_config&#x27;, support: &#x27;support_signals&#x27;, app: &#x27;support_signals&#x27; }; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianConsentForm.tsx:20` | canAllowDonations: boolean; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianConsentForm.tsx:28` | export function GuardianConsentForm({ teenFirstName, canAllowDonations, initial, busy, onSign, onCancel }: Props) { | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianConsentForm.tsx:30` | const [donations, setDonations] = useState(canAllowDonations &amp;&amp; (initial?.allowsDonations ?? false)); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianConsentForm.tsx:51` | {canAllowDonations ? ( | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianConsentForm.tsx:52` | &lt;LegalAckToggle checked={donations} onCheckedChange={setDonations} disabled={busy} label={`Gifts to ${teenFirstName} may be paid out to the family account on record`} /&gt; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianConsentForm.tsx:87` | onPress={() =&gt; onSign({ signerName: name.trim(), relationship, allowsDonations: donations, allowsPublicProfile: publicProfile })} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianSupervisionPanel.tsx:55` | const allowed = [row.myConsent.allowsPublicProfile ? &#x27;public profile&#x27; : null, row.myConsent.allowsDonations ? &#x27;payouts&#x27; : null].filter(Boolean); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianSupervisionPanel.tsx:197` | canAllowDonations={row.canAllowDonations} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianSupervisionPanel.tsx:215` | const [preview, setPreview] = useState&lt;{ firstName: string; username: string &#124; null; canAllowDonations: boolean } &#124; null&gt;(null); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianSupervisionPanel.tsx:297` | canAllowDonations={preview.canAllowDonations} | internal identifier/comment |
| `apps/mobile/src/frontend/components/FanZone/FanZoneStory.tsx:10` | /** @sideEffects Explicit public free-story player and navigation into the existing athlete profile/Donate flow. */ | internal identifier/comment |
| `apps/mobile/src/frontend/components/Filmers/FilmerCard.tsx:2` | * Badge tiers and earned Aura stay separate from athlete donations and school verification. */ | internal identifier/comment |
| `apps/mobile/src/frontend/components/Onboarding/WelcomeOverlay.tsx:14` | import { DONATION_MISSION, TAGLINE_HEADLINE, TAGLINE_LINE } from &#x27;@/data/malo&#x27;; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Onboarding/WelcomeOverlay.tsx:20` | * @purpose One-time first-open welcome for guests — brand + support story and the Donate. Elevate. Celebrate. message, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Onboarding/WelcomeOverlay.tsx:69` | {DONATION_MISSION} Watch their highlights, cheer your school, and give in a few taps — so our kids feel | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:141` | * @purpose Local play-by-play card. Opening the card celebrates the play with Seki, Aura and Flex. Donate is a button that opens the donation only after that tap. | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:143` | * @param onBacked Fires after a donation on this athlete. | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:146` | * @sideEffects One `bumpPlayerHype` per kind the first time it is selected. Later taps only select and clear. Donation uses `TipCheckout` after Donate. | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:152` | const [donateOpen, setDonateOpen] = useState(false); | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:168` | if (!next) setDonateOpen(false); | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:261` | {player &amp;&amp; !donateOpen ? ( | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:266` | onPress={() =&gt; setDonateOpen(true)} | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:267` | style={styles.donate} | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:269` | &lt;Text style={styles.donateLabel}&gt;{maloAthleteCta(player.name)}&lt;/Text&gt; | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:272` | {player &amp;&amp; donateOpen ? ( | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:278` | onPress={() =&gt; setDonateOpen(false)} | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:279` | style={styles.donateBack} | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:281` | &lt;Text style={styles.donateBackLabel}&gt;Back to celebrating&lt;/Text&gt; | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:409` | donate: { | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:417` | donateLabel: { | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:422` | donateBack: { | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:427` | donateBackLabel: { | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/AccountTagInbox.tsx:3` | * on that Highlight. Declining removes it. Donations are not affected. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/AthleteProfileView.tsx:152` | * @purpose One athlete sheet for the Profile tab and `/user/[id]`: hero, Crew, compact Donate/Share and direct Highlights / Stats / Goals / Vault / Manage sections. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/AthleteProfileView.tsx:155` | * @param onDropMalo Donate — hidden on your own claimed row. One-time Exclusive stays on the Vault tab and a locked Highlight. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/AthleteProfileView.tsx:236` | const showDonateTagline = showFanSupport &amp;&amp; athleteIdentity &amp;&amp; Boolean(onDropMalo &amp;&amp; live.buttons.malo); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/AthleteProfileView.tsx:471` | {/* Brand line (BRAND-01) only where this athlete can actually be donated to; plain text, not a heading. */} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/AthleteProfileView.tsx:472` | {showDonateTagline ? &lt;&gt;&lt;Text style={styles.donateTagline}&gt;{TAGLINE_HEADLINE}&lt;/Text&gt;&lt;Text style={styles.donateTagline}&gt;Gifts to individual athletes are personal gifts and are not tax-deductible.&lt;/Text&gt;&lt;/&gt; : null} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/AthleteProfileView.tsx:486` | {/* Look desk &quot;Actions on top&quot; (profile.actionsOnTop): parks Donate / Share under the section tabs. */} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/AthleteProfileView.tsx:703` | donateTagline: { fontSize: 12, lineHeight: 17, fontWeight: &#x27;700&#x27;, color: colors.textMuted }, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/AuraTradingCard.tsx:190` | * @sideEffects Reanimated `withSpring` `rotateY` 0↔180 (`SPRING_FLIP`, `perspective: 1000`); `Haptics.impactAsync(Medium)` exactly when the rotation crosses 90°; back-face Aura points / donation totals fade in with `withDelay`; Skia canvas when the glow is on. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/LockerRoomWishlist.tsx:1` | /** Profile sports-goal rack keeps each gear target, donation progress and Share controls together. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/LockerRoomWishlist.tsx:2` | * Existing donation review, fulfilled gear and private upload rules remain in their respective services. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/LockerRoomWishlist.tsx:3` | * @sideEffects Wishlist reads, donation checkout, image linking and haptics through existing helpers. */ | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/PrivacySettingsSheet.tsx:346` | ? `Consent: ${[guardian.consent.allowsPublicProfile ? &#x27;public profile&#x27; : null, guardian.consent.allowsDonations ? &#x27;payouts&#x27; : null].filter(Boolean).join(&#x27;, &#x27;) &#124;&#124; &#x27;nothing extra&#x27;}` | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/ReceivedMaloPanel.tsx:11` | import { useDonationsToThank } from &#x27;@/hooks/useDonationThanks&#x27;; | internal identifier |
| `apps/mobile/src/frontend/components/Profile/ReceivedMaloPanel.tsx:13` | import { thanksText, type ThanksKey } from &#x27;@/lib/donationThanks&#x27;; | internal identifier |
| `apps/mobile/src/frontend/components/Profile/ReceivedMaloPanel.tsx:18` | * @purpose Private list (athlete&#x27;s own profile, and Parent HQ) of each donation received and where it | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/ReceivedMaloPanel.tsx:22` | * @sideEffects `useReceivedMalo` → `get_received_malo`; `useDonationsToThank` → `get_donations_to_thank`, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/ReceivedMaloPanel.tsx:23` | *   `thank_donation`. A failed or missing ledger shows $0 and &quot;No donations yet&quot;, not a connection error. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/ReceivedMaloPanel.tsx:27` | const { rows: thanksRows, thank } = useDonationsToThank(playerId); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/ReceivedMaloPanel.tsx:32` | // The headline is what reaches the family account, not the donated total (which is more). | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:21` | import { thanksText, type ThanksKey } from &#x27;@/lib/donationThanks&#x27;; | internal identifier |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:56` | *   Donate and Share for fans; Start / Approve / Close / Say thanks for the family. A full-screen | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:57` | *   moment when a donation fills it. Hides itself for fans when there is no Rally (or before the SQL is applied). | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:58` | * @sideEffects `useRally`; Rally RPCs; donate sheet with `rally_id`. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:74` | const [donateOpen, setDonateOpen] = useState(false); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:153` | const canDonate = rally.status === &#x27;live&#x27; &amp;&amp; live.buttons.malo; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:191` | {canDonate &amp;&amp; !manage ? ( | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:200` | telemetry.trackFeature(&#x27;rally_donate&#x27;, &#x27;profile&#x27;); | internal identifier |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:201` | setDonateOpen(true); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:283` | player={donateOpen ? player : null} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:288` | onClose={() =&gt; setDonateOpen(false)} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyMeter.tsx:21` | * @sideEffects `useRally` → `get_active_rally`. Donate sheet with `origin=rally`. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyMeter.tsx:33` | const [donateOpen, setDonateOpen] = useState(false); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyMeter.tsx:68` | telemetry.trackFeature(&#x27;rally_donate&#x27;, &#x27;highlight&#x27;); | internal identifier |
| `apps/mobile/src/frontend/components/Rally/RallyMeter.tsx:69` | setDonateOpen(true); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyMeter.tsx:87` | player={donateOpen ? player : null} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyMeter.tsx:91` | onClose={() =&gt; setDonateOpen(false)} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/PhotoStoryMedia.tsx:3` | * this instead of the video player when `isPhotoStory(clip)`; the rail, donate, report and credit stay in | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/ReelCard.tsx:2` | * One full-screen Highlights clip: video player, hype rail (Seki / Aura / Flex), donate button, save, report, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/ReelOwnerPeek.tsx:45` | /** Donation PaymentSheet is allowed for this clip (confirmed athlete tag). */ | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/ReelOwnerPeek.tsx:79` | * line when a fan other than the athlete posted it, Crew / Donations / Seki / Aura in a 2 x 2 grid, Join Crew and | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/ReelOwnerPeek.tsx:80` | * Donate side by side, and Open full profile. One primary action: Donate when the athlete is confirmed on the clip; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/ReelOwnerPeek.tsx:81` | * otherwise (pending tag, or no donate handler) Open full profile takes over the filled style. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/ReelOwnerPeek.tsx:220` | // One filled (primary) action at a time. Donate leads when the athlete is confirmed on this clip; otherwise the | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/ReelOwnerPeek.tsx:222` | const donatePrimary = Boolean(onTip) &amp;&amp; maloReady; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/ReelOwnerPeek.tsx:223` | const profilePrimary = !donatePrimary &amp;&amp; Boolean(onOpenProfile); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/ReelOwnerPeek.tsx:776` | // Pinned footer: Donate / Join Crew and Open full profile. Opaque, with a hairline so scrolled content reads as | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/UploadChoiceSheet.tsx:29` | * @param onHighlight Athlete clip (game, workout or service) → Highlights, where fans can donate. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/UploadVideoModal.tsx:5` | * line, then upload. A video can publish with Tag later; Donate stays off until an athlete is tagged. Photo stories | internal identifier/comment |
| `apps/mobile/src/frontend/components/SportQuiz/FunFactMoment.tsx:5` | *   (`getPublicProfiles`, the same helper the profile sheets use), with initials when there is no photo. No Donate, | internal identifier/comment |
| `apps/mobile/src/frontend/components/SportQuiz/LifePlaybookHome.tsx:6` | * credit topics). This screen has no donation, checkout or money controls. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Thanks/ThanksPicker.tsx:5` | import { THANKS_MESSAGES, type ThanksKey } from &#x27;@/lib/donationThanks&#x27;; | internal identifier |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:15` | import { PLATFORM_TIP_HINT, PLATFORM_TIP_PERCENTS, PLATFORM_TIP_TITLE, TAGLINE_HEADLINE, donationBreakdownLine, donationSplitLine, donationWhereItGoes, platformTipCentsFor, platformTipChipLabel } from &#x27;@/data/malo&#x27;; | internal identifier/comment |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:52` | useScreenMountTime(&#x27;donate-sheet&#x27;); | internal identifier |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:106` | const breakdown = amount == null ? &#x27;&#x27; : donationBreakdownLine({ athleteName: playerName, donationDollars: amount, feeDollars: fee, tipPercent: displayed?.platformTipPercent ?? 0 }); | internal identifier/protocol reference |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:175` | &lt;View style={styles.hero}&gt;&lt;Text style={styles.kicker}&gt;COMMUNITY LOVE 💚&lt;/Text&gt;&lt;Text style={styles.pageTitle}&gt;Choose your gift&lt;/Text&gt;&lt;Text style={styles.split}&gt;{donationSplitLine(playerName)}&lt;/Text&gt;&lt;Text style={styles.copy}&gt;For {playerName}&#x27;s sports costs — fees, gear and travel.&lt;/Text&gt;&lt;/View&gt; | internal identifier/protocol reference |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:192` | &lt;Text style={styles.disclaimer}&gt;{donationWhereItGoes(playerName)}&lt;/Text&gt; | internal identifier/comment |
| `apps/mobile/src/frontend/components/UI/JerseyBadge.tsx:2` | * Jersey number as a block numeral in a double-stitched patch (UX-08), used on athlete heroes, the QR donate page | internal identifier/comment |
| `apps/mobile/src/frontend/context/CelebrationContext.tsx:2` | * Tiny global store for the two &quot;moment&quot; overlays: the full-screen thank-you after a donation and the Aura / | internal identifier/comment |
| `apps/mobile/src/frontend/context/SoftWallContext.tsx:2` | * Browse-first soft wall. A guest can watch a shared Highlight and two more swipes. Upload, Donate, | internal identifier/comment |
| `apps/mobile/src/frontend/context/SoftWallContext.tsx:45` | * @purpose Browse-first soft wall: a few Highlights are free; Upload / Donate / Crew / gear goals require auth then resume. | internal identifier/comment |
| `apps/mobile/src/frontend/context/SoftWallContext.tsx:85` | // Release the stashed action (donate checkout, Join Crew, gear goal — all money-adjacent) only once | internal identifier/comment |
| `apps/mobile/src/frontend/data/finance.ts:19` | /** Optional tip a donor adds for Tapua&#x27;i at checkout — all platform, logged apart from the donation. */ | internal identifier/comment |
| `apps/mobile/src/frontend/data/guardianConsent.ts:3` | * public profile and/or have donations paid out for them. The server accepts only GUARDIAN_CONSENT_VERSION with this | internal identifier/comment |
| `apps/mobile/src/frontend/data/guardianConsent.ts:27` | body: &#x27;I choose each permission separately. Public profile: anyone, including adults, can see what {teen} shares with &quot;Everyone&quot;. Donations paid out: donations to {teen} can be paid out to the family account on record for {teen}, for {teen} only. Only the guardian on record for that family account can allow this.&#x27;, | frozen signed consent |
| `apps/mobile/src/frontend/data/guardianConsent.ts:31` | body: &quot;Nothing is paid out without {teen}&#x27;s approval, and control passes to {teen} at 18 (or the age in your state). Tapua&#x27;i keeps 10% of each donation to run the app, including card processing. Donations are not tax-deductible.&quot;, | frozen signed consent |
| `apps/mobile/src/frontend/data/guestBrowse.ts:3` | * Upload, Donate, and Join Crew stay closed until there is an account. | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:14` | export const DONATE_LABEL = &#x27;Give&#x27;; | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:17` | export const DONATION_MISSION = | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:30` | export function donationWhereItGoes(athleteName?: string &#124; null): string { | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:42` | export function donationSplitLine(athleteName?: string &#124; null): string { | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:60` | /** Cents for a percent tip on a donation of `donationDollars`. */ | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:61` | export function platformTipCentsFor(donationDollars: number, percent: number): number { | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:62` | if (!Number.isFinite(donationDollars) &#124;&#124; donationDollars &lt;= 0 &#124;&#124; !Number.isFinite(percent) &#124;&#124; percent &lt;= 0) return 0; | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:63` | return Math.round(donationDollars * percent); | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:76` | export function donationBreakdownLine(args: { | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:78` | donationDollars: number; | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:83` | const cents = Math.round(args.donationDollars * 100); | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:85` | const tipCents = platformTipCentsFor(args.donationDollars, args.tipPercent); | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:120` | return `${DONATE_LABEL} to ${name}`; | internal identifier/comment |
| `apps/mobile/src/frontend/data/verification.ts:41` | /** MINOR-01: an athlete aged 13–17 — payouts need the donations consent of the guardian on record for the family account. */ | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useActivityFeed.ts:4` | * `useMyDonationThanks` and `usePendingPlayerTags`. | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useActivityFeed.ts:10` | import { useMyDonationThanks } from &#x27;@/hooks/useDonationThanks&#x27;; | internal identifier |
| `apps/mobile/src/frontend/hooks/useActivityFeed.ts:14` | import { thanksText } from &#x27;@/lib/donationThanks&#x27;; | internal identifier |
| `apps/mobile/src/frontend/hooks/useActivityFeed.ts:35` | * @purpose The Activity timeline — donations received, donations sent, thank-yous from athletes, and | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useActivityFeed.ts:51` | const thanks = useMyDonationThanks(); | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:5` | fetchDonationsToThank, | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:6` | fetchMyDonationThanksResult, | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:7` | thankDonation, | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:8` | type DonationToThank, | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:12` | } from &#x27;@/lib/donationThanks&#x27;; | internal identifier |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:15` | * @purpose Athlete / guardian side: recent donations and a `thank(tipId, key)` that marks the row | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:18` | * @sideEffects `get_donations_to_thank`, `thank_donation`. | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:20` | export function useDonationsToThank(playerId: string &#124; null &#124; undefined) { | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:21` | const [rows, setRows] = useState&lt;DonationToThank[]&gt;([]); | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:31` | setRows(await fetchDonationsToThank(playerId)); | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:40` | const result = await thankDonation(tipId, key); | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:52` | * @sideEffects `get_my_donation_thanks` once signed in. | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:54` | export function useMyDonationThanks() { | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:69` | const result = await fetchMyDonationThanksResult(); | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useFanTipHistory.ts:2` | * A signed-in fan&#x27;s own donation history, with totals (donated, athletes supported, Aura earned). | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useFanTipHistory.ts:4` | * `error` so the screen can offer Retry instead of an empty list. (Code name `tip` = donation.) | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useFanTipHistory.ts:5` | * @sideEffects Reads the fan&#x27;s donation rows from Supabase. | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useFanTipHistory.ts:12` | import { fetchFanTipHistory } from &#x27;@/lib/donationHistory&#x27;; | internal identifier |
| `apps/mobile/src/frontend/hooks/useFanTipHistory.ts:34` | * @sideEffects `lib/donationHistory.fetchFanTipHistory` (RPC `get_fan_tip_history`, `tips` SELECT fallback). | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useReceivedMalo.ts:4` | import { fetchReceivedMalo } from &#x27;@/lib/donationHistory&#x27;; | internal identifier |
| `apps/mobile/src/frontend/hooks/useReceivedMalo.ts:12` | * @returns `{ rows, totalCents, loading, error }` — empty when nobody has donated, the viewer is not that athlete, or the ledger call failed. | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useReceivedMalo.ts:14` | * @sideEffects RPC `get_received_malo` through `lib/donationHistory`. `telemetry.trackIssue` when that call fails. | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:157` | const { amountCents: donationChargeCents } = getTipCharge(tipAmount, coverFees, feeAmount); | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:160` | const amountCents = donationChargeCents + platformTipCents; | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:187` | supportSignals.capture({ feature: &#x27;donation&#x27;, code: &#x27;payment_failed&#x27; }); | internal identifier |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:196` | if (presentError.code === &#x27;Canceled&#x27;) { supportSignals.capture({ feature: &#x27;donation&#x27;, code: &#x27;user_cancelled&#x27; }); return; } | internal identifier |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:197` | supportSignals.capture({ feature: &#x27;donation&#x27;, code: &#x27;payment_failed&#x27; }); | internal identifier |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:234` | cover_fee_cents: Math.max(0, donationChargeCents - Math.round(tipAmount * 100)), | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:241` | supportSignals.capture({ feature: &#x27;donation&#x27;, code: &#x27;data_invalid&#x27; }); | internal identifier |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:295` | supportSignals.capture({ feature: &#x27;donation&#x27;, code: paymentSucceeded ? &#x27;data_invalid&#x27; : &#x27;payment_failed&#x27; }); | internal identifier |
| `apps/mobile/src/frontend/lib/accountTags.ts:2` | * Account mentions on a Highlight. The athlete tag still decides who receives a donation. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/accountTags.ts:43` | * @purpose Attach pending mentions after a Highlight publishes. Does not change who the donation goes to. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:261` | { id: &#x27;rally_donate&#x27;, label: &#x27;Give to a Rally&#x27;, hint: &#x27;Rally card → give sheet (origin rally)&#x27;, surface: &#x27;profile&#x27;, fanHref: &#x27;/profile&#x27;, adminHref: &#x27;/admin/money&#x27;, flag: &#x27;buttons.malo&#x27;, telemetry: &#x27;rally_donate&#x27; }, | internal identifier |
| `apps/mobile/src/frontend/lib/adminReports.ts:33` | // The structural boundary supports the legacy donation RPC absent from the generated local map. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/adminReports.ts:124` | * @purpose Read donation origins, retaining bounded fallback provenance. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/adminReports.ts:128` | export async function fetchAdminDonationBreakdown(): Promise&lt;PortalMaloBreakdown&gt; { | internal identifier/comment |
| `apps/mobile/src/frontend/lib/adminReports.ts:225` | sections.breakdown === false ? empty.breakdown : fetchAdminDonationBreakdown(), | internal identifier/comment |
| `apps/mobile/src/frontend/lib/custodial.ts:171` | * @param donatedCents What fans gave in total. | source comment (not shipped copy) |
| `apps/mobile/src/frontend/lib/custodial.ts:176` | donatedCents: number, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/custodial.ts:182` | headline: `${format(donatedCents)} given`, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/custodial.ts:186` | const kept = Math.max(0, donatedCents - familyCents); | internal identifier/comment |
| `apps/mobile/src/frontend/lib/custodial.ts:190` | ? `Fans gave ${format(donatedCents)}. All of it is recorded for your family account.` | internal identifier/comment |
| `apps/mobile/src/frontend/lib/custodial.ts:191` | : `Fans gave ${format(donatedCents)}. Historical Tapua&#x27;i gift share recorded: ${format(kept)}.`, | internal identifier/protocol reference |
| `apps/mobile/src/frontend/lib/donationHistory.ts:42` | * @purpose Donations one athlete received, newest first as the server returns them. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationHistory.ts:94` | * @purpose One fan&#x27;s own donation receipts. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:8` | * for the donation&quot;). The athlete — or their parent / guardian — picks one of these messages for each | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:37` | export type DonationToThank = { | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:46` | export function parseDonationsToThank(raw: unknown): DonationToThank[] { | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:49` | .map((row): DonationToThank &#124; null =&gt; { | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:64` | .filter((row): row is DonationToThank =&gt; row !== null); | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:104` | * @purpose Recent donations to this athlete and whether each donor has been thanked. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:107` | export async function fetchDonationsToThank(playerId: string &#124; null &#124; undefined): Promise&lt;DonationToThank[]&gt; { | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:110` | const { data, error } = await supabase.rpc(&#x27;get_donations_to_thank&#x27;, { target_player_id: playerId }); | internal identifier |
| `apps/mobile/src/frontend/lib/donationThanks.ts:112` | return parseDonationsToThank(data); | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:121` | * @sideEffects `get_my_donation_thanks` RPC. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:123` | export async function fetchMyDonationThanksResult(): Promise&lt;ThanksReceivedResult&gt; { | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:126` | const { data, error } = await supabase.rpc(&#x27;get_my_donation_thanks&#x27;, {}); | internal identifier |
| `apps/mobile/src/frontend/lib/donationThanks.ts:143` | * @purpose Send one preset thank-you to the donor of `tipId`. Once per donation. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:144` | * @sideEffects `thank_donation` RPC. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:146` | export async function thankDonation(tipId: string, key: ThanksKey): Promise&lt;ThankResult&gt; { | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:149` | const { error } = await supabase.rpc(&#x27;thank_donation&#x27;, { target_tip_id: tipId, message_key: key }); | internal identifier |
| `apps/mobile/src/frontend/lib/finance.ts:2` | * Money labelling helpers: pick the channel stored on a donation (`tips.origin`) and the short channel line shown | internal identifier/comment |
| `apps/mobile/src/frontend/lib/finance.ts:23` | * @param rallyId Rally goal the donation counts toward. Wins over a caller origin and a clip id. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/finance.ts:70` | *   the donation so the books can match a Stripe payout to its donations (BOOKS-01). Null when it is not one. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/finance.ts:133` | * @purpose Newest donation rows for the signed-in Profile ledger. An empty list covers a missing table or a guest. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/freshQuestions.ts:47` | not_okay_word: &#x27;That word is not okay here.&#x27;, money_word: &#x27;Leave out donation and money words.&#x27;, brand: &#x27;No brand or company names.&#x27;, | REVIEW |
| `apps/mobile/src/frontend/lib/giftLink.ts:3` | * the `/gift/[handle]` resolution back to a donatable athlete. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/giftLink.ts:42` | * @purpose Resolve a scanned gift handle (username or athlete id) to the athlete a family can donate to. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/giftLink.ts:44` | * @returns `found` with the roster row for the donate sheet, `not_found` for an unknown handle or a fan account, or a retryable `error`. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/giftLink.ts:55` | // A username that belongs to a fan, not an athlete, has nobody to donate to. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:88` | allowsDonations: boolean; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:103` | hasDonationsConsent: boolean; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:125` | allowsDonations: c.allows_donations === true, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:141` | hasDonationsConsent: r.has_donations_consent === true, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:207` | canAllowDonations: boolean; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:230` | canAllowDonations: r.can_allow_donations === true, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:258` | const allowed = [d.public_profile === true ? &#x27;a public profile&#x27; : null, d.donations === true ? &#x27;payouts of gifts&#x27; : null].filter(Boolean); | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:282` | allowsDonations: boolean; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:289` | allows_donations: consent.allowsDonations, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:295` | export type InvitePreview = { status: &#x27;ok&#x27;; firstName: string; username: string &#124; null; canAllowDonations: boolean } &#124; { status: &#x27;bad_code&#x27; }; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:301` | return { status: &#x27;ok&#x27;, firstName: str(raw.first_name, &#x27;This teen&#x27;), username: typeof raw.username === &#x27;string&#x27; ? raw.username : null, canAllowDonations: raw.can_allow_donations === true }; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:330` | canAllowDonations: boolean; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:347` | canAllowDonations: r.can_allow_donations === true, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:435` | teensDonationsConsent: number; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:455` | teensDonationsConsent: num(r.teens_donations_consent), | internal identifier/comment |
| `apps/mobile/src/frontend/lib/payeeVerification.ts:2` | * Payee verification on the admin desk (VERIFY-02): who would receive an athlete&#x27;s donations, which checks they have, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/payments.ts:2` | * Small donation helpers: re-exports `createPaymentIntent` and bumps an athlete&#x27;s `backer_count`. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/privacy.ts:42` | /** What stays visible to everyone even on a private account, so tags, donations and recruiting keep working. */ | internal identifier/comment |
| `apps/mobile/src/frontend/lib/rallies.ts:8` | * travel, camps, college prep — tells the story in a few lines, and the community donates toward it. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/rallies.ts:12` | * money; donations tagged with `rally_id` move the total and fill it. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/rallies.ts:23` | donationCount: number; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/rallies.ts:76` | donationCount: asCount(row.donation_count), | internal identifier/comment |
| `apps/mobile/src/frontend/lib/rallies.ts:108` | export function rallyProgress(rally: Pick&lt;Rally, &#x27;raisedCents&#x27; &#124; &#x27;targetCents&#x27; &#124; &#x27;donationCount&#x27;&gt;): { | internal identifier |
| `apps/mobile/src/frontend/lib/rallies.ts:114` | const donors = rally.donationCount; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/rallies.ts:244` | *   showing what the donations paid for. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/reels.ts:3` | * `clearReelHype`), donation totals on a clip, hiding a clip locally, reporting and Vault toggling, playback URL | internal identifier/comment |
| `apps/mobile/src/frontend/lib/reels.ts:35` | /** Null when the clip is posted before an athlete is tagged. Donate stays off until then. */ | internal identifier/comment |
| `apps/mobile/src/frontend/lib/roster.ts:15` | * @purpose Load every roster row for tagging, donations and the athlete sheet (`players` including `vault_locked`). | internal identifier/comment |
| `apps/mobile/src/frontend/lib/stripeIntent.ts:1` | /** Shared checkout transport; donation declarations distinguish gifts from purchases but never prove settlement. */ | internal identifier/comment |
| `apps/mobile/src/frontend/lib/stripeIntent.ts:27` | donation?: { giftCents: number; coverFees: boolean; platformTipPercent: number }, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/stripeIntent.ts:34` | ...(donation ? { donation } : {}), | internal identifier/comment |
| `apps/mobile/src/frontend/lib/wishlist.ts:3` | * move an item&#x27;s funded total after a donation has been recorded. | internal identifier/comment |
| `apps/mobile/src/frontend/services/SupportSignalManager.ts:38` | if (scope.category === &#x27;finance&#x27; &#124;&#124; scope.feature === &#x27;donation&#x27; &#124;&#124; scope.feature === &#x27;payouts&#x27;) return &#x27;payment_failed&#x27;; | internal identifier |
| `apps/mobile/src/frontend/services/TelemetryManager.ts:367` | * @purpose Mount-to-first-effect latency for a key surface (Home, Sport Pop Quiz, donate sheet): a blocked | internal identifier/comment |
| `apps/mobile/src/frontend/services/supportRuntime.ts:10` | if (route.startsWith(&#x27;/gift/&#x27;)) return &#x27;donation&#x27;; | internal identifier |
| `apps/mobile/src/frontend/theme/motion.ts:75` | * &#124; Brand / Donate / Aura &#124; Deep jade ink + bright jade glow &#124; Primary CTAs, Upload, the active tab on every destination &#124; | internal identifier/comment |
| `apps/mobile/src/frontend/theme/motion.ts:111` | * bright glows belong on dark media. Jade remains Donate/Upload and gold remains awards. | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:859` | donation_thanks: { | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:1452` | allows_donations: boolean | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:1468` | allows_donations: boolean | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:1484` | allows_donations?: boolean | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:2528` | donation_count: number | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:2549` | donation_count?: number | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:2570` | donation_count?: number | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:4638` | allows_donations: boolean | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:6079` | get_donations_to_thank: { | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:6135` | get_my_donation_thanks: { | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:6338` | can_allow_donations: boolean | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:7975` | donations: boolean | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:8331` | allows_donations: boolean | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:8434` | thank_donation: { | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:262` | /** Optional tip to Tapua&#x27;i charged on top of this donation (cents; not part of `amount_cents`). */ | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:266` | /** Stripe PaymentIntent id (`pi_…`) so a payout can be matched to its donations. BOOKS-01. */ | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:268` | /** Rally goal this donation counted toward (nulled by the server if the Rally wasn&#x27;t open). */ | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:275` | /** `public.rallies` — a named sports cost the community donates toward (ROADMAP M2). */ | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:285` | donation_count: number; | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:1014` | thank_donation: { | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:1018` | get_donations_to_thank: { | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:1022` | get_my_donation_thanks: { | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:16` | * Gifts draws &quot;Athletes by all-time gifts&quot; from `get_admin_reports.donation_bands` (three | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:59` | DONATION_BANDS, | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:60` | DONATION_BANDS_MISSING_NOTE, | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:61` | DONATION_BANDS_TITLE, | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:62` | donationBandsSentence, | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:177` | if (measure.section === &#x27;donation_bands&#x27; &amp;&amp; value == null &amp;&amp; stateOf(reports) === &#x27;ok&#x27;) return `${measure.note} ${DONATION_BANDS_MISSING_NOTE}`; | internal identifier |
| `packages/shared-types/admin/analytics.ts:202` | if (measure.section === &#x27;donation_bands&#x27;) { | internal identifier |
| `packages/shared-types/admin/analytics.ts:204` | const band = DONATION_BANDS.find((item) =&gt; item.key === key); | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:205` | return band &amp;&amp; reports.donationBands ? reports.donationBands[band.field] : null; | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:281` | * @purpose &quot;Athletes by all-time gifts&quot;: the three `donation_bands` measures as bars in band | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:286` | function donationBands(reports: PortalReports, revenue: PortalRevenue, error: string &#124; null): BarsSpec { | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:288` | const bands = ok ? reports.donationBands : null; | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:289` | const defs = DONATION_BANDS.map((band) =&gt; measureDef(band.key)); | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:291` | if (ok) summary = bands ? donationBandsSentence(bands) : `${DONATION_BANDS_TITLE}: not in this read. ${DONATION_BANDS_MISSING_NOTE}`; | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:293` | id: &#x27;bands-donations&#x27;, | internal identifier |
| `packages/shared-types/admin/analytics.ts:295` | title: DONATION_BANDS_TITLE, | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:297` | source: &#x27;get_admin_reports.donation_bands&#x27;, | internal identifier |
| `packages/shared-types/admin/analytics.ts:300` | accent: measureColor(&#x27;donations&#x27;), | internal identifier |
| `packages/shared-types/admin/analytics.ts:302` | points: bands ? DONATION_BANDS.map((band) =&gt; ({ label: band.label, value: readMeasure(band.key, reports, revenue) })) : null, | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:388` | accent: current.unit === &#x27;cents&#x27; ? measureColor(&#x27;donations&#x27;) : measureColor(&#x27;clips&#x27;), | internal identifier |
| `packages/shared-types/admin/analytics.ts:484` | if (board === &#x27;donations&#x27;) { | internal identifier |
| `packages/shared-types/admin/analytics.ts:488` | donationBands(reports, revenue, error), | internal identifier/comment |
| `packages/shared-types/admin/analyticsCatalog.ts:14` | &#124; &#x27;donations&#x27; | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:24` | &#124; &#x27;donation_bands&#x27; | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:195` | id: &#x27;donations&#x27;, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:249` | { key: &#x27;malo_cents_all&#x27;, board: &#x27;donations&#x27;, section: &#x27;money&#x27;, label: &#x27;Gifts, all time&#x27;, unit: &#x27;cents&#x27;, grain: &#x27;all&#x27;, note: &#x27;Sum of gift rows.&#x27; }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:250` | { key: &#x27;malo_count_all&#x27;, board: &#x27;donations&#x27;, section: &#x27;money&#x27;, label: &#x27;Gift count, all time&#x27;, unit: &#x27;count&#x27;, grain: &#x27;all&#x27;, note: &#x27;Gifts, not people who gave.&#x27; }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:251` | { key: &#x27;malo_cents_24h&#x27;, board: &#x27;donations&#x27;, section: &#x27;money&#x27;, label: &#x27;Gifts, 24 hours&#x27;, unit: &#x27;cents&#x27;, grain: &#x27;24h&#x27;, note: &#x27;Sum of gift rows in the last day.&#x27; }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:252` | { key: &#x27;malo_count_24h&#x27;, board: &#x27;donations&#x27;, section: &#x27;money&#x27;, label: &#x27;Gift count, 24 hours&#x27;, unit: &#x27;count&#x27;, grain: &#x27;24h&#x27;, note: &#x27;Gifts in the last day.&#x27; }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:253` | { key: &#x27;malo_cents_7d&#x27;, board: &#x27;donations&#x27;, section: &#x27;money&#x27;, label: &#x27;Gifts, 7 days&#x27;, unit: &#x27;cents&#x27;, grain: &#x27;7d&#x27;, note: &#x27;Sum of gift rows this week.&#x27; }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:254` | { key: &#x27;malo_count_7d&#x27;, board: &#x27;donations&#x27;, section: &#x27;money&#x27;, label: &#x27;Gift count, 7 days&#x27;, unit: &#x27;count&#x27;, grain: &#x27;7d&#x27;, note: &#x27;Gifts this week. Not people who gave.&#x27; }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:255` | { key: &#x27;malo_cents_prev_7d&#x27;, board: &#x27;donations&#x27;, section: &#x27;money&#x27;, label: &#x27;Gifts, the week before&#x27;, unit: &#x27;cents&#x27;, grain: &#x27;prior7d&#x27;, note: &#x27;The week used as the comparison.&#x27; }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:256` | { key: &#x27;avg_tip_cents_7d&#x27;, board: &#x27;donations&#x27;, section: &#x27;money&#x27;, label: &#x27;Average gift, 7 days&#x27;, unit: &#x27;cents&#x27;, grain: &#x27;7d&#x27;, note: &#x27;Mean gift this week. Not the share of people who gave.&#x27; }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:257` | { key: &#x27;queued_payouts&#x27;, board: &#x27;donations&#x27;, section: &#x27;money&#x27;, label: &#x27;Queued payouts&#x27;, unit: &#x27;count&#x27;, grain: &#x27;now&#x27;, note: &#x27;Payout rows waiting. Not money sent.&#x27; }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:258` | { key: &#x27;paid_payouts_cents&#x27;, board: &#x27;donations&#x27;, section: &#x27;money&#x27;, label: REPORT_LABELS.paid_payouts_cents, unit: &#x27;cents&#x27;, grain: &#x27;all&#x27;, note: REPORT_NOTES.paid_payouts_cents }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:259` | { key: &#x27;active_subs&#x27;, board: &#x27;donations&#x27;, section: &#x27;money&#x27;, label: &#x27;Exclusive rows marked active&#x27;, unit: &#x27;count&#x27;, grain: &#x27;now&#x27;, note: &#x27;One-time Exclusive. This is a row count, not a renewal.&#x27; }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:260` | { key: &#x27;under_50&#x27;, board: &#x27;donations&#x27;, section: &#x27;donation_bands&#x27;, label: &#x27;Athletes with all-time gifts under $50&#x27;, unit: &#x27;count&#x27;, grain: &#x27;all&#x27;, note: &#x27;Athletes whose all-time gift total is more than $0 and under $50. A count, no names.&#x27; }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:261` | { key: &#x27;50_to_250&#x27;, board: &#x27;donations&#x27;, section: &#x27;donation_bands&#x27;, label: &#x27;Athletes with all-time gifts of $50–$250&#x27;, unit: &#x27;count&#x27;, grain: &#x27;all&#x27;, note: &#x27;Athletes whose all-time gift total is $50 or more and under $250. A count, no names.&#x27; }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:262` | { key: &#x27;250_plus&#x27;, board: &#x27;donations&#x27;, section: &#x27;donation_bands&#x27;, label: &#x27;Athletes with all-time gifts of $250 and up&#x27;, unit: &#x27;count&#x27;, grain: &#x27;all&#x27;, note: &#x27;Athletes whose all-time gift total is $250 or more. A count, no names.&#x27; }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:309` | { id: &#x27;malo&#x27;, title: &#x27;Gifts&#x27;, board: &#x27;donations&#x27;, source: &#x27;get_admin_reports.series.malo&#x27;, format: &#x27;cents&#x27;, accent: measureColor(&#x27;donations&#x27;), note: &#x27;Sum of gift rows per UTC day, last 7 days.&#x27; }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:321` | { id: &#x27;malo&#x27;, title: &#x27;Gift totals by athlete (not drawn)&#x27;, board: &#x27;donations&#x27;, source: &#x27;get_admin_reports.leaders.malo&#x27;, format: &#x27;cents&#x27;, note: &#x27;All time, top 5, named. Read but not drawn: the portal names no one by gift total (owner decision 2026-10-12). The Gifts board shows athletes by all-time gifts instead.&#x27; }, | internal identifier |
| `packages/shared-types/admin/bookkeeping.ts:235` | export function journalFromDisbursement(row: DisbursementInput, held: { donations: number; vault: number } = { donations: Infinity, vault: 0 }): JournalEntry &#124; null { | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:241` | const fromDonations = Math.min(amount, Math.max(0, held.donations)); | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:242` | const fromVault = Math.min(amount - fromDonations, Math.max(0, held.vault)); | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:243` | const rest = amount - fromDonations - fromVault; | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:245` | if (fromDonations + rest &gt; 0) debits.push({ account: &#x27;2000&#x27;, debit: fromDonations + rest, credit: 0, athleteRef: ref }); | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:293` | const balance = new Map&lt;string, { donations: number; vault: number }&gt;(); | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:297` | const held = balance.get(line.athleteRef) ?? { donations: 0, vault: 0 }; | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:298` | if (line.account === &#x27;2000&#x27;) held.donations += line.credit - line.debit; | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:308` | const entry = journalFromDisbursement(row, ref ? balance.get(ref) ?? { donations: 0, vault: 0 } : undefined); | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:409` | export type AthleteHeld = { athleteRef: string; playerId: string &#124; null; donations: number; vault: number; paidOut: number; held: number }; | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:419` | const row = rows.get(line.athleteRef) ?? { athleteRef: line.athleteRef, playerId: idByRef.get(line.athleteRef) ?? null, donations: 0, vault: 0, paidOut: 0, held: 0 }; | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:420` | if (line.account === &#x27;2000&#x27;) row.donations += line.credit; | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:25` | donations7dCents: number &#124; null; | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:26` | donationsPrev7dCents: number &#124; null; | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:27` | donationCount7d: number &#124; null; | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:28` | avgDonation7dCents: number &#124; null; | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:42` | &#124; &#x27;donations&#x27; | internal identifier |
| `packages/shared-types/admin/dashboard.ts:43` | &#124; &#x27;avgDonation&#x27; | internal identifier |
| `packages/shared-types/admin/dashboard.ts:238` | const donationsDelta = priorWeek(input.donations7dCents, input.donationsPrev7dCents); | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:243` | id: &#x27;donations&#x27;, | internal identifier |
| `packages/shared-types/admin/dashboard.ts:245` | value: isMeasured(input.donations7dCents) ? formatUsd(input.donations7dCents) : &#x27;—&#x27;, | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:246` | hint: donationsDelta ? &#x27;Recorded gifts, last 7 days&#x27; : &#x27;The prior week is not in this read&#x27;, | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:248` | missing: !isMeasured(input.donations7dCents), | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:249` | delta: donationsDelta, | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:253` | id: &#x27;avgDonation&#x27;, | internal identifier |
| `packages/shared-types/admin/dashboard.ts:255` | value: isMeasured(input.avgDonation7dCents) ? formatUsd(input.avgDonation7dCents) : &#x27;—&#x27;, | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:256` | hint: !isMeasured(input.donationCount7d) | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:258` | : input.donationCount7d &gt; 0 | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:259` | ? `Across ${formatCount(input.donationCount7d)} ${input.donationCount7d === 1 ? &#x27;gift&#x27; : &#x27;gifts&#x27;}` | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:262` | missing: !isMeasured(input.avgDonation7dCents), | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:350` | const donations = priorWeek(input.donations7dCents, input.donationsPrev7dCents); | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:369` | donations | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:370` | ? weekSentence(&#x27;Gifts&#x27;, weekChange(donations.current, donations.previous), formatUsd) | internal identifier/comment |
| `packages/shared-types/admin/departments.ts:14` | donations7dCents: number &#124; null; | internal identifier/comment |
| `packages/shared-types/admin/departments.ts:67` | const { donations7dCents: donations, sessions24h: sessions, issues24h: issues, openBugs: bugs, stalls24h: stalls, reconnects24h: reconnects } = snapshot; | internal identifier/comment |
| `packages/shared-types/admin/departments.ts:75` | : !known(donations) | internal identifier/comment |
| `packages/shared-types/admin/departments.ts:77` | : donations &gt; 0 | internal identifier/comment |
| `packages/shared-types/admin/engineeringSupport.ts:12` | donation: { label: &#x27;Give&#x27;, sensitivity: &#x27;finance&#x27; }, payouts: { label: &#x27;Payouts&#x27;, sensitivity: &#x27;finance&#x27; }, | internal identifier/comment |
| `packages/shared-types/admin/eventLabels.ts:50` | rally_donate: &#x27;Give to a Rally&#x27;, | internal identifier/comment |
| `packages/shared-types/admin/financeFilters.ts:4` | * stream, account touched, channel (where a donation started), athlete, payee side, amount range and | internal identifier/comment |
| `packages/shared-types/admin/measureColors.ts:22` | &#124; &#x27;donations&#x27; | internal identifier |
| `packages/shared-types/admin/measureColors.ts:43` | donations: &#x27;jade&#x27;, | internal identifier/comment |
| `packages/shared-types/admin/operations.ts:210` | &#x27;donate-sheet&#x27;: &#x27;Give sheet&#x27;, | internal identifier |
| `packages/shared-types/admin/reports.ts:32` | /** `get_admin_reports.donation_bands`. `null` = not in this read (migration not applied) or not an object. */ | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:33` | donationBands: DonationBands &#124; null; | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:45` | export type DonationBands = { | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:151` | donationBands: null, | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:220` | export const DONATION_BANDS: readonly { key: &#x27;under_50&#x27; &#124; &#x27;50_to_250&#x27; &#124; &#x27;250_plus&#x27;; field: keyof DonationBands; label: string }[] = [ | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:227` | export const DONATION_BANDS_TITLE = &#x27;Athletes by all-time gifts&#x27;; | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:229` | /** Shown when a working read has no `donation_bands` key: the migration is not on this database yet. */ | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:230` | export const DONATION_BANDS_MISSING_NOTE = &#x27;Needs the 2026-10-12 reports update on this database.&#x27;; | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:233` | * @purpose Parse `get_admin_reports.donation_bands`. Pure. | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:238` | export function parseDonationBands(value: unknown): DonationBands &#124; null { | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:247` | const bands: DonationBands = { under50: count(bag.under_50), from50to250: count(bag[&#x27;50_to_250&#x27;]), over250: count(bag[&#x27;250_plus&#x27;]) }; | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:254` | export function donationBandRows(bands: DonationBands): { label: string; value: number &#124; null }[] { | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:255` | return DONATION_BANDS.map((band) =&gt; ({ label: band.label, value: bands[band.field] })); | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:261` | export function donationBandsSentence(bands: DonationBands): string { | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:262` | const parts = DONATION_BANDS.map((band) =&gt; { | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:267` | return `${DONATION_BANDS_TITLE}. ${parts.join(&#x27;; &#x27;)}.`; | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:392` | donation_bands: DONATION_BANDS_TITLE, | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:490` | donationBands: parseDonationBands(row.donation_bands), | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:499` | donation_bands: &#x27;All time. Counts of athletes by all-time gift total (more than $0 and under $50, $50 to under $250, $250 and up), no names. Athletes with no gifts are not counted.&#x27;, | internal identifier/comment |
| `packages/shared-types/admin/revenueModel.ts:63` | export function donationChannel(origin: string, entry: string, sourceLabel: string): string { | internal identifier/comment |
| `packages/shared-types/admin/revenueModel.ts:104` | export type DonationSplit = { | internal identifier/comment |
| `packages/shared-types/admin/revenueModel.ts:115` | export function donationSplit(streams: RevenueStream[]): DonationSplit &#124; null { | internal identifier/comment |
| `packages/shared-types/admin/supportTopology.json:325` | &quot;id&quot;: &quot;DONATION_THANKS&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:329` | &quot;apps/mobile/src/frontend/lib/donationThanks.ts&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:330` | &quot;apps/mobile/src/frontend/hooks/useDonationThanks.ts&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:2028` | &quot;name&quot;: &quot;donation_thanks&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:2030` | &quot;owner&quot;: &quot;DONATION_THANKS&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:2035` | &quot;thank_donation&quot; | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:2038` | &quot;get_donations_to_thank&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:2039` | &quot;get_my_donation_thanks&quot; | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:3473` | &quot;get_my_donation_thanks&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:3689` | &quot;get_donations_to_thank&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:3765` | &quot;thank_donation&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:3954` | &quot;get_donations_to_thank&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:6239` | &quot;apps/mobile/src/frontend/lib/donationHistory.ts&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:6250` | &quot;get_donations_to_thank&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:6252` | &quot;get_my_donation_thanks&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:6255` | &quot;thank_donation&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9887` | &quot;name&quot;: &quot;get_donations_to_thank&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9888` | &quot;owner&quot;: &quot;DONATION_THANKS&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9890` | &quot;apps/mobile/src/frontend/lib/donationThanks.ts&quot; | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9895` | &quot;donation_thanks&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9920` | &quot;apps/mobile/src/frontend/lib/donationHistory.ts&quot; | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9976` | &quot;name&quot;: &quot;get_my_donation_thanks&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9977` | &quot;owner&quot;: &quot;DONATION_THANKS&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9979` | &quot;apps/mobile/src/frontend/lib/donationThanks.ts&quot; | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9984` | &quot;donation_thanks&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:10116` | &quot;apps/mobile/src/frontend/lib/donationHistory.ts&quot; | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:14507` | &quot;sql:get_donations_to_thank&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:14509` | &quot;sql:thank_donation&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:15441` | &quot;name&quot;: &quot;thank_donation&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:15442` | &quot;owner&quot;: &quot;DONATION_THANKS&quot;, | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:15444` | &quot;apps/mobile/src/frontend/lib/donationThanks.ts&quot; | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:15448` | &quot;donation_thanks&quot; | internal source metadata |
| `packages/shared-types/notificationTemplates.ts:13` | account: &#x27;account_welcome&#x27;, donation_receipts: &#x27;donation_confirmed&#x27;, | internal identifier |
| `packages/shared-types/notificationTemplates.ts:14` | donations_received: &#x27;donation_received&#x27;, payment_updates: &#x27;payment_updated&#x27;, | internal identifier |
| `packages/shared-types/notificationTemplates.ts:19` | donation_receipts: { subject: &#x27;Your gift update&#x27;, body: &#x27;There is an update for a gift you made. Sign in to review your gift history.&#x27; }, | internal identifier/comment |
| `packages/shared-types/notificationTemplates.ts:20` | donations_received: { subject: &#x27;A gift update is ready&#x27;, body: &#x27;There is a gift update you may be permitted to review. Sign in to see the current details.&#x27; }, | internal identifier/comment |
| `packages/shared-types/notifications.ts:7` | &#x27;account&#x27;, &#x27;donation_receipts&#x27;, &#x27;donations_received&#x27;, &#x27;payment_updates&#x27;, | internal identifier |
| `packages/shared-types/notifications.ts:19` | { id: &#x27;donation_receipts&#x27;, label: &#x27;Gifts you make&#x27;, description: &#x27;Gift confirmations in your account.&#x27; }, | internal identifier |
| `packages/shared-types/notifications.ts:20` | { id: &#x27;donations_received&#x27;, label: &#x27;Gifts you receive&#x27;, description: &#x27;Updates for gifts you are permitted to review.&#x27; }, | internal identifier |
| `packages/shared-types/notifications.ts:98` | kind: &#x27;account_welcome&#x27; &#124; &#x27;donation_confirmed&#x27; &#124; &#x27;donation_received&#x27; &#124; &#x27;payment_updated&#x27; | internal identifier |
| `packages/shared-types/timedSportQuiz.ts:70` | /** QUIZ-05: the athlete card after a fun fact&#x27;s reveal (no Donate or money words on that card). */ | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:2` | export type DonationRequest = { giftCents: number; coverFees: boolean; platformTipPercent: number }; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:3` | export type DonationPaymentContext = { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:4` | id: string; donorId: string; athleteId: string; purpose: &#x27;donation&#x27;; currency: &#x27;usd&#x27;; | internal identifier |
| `supabase/functions/_shared/money/paymentContext.ts:9` | export type DonationContextAdapter = { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:10` | quote(request: DonationRequest &amp; { donorId: string; athleteId: string }): Promise&lt;DonationPaymentContext &#124; null&gt;; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:11` | persist(context: DonationPaymentContext, paymentIntentId: string): Promise&lt;{ data: unknown; error: unknown }&gt;; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:17` | export function validDonationContext(context: DonationPaymentContext &#124; null, expected: { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:19` | }): context is DonationPaymentContext { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:22` | &amp;&amp; context.purpose === &#x27;donation&#x27; &amp;&amp; context.currency === &#x27;usd&#x27; | internal identifier |
| `supabase/functions/_shared/money/paymentContext.ts:33` | export function donationContextMetadata(context: DonationPaymentContext): Record&lt;string, string&gt; { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:2` | * Money server core (SCALE-04): donation checkout. Validates the amount and the optional tip for Tapua&#x27;i, runs the | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:12` | import { donationContextMetadata, validDonationContext, type DonationContextAdapter, type DonationPaymentContext, type DonationRequest } from &#x27;./paymentContext.ts&#x27;; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:26` | /** `players.id` this charge is for (donation / vault unlock / exclusive subscribe). Omitted for player-agnostic | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:32` | donation?: DonationRequest; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:63` | donationContext?: DonationContextAdapter; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:78` | if (platformTipCents &gt; 0 &amp;&amp; !body.donation) return errorResult(&quot;Gift allocation required for an optional tip to Tapua&#x27;i.&quot;, 400); | internal identifier/protocol reference |
| `supabase/functions/_shared/money/paymentIntent.ts:80` | let context: DonationPaymentContext &#124; null = null; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:81` | if (body.donation !== undefined) { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:82` | const request = body.donation; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:98` | // Fail closed only on an explicit `true` (LEGAL_BRIEFING §8 item 5): this is the one point where a donation can | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:105` | if (body.donation &amp;&amp; input.donationContext) { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:108` | const request = body.donation; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:109` | context = await input.donationContext.quote({ ...request, donorId: input.userId, athleteId: playerId }); | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:110` | if (!validDonationContext(context, { donorId: input.userId, athleteId: playerId, giftCents: request.giftCents, | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:113` | } else if (body.donation &amp;&amp; (body.donation.coverFees &#124;&#124; platformTipCents &gt; 0)) { | internal identifier/protocol reference |
| `supabase/functions/_shared/money/paymentIntent.ts:125` | ...(body.donation ? { tapuai_purpose: &#x27;donation&#x27;, tapuai_notification_authority: &#x27;false&#x27; } : {}), | internal identifier |
| `supabase/functions/_shared/money/paymentIntent.ts:126` | ...(context ? donationContextMetadata(context) : {}), | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:130` | if (context &amp;&amp; input.donationContext) { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:133` | const result = await input.donationContext.persist(context, paymentIntent.id); | internal identifier/comment |
| `supabase/functions/_shared/money/serverDonationContext.ts:2` | import type { DonationContextAdapter, DonationPaymentContext } from &#x27;./paymentContext.ts&#x27;; | internal identifier/protocol reference |
| `supabase/functions/_shared/money/serverDonationContext.ts:7` | export function serverDonationContextAdapter(rpc?: ServiceRpc): DonationContextAdapter { | internal identifier/protocol reference |
| `supabase/functions/_shared/money/serverDonationContext.ts:16` | return result.data as DonationPaymentContext; | internal identifier/protocol reference |
| `supabase/functions/create-payment-intent/index.ts:8` | import { serverDonationContextAdapter } from &#x27;../_shared/money/serverDonationContext.ts&#x27;; | internal identifier/protocol reference |
| `supabase/functions/create-payment-intent/index.ts:105` | donationContext: serverDonationContextAdapter(serviceKey | internal identifier/protocol reference |
| `supabase/functions/stripe-webhook/index.ts:2` | * NOTIFY-01: verify raw Stripe events and durably observe prepared donation context in one service-only RPC. | internal identifier/comment |
| `supabase/functions/stripe-webhook/index.ts:3` | * Donation credit/Aura remains client-owned. Rich metadata alone never writes business rows, claims financial | internal identifier/comment |
