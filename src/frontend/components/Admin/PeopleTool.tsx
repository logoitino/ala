import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  AdminBtn,
  AdminEmpty,
  AdminField,
  AdminNotice,
  AdminPage,
  AdminPills,
  AdminRow,
} from '@/components/Admin/AdminChrome';
import {
  fetchAdminPeople,
  fetchVerificationQueue,
  patchAdminPerson,
  setVerificationStatus,
  type AdminPerson,
} from '@/lib/adminCatalog';
import type { VerificationRequest } from '@/types/database';

type PeopleFilter = 'all' | 'admin' | 'unverified' | 'verified';

/**
 * @purpose Verify people and grant admin. Filter the roster instead of scrolling a raw dump.
 * @sideEffects `profiles` UPDATE; `verification_requests` UPDATE.
 */
export function PeopleTool() {
  const [people, setPeople] = useState<AdminPerson[]>([]);
  const [queue, setQueue] = useState<VerificationRequest[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextPeople, nextQueue] = await Promise.all([fetchAdminPeople(), fetchVerificationQueue()]);
      setPeople(nextPeople);
      setQueue(nextQueue);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load people.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const pending = queue.filter((row) => row.status === 'pending');
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return people.filter((row) => {
      if (filter === 'admin' && !row.is_admin) return false;
      if (filter === 'unverified' && row.is_verified) return false;
      if (filter === 'verified' && !row.is_verified) return false;
      if (!needle) return true;
      return `${row.full_name} ${row.username ?? ''} ${row.role}`.toLowerCase().includes(needle);
    });
  }, [filter, people, query]);

  const act = async (work: () => Promise<void>, ok: string) => {
    setMessage(null);
    try {
      await work();
      setMessage(ok);
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not update this person.');
    }
  };

  return (
    <AdminPage
      title="People"
      lede="Verify athletes and grant admin so they can open this portal."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
      saveMode="instant"
    >
      <AdminNotice text={message} />
      {pending.length > 0 ? (
        pending.map((row) => (
          <AdminRow key={row.id} title={row.full_name} meta={`Verification · ${row.notes || 'Pending'}`}>
            <AdminBtn
              label="Approve"
              kind="primary"
              onPress={() => void act(() => setVerificationStatus(row.id, 'approved'), `${row.full_name} verified.`)}
            />
            <AdminBtn
              label="Reject"
              kind="danger"
              onPress={() => void act(() => setVerificationStatus(row.id, 'rejected'), 'Rejected.')}
            />
          </AdminRow>
        ))
      ) : (
        <AdminEmpty text="No pending verification requests." />
      )}
      <AdminPills
        label="Roster"
        items={[
          { id: 'all', label: `All (${people.length})` },
          { id: 'unverified', label: 'Unverified' },
          { id: 'verified', label: 'Verified' },
          { id: 'admin', label: 'Admins' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <AdminField label="Search" value={query} onChangeText={setQuery} placeholder="Name, handle, role" />
      {visible.length === 0 ? (
        <AdminEmpty text={people.length === 0 ? 'No profiles yet. They appear after someone signs in.' : 'No people match this filter.'} />
      ) : (
        visible.map((person) => (
          <AdminRow
            key={person.id}
            title={person.full_name}
            meta={[person.username, person.role, person.is_verified ? 'Verified' : 'Unverified', person.is_admin ? 'Admin' : '']
              .filter(Boolean)
              .join(' · ')}
          >
            <AdminBtn
              label={person.is_verified ? 'Unverify' : 'Verify'}
              onPress={() =>
                void act(() => patchAdminPerson(person.id, { is_verified: !person.is_verified }), 'Saved.')
              }
            />
            <AdminBtn
              label={person.is_admin ? 'Revoke admin' : 'Grant admin'}
              kind={person.is_admin ? 'danger' : 'primary'}
              onPress={() => void act(() => patchAdminPerson(person.id, { is_admin: !person.is_admin }), 'Saved.')}
            />
          </AdminRow>
        ))
      )}
    </AdminPage>
  );
}
