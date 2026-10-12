import { BarRow, Panel, PortalShell, SectionHeading, StatCard } from '@/components/PortalShell';
import { sharePercent } from '@/lib/dashboard';
import { fetchPortalReports } from '@/lib/reports';

export const dynamic = 'force-dynamic';

/**
 * @purpose Audience desk. Stock counts from `get_admin_reports`: profiles, athletes, schools, and content mix.
 *   Verified share uses profiles as the denominator because that is the table the count comes from.
 * @sideEffects `get_admin_reports`.
 */
export default async function AudiencePage() {
  const reports = await fetchPortalReports();
  const profiles = reports.audience.profiles ?? 0;
  const verified = reports.audience.verified ?? 0;
  const verifiedShare = sharePercent(verified, profiles);
  const schoolMax = Math.max(...reports.leaders.schools.map((row) => row.value), 1);
  const mix = [
    { label: 'Game play', value: reports.content.game_play ?? 0 },
    { label: 'Train like me', value: reports.content.train_like_me ?? 0 },
    { label: 'Serve like me', value: reports.content.serve_like_me ?? 0 },
  ];
  const mixMax = Math.max(...mix.map((row) => row.value), 1);

  return (
    <PortalShell active="/audience">
      {reports.error ? (
        <p className="mb-6 rounded-xl border border-[var(--ember-soft)] bg-[var(--ember-soft)] px-4 py-3 text-sm font-semibold text-[var(--ember)]">
          Audience did not load. {reports.error}
        </p>
      ) : null}

      <SectionHeading title="Who is on the platform" hint="Counts, not people who returned" />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Profiles" value={profiles.toLocaleString()} hint="Accounts" tone="neutral" />
        <StatCard label="Athletes" value={(reports.audience.athletes ?? 0).toLocaleString()} hint="Player rows" tone="neutral" />
        <StatCard
          label="Verified profiles"
          value={verifiedShare == null ? '—' : `${verifiedShare}%`}
          hint={verifiedShare == null ? 'No profiles yet' : `${verified.toLocaleString()} of ${profiles.toLocaleString()} profiles`}
          tone="neutral"
        />
        <StatCard
          label="Verify queue"
          value={(reports.audience.pending_verify ?? 0).toLocaleString()}
          hint="Waiting on a decision"
          tone={(reports.audience.pending_verify ?? 0) > 0 ? 'warn' : 'ok'}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Schools" kicker="Athletes listed">
          {reports.leaders.schools.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No schools in this read.</p>
          ) : (
            reports.leaders.schools.map((row) => (
              <BarRow key={row.label} label={row.label} value={row.value} max={schoolMax} formatted={row.value.toLocaleString()} />
            ))
          )}
        </Panel>
        <Panel title="Clip mix" kicker="Live clips">
          {mix.map((row) => (
            <BarRow key={row.label} label={row.label} value={row.value} max={mixMax} formatted={row.value.toLocaleString()} />
          ))}
          <p className="text-sm text-[var(--ink-soft)]">
            {(reports.audience.schools ?? 0).toLocaleString()} schools in the catalog. {(reports.audience.admins ?? 0).toLocaleString()} admin accounts.
          </p>
        </Panel>
      </div>
    </PortalShell>
  );
}
