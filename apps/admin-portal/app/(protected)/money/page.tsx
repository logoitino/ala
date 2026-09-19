import Link from 'next/link';

import { Panel, PortalShell, StatCard } from '@/components/PortalShell';
import { fetchPortalRevenue, formatUsd } from '@/lib/reports';

export const dynamic = 'force-dynamic';

/**
 * @purpose Web Money desk — company gross / net / payouts from `get_company_revenue_summary`.
 * @sideEffects Same RPC as Expo `/admin/money` (syncs `company_revenue_logs`).
 */
export default async function MoneyPage() {
  const revenue = await fetchPortalRevenue();

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
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {revenue.error}. Needs <code>get_company_revenue_summary</code> (
            <code>supabase/company_revenue.sql</code>).
          </p>
        </Panel>
      ) : null}

      <p className="mb-6 text-sm text-slate-600">
        Same ledger Expo <code className="rounded bg-emerald-50 px-1.5">/admin/money</code> reads. Behavior windows live
        on <Link href="/reports" className="font-extrabold text-[var(--jade)]">Reports →</Link>
      </p>

      <Panel title="Streams" kicker="Split">
        {revenue.streams.length === 0 ? (
          <p className="text-sm text-slate-500">No stream rows yet. Mālo / booster / merch hit the ledger after checkout.</p>
        ) : (
          <ul className="divide-y divide-emerald-900/5">
            {revenue.streams.map((stream) => (
              <li key={stream.source} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-extrabold">{stream.label}</p>
                  <p className="text-sm text-slate-600">
                    {stream.split} · payee {stream.payee}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  Gross {formatUsd(stream.gross_cents)} · Net {formatUsd(stream.platform_cents)} · Out{' '}
                  {formatUsd(stream.payout_cents)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="mt-6">
        <Panel title="Recent ledger" kicker="company_revenue_logs">
          {revenue.recent.length === 0 ? (
            <p className="text-sm text-slate-500">No log rows yet.</p>
          ) : (
            <ul className="divide-y divide-emerald-900/5">
              {revenue.recent.map((row) => (
                <li key={row.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-extrabold">{row.label}</p>
                    <p className="text-sm text-slate-600">{row.source}</p>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">
                    {formatUsd(row.gross_cents)}
                    {row.created_at ? ` · ${new Date(row.created_at).toLocaleString()}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PortalShell>
  );
}
