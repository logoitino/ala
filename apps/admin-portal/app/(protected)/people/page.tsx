/**
 * People desk (`/people`, under Product). Read-only roster of recent fan profiles; verifying and
 * granting admin stay in Expo /admin People. Browser tab title "People · Tapua'i Admin".
 * Each count preserves its own read status: confirmed zero remains zero, refusal stays unknown.
 * @sideEffects `profiles` SELECT via `fetchPortalPeople` and `fetchSoftWallOversight`.
 */
import type { Metadata } from 'next';

import { Badge, Panel, PortalShell, StatCard } from '@/components/PortalShell';
import { fetchPortalPeople, fetchSoftWallOversight } from '@/lib/softWall';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'People' };

/**
 * @purpose Soft-Wall fan roster for the web portal (verify / grant admin still live in Expo People).
 * @sideEffects profiles SELECT.
 */
export default async function PeoplePage() {
  const [oversight, roster] = await Promise.all([fetchSoftWallOversight(), fetchPortalPeople()]);
  const people = roster.people;
  const fans = people.filter((row) => row.role === 'fan' && !row.is_admin);

  return (
    <PortalShell active="/people">
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Profiles loaded" value={roster.error ? '—' : String(people.length)} hint={roster.error ? 'Profiles could not be read. Use Refresh view to retry.' : 'Newest Soft-Wall signups first'} />
        <StatCard label="Fan profiles (all)" value={oversight.fanProfiles == null ? '—' : String(oversight.fanProfiles)} hint={oversight.fanProfiles == null ? 'Fan profile count could not be read. Use Refresh view to retry.' : 'role/roles include fan'} tone={oversight.fanProfiles == null ? 'neutral' : 'ok'} />
        <StatCard label="Fans · 7 days" value={oversight.fansLast7d == null ? '—' : String(oversight.fansLast7d)} hint={oversight.fansLast7d == null ? 'Recent fan count could not be read. Use Refresh view to retry.' : 'created_at window'} tone={oversight.fansLast7d == null ? 'neutral' : 'ok'} />
      </div>

      <Panel title="Recent Soft-Wall fans" kicker="Audience">
        <p className="text-sm leading-6 text-[var(--ink-soft)]">
          Guests do not get a profiles row until they sign in. Approve athlete verification and grant admin on Expo{' '}
          <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin/people</code> — this desk is live oversight.
        </p>
        {roster.error ? (
          <p role="alert" className="rounded-xl border border-[var(--gold-soft)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold text-[var(--gold)]">
            Profiles could not be read. Use Refresh view to retry. Each count above is shown only if its own read succeeded. Grant admin / verify on Expo /admin/people.
          </p>
        ) : null}
        {people.length === 0 && !roster.error ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--text-muted)]">
            No profiles yet. Soft-Wall Apple / Google / Magic Link creates the first fan row via{' '}
            <code>handle_new_auth_user</code>.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {people.map((person) => {
              const verified =
                person.verification_status === 'verified' || person.is_verified;
              const pending = person.verification_status === 'pending';
              return (
                <li key={person.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-extrabold">{person.full_name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {person.username ? <Badge tone="neutral">@{person.username}</Badge> : null}
                      <Badge tone="neutral">{person.role}</Badge>
                      {person.player_id ? <Badge tone="ok">Claimed roster</Badge> : null}
                      <Badge tone={verified ? 'ok' : pending ? 'warn' : 'neutral'}>
                        {verified ? '⚡ Varsity' : pending ? 'Varsity pending' : 'Unverified'}
                      </Badge>
                      {person.is_admin ? <Badge tone="warn">Admin</Badge> : null}
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-[var(--text-muted)]">
                    {person.created_at ? new Date(person.created_at).toLocaleString() : '—'}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs font-semibold text-[var(--text-muted)]">
          {roster.error ? 'Profiles not in this read.' : <>Showing {people.length} newest · {fans.length} look like Soft-Wall fans in this page.</>}
        </p>
      </Panel>
    </PortalShell>
  );
}
