/** Highlights retains recorded sport repairs in its existing editor; metadata and historical tags remain separate. */
import { useCallback, useMemo, useState } from 'react';
import {  useFocusEffect, useRouter } from 'expo-router';

import {
  AdminBtn,
  AdminEmpty,
  AdminField,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminPills,
  AdminRow,
} from '@/components/Admin/AdminChrome';
import { WorkoutChallengesPanel } from '@/components/Admin/WorkoutChallengesPanel';
import { BeyondGamePanel } from '@/components/Admin/BeyondGamePanel';
import { HighlightSportPanel } from '@/components/Admin/HighlightSportPanel';
import { SafetyLabelPanel } from '@/components/Admin/SafetyLabelPanel';
import { labeledReelCategories, parseReelCategory, type ReelCategory } from '@/data/highlights';
import { fetchAdminHighlights, patchHighlight, setHighlightRemoved, type AdminHighlightRow } from '@/lib/adminCatalog';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { userProfileHref } from '@/lib/navigation';
import { formatTipDollars, toggleReelVaultStatus } from '@/lib/reels';

type ClipFilter = 'all' | 'public' | 'vault' | 'removed' | 'flagged' | 'pending';

/**
 * @purpose Production Highlights desk: filter, retitle, retag, vault, remove, restore; plus the Coach-level
 *   label desk (SAFETY-01), the Workout challenges section (CHAL-01: switch, per-post counts, nudge-abuse
 *   view, retention), and private Beyond the Game review/consent/cleanup handling.
 * @sideEffects `reels` UPDATE; `toggle_reel_vault_status`; `set_coach_label` / `coach_label_desk`; the challenge admin functions.
 */
export function HighlightsTool() {
  const router = useRouter();
  const { live } = useAppRuntime();
  const categoryPills = labeledReelCategories(live.catalog.reelCategories);
  const [rows, setRows] = useState<AdminHighlightRow[]>([]);
  const [filter, setFilter] = useState<ClipFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AdminHighlightRow | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ReelCategory>('game_play');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAdminHighlights();
      setRows(next);
      setSelected((current) => (current ? next.find((row) => row.id === current.id) ?? null : null));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load Highlights.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'public' && (row.is_removed || row.is_vault_only)) return false;
      if (filter === 'vault' && !row.is_vault_only) return false;
      if (filter === 'removed' && !row.is_removed) return false;
      if (filter === 'flagged' && !row.is_flagged) return false;
      if (filter === 'pending' && row.tag_status !== 'pending') return false;
      if (!needle) return true;
      return `${row.title} ${row.athleteName} ${row.school}`.toLowerCase().includes(needle);
    });
  }, [filter, query, rows]);

  const open = (row: AdminHighlightRow) => {
    setSelected(row);
    setTitle(row.title);
    setCategory(parseReelCategory(row.category));
    setMessage(null);
  };

  const act = async (id: string, work: () => Promise<void>) => {
    setBusyId(id);
    setMessage(null);
    try {
      await work();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this clip.');
    } finally {
      setBusyId(null);
    }
  };

  const saveMeta = async () => {
    if (!selected) return;
    await act(selected.id, () => patchHighlight(selected.id, { title, category }));
    setMessage('Caption saved. Home and Profile will show it.');
  };

  return (
    <AdminPage
      title="Highlights"
      lede="Retitle, retag, vault, or pull a clip off Home. Changes hit Highlights ⚡ immediately."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
      saveMode="instant"
    >
      <AdminPills
        label="Desk"
        items={[
          { id: 'all', label: 'All' },
          { id: 'public', label: 'On Home' },
          { id: 'vault', label: 'Vault' },
          { id: 'flagged', label: 'Flagged' },
          { id: 'pending', label: 'Pending tag' },
          { id: 'removed', label: 'Removed' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <AdminField label="Search" value={query} onChangeText={setQuery} placeholder="Caption, athlete, school" />
      {selected ? (
        <AdminPanel title="Edit clip">
          <AdminField label="Caption" value={title} onChangeText={setTitle} placeholder="Friday night pick-six" />
          <AdminPills label="Tag" items={categoryPills} value={category} onChange={(id) => setCategory(parseReelCategory(id))} />
          <AdminBtn label={busyId === selected.id ? 'Saving…' : 'Save caption'} kind="primary" disabled={busyId === selected.id} onPress={() => void saveMeta()} />
          <AdminBtn
            label={selected.is_removed ? 'Restore to Home' : 'Remove from Home'}
            kind={selected.is_removed ? 'primary' : 'danger'}
            disabled={busyId === selected.id}
            onPress={() => void act(selected.id, () => setHighlightRemoved(selected.id, !selected.is_removed))}
          />
          <AdminBtn
            label={selected.is_vault_only ? 'Move to public feed' : 'Move to Vault'}
            disabled={busyId === selected.id}
            onPress={() => void act(selected.id, async () => { await toggleReelVaultStatus(selected.id, selected.is_vault_only); })}
          />
          <HighlightSportPanel reelId={selected.id} />
          <AdminBtn label="Close" onPress={() => setSelected(null)} />
          <AdminNotice text={message} />
        </AdminPanel>
      ) : null}
      {visible.length === 0 ? (
        <AdminEmpty text="No clips in this desk." />
      ) : (
        visible.map((row) => (
          <AdminRow
            key={row.id}
            title={row.title}
            meta={[
              row.athleteName,
              row.school,
              row.is_removed ? 'Removed' : row.is_vault_only ? 'Vault' : 'On Home',
              row.is_flagged ? 'Flagged' : '',
              row.tag_status === 'pending' ? 'Tag pending' : '',
              `Seki ${row.seki} · Aura ${row.aura} · Flex ${row.flex}`,
              row.maloCents ? formatTipDollars(row.maloCents) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            <AdminBtn label="Edit" onPress={() => open(row)} />
            {row.playerId ? (
              <AdminBtn label="Profile" onPress={() => router.push(userProfileHref(row.playerId!))} />
            ) : null}
            <AdminBtn
              label={row.is_removed ? 'Restore' : 'Remove'}
              kind={row.is_removed ? 'primary' : 'danger'}
              disabled={busyId === row.id}
              onPress={() => void act(row.id, () => setHighlightRemoved(row.id, !row.is_removed))}
            />
          </AdminRow>
        ))
      )}
      <SafetyLabelPanel />
      <WorkoutChallengesPanel />
      <BeyondGamePanel />
    </AdminPage>
  );
}
