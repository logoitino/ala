/**
 * Home (`/`) of the read-only admin portal: the executive dashboard. Eight measured tiles (only
 * donations and clips carry a prior-week delta), the four 7-day series as charts, the two real
 * prior-week comparisons, a week-at-a-glance heat strip, team trend sentences, the industry
 * measures this portal does not have, and department status. A missing key shows "—", never $0.00.
 * @sideEffects `get_admin_reports` and `get_company_revenue_summary`.
 */
import Link from 'next/link';

import { CompareBars, HeatStrip, StatTile, TrendChart, type ChartPoint } from '@/components/charts';
import { Badge, Panel, PortalShell, SectionHeading } from '@/components/PortalShell';
import {
  formatCompactCount,
  formatCompactUsd,
  formatCount,
  formatMinutes,
  homeKpis,
  readKey,
  teamTrends,
  UNMEASURED,
  type DashboardInput,
  type HomeKpiId,
} from '@/lib/dashboard';
import { managementDeskStatus } from '@/lib/departments';
import { fetchPortalReports, fetchPortalRevenue, formatUsd } from '@/lib/reports';
import { isAdminPortalConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const WEEK = 'Last 7 days, UTC';

function ReadBadge({ name, ok, configured }: { name: string; ok: boolean; configured: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] py-1 pr-1 pl-3 text-xs font-bold text-[var(--ink-soft)]">
      <code className="text-[11px]">{name}</code>
      <Badge tone={!configured ? 'neutral' : ok ? 'ok' : 'danger'}>{!configured ? 'Not connected' : ok ? 'Answered' : 'Failed'}</Badge>
    </span>
  );
}

/**
 * @purpose Home after sign-in: the measured week in tiles and charts, then what is not measured.
 */
