import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
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
  setMaloFreeze,
  setVerificationStatus,
  type AdminPerson,
} from '@/lib/adminCatalog';
import type { VerificationRequest } from '@/types/database';

type PeopleFilter = 'all' | 'admin' | 'unverified' | 'verified' | 'fans';

/**
 * @purpose Verify people, grant admin, and oversee Soft-Wall fan signups. Filter the roster instead of scrolling a raw dump.
 * @sideEffects `profiles` UPDATE; `verification_requests` UPDATE; `set_malo_freeze` RPC for the compliance freeze switch.
 */
export function PeopleTool() {
  const [people, setPeople] = useState<AdminPerson[]>([]);
  const [queue, setQueue] = useState<VerificationRequest[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
  const fanCount = people.filter((row) => row.is_fan).length;
  const fansWeek = people.filter((row) => {
    if (!row.is_fan || !row.created_at) return false;
    return Date.now() - new Date(row.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return people.filter((row) => {
      if (filter === 'admin' && !row.is_admin) return false;
      if (filter === 'unverified' && row.is_verified) return false;
      if (filter === 'verified' && !row.is_verified) return false;
      if (filter === 'fans' && !row.is_fan) return false;
      if (!needle) return true;
      return `${row.full_name} ${row.username ?? ''} ${row.role}`.toLowerCase().includes(needle);
    });
  }, [filter, people, query]);

  const act = async (id: string, work: () => Promise<void>, ok: string) => {
    setMessage(null);
    setBusyId(id);
    try {
      await work();
      setMessage(ok);
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not update this person.');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * @purpose Compliance kill switch (LEGAL_BRIEFING.md §8 item 5): honor a written direction from a
   * school/association to freeze Mālo for this athlete's profile within hours. Confirms before
   * either direction since it blocks (or unblocks) real money.
   */
  const confirmFreeze = (person: AdminPerson) => {
    const next = !person.malo_frozen;
    Alert.alert(
      next ? 'Freeze donations?' : 'Unfreeze donations?',
      next
        ? `${person.full_name} will no longer be able to receive donations or new exclusive subscriptions. Use this only for a written school/association direction.`
        : `${person.full_name} will be able to receive donations and new exclusive subscriptions again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: next ? 'Freeze' : 'Unfreeze',
          style: next ? 'destructive' : 'default',
          onPress: () =>
            void act(
              person.id,
              () => setMaloFreeze('athlete', person.id, next),
              next ? `${person.full_name} is frozen.` : `${person.full_name} is unfrozen.`,
            ),
        },
      ],
    );
  };

  return (
    <AdminPage
      title="People"
      lede="Verify athletes and grant admin so they can open this portal. Soft-Wall fans appear here after Apple / Google / Magic Link."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
      saveMode="instant"
    >
      <AdminNotice
        text={`${fanCount} fan profiles · ${fansWeek} Soft-Wall signups in 7d. Guests browse without a row until they hit Donate / Crew / gear goals.`}
        tone="ok"
      />
      <AdminNotice text={message} />
      {pending.length > 0 ? (
        pending.map((row) => (
          <AdminRow key={row.id} title={row.full_name} meta={`Verification · ${row.notes || 'Pending'}`}>
            <AdminBtn
              label={busyId === row.id ? '…' : 'Approve'}
              kind="primary"
              disabled={busyId === row.id}
              onPress={() =>
                void act(row.id, () => setVerificationStatus(row.id, 'approved'), `${row.full_name} verified.`)
              }
            />
            <AdminBtn
              label={busyId === row.id ? '…' : 'Reject'}
              kind="danger"
              disabled={busyId === row.id}
              onPress={() => void act(row.id, () => setVerificationStatus(row.id, 'rejected'), 'Rejected.')}
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
          { id: 'fans', label: `Fans (${fanCount})` },
          { id: 'unverified', label: 'Unverified' },
          { id: 'verified', label: 'Verified' },
          { id: 'admin', label: 'Admins' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <AdminField label="Search" value={query} onChangeText={setQuery} placeholder="Name, handle, role" />
      {visible.length === 0 ? (
        <AdminEmpty text={people.length === 0 ? 'No profiles yet. Soft-Wall sign-in creates the first fan row.' : 'No people match this filter.'} />
      ) : (
        visible.map((person) => (
          <AdminRow
            key={person.id}
            title={person.full_name}
            meta={[
              person.username,
              person.role,
              person.is_fan ? 'Soft-Wall fan' : '',
              person.is_verified ? 'Verified' : 'Unverified',
              person.is_admin ? 'Admin' : '',
              person.malo_frozen ? 'Donations frozen' : '',
              person.created_at ? new Date(person.created_at).toLocaleDateString() : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            <AdminBtn
              label={busyId === person.id ? '…' : person.is_verified ? 'Unverify' : 'Verify'}
              disabled={busyId === person.id}
              onPress={() =>
                void act(
                  person.id,
                  () => patchAdminPerson(person.id, { is_verified: !person.is_verified }),
                  person.is_verified ? 'Unverified.' : 'Verified.',
                )
              }
            />
            <AdminBtn
              label={busyId === person.id ? '…' : person.is_admin ? 'Revoke admin' : 'Grant admin'}
              kind={person.is_admin ? 'danger' : 'primary'}
              disabled={busyId === person.id}
              onPress={() =>
                void act(
                  person.id,
                  () => patchAdminPerson(person.id, { is_admin: !person.is_admin }),
                  person.is_admin ? 'Admin revoked.' : 'Admin granted.',
                )
              }
            />
            <AdminBtn
              label={busyId === person.id ? '…' : person.malo_frozen ? 'Unfreeze donations' : 'Freeze donations'}
              kind={person.malo_frozen ? 'ghost' : 'danger'}
              disabled={busyId === person.id}
              onPress={() => confirmFreeze(person)}
            />
          </AdminRow>
        ))
      )}
    </AdminPage>
  );
}
