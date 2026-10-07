/**
 * Guest match route: composes the live play feed and rosters using `lib/guestGames`.
 * Keep athlete navigation, alert filtering, and cached-roster fallback in this screen.
 * @sideEffects Game reads and Realtime through guestGames; favorites in AsyncStorage.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { PlayCard, resolveEventPlayer } from '@/components/PlayCard';
import { LiveMatchBanner } from '@/components/Reels/LiveMatchBanner';
import { NotificationPrefsBar } from '@/components/Local/NotificationPrefsBar';
import { PlayerListItem } from '@/components/Local/PlayerListItem';
import { ScreenShell } from '@/components/ScreenShell';
import { TabSwitcher } from '@/components/Local/TabSwitcher';
import { colors, radii } from '@/constants/theme';
import {
  displayValue,
  eventMatchesNotificationPref,
  playerBelongsToSchool,
  type NotificationPref,
  type Player,
} from '@/data/players';
import { loadFavoritePlayerIds, saveFavoritePlayerIds } from '@/lib/favorites';
import { userProfileHref } from '@/lib/navigation';
import type { Game, GameEvent, GameEventWithPlayer } from '@/types/database';
import { fetchGuestGameEvent, fetchGuestGameOverview, subscribeToGuestGame } from '@/lib/guestGames';

function mergeEvent(
  row: GameEvent,
  players: Player[],
  joined?: GameEventWithPlayer | null,
): GameEventWithPlayer {
  if (joined) return joined;
  const player = players.find((item) => item.id === row.player_id) ?? null;
  return { ...row, players: player };
}

/**
 * @purpose Live match feed + rosters. Roster / name taps open `/user/[id]` (same athlete sheet as Profile). Compact Mālo stays on each play card.
 * @sideEffects `games` / `players` / `game_events` fetch + Realtime; favorites in AsyncStorage.
 */
