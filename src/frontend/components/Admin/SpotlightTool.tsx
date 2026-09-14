import { useCallback, useState } from 'react';
import { type Href, useFocusEffect, useRouter } from 'expo-router';

import { AdminBtn, AdminEmpty, AdminNotice, AdminPage, AdminPanel, AdminPills, AdminRow } from '@/components/Admin/AdminChrome';
import { SpotlightManager } from '@/components/Admin/SpotlightManager';
import { TagConfirmList } from '@/components/Spotlight/TagConfirmList';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { usePendingPlayerTags } from '@/hooks/usePendingPlayerTags';
import { fetchSpotlightStandings, syncSpotlightPeriod, unlockSpotlightPeriod } from '@/lib/tags';
import type { SpotlightPeriodKind, SpotlightStandings } from '@/types/database';

const PERIODS: { id: SpotlightPeriodKind; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

function emptyStandings(kind: SpotlightPeriodKind): SpotlightStandings {
  return { period_kind: kind, start_date: '', end_date: '', leaders: [] };
}

/**
 * @purpose Auto Player of the Week / Month / Year plus pending tag verification.
 * @sideEffects `get_spotlight_standings`, `sync_spotlight_period`, `unlock_spotlight_period`, `confirm_reel_player_tag`, `publish_spotlight_award`.
 */
export function SpotlightTool() {
  const router = useRouter();
  const dashboard = useAdminDashboard(true, { awards: true, flags: false, metrics: false });
  const pending = usePendingPlayerTags();
  const [raceKind, setRaceKind] = useState<SpotlightPeriodKind>('week');
  const [standings, setStandings] = useState<SpotlightStandings>(emptyStandings('week'));
  const [raceError, setRaceError] = useState<string | null>(null);
  const [raceBusy, setRaceBusy] = useState(false);

  const loadRace = useCallback(async (kind: SpotlightPeriodKind) => {
    setRaceError(null);
    try {
      setStandings(await fetchSpotlightStandings(kind));
    } catch (caught) {
      setRaceError(caught instanceof Error ? caught.message : 'Could not load the live race.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRace(raceKind);
    }, [loadRace, raceKind]),
  );

  const runAuto = async (unlock: boolean) => {
    setRaceBusy(true);
    setRaceError(null);
    try {
      if (unlock) await unlockSpotlightPeriod(raceKind);
      else await syncSpotlightPeriod(raceKind);
      await Promise.all([loadRace(raceKind), dashboard.refresh()]);
    } catch (caught) {
      setRaceError(caught instanceof Error ? caught.message : 'Could not sync Spotlight.');
    } finally {
      setRaceBusy(false);
    }
  };

  return (
    <AdminPage
      title="Spotlight"
      lede="Confirmed Game Play hype elects the tagged player. The hottest clip is the tape. Fan uploaders get a credit, not the award."
      refreshing={dashboard.loading || pending.loading}
      onRefresh={() => {
        void dashboard.refresh();
        void pending.refresh();
        void loadRace(raceKind);
      }}
      error={dashboard.error}
      saveMode="instant"
    >
      <AdminBtn label="View Spotlight tab" onPress={() => router.push('/spotlight' as Href)} />

      <AdminPanel title="Live race">
        <AdminPills items={PERIODS} value={raceKind} onChange={(id) => { setRaceKind(id); void loadRace(id); }} />
        {raceError ? <AdminNotice text={raceError} tone="danger" /> : null}
        {standings.leaders.length === 0 ? (
          <AdminEmpty text="No confirmed Game Play hype in this window yet. Tags stay pending until the athlete, parent, operator, or admin taps That's them." />
        ) : (
          standings.leaders.slice(0, 8).map((row) => (
            <AdminRow
              key={row.player_id}
              title={`${row.rank}. ${row.name}`}
              meta={`${row.school_name} · ${row.hype} hype (${row.seki} Seki · ${row.aura} Aura · ${row.flex} Flex)${row.shot_by ? ` · Clip by ${row.shot_by}` : ''}`}
            />
          ))
        )}
        <AdminBtn
          label={raceBusy ? 'Syncing' : 'Crown from hype'}
          kind="primary"
          disabled={raceBusy}
          onPress={() => void runAuto(false)}
        />
        <AdminBtn
          label="Let hype decide (unlock override)"
          disabled={raceBusy}
          onPress={() => void runAuto(true)}
        />
      </AdminPanel>

      <TagConfirmList
        variant="admin"
        tags={pending.tags}
        busyId={pending.busyId}
        error={pending.error}
        emptyText="No pending tags. Fan clips of a jersey wait here until someone who knows the player confirms."
        onConfirm={(id) => void pending.resolve(id, 'confirm').then(() => loadRace(raceKind))}
        onReject={(id) => void pending.resolve(id, 'reject').then(() => loadRace(raceKind))}
      />

      <SpotlightManager
        players={dashboard.players}
        awards={dashboard.awards}
        busy={dashboard.busyId === 'publish'}
        onPublish={dashboard.publish}
      />
    </AdminPage>
  );
}
