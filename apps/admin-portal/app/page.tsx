import Link from 'next/link';

import { Panel, PortalShell, StatCard } from '@/components/PortalShell';
import { fetchSoftWallOversight } from '@/lib/softWall';
import { isAdminPortalConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * @purpose Next Soft-Wall oversight home — live fan counts, operator pause, gate map from Supabase.
 * @sideEffects Server SELECT via `fetchSoftWallOversight`.
 */
export default async function AdminHomePage() {
  const configured = isAdminPortalConfigured();
  const oversight = await fetchSoftWallOversight();

  return (
    <PortalShell active="/">
      {!configured || !oversight.configured ? (
        <Panel title="Connect Supabase" kicker="Setup">
          <p className="text-sm leading-6 text-slate-600">
            Copy <code className="rounded bg-emerald-50 px-1.5">apps/admin-portal/.env.example</code> to{' '}
            <code className="rounded bg-emerald-50 px-1.5">.env.local</code> with the same project URL and anon key as
            the mobile app. Then reload — this page reads <code>app_runtime_config</code> and Soft-Wall fan profiles.
          </p>
        </Panel>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Fan profiles"
          value={String(oversight.fanProfiles)}
          hint="Soft-Wall sign-ins with a profiles row"
          tone="ok"
        />
        <StatCard
          label="Fans · 7 days"
          value={String(oversight.fansLast7d)}
          hint="New Soft-Wall accounts this week"
          tone={oversight.fansLast7d > 0 ? 'ok' : 'neutral'}
        />
        <StatCard
          label="Operator console"
          value={oversight.operatorConsoleLive ? 'Live' : 'Paused'}
          hint={
            oversight.operatorConsoleDraft === true && !oversight.operatorConsoleLive
              ? 'Draft ON — Publish from Features'
              : 'Features → Operator console + Publish'
          }
          tone={oversight.operatorConsoleLive ? 'warn' : 'ok'}
        />
        <StatCard
          label="Soft-Wall gates"
          value={String(oversight.softWallGates.length)}
          hint="Mālo · Crew · Chip In"
          tone="ok"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Browse-first Soft Wall" kicker="Auth">
          <p className="text-sm leading-6 text-slate-600">
            Guests open Highlights, trading cards, and Locker Room without an account. These three actions open
            SoftWallModal, then resume after Apple / Google / Magic Link.
          </p>
          <ul className="space-y-3">
            {oversight.softWallGates.map((gate) => {
              const live =
                gate.id === 'malo'
                  ? oversight.maloLive
                  : gate.id === 'crew'
                    ? oversight.crewLive
                    : oversight.wishlistLive;
              return (
                <li
                  key={gate.id}
                  className="rounded-xl border border-emerald-900/10 bg-[var(--canvas)] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-extrabold">{gate.label}</p>
                    <span
                      className={
                        live
                          ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-[var(--jade)]'
                          : 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800'
                      }
                    >
                      {live ? 'Control live' : 'Control paused'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{gate.hint}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {gate.fanSurface} · Expo {gate.adminDesk}
                  </p>
                </li>
              );
            })}
          </ul>
          <Link href="/auth" className="inline-flex text-sm font-extrabold text-[var(--jade)]">
            Open Soft-Wall desk →
          </Link>
        </Panel>

        <Panel title="Providers + publish" kicker="Ops">
          <ul className="space-y-2 text-sm text-slate-700">
            {oversight.authProviders.map((provider) => (
              <li key={provider.id} className="rounded-xl border border-emerald-900/10 px-4 py-3">
                <p className="font-bold">{provider.label}</p>
                <p className="text-xs text-slate-500">Redirect {provider.redirect}</p>
              </li>
            ))}
          </ul>
          <p className="text-sm leading-6 text-slate-600">
            Last Publish to app:{' '}
            {oversight.publishedAt ? new Date(oversight.publishedAt).toLocaleString() : 'Never / unknown'}. Toggle Soft-Wall
            related flags on the Features desk, then Publish.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/features"
              className="rounded-full bg-[var(--jade)] px-4 py-2 text-sm font-extrabold text-white"
            >
              Features
            </Link>
            <Link
              href="/people"
              className="rounded-full border border-emerald-900/15 bg-white px-4 py-2 text-sm font-extrabold text-slate-800"
            >
              People
            </Link>
          </div>
        </Panel>
      </div>
    </PortalShell>
  );
}
