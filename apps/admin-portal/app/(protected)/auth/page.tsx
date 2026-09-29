import { Badge, Panel, PortalShell, SectionHeading, StatCard } from '@/components/PortalShell';
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
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Donate Soft Wall" value={oversight.maloLive ? 'Armed' : 'Paused'} hint="buttons.malo" tone={oversight.maloLive ? 'ok' : 'warn'} />
        <StatCard label="Crew Soft Wall" value={oversight.crewLive ? 'Armed' : 'Paused'} hint="buttons.crew" tone={oversight.crewLive ? 'ok' : 'warn'} />
        <StatCard
          label="Gear goal Soft Wall"
          value={oversight.wishlistLive ? 'Armed' : 'Paused'}
          hint="layouts.wishlist"
          tone={oversight.wishlistLive ? 'ok' : 'warn'}
        />
      </div>

      <Panel title="Zero lost context" kicker="Product lock">
        <p className="text-sm leading-6 text-[var(--ink-soft)]">
          After SoftWallModal completes Apple / Google / Magic Link, SoftWallContext replays the stashed resume
          (open donate sheet, Crew toggle, or gear-goal donation). Telemetry ids: soft_wall.malo · soft_wall.crew · soft_wall.wishlist
          (Coverage desk in Expo).
        </p>
      </Panel>

      <div className="mt-8">
        <SectionHeading title="Gates" hint={`${oversight.softWallGates.length} configured`} />
        <div className="grid gap-4">
          {oversight.softWallGates.map((gate) => (
            <Panel key={gate.id} title={gate.label} kicker={gate.id}>
              <p className="text-sm text-[var(--ink-soft)]">{gate.hint}</p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-bold text-[var(--text-muted)]">Fan surface</dt>
                  <dd>{gate.fanSurface}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[var(--text-muted)]">Expo desk</dt>
                  <dd>{gate.adminDesk}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[var(--text-muted)]">Flag</dt>
                  <dd>{gate.flagPath ?? 'code'}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[var(--text-muted)]">Telemetry</dt>
                  <dd>{gate.telemetry}</dd>
                </div>
              </dl>
            </Panel>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <SectionHeading title="Providers" />
        <Panel title="Sign-in providers" kicker="Auth">
          <ul className="grid gap-2 sm:grid-cols-2">
            {oversight.authProviders.map((provider) => (
              <li key={provider.id} className="rounded-xl border border-[var(--border)] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">{provider.label}</p>
                  <Badge tone="neutral">{provider.id}</Badge>
                </div>
                <p className="text-xs text-[var(--text-muted)]">Redirect {provider.redirect}</p>
              </li>
            ))}
          </ul>
          <p className="text-sm leading-6 text-[var(--ink-soft)]">
            Last Publish to app:{' '}
            {oversight.publishedAt ? new Date(oversight.publishedAt).toLocaleString() : 'Never / unknown'}. Toggle
            Soft-Wall related flags on the Features desk, then Publish.
          </p>
        </Panel>
      </div>
    </PortalShell>
  );
}
