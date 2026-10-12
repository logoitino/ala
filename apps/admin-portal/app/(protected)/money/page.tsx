import Link from 'next/link';

import {
  CompareBars,
  HBarList,
  SplitBar,
  SplitRing,
  StackedBars,
  StatTile,
  TrendChart,
  type ChartPoint,
  type StatTone,
} from '@/components/charts';
import { PortalShell, SectionHeading } from '@/components/PortalShell';
import { RecentDonationsTable, RecentLedgerTable } from '@/components/revenue/LedgerTables';
import {
  compactUsd,
  donationSplit,
  entryName,
  fillDays,
  originName,
  payeeName,
  shortDay,
  streamName,
} from '@/components/revenue/revenueModel';
import { MALO_FALLBACK_LIMIT, fetchPortalMaloBreakdown, fetchPortalReports, fetchPortalRevenue, formatUsd } from '@/lib/reports';

export const dynamic = 'force-dynamic';

const usd = (cents: number) => formatUsd(cents);
const count = (n: number) => n.toLocaleString('en-US');

/**
 * @purpose Web Money desk — company totals plus every Mālo broken down by where the gift started.
 * @sideEffects `get_company_revenue_summary` and `get_admin_malo_breakdown` (same ledgers as Expo `/admin/money`).
 *   ADM-01e (COMMERCE): also reads `get_admin_reports` for the `money` section and the 7-day `series.malo`.
 *   Wave 0 is Stripe test mode and payouts are blocked; the page says so and never shows a payout as sent.
 */
