/**
 * Open metric rows wrap labels and whole values inside the shared report at enlarged text.
 * Trends (`/reports`, owned by ADMIN): the analysis page of the read-only Next admin portal. Daily
 * series, this week vs the prior week (clips and gifts only), 24-hour pace against the 7-day
 * daily average, splits, athletes by all-time gifts (three bands, counts only: owner decision
 * 2026-10-12 replaced the named "Largest gift totals" list, so Trends names no one by gift
 * total and does not draw `leaders.malo`), the two top 5 lists, counts now, reliability, and every
 * `get_admin_reports` section as returned. When `donation_bands` is missing (migration not applied)
 * the bands show the kit's missing state and say the database needs the 2026-10-12 reports update. Tap and UI-issue lists name their
 * rows with `featureLabel` / `issueLabel` (lib/eventLabels.ts), never the raw telemetry key. Home's
 * KPI row and week strip are not repeated; the intro links there. Colours come from `lib/measureColors.ts`; durations read "850 ms" / "1.3 s" like Health. Missing shows "—", never 0.
 * @sideEffects One `get_admin_reports` read per request (same RPC as Expo `/admin/reports`). No writes.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

import { CompareBars, HBarList, Meter, SplitBar, StatTile, TrendChart, type ChartColor, type ChartPoint } from '@/components/charts';
import { Panel, PortalShell, SectionHeading } from '@/components/PortalShell';
import { UNMEASURED } from '@/lib/dashboard';
import { featureLabel, issueLabel, labelRows } from '@/lib/eventLabels';
import { measureColor } from '@/lib/measureColors';
import {
  DONATION_BANDS_MISSING_NOTE,
  DONATION_BANDS_TITLE,
  REPORT_NOTES,
  donationBandRows,
  donationBandsSentence,
  fetchPortalReports,
  formatCount,
  formatDuration,
  formatMinutes,
  formatPercent,
  formatReportValue,
  formatUsd,
  formatUsdWhole,
  labelForReportKey,
  reportNumber,
  type ReportLeader,
  type ReportSection,
} from '@/lib/reports';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Trends' };

const WEEK = 'Last 7 days, UTC';
const PACE_CAPTION = 'The last 24 hours are part of the 7-day total, so this shows pace, not growth.';

/** Screen-reader-safe "—": the dash is decoration, the words are what a reader hears. */
function Blank({ words }: { words: string }) {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{words}</span>
    </>
  );
}

