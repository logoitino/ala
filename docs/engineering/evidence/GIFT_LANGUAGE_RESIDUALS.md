<!-- Complete bounded raw donat* grep; no absence claim is inferred from visible strings alone. -->
# Remaining donat* source matches — copy phase

595 matching source lines. Scope: tracked mobile/admin/shared JS/TS/JSON and Edge-function TS; tests excluded. Canonical SQL is unchanged and retains internal identifiers, historical policies and server messages requiring the separate money implementation.

| File / line | Source text | Classification |
| --- | --- | --- |
| `apps/admin-portal/app/(protected)/manage/page.tsx:41` | const donations7d = key(reports.money, 'malo_cents_7d'); | internal identifier/comment |
| `apps/admin-portal/app/(protected)/manage/page.tsx:57` | donations7dCents: donations7d, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/manage/page.tsx:110` | &lt;StatTile label="Gifts · 7d" value={usd(donations7d)} missing={donations7d == null} hint="Recorded gifts, last 7 days" goodDirection="none" /&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:16` | import { RecentDonationsTable, RecentLedgerTable } from '@/components/revenue/LedgerTables'; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:19` | donationSplit, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:45` | const DONATIONS = measureColor('donations'); | internal identifier |
| `apps/admin-portal/app/(protected)/money/page.tsx:80` | const donations7d = m('malo_cents_7d'); | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:81` | const donationsPrev7d = m('malo_cents_prev_7d'); | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:99` | const split = revenueOk ? donationSplit(revenue.streams) : null; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:106` | const ledgerDonations = split?.gross ?? null; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:107` | const crossGap = tipsAll != null && ledgerDonations != null ? ledgerDonations - tipsAll : null; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:213` | Cross-check: the ledger records {usd(ledgerDonations ?? 0)} in gifts and the gifts table holds {usd(tipsAll ?? 0)}.{' '} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:251` | accent={DONATIONS} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:263` | value={donations7d != null ? kpiUsd(donations7d) : ''} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:264` | missing={donations7d == null} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:265` | delta={donations7d != null && donationsPrev7d != null ? { current: donations7d, previous: donationsPrev7d } : null} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:267` | spark={sparkPoints.length &gt; 0 ? { points: sparkPoints, format: usd, accent: DONATIONS } : undefined} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:313` | accent={DONATIONS} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:321` | current={{ label: 'Last 7 days', value: donations7d }} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:322` | previous={{ label: 'Prior 7 days', value: donationsPrev7d }} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:336` | accent={DONATIONS} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:346` | accent={DONATIONS} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/money/page.tsx:360` | &lt;RecentDonationsTable rows={malo.recent} error={malo.error} /&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/operations/page.tsx:45` | donations7dCents: null, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:92` | donations7dCents: key(reports.money, 'malo_cents_7d'), | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:93` | donationsPrev7dCents: key(reports.money, 'malo_cents_prev_7d'), | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:94` | donationCount7d: key(reports.money, 'malo_count_7d'), | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:95` | avgDonation7dCents: key(reports.money, 'avg_tip_cents_7d'), | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:115` | const DONATIONS = measureColor('donations'); | internal identifier |
| `apps/admin-portal/app/(protected)/page.tsx:121` | const donationCard = cards.find((card) =&gt; card.id === 'donations')!; | internal identifier |
| `apps/admin-portal/app/(protected)/page.tsx:125` | const overviewCards = cards.filter((card) =&gt; ['avgDonation', 'clips', 'opens'].includes(card.id)); | internal identifier |
| `apps/admin-portal/app/(protected)/page.tsx:132` | donations7dCents: input.donations7dCents, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:151` | &lt;MetricValue card={donationCard} /&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:154` | {isMeasured(input.donationCount7d) ? `${formatCount(input.donationCount7d)} ${input.donationCount7d === 1 ? 'gift' : 'gifts'} recorded` : 'Gift count not in this read'} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:155` | &lt;span className="mt-1 block text-xs font-normal text-[var(--jade)] sm:mt-0 sm:inline"&gt; · &lt;WeeklyChange card={donationCard} /&gt;&lt;/span&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:204` | accent={DONATIONS} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:243` | &lt;p className="break-words"&gt;{isMeasured(input.donations7dCents) && isMeasured(input.clips7d) ? `${formatUsd(input.donations7dCents)} in recorded gifts and ${formatCount(input.clips7d)} ${input.clips7d === 1 ? 'clip' : 'clips'} uploaded over the last 7 days.` : 'One or more weekly totals were not in this read.'}&lt;/p&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:271` | &lt;p className="mt-3 text-sm"&gt;Prior 7 days — gifts: {isMeasured(input.donationsPrev7dCents) ? formatUsd(input.donationsPrev7dCents) : 'Not in this read'}; clips: {isMeasured(input.clipsPrev7d) ? formatCount(input.clipsPrev7d) : 'Not in this read'}.&lt;/p&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/page.tsx:306` | { label: 'Gifts', points: malo ?? [], format: formatUsd, accent: DONATIONS }, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:8` | * `get_admin_reports` section as returned. When `donation_bands` is missing (migration not applied) | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:23` | DONATION_BANDS_MISSING_NOTE, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:24` | DONATION_BANDS_TITLE, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:26` | donationBandRows, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:27` | donationBandsSentence, | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:138` | const donations7d = n(money, 'malo_cents_7d'); | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:139` | const donationsPrev = n(money, 'malo_cents_prev_7d'); | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:155` | paceRow('Gifts', n(money, 'malo_cents_24h'), donations7d, formatUsd, measureColor('donations'), 'malo_cents_24h · malo_cents_7d'), | internal identifier |
| `apps/admin-portal/app/(protected)/reports/page.tsx:177` | const bands = read ? reports.donationBands : null; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:178` | const bandRows: ChartPoint[] \| null = bands ? donationBandRows(bands) : null; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:179` | const bandsSummary = !read ? undefined : bands ? donationBandsSentence(bands) : `${DONATION_BANDS_TITLE}: not in this read. ${DONATION_BANDS_MISSING_NOTE}`; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:225` | accent={measureColor('donations')} | internal identifier |
| `apps/admin-portal/app/(protected)/reports/page.tsx:279` | current={{ label: 'Last 7 days', value: donations7d }} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:280` | previous={{ label: 'Prior 7 days', value: donationsPrev }} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:282` | accent={measureColor('donations')} | internal identifier |
| `apps/admin-portal/app/(protected)/reports/page.tsx:374` | title={DONATION_BANDS_TITLE} | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:380` | accent={measureColor('donations')} | internal identifier |
| `apps/admin-portal/app/(protected)/reports/page.tsx:383` | source="get_admin_reports.donation_bands · under_50 · 50_to_250 · 250_plus" | internal identifier |
| `apps/admin-portal/app/(protected)/reports/page.tsx:545` | &lt;Panel title={DONATION_BANDS_TITLE} kicker="Gift bands" level={3}&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:547` | &lt;p className="text-sm text-[var(--text-muted)]"&gt;Not in this read. {DONATION_BANDS_MISSING_NOTE}&lt;/p&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:549` | &lt;CountList rows={bandRows ?? donationBandRows({ under50: null, from50to250: null, over250: null })} /&gt; | internal identifier/comment |
| `apps/admin-portal/app/(protected)/reports/page.tsx:551` | &lt;p className="mt-3 text-xs leading-4 text-[var(--text-muted)]"&gt;{REPORT_NOTES.donation_bands}&lt;/p&gt; | internal identifier/comment |
| `apps/admin-portal/components/AnalyticsBoard.tsx:13` | *   sentence (the donation bands and their missing note), passed through to `HBarList`. | internal identifier/comment |
| `apps/admin-portal/components/charts/CompareBars.tsx:21` | /** Noun for the default sentence ("Clips uploaded", "Donations"). Defaults to `title`. */ | internal identifier/comment |
| `apps/admin-portal/components/charts/HBarList.tsx:19` | /** Shown when `rows` is an empty list, e.g. "No donations in the last 7 days." */ | internal identifier/comment |
| `apps/admin-portal/components/revenue/LedgerTables.tsx:19` | import { donationChannel, ledgerDetail, streamName, utcStamp } from './revenueModel'; | internal identifier/comment |
| `apps/admin-portal/components/revenue/LedgerTables.tsx:167` | export function RecentDonationsTable({ rows, error }: { rows: MaloTxn[]; error: string \| null }) { | internal identifier/comment |
| `apps/admin-portal/components/revenue/LedgerTables.tsx:178` | { label: 'Started', value: donationChannel(row.origin, row.entry, row.source_label) }, | internal identifier/comment |
| `apps/admin-portal/components/revenue/LedgerTables.tsx:193` | &lt;td className="px-3 py-2 text-[var(--ink-soft)]"&gt;{donationChannel(row.origin, row.entry, row.source_label)}&lt;/td&gt; | internal identifier/comment |
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
| `apps/mobile/src/backend/api/createPaymentIntent.ts:2` | * Metro / Node adapter for donation checkout (`POST /api/create-payment-intent`). The validation, freeze check and | internal identifier/comment |
| `apps/mobile/src/backend/api/createPaymentIntent.ts:23` | * @purpose Mint a Stripe PaymentIntent (test mode) for donation / exclusive / Drip / booster checkout. | internal identifier/comment |
| `apps/mobile/src/backend/api/createPaymentIntent.ts:28` | *   compliance — LEGAL_BRIEFING.md §8 item 5: the only point where a donation can be rejected before the card is | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Books/booksSections.ts:59` | const athletes = athleteHeld(entries, period.to).filter((row) =&gt; row.held !== 0 \|\| row.donations \|\| row.vault); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Books/booksSections.ts:119` | { title: 'Held per athlete', table: { columns: ['Athlete', 'Gifts', 'Vault', 'Paid out', 'Held'], rows: athletes.map((row) =&gt; [nameByRef[row.athleteRef] ?? row.athleteRef, booksUsd(row.donations), booksUsd(row.vault), booksUsd(row.paidOut), booksUsd(row.held)]) } }, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/MinorAccountsPanel.tsx:63` | { label: 'Consent: payouts', value: report.teensDonationsConsent }, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/MinorAccountsPanel.tsx:128` | {`Consent ${consent.formVersion} signed ${day(consent.signedAt)} by ${consent.signerName} (${consent.relationship === 'parent' ? 'parent' : 'legal guardian'}): public profile ${consent.allowsPublicProfile ? 'yes' : 'no'}, payouts ${consent.allowsDonations ? 'yes' : 'no'}${consent.revokedAt ? ` · ended ${day(consent.revokedAt)} (${consent.revokeReason ?? ''})` : ''}`} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Notifications/NotificationAdminPanel.tsx:3` | * Source authority is server-owned; staff cannot enable an unimplemented donation source or send mail here. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/PayeeVerificationPanel.tsx:3` | * athletes whose donations would go to them (as the athlete or the guardian on record), what each payee still needs, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/AdminReportHome.tsx:22` | /** @purpose Home's h1, donation amount/count/change, three overview measures and primary Trends link. */ | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/AdminReportHome.tsx:25` | const input = homeInput(data); const cards = homeKpis(input, formatUsd); const donation = cards.find(card =&gt; card.id === 'donations')!; | internal identifier |
| `apps/mobile/src/frontend/components/Admin/Reports/AdminReportHome.tsx:31` | &lt;Text style={[s.heroValue, { fontSize: width &lt; 640 ? 48 : 60, minWidth: 0, maxWidth: '100%', flexShrink: 1 }]} numberOfLines={Platform.OS === 'web' ? undefined : 1} adjustsFontSizeToFit={Platform.OS !== 'web'} minimumFontScale={0.6} accessibilityLabel={`Gifts this week: ${donation.missing ? 'Not in this read' : donation.value}`}&gt;{donation.value}&lt;/Text&gt; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/AdminReportHome.tsx:32` | &lt;View style={[s.row, { gap: 6 }]}&gt;&lt;Text style={s.strong}&gt;{isMeasured(input.donationCount7d) ? `${formatCount(input.donationCount7d)} ${input.donationCount7d === 1 ? 'gift' : 'gifts'} recorded` : 'Gift count not in this read'}&lt;/Text&gt; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/AdminReportHome.tsx:33` | &lt;Text style={[s.small, { color: c.jade }]}&gt;{weeklyChange(donation)}&lt;/Text&gt;&lt;/View&gt; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/AdminReportHome.tsx:36` | {cards.filter(card =&gt; ['avgDonation', 'clips', 'opens'].includes(card.id)).map(card =&gt; &lt;View key={card.id} style={{ flexGrow: 1, flexBasis: '28%', minWidth: 144, borderLeftWidth: 1, borderLeftColor: c.border, paddingLeft: 16, gap: 8 }}&gt; | internal identifier |
| `apps/mobile/src/frontend/components/Admin/Reports/AdminReportHome.tsx:65` | &lt;Text style={s.kicker}&gt;At a glance&lt;/Text&gt;&lt;Text style={s.sentence}&gt;{isMeasured(input.donations7dCents) && isMeasured(input.clips7d) ? `${formatUsd(input.donations7dCents)} in recorded gifts and ${formatCount(input.clips7d)} ${input.clips7d === 1 ? 'clip' : 'clips'} uploaded over the last 7 days.` : 'One or more weekly totals were not in this read.'}&lt;/Text&gt; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:7` | ledgerDetail, originName, entryName, donationChannel, utcStamp, fillDays, shortDay, donationSplit, kpiUsd, payeeName } from '@tapuai/shared-types/admin'; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:53` | return { donations7dCents: n('money', 'malo_cents_7d'), donationsPrev7dCents: n('money', 'malo_cents_prev_7d'), donationCount7d: n('money', 'malo_count_7d'), avgDonation7dCents: n('money', 'avg_tip_cents_7d'), | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:59` | return { reportsError: d.reports.error, revenueError: d.revenue.error, donations7dCents: n('money', 'malo_cents_7d'), sessions24h: n('usage', 'sessions_24h'), issues24h: n('usage', 'issues_24h'), | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:78` | { id: 'donations', title: 'Gifts', charts: [trend('Gifts', list(series.malo), 'cents', 'jade', 'get_admin_reports.series.malo', error, 'area')] }, | internal identifier |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:80` | { id: 'rest', title: 'The rest of the picture', kpis: cards.filter(c =&gt; !['donations', 'avgDonation', 'clips', 'opens'].includes(c.id)), tables: [{ title: 'Data sources', table: { columns: ['Measure', 'Meaning'], rows: cards.map(c =&gt; [c.label, c.hint]) }, source: 'get_admin_reports; get_company_revenue_summary' }] }, | internal identifier |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:113` | const donations = valid ? donationSplit(r.streams) : null; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:116` | const policySplit = split('Gift split, from the ledger', [{ key: 'family', label: "Athletes' family accounts", value: donations?.family ?? null, color: 'jade' }, { key: 'company', label: "Tapua'i share (covers card processing)", value: donations?.platform ?? null, color: 'gold' }, ...(donations && donations.unsplit &gt; 0 ? [{ key: 'unsplit', label: 'Recorded but not split', value: donations.unsplit, color: 'muted' as const }] : [])], 'get_company_revenue_summary.streams[malo]'); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:117` | policySplit.caption = donations?.policy ? `Stated policy for this stream: ${donations.policy}` : 'Gifts stream'; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:120` | const cross = donations && n('money', 'malo_cents_all') != null ? donations.gross - n('money', 'malo_cents_all')! : null; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:122` | const donationKpi = (label: string, valueKey: string, countKey: string): ReportKpi =&gt; { | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:132` | charts: [ledgerRing, policySplit], sentences: cross == null ? [] : [`Cross-check: the ledger records ${formatUsd(donations!.gross)} in gifts and the tips table holds ${formatUsd(n('money', 'malo_cents_all')!)}. ${cross === 0 ? 'They match.' : `They differ by ${formatUsd(Math.abs(cross))}. Check company_revenue_logs.`}`] }, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:134` | { id: 'donations', title: 'Gifts', kpis: [donationKpi('Gifts, last 7 days', 'malo_cents_7d', 'malo_count_7d'), donationKpi('Gifts, last 24 hours', 'malo_cents_24h', 'malo_count_24h'), { ...kpi('Average gift, 7 days', 'money', 'avg_tip_cents_7d', 'cents'), hint: 'Mean amount per gift' }, donationKpi('Gifts, all time', 'malo_cents_all', 'malo_count_all')], | internal identifier |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:139` | { id: 'latest', title: 'Latest gifts', sentences: breakdownOk && !d.breakdown.recent.length ? ['No gifts yet.'] : [], tables: [{ title: 'Latest gifts', source: d.breakdown.source === 'fallback' ? 'tips' : 'get_admin_malo_breakdown.recent', initiallyOpen: true, table: { columns: ['When (UTC)', 'Athlete', 'Gift sender', 'Where it started', 'Linked to', 'Amount'], rows: breakdownOk ? d.breakdown.recent.slice(0, 40).map(row =&gt; [utcStamp(row.created_at) ?? 'Not in this read', row.athlete_name, row.fan_name, donationChannel(row.origin, row.entry, row.source_label), row.wishlist_item_id ? `Gear goal ${row.wishlist_item_id.slice(0, 8)}` : row.reel_id ? `Clip ${row.reel_id.slice(0, 8)}` : 'Not linked to a clip or gear goal', formatUsd(row.amount_cents)]) : [] } }] }, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/Reports/reportPages.ts:148` | { id: 'billing', title: 'Billing', kpis: [{ label: 'Gifts · 7d', value: chartValue(totals.donations7dCents, 'cents'), missing: totals.donations7dCents == null }, { label: 'Gross volume', value: chartValue(totals.grossCents, 'cents'), missing: totals.grossCents == null }, { label: "Tapua'i share", value: chartValue(totals.companyNetCents, 'cents'), missing: totals.companyNetCents == null }], sentences: ['Gifts and revenue are recorded amounts. Vault remains recorded for the athlete; family routing is pending counsel and implementation.'], links: [{ label: 'Open Revenue', href: '/admin/revenue' }] }, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Admin/SportQuiz/SportQuizLifeQuestion.tsx:28` | &lt;Text&gt;Every Life question is for everyone 13+. Keep it a simple fact anyone can check. At approval the server refuses: "you should / must / need to" advice, brand names, Tapua'i money words (Tapua'i, donation, donor, Rally, family account, payout, Aura, gift and the thank-you word), NIL or eligibility, tax, loans, credit scores or APR, any money amount, price, percentage, rate or "k / grand / million" figure, and years. Scam Defense explanations end "Tell a trusted adult and use Report." Prompts stay within 120 characters and explanations within 200.&lt;/Text&gt; | visible internal vocabulary |
| `apps/mobile/src/frontend/components/Admin/SportQuiz/triviaDesk.ts:31` | tapuai_money_word: 'No Tapua’i money words (donation, donor, Rally, family account, payout, Aura, gift, the thank-you word).', | visible internal vocabulary |
| `apps/mobile/src/frontend/components/Admin/Support/SupportFlowTab.tsx:23` | &lt;AdminField label="Find a data source or team" value={query} onChangeText={setQuery} placeholder="For example: donation, support, ledger, security" /&gt; | visible internal vocabulary |
| `apps/mobile/src/frontend/components/Admin/Support/SupportIssuesTab.tsx:9` | const featureSources: Record&lt;string, string&gt; = { highlights: 'reels', activity: 'tips', local: 'games', spotlight: 'spotlight_awards', drip: 'shop_products', profile: 'profiles', auth: 'profiles', donation: 'tips', payouts: 'disbursements', operator: 'game_events', upload: 'reels', admin: 'app_runtime_config', support: 'support_signals', app: 'support_signals' }; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianConsentForm.tsx:20` | canAllowDonations: boolean; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianConsentForm.tsx:28` | export function GuardianConsentForm({ teenFirstName, canAllowDonations, initial, busy, onSign, onCancel }: Props) { | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianConsentForm.tsx:30` | const [donations, setDonations] = useState(canAllowDonations && (initial?.allowsDonations ?? false)); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianConsentForm.tsx:51` | {canAllowDonations ? ( | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianConsentForm.tsx:52` | &lt;LegalAckToggle checked={donations} onCheckedChange={setDonations} disabled={busy} label={`Gifts to ${teenFirstName} may be paid out to the family account on record`} /&gt; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianConsentForm.tsx:87` | onPress={() =&gt; onSign({ signerName: name.trim(), relationship, allowsDonations: donations, allowsPublicProfile: publicProfile })} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianSupervisionPanel.tsx:55` | const allowed = [row.myConsent.allowsPublicProfile ? 'public profile' : null, row.myConsent.allowsDonations ? 'payouts' : null].filter(Boolean); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianSupervisionPanel.tsx:197` | canAllowDonations={row.canAllowDonations} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianSupervisionPanel.tsx:215` | const [preview, setPreview] = useState&lt;{ firstName: string; username: string \| null; canAllowDonations: boolean } \| null&gt;(null); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Custodial/GuardianSupervisionPanel.tsx:297` | canAllowDonations={preview.canAllowDonations} | internal identifier/comment |
| `apps/mobile/src/frontend/components/FanZone/FanZoneStory.tsx:10` | /** @sideEffects Explicit public free-story player and navigation into the existing athlete profile/Donate flow. */ | internal identifier/comment |
| `apps/mobile/src/frontend/components/FeeCheckbox.tsx:2` | * Donate sheet checkbox that lets a donor cover the optional processing fee. Amount comes from | internal identifier/comment |
| `apps/mobile/src/frontend/components/Filmers/FilmerCard.tsx:2` | * Badge tiers and earned Aura stay separate from athlete donations and school verification. */ | internal identifier/comment |
| `apps/mobile/src/frontend/components/Onboarding/WelcomeOverlay.tsx:14` | import { DONATION_MISSION, TAGLINE_HEADLINE, TAGLINE_LINE } from '@/data/malo'; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Onboarding/WelcomeOverlay.tsx:20` | * @purpose One-time first-open welcome for guests — brand + support story and the Donate. Elevate. Celebrate. message, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Onboarding/WelcomeOverlay.tsx:69` | {DONATION_MISSION} Watch their highlights, cheer your school, and give in a few taps — so our kids feel | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:141` | * @purpose Local play-by-play card. Opening the card celebrates the play with Seki, Aura and Flex. Donate is a button that opens the donation only after that tap. | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:143` | * @param onBacked Fires after a donation on this athlete. | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:146` | * @sideEffects One `bumpPlayerHype` per kind the first time it is selected. Later taps only select and clear. Donation uses `TipCheckout` after Donate. | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:152` | const [donateOpen, setDonateOpen] = useState(false); | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:168` | if (!next) setDonateOpen(false); | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:261` | {player && !donateOpen ? ( | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:266` | onPress={() =&gt; setDonateOpen(true)} | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:267` | style={styles.donate} | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:269` | &lt;Text style={styles.donateLabel}&gt;{maloAthleteCta(player.name)}&lt;/Text&gt; | internal identifier/comment |
| `apps/mobile/src/frontend/components/PlayCard.tsx:272` | {player && donateOpen ? ( | internal identifier/comment |
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
| `apps/mobile/src/frontend/components/Profile/AthleteProfileView.tsx:236` | const showDonateTagline = showFanSupport && athleteIdentity && Boolean(onDropMalo && live.buttons.malo); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/AthleteProfileView.tsx:471` | {/* Brand line (BRAND-01) only where this athlete can actually be donated to; plain text, not a heading. */} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/AthleteProfileView.tsx:472` | {showDonateTagline ? &lt;&gt;&lt;Text style={styles.donateTagline}&gt;{TAGLINE_HEADLINE}&lt;/Text&gt;&lt;Text style={styles.donateTagline}&gt;Gifts to individual athletes are personal gifts and are not tax-deductible.&lt;/Text&gt;&lt;/&gt; : null} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/AthleteProfileView.tsx:486` | {/* Look desk "Actions on top" (profile.actionsOnTop): parks Donate / Share under the section tabs. */} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/AthleteProfileView.tsx:703` | donateTagline: { fontSize: 12, lineHeight: 17, fontWeight: '700', color: colors.textMuted }, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/AuraTradingCard.tsx:190` | * @sideEffects Reanimated `withSpring` `rotateY` 0↔180 (`SPRING_FLIP`, `perspective: 1000`); `Haptics.impactAsync(Medium)` exactly when the rotation crosses 90°; back-face Aura points / donation totals fade in with `withDelay`; Skia canvas when the glow is on. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/LockerRoomWishlist.tsx:1` | /** Profile sports-goal rack keeps each gear target, donation progress and Share controls together. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/LockerRoomWishlist.tsx:2` | * Existing donation review, fulfilled gear and private upload rules remain in their respective services. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/LockerRoomWishlist.tsx:3` | * @sideEffects Wishlist reads, donation checkout, image linking and haptics through existing helpers. */ | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/PrivacySettingsSheet.tsx:346` | ? `Consent: ${[guardian.consent.allowsPublicProfile ? 'public profile' : null, guardian.consent.allowsDonations ? 'payouts' : null].filter(Boolean).join(', ') \|\| 'nothing extra'}` | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/ReceivedMaloPanel.tsx:11` | import { useDonationsToThank } from '@/hooks/useDonationThanks'; | internal identifier |
| `apps/mobile/src/frontend/components/Profile/ReceivedMaloPanel.tsx:13` | import { thanksText, type ThanksKey } from '@/lib/donationThanks'; | internal identifier |
| `apps/mobile/src/frontend/components/Profile/ReceivedMaloPanel.tsx:18` | * @purpose Private list (athlete's own profile, and Parent HQ) of each donation received and where it | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/ReceivedMaloPanel.tsx:22` | * @sideEffects `useReceivedMalo` → `get_received_malo`; `useDonationsToThank` → `get_donations_to_thank`, | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/ReceivedMaloPanel.tsx:23` | *   `thank_donation`. A failed or missing ledger shows $0 and "No donations yet", not a connection error. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/ReceivedMaloPanel.tsx:27` | const { rows: thanksRows, thank } = useDonationsToThank(playerId); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Profile/ReceivedMaloPanel.tsx:32` | // The headline is what reaches the family account, not the donated total (which is more). | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:21` | import { thanksText, type ThanksKey } from '@/lib/donationThanks'; | internal identifier |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:56` | *   Donate and Share for fans; Start / Approve / Close / Say thanks for the family. A full-screen | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:57` | *   moment when a donation fills it. Hides itself for fans when there is no Rally (or before the SQL is applied). | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:58` | * @sideEffects `useRally`; Rally RPCs; donate sheet with `rally_id`. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:74` | const [donateOpen, setDonateOpen] = useState(false); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:153` | const canDonate = rally.status === 'live' && live.buttons.malo; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:191` | {canDonate && !manage ? ( | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:200` | telemetry.trackFeature('rally_donate', 'profile'); | internal identifier |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:201` | setDonateOpen(true); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:283` | player={donateOpen ? player : null} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyCard.tsx:288` | onClose={() =&gt; setDonateOpen(false)} | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyMeter.tsx:21` | * @sideEffects `useRally` → `get_active_rally`. Donate sheet with `origin=rally`. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyMeter.tsx:33` | const [donateOpen, setDonateOpen] = useState(false); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Rally/RallyMeter.tsx:68` | telemetry.trackFeature('rally_donate', 'highlight'); | internal identifier |
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
| `apps/mobile/src/frontend/components/Reels/ReelOwnerPeek.tsx:222` | const donatePrimary = Boolean(onTip) && maloReady; | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/ReelOwnerPeek.tsx:223` | const profilePrimary = !donatePrimary && Boolean(onOpenProfile); | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/ReelOwnerPeek.tsx:776` | // Pinned footer: Donate / Join Crew and Open full profile. Opaque, with a hairline so scrolled content reads as | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/UploadChoiceSheet.tsx:29` | * @param onHighlight Athlete clip (game, workout or service) → Highlights, where fans can donate. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Reels/UploadVideoModal.tsx:5` | * line, then upload. A video can publish with Tag later; Donate stays off until an athlete is tagged. Photo stories | internal identifier/comment |
| `apps/mobile/src/frontend/components/SportQuiz/FunFactMoment.tsx:5` | *   (`getPublicProfiles`, the same helper the profile sheets use), with initials when there is no photo. No Donate, | internal identifier/comment |
| `apps/mobile/src/frontend/components/SportQuiz/LifePlaybookHome.tsx:6` | * credit topics). This screen has no donation, checkout or money controls. | internal identifier/comment |
| `apps/mobile/src/frontend/components/Thanks/ThanksPicker.tsx:5` | import { THANKS_MESSAGES, type ThanksKey } from '@/lib/donationThanks'; | internal identifier |
| `apps/mobile/src/frontend/components/TipButton.tsx:2` | * The animated amount button on the donate sheet (preset amounts, custom, selected state). | internal identifier/comment |
| `apps/mobile/src/frontend/components/TipButton.tsx:3` | * (Code name `Tip` = donation; on-screen words follow docs/product/VOICE.md.) | internal identifier/comment |
| `apps/mobile/src/frontend/components/TipButton.tsx:41` | const title = label ?? `Donate $${amount}`; | checkout held |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:2` | * Short donation pages shared by the fan popup and inline athlete cards. | internal identifier/comment |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:15` | import { PLATFORM_TIP_HINT, PLATFORM_TIP_PERCENTS, PLATFORM_TIP_TITLE, TAGLINE_HEADLINE, donationBreakdownLine, donationSplitLine, donationWhereItGoes, platformTipCentsFor, platformTipChipLabel } from '@/data/malo'; | internal identifier/comment |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:41` | * @purpose Amount → optional extras → review inside one donation surface, with navigation outside the scroll. | internal identifier/comment |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:42` | * @sideEffects Opens Stripe only on final Donate; a synchronous ref prevents duplicate payments and early dismissal. | internal identifier/comment |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:45` | useScreenMountTime('donate-sheet'); | internal identifier |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:75` | const breakdown = amount == null ? '' : donationBreakdownLine({ athleteName: playerName, donationDollars: amount, feeDollars: fee, tipPercent }); | internal identifier/comment |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:113` | {!compact && !hideHeader ? &lt;Text style={styles.title}&gt;Donate to {playerName}&lt;/Text&gt; : null} | checkout held |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:116` | {complete ? &lt;View style={styles.hero}&gt;&lt;Text style={styles.kicker}&gt;MĀLO! ✨&lt;/Text&gt;&lt;Text style={styles.title}&gt;Thanks for showing up&lt;/Text&gt;&lt;Text style={styles.copy}&gt;Your donation to {playerName} is on its way.&lt;/Text&gt;&lt;/View&gt; : null} | checkout held |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:117` | {paid && !complete ? &lt;View style={styles.hero}&gt;&lt;Text style={styles.title}&gt;Payment received&lt;/Text&gt;&lt;Text style={styles.copy}&gt;{locked ? 'Finishing your donation…' : 'Your payment went through. Contact support to check your donation before paying again.'}&lt;/Text&gt;&lt;/View&gt; : null} | checkout held |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:121` | &lt;View style={styles.hero}&gt;&lt;Text style={styles.kicker}&gt;COMMUNITY LOVE 💚&lt;/Text&gt;&lt;Text style={styles.pageTitle}&gt;Choose your donation&lt;/Text&gt;&lt;Text style={styles.split}&gt;{donationSplitLine(playerName)}&lt;/Text&gt;&lt;Text style={styles.copy}&gt;For {playerName}'s sports costs — fees, gear and travel.&lt;/Text&gt;&lt;/View&gt; | checkout held |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:123` | {customOpen ? &lt;View style={styles.customBlock}&gt;&lt;TextInput accessibilityLabel="Custom donation amount" editable={!locked} keyboardType="decimal-pad" onChangeText={setCustomValue} placeholder="Minimum $1.00" placeholderTextColor={colors.textMuted} returnKeyType="done" style={styles.input} value={customValue} /&gt;&lt;Text style={styles.copy}&gt;{customAmount == null ? 'Enter $1 or more, with up to two decimal places.' : `+${auraPointsForTip(customAmount)} Aura Points ⚡`}&lt;/Text&gt;&lt;/View&gt; : null} | checkout held |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:128` | &lt;View style={styles.hero}&gt;&lt;Text style={styles.kicker}&gt;YOUR CHOICE ✨&lt;/Text&gt;&lt;Text style={styles.pageTitle}&gt;Optional extras&lt;/Text&gt;&lt;Text style={styles.copy}&gt;Your donation is ${amount?.toFixed(2)}. You can keep both extras off and continue.&lt;/Text&gt;&lt;/View&gt; | checkout held |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:134` | &lt;View style={styles.hero}&gt;&lt;Text style={styles.kicker}&gt;READY TO REVIEW 💚&lt;/Text&gt;&lt;Text style={styles.pageTitle}&gt;Your donation to {playerName}&lt;/Text&gt;&lt;Text style={styles.total}&gt;${total.toFixed(2)}&lt;/Text&gt;&lt;Text style={styles.copy}&gt;Total you pay&lt;/Text&gt;&lt;Text style={styles.breakdown}&gt;{breakdown}&lt;/Text&gt;&lt;/View&gt; | checkout held |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:135` | &lt;Text style={styles.disclaimer}&gt;{donationWhereItGoes(playerName)}&lt;/Text&gt; | internal identifier/comment |
| `apps/mobile/src/frontend/components/TipCheckout.tsx:143` | &lt;Pressable accessibilityRole="button" accessibilityLabel={step === 3 ? `Donate $${total.toFixed(2)}` : 'Next'} accessibilityState={{ disabled: locked \|\| amount == null }} disabled={locked \|\| amount == null} onPress={() =&gt; { if (step === 3) void pay(); else navigate(step + 1); }} style={[styles.next, (locked \|\| amount == null) && styles.disabled]}&gt;{locked ? &lt;ActivityIndicator color={colors.onAccent} /&gt; : null}&lt;Text style={styles.nextText}&gt;{locked ? 'Opening payment…' : step === 3 ? `Donate $${total.toFixed(2)}` : 'Next →'}&lt;/Text&gt;&lt;/Pressable&gt; | checkout held |
| `apps/mobile/src/frontend/components/TipSheetModal.tsx:2` | * The donation popup keeps its header, Close and checkout navigation visible around short pages. | internal identifier/comment |
| `apps/mobile/src/frontend/components/TipSheetModal.tsx:4` | * @sideEffects Reads athlete_payout_allowed; child checkout records test donations through Stripe. | internal identifier/comment |
| `apps/mobile/src/frontend/components/TipSheetModal.tsx:38` | /** Rally goal this donation counts toward (ROADMAP M2). */ | internal identifier/comment |
| `apps/mobile/src/frontend/components/TipSheetModal.tsx:49` | * @purpose Bottom-sheet donation checkout over a blurred feed backdrop. Copy names the athlete who receives the gift (not the uploader). | internal identifier/comment |
| `apps/mobile/src/frontend/components/TipSheetModal.tsx:189` | {delivered ? `Mālo! Your donation to ${playerName} is on its way 🚀` : maloAthleteCta(playerName)} | checkout held |
| `apps/mobile/src/frontend/components/UI/JerseyBadge.tsx:2` | * Jersey number as a block numeral in a double-stitched patch (UX-08), used on athlete heroes, the QR donate page | internal identifier/comment |
| `apps/mobile/src/frontend/context/CelebrationContext.tsx:2` | * Tiny global store for the two "moment" overlays: the full-screen thank-you after a donation and the Aura / | internal identifier/comment |
| `apps/mobile/src/frontend/context/SoftWallContext.tsx:2` | * Browse-first soft wall. A guest can watch a shared Highlight and two more swipes. Upload, Donate, | internal identifier/comment |
| `apps/mobile/src/frontend/context/SoftWallContext.tsx:45` | * @purpose Browse-first soft wall: a few Highlights are free; Upload / Donate / Crew / gear goals require auth then resume. | internal identifier/comment |
| `apps/mobile/src/frontend/context/SoftWallContext.tsx:85` | // Release the stashed action (donate checkout, Join Crew, gear goal — all money-adjacent) only once | internal identifier/comment |
| `apps/mobile/src/frontend/data/finance.ts:3` | * The donate sheet discloses the 10% donation share (`MALO_DISCLAIMER`, owner 2026-09-29) and offers an | internal identifier/comment |
| `apps/mobile/src/frontend/data/finance.ts:4` | * optional tip to Tapua'i on top (`tip`, 100% platform, never taken from the athlete's donation). | internal identifier/comment |
| `apps/mobile/src/frontend/data/finance.ts:19` | /** Optional tip a donor adds for Tapua'i at checkout — all platform, logged apart from the donation. */ | internal identifier/comment |
| `apps/mobile/src/frontend/data/guardianConsent.ts:3` | * public profile and/or have donations paid out for them. The server accepts only GUARDIAN_CONSENT_VERSION with this | internal identifier/comment |
| `apps/mobile/src/frontend/data/guardianConsent.ts:27` | body: 'I choose each permission separately. Public profile: anyone, including adults, can see what {teen} shares with "Everyone". Donations paid out: donations to {teen} can be paid out to the family account on record for {teen}, for {teen} only. Only the guardian on record for that family account can allow this.', | frozen signed consent |
| `apps/mobile/src/frontend/data/guardianConsent.ts:31` | body: "Nothing is paid out without {teen}'s approval, and control passes to {teen} at 18 (or the age in your state). Tapua'i keeps 10% of each donation to run the app, including card processing. Donations are not tax-deductible.", | frozen signed consent |
| `apps/mobile/src/frontend/data/guestBrowse.ts:3` | * Upload, Donate, and Join Crew stay closed until there is an account. | internal identifier/comment |
| `apps/mobile/src/frontend/data/legal.ts:14` | 'Test payment only. This does not send live money. A donation is a gift, not a wager or pay for a play. A school or association may restrict it.'; | checkout held |
| `apps/mobile/src/frontend/data/legal.ts:17` | 'We record where this donation started — a Highlight, a QR gift link, a wishlist item, a profile, or a live play — and we use that record for your receipt, to account for the athlete, and to see which parts of Tapua\'i bring in support. Read Terms of Service & NIL Compliance for the full summary.'; | checkout held |
| `apps/mobile/src/frontend/data/malo.ts:7` | * Fan-facing money language (owner, 2026-09-29): Tapua'i is a donation app. Say **Donate** / | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:8` | * **donation** everywhere a fan gives money — never "Mālo", "tip", "backing", "Chip In" or "fund". | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:14` | export const DONATE_LABEL = 'Give'; | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:16` | /** One-line mission, shown on first open and on the donate sheet. */ | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:17` | export const DONATION_MISSION = | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:22` | * donate sheet's Amount step and under an athlete's profile Donate button; also in public docs and store | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:24` | * and Donate stays the money verb (docs/product/VOICE.md; LEGAL_BRIEFING row W, counsel open). | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:29` | /** Plain answer to "where does my donation go?" (LEGAL row Q — counsel to confirm wording). */ | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:30` | export function donationWhereItGoes(athleteName?: string \| null): string { | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:32` | return `Your donation goes to ${name}'s family account for their sports costs — not to whoever posted the clip, and never for a play or a stat. Donations to individuals are not tax-deductible.`; | checkout held |
| `apps/mobile/src/frontend/data/malo.ts:35` | /** Share of each donation that reaches the family account, and the share Tapua'i keeps (10%). */ | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:40` | * @purpose The split, said plainly at the top of the donate sheet before any amount is picked. | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:42` | export function donationSplitLine(athleteName?: string \| null): string { | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:48` | * Optional tip to Tapua'i on top of the donation (GoFundMe model, owner 2026-09-29). Defaults to 0%: | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:49` | * a pre-selected add-on for the platform is a dark pattern (LEGAL row R). Never taken from the donation. | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:58` | "Tips keep the app free for families. They go to Tapua'i, not the athlete, and never come out of your donation."; | checkout held |
| `apps/mobile/src/frontend/data/malo.ts:60` | /** Cents for a percent tip on a donation of `donationDollars`. */ | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:61` | export function platformTipCentsFor(donationDollars: number, percent: number): number { | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:62` | if (!Number.isFinite(donationDollars) \|\| donationDollars &lt;= 0 \|\| !Number.isFinite(percent) \|\| percent &lt;= 0) return 0; | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:63` | return Math.round(donationDollars * percent); | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:73` | * @purpose "On a $10 donation: $9.00 to Kaleo's family, $1.00 to Tapua'i, + $1.00 tip" — the breakdown | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:76` | export function donationBreakdownLine(args: { | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:78` | donationDollars: number; | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:83` | const cents = Math.round(args.donationDollars * 100); | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:85` | const tipCents = platformTipCentsFor(args.donationDollars, args.tipPercent); | internal identifier/comment |
| `apps/mobile/src/frontend/data/malo.ts:94` | return `On a ${money(cents)} donation: ${money(cents - platformCents)} to ${name}'s family, ${money(platformCents)} to Tapua'i${ | checkout held |
| `apps/mobile/src/frontend/data/malo.ts:120` | return `${DONATE_LABEL} to ${name}`; | internal identifier/comment |
| `apps/mobile/src/frontend/data/players.ts:2` | * Athlete and donation constants plus small helpers: preset donation amounts, the processing fee, the 90 / 10 | internal identifier/comment |
| `apps/mobile/src/frontend/data/players.ts:3` | * donation split disclosure, Aura per dollar, hype reaction ids, scorer actions, and `displayValue` / clock parsing. | internal identifier/comment |
| `apps/mobile/src/frontend/data/players.ts:4` | * `Player` and `Game` types come from `types/database.ts`. Code name `tip` = donation. | internal identifier/comment |
| `apps/mobile/src/frontend/data/players.ts:22` | * Fee disclosure on the donate sheet (owner, 2026-09-29: keep the 10% and say so before the donor pays; | internal identifier/comment |
| `apps/mobile/src/frontend/data/players.ts:28` | "90% of your donation goes to the athlete's family account. Tapua'i keeps 10% to run the app, including card processing. Nothing goes to the person who uploaded the clip."; | checkout held |
| `apps/mobile/src/frontend/data/verification.ts:41` | /** MINOR-01: an athlete aged 13–17 — payouts need the donations consent of the guardian on record for the family account. */ | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useActivityFeed.ts:4` | * `useMyDonationThanks` and `usePendingPlayerTags`. | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useActivityFeed.ts:10` | import { useMyDonationThanks } from '@/hooks/useDonationThanks'; | internal identifier |
| `apps/mobile/src/frontend/hooks/useActivityFeed.ts:14` | import { thanksText } from '@/lib/donationThanks'; | internal identifier |
| `apps/mobile/src/frontend/hooks/useActivityFeed.ts:35` | * @purpose The Activity timeline — donations received, donations sent, thank-yous from athletes, and | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useActivityFeed.ts:51` | const thanks = useMyDonationThanks(); | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:5` | fetchDonationsToThank, | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:6` | fetchMyDonationThanksResult, | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:7` | thankDonation, | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:8` | type DonationToThank, | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:12` | } from '@/lib/donationThanks'; | internal identifier |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:15` | * @purpose Athlete / guardian side: recent donations and a `thank(tipId, key)` that marks the row | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:18` | * @sideEffects `get_donations_to_thank`, `thank_donation`. | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:20` | export function useDonationsToThank(playerId: string \| null \| undefined) { | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:21` | const [rows, setRows] = useState&lt;DonationToThank[]&gt;([]); | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:31` | setRows(await fetchDonationsToThank(playerId)); | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:40` | const result = await thankDonation(tipId, key); | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:52` | * @sideEffects `get_my_donation_thanks` once signed in. | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:54` | export function useMyDonationThanks() { | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useDonationThanks.ts:69` | const result = await fetchMyDonationThanksResult(); | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useFanTipHistory.ts:2` | * A signed-in fan's own donation history, with totals (donated, athletes supported, Aura earned). | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useFanTipHistory.ts:4` | * `error` so the screen can offer Retry instead of an empty list. (Code name `tip` = donation.) | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useFanTipHistory.ts:5` | * @sideEffects Reads the fan's donation rows from Supabase. | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useFanTipHistory.ts:12` | import { fetchFanTipHistory } from '@/lib/donationHistory'; | internal identifier |
| `apps/mobile/src/frontend/hooks/useFanTipHistory.ts:34` | * @sideEffects `lib/donationHistory.fetchFanTipHistory` (RPC `get_fan_tip_history`, `tips` SELECT fallback). | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useReceivedMalo.ts:4` | import { fetchReceivedMalo } from '@/lib/donationHistory'; | internal identifier |
| `apps/mobile/src/frontend/hooks/useReceivedMalo.ts:12` | * @returns `{ rows, totalCents, loading, error }` — empty when nobody has donated, the viewer is not that athlete, or the ledger call failed. | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useReceivedMalo.ts:14` | * @sideEffects RPC `get_received_malo` through `lib/donationHistory`. `telemetry.trackIssue` when that call fails. | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:2` | * Donation checkout: opens the native Stripe PaymentSheet for a donation, Exclusive subscription, Drip order or | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:3` | * booster sponsorship, then records the result. Donations grant Aura to the donor and the athlete. | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:43` | /** `rallies.id` when this donation counts toward the athlete's Rally goal. The server re-checks it. */ | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:45` | /** Optional tip to Tapua'i as a percent of the donation (0 = none). Charged on top, never counted as the donation. */ | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:89` | * @sideEffects JWT Stripe PaymentIntent (`Authorization: Bearer` session), optional backer/reel counters, `tips` INSERT on a donation (`origin`, `entry`, `wishlist_item_id`, `source_label`, `platform_tip_cents`, `rally_id`, `cover_fee_cents`, `stripe_payment_intent_id`), `add_user_aura` twice on Mālo (payer-only when `skipBacker`), success haptics, celebration, `refreshProfile`, `TelemetryManager.trackCheckoutLatency`. | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:127` | const { amountCents: donationChargeCents } = getTipCharge(tipAmount, coverFees, feeAmount); | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:128` | // Only a donation to an athlete carries the optional Tapua'i tip (not Drip / subscribe / boosters). | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:130` | const amountCents = donationChargeCents + platformTipCents; | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:137` | // skipBacker marks the existing Vault/Exclusive/Drip/sponsorship purchase paths. It cannot provide donation receipt authority. | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:151` | supportSignals.capture({ feature: 'donation', code: 'payment_failed' }); | internal identifier |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:160` | if (presentError.code === 'Canceled') { supportSignals.capture({ feature: 'donation', code: 'user_cancelled' }); return; } | internal identifier |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:161` | supportSignals.capture({ feature: 'donation', code: 'payment_failed' }); | internal identifier |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:199` | cover_fee_cents: Math.max(0, donationChargeCents - Math.round(tipAmount * 100)), | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:208` | // A CHECK rejection of only these two fields must not cost the donation its record: keep the donation, | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:213` | telemetry.trackIssue('checkout.bookkeeping_fields_rejected', 'donate'); | internal identifier |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:214` | supportSignals.capture({ feature: 'donation', code: 'data_invalid' }); | internal identifier |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:232` | supportSignals.capture({ feature: 'donation', code: 'data_invalid' }); | internal identifier |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:235` | 'Donation not recorded', | checkout held |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:236` | 'Your payment went through, but this athlete cannot currently receive donations. Contact support if this seems wrong.', | checkout held |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:245` | onTipped?.(donationChargeCents); | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:248` | await addReelTips(reelId, donationChargeCents, EMPTY_REEL_HYPE); | internal identifier/comment |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:283` | paymentSucceeded ? 'Your payment went through, but we could not finish updating your donation. Contact support before paying again.' : message); | checkout held |
| `apps/mobile/src/frontend/hooks/useTipCheckout.ts:285` | supportSignals.capture({ feature: 'donation', code: paymentSucceeded ? 'data_invalid' : 'payment_failed' }); | internal identifier |
| `apps/mobile/src/frontend/lib/accountTags.ts:2` | * Account mentions on a Highlight. The athlete tag still decides who receives a donation. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/accountTags.ts:43` | * @purpose Attach pending mentions after a Highlight publishes. Does not change who the donation goes to. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/adminCoverage.ts:260` | { id: 'rally_donate', label: 'Give to a Rally', hint: 'Rally card → give sheet (origin rally)', surface: 'profile', fanHref: '/profile', adminHref: '/admin/money', flag: 'buttons.malo', telemetry: 'rally_donate' }, | internal identifier |
| `apps/mobile/src/frontend/lib/adminReports.ts:33` | // The structural boundary supports the legacy donation RPC absent from the generated local map. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/adminReports.ts:124` | * @purpose Read donation origins, retaining bounded fallback provenance. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/adminReports.ts:128` | export async function fetchAdminDonationBreakdown(): Promise&lt;PortalMaloBreakdown&gt; { | internal identifier/comment |
| `apps/mobile/src/frontend/lib/adminReports.ts:225` | sections.breakdown === false ? empty.breakdown : fetchAdminDonationBreakdown(), | internal identifier/comment |
| `apps/mobile/src/frontend/lib/custodial.ts:169` | * @purpose The money line for a family: what fans donated and what is recorded for the family account (after | internal identifier/comment |
| `apps/mobile/src/frontend/lib/custodial.ts:173` | * @param donatedCents What fans donated in total. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/custodial.ts:178` | donatedCents: number, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/custodial.ts:184` | headline: `${format(donatedCents)} given`, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/custodial.ts:190` | const kept = Math.max(0, donatedCents - familyCents); | internal identifier/comment |
| `apps/mobile/src/frontend/lib/custodial.ts:194` | ? `Fans gave ${format(donatedCents)}. All of it is recorded for your family account.` | internal identifier/comment |
| `apps/mobile/src/frontend/lib/custodial.ts:195` | : `Fans gave ${format(donatedCents)}. Tapua'i kept ${format(kept)} to run the app, including card processing.`, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationHistory.ts:42` | * @purpose Donations one athlete received, newest first as the server returns them. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationHistory.ts:94` | * @purpose One fan's own donation receipts. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:8` | * for the donation"). The athlete — or their parent / guardian — picks one of these messages for each | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:37` | export type DonationToThank = { | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:46` | export function parseDonationsToThank(raw: unknown): DonationToThank[] { | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:49` | .map((row): DonationToThank \| null =&gt; { | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:64` | .filter((row): row is DonationToThank =&gt; row !== null); | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:104` | * @purpose Recent donations to this athlete and whether each donor has been thanked. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:107` | export async function fetchDonationsToThank(playerId: string \| null \| undefined): Promise&lt;DonationToThank[]&gt; { | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:110` | const { data, error } = await supabase.rpc('get_donations_to_thank', { target_player_id: playerId }); | internal identifier |
| `apps/mobile/src/frontend/lib/donationThanks.ts:112` | return parseDonationsToThank(data); | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:121` | * @sideEffects `get_my_donation_thanks` RPC. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:123` | export async function fetchMyDonationThanksResult(): Promise&lt;ThanksReceivedResult&gt; { | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:126` | const { data, error } = await supabase.rpc('get_my_donation_thanks', {}); | internal identifier |
| `apps/mobile/src/frontend/lib/donationThanks.ts:143` | * @purpose Send one preset thank-you to the donor of `tipId`. Once per donation. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:144` | * @sideEffects `thank_donation` RPC. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:146` | export async function thankDonation(tipId: string, key: ThanksKey): Promise&lt;ThankResult&gt; { | internal identifier/comment |
| `apps/mobile/src/frontend/lib/donationThanks.ts:149` | const { error } = await supabase.rpc('thank_donation', { target_tip_id: tipId, message_key: key }); | internal identifier |
| `apps/mobile/src/frontend/lib/finance.ts:2` | * Money labelling helpers: pick the channel stored on a donation (`tips.origin`) and the short channel line shown | internal identifier/comment |
| `apps/mobile/src/frontend/lib/finance.ts:22` | * @param rallyId Rally goal the donation counts toward. Wins over a caller origin and a clip id. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/finance.ts:69` | *   the donation so the books can match a Stripe payout to its donations (BOOKS-01). Null when it is not one. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/finance.ts:131` | * @purpose Newest donation rows for the signed-in Profile ledger. An empty list covers a missing table or a guest. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/freshQuestions.ts:47` | not_okay_word: 'That word is not okay here.', money_word: 'Leave out donation and money words.', brand: 'No brand or company names.', | visible internal vocabulary |
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
| `apps/mobile/src/frontend/lib/minors.ts:258` | const allowed = [d.public_profile === true ? 'a public profile' : null, d.donations === true ? 'payouts of gifts' : null].filter(Boolean); | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:282` | allowsDonations: boolean; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:289` | allows_donations: consent.allowsDonations, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:295` | export type InvitePreview = { status: 'ok'; firstName: string; username: string \| null; canAllowDonations: boolean } \| { status: 'bad_code' }; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:301` | return { status: 'ok', firstName: str(raw.first_name, 'This teen'), username: typeof raw.username === 'string' ? raw.username : null, canAllowDonations: raw.can_allow_donations === true }; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:330` | canAllowDonations: boolean; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:347` | canAllowDonations: r.can_allow_donations === true, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:435` | teensDonationsConsent: number; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/minors.ts:455` | teensDonationsConsent: num(r.teens_donations_consent), | internal identifier/comment |
| `apps/mobile/src/frontend/lib/payeeVerification.ts:2` | * Payee verification on the admin desk (VERIFY-02): who would receive an athlete's donations, which checks they have, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/payments.ts:2` | * Small donation helpers: re-exports `createPaymentIntent` and bumps an athlete's `backer_count`. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/privacy.ts:42` | /** What stays visible to everyone even on a private account, so tags, donations and recruiting keep working. */ | internal identifier/comment |
| `apps/mobile/src/frontend/lib/rallies.ts:8` | * travel, camps, college prep — tells the story in a few lines, and the community donates toward it. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/rallies.ts:12` | * money; donations tagged with `rally_id` move the total and fill it. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/rallies.ts:23` | donationCount: number; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/rallies.ts:76` | donationCount: asCount(row.donation_count), | internal identifier/comment |
| `apps/mobile/src/frontend/lib/rallies.ts:108` | export function rallyProgress(rally: Pick&lt;Rally, 'raisedCents' \| 'targetCents' \| 'donationCount'&gt;): { | internal identifier |
| `apps/mobile/src/frontend/lib/rallies.ts:114` | const donors = rally.donationCount; | internal identifier/comment |
| `apps/mobile/src/frontend/lib/rallies.ts:244` | *   showing what the donations paid for. | internal identifier/comment |
| `apps/mobile/src/frontend/lib/reels.ts:3` | * `clearReelHype`), donation totals on a clip, hiding a clip locally, reporting and Vault toggling, playback URL | internal identifier/comment |
| `apps/mobile/src/frontend/lib/reels.ts:35` | /** Null when the clip is posted before an athlete is tagged. Donate stays off until then. */ | internal identifier/comment |
| `apps/mobile/src/frontend/lib/roster.ts:15` | * @purpose Load every roster row for tagging, donations and the athlete sheet (`players` including `vault_locked`). | internal identifier/comment |
| `apps/mobile/src/frontend/lib/stripeIntent.ts:1` | /** Shared checkout transport; donation declarations distinguish gifts from purchases but never prove settlement. */ | internal identifier/comment |
| `apps/mobile/src/frontend/lib/stripeIntent.ts:27` | donation?: { giftCents: number; coverFees: boolean; platformTipPercent: number }, | internal identifier/comment |
| `apps/mobile/src/frontend/lib/stripeIntent.ts:34` | ...(donation ? { donation } : {}), | internal identifier/comment |
| `apps/mobile/src/frontend/lib/wishlist.ts:3` | * move an item's funded total after a donation has been recorded. | internal identifier/comment |
| `apps/mobile/src/frontend/services/SupportSignalManager.ts:38` | if (scope.category === 'finance' \|\| scope.feature === 'donation' \|\| scope.feature === 'payouts') return 'payment_failed'; | internal identifier |
| `apps/mobile/src/frontend/services/TelemetryManager.ts:367` | * @purpose Mount-to-first-effect latency for a key surface (Home, Sport Pop Quiz, donate sheet): a blocked | internal identifier/comment |
| `apps/mobile/src/frontend/services/supportRuntime.ts:10` | if (route.startsWith('/gift/')) return 'donation'; | internal identifier |
| `apps/mobile/src/frontend/theme/motion.ts:75` | * \| Brand / Donate / Aura \| Deep jade ink + bright jade glow \| Primary CTAs, Upload, the active tab on every destination \| | internal identifier/comment |
| `apps/mobile/src/frontend/theme/motion.ts:111` | * bright glows belong on dark media. Jade remains Donate/Upload and gold remains awards. | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:838` | donation_thanks: { | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:1431` | allows_donations: boolean | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:1447` | allows_donations: boolean | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:1463` | allows_donations?: boolean | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:2486` | donation_count: number | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:2507` | donation_count?: number | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:2528` | donation_count?: number | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:4596` | allows_donations: boolean | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:6037` | get_donations_to_thank: { | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:6093` | get_my_donation_thanks: { | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:6296` | can_allow_donations: boolean | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:7919` | donations: boolean | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:8275` | allows_donations: boolean | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.generated.ts:8378` | thank_donation: { | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:262` | /** Optional tip to Tapua'i charged on top of this donation (cents; not part of `amount_cents`). */ | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:266` | /** Stripe PaymentIntent id (`pi_…`) so a payout can be matched to its donations. BOOKS-01. */ | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:268` | /** Rally goal this donation counted toward (nulled by the server if the Rally wasn't open). */ | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:275` | /** `public.rallies` — a named sports cost the community donates toward (ROADMAP M2). */ | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:285` | donation_count: number; | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:1014` | thank_donation: { | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:1018` | get_donations_to_thank: { | internal identifier/comment |
| `apps/mobile/src/frontend/types/database.ts:1022` | get_my_donation_thanks: { | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:16` | * Gifts draws "Athletes by all-time gifts" from `get_admin_reports.donation_bands` (three | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:59` | DONATION_BANDS, | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:60` | DONATION_BANDS_MISSING_NOTE, | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:61` | DONATION_BANDS_TITLE, | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:62` | donationBandsSentence, | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:177` | if (measure.section === 'donation_bands' && value == null && stateOf(reports) === 'ok') return `${measure.note} ${DONATION_BANDS_MISSING_NOTE}`; | internal identifier |
| `packages/shared-types/admin/analytics.ts:202` | if (measure.section === 'donation_bands') { | internal identifier |
| `packages/shared-types/admin/analytics.ts:204` | const band = DONATION_BANDS.find((item) =&gt; item.key === key); | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:205` | return band && reports.donationBands ? reports.donationBands[band.field] : null; | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:281` | * @purpose "Athletes by all-time gifts": the three `donation_bands` measures as bars in band | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:286` | function donationBands(reports: PortalReports, revenue: PortalRevenue, error: string \| null): BarsSpec { | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:288` | const bands = ok ? reports.donationBands : null; | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:289` | const defs = DONATION_BANDS.map((band) =&gt; measureDef(band.key)); | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:291` | if (ok) summary = bands ? donationBandsSentence(bands) : `${DONATION_BANDS_TITLE}: not in this read. ${DONATION_BANDS_MISSING_NOTE}`; | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:293` | id: 'bands-donations', | internal identifier |
| `packages/shared-types/admin/analytics.ts:295` | title: DONATION_BANDS_TITLE, | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:297` | source: 'get_admin_reports.donation_bands', | internal identifier |
| `packages/shared-types/admin/analytics.ts:300` | accent: measureColor('donations'), | internal identifier |
| `packages/shared-types/admin/analytics.ts:302` | points: bands ? DONATION_BANDS.map((band) =&gt; ({ label: band.label, value: readMeasure(band.key, reports, revenue) })) : null, | internal identifier/comment |
| `packages/shared-types/admin/analytics.ts:388` | accent: current.unit === 'cents' ? measureColor('donations') : measureColor('clips'), | internal identifier |
| `packages/shared-types/admin/analytics.ts:484` | if (board === 'donations') { | internal identifier |
| `packages/shared-types/admin/analytics.ts:488` | donationBands(reports, revenue, error), | internal identifier/comment |
| `packages/shared-types/admin/analyticsCatalog.ts:14` | \| 'donations' | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:24` | \| 'donation_bands' | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:195` | id: 'donations', | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:249` | { key: 'malo_cents_all', board: 'donations', section: 'money', label: 'Gifts, all time', unit: 'cents', grain: 'all', note: 'Sum of gift rows.' }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:250` | { key: 'malo_count_all', board: 'donations', section: 'money', label: 'Gift count, all time', unit: 'count', grain: 'all', note: 'Gifts, not people who gave.' }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:251` | { key: 'malo_cents_24h', board: 'donations', section: 'money', label: 'Gifts, 24 hours', unit: 'cents', grain: '24h', note: 'Sum of gift rows in the last day.' }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:252` | { key: 'malo_count_24h', board: 'donations', section: 'money', label: 'Gift count, 24 hours', unit: 'count', grain: '24h', note: 'Gifts in the last day.' }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:253` | { key: 'malo_cents_7d', board: 'donations', section: 'money', label: 'Gifts, 7 days', unit: 'cents', grain: '7d', note: 'Sum of gift rows this week.' }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:254` | { key: 'malo_count_7d', board: 'donations', section: 'money', label: 'Gift count, 7 days', unit: 'count', grain: '7d', note: 'Gifts this week. Not people who gave.' }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:255` | { key: 'malo_cents_prev_7d', board: 'donations', section: 'money', label: 'Gifts, the week before', unit: 'cents', grain: 'prior7d', note: 'The week used as the comparison.' }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:256` | { key: 'avg_tip_cents_7d', board: 'donations', section: 'money', label: 'Average gift, 7 days', unit: 'cents', grain: '7d', note: 'Mean gift this week. Not the share of people who gave.' }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:257` | { key: 'queued_payouts', board: 'donations', section: 'money', label: 'Queued payouts', unit: 'count', grain: 'now', note: 'Payout rows waiting. Not money sent.' }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:258` | { key: 'paid_payouts_cents', board: 'donations', section: 'money', label: REPORT_LABELS.paid_payouts_cents, unit: 'cents', grain: 'all', note: REPORT_NOTES.paid_payouts_cents }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:259` | { key: 'active_subs', board: 'donations', section: 'money', label: 'Exclusive rows marked active', unit: 'count', grain: 'now', note: 'One-time Exclusive. This is a row count, not a renewal.' }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:260` | { key: 'under_50', board: 'donations', section: 'donation_bands', label: 'Athletes with all-time gifts under $50', unit: 'count', grain: 'all', note: 'Athletes whose all-time gift total is more than $0 and under $50. A count, no names.' }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:261` | { key: '50_to_250', board: 'donations', section: 'donation_bands', label: 'Athletes with all-time gifts of $50–$250', unit: 'count', grain: 'all', note: 'Athletes whose all-time gift total is $50 or more and under $250. A count, no names.' }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:262` | { key: '250_plus', board: 'donations', section: 'donation_bands', label: 'Athletes with all-time gifts of $250 and up', unit: 'count', grain: 'all', note: 'Athletes whose all-time gift total is $250 or more. A count, no names.' }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:309` | { id: 'malo', title: 'Gifts', board: 'donations', source: 'get_admin_reports.series.malo', format: 'cents', accent: measureColor('donations'), note: 'Sum of gift rows per UTC day, last 7 days.' }, | internal identifier |
| `packages/shared-types/admin/analyticsCatalog.ts:321` | { id: 'malo', title: 'Gift totals by athlete (not drawn)', board: 'donations', source: 'get_admin_reports.leaders.malo', format: 'cents', note: 'All time, top 5, named. Read but not drawn: the portal names no one by gift total (owner decision 2026-10-12). The Gifts board shows athletes by all-time gifts instead.' }, | internal identifier |
| `packages/shared-types/admin/bookkeeping.ts:235` | export function journalFromDisbursement(row: DisbursementInput, held: { donations: number; vault: number } = { donations: Infinity, vault: 0 }): JournalEntry \| null { | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:241` | const fromDonations = Math.min(amount, Math.max(0, held.donations)); | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:242` | const fromVault = Math.min(amount - fromDonations, Math.max(0, held.vault)); | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:243` | const rest = amount - fromDonations - fromVault; | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:245` | if (fromDonations + rest &gt; 0) debits.push({ account: '2000', debit: fromDonations + rest, credit: 0, athleteRef: ref }); | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:293` | const balance = new Map&lt;string, { donations: number; vault: number }&gt;(); | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:297` | const held = balance.get(line.athleteRef) ?? { donations: 0, vault: 0 }; | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:298` | if (line.account === '2000') held.donations += line.credit - line.debit; | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:308` | const entry = journalFromDisbursement(row, ref ? balance.get(ref) ?? { donations: 0, vault: 0 } : undefined); | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:409` | export type AthleteHeld = { athleteRef: string; playerId: string \| null; donations: number; vault: number; paidOut: number; held: number }; | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:419` | const row = rows.get(line.athleteRef) ?? { athleteRef: line.athleteRef, playerId: idByRef.get(line.athleteRef) ?? null, donations: 0, vault: 0, paidOut: 0, held: 0 }; | internal identifier/comment |
| `packages/shared-types/admin/bookkeeping.ts:420` | if (line.account === '2000') row.donations += line.credit; | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:25` | donations7dCents: number \| null; | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:26` | donationsPrev7dCents: number \| null; | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:27` | donationCount7d: number \| null; | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:28` | avgDonation7dCents: number \| null; | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:42` | \| 'donations' | internal identifier |
| `packages/shared-types/admin/dashboard.ts:43` | \| 'avgDonation' | internal identifier |
| `packages/shared-types/admin/dashboard.ts:238` | const donationsDelta = priorWeek(input.donations7dCents, input.donationsPrev7dCents); | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:243` | id: 'donations', | internal identifier |
| `packages/shared-types/admin/dashboard.ts:245` | value: isMeasured(input.donations7dCents) ? formatUsd(input.donations7dCents) : '—', | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:246` | hint: donationsDelta ? 'Recorded gifts, last 7 days' : 'The prior week is not in this read', | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:248` | missing: !isMeasured(input.donations7dCents), | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:249` | delta: donationsDelta, | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:253` | id: 'avgDonation', | internal identifier |
| `packages/shared-types/admin/dashboard.ts:255` | value: isMeasured(input.avgDonation7dCents) ? formatUsd(input.avgDonation7dCents) : '—', | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:256` | hint: !isMeasured(input.donationCount7d) | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:258` | : input.donationCount7d &gt; 0 | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:259` | ? `Across ${formatCount(input.donationCount7d)} ${input.donationCount7d === 1 ? 'gift' : 'gifts'}` | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:262` | missing: !isMeasured(input.avgDonation7dCents), | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:350` | const donations = priorWeek(input.donations7dCents, input.donationsPrev7dCents); | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:369` | donations | internal identifier/comment |
| `packages/shared-types/admin/dashboard.ts:370` | ? weekSentence('Gifts', weekChange(donations.current, donations.previous), formatUsd) | internal identifier/comment |
| `packages/shared-types/admin/departments.ts:14` | donations7dCents: number \| null; | internal identifier/comment |
| `packages/shared-types/admin/departments.ts:67` | const { donations7dCents: donations, sessions24h: sessions, issues24h: issues, openBugs: bugs, stalls24h: stalls, reconnects24h: reconnects } = snapshot; | internal identifier/comment |
| `packages/shared-types/admin/departments.ts:75` | : !known(donations) | internal identifier/comment |
| `packages/shared-types/admin/departments.ts:77` | : donations &gt; 0 | internal identifier/comment |
| `packages/shared-types/admin/engineeringSupport.ts:12` | donation: { label: 'Give', sensitivity: 'finance' }, payouts: { label: 'Payouts', sensitivity: 'finance' }, | internal identifier/comment |
| `packages/shared-types/admin/eventLabels.ts:50` | rally_donate: 'Give to a Rally', | internal identifier/comment |
| `packages/shared-types/admin/financeFilters.ts:4` | * stream, account touched, channel (where a donation started), athlete, payee side, amount range and | internal identifier/comment |
| `packages/shared-types/admin/measureColors.ts:22` | \| 'donations' | internal identifier |
| `packages/shared-types/admin/measureColors.ts:43` | donations: 'jade', | internal identifier/comment |
| `packages/shared-types/admin/operations.ts:210` | 'donate-sheet': 'Give sheet', | internal identifier |
| `packages/shared-types/admin/reports.ts:31` | /** `get_admin_reports.donation_bands`. `null` = not in this read (migration not applied) or not an object. */ | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:32` | donationBands: DonationBands \| null; | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:44` | export type DonationBands = { | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:148` | donationBands: null, | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:216` | export const DONATION_BANDS: readonly { key: 'under_50' \| '50_to_250' \| '250_plus'; field: keyof DonationBands; label: string }[] = [ | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:223` | export const DONATION_BANDS_TITLE = 'Athletes by all-time gifts'; | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:225` | /** Shown when a working read has no `donation_bands` key: the migration is not on this database yet. */ | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:226` | export const DONATION_BANDS_MISSING_NOTE = 'Needs the 2026-10-12 reports update on this database.'; | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:229` | * @purpose Parse `get_admin_reports.donation_bands`. Pure. | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:234` | export function parseDonationBands(value: unknown): DonationBands \| null { | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:243` | const bands: DonationBands = { under50: count(bag.under_50), from50to250: count(bag['50_to_250']), over250: count(bag['250_plus']) }; | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:250` | export function donationBandRows(bands: DonationBands): { label: string; value: number \| null }[] { | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:251` | return DONATION_BANDS.map((band) =&gt; ({ label: band.label, value: bands[band.field] })); | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:257` | export function donationBandsSentence(bands: DonationBands): string { | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:258` | const parts = DONATION_BANDS.map((band) =&gt; { | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:263` | return `${DONATION_BANDS_TITLE}. ${parts.join('; ')}.`; | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:388` | donation_bands: DONATION_BANDS_TITLE, | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:486` | donationBands: parseDonationBands(row.donation_bands), | internal identifier/comment |
| `packages/shared-types/admin/reports.ts:495` | donation_bands: 'All time. Counts of athletes by all-time gift total (more than $0 and under $50, $50 to under $250, $250 and up), no names. Athletes with no gifts are not counted.', | internal identifier/comment |
| `packages/shared-types/admin/revenueModel.ts:63` | export function donationChannel(origin: string, entry: string, sourceLabel: string): string { | internal identifier/comment |
| `packages/shared-types/admin/revenueModel.ts:104` | export type DonationSplit = { | internal identifier/comment |
| `packages/shared-types/admin/revenueModel.ts:115` | export function donationSplit(streams: RevenueStream[]): DonationSplit \| null { | internal identifier/comment |
| `packages/shared-types/admin/supportTopology.json:325` | "id": "DONATION_THANKS", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:329` | "apps/mobile/src/frontend/lib/donationThanks.ts", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:330` | "apps/mobile/src/frontend/hooks/useDonationThanks.ts", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:2026` | "name": "donation_thanks", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:2028` | "owner": "DONATION_THANKS", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:2033` | "thank_donation" | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:2036` | "get_donations_to_thank", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:2037` | "get_my_donation_thanks" | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:3451` | "get_my_donation_thanks", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:3667` | "get_donations_to_thank", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:3742` | "thank_donation", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:3931` | "get_donations_to_thank", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:6216` | "apps/mobile/src/frontend/lib/donationHistory.ts", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:6226` | "get_donations_to_thank", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:6228` | "get_my_donation_thanks", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:6231` | "thank_donation" | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9860` | "name": "get_donations_to_thank", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9861` | "owner": "DONATION_THANKS", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9863` | "apps/mobile/src/frontend/lib/donationThanks.ts" | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9868` | "donation_thanks", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9893` | "apps/mobile/src/frontend/lib/donationHistory.ts" | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9949` | "name": "get_my_donation_thanks", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9950` | "owner": "DONATION_THANKS", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9952` | "apps/mobile/src/frontend/lib/donationThanks.ts" | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:9957` | "donation_thanks", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:10089` | "apps/mobile/src/frontend/lib/donationHistory.ts" | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:14450` | "sql:get_donations_to_thank", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:14452` | "sql:thank_donation", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:15385` | "name": "thank_donation", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:15386` | "owner": "DONATION_THANKS", | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:15388` | "apps/mobile/src/frontend/lib/donationThanks.ts" | internal source metadata |
| `packages/shared-types/admin/supportTopology.json:15392` | "donation_thanks" | internal source metadata |
| `packages/shared-types/notificationTemplates.ts:13` | account: 'account_welcome', donation_receipts: 'donation_confirmed', | internal identifier |
| `packages/shared-types/notificationTemplates.ts:14` | donations_received: 'donation_received', payment_updates: 'payment_updated', | internal identifier |
| `packages/shared-types/notificationTemplates.ts:19` | donation_receipts: { subject: 'Your gift update', body: 'There is an update for a gift you made. Sign in to review your gift history.' }, | internal identifier/comment |
| `packages/shared-types/notificationTemplates.ts:20` | donations_received: { subject: 'A gift update is ready', body: 'There is a gift update you may be permitted to review. Sign in to see the current details.' }, | internal identifier/comment |
| `packages/shared-types/notifications.ts:7` | 'account', 'donation_receipts', 'donations_received', 'payment_updates', | internal identifier |
| `packages/shared-types/notifications.ts:19` | { id: 'donation_receipts', label: 'Gifts you make', description: 'Gift confirmations in your account.' }, | internal identifier |
| `packages/shared-types/notifications.ts:20` | { id: 'donations_received', label: 'Gifts you receive', description: 'Updates for gifts you are permitted to review.' }, | internal identifier |
| `packages/shared-types/notifications.ts:98` | kind: 'account_welcome' \| 'donation_confirmed' \| 'donation_received' \| 'payment_updated' | internal identifier |
| `packages/shared-types/timedSportQuiz.ts:70` | /** QUIZ-05: the athlete card after a fun fact's reveal (no Donate or money words on that card). */ | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:2` | export type DonationRequest = { giftCents: number; coverFees: boolean; platformTipPercent: number }; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:3` | export type DonationPaymentContext = { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:4` | id: string; donorId: string; athleteId: string; purpose: 'donation'; currency: 'usd'; | internal identifier |
| `supabase/functions/_shared/money/paymentContext.ts:9` | export type DonationContextAdapter = { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:10` | quote(request: DonationRequest & { donorId: string; athleteId: string }): Promise&lt;DonationPaymentContext \| null&gt;; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:11` | persist(context: DonationPaymentContext, paymentIntentId: string): Promise&lt;{ data: unknown; error: unknown }&gt;; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:17` | export function validDonationContext(context: DonationPaymentContext \| null, expected: { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:19` | }): context is DonationPaymentContext { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentContext.ts:22` | && context.purpose === 'donation' && context.currency === 'usd' | internal identifier |
| `supabase/functions/_shared/money/paymentContext.ts:33` | export function donationContextMetadata(context: DonationPaymentContext): Record&lt;string, string&gt; { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:2` | * Money server core (SCALE-04): donation checkout. Validates the amount and the optional tip for Tapua'i, runs the | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:12` | import { donationContextMetadata, validDonationContext, type DonationContextAdapter, type DonationPaymentContext, type DonationRequest } from './paymentContext.ts'; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:26` | /** `players.id` this charge is for (donation / vault unlock / exclusive subscribe). Omitted for player-agnostic | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:32` | donation?: DonationRequest; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:63` | donationContext?: DonationContextAdapter; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:78` | let context: DonationPaymentContext \| null = null; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:79` | if (body.donation !== undefined) { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:80` | const request = body.donation; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:96` | // Fail closed only on an explicit `true` (LEGAL_BRIEFING §8 item 5): this is the one point where a donation can | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:103` | if (body.donation && input.donationContext) { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:106` | const request = body.donation; | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:107` | context = await input.donationContext.quote({ ...request, donorId: input.userId, athleteId: playerId }); | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:108` | if (!validDonationContext(context, { donorId: input.userId, athleteId: playerId, giftCents: request.giftCents, | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:121` | ...(body.donation ? { tapuai_purpose: 'donation', tapuai_notification_authority: 'false' } : {}), | internal identifier |
| `supabase/functions/_shared/money/paymentIntent.ts:122` | ...(context ? donationContextMetadata(context) : {}), | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:126` | if (context && input.donationContext) { | internal identifier/comment |
| `supabase/functions/_shared/money/paymentIntent.ts:129` | const result = await input.donationContext.persist(context, paymentIntent.id); | internal identifier/comment |
| `supabase/functions/create-payment-intent/index.ts:10` | * Edge Function adapter for donation checkout — the primary checkout path: `lib/stripeIntent.ts` invokes this | internal identifier/comment |
| `supabase/functions/stripe-webhook/index.ts:2` | * NOTIFY-01: verify raw Stripe events and durably observe prepared donation context in one service-only RPC. | internal identifier/comment |
| `supabase/functions/stripe-webhook/index.ts:3` | * Donation credit/Aura remains client-owned. Rich metadata alone never writes business rows, claims financial | internal identifier/comment |