export default async function MoneyPage() {
  const [revenue, malo, reports] = await Promise.all([fetchPortalRevenue(), fetchPortalMaloBreakdown(), fetchPortalReports()]);

  // Revenue fields are numbers only when the read succeeded; a failed read is "missing", never $0.
  const revenueOk = revenue.configured && !revenue.error;
  const money = reports.money;
  const has = (key: string) => !reports.error && typeof money[key] === 'number';
  const m = (key: string): number | null => (has(key) ? money[key] : null);

  const donations7d = m('malo_cents_7d');
  const donationsPrev7d = m('malo_cents_prev_7d');
  const queued = m('queued_payouts');
  const sparkPoints: ChartPoint[] = reports.error ? [] : (reports.series.malo ?? []);

  // A total the RPC did not return is null ("—"), never $0.00.
  const gross = revenueOk ? revenue.gross_volume_cents : null;
  const net = revenueOk ? revenue.company_net_cents : null;
  const payouts = revenueOk ? revenue.payouts_cents : null;
  const stripePaid = revenueOk ? revenue.stripe_paid_cents : null;

  // Ledger: where recorded gross went. "Not split" only appears when the parts fall short of gross.
  const unsplit = gross != null && net != null && payouts != null ? Math.max(0, gross - net - payouts) : 0;
  const ringParts = [
    { label: "Tapua'i share", value: net, color: 'gold' as const },
    { label: 'Payee share (families, operators)', value: payouts, color: 'jade' as const },
    ...(unsplit > 0 ? [{ label: 'Recorded gross not split', value: unsplit, color: 'muted' as const }] : []),
  ];

  const split = revenueOk ? donationSplit(revenue.streams) : null;
  const paidTone: StatTone = stripePaid != null && stripePaid > 0 ? 'warn' : 'neutral';

  // Cross-check: ledger donation gross vs the `tips` table total. Both are reads; the page only compares them.
  const tipsAll = m('malo_cents_all');
  const ledgerDonations = split?.gross ?? null;
  const crossGap = tipsAll != null && ledgerDonations != null ? ledgerDonations - tipsAll : null;

  const days = fillDays(malo.byDay);
  const dayPoints: ChartPoint[] = days.map((row) => ({ label: shortDay(row.day), value: row.cents }));

  const plural = (n: number, one: string, many: string) => `${count(n)} ${n === 1 ? one : many}`;

  return (
    <PortalShell active="/money">
      <div
        role="note"
        aria-label="Wave 0 test mode"
        className="mb-6 flex flex-col gap-1 rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-soft)] px-4 py-3 text-sm text-[var(--ink)] sm:flex-row sm:items-center sm:gap-3"
      >
        <span className="inline-flex w-fit shrink-0 rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs font-extrabold tracking-wide text-[var(--gold)] uppercase">
          Wave 0 · Test mode
        </span>
        <p className="leading-5">
          Stripe is in test mode, so every amount here is a test record and no real money has moved. Payouts are blocked:
          nothing has been sent to a family, athlete, or operator.
          {queued != null ? ` Queued payout requests: ${count(queued)}, none sent.` : ''}
        </p>
      </div>

      <SectionHeading title="Ledger totals" hint="company_revenue_logs · all time · test mode" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Gross volume"
          value={gross != null ? usd(gross) : ''}
          missing={gross == null}
          hint="Every stream, as test-mode ledger records"
        />
        <StatTile
          label="Tapua'i share"
          value={net != null ? usd(net) : ''}
          missing={net == null}
          hint="10% of donations, tips for Tapua'i, and other stream shares"
        />
        <StatTile
          label="Payee share recorded"
          value={payouts != null ? usd(payouts) : ''}
          missing={payouts == null}
          hint="Owed to families and operators on the ledger. Not paid out: payouts are blocked."
        />
        <StatTile
          label="Disbursements marked paid"
          value={stripePaid != null ? usd(stripePaid) : ''}
          missing={stripePaid == null}
          tone={paidTone}
          hint={
            paidTone === 'warn'
              ? 'Expected $0 while payouts are blocked. These are test-mode rows; check disbursements.'
              : 'Stays $0 while payouts are blocked in Wave 0'
          }
        />
      </div>
      {revenue.error ? (
        <p role="status" className="mb-6 rounded-xl border border-[var(--ember)]/30 bg-[var(--ember-soft)] px-4 py-3 text-sm text-[var(--ember)]">
          <span className="font-extrabold">Could not read the ledger. </span>
          {revenue.error}. Needs <code>get_company_revenue_summary</code> (<code>supabase/company_revenue.sql</code>).
        </p>
      ) : null}

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <SplitRing
          title="Where recorded gross goes"
          caption="All streams, all time"
          parts={ringParts}
          format={usd}
          centerLabel="Recorded gross"
          centerValue={gross != null ? usd(gross) : '—'}
          totalLabel="Recorded gross"
          source="get_company_revenue_summary · gross_volume_cents, company_net_cents, payouts_cents"
          error={revenue.error}
        />
        <SplitBar
          title="Donation split, from the ledger"
          caption={split ? `Stated policy for this stream: ${split.policy}` : 'Donations stream'}
          parts={[
            { label: "Family accounts (athlete's family)", value: split ? split.family : null, color: 'jade' },
            { label: "Tapua'i share (covers card processing)", value: split ? split.platform : null, color: 'gold' },
            ...(split && split.unsplit > 0 ? [{ label: 'Recorded but not split', value: split.unsplit, color: 'muted' as const }] : []),
          ]}
          format={usd}
          totalLabel="Donations recorded"
          summary={
            !split
              ? 'Donation split: this read did not include the donations stream.'
              : split.gross === 0
                ? 'No donations in the ledger yet, so there is no split to show.'
                : `Of ${usd(split.gross)} in test-mode donations on the ledger, ${usd(split.family)} (${split.familyPct}%) is recorded for family accounts and ${usd(split.platform)} (${split.platformPct}%) for Tapua'i. Both percents are computed from ledger rows, not from the policy.`
          }
          source="get_company_revenue_summary.streams[malo] · gross_cents, payout_cents, platform_cents"
          error={revenue.error}
        />
      </div>
      {crossGap != null ? (
        <p className="-mt-4 mb-8 text-xs leading-5 text-[var(--text-muted)]">
          Cross-check: the ledger records {usd(ledgerDonations ?? 0)} in donations and the donations table holds {usd(tipsAll ?? 0)}.{' '}
          {crossGap === 0
            ? 'They match.'
            : `They differ by ${usd(Math.abs(crossGap))}. The ledger syncs on each read; check company_revenue_logs.`}
        </p>
      ) : null}

      <SectionHeading title="Streams" hint="Per stream: gross, Tapua'i share, payee share" />
      <div className="mb-8 grid gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <StackedBars
            title="Split per stream"
            caption="Each bar is the stream's recorded gross"
            series={[
              { key: 'payout', label: 'Payee share', color: 'jade' },
              { key: 'platform', label: "Tapua'i share", color: 'gold' },
            ]}
            rows={
              revenueOk
                ? revenue.streams.map((stream) => ({
                    label: `${streamName(stream.source, stream.label)} · to ${payeeName(stream.payee)} · ${stream.split}`,
                    segments: { payout: stream.payout_cents, platform: stream.platform_cents },
                    total: stream.gross_cents,
                  }))
                : null
            }
            format={usd}
            emptyText="No stream rows yet. Donations, boosters, and Vault reach the ledger after a test-mode checkout."
            source="get_company_revenue_summary.streams"
            error={revenue.error}
          />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <HBarList
            title="Streams by gross"
            caption="Largest first"
            rows={revenueOk ? revenue.streams.map((stream) => ({ label: streamName(stream.source, stream.label), value: stream.gross_cents })) : null}
            format={usd}
            accent="cyan"
            emptyText="No stream rows yet."
            source="get_company_revenue_summary.streams[].gross_cents"
            error={revenue.error}
          />
        </div>
      </div>

      <SectionHeading title="Donations" hint="Donations table · rolling windows, UTC" />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Donations, last 7 days"
          value={donations7d != null ? usd(donations7d) : ''}
          missing={donations7d == null}
          delta={donations7d != null && donationsPrev7d != null ? { current: donations7d, previous: donationsPrev7d } : null}
          goodDirection="up"
          spark={sparkPoints.length > 0 ? { points: sparkPoints, format: usd, accent: 'jade' } : undefined}
          hint={has('malo_count_7d') ? plural(money.malo_count_7d, 'donation', 'donations') : undefined}
        />
        <StatTile
          label="Donations, last 24 hours"
          value={has('malo_cents_24h') ? usd(money.malo_cents_24h) : ''}
          missing={!has('malo_cents_24h')}
          hint={has('malo_count_24h') ? plural(money.malo_count_24h, 'donation', 'donations') : undefined}
        />
        <StatTile
          label="Average donation, 7 days"
          value={has('avg_tip_cents_7d') ? usd(money.avg_tip_cents_7d) : ''}
          missing={!has('avg_tip_cents_7d')}
          hint="Mean amount per donation"
        />
        <StatTile
          label="Donations, all time"
          value={has('malo_cents_all') ? usd(money.malo_cents_all) : ''}
          missing={!has('malo_cents_all')}
          hint={has('malo_count_all') ? plural(money.malo_count_all, 'donation', 'donations') : undefined}
        />
      </div>
      {reports.error ? (
        <p role="status" className="mb-4 rounded-xl border border-[var(--ember)]/30 bg-[var(--ember-soft)] px-4 py-3 text-sm text-[var(--ember)]">
          <span className="font-extrabold">Could not read donation totals. </span>
          {reports.error}. Needs <code>get_admin_reports</code>.
        </p>
      ) : null}

      {malo.source === 'fallback' ? (
        <p role="note" className="mb-4 text-xs leading-5 text-[var(--text-muted)]">
          Partial: last {MALO_FALLBACK_LIMIT} donations. The breakdown read is not applied yet, so the per-day, origin, and arrival charts count only those rows.
        </p>
      ) : null}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <TrendChart
            title="Donations per day"
            windowLabel="Last 14 days, UTC"
            points={malo.error ? null : dayPoints}
            format={usd}
            tickUnit={100}
            tickFormat={compactUsd}
            variant="columns"
            accent="jade"
            source="get_admin_malo_breakdown.by_day"
            error={malo.error}
          />
        </div>
        <CompareBars
          title="This week versus the prior week"
          subject="Donations"
          current={{ label: 'Last 7 days', value: donations7d }}
          previous={{ label: 'Prior 7 days', value: donationsPrev7d }}
          format={usd}
          caption="Rolling 7-day windows"
          source="get_admin_reports.money · malo_cents_7d, malo_cents_prev_7d"
          error={reports.error}
        />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <HBarList
          title="Where donations start"
          caption="All time · amount, with the number of donations"
          rows={malo.error ? null : malo.byOrigin.map((row) => ({ label: `${originName(row.key)} (${plural(row.count, 'donation', 'donations')})`, value: row.cents }))}
          format={usd}
          accent="jade"
          emptyText="No donations yet."
          source="get_admin_malo_breakdown.by_origin"
          error={malo.error}
        />
        <HBarList
          title="How donors arrived"
          caption="All time · amount, with the number of donations"
          rows={malo.error ? null : malo.byEntry.map((row) => ({ label: `${entryName(row.key)} (${plural(row.count, 'donation', 'donations')})`, value: row.cents }))}
          format={usd}
          accent="violet"
          emptyText="No donations yet."
          source="get_admin_malo_breakdown.by_entry"
          error={malo.error}
        />
      </div>

      <SectionHeading title="Recent ledger" hint="Newest first · up to 40 rows" />
      <div className="mb-8">
        <RecentLedgerTable rows={revenue.recent} error={revenue.error} />
      </div>

      <SectionHeading title="Latest donations" hint="Newest first · up to 40 rows" />
      <div className="mb-6">
        <RecentDonationsTable rows={malo.recent} error={malo.error} />
      </div>

      <p className="text-sm text-[var(--text-muted)]">
        Same ledgers Expo <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin/money</code> reads. This desk is
        read-only. Behavior windows live on{' '}
        <Link href="/reports" className="font-extrabold text-[var(--jade)]">
          Trends →
        </Link>
      </p>
    </PortalShell>
  );
}