export default function GameOverviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Array.isArray(id) ? id[0] : id;
  const mountedRef = useRef(true);
  const overviewRequestRef = useRef(0);
  const playersRef = useRef<Player[]>([]);

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<GameEventWithPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [tab, setTab] = useState<'feed' | 'rosters'>('feed');
  const [alertPref, setAlertPref] = useState<NotificationPref>('all');
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const prependEvent = useCallback((next: GameEventWithPlayer) => {
    setEvents((current) => {
      if (current.some((event) => event.id === next.id)) return current;
      return [next, ...current];
    });
  }, []);

  const applyBackerCount = useCallback((playerId: string, nextCount: number) => {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId ? { ...player, backer_count: nextCount } : player,
      ),
    );
    playersRef.current = playersRef.current.map((player) =>
      player.id === playerId ? { ...player, backer_count: nextCount } : player,
    );
    setEvents((current) =>
      current.map((event) => {
        if (event.player_id !== playerId) return event;
        const joined = resolveEventPlayer(event);
        if (!joined) return event;
        return { ...event, players: { ...joined, backer_count: nextCount } };
      }),
    );
  }, []);

  const toggleFavorite = useCallback((playerId: string) => {
    setFavoriteIds((current) => {
      const next = current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId];
      void saveFavoritePlayerIds(next);
      return next;
    });
  }, []);

  const fetchGame = useCallback(async () => {
    const request = ++overviewRequestRef.current;
    if (!gameId) {
      setGame(null);
      setError('Missing game id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await fetchGuestGameOverview(gameId);

    // A prior match or retry can finish after a newer request; it must not replace its state.
    if (!mountedRef.current || request !== overviewRequestRef.current) return;

    if (result.error || !result.game) {
      setGame(null);
      setError(result.error ?? 'Game not found.');
      setLoading(false);
      return;
    }

    const nextPlayers = result.players;
    playersRef.current = nextPlayers;
    setGame(result.game);
    setPlayers(nextPlayers);

    if (result.feedError) {
      setFeedError(result.feedError);
      setEvents([]);
    } else {
      setFeedError(null);
      setEvents(result.events);
    }

    setLoading(false);
  }, [gameId]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchGame();
    void loadFavoritePlayerIds().then((ids) => {
      if (mountedRef.current) setFavoriteIds(ids);
    });

    return () => {
      mountedRef.current = false;
      overviewRequestRef.current += 1;
    };
  }, [fetchGame]);

  useEffect(() => {
    if (!gameId) return;
    let active = true;
    const unsubscribe = subscribeToGuestGame(gameId, {
      onGame: setGame,
      onEvent: (row) => {
        void (async () => {
          const joined = await fetchGuestGameEvent(row.id);
          // Route changes can finish an older join after the new match has mounted.
          if (!active || !mountedRef.current) return;
          prependEvent(mergeEvent(row, playersRef.current, joined));
        })();
      },
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [gameId, prependEvent]);

  const filteredEvents = useMemo(
    () => events.filter((event) => eventMatchesNotificationPref(event, alertPref, favoriteIds)),
    [alertPref, events, favoriteIds],
  );

  const homeRoster = useMemo(
    () => (game ? players.filter((player) => playerBelongsToSchool(player, game.home_school)) : []),
    [game, players],
  );
  const awayRoster = useMemo(
    () => (game ? players.filter((player) => playerBelongsToSchool(player, game.away_school)) : []),
    [game, players],
  );
  const unmatchedRoster = useMemo(() => {
    const matchedIds = new Set([...homeRoster, ...awayRoster].map((player) => player.id));
    return players.filter((player) => !matchedIds.has(player.id));
  }, [awayRoster, homeRoster, players]);

  const renderRoster = (title: string, roster: Player[]) => (
    <View style={styles.rosterBlock}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {roster.length === 0 ? (
        <Text style={styles.statusText}>No players listed for this team yet.</Text>
      ) : (
        <View style={styles.rosterList}>
          {roster.map((player) => (
            <PlayerListItem
              key={player.id}
              player={player}
              favorited={favoriteIds.includes(player.id)}
              onToggleFavorite={() => toggleFavorite(player.id)}
              onPress={() => router.push(userProfileHref(player.id))}
            />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ScreenShell>
      <Stack.Screen options={{ title: game ? displayValue(game.home_team) : 'Game' }} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.deepGreen} />
          <Text style={styles.statusText}>Loading game…</Text>
        </View>
      ) : error || !game ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Couldn’t load this game.</Text>
          <Text style={styles.statusText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void fetchGame()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <LiveMatchBanner gameId={game.id} />
          <NotificationPrefsBar value={alertPref} onChange={setAlertPref} />
          <TabSwitcher value={tab} onChange={setTab} />

          {tab === 'feed' ? (
            <View style={styles.feed}>
              {feedError ? <Text style={styles.feedError}>{feedError}</Text> : null}
              {filteredEvents.length === 0 ? (
                <Text style={styles.statusText}>
                  {alertPref === 'favorites' && favoriteIds.length === 0
                    ? 'Star players on the roster tab to follow their plays.'
                    : 'No plays match this alert setting yet.'}
                </Text>
              ) : (
                filteredEvents.map((event) => (
                  <PlayCard
                    key={event.id}
                    event={event}
                    onBacked={applyBackerCount}
                    onOpenAthlete={(playerId) => router.push(userProfileHref(playerId))}
                  />
                ))
              )}
            </View>
          ) : (
            <View style={styles.feed}>
              {renderRoster(`${displayValue(game.home_team)} roster`, homeRoster)}
              {renderRoster(`${displayValue(game.away_team)} roster`, awayRoster)}
              {unmatchedRoster.length > 0
                ? renderRoster('Other athletes', unmatchedRoster)
                : null}
            </View>
          )}
        </ScrollView>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 36,
    gap: 14,
  },
  feed: {
    gap: 14,
  },
  rosterBlock: {
    gap: 12,
  },
  rosterList: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  feedError: {
    fontSize: 13,
    color: colors.danger,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  statusText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    backgroundColor: colors.deepGreen,
  },
  retryLabel: {
    color: colors.onAccent,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
