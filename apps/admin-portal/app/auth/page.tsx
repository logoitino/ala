import { Panel, PortalShell, StatCard } from '@/components/PortalShell';
import { fetchSoftWallOversight } from '@/lib/softWall';

export const dynamic = 'force-dynamic';

/**
 * @purpose Soft-Wall gate + provider oversight for the web control plane.
 * @sideEffects `fetchSoftWallOversight`.
 */
export default async function SoftWallAuthPage() {
  const oversight = await fetchSoftWallOversight();

  return (
    <PortalShell active="/auth">
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Mālo Soft Wall" value={oversight.maloLive ? 'Armed' : 'Paused'} hint="buttons.malo" tone={oversight.maloLive ? 'ok' : 'warn'} />
        <StatCard label="Crew Soft Wall" value={oversight.crewLive ? 'Armed' : 'Paused'} hint="buttons.crew" tone={oversight.crewLive ? 'ok' : 'warn'} />
        <StatCard
          label="Chip In Soft Wall"
          value={oversight.wishlistLive ? 'Armed' : 'Paused'}
          hint="layouts.wishlist"
          tone={oversight.wishlistLive ? 'ok' : 'warn'}
        />
        <StatCard
          label="Exclusive Soft Wall"
          value={oversight.exclusiveLive ? 'Armed' : 'Paused'}
          hint="buttons.subscribe"
          tone={oversight.exclusiveLive ? 'ok' : 'warn'}
        />
      </div>

      <Panel title="Zero lost context" kicker="Product lock">
        <p className="text-sm leading-6 text-slate-600">
          After SoftWallModal completes Apple / Google / Magic Link, SoftWallContext replays the stashed resume
          (open tip sheet, Crew toggle, Chip In, or exclusive Vault). Telemetry ids: soft_wall.malo · soft_wall.crew ·
          soft_wall.wishlist · soft_wall.exclusive (Coverage desk in Expo). Live desks stay in Expo `/admin`.
        </p>
      </Panel>

      <div className="mt-6 grid gap-4">
        {oversight.softWallGates.map((gate) => (
          <Panel key={gate.id} title={gate.label} kicker={gate.id}>
            <p className="text-sm text-slate-600">{gate.hint}</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-bold text-slate-500">Fan surface</dt>
                <dd>{gate.fanSurface}</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">Expo desk</dt>
                <dd>{gate.adminDesk}</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">Flag</dt>
                <dd>{gate.flagPath ?? 'code'}</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">Telemetry</dt>
                <dd>{gate.telemetry}</dd>
              </div>
            </dl>
          </Panel>
        ))}
      </div>

      <div className="mt-6">
        <Panel title="Supabase Auth checklist" kicker="Dashboard">
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
            <li>Enable Email (password + magic link), Apple, and Google under Authentication → Providers.</li>
            <li>
              Allow redirect <code className="rounded bg-emerald-50 px-1.5">alasports://auth/callback</code>.
            </li>
            <li>
              Run <code className="rounded bg-emerald-50 px-1.5">supabase/auth_fan_profile.sql</code> so first signup
              inserts a fan profile.
            </li>
            <li>
              Demo Fan QA: SoftWall → <strong>Continue as Demo Fan</strong> uses{' '}
              <code className="rounded bg-emerald-50 px-1.5">demo@tapuai.app</code> /{' '}
              <code className="rounded bg-emerald-50 px-1.5">TapuaiDemoFan1!</code>. Disable Confirm email (or pre-create
              that user) so the first tap works.
            </li>
            <li>Operator stays Features-gated — keep Operator console Off until you want sideline monetization.</li>
          </ol>
        </Panel>
      </div>
    </PortalShell>
  );
}
