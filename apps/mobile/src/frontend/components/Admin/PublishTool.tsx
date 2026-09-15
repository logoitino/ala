import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  AdminDeskLink,
  AdminEmpty,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminSectionTitle,
} from '@/components/Admin/AdminChrome';
import { fetchAdminPublishDesk, type AdminPublishDesk } from '@/lib/adminCatalog';
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
 * @purpose Tonight's checklist: what is still hidden from fans, with a jump to the desk that owns it.
 * @returns Read-only queue — Games, Highlights, Drip, Polls, Moderation, and Spotlight keep their own controls.
 * @sideEffects `fetchAdminPublishDesk` reads games, reels, shop products, polls, and the current Spotlight.
 */
export function PublishTool() {
  const [desk, setDesk] = useState<AdminPublishDesk>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const waiting =
    desk.parkedGames.length +
    desk.restoreClips.length +
    desk.hiddenDrip.length +
    desk.inactivePolls.length +
    desk.flaggedClips.length;

  return (
    <AdminPage
      title="Publish"
      lede="One queue of everything fans cannot see yet. Each row opens the desk that owns it — this desk never edits behind their back."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
    >
      <AdminPanel title="Tonight">
        <Text style={styles.stat}>
          {desk.liveGames.length} live on Local · {desk.activePolls.length} polls ·{' '}
          {desk.currentSpotlight ? desk.currentSpotlight.headline : 'no Spotlight this window'}
        </Text>
        <AdminNotice
          text={
            waiting === 0
              ? 'Queue is clear. Walk the fan surfaces from Studio to polish.'
              : `${waiting} item${waiting === 1 ? '' : 's'} waiting to ship.`
          }
        />
        <AdminDeskLink title="Walk the fan app" meta="Role preview for Home, Local, Drip, operator, and the HQs" href="/admin/studio" label="Studio" />
      </AdminPanel>

      <AdminSectionTitle>Local matches</AdminSectionTitle>
      {desk.parkedGames.length === 0 ? (
        <AdminEmpty text={desk.liveGames.length ? 'Every match on this desk is already live.' : 'No parked matches. Create one on Live games.'} />
      ) : (
        desk.parkedGames.map((game) => (
          <AdminDeskLink
            key={game.id}
            title={`${game.home_team} vs ${game.away_team}`}
            meta={`${game.home_school} · ${game.venue || 'TBD'} · parked — go live on Live games`}
            href="/admin/games"
            label="Live games"
          />
        ))
      )}
      {desk.liveGames.map((game) => (
        <AdminDeskLink
          key={`live-${game.id}`}
          title={`${game.home_team} ${game.home_score} – ${game.away_score} ${game.away_team}`}
          meta="On Local right now · scores and clock live on Live games"
          href="/admin/games"
          label="Live games"
          kind="ghost"
        />
      ))}

      <AdminSectionTitle>Highlights ⚡</AdminSectionTitle>
      {desk.flaggedClips.map((row) => (
        <AdminDeskLink
          key={`flag-${row.id}`}
          title={row.title}
          meta={`${row.athleteName} · flagged — clear it before featuring`}
          href="/admin/moderation"
          label="Moderation"
          kind="danger"
        />
      ))}
      {desk.restoreClips.length === 0 && desk.vaultClips.length === 0 && desk.flaggedClips.length === 0 ? (
        <AdminEmpty text="No flagged, removed, or Vault clips waiting." />
      ) : null}
      {desk.restoreClips.map((row) => (
        <AdminDeskLink
          key={row.id}
          title={row.title}
          meta={`${row.athleteName} · removed from Home — restore on Highlights`}
          href="/admin/highlights"
          label="Highlights"
        />
      ))}
      {desk.vaultClips.map((row) => (
        <AdminDeskLink
          key={`vault-${row.id}`}
          title={row.title}
          meta={`${row.athleteName} · Vault only — move it public on Highlights`}
          href="/admin/highlights"
          label="Highlights"
          kind="ghost"
        />
      ))}

      <AdminSectionTitle>Drip</AdminSectionTitle>
      {desk.hiddenDrip.length === 0 ? (
        <AdminEmpty text="Every SKU on this desk is on the rack." />
      ) : (
        desk.hiddenDrip.map((row) => (
          <AdminDeskLink
            key={row.id}
            title={row.name}
            meta={`Hidden · ${row.inventory} in stock — put it on the rack from Drip`}
            href="/admin/drip"
            label="Drip"
          />
        ))
      )}

      <AdminSectionTitle>School Polls</AdminSectionTitle>
      {desk.inactivePolls.length === 0 ? (
        <AdminEmpty text={desk.activePolls.length ? 'Active polls are already on Local.' : 'No polls yet. Create one on Polls.'} />
      ) : (
        desk.inactivePolls.map((row) => (
          <AdminDeskLink
            key={row.slug}
            title={`${row.home_label} vs ${row.away_label}`}
            meta={`${row.slug} · parked — activate on Polls`}
            href="/admin/polls"
            label="Polls"
          />
        ))
      )}

      <AdminSectionTitle>Spotlight</AdminSectionTitle>
      <AdminPanel title={desk.currentSpotlight ? 'Current award' : 'Nothing published'}>
        <Text style={styles.stat}>
          {desk.currentSpotlight
            ? `${desk.currentSpotlight.headline} · ${desk.currentSpotlight.school_name || 'Tapua\'i'}`
            : 'Home has no Player of the Week. Publish one so the fan modal has something to show.'}
        </Text>
        <AdminDeskLink title="Crown a Player of the Week" meta="Confirm tags, then publish the award" href="/admin/spotlight" label="Spotlight" />
      </AdminPanel>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  stat: {
    color: FOCAL.jadeInk,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
