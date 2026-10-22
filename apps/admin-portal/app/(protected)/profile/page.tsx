/**
 * Read-only Profile oversight; staff change and publish profile chrome in Expo Admin. Browser tab
 * title "Profile · Tapua'i Admin". Section headings under the shell's h1 are h2 and the Panels
 * beneath them are h3, so the outline never skips a level (W3-PORTAL, 2026-10-12).
 */
import type { Metadata } from 'next';

import { Badge, FlagStatusList, Panel, PortalShell, SectionHeading, StatCard } from '@/components/PortalShell';
import { fetchProfileOversight } from '@/lib/profile';
import { fetchPortalRuntime } from '@/lib/softWall';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Profile' };

/**
 * @purpose Next Profile hierarchy oversight — Look chrome flags + claimed roster signal. Read-only:
 *   this portal is oversight only, toggling Profile chrome happens in Expo `/admin/look`.
 * @sideEffects `fetchProfileOversight` + `fetchPortalRuntime` (both read-only).
 */
export default async function ProfileOversightPage() {
  const [oversight, runtime] = await Promise.all([fetchProfileOversight(), fetchPortalRuntime()]);

  const chromeRows = [
    { label: 'Flip Aura card', on: oversight.showCard },
    { label: 'Crew strip', on: oversight.showCrew },
    { label: 'Stats tab', on: oversight.showStats },
    { label: 'Vault tab', on: oversight.showVault },
    { label: 'Actions on top', on: oversight.actionsOnTop },
    { label: 'Open on Stats', on: oversight.statsFirst },
  ];

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
        <p className="text-sm leading-6 text-[var(--ink-soft)]">
          Own Profile and `/user/[id]` share <code className="rounded bg-[var(--jade-soft)] px-1.5">AthleteProfileView</code>.
          Hamburger is hub-only; Join Crew / Give / Purchase hide on your claimed row. The badges below show
          published chrome. Change it in Expo Admin → Look → Profile, then Publish to app there.
        </p>
        <div className="grid gap-2 pt-1 sm:grid-cols-2 lg:grid-cols-3">
          {chromeRows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm"
            >
              <span className="font-bold">{row.label}</span>
              <Badge tone={row.on ? 'ok' : 'warn'}>{row.on ? 'On' : 'Off'}</Badge>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-8">
        <SectionHeading level={2} title="Profile chrome flags" hint="Live status — toggle from Expo /admin/look" />
        {!runtime.configured ? (
          <p className="rounded-xl border border-[var(--gold-soft)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold text-[var(--gold)]">
            Supabase env missing.
          </p>
        ) : (
          <Panel level={3} title="Profile chrome" kicker="Read-only status">
            <FlagStatusList published={runtime.published} groupIds={['profile']} />
          </Panel>
        )}
      </div>
    </PortalShell>
  );
}