/** Every key of one `get_admin_reports` section, as returned. `read` false = nothing was read, not an empty window. */
function MetricList({ section, read }: { section: ReportSection; read: boolean }) {
  const rows = Object.entries(section);
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">{read ? 'No samples in this window yet.' : 'Not in this read.'}</p>;
  }
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map(([key, value]) => (
        <div key={key} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--border)] py-3">
          <dt className="min-w-0 flex-1 basis-[10rem] text-sm text-[var(--ink-soft)]">{labelForReportKey(key)}</dt>
          <dd className="chart-tabular ml-auto shrink-0 text-sm font-extrabold whitespace-nowrap">{formatReportValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * @purpose Counts of different things (polls vs poll votes, flags vs Vault clips) as a stat list, not
 *   one bar scale, so a large count never makes a small one look like nothing. Missing shows "—".
 */
function CountList({ rows }: { rows: ChartPoint[] }) {
  return (
    <dl className="grid gap-2">
      {rows.map((row) => (
        <div key={row.label} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--border)] py-3">
          <dt className="min-w-0 flex-1 basis-[10rem] text-sm text-[var(--ink-soft)]">{row.label}</dt>
          <dd className={`chart-tabular ml-auto shrink-0 text-base font-extrabold whitespace-nowrap ${row.value == null ? 'text-[var(--text-muted)]' : ''}`}>
            {row.value == null ? <Blank words="Not in this read" /> : formatCount(row.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A 7-day daily average from a 7-day total. Null stays null. */
function perDay(total: number | null): number | null {
  return total == null ? null : total / 7;
}

/**
 * @purpose The sentence for a "last 24 hours vs 7-day daily average" pair. Never a percent or a
 *   week-over-week word: the 24 hours sit inside the 7 days, so this is pace only. Within 5% reads
 *   "about the same as".
 */
function paceSentence(subject: string, last24h: number | null, average: number | null, format: (n: number) => string): string {
  if (last24h == null || average == null) return `${subject}: one side of this comparison is not in this read.`;
  if (last24h === 0 && average === 0) return `${subject}: none in the last 24 hours or the last 7 days.`;
  const gap = Math.abs(last24h - average);
  const level = gap <= Math.max(average, last24h) * 0.05;
  const word = level ? 'about the same as' : last24h > average ? 'above' : 'below';
  return `${subject}: ${format(last24h)} in the last 24 hours, ${word} the 7-day daily average of ${format(average)}.`;
}

/**
 * @purpose Web Trends desk (`/reports`): the analysis page. Every 7-day series, the two prior-week
 *   pairs, the 24-hour pace against the 7-day daily average, the splits, every ranked list, the
 *   counts now, reliability, and every section of `get_admin_reports` as returned. Home's headline
 *   tiles and week-at-a-glance strip are not repeated here; the intro links to Home for them.
 *   Colours come from `lib/measureColors.ts`. Missing keys show "—", never 0. Unmeasured rates stay
 *   named and blank.
 * @sideEffects Same RPC as Expo `/admin/reports`. Read-only.
 */
export default async function ReportsPage() {
  const reports = await fetchPortalReports();
  // `read` = the RPC answered. In setup mode or after a failure every list is "not in this read", not empty.
  const read = reports.configured && !reports.error;
  const error = reports.configured ? reports.error : null;
  const { usage, money, engagement, content, audience, live, reliability, series } = reports;
  const n = (section: ReportSection, key: string) => (read ? reportNumber(section, key) : null);
  // null = the key was not in the read (kit "missing"); [] = read but empty (kit empty state).
  const list = (rows: ReportLeader[] | null): ChartPoint[] | null => (read ? rows : null);
  // Telemetry keys ("reel.seki", "upload.retry · upload") become people words, so the bars and the
  // "… leads at" line never show code.
  const named = (rows: ReportLeader[] | null, label: (key: string) => string): ChartPoint[] | null =>
    read && rows ? labelRows(rows, label) : list(rows);

  const donations7d = n(money, 'malo_cents_7d');
  const donationsPrev = n(money, 'malo_cents_prev_7d');
  const clips7d = n(engagement, 'clips_7d');
  const clipsPrev = n(engagement, 'clips_prev_7d');

  // Two rows so neither leaves an empty slot: the prior-week measures, then use and friction.
  const paceRow = (title: string, last: number | null, week: number | null, format: (value: number) => string, accent: ChartColor, keys: string) => ({
    title,
    last,
    week,
    format,
    accent,
    keys,
  });
  const paceGroups = [
    [
      paceRow('Clips uploaded', n(engagement, 'clips_24h'), clips7d, formatCount, measureColor('clips'), 'clips_24h · clips_7d'),
      paceRow('Gifts', n(money, 'malo_cents_24h'), donations7d, formatUsd, measureColor('donations'), 'malo_cents_24h · malo_cents_7d'),
    ],
    [
      paceRow('Feature taps', n(usage, 'taps_24h'), n(usage, 'taps_7d'), formatCount, measureColor('featureTaps'), 'taps_24h · taps_7d'),
      paceRow('UI issues', n(usage, 'issues_24h'), n(usage, 'issues_7d'), formatCount, measureColor('issues'), 'issues_24h · issues_7d'),
      paceRow('Time on tabs', n(usage, 'dwell_ms_24h'), n(usage, 'dwell_ms_7d'), formatMinutes, measureColor('timeOnTabs'), 'dwell_ms_24h · dwell_ms_7d'),
    ],
  ];

  const counts = (section: ReportSection, keys: readonly string[]): ChartPoint[] =>
    keys.map((key) => ({ label: labelForReportKey(key), value: n(section, key) }));
  const contentRows = counts(content, ['flagged', 'removed', 'vault', 'exclusive_clips', 'flash_live', 'spotlight_live', 'qna']);
  const liveRows = counts(live, ['poll_votes', 'active_polls', 'active_boosters', 'drip_skus']);
  const fanRows = counts(engagement, ['hype_votes', 'saves', 'crew_follows']);

  const reconnects = n(reliability, 'reconnects_24h');
  const checkouts = n(reliability, 'checkouts_24h');
  const avgCheckout = n(reliability, 'avg_checkout_ms_24h');
  const openBugs = n(usage, 'feedback_bugs_open');

  // Athletes by all-time gift total, three bands, no names. null = the key is not in a working
  // read (the 2026-10-12 migration is not applied here): the kit's missing state plus that note.
  const bands = read ? reports.donationBands : null;
  const bandRows: ChartPoint[] | null = bands ? donationBandRows(bands) : null;
  const bandsSummary = !read ? undefined : bands ? donationBandsSentence(bands) : `${DONATION_BANDS_TITLE}: not in this read. ${DONATION_BANDS_MISSING_NOTE}`;

  return (
    <PortalShell active="/reports">
      <p className="mb-8 max-w-3xl text-sm text-[var(--text-muted)]">
        Daily series, week-over-week and 24-hour pace, splits, rankings and every count in{' '}
        <code className="rounded bg-[var(--jade-soft)] px-1.5">get_admin_reports</code>, the same read as Expo{' '}
        <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin/reports</code>. Days are UTC.{' '}
        {reports.generatedAt ? <>Generated {new Date(reports.generatedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC. </> : null}
        Headline numbers and the week at a glance are on{' '}
        <Link href="/" className="font-extrabold text-[var(--jade)]">
          Home →
        </Link>{' '}
        Ledger detail is on{' '}
        <Link href="/money" className="font-extrabold text-[var(--jade)]">
          Revenue →
        </Link>
      </p>

      {!reports.configured ? (
        <div className="mb-8 rounded-xl border border-dashed border-[var(--border)] px-4 py-3 text-sm text-[var(--text-muted)]">
          Supabase is not set up in this environment, so nothing was read. Every number below shows “—”.
        </div>
      ) : null}
      {error ? (
        <div className="mb-8">
          <Panel title="Could not load reports" kicker="RPC">
            <p role="alert" className="rounded-xl border border-[var(--ember)]/30 bg-[var(--ember-soft)] px-4 py-3 text-sm font-semibold text-[var(--ember)]">
              {error}. Needs <code>get_admin_reports</code> (run <code>supabase/admin_reports.sql</code> + <code>supabase/usage_reports.sql</code>).
            </p>
          </Panel>
        </div>
      ) : null}

      <div className="space-y-10">
        <section aria-labelledby="trends-daily">
          <SectionHeading id="trends-daily" level={2} title="Daily trends" hint="One point per UTC day" />
          <div className="grid gap-6 lg:grid-cols-2">
            <TrendChart
              title="Gifts per day"
              windowLabel={WEEK}
              points={list(series.malo)}
              format={formatUsd}
              tickFormat={formatUsdWhole}
              tickUnit={100}
              variant="area"
              accent={measureColor('donations')}
              source="get_admin_reports.series.malo"
              error={error}
            />
            <TrendChart
              title="Clips uploaded per day"
              windowLabel={WEEK}
              points={list(series.clips)}
              format={formatCount}
              variant="columns"
              accent={measureColor('clips')}
              source="get_admin_reports.series.clips"
              error={error}
            />
            <TrendChart
              title="Time on tabs per day"
              windowLabel={WEEK}
              points={list(series.dwell)}
              format={formatMinutes}
              tickUnit={60000}
              variant="line"
              accent={measureColor('timeOnTabs')}
              source="get_admin_reports.series.dwell"
              error={error}
            />
            <TrendChart
              title="Video stalls per day"
              windowLabel={WEEK}
              points={list(series.stalls)}
              format={formatCount}
              variant="columns"
              accent={measureColor('stalls')}
              source="get_admin_reports.series.stalls"
              error={error}
            />
          </div>
        </section>

        <section aria-labelledby="trends-week">
          <SectionHeading id="trends-week" level={2} title="This week against the prior week" hint="Only clips and gifts have a prior week in this read" />
          <div className="grid gap-6 lg:grid-cols-2">
            <CompareBars
              title="Clips, this week vs the prior week"
              subject="Clips uploaded"
              current={{ label: 'Last 7 days', value: clips7d }}
              previous={{ label: 'Prior 7 days', value: clipsPrev }}
              format={formatCount}
              accent={measureColor('clips')}
              source="get_admin_reports.engagement.clips_7d · clips_prev_7d"
              error={error}
            />
            <CompareBars
              title="Gifts, this week vs the prior week"
              subject="Gifts"
              current={{ label: 'Last 7 days', value: donations7d }}
              previous={{ label: 'Prior 7 days', value: donationsPrev }}
              format={formatUsd}
              accent={measureColor('donations')}
              source="get_admin_reports.money.malo_cents_7d · malo_cents_prev_7d"
              error={error}
            />
          </div>
        </section>

        <section aria-labelledby="trends-pace">
          <SectionHeading id="trends-pace" level={2} title="Last 24 hours against the 7-day daily average" hint="Rolling windows, UTC. The average is the 7-day total ÷ 7." />
          <div className="space-y-6">
            {paceGroups.map((group, index) => (
              <div key={index} className={`grid gap-6 ${group.length === 2 ? 'md:grid-cols-2' : 'lg:grid-cols-3'}`}>
                {group.map((row) => {
                  const average = perDay(row.week);
                  return (
                    <CompareBars
                      key={row.title}
                      title={`${row.title}, last 24 hours vs daily average`}
                      caption={PACE_CAPTION}
                      current={{ label: 'Last 24 hours', value: row.last }}
                      previous={{ label: '7-day daily average', value: average }}
                      format={row.format}
                      accent={row.accent}
                      sentence={paceSentence(row.title, row.last, average, row.format)}
                      source={`get_admin_reports · ${row.keys} ÷ 7`}
                      error={error}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="trends-mix">
          <SectionHeading id="trends-mix" level={2} title="Mix" hint="Parts of one whole, with shares that add to 100%" />
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <SplitBar
                title="Hype on live clips"
                caption="All time · Seki, Aura and Flex taps summed over clips that are not removed"
                totalLabel="All hype"
                format={formatCount}
                source="get_admin_reports.engagement.seki · aura · flex"
                error={error}
                parts={[
                  { label: 'Seki', value: n(engagement, 'seki'), color: measureColor('seki') },
                  { label: 'Aura', value: n(engagement, 'aura'), color: measureColor('aura') },
                  { label: 'Flex', value: n(engagement, 'flex'), color: measureColor('flex') },
                ]}
              />
              <SplitBar
                title="Live clips by category"
                caption="Clips not removed. A clip with no category counts as Game Day."
                totalLabel="Categorised clips"
                format={formatCount}
                source="get_admin_reports.content.game_play · train_like_me · serve_like_me"
                error={error}
                parts={[
                  { label: 'Game Day', value: n(content, 'game_play'), color: measureColor('gameDay') },
                  { label: 'Train Like Me', value: n(content, 'train_like_me'), color: measureColor('trainLikeMe') },
                  { label: 'Serve Like Me', value: n(content, 'serve_like_me'), color: measureColor('serveLikeMe') },
                ]}
              />
              <SplitBar
                title="Games"
                caption="Every game row, live or parked"
                totalLabel="All games"
                format={formatCount}
                source="get_admin_reports.live.live_games · parked_games"
                error={error}
                parts={[
                  { label: 'Live', value: n(live, 'live_games'), color: measureColor('live') },
                  { label: 'Parked', value: n(live, 'parked_games'), color: measureColor('parked') },
                ]}
              />
            </div>
            <Meter
              label="Verified profiles"
              part={n(audience, 'verified')}
              whole={n(audience, 'profiles')}
              format={formatCount}
              hint="Verified profiles of all profiles. A share of accounts, not of athletes."
              source="get_admin_reports.audience.verified ÷ profiles"
            />
          </div>
        </section>

        <section aria-labelledby="trends-rankings">
          <SectionHeading id="trends-rankings" level={2} title="Gift bands and top 5 lists" hint="All time. Gift bands are counts of athletes, no names." />
          <div className="grid gap-6 lg:grid-cols-3">
            <HBarList
              title={DONATION_BANDS_TITLE}
              caption="All time. Counts of athletes, no names."
              // Bands, not a ranking (owner decision 2026-10-12): fixed order, no rank numbers, no "leads" line.
              keepOrder
              rows={bandRows}
              format={formatCount}
              accent={measureColor('donations')}
              emptyText="No athletes have gifts yet."
              summary={bandsSummary}
              source="get_admin_reports.donation_bands · under_50 · 50_to_250 · 250_plus"
              error={error}
            />
            <HBarList
              title="Most-hyped clips"
              caption="All time · Seki + Aura + Flex on each live clip, top 5"
              rows={list(reports.leaders.hype)}
              format={formatCount}
              accent={measureColor('hype')}
              emptyText="No hype on live clips yet."
              source="get_admin_reports.leaders.hype"
              error={error}
            />
            <HBarList
              title="Schools by athletes listed"
              caption="Top 5 schools · player rows"
              rows={list(reports.leaders.schools)}
              format={formatCount}
              accent={measureColor('schools')}
              emptyText="No athletes on a school yet."
              source="get_admin_reports.leaders.schools"
              error={error}
            />
          </div>
        </section>

        <section aria-labelledby="trends-attention">
          <SectionHeading id="trends-attention" level={2} title="Where attention and friction go" hint="Last 7 days, plus bug reports still open" />
          <div className="grid gap-6 lg:grid-cols-2">
            <HBarList
              title="Time on each tab"
              caption="Last 7 days · total minutes on each tab"
              rows={list(reports.tabs)}
              format={formatMinutes}
              accent={measureColor('timeOnTabs')}
              emptyText="No tab visits in the last 7 days."
              source="get_admin_reports.tabs"
              error={error}
            />
            <HBarList
              title="Taps by control"
              caption="Last 7 days · taps on each tracked control"
              rows={named(reports.features, featureLabel)}
              format={formatCount}
              accent={measureColor('featureTaps')}
              emptyText="No feature taps in the last 7 days."
              source="get_admin_reports.features"
              error={error}
            />
            <HBarList
              title="Scroll depth by surface"
              caption="Average scroll sample per surface, 7 days. Not a share of people."
              rows={list(reports.scroll)}
              format={formatPercent}
              accent={measureColor('scrollDepth')}
              emptyText="No scroll samples in the last 7 days."
              source="get_admin_reports.scroll"
              error={error}
            />
            <HBarList
              title="UI issues and open bugs"
              caption="Last 7 days of UI issues, plus bug reports still open"
              rows={named(reports.issues, issueLabel)}
              format={formatCount}
              accent={measureColor('issues')}
              emptyText="No UI issues or open bugs."
              source="get_admin_reports.issues"
              error={error}
            />
          </div>
        </section>

        <section aria-labelledby="trends-counts">
          <SectionHeading id="trends-counts" level={2} title="Counts now" hint="Separate counts, not parts of one whole. Poll votes and fan actions are all time." />
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Panel title="Content on the shelf" kicker="Content" level={3}>
              <CountList rows={contentRows} />
            </Panel>
            <div className="grid gap-6">
              <Panel title="Local: polls, boosters and shop" kicker="Local" level={3}>
                {/* All four read as 0 means nothing yet. A key missing from the read still shows "—" below. */}
                {read && liveRows.every((row) => row.value === 0) ? (
                  <p className="text-sm text-[var(--text-muted)]">No Local counts yet.</p>
                ) : (
                  <CountList rows={liveRows} />
                )}
              </Panel>
              <Panel title="Fan actions" kicker="Fans" level={3}>
                <CountList rows={fanRows} />
              </Panel>
            </div>
          </div>
        </section>

        <section aria-labelledby="trends-reliability">
          <SectionHeading id="trends-reliability" level={2} title="Reliability · last 24 hours" hint="Playback and checkout friction" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Reconnects · 24h" value={formatCount(reconnects ?? 0)} missing={reconnects == null} hint="Live socket reconnect events" />
            <StatTile
              label="Checkout step timings · 24h"
              value={formatCount(checkouts ?? 0)}
              missing={checkouts == null}
              hint="Gift checkout steps that logged a time (intent, set-up, sheet, total)"
            />
            <StatTile
              label="Average checkout step · 24h"
              value={formatDuration(avgCheckout ?? 0)}
              missing={avgCheckout == null}
              hint="Mean across every logged checkout step, not one whole checkout"
            />
            <StatTile
              label="Open bug reports"
              value={formatCount(openBugs ?? 0)}
              missing={openBugs == null}
              tone={openBugs ? 'warn' : 'neutral'}
              hint="Bug reports not shipped or declined"
            />
          </div>
        </section>

        <section aria-labelledby="trends-unmeasured">
          <SectionHeading id="trends-unmeasured" level={2} title="Not measured" hint="Named so nobody reads a count as one of these rates" />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {UNMEASURED.map((item) => (
              <li key={item.name} className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-extrabold text-[var(--ink)]">{item.name}</span>
                  <span className="text-lg font-extrabold text-[var(--text-muted)]">
                    <Blank words="Not measured" />
                  </span>
                </p>
                <p className="mt-1 text-xs leading-4 text-[var(--text-muted)]">{item.why}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="trends-every">
          <SectionHeading id="trends-every" level={2} title="Every number" hint="Each section of the read, as returned" />
          {/* Eight panels of different heights: two balanced columns instead of a grid with one left over. */}
          <div className="gap-6 lg:columns-2 [&>*]:mb-6 [&>*]:break-inside-avoid">
            <Panel title="Gifts and payouts" kicker="Money" level={3}>
              <MetricList section={money} read={read} />
            </Panel>
            <Panel title="Engagement" kicker="Highlights ⚡" level={3}>
              <MetricList section={engagement} read={read} />
            </Panel>
            <Panel title="Audience" kicker="People" level={3}>
              <MetricList section={audience} read={read} />
            </Panel>
            <Panel title="Content" kicker="Vault + flags" level={3}>
              <MetricList section={content} read={read} />
            </Panel>
            <Panel title="Live ops" kicker="Local" level={3}>
              <MetricList section={live} read={read} />
            </Panel>
            <Panel title="Behavior" kicker="Usage" level={3}>
              <MetricList section={usage} read={read} />
            </Panel>
            <Panel title="Reliability" kicker="Playback + checkout" level={3}>
              <MetricList section={reliability} read={read} />
            </Panel>
            <Panel title={DONATION_BANDS_TITLE} kicker="Gift bands" level={3}>
              {read && !bands ? (
                <p className="text-sm text-[var(--text-muted)]">Not in this read. {DONATION_BANDS_MISSING_NOTE}</p>
              ) : (
                <CountList rows={bandRows ?? donationBandRows({ under50: null, from50to250: null, over250: null })} />
              )}
              <p className="mt-3 text-xs leading-4 text-[var(--text-muted)]">{REPORT_NOTES.donation_bands}</p>
            </Panel>
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
