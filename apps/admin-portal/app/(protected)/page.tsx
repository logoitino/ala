import Link from 'next/link';

import { Badge, Panel, PortalShell, SectionHeading, StatCard } from '@/components/PortalShell';
import { fetchProfileOversight } from '@/lib/profile';
import { fetchPortalMaloBreakdown, fetchPortalReports, fetchPortalRevenue, formatUsd } from '@/lib/reports';
import { fetchSoftWallOversight } from '@/lib/softWall';
import { isAdminPortalConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * @purpose Next web admin home — a genuine at-a-glance summary with links out to each desk, not a duplicate
 *   of every desk's full content. Reports/Money/Soft-Wall/Profile own the detail; this page owns the KPIs.
 * @sideEffects Server SELECT / RPC via Soft-Wall, Profile, Reports, and Money loaders.
 */
export default async function AdminHomePage() {
  const configured = isAdminPortalConfigured();
  const [oversight, profile, reports, revenue, malo] = await Promise.all([
    fetchSoftWallOversight(),
    fetchProfileOversight(),
    fetchPortalReports(),
    fetchPortalRevenue(),
    fetchPortalMaloBreakdown(),
  ]);
  const topChannel = malo.byOrigin[0];

  const softWallOn = [oversight.maloLive, oversight.crewLive, oversight.wishlistLive].filter(Boolean).length;
  const profileFlagsOn = [
    profile.showCard,
    profile.showCrew,
    profile.showStats,
    profile.showVault,
  ].filter(Boolean).length;

  return (
    <PortalShell active="/">
      {!configured || !oversight.configured ? (
        <Panel title="Connect Supabase" kicker="Setup">
          <p className="text-sm leading-6 text-[var(--ink-soft)]">
            Copy <code className="rounded bg-[var(--jade-soft)] px-1.5">apps/admin-portal/.env.example</code> to{' '}
            <code className="rounded bg-[var(--jade-soft)] px-1.5">.env.local</code> with the same project URL and
            anon key as the mobile app. Then reload — this page reads <code>app_runtime_config</code> and Soft-Wall
            fan profiles.
          </p>
        </Panel>
      ) : null}

      <SectionHeading title="This week" />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Gross volume"
          value={formatUsd(revenue.gross_volume_cents)}
          hint="All revenue streams"
          tone={revenue.gross_volume_cents ? 'ok' : 'neutral'}
        />
        <StatCard
          label="Donations · 7d"
          value={formatUsd(reports.money.malo_cents_7d ?? 0)}
          hint={topChannel ? `Most from ${topChannel.label}` : 'Donations window'}
          tone={reports.money.malo_cents_7d ? 'ok' : 'neutral'}
        />
        <StatCard
          label="Sessions · 24h"
          value={(reports.usage.sessions_24h ?? 0).toLocaleString()}
          hint="Tab behavior"
          tone={reports.usage.sessions_24h ? 'ok' : 'neutral'}
        />
        <StatCard
          label="Fan profiles"
          value={String(oversight.fanProfiles)}
          hint={`+${oversight.fansLast7d} this week`}
          tone="ok"
        />
      </div>

      <SectionHeading title="System status" hint="Full detail on each desk" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/auth" className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--jade)]" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold">Soft-Wall gates</p>
            <Badge tone={softWallOn === 3 ? 'ok' : 'warn'}>{softWallOn}/3 live</Badge>
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">Donate · Crew · gear-goal auth prompts</p>
          <p className="mt-3 text-sm font-extrabold text-[var(--jade)]">Open Soft-Wall desk →</p>
        </Link>
        <Link href="/profile" className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--jade)]" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold">Profile chrome</p>
            <Badge tone={profileFlagsOn >= 3 ? 'ok' : 'warn'}>{profileFlagsOn}/4 on</Badge>
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {oversight.fanProfiles ? `${profile.claimedAthletes} claimed athletes` : 'No profiles yet'}
          </p>
          <p className="mt-3 text-sm font-extrabold text-[var(--jade)]">Open Profile desk →</p>
        </Link>
        <Link href="/features" className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--jade)]" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold">Last publish</p>
            <Badge tone="neutral">Runtime</Badge>
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {oversight.publishedAt ? new Date(oversight.publishedAt).toLocaleString() : 'Never / unknown'}
          </p>
          <p className="mt-3 text-sm font-extrabold text-[var(--jade)]">Open Features desk →</p>
        </Link>
      </div>

      <div className="mt-8">
        <SectionHeading title="Quick links" />
        <Panel title="Where things live" kicker="Ops">
          <p className="text-sm leading-6 text-[var(--ink-soft)]">
            This portal is read-only oversight — Reports, Money, Features, and People all display live Supabase
            data with no edit affordance. Every change, from Features flags to Games to Catalogs, is made in Expo{' '}
            <code className="rounded bg-[var(--jade-soft)] px-1.5 py-0.5 text-[var(--jade)]">/admin</code>, which
            this portal reads from — including the same{' '}
            <code className="rounded bg-[var(--jade-soft)] px-1.5 py-0.5 text-[var(--jade)]">app_runtime_config</code>{' '}
            Features writes to.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { href: '/reports', label: 'Reports' },
              { href: '/money', label: 'Money' },
              { href: '/features', label: 'Features' },
              { href: '/profile', label: 'Profile' },
              { href: '/people', label: 'People' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-extrabold text-[var(--ink)] hover:border-[var(--jade)]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </PortalShell>
  );
}
