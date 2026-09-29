import { useCallback, useMemo, useState } from 'react';
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
  AdminSuggest,
} from '@/components/Admin/AdminChrome';
import { formatTeamBadge, type SchoolTeam } from '@/data/teams';
import {
  adminSetPlayerGuardian,
  fetchAdminPeople,
  fetchAdminSchools,
  upsertAthlete,
  type AdminPerson,
} from '@/lib/adminCatalog';
import { useRoster } from '@/hooks/useRoster';
import { useSportConfigs } from '@/hooks/useSportConfigs';
import { setPlayerVaultLocked } from '@/lib/vault';
import type { Player } from '@/types/database';

const empty = {
  id: '',
  name: '',
  jersey_number: '',
  position: '',
  school_name: '',
  height: '',
  weight: '',
  forty_yard: '',
  vertical_jump: '',
};

/**
 * @purpose Production roster desk with school catalog picker, measurables, and Vault lock.
 * @sideEffects `players` INSERT / UPDATE; `set_player_vault_locked`; `admin_set_player_guardian` RPC.
 */
export function AthletesTool() {
  const { players, loading, error, refresh } = useRoster();
  const { configs, configFor } = useSportConfigs();
  const [schools, setSchools] = useState<SchoolTeam[]>([]);
  const [people, setPeople] = useState<AdminPerson[]>([]);
  const [sport, setSport] = useState('Football');
  const [form, setForm] = useState(empty);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkingPlayer, setLinkingPlayer] = useState<Player | null>(null);
  const [guardianQuery, setGuardianQuery] = useState('');
  const [guardianBusy, setGuardianBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void fetchAdminSchools().then(setSchools).catch(() => setSchools([]));
      void fetchAdminPeople().then(setPeople).catch(() => setPeople([]));
    }, [refresh]),
  );

  const schoolOptions = useMemo(
    () => schools.map((row) => ({ id: row.id, title: row.name, meta: `${row.mascot} · ${formatTeamBadge(row)}` })),
    [schools],
  );

  const guardianCandidates = useMemo(
    () => people.filter((row) => row.role === 'parent' || row.roles.includes('parent')),
    [people],
  );
  const guardianOptions = useMemo(
    () =>
      guardianCandidates.map((row) => ({
        id: row.id,
        title: row.full_name,
        meta: row.username ? `@${row.username}` : 'Parent',
      })),
    [guardianCandidates],
  );
  const guardianName = useCallback(
    (guardianId: string | null | undefined) =>
      guardianId ? people.find((row) => row.id === guardianId)?.full_name ?? null : null,
    [people],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));
    if (!needle) return sorted;
    return sorted.filter((row) => `${row.name} ${row.school_name} ${row.position}`.toLowerCase().includes(needle));
  }, [players, query]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await upsertAthlete({
        id: form.id || undefined,
        name: form.name,
        jersey_number: Number(form.jersey_number) || 0,
        position: form.position,
        height: form.height,
        school_name: form.school_name,
        team: form.school_name,
        weight: form.weight,
        forty_yard: form.forty_yard,
        vertical_jump: form.vertical_jump,
      });
      setForm(empty);
      setMessage('Athlete saved. Tagging, donations, and profiles will pick this up.');
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not save this athlete.');
    } finally {
      setBusy(false);
    }
  };

  const load = (player: Player) => {
    setForm({
      id: player.id,
      name: player.name,
      jersey_number: String(player.jersey_number ?? ''),
      position: player.position ?? '',
      school_name: player.school_name ?? '',
      height: player.height ?? '',
      weight: player.weight ?? '',
      forty_yard: player.forty_yard ?? '',
      vertical_jump: player.vertical_jump ?? '',
    });
  };

  /**
   * @purpose First-time parent/guardian link. This is now the only way to set `players.guardian_id`
   * (2026-09 parent-payee security fix closed the old self-assign hole) — an admin picks the pair
   * here so a new parent isn't stuck on a broken Parent screen. Confirms before either direction
   * since it resets the athlete's parental consent.
   */
  const doLinkGuardian = async (playerId: string, guardianId: string | null, ok: string) => {
    if (guardianBusy) return;
    setGuardianBusy(true);
    setMessage(null);
    try {
      await adminSetPlayerGuardian(playerId, guardianId);
      setMessage(ok);
      setLinkingPlayer(null);
      setGuardianQuery('');
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not update this athlete’s guardian.');
    } finally {
      setGuardianBusy(false);
    }
  };

  const confirmLinkGuardian = (player: Player, guardian: { id: string; title: string }) => {
    Alert.alert(
      'Link guardian?',
      `Link ${guardian.title} as the parent/guardian for ${player.name}? Any existing parental consent for this athlete will be reset and must be re-approved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Link',
          onPress: () =>
            void doLinkGuardian(player.id, guardian.id, `${player.name} is now linked to ${guardian.title}.`),
        },
      ],
    );
  };

  const confirmUnlinkGuardian = (player: Player) => {
    Alert.alert(
      'Unlink guardian?',
      `Remove the linked guardian from ${player.name}? Parental consent for this athlete will be reset.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: () => void doLinkGuardian(player.id, null, `${player.name} no longer has a linked guardian.`),
        },
      ],
    );
  };

  const playbook = configFor(sport);

  return (
    <AdminPage
      title="Athletes"
      lede="This roster is who fans tag on Highlights ⚡ and donate to. Pick a school from the catalog so onboarding stays in sync."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
      saveMode="instant"
    >
      <AdminPanel title={form.id ? 'Edit athlete' : 'New athlete'}>
        <AdminFieldRow>
          <AdminField label="Name" value={form.name} onChangeText={(name) => setForm((c) => ({ ...c, name }))} placeholder="Marcus Rivera" />
          <AdminField label="Jersey" value={form.jersey_number} onChangeText={(jersey_number) => setForm((c) => ({ ...c, jersey_number }))} keyboardType="number-pad" />
        </AdminFieldRow>
        <AdminPills
          label="Sport"
          items={configs
            .filter((row) => row.isActive)
            .map((row) => ({ id: row.sport, label: `${row.emoji} ${row.sport}` }))}
          value={sport}
          onChange={setSport}
        />
        {playbook.positions.length > 0 ? (
          <AdminPills
            label="Position"
            items={playbook.positions.map((row) => ({ id: row.full, label: row.short || row.full }))}
            value={form.position}
            onChange={(position) => setForm((c) => ({ ...c, position }))}
          />
        ) : null}
        <AdminFieldRow>
          <AdminField label="Position (full)" value={form.position} onChangeText={(position) => setForm((c) => ({ ...c, position }))} placeholder="Quarterback" />
          <AdminSuggest
            label="School"
            value={form.school_name}
            onChangeText={(school_name) => setForm((c) => ({ ...c, school_name }))}
            options={schoolOptions}
            placeholder="ALA Hawks / Westlake High"
            onPick={(option) => setForm((c) => ({ ...c, school_name: option.title }))}
          />
        </AdminFieldRow>
        <AdminFieldRow>
          <AdminField label="Height" value={form.height} onChangeText={(height) => setForm((c) => ({ ...c, height }))} placeholder={`6'2"`} />
          <AdminField label="Weight" value={form.weight} onChangeText={(weight) => setForm((c) => ({ ...c, weight }))} placeholder="192 lb" />
          <AdminField label="40-yard" value={form.forty_yard} onChangeText={(forty_yard) => setForm((c) => ({ ...c, forty_yard }))} placeholder="4.58s" />
          <AdminField label="Vertical" value={form.vertical_jump} onChangeText={(vertical_jump) => setForm((c) => ({ ...c, vertical_jump }))} placeholder="34 in" />
        </AdminFieldRow>
        <AdminBtn label={busy ? 'Saving…' : 'Save athlete'} kind="primary" disabled={busy} onPress={() => void save()} />
        {form.id ? <AdminBtn label="Clear form" onPress={() => setForm(empty)} /> : null}
        <AdminNotice text={message} />
      </AdminPanel>
      {linkingPlayer ? (
        <AdminPanel title={`Link guardian · ${linkingPlayer.name}`}>
          <AdminNotice
            text={
              guardianName(linkingPlayer.guardian_id)
                ? `Currently linked to ${guardianName(linkingPlayer.guardian_id)}.`
                : 'No guardian linked yet — the Parent screen is blocked for this athlete until one is.'
            }
          />
          <AdminSuggest
            label="Parent account"
            value={guardianQuery}
            onChangeText={setGuardianQuery}
            options={guardianOptions}
            placeholder="Search parent-role profiles by name"
            onPick={(option) => confirmLinkGuardian(linkingPlayer, option)}
          />
          {linkingPlayer.guardian_id ? (
            <AdminBtn
              label={guardianBusy ? '…' : 'Unlink current guardian'}
              kind="danger"
              disabled={guardianBusy}
              onPress={() => confirmUnlinkGuardian(linkingPlayer)}
            />
          ) : null}
          <AdminBtn
            label="Cancel"
            disabled={guardianBusy}
            onPress={() => {
              setLinkingPlayer(null);
              setGuardianQuery('');
            }}
          />
        </AdminPanel>
      ) : null}
      <AdminField label="Filter" value={query} onChangeText={setQuery} placeholder="Search roster" />
      {visible.length === 0 ? (
        <AdminEmpty text="No athletes match this filter." />
      ) : (
        visible.map((player) => (
          <AdminRow
            key={player.id}
            title={player.name}
            meta={`#${player.jersey_number} · ${player.position || 'Athlete'} · ${player.school_name || 'No school'} · Vault ${player.vault_locked === false ? 'open' : 'locked'} · Guardian ${guardianName(player.guardian_id) ?? 'none linked'}`}
          >
            <AdminBtn label="Edit" onPress={() => load(player)} />
            <AdminBtn
              label={player.vault_locked === false ? 'Lock Vault' : 'Open Vault'}
              onPress={() => void setPlayerVaultLocked(player.id, player.vault_locked === false).then(() => refresh())}
            />
            <AdminBtn
              label="Link guardian"
              onPress={() => {
                setLinkingPlayer(player);
                setGuardianQuery('');
              }}
            />
          </AdminRow>
        ))
      )}
    </AdminPage>
  );
}
