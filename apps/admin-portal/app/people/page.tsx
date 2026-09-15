import { Panel, PortalShell, StatCard } from '@/components/PortalShell';
import { fetchPortalPeople, fetchSoftWallOversight } from '@/lib/softWall';

export const dynamic = 'force-dynamic';

/**
 * @purpose Soft-Wall fan roster for the web portal (verify / grant admin still live in Expo People).
 * @sideEffects profiles SELECT.
 */
export default async function PeoplePage() {
  const [oversight, people] = await Promise.all([fetchSoftWallOversight(), fetchPortalPeople()]);
  const fans = people.filter((row) => row.role === 'fan' && !row.is_admin);

  return (
    <PortalShell active="/people">
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Profiles loaded" value={String(people.length)} hint="Newest Soft-Wall signups first" />
        <StatCard label="Fan profiles (all)" value={String(oversight.fanProfiles)} hint="role/roles include fan" tone="ok" />
        <StatCard label="Fans · 7 days" value={String(oversight.fansLast7d)} hint="created_at window" tone="ok" />
      </div>

      <Panel title="Recent Soft-Wall fans" kicker="Audience">
        <p className="text-sm leading-6 text-slate-600">
          Guests do not get a profiles row until they sign in. Approve athlete verification and grant admin on Expo{' '}
          <code className="rounded bg-emerald-50 px-1.5">/admin/people</code> — this desk is live oversight.
        </p>
        {people.length === 0 ? (
          <p className="rounded-xl border border-dashed border-emerald-200 px-4 py-6 text-sm text-slate-500">
            No profiles yet. Soft-Wall Apple / Google / Magic Link creates the first fan row via{' '}
            <code>handle_new_auth_user</code>.
          </p>
        ) : (
          <ul className="divide-y divide-emerald-900/5">
            {people.map((person) => (
              <li key={person.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-extrabold">{person.full_name}</p>
                  <p className="text-sm text-slate-600">
                    {[person.username, person.role, person.is_verified ? 'Verified' : 'Unverified', person.is_admin ? 'Admin' : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <p className="text-xs font-semibold text-slate-500">
                  {person.created_at ? new Date(person.created_at).toLocaleString() : '—'}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs font-semibold text-slate-500">
          Showing {people.length} newest · {fans.length} look like Soft-Wall fans in this page.
        </p>
      </Panel>
    </PortalShell>
  );
}
