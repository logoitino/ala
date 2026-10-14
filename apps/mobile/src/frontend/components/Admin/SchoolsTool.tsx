import { useCallback, useState } from 'react';
import { SchoolStaffPanel } from '@/components/Admin/SchoolStaffPanel';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  AdminBtn,
  AdminEmpty,
  AdminField,
  AdminFieldRow,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminPills,
  AdminRow,
} from '@/components/Admin/AdminChrome';
import { fetchAdminSchools, setMaloFreeze, upsertSchool } from '@/lib/adminCatalog';
import { formatTeamBadge, type SchoolTeam } from '@/data/teams';

const empty = {
  id: '',
  name: '',
  mascot: '',
  level: 'high_school' as 'high_school' | 'college',
  division: 'High School',
  region: 'UT',
  city: '',
};

/**
 * @purpose Edit `schools_and_teams` so athlete onboarding and Local search match production.
 * @sideEffects `schools_and_teams` INSERT / UPDATE; `set_malo_freeze` RPC for the compliance freeze switch.
 */
export function SchoolsTool() {
  const [rows, setRows] = useState<SchoolTeam[]>([]);
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState<'all' | 'high_school' | 'college'>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchAdminSchools());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load schools.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await upsertSchool({
        id: form.id || undefined,
        name: form.name,
        mascot: form.mascot,
        level: form.level,
        division: form.division,
        region: form.region,
        city: form.city,
      });
      setForm(empty);
      setMessage('School saved. Onboarding and Local search will show it.');
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not save this school.');
    } finally {
      setBusy(false);
    }
  };

  const visible = rows.filter((row) => {
    if (filter !== 'all' && row.level !== filter) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${row.name} ${row.mascot} ${row.city ?? ''}`.toLowerCase().includes(needle);
  });

  /**
   * @purpose Compliance kill switch (LEGAL_BRIEFING.md §8 item 5): honor a written direction from a
   * school/association to freeze Mālo across every athlete at this school within hours.
   */
  const confirmFreeze = (school: SchoolTeam) => {
    const next = !school.malo_frozen;
    Alert.alert(
      next ? 'Freeze donations for this school?' : 'Unfreeze donations for this school?',
      next
        ? `Every athlete at ${school.name} will no longer be able to receive donations or new exclusive subscriptions. Use this only for a written school/association direction.`
        : `Athletes at ${school.name} will be able to receive donations and new exclusive subscriptions again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: next ? 'Freeze' : 'Unfreeze',
          style: next ? 'destructive' : 'default',
          onPress: () => {
            setBusy(true);
            setMessage(null);
            void setMaloFreeze('school', school.id, next)
              .then(() => {
                setMessage(next ? `${school.name} is frozen.` : `${school.name} is unfrozen.`);
                return refresh();
              })
              .catch((caught) => setMessage(caught instanceof Error ? caught.message : 'Could not update this school.'))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  return (
    <AdminPage
      title="Schools"
      lede="High School and NCAA catalog. Athletes pick these on onboarding; Local search uses the same list."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
      saveMode="instant"
    >
      <AdminPills
        label="Catalog"
        items={[
          { id: 'all', label: 'All' },
          { id: 'high_school', label: 'High School' },
          { id: 'college', label: 'College' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <AdminPanel title={form.id ? 'Edit school' : 'New school'}>
        <AdminFieldRow>
          <AdminField label="Name" value={form.name} onChangeText={(name) => setForm((c) => ({ ...c, name }))} placeholder="Westlake High" />
          <AdminField label="Mascot" value={form.mascot} onChangeText={(mascot) => setForm((c) => ({ ...c, mascot }))} placeholder="Thunder" />
        </AdminFieldRow>
        <AdminPills
          label="Level"
          items={[
            { id: 'high_school', label: 'High School' },
            { id: 'college', label: 'College' },
          ]}
          value={form.level}
          onChange={(level) =>
            setForm((c) =>
              level === 'college'
                ? { ...c, level, division: 'NCAA D1', region: c.region === 'UT' ? 'Big 12' : c.region }
                : { ...c, level, division: 'High School', region: c.region === 'Big 12' ? 'UT' : c.region },
            )
          }
        />
        <AdminFieldRow>
          <AdminField label="Division" value={form.division} onChangeText={(division) => setForm((c) => ({ ...c, division }))} />
          <AdminField label="Region / conference" value={form.region} onChangeText={(region) => setForm((c) => ({ ...c, region }))} />
          <AdminField label="City" value={form.city} onChangeText={(city) => setForm((c) => ({ ...c, city }))} />
        </AdminFieldRow>
        <AdminBtn label={busy ? 'Saving…' : 'Save school'} kind="primary" disabled={busy} onPress={() => void save()} />
        {form.id ? <AdminBtn label="Clear form" onPress={() => setForm(empty)} /> : null}
        <AdminNotice text={message} />
      </AdminPanel>
      {form.id ? <SchoolStaffPanel key={form.id} schoolId={form.id} schoolName={form.name || 'School'} /> : null}
      <AdminField label="Search" value={query} onChangeText={setQuery} placeholder="School, mascot, city" />
      {visible.length === 0 ? (
        <AdminEmpty text="No schools match this filter." />
      ) : (
        visible.map((row) => (
          <AdminRow
            key={row.id}
            title={row.name}
            meta={`${row.mascot} · ${formatTeamBadge(row)}${row.malo_frozen ? ' · Donations frozen' : ''}`}
          >
            <AdminBtn
              label="Edit"
              onPress={() =>
                setForm({
                  id: row.id,
                  name: row.name,
                  mascot: row.mascot,
                  level: row.level === 'college' ? 'college' : 'high_school',
                  division: row.division,
                  region: row.region,
                  city: row.city ?? '',
                })
              }
            />
            <AdminBtn
              label={row.malo_frozen ? 'Unfreeze donations' : 'Freeze donations'}
              kind={row.malo_frozen ? 'ghost' : 'danger'}
              disabled={busy}
              onPress={() => confirmFreeze(row)}
            />
          </AdminRow>
        ))
      )}
    </AdminPage>
  );
}
