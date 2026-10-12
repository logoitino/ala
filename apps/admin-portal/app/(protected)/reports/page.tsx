import Link from 'next/link';

import {
  CompareBars,
  HBarList,
  HeatStrip,
  Meter,
  SplitBar,
  StatTile,
  TrendChart,
  type ChartPoint,
} from '@/components/charts';
import { Panel, PortalShell, SectionHeading } from '@/components/PortalShell';
import { tapsPerOpen, UNMEASURED } from '@/lib/dashboard';
import {
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

const WEEK = 'Last 7 days, UTC';
const PACE_CAPTION = 'The 24 hours are inside the 7 days. This is pace, not growth.';

function MetricList({ section }: { section: ReportSection }) {
  const rows = Object.entries(section);
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No samples in this window yet.</p>;
  }
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <dt className="text-sm text-[var(--ink-soft)]">{labelForReportKey(key)}</dt>
          <dd className="chart-tabular shrink-0 text-sm font-extrabold">{formatReportValue(key, value)}</dd>
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
 *   week-over-week word: the 24 hours sit inside the 7 days, so this is pace only.
 */
function paceSentence(subject: string, last24h: number | null, average: number | null, format: (n: number) => string): string {
  if (last24h == null || average == null) return `${subject}: one side of this comparison is not in this read.`;
  if (last24h === 0 && average === 0) return `${subject}: none in the last 24 hours or the last 7 days.`;
  const gap = Math.abs(last24h - average);
  const level = gap <= Math.max(average, last24h) * 0.05;
  const word = level ? 'about level with' : last24h > average ? 'above' : 'below';
  return `${subject}: ${format(last24h)} in the last 24 hours, ${word} the 7-day daily average of ${format(average)}.`;
}

/**
 * @purpose Web Trends desk (`/reports`). Every 7-day series, every prior-week pair, the 24-hour pace
 *   against the 7-day daily average, every ranked list and every section count from `get_admin_reports`,
 *   drawn with the shared chart kit. Missing keys show "—", never 0. Unmeasured rates stay named and blank.
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
  const days = (rows: ReportLeader[] | null): ChartPoint[] => (read && rows ? rows : []);

  const donations7d = n(money, 'malo_cents_7d');
  const donationsPrev = n(money, 'malo_cents_prev_7d');
  const clips7d = n(engagement, 'clips_7d');
  const clipsPrev = n(engagement, 'clips_prev_7d');
  const dwell7d = n(usage, 'dwell_ms_7d');
  const stalls24h = n(reliability, 'stalls_24h');
  const sessions24h = n(usage, 'sessions_24h');
  const taps24h = n(usage, 'taps_24h');
  const issues24h = n(usage, 'issues_24h');
  const avgDonation = n(money, 'avg_tip_cents_7d');
  const perOpen = taps24h != null && sessions24h != null ? tapsPerOpen(taps24h, sessions24h) : null;

  const pace = [
    { title: 'Clips uploaded', last: n(engagement, 'clips_24h'), week: clips7d, format: formatCount, accent: 'cyan' as const, keys: 'clips_24h · clips_7d' },
    { title: 'Donations', last: n(money, 'malo_cents_24h'), week: donations7d, format: formatUsd, accent: 'jade' as const, keys: 'malo_cents_24h · malo_cents_7d' },
    { title: 'Feature taps', last: taps24h, week: n(usage, 'taps_7d'), format: formatCount, accent: 'violet' as const, keys: 'taps_24h · taps_7d' },
    { title: 'Control issues', last: issues24h, week: n(usage, 'issues_7d'), format: formatCount, accent: 'bad' as const, keys: 'issues_24h · issues_7d' },
    { title: 'Time on tabs', last: n(usage, 'dwell_ms_24h'), week: dwell7d, format: formatMinutes, accent: 'gold' as const, keys: 'dwell_ms_24h · dwell_ms_7d' },
  ];

  const contentRows: ChartPoint[] = (['flagged', 'removed', 'vault', 'exclusive_clips', 'flash_live', 'spotlight_live', 'qna'] as const).map((key) => ({
    label: labelForReportKey(key),
    value: n(content, key),
  }));
  const liveRows: ChartPoint[] = (['poll_votes', 'active_polls', 'active_boosters', 'drip_skus'] as const).map((key) => ({
    label: labelForReportKey(key),
    value: n(live, key),
  }));
  const reachRows: ChartPoint[] = (['hype_votes', 'saves', 'crew_follows'] as const).map((key) => ({
    label: labelForReportKey(key),
    value: n(engagement, key),
  }));

  return (
    <PortalShell active="/reports">
      <div className="mb-6">
        <div className="min-w-0">
          <p className="max-w-3xl text-sm text-[var(--text-muted)]">
            Every 7-day series, ranking and count in <code className="rounded bg-[var(--jade-soft)] px-1.5">get_admin_reports</code>, the
            same read as Expo <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin/reports</code>. Days are UTC.{' '}
            {reports.generatedAt ? <>Generated {new Date(reports.generatedAt).toLocaleString()}. </> : null}
            Ledger detail is on{' '}
            <Link href="/money" className="font-extrabold text-[var(--jade)]">
              Revenue →
            </Link>
          </p>
        </div>
      </div>

      {!reports.configured ? (
        <div className="mb-8 rounded-xl border border-dashed border-[var(--border)] px-4 py-3 text-sm text-[var(--text-muted)]">
          Supabase is not set up in this environment, so nothing was read. Every number below shows “—”.
        </div>
      ) : null}
      {error ? (
        <Panel title="Could not load reports" kicker="RPC">
          <p className="rounded-xl border border-[var(--ember)]/30 bg-[var(--ember-soft)] px-4 py-3 text-sm font-semibold text-[var(--ember)]">
            {error}. Needs <code>get_admin_reports</code> (run <code>supabase/admin_reports.sql</code> + <code>supabase/usage_reports.sql</code>).
          </p>
        </Panel>
      ) : null}

      <div className="space-y-10">
        <section aria-labelledby="trends-headline">
          <h2 id="trends-headline" className="sr-only">
            Headline numbers
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Donations · 7d"
              value={formatUsd(donations7d ?? 0)}
              missing={donations7d == null}
              delta={donations7d != null && donationsPrev != null ? { current: donations7d, previous: donationsPrev } : null}
              spark={{ points: days(series.malo), format: formatUsd, accent: 'jade' }}
              hint="Donations recorded in the last 7 days"
            />
            <StatTile
              label="Clips uploaded · 7d"
              value={formatCount(clips7d ?? 0)}
              missing={clips7d == null}
              delta={clips7d != null && clipsPrev != null ? { current: clips7d, previous: clipsPrev } : null}
              spark={{ points: days(series.clips), format: formatCount, accent: 'cyan' }}
              hint="New Highlights in the last 7 days"
            />
            <StatTile
              label="Time on tabs · 7d"
              value={formatMinutes(dwell7d ?? 0)}
              missing={dwell7d == null}
              spark={{ points: days(series.dwell), format: formatMinutes, accent: 'gold' }}
              hint="Summed tab visits. Not per person."
            />
            <StatTile
              label="Video stalls · 24h"
              value={formatCount(stalls24h ?? 0)}
              missing={stalls24h == null}
              tone={stalls24h ? 'warn' : 'neutral'}
              goodDirection="down"
              spark={{ points: days(series.stalls), format: formatCount, accent: 'bad' }}
              hint="Playback stall events. Fewer is better."
            />
            <StatTile
              label="Tab opens · 24h"
              value={formatCount(sessions24h ?? 0)}
              missing={sessions24h == null}
              hint="Tab visit events. One person can open a tab many times."
            />
            <StatTile label="Feature taps · 24h" value={formatCount(taps24h ?? 0)} missing={taps24h == null} hint="Taps on tracked controls" />
            <StatTile
              label="Taps per tab open · 24h"
              value={perOpen == null ? '—' : formatCount(perOpen)}
              missing={perOpen == null}
              hint="Feature taps ÷ tab opens. Events, not people."
            />
            <StatTile
              label="Average donation · 7d"
              value={formatUsd(avgDonation ?? 0)}
              missing={avgDonation == null}
              hint="Mean amount per donation in the last 7 days"
            />
          </div>
        </section>

        <section>
          <SectionHeading title="Week at a glance" hint="Each row is shaded against its own busiest day" />
          <HeatStrip
            title="Four daily series"
            caption={WEEK}
            source="get_admin_reports.series.{malo,clips,dwell,stalls}"
            error={error}
            rows={[
              { label: 'Donations', points: days(series.malo), format: formatUsd, accent: 'jade' },
              { label: 'Clips uploaded', points: days(series.clips), format: formatCount, accent: 'cyan' },
              { label: 'Time on tabs', points: days(series.dwell), format: formatMinutes, accent: 'gold' },
              { label: 'Video stalls', points: days(series.stalls), format: formatCount, accent: 'bad' },
            ]}
          />
        </section>

        <section>
          <SectionHeading title="Daily trends" hint="One point per UTC day" />
          <div className="grid gap-6 lg:grid-cols-2">
            <TrendChart
              title="Donations"
              windowLabel={WEEK}
              points={list(series.malo)}
              format={formatUsd}
              tickFormat={formatUsdWhole}
              tickUnit={100}
              variant="area"
              accent="jade"
              source="get_admin_reports.series.malo"
              error={error}
            />
            <TrendChart
              title="Clips uploaded"
              windowLabel={WEEK}
              points={list(series.clips)}
              format={formatCount}
              variant="columns"
              accent="cyan"
              source="get_admin_reports.series.clips"
              error={error}
            />
            <TrendChart
              title="Time on tabs"
              windowLabel={WEEK}
              points={list(series.dwell)}
              format={formatMinutes}
              tickUnit={60000}
              variant="line"
              accent="gold"
              source="get_admin_reports.series.dwell"
              error={error}
            />
            <TrendChart
              title="Video stalls"
              windowLabel={WEEK}
              points={list(series.stalls)}
              format={formatCount}
              variant="columns"
              accent="bad"
              source="get_admin_reports.series.stalls"
              error={error}
            />
          </div>
        </section>

        <section>
          <SectionHeading title="This week against the prior week" hint="Only clips and donations have a prior week in this read" />
          <div className="grid gap-6 lg:grid-cols-2">
            <CompareBars
              title="Clips uploaded"
              subject="Clips uploaded"
              current={{ label: 'Last 7 days', value: clips7d }}
              previous={{ label: 'Prior 7 days', value: clipsPrev }}
              format={formatCount}
              accent="cyan"
              source="get_admin_reports.engagement.clips_7d · clips_prev_7d"
              error={error}
            />
            <CompareBars
              title="Donations"
              subject="Donations"
              current={{ label: 'Last 7 days', value: donations7d }}
              previous={{ label: 'Prior 7 days', value: donationsPrev }}
              format={formatUsd}
              accent="jade"
              source="get_admin_reports.money.malo_cents_7d · malo_cents_prev_7d"
              error={error}
            />
          </div>
        </section>

        <section>
          <SectionHeading title="Last 24 hours against the 7-day daily average" hint="Rolling windows, UTC. The average is the 7-day total ÷ 7." />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {pace.map((row) => {
              const average = perDay(row.week);
              return (
                <CompareBars
                  key={row.title}
                  title={row.title}
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
        </section>

        <section>
          <SectionHeading title="Mix" hint="Parts of one whole, with shares that add to 100%" />
          <div className="grid gap-6 lg:grid-cols-2">
            <SplitBar
              title="Hype on live clips"
              caption="All time · Seki, Aura and Flex taps summed over clips that are not removed"
              totalLabel="All hype"
              format={formatCount}
              source="get_admin_reports.engagement.seki · aura · flex"
              error={error}
              parts={[
                { label: 'Seki', value: n(engagement, 'seki'), color: 'jade' },
                { label: 'Aura', value: n(engagement, 'aura'), color: 'violet' },
                { label: 'Flex', value: n(engagement, 'flex'), color: 'gold' },
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
                { label: 'Game Day', value: n(content, 'game_play'), color: 'jade' },
                { label: 'Train Like Me', value: n(content, 'train_like_me'), color: 'cyan' },
                { label: 'Serve Like Me', value: n(content, 'serve_like_me'), color: 'violet' },
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
                { label: 'Live', value: n(live, 'live_games'), color: 'jade' },
                { label: 'Parked', value: n(live, 'parked_games'), color: 'muted' },
              ]}
            />
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

        <section>
          <SectionHeading title="Rankings" hint="Who and what leads each list" />
          <div className="grid gap-6 lg:grid-cols-3">
            <HBarList
              title="Athletes by donations"
              caption="All time · top 5 athletes by total donated"
              rows={list(reports.leaders.malo)}
              format={formatUsd}
              accent="jade"
              emptyText="No donations recorded yet."
              source="get_admin_reports.leaders.malo"
              error={error}
            />
            <HBarList
              title="Most-hyped clips"
              caption="All time · Seki + Aura + Flex on each live clip, top 5"
              rows={list(reports.leaders.hype)}
              format={formatCount}
              accent="violet"
              emptyText="No hype on live clips yet."
              source="get_admin_reports.leaders.hype"
              error={error}
            />
            <HBarList
              title="Athletes by school"
              caption="All athletes · top 5 schools by roster rows"
              rows={list(reports.leaders.schools)}
              format={formatCount}
              accent="cyan"
              emptyText="No athletes on a school yet."
              source="get_admin_reports.leaders.schools"
              error={error}
            />
            <HBarList
              title="Time on tabs"
              caption="Last 7 days · total minutes on each tab"
              rows={list(reports.tabs)}
              format={formatMinutes}
              accent="gold"
              emptyText="No tab visits in the last 7 days."
              source="get_admin_reports.tabs"
              error={error}
            />
            <HBarList
              title="Feature taps"
              caption="Last 7 days · taps on each tracked control"
              rows={list(reports.features)}
              format={formatCount}
              accent="violet"
              emptyText="No feature taps in the last 7 days."
              source="get_admin_reports.features"
              error={error}
            />
            <HBarList
              title="Scroll depth"
              caption="Average scroll sample per surface, 7 days. Not a share of people."
              rows={list(reports.scroll)}
              format={formatPercent}
              accent="cyan"
              emptyText="No scroll samples in the last 7 days."
              source="get_admin_reports.scroll"
              error={error}
            />
            <HBarList
              title="Control issues and open bugs"
              caption="Last 7 days of control issues, plus bug reports still open"
              rows={list(reports.issues)}
              format={formatCount}
              accent="bad"
              emptyText="No control issues or open bugs."
              source="get_admin_reports.issues"
              error={error}
            />
            <HBarList
              title="Content on the shelf"
              caption="Counts now. Not parts of one whole."
              rows={read ? contentRows : null}
              format={formatCount}
              accent="cyan"
              limit={7}
              keepOrder
              emptyText="No content counts."
              source="get_admin_reports.content"
              error={error}
            />
            <HBarList
              title="Game day and Local"
              caption="Counts now. Poll votes are all time."
              rows={read ? liveRows : null}
              format={formatCount}
              accent="jade"
              keepOrder
              emptyText="No Local counts."
              source="get_admin_reports.live"
              error={error}
            />
            <HBarList
              title="Fan actions"
              caption="All time · hype votes, saved clips and crew follows"
              rows={read ? reachRows : null}
              format={formatCount}
              accent="violet"
              keepOrder
              emptyText="No fan actions yet."
              source="get_admin_reports.engagement"
              error={error}
            />
          </div>
        </section>

        <section>
          <SectionHeading title="Reliability · last 24 hours" hint="Playback and checkout friction" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Reconnects · 24h"
              value={formatCount(n(reliability, 'reconnects_24h') ?? 0)}
              missing={n(reliability, 'reconnects_24h') == null}
              hint="Live socket reconnect events"
            />
            <StatTile
              label="Checkout step timings · 24h"
              value={formatCount(n(reliability, 'checkouts_24h') ?? 0)}
              missing={n(reliability, 'checkouts_24h') == null}
              hint="Donation checkout steps that logged a time (intent, set-up, sheet, total)"
            />
            <StatTile
              label="Average checkout step · 24h"
              value={formatDuration(n(reliability, 'avg_checkout_ms_24h') ?? 0)}
              missing={n(reliability, 'avg_checkout_ms_24h') == null}
              hint="Mean across every logged checkout step, not one whole checkout"
            />
            <StatTile
              label="Open bug reports"
              value={formatCount(n(usage, 'feedback_bugs_open') ?? 0)}
              missing={n(usage, 'feedback_bugs_open') == null}
              tone={n(usage, 'feedback_bugs_open') ? 'warn' : 'neutral'}
              hint="Bug reports not shipped or declined"
            />
          </div>
        </section>

        <section>
          <SectionHeading title="Not measured" hint="Named so nobody reads a count as one of these rates" />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {UNMEASURED.map((item) => (
              <li key={item.name} className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-extrabold text-[var(--ink)]">{item.name}</span>
                  <span className="text-lg font-extrabold text-[var(--text-muted)]" aria-label="Not measured">
                    —
                  </span>
                </p>
                <p className="mt-1 text-xs leading-4 text-[var(--text-muted)]">{item.why}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionHeading title="Every number" hint="Each section of the read, as returned" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Donations and payouts" kicker="Money">
              <MetricList section={money} />
            </Panel>
            <Panel title="Engagement" kicker="Highlights ⚡">
              <MetricList section={engagement} />
            </Panel>
            <Panel title="Audience" kicker="People">
              <MetricList section={audience} />
            </Panel>
            <Panel title="Content" kicker="Vault + flags">
              <MetricList section={content} />
            </Panel>
            <Panel title="Live ops" kicker="Local">
              <MetricList section={live} />
            </Panel>
            <Panel title="Behavior" kicker="Usage">
              <MetricList section={usage} />
            </Panel>
            <Panel title="Reliability" kicker="Playback + checkout">
              <MetricList section={reliability} />
            </Panel>
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
