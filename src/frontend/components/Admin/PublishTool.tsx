import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { type Href, useFocusEffect, useRouter } from 'expo-router';

import {
  AdminBtn,
  AdminEmpty,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminRow,
} from '@/components/Admin/AdminChrome';
import { useAuth } from '@/context/AuthContext';
import {
  fetchAdminPublishDesk,
  setHighlightRemoved,
  setShopProductActive,
  upsertAdminPoll,
  upsertGame,
  type AdminPublishDesk,
} from '@/lib/adminCatalog';
import { toggleReelVaultStatus } from '@/lib/reels';
import { FOCAL } from '@/theme/motion';

const EMPTY: AdminPublishDesk = {
  liveGames: [],
  parkedGames: [],
  restoreClips: [],
  vaultClips: [],
  flaggedClips: [],
  hiddenDrip: [],
  inactivePolls: [],
  activePolls: [],
  currentSpotlight: null,
};

/**
 * @purpose Single go-live desk: park/live games, restore clips, activate Drip/polls, jump to Spotlight.
 * @sideEffects `games` UPDATE, `reels` restore/vault, `shop_products.is_active`, `upsert_cheer_poll`.
 */
export function PublishTool() {
  const router = useRouter();
  const { previewAsRole } = useAuth();
  const [desk, setDesk] = useState<AdminPublishDesk>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDesk(await fetchAdminPublishDesk());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the publish queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const act = async (id: string, work: () => Promise<void>, ok: string) => {
    setBusyId(id);
    setMessage(null);
    try {
      await work();
      setMessage(ok);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not publish that.');
    } finally {
      setBusyId(null);
    }
  };

  const waiting =
    desk.parkedGames.length +
    desk.restoreClips.length +
    desk.hiddenDrip.length +
    desk.inactivePolls.length +
    desk.flaggedClips.length;

  return (
    <AdminPage
      title="Publish"
      lede="Everything that should be live on Home, Local, Drip, and Spotlight — one queue, then open the fan surface to confirm."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
      saveMode="instant"
    >
      <AdminPanel title="Tonight">
        <Text style={styles.stat}>
          {desk.liveGames.length} live on Local · {desk.activePolls.length} polls ·{' '}
          {desk.currentSpotlight ? desk.currentSpotlight.headline : 'no Spotlight this window'}
        </Text>
        <AdminNotice text={waiting === 0 ? 'Queue is clear. Open production to polish.' : `${waiting} items waiting to ship.`} />
        <AdminBtn label="Open Home" kind="primary" onPress={() => router.push('/' as Href)} />
        <AdminBtn label="Open Local" onPress={() => router.push('/local' as Href)} />
        <AdminBtn label="Open Drip" onPress={() => router.push('/drip' as Href)} />
        <AdminBtn label="Open Spotlight board" onPress={() => router.push('/spotlight' as Href)} />
        <AdminNotice text={message} />
      </AdminPanel>

      <Text style={styles.section}>Local matches</Text>
      {desk.parkedGames.length === 0 ? (
        <AdminEmpty text={desk.liveGames.length ? 'Every match on this desk is already live.' : 'No parked matches. Create one on Live games.'} />
      ) : (
        desk.parkedGames.map((game) => (
          <AdminRow
            key={game.id}
            title={`${game.home_team} vs ${game.away_team}`}
            meta={`${game.home_school} · ${game.venue || 'TBD'} · parked`}
          >
            <AdminBtn
              label={busyId === game.id ? 'Going live…' : 'Go live'}
              kind="primary"
              disabled={busyId === game.id}
              onPress={() =>
                void act(
                  game.id,
                  () =>
                    upsertGame({
                      ...game,
                      is_active: true,
                      status: game.quarter === 'Final' ? 'Final' : 'live',
                    }),
                  `${game.home_team} vs ${game.away_team} is live on Local.`,
                )
              }
            />
            <AdminBtn label="Edit" onPress={() => router.push('/admin/games')} />
          </AdminRow>
        ))
      )}
      {desk.liveGames.map((game) => (
        <AdminRow
          key={`live-${game.id}`}
          title={`${game.home_team} ${game.home_score} – ${game.away_score} ${game.away_team}`}
          meta="On Local right now"
        >
          <AdminBtn label="View Local" onPress={() => router.push(`/local/game/${game.id}` as Href)} />
          <AdminBtn
            label="Operator"
            onPress={() => {
              void previewAsRole('operator').then(() => router.push(`/operator/${game.id}` as Href));
            }}
          />
        </AdminRow>
      ))}

      <Text style={styles.section}>Highlights ⚡</Text>
      {desk.flaggedClips.length > 0 ? (
        desk.flaggedClips.map((row) => (
          <AdminRow key={`flag-${row.id}`} title={row.title} meta={`${row.athleteName} · flagged — clear on Moderation before featuring`}>
            <AdminBtn label="Moderation" kind="danger" onPress={() => router.push('/admin/moderation')} />
          </AdminRow>
        ))
      ) : null}
      {desk.restoreClips.length === 0 && desk.vaultClips.length === 0 ? (
        <AdminEmpty text="No removed or Vault clips waiting." />
      ) : null}
      {desk.restoreClips.map((row) => (
        <AdminRow key={row.id} title={row.title} meta={`${row.athleteName} · removed from Home`}>
          <AdminBtn
            label={busyId === row.id ? 'Restoring…' : 'Restore to Home'}
            kind="primary"
            disabled={busyId === row.id}
            onPress={() => void act(row.id, () => setHighlightRemoved(row.id, false), 'Clip is back on Highlights ⚡.')}
          />
        </AdminRow>
      ))}
      {desk.vaultClips.map((row) => (
        <AdminRow key={`vault-${row.id}`} title={row.title} meta={`${row.athleteName} · Vault`}>
          <AdminBtn
            label={busyId === `vault-${row.id}` ? 'Moving…' : 'Move to public feed'}
            disabled={busyId === `vault-${row.id}`}
            onPress={() =>
              void act(`vault-${row.id}`, async () => { await toggleReelVaultStatus(row.id, true); }, 'Clip is on the public feed.')
            }
          />
        </AdminRow>
      ))}

      <Text style={styles.section}>Drip</Text>
      {desk.hiddenDrip.length === 0 ? (
        <AdminEmpty text="Every SKU on this desk is on the rack." />
      ) : (
        desk.hiddenDrip.map((row) => (
          <AdminRow key={row.id} title={row.name} meta={`Hidden · ${row.inventory} in stock`}>
            <AdminBtn
              label={busyId === row.id ? 'Publishing…' : 'Put on Drip'}
              kind="primary"
              disabled={busyId === row.id}
              onPress={() => void act(row.id, () => setShopProductActive(row.id, true), `${row.name} is on Drip.`)}
            />
          </AdminRow>
        ))
      )}

      <Text style={styles.section}>School Polls</Text>
      {desk.inactivePolls.length === 0 ? (
        <AdminEmpty text={desk.activePolls.length ? 'Active polls are already on Local.' : 'No polls yet. Create one on Polls.'} />
      ) : (
        desk.inactivePolls.map((row) => (
          <AdminRow key={row.slug} title={`${row.home_label} vs ${row.away_label}`} meta={`${row.slug} · parked`}>
            <AdminBtn
              label={busyId === row.slug ? 'Publishing…' : 'Activate on Local'}
              kind="primary"
              disabled={busyId === row.slug}
              onPress={() =>
                void act(
                  row.slug,
                  () =>
                    upsertAdminPoll({
                      slug: row.slug,
                      home_label: row.home_label,
                      away_label: row.away_label,
                      is_active: true,
                    }),
                  'Poll is live on Local.',
                )
              }
            />
          </AdminRow>
        ))
      )}

      <Text style={styles.section}>Spotlight</Text>
      <AdminPanel title={desk.currentSpotlight ? 'Current award' : 'Nothing published'}>
        <Text style={styles.stat}>
          {desk.currentSpotlight
            ? `${desk.currentSpotlight.headline} · ${desk.currentSpotlight.school_name || 'Tapua\'i'}`
            : 'Home has no Player of the Week. Publish one so the fan modal has something to show.'}
        </Text>
        <AdminBtn label="Open Spotlight desk" kind="primary" onPress={() => router.push('/admin/spotlight')} />
      </AdminPanel>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  section: {
    color: FOCAL.neonJade,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  stat: {
    color: FOCAL.neonJade,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