export default async function AdminHomePage() {
  const configured = isAdminPortalConfigured();
  const [reports, revenue] = await Promise.all([fetchPortalReports(), fetchPortalRevenue()]);
  const reportsOk = reports.configured && !reports.error;
  const revenueOk = revenue.configured && !revenue.error;
  const key = (section: Record<string, number>, name: string) => readKey(section, name, reportsOk);

  const input: DashboardInput = {
    donations7dCents: key(reports.money, 'malo_cents_7d'),
    donationsPrev7dCents: key(reports.money, 'malo_cents_prev_7d'),
    donationCount7d: key(reports.money, 'malo_count_7d'),
    avgDonation7dCents: key(reports.money, 'avg_tip_cents_7d'),
    clips7d: key(reports.engagement, 'clips_7d'),
    clipsPrev7d: key(reports.engagement, 'clips_prev_7d'),
    sessions24h: key(reports.usage, 'sessions_24h'),
    dwellMs7d: key(reports.usage, 'dwell_ms_7d'),
    taps24h: key(reports.usage, 'taps_24h'),
    stalls24h: key(reports.reliability, 'stalls_24h'),
    flagged: key(reports.content, 'flagged'),
    openBugs: key(reports.usage, 'feedback_bugs_open'),
    grossCents: revenueOk ? revenue.gross_volume_cents : null,
    companyNetCents: revenueOk ? revenue.company_net_cents : null,
  };

  // A series that was not in this read is null (shows "Not in this read"), never a row of zeros.
  const series = (points: ChartPoint[] | null) => (reportsOk && points && points.length > 0 ? points : null);
  const malo = series(reports.series.malo);
  const clips = series(reports.series.clips);
  const dwell = series(reports.series.dwell);
  const stalls = series(reports.series.stalls);

  const sparks: Partial<Record<HomeKpiId, { points: ChartPoint[]; format: (value: number) => string; accent: 'jade' | 'gold' | 'bad' }>> = {
    donations: malo ? { points: malo, format: formatUsd, accent: 'jade' } : undefined,
    clips: clips ? { points: clips, format: formatCount, accent: 'jade' } : undefined,
    dwell: dwell ? { points: dwell, format: formatMinutes, accent: 'gold' } : undefined,
    stalls: stalls ? { points: stalls, format: formatCount, accent: 'bad' } : undefined,
  };

  const cards = homeKpis(input, formatUsd);
  const trends = teamTrends(input, reportsOk ? (reports.series.stalls ?? []) : [], formatUsd);
  const desks = managementDeskStatus({
    reportsError: reports.error,
    revenueError: revenue.error,
    donations7dCents: input.donations7dCents ?? 0,
    sessions24h: input.sessions24h ?? 0,
    issues24h: key(reports.usage, 'issues_24h') ?? 0,
    openBugs: input.openBugs ?? 0,
    stalls24h: input.stalls24h ?? 0,
    reconnects24h: key(reports.reliability, 'reconnects_24h') ?? 0,
  });

  return (
    <PortalShell active="/">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <ReadBadge name="get_admin_reports" ok={reportsOk} configured={reports.configured} />
        <ReadBadge name="get_company_revenue_summary" ok={revenueOk} configured={revenue.configured} />
        <span className="text-xs text-[var(--text-muted)]">
          {reports.generatedAt ? `Read at ${new Date(reports.generatedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC` : 'Waiting on a read'}
        </span>
      </div>

      {!configured || reports.error === 'Supabase env missing' ? (
        <div className="mb-6">
          <Panel title="Connect Supabase" kicker="Setup">
            <p className="text-sm leading-6 text-[var(--ink-soft)]">
              Copy <code className="rounded bg-[var(--jade-soft)] px-1.5">apps/admin-portal/.env.example</code> to{' '}
              <code className="rounded bg-[var(--jade-soft)] px-1.5">.env.local</code> with the same project URL and anon key as
              the mobile app. Then reload. Until then every number below reads “—”.
            </p>
          </Panel>
        </div>
      ) : null}

      {reports.error && reports.error !== 'Supabase env missing' ? (
        <p role="alert" className="mb-4 rounded-xl border border-[var(--ember)]/30 bg-[var(--ember-soft)] px-4 py-3 text-sm font-semibold text-[var(--ember)]">
          Reports did not load. {reports.error}
        </p>
      ) : null}
      {revenue.error && revenue.error !== 'Supabase env missing' ? (
        <p role="alert" className="mb-4 rounded-xl border border-[var(--ember)]/30 bg-[var(--ember-soft)] px-4 py-3 text-sm font-semibold text-[var(--ember)]">
          Revenue did not load. {revenue.error}
        </p>
      ) : null}

      <section aria-labelledby="home-kpis" className="mb-10">
        <SectionHeading id="home-kpis" level={2} title="Measured this week" hint="Counts are events, not people" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <StatTile
              key={card.id}
              label={card.label}
              value={card.value}
              hint={card.hint}
              tone={card.tone}
              missing={card.missing}
              delta={card.delta}
              goodDirection={card.goodDirection}
              spark={sparks[card.id]}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="home-donations" className="mb-10">
        <SectionHeading id="home-donations" level={2} title="Donations and clips" hint="The two measures with a prior week" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <TrendChart
              title="Donations"
              windowLabel={WEEK}
              points={malo}
              format={formatUsd}
              variant="area"
              accent="jade"
              source="get_admin_reports.series.malo"
              tickUnit={100}
              tickFormat={formatCompactUsd}
            />
          </div>
          <CompareBars
            title="Donations versus the prior week"
            subject="Donations"
            current={{ label: 'Last 7 days', value: input.donations7dCents }}
            previous={{ label: 'Prior 7 days', value: input.donationsPrev7dCents }}
            format={formatUsd}
            accent="jade"
            source="get_admin_reports.money.malo_cents_7d · malo_cents_prev_7d"
          />
          <div className="min-w-0 lg:col-span-2">
            <TrendChart
              title="Clips uploaded"
              windowLabel={WEEK}
              points={clips}
              format={formatCount}
              variant="columns"
              accent="jade"
              source="get_admin_reports.series.clips"
              tickFormat={formatCompactCount}
            />
          </div>
          <CompareBars
            title="Clips versus the prior week"
            subject="Clips uploaded"
            current={{ label: 'Last 7 days', value: input.clips7d }}
            previous={{ label: 'Prior 7 days', value: input.clipsPrev7d }}
            format={formatCount}
            accent="jade"
            source="get_admin_reports.engagement.clips_7d · clips_prev_7d"
          />
        </div>
      </section>

      <section aria-labelledby="home-attention" className="mb-10">
        <SectionHeading id="home-attention" level={2} title="Attention and playback" hint="No prior week for these, so no change percent" />
        <div className="grid gap-4 lg:grid-cols-2">
          <TrendChart
            title="Time on tabs"
            windowLabel={WEEK}
            points={dwell}
            format={formatMinutes}
            variant="line"
            accent="gold"
            source="get_admin_reports.series.dwell"
            tickUnit={60000}
          />
          <TrendChart
            title="Video stalls"
            windowLabel={WEEK}
            points={stalls}
            format={formatCount}
            variant="columns"
            accent="bad"
            source="get_admin_reports.series.stalls"
            tickFormat={formatCompactCount}
          />
        </div>
      </section>

      <section aria-label="Week at a glance" className="mb-10">
        <HeatStrip
          title="Week at a glance"
          caption="Each row is shaded against its own busiest day. The outlined cell is the peak."
          source="get_admin_reports.series.malo · clips · dwell · stalls"
          rows={[
            { label: 'Donations', points: malo ?? [], format: formatUsd, accent: 'jade' },
            { label: 'Clips uploaded', points: clips ?? [], format: formatCount, accent: 'cyan' },
            { label: 'Time on tabs', points: dwell ?? [], format: formatMinutes, accent: 'gold' },
            { label: 'Video stalls', points: stalls ?? [], format: formatCount, accent: 'bad' },
          ]}
        />
      </section>

      <div className="mb-10 grid gap-4 lg:grid-cols-2">
        <Panel title="How the team is moving" kicker="Versus the prior week">
          <ul className="space-y-2">
            {trends.map((line) => (
              <li key={line} className="flex gap-2 text-sm leading-6 text-[var(--ink)]">
                <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[var(--jade)]" />
                {line}
              </li>
            ))}
          </ul>
          <p className="text-sm text-[var(--ink-soft)]">
            Detail is on{' '}
            <Link href="/analytics" className="font-extrabold text-[var(--jade)] underline-offset-2 hover:underline">
              Analytics
            </Link>
            ,{' '}
            <Link href="/reports" className="font-extrabold text-[var(--jade)] underline-offset-2 hover:underline">
              Trends
            </Link>
            ,{' '}
            <Link href="/audience" className="font-extrabold text-[var(--jade)] underline-offset-2 hover:underline">
              Audience
            </Link>
            , and{' '}
            <Link href="/money" className="font-extrabold text-[var(--jade)] underline-offset-2 hover:underline">
              Revenue
            </Link>
            .
          </p>
        </Panel>
        <Panel title="Not measured" kicker="Do not treat a blank as a result">
          <ul className="grid gap-3 sm:grid-cols-2">
            {UNMEASURED.map((gap) => (
              <li key={gap.name} className="rounded-xl border border-dashed border-[var(--border)] p-3">
                <p className="flex items-baseline justify-between gap-2 text-sm font-extrabold">
                  {gap.name}
                  <span className="text-[var(--text-muted)]" aria-label="No value">
                    —
                  </span>
                </p>
                <p className="mt-1 text-sm leading-5 text-[var(--ink-soft)]">{gap.why}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <section aria-labelledby="home-departments">
        <SectionHeading id="home-departments" level={2} title="Departments" hint="Status only" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {desks.map((desk) => (
            <Link key={desk.id} href={`/manage#${desk.id}`} className="block rounded-2xl transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              <StatTile
                label={desk.title}
                value={desk.tone === 'danger' ? 'Failed' : desk.tone === 'warn' ? 'Look' : 'Clear'}
                hint={desk.status}
                tone={desk.tone === 'ok' ? 'ok' : desk.tone === 'warn' ? 'warn' : 'danger'}
              />
            </Link>
          ))}
        </div>
      </section>
    </PortalShell>
  );
}
