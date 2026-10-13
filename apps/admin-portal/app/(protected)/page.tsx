/**
 * Home (`/`) of the read-only admin portal: the selected community report. Donations lead an
 * open typographic overview, followed by wide jade donation and compact cyan clip charts.
 * All eight KPI meanings remain; only donations and clips carry a prior-week delta. Other
 * measures follow the primary stories, with a week-at-a-glance heat strip, team trend sentences, the industry
 * measures this portal does not have, and department status. A missing key shows "—", never $0.00.
 * Chart colours come from `lib/measureColors.ts` (clips are cyan here as on every page). Cards in a
 * shared row keep their own height (`items-start`) instead of stretching to the tallest neighbour.
 * A failed reports read leaves desk counts null, so Billing never says "No donations in 7 days".
 * In the "Not measured" list the dash reads "Not measured" to a screen reader: those rates are never
 * measured, so "Not in this read" (used for a missing key on Trends and Analytics) would be wrong.
 * Codex Home fixes (2026-10-12): the setup panel and read alerts follow the single h1, so the
 * outline starts with it. Numbers never split mid-figure (`whitespace-nowrap`; prose uses
 * `break-words`). Clip sentences pluralise and say "not in this read" in words; a week change
 * that has no percent shows a dash in the large slot and its sentence on the small line.
 * Overview labels come from `homeKpis`. The overview grid is Tailwind on this page; the only
 * Home rules left in globals.css are `.community-chart` title colour and Data spacing, by class.
 * The 24h Video stalls value uses the stalls colour (`measureColor('stalls')`, red) when there
 * were stalls, matching the stalls chart and heat strip (VISUAL_QA P3, 2026-10-12).
 * @sideEffects `get_admin_reports` and `get_company_revenue_summary`.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

import { chartColor, HeatStrip, StatTile, TrendChart, type ChartPoint } from '@/components/charts';
import { Badge, Panel, PortalShell, SectionHeading } from '@/components/PortalShell';
import {
  formatCompactCount,
  formatCompactUsd,
  formatCount,
  formatMinutes,
  homeKpis,
  isMeasured,
  readKey,
  teamTrends,
  UNMEASURED,
  weekChange,
  type DashboardInput,
  type HomeKpi,
} from '@/lib/dashboard';
import { deskLabel, managementDeskStatus } from '@/lib/departments';
import { measureColor } from '@/lib/measureColors';
import { fetchPortalReports, fetchPortalRevenue, formatUsd } from '@/lib/reports';
import { isAdminPortalConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Home' };

const WEEK = 'Last 7 days, UTC';

/** Keep a missing number audible while the visible report uses a quiet dash. */
function MetricValue({ card }: { card: HomeKpi }) {
  return card.value === '—' ? <><span aria-hidden="true">—</span><span className="sr-only">{card.missing ? 'Not in this read' : card.hint}</span></> : <>{card.value}</>;
}

/** Only the two existing comparable measures reach this component; no new comparison math. */
function WeeklyChange({ card, compact = false }: { card: HomeKpi; compact?: boolean }) {
  if (!card.delta) return <>Comparison not in this read</>;
  const change = weekChange(card.delta.current, card.delta.previous);
  if (change.percent === null) return <>Prior week was zero; no percent comparison</>;
  if (change.tone === 'flat') return <>{compact ? 'Flat' : 'Flat versus the prior week'}</>;
  return <>{change.percent > 0 ? '+' : '−'}{Math.abs(change.percent)}%{compact ? '' : ' versus the prior week'}</>;
}

/** "Last 7 days: 1 clip." — one sentence, so a screen reader never hears "Not in this read clips". */
function clipSentence(window: string, count: number | null): string {
  return isMeasured(count) ? `${window}: ${formatCount(count)} ${count === 1 ? 'clip' : 'clips'}.` : `${window}: not in this read.`;
}

function ReadBadge({ name, ok, configured }: { name: string; ok: boolean; configured: boolean }) {
  // Long source identifiers must fit when the disclosure opens with enlarged text.
  return (
    <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] py-1 pr-1 pl-3 text-xs font-bold text-[var(--ink-soft)]">
      <code className="min-w-0 max-w-full text-[11px] break-words">{name}</code>
      <Badge tone={!configured ? 'neutral' : ok ? 'ok' : 'danger'}>{!configured ? 'Not connected' : ok ? 'Answered' : 'Failed'}</Badge>
    </span>
  );
}

