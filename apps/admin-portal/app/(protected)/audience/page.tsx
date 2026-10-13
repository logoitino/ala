/**
 * Audience desk (`/audience`). Open verification blocks follow Home's report layout. Stock counts from `get_admin_reports`: profiles, athletes,
 * schools, the verify queue, verified share, schools by athletes listed, and the clip mix of clips not removed
 * (Game Day / Train Like Me / Serve Like Me). Counts are rows, not people who returned.
 * A missing key shows "—"; a failed read is an alert. Clip-type colours come from
 * `lib/measureColors.ts` (Game Day jade, Train Like Me cyan, Serve Like Me gold), as on every page.
 * @sideEffects `get_admin_reports`.
 */
import type { Metadata } from 'next';

import { HBarList, Meter, SplitBar, StatTile } from '@/components/charts';
import { PortalShell, SectionHeading } from '@/components/PortalShell';
import { formatCount, readKey } from '@/lib/dashboard';
import { measureColor } from '@/lib/measureColors';
import { fetchPortalReports } from '@/lib/reports';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Audience' };

/**
 * @purpose Audience desk. Verified share uses profiles as the denominator because that is the table the count comes from.
 */
export default async function AudiencePage() {
  const reports = await fetchPortalReports();
  const ok = reports.configured && !reports.error;
  const audience = (name: string) => readKey(reports.audience, name, ok);
  const content = (name: string) => readKey(reports.content, name, ok);

  const profiles = audience('profiles');
  const athletes = audience('athletes');
  const schools = audience('schools');
  const verified = audience('verified');
  const pending = audience('pending_verify');
  const admins = audience('admins');
  const show = (value: number | null) => (value == null ? '—' : formatCount(value));

  return (
    <PortalShell active="/audience">
      {reports.error ? (
        <p role="alert" className="mb-6 rounded-xl border border-[var(--ember)]/30 bg-[var(--ember-soft)] px-4 py-3 text-sm font-semibold text-[var(--ember)]">
          Audience did not load. {reports.error}
        </p>
      ) : null}

      <section aria-labelledby="audience-who" className="mb-10">
        <SectionHeading id="audience-who" level={2} title="Who is on the platform" hint="Counts, not people who returned" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Profiles" value={show(profiles)} missing={profiles == null} hint="Accounts" goodDirection="none" />
          <StatTile label="Athletes" value={show(athletes)} missing={athletes == null} hint="Player rows" goodDirection="none" />
          <StatTile label="Schools" value={show(schools)} missing={schools == null} hint="Schools and teams in the catalog" goodDirection="none" />
          <StatTile
            label="Verify queue"
            value={show(pending)}
            missing={pending == null}
            hint={pending != null && pending > 0 ? 'Waiting on a decision in Expo /admin' : 'Nothing waiting'}
            tone={pending == null ? 'neutral' : pending > 0 ? 'warn' : 'ok'}
            goodDirection="none"
          />
        </div>
      </section>

      <section aria-labelledby="audience-trust" className="mb-10">
        <SectionHeading id="audience-trust" level={2} title="Verification" hint="Share of all profiles" />
        <div className="grid gap-3 md:grid-cols-2">
          <Meter
            label="Verified profiles"
            part={verified}
            whole={profiles}
            format={formatCount}
            hint="Verified profiles of all profiles. A share of accounts, not of athletes."
            source="get_admin_reports.audience.verified / profiles"
          />
          <div className="portal-stat flex min-w-0 flex-col justify-between gap-3 border-b border-[var(--border)] py-4">
            <p className="text-[11px] font-extrabold tracking-[0.08em] text-[var(--text-muted)] uppercase">Admin accounts</p>
            <p className="text-sm leading-6 text-[var(--ink)]">
              {admins == null ? (
                <>
                  <span className="font-extrabold">—</span> Not in this read.
                </>
              ) : (
                <>
                  <span className="chart-tabular text-2xl font-extrabold tracking-tight">{formatCount(admins)}</span>{' '}
                  {admins === 1 ? 'account has' : 'accounts have'} admin access. Access is granted in Expo /admin People.
                </>
              )}
            </p>
            <p className="font-mono text-[11px] text-[var(--text-muted)]">
              <span className="sr-only">Source: </span>get_admin_reports.audience.admins
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="audience-mix">
        <SectionHeading id="audience-mix" level={2} title="Schools and clips" hint="Live catalog" />
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <HBarList
            title="Schools by athletes listed"
            caption="Top 5 schools · player rows"
            rows={ok ? reports.leaders.schools : null}
            format={formatCount}
            accent={measureColor('schools')}
            emptyText="No schools with listed athletes in this read."
            source="get_admin_reports.leaders.schools"
          />
          <SplitBar
            title="Clip mix"
            caption="Clips not removed, by type"
            totalLabel="Clips not removed"
            format={formatCount}
            source="get_admin_reports.content.game_play · train_like_me · serve_like_me"
            parts={[
              { label: 'Game Day', value: content('game_play'), color: measureColor('gameDay') },
              { label: 'Train Like Me', value: content('train_like_me'), color: measureColor('trainLikeMe') },
              { label: 'Serve Like Me', value: content('serve_like_me'), color: measureColor('serveLikeMe') },
            ]}
          />
        </div>
      </section>
    </PortalShell>
  );
}
