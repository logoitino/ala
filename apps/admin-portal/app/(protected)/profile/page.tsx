import Link from 'next/link';

import { FeatureFlagBoard } from '@/components/FeatureFlagBoard';
import { Panel, PortalShell, StatCard } from '@/components/PortalShell';
import { fetchProfileOversight } from '@/lib/profile';
import { fetchPortalRuntime } from '@/lib/softWall';

export const dynamic = 'force-dynamic';

/**
 * @purpose Next Profile hierarchy oversight — Look chrome flags + claimed roster signal.
 * @sideEffects `fetchProfileOversight` + `fetchPortalRuntime`; Profile chrome toggles via FeatureFlagBoard.
 */
export default async function ProfileOversightPage() {
  const [oversight, runtime] = await Promise.all([fetchProfileOversight(), fetchPortalRuntime()]);

  const liveById: Record<string, boolean> = {
    showCard: oversight.showCard,
    showCrew: oversight.showCrew,
    showStats: oversight.showStats,
    showVault: oversight.showVault,
    actionsOnTop: oversight.actionsOnTop,
    statsFirst: oversight.statsFirst,
  };

  return (
    <PortalShell active="/profile">
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Claimed athletes"
          value={String(oversight.claimedAthletes)}
          hint="profiles.player_id set (Active Team Roster · Claimed)"
          tone={oversight.claimedAthletes > 0 ? 'ok' : 'neutral'}
        />
        <StatCard
          label="Athlete profiles"
          value={String(oversight.athleteProfiles)}
          hint="role / roles / active_role includes athlete"
          tone="ok"
        />
        <StatCard
          label="Flip Aura card"
          value={oversight.showCard ? 'Live' : 'Hidden'}
          hint="profile.showCard · hamburger Flip"
          tone={oversight.showCard ? 'ok' : 'warn'}
        />
        <StatCard
          label="Highlights first"
          value={oversight.statsFirst ? 'Stats first' : 'Collage first'}
          hint="profile.statsFirst (default Off = collage)"
          tone={oversight.statsFirst ? 'warn' : 'ok'}
        />
      </div>

      <Panel title="Clean Profile hierarchy" kicker="Fan surface">
        <p className="text-sm leading-6 text-slate-600">
          Own Profile and `/user/[id]` share <code className="rounded bg-emerald-50 px-1.5">AthleteProfileView</code>.
          Hamburger is hub-only; Join Crew / Mālo / Subscribe hide on your claimed row. Toggle chrome below (same RPCs
          as Expo Look · Profile), then Publish to app.
        </p>
        <p className="text-sm text-slate-600">
          Last Publish:{' '}
          {oversight.publishedAt ? new Date(oversight.publishedAt).toLocaleString() : 'Never / unknown'}.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/features" className="rounded-full bg-[var(--jade)] px-4 py-2 text-sm font-extrabold text-white">
            Features · Profile flags
          </Link>
          <Link
            href="/people"
            className="rounded-full border border-emerald-900/15 bg-white px-4 py-2 text-sm font-extrabold text-slate-800"
          >
            People
          </Link>
        </div>
      </Panel>

      <div className="mt-6 grid gap-4">
        {oversight.chromeFlags.map((flag) => {
          const live = liveById[flag.id] ?? true;
          return (
            <Panel key={flag.id} title={flag.label} kicker={flag.path}>
              <p className="text-sm text-slate-600">{flag.hint}</p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-bold text-slate-500">Live</dt>
                  <dd>
                    <span
                      className={
                        live
                          ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-[var(--jade)]'
                          : 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800'
                      }
                    >
                      {live ? 'On' : 'Off'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-500">Fan surface</dt>
                  <dd>{flag.fanSurface}</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-500">Expo desk</dt>
                  <dd>{flag.adminDesk}</dd>
                </div>
              </dl>
            </Panel>
          );
        })}
      </div>

      <div className="mt-6">
        <Panel title="Draft Profile chrome" kicker="Look · Profile">
          <p className="text-sm leading-6 text-slate-600">
            These switches write <code className="rounded bg-emerald-50 px-1.5">app_runtime_config.draft</code> — the
            same document Expo Look edits. Publish copies onto <code>published</code> so the fan app updates over
            Realtime.
          </p>
          {runtime.configured ? (
            <FeatureFlagBoard
              initialDraft={runtime.draft}
              initialPublished={runtime.published}
              dirty={runtime.dirty}
              groupIds={['profile']}
            />
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              Set NEXT_PUBLIC_SUPABASE_* in apps/admin-portal/.env.local to toggle Profile chrome from here.
            </p>
          )}
        </Panel>
      </div>
    </PortalShell>
  );
}