/**
 * @purpose Home after sign-in: a community support report, then operational context and unmeasured rates.
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

  const DONATIONS = measureColor('donations');
  const CLIPS = measureColor('clips');
  const TIME = measureColor('timeOnTabs');
  const STALLS = measureColor('stalls');

  const cards = homeKpis(input, formatUsd);
  const donationCard = cards.find((card) => card.id === 'donations')!;
  const clipCard = cards.find((card) => card.id === 'clips')!;
  // Only a prior week above zero gives a percent; otherwise the large slot shows a dash.
  const clipPercent = clipCard.delta ? weekChange(clipCard.delta.current, clipCard.delta.previous).percent !== null : false;
  const overviewCards = cards.filter((card) => ['avgDonation', 'clips', 'opens'].includes(card.id));
  const operationalCards = cards.filter((card) => ['dwell', 'tapsPerOpen', 'stalls', 'platformShare'].includes(card.id));
  const trends = teamTrends(input, reportsOk ? (reports.series.stalls ?? []) : [], formatUsd);
  // Counts stay null when the reports read failed or a key is absent (QA #2): "not read", never 0.
  const desks = managementDeskStatus({
    reportsError: reports.error,
    revenueError: revenue.error,
    donations7dCents: input.donations7dCents,
    sessions24h: input.sessions24h,
    issues24h: key(reports.usage, 'issues_24h'),
    openBugs: input.openBugs,
    stalls24h: input.stalls24h,
    reconnects24h: key(reports.reliability, 'reconnects_24h'),
  });

  return (
    <PortalShell active="/" presentation="report" heading={null}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
        <p className="font-bold tracking-[0.14em] text-[var(--jade)] uppercase">Community report · Last 7 days</p>
        <p>{reports.generatedAt ? `Read ${new Date(reports.generatedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC` : 'Waiting on a read'}</p>
      </div>

      <section aria-labelledby="community-title" className="mb-6 grid grid-cols-1 gap-7 border-b border-[var(--border)] pb-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-end xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.15fr)_auto] xl:items-center xl:gap-8">
        <div className="min-w-0">
          <h1 id="community-title" className="max-w-2xl text-3xl leading-[1.12] font-extrabold tracking-tight break-words sm:text-[34px] xl:text-[36px]">A week of community support.</h1>
          <p className="chart-tabular mt-3 text-[length:min(3.75rem,13vw)] leading-tight font-extrabold tracking-[-0.045em] whitespace-nowrap text-[var(--jade)]">
            <MetricValue card={donationCard} />
          </p>
          <p className="mt-1 text-base font-bold break-words text-[var(--ink)]">
            {isMeasured(input.donationCount7d) ? `${formatCount(input.donationCount7d)} ${input.donationCount7d === 1 ? 'donation' : 'donations'} recorded` : 'Donation count not in this read'}
            <span className="mt-1 block text-xs font-normal text-[var(--jade)] sm:mt-0 sm:inline"> · <WeeklyChange card={donationCard} /></span>
          </p>
        </div>
        <dl className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-x-6 gap-y-6">
          {overviewCards.map((card) => (
            <div key={card.id} className="min-w-0 border-l border-[var(--border)] pl-4">
              <dt className="text-xs font-bold break-words text-[var(--ink-soft)]">{card.label}</dt>
              <dd className={`chart-tabular mt-2 text-2xl font-extrabold tracking-tight whitespace-nowrap ${card.id === 'clips' ? 'text-[var(--cyan)]' : 'text-[var(--ink)]'}`}><MetricValue card={card} /></dd>
              <dd className="mt-2 text-xs leading-5 break-words text-[var(--text-muted)]">{card.id === 'clips' ? <WeeklyChange card={card} /> : card.id === 'opens' ? 'Events, not distinct people' : card.hint}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col items-start gap-3 lg:col-start-2 xl:col-start-auto">
          <Link href="/reports" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--jade)] px-6 text-sm font-extrabold text-white hover:bg-[var(--jade)]/90">View Trends</Link>
          <p className="text-xs text-[var(--text-muted)]">Follow the week in detail.</p>
        </div>
      </section>

      {/* Setup and failed-read notices follow Home's single h1 so the outline starts with it. */}
      {!configured || reports.error === 'Supabase env missing' ? (
        <div className="mb-6">
          <Panel title="Connect Supabase" kicker="Setup">
            <p className="text-sm leading-6 text-[var(--ink-soft)]">
              Copy <code className="rounded bg-[var(--jade-soft)] px-1.5">apps/admin-portal/.env.example</code> to{' '}
              <code className="rounded bg-[var(--jade-soft)] px-1.5">.env.local</code> with the same project URL and anon key as
              the mobile app. Then reload. Until then every number on this page reads “—”.
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

      <section className="community-chart mb-4 text-[var(--jade)]">
            <TrendChart
              title="Donations"
              windowLabel={WEEK}
              points={malo}
              format={formatUsd}
              variant="area"
              accent={DONATIONS}
              source="get_admin_reports.series.malo"
              tickUnit={100}
              tickFormat={formatCompactUsd}
              presentation="report"
              plotHeight={144}
              annotatePeak
              total="none"
            />
      </section>

      <section className="community-chart mb-4 grid items-start gap-6 text-[var(--cyan)] lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0">
            <TrendChart
              title="Clips"
              windowLabel={WEEK}
              points={clips}
              format={formatCount}
              variant="columns"
              accent={CLIPS}
              source="get_admin_reports.series.clips"
              tickFormat={formatCompactCount}
              presentation="report"
              plotHeight={80}
              total="none"
            />
        </div>
        <div className="min-w-0 border-l border-[var(--border)] pl-5 lg:mt-6">
          {/* The large slot holds a figure only. A change with no percent shows a dash here and its sentence below. */}
          <p className="chart-tabular text-2xl font-extrabold tracking-tight whitespace-nowrap">
            {clipPercent ? <WeeklyChange card={clipCard} compact /> : <><span aria-hidden="true">—</span><span className="sr-only">No percent change.</span></>}
          </p>
          <p className="mt-1 text-sm font-bold break-words text-[var(--ink)]">{clipPercent ? 'versus the prior week' : <WeeklyChange card={clipCard} />}</p>
          <p className="mt-3 text-sm leading-5 break-words text-[var(--text-muted)]">{clipSentence('Prior 7 days', input.clipsPrev7d)}<br />{clipSentence('Last 7 days', input.clips7d)}</p>
        </div>
      </section>

      <div className="mb-10 flex flex-wrap items-start gap-x-6 gap-y-2 border-l-2 border-[var(--jade)] pl-4 text-sm leading-5 text-[var(--ink-soft)]">
        <p className="pt-0.5 text-[11px] font-bold tracking-[0.14em] text-[var(--jade)] uppercase">At a glance</p>
        <p className="break-words">{isMeasured(input.donations7dCents) && isMeasured(input.clips7d) ? `${formatUsd(input.donations7dCents)} in recorded donations and ${formatCount(input.clips7d)} ${input.clips7d === 1 ? 'clip' : 'clips'} uploaded over the last 7 days.` : 'One or more weekly totals were not in this read.'}</p>
      </div>

      <section aria-labelledby="home-kpis" className="mb-10">
        <SectionHeading id="home-kpis" level={2} title="The rest of the picture" hint="Recorded measures, without a prior-week change" />
        <dl className="grid gap-x-8 gap-y-6 border-b border-[var(--border)] pb-6 sm:grid-cols-2 lg:grid-cols-4">
          {operationalCards.map((card) => (
            <div key={card.id} className="min-w-0">
              <dt className="text-xs font-bold text-[var(--ink-soft)]">{card.label}</dt>
              {/* Stalls above zero take the stalls measure colour (red), never gold; other values stay ink. */}
              <dd
                className={`chart-tabular mt-2 text-2xl font-extrabold tracking-tight whitespace-nowrap ${card.tone === 'warn' && card.id !== 'stalls' ? 'text-[var(--gold)]' : 'text-[var(--ink)]'}`}
                style={card.id === 'stalls' && card.tone === 'warn' ? { color: chartColor(STALLS) } : undefined}
              >
                <MetricValue card={card} />
              </dd>
              <dd className="mt-2 text-sm leading-5 text-[var(--text-muted)]">{card.missing ? 'Not in this read' : card.hint}</dd>
            </div>
          ))}
        </dl>
      </section>

      <details className="mb-10 text-xs text-[var(--text-muted)]">
        <summary className="min-h-10 cursor-pointer list-item rounded-md px-2 py-2.5 font-bold hover:bg-[var(--surface-muted)]">Data sources</summary>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ReadBadge name="get_admin_reports" ok={reportsOk} configured={reports.configured} />
          <ReadBadge name="get_company_revenue_summary" ok={revenueOk} configured={revenue.configured} />
        </div>
        <p className="mt-3 text-sm">Prior 7 days — donations: {isMeasured(input.donationsPrev7dCents) ? formatUsd(input.donationsPrev7dCents) : 'Not in this read'}; clips: {isMeasured(input.clipsPrev7d) ? formatCount(input.clipsPrev7d) : 'Not in this read'}.</p>
      </details>

      <section aria-labelledby="home-attention" className="mb-10">
        <SectionHeading id="home-attention" level={2} title="Attention and playback" hint="No prior week for these, so no change percent" />
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <TrendChart
            title="Time on tabs"
            windowLabel={WEEK}
            points={dwell}
            format={formatMinutes}
            variant="line"
            accent={TIME}
            source="get_admin_reports.series.dwell"
            tickUnit={60000}
          />
          <TrendChart
            title="Video stalls"
            windowLabel={WEEK}
            points={stalls}
            format={formatCount}
            variant="columns"
            accent={STALLS}
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
            { label: 'Donations', points: malo ?? [], format: formatUsd, accent: DONATIONS },
            { label: 'Clips uploaded', points: clips ?? [], format: formatCount, accent: CLIPS },
            { label: 'Time on tabs', points: dwell ?? [], format: formatMinutes, accent: TIME },
            { label: 'Video stalls', points: stalls ?? [], format: formatCount, accent: STALLS },
          ]}
        />
      </section>

      <div className="mb-10 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Panel title="What changed this week" kicker="Versus the prior week">
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
              // An odd last item takes the full row so the grid never ends with a lone half card.
              <li key={gap.name} className="rounded-xl border border-dashed border-[var(--border)] p-3 sm:last:odd:col-span-2">
                <p className="flex items-baseline justify-between gap-2 text-sm font-extrabold">
                  {gap.name}
                  {/* A screen reader hears "Not measured", not "dash" (an aria-label on a span is not read). */}
                  <span className="text-[var(--text-muted)]">
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">Not measured</span>
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
                value={deskLabel(desk.tone)}
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
