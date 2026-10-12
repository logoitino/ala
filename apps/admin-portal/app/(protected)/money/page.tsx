import Link from 'next/link';

import { Panel, PortalShell, SectionHeading, StatCard } from '@/components/PortalShell';
import { fetchPortalMaloBreakdown, fetchPortalRevenue, formatUsd, maloChannel, type MaloSlice } from '@/lib/reports';

export const dynamic = 'force-dynamic';

function Bars({ rows }: { rows: MaloSlice[] }) {
  const max = Math.max(1, ...rows.map((row) => row.cents));
  if (rows.length === 0) return <p className="text-sm text-[var(--text-muted)]">No donations yet.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-extrabold">{row.label}</span>
            <span className="text-xs font-semibold text-[var(--ink-soft)]">
              {formatUsd(row.cents)}
              {row.count > 0 ? ` · ${row.count} ${row.count === 1 ? 'gift' : 'gifts'}` : ''}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--jade-soft)]">
            <div
              className="h-full rounded-full bg-[var(--jade)]"
              style={{ width: `${Math.max(6, (row.cents / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * @purpose Web Money desk — company totals plus every Mālo broken down by where the gift started.
 * @sideEffects `get_company_revenue_summary` and `get_admin_malo_breakdown` (same ledgers as Expo `/admin/money`).
 */
export default async function MoneyPage() {
  const [revenue, malo] = await Promise.all([fetchPortalRevenue(), fetchPortalMaloBreakdown()]);

  return (
    <PortalShell active="/money">
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gross volume" value={formatUsd(revenue.gross_volume_cents)} hint="All streams" tone="ok" />
        <StatCard
          label="Company net"
          value={formatUsd(revenue.company_net_cents)}
          hint="Platform cut"
          tone="ok"
        />
        <StatCard label="Payouts" value={formatUsd(revenue.payouts_cents)} hint="Athlete / operator share" />
        <StatCard
          label="Stripe paid"
          value={formatUsd(revenue.stripe_paid_cents)}
          hint="Marked paid on Connect"
          tone={revenue.stripe_paid_cents ? 'ok' : 'neutral'}
        />
      </div>

      {revenue.error ? (
        <Panel title="Could not load money" kicker="RPC">
          <p className="rounded-xl border border-[var(--gold-soft)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold text-[var(--gold)]">
            {revenue.error}. Needs <code>get_company_revenue_summary</code> (
            <code>supabase/company_revenue.sql</code>).
          </p>
        </Panel>
      ) : null}

      <p className="mb-6 text-sm text-[var(--text-muted)]">
        Same ledgers Expo <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin/money</code> reads. Behavior
        windows live on <Link href="/reports" className="font-extrabold text-[var(--jade)]">Trends →</Link>
      </p>

      {malo.error ? (
        <Panel title="Donation breakdown unavailable" kicker="tips">
          <p className="text-sm text-[var(--ink-soft)]">
            {malo.error}. Apply <code>supabase/tip_origin.sql</code> and <code>supabase/malo_ledger.sql</code>.
          </p>
        </Panel>
      ) : null}

      <SectionHeading title="Where donations start" hint="Each donation is one row" />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Surface" kicker="origin">
          <Bars rows={malo.byOrigin} />
        </Panel>
        <Panel title="How they arrived" kicker="entry">
          <Bars rows={malo.byEntry} />
        </Panel>
      </div>
      <Panel title="Last 14 days" kicker="UTC">
        <Bars
          rows={malo.byDay.map((row) => ({
            key: row.day,
            label: row.day.slice(5),
            cents: row.cents,
            count: 0,
          }))}
        />
      </Panel>

      <div className="mt-6">
        <SectionHeading title="Every donation" hint="Athlete, fan, amount, and the donation detail" />
        <Panel title="Transactions" kicker="tips">
          {malo.recent.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No donation rows yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="text-xs font-extrabold tracking-wide text-[var(--text-muted)] uppercase">
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Athlete</th>
                    <th className="py-2 pr-3">Fan</th>
                    <th className="py-2 pr-3">Gift</th>
                    <th className="py-2 pr-3">Detail</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {malo.recent.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--border)]">
                      <td className="py-2 pr-3 whitespace-nowrap text-[var(--ink-soft)]">
                        {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-2 pr-3 font-extrabold">{row.athlete_name}</td>
                      <td className="py-2 pr-3">{row.fan_name}</td>
                      <td className="py-2 pr-3">{maloChannel(row.origin, row.entry, row.source_label)}</td>
                      <td className="py-2 pr-3 text-xs text-[var(--text-muted)]">
                        {row.wishlist_item_id ? `Item ${row.wishlist_item_id.slice(0, 8)}` : row.reel_id ? `Clip ${row.reel_id.slice(0, 8)}` : '—'}
                      </td>
                      <td className="py-2 text-right font-extrabold">{formatUsd(row.amount_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-8">
      <SectionHeading title="Revenue split" hint="Per stream, gross → net → payout" />
      <Panel title="Streams" kicker="Split">
        {revenue.streams.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No stream rows yet. Donations / booster / merch hit the ledger after checkout.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {revenue.streams.map((stream) => (
              <li key={stream.source} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-extrabold">{stream.label}</p>
                  <p className="text-sm text-[var(--ink-soft)]">
                    {stream.split} · payee {stream.payee}
                  </p>
                </div>
                <p className="text-sm font-semibold text-[var(--ink-soft)]">
                  Gross {formatUsd(stream.gross_cents)} · Net {formatUsd(stream.platform_cents)} · Out{' '}
                  {formatUsd(stream.payout_cents)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="mt-6">
        <SectionHeading title="Recent activity" />
        <Panel title="Recent ledger" kicker="company_revenue_logs">
          {revenue.recent.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No log rows yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {revenue.recent.map((row) => (
                <li key={row.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-extrabold">{row.label}</p>
                    <p className="text-sm text-[var(--ink-soft)]">{row.source}</p>
                  </div>
                  <p className="text-xs font-semibold text-[var(--text-muted)]">
                    {formatUsd(row.gross_cents)}
                    {row.created_at ? ` · ${new Date(row.created_at).toLocaleString()}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      </div>
    </PortalShell>
  );
}
