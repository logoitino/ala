import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PlayCard, resolveEventPlayer } from '@/components/PlayCard';
import { NotificationPrefsBar } from '@/components/NotificationPrefsBar';
import { PlayerListItem } from '@/components/PlayerListItem';
import { ScoreHeader } from '@/components/ScoreHeader';
import { ScreenShell } from '@/components/ScreenShell';
import { TabSwitcher } from '@/components/TabSwitcher';
import { TipSheetModal } from '@/components/TipSheetModal';
import { colors, radii } from '@/constants/theme';
import {
  displayValue,
  eventMatchesNotificationPref,
  playerBelongsToSchool,
  type NotificationPref,
  type Player,
} from '@/data/players';
import { loadFavoritePlayerIds, saveFavoritePlayerIds } from '@/lib/favorites';
import type { Game, GameEvent, GameEventWithPlayer } from '@/types/database';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const CONFIG_ERROR =
  'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.';

const GAME_EVENT_SELECT = '*, players(*)';

function mergeEvent(
  row: GameEvent,
  players: Player[],
  joined?: GameEventWithPlayer | null,
): GameEventWithPlayer {
  if (joined) return joined;
  const player = players.find((item) => item.id === row.player_id) ?? null;
  return { ...row, players: player };
}

export default function GameOverviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Array.isArray(id) ? id[0] : id;
  const mountedRef = useRef(true);
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
  const [tipPlayer, setTipPlayer] = useState<Player | null>(null);

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
    setTipPlayer((current) =>
      current?.id === playerId ? { ...current, backer_count: nextCount } : current,
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
    if (!gameId) {
      setGame(null);
      setError('Missing game id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setGame(null);
      setPlayers([]);
      setEvents([]);
      setError(CONFIG_ERROR);
      setLoading(false);
      return;
    }

    const [gameResult, playersResult, eventsResult] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('players').select('*'),
      supabase
        .from('game_events')
        .select(GAME_EVENT_SELECT)
        .eq('game_id', gameId)
        .order('created_at', { ascending: false })
        .limit(40),
    ]);

    if (!mountedRef.current) return;

    if (gameResult.error || !gameResult.data) {
      setGame(null);
      setError(gameResult.error?.message ?? 'Game not found.');
      setLoading(false);
      return;
    }

    const nextPlayers = (playersResult.data as Player[] | null) ?? [];
    playersRef.current = nextPlayers;
    setGame(gameResult.data as Game);
    setPlayers(nextPlayers);

    if (eventsResult.error) {
      setFeedError(eventsResult.error.message);
      setEvents([]);
    } else {
      setFeedError(null);
      setEvents((eventsResult.data as GameEventWithPlayer[] | null) ?? []);
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
    };
  }, [fetchGame]);

  useEffect(() => {
    if (!isSupabaseConfigured || !gameId) return;

    const channel = supabase
      .channel(`game_${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          if (payload.new) setGame(payload.new as Game);
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_events' },
        (payload) => {
          const row = payload.new as GameEvent;
          if (row.game_id !== gameId) return;

          void (async () => {
            const { data } = await supabase
              .from('game_events')
              .select(GAME_EVENT_SELECT)
              .eq('id', row.id)
              .single();

            if (!mountedRef.current) return;
            prependEvent(mergeEvent(row, playersRef.current, data));
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
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
              onPress={() => setTipPlayer(player)}
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
          <ActivityIndicator size="large" color={colors.primary} />
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
          <ScoreHeader gameId={game.id} game={game} />
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

      <TipSheetModal
        player={tipPlayer}
        onClose={() => setTipPlayer(null)}
        onBacked={(nextCount) => {
          if (tipPlayer) applyBackerCount(tipPlayer.id, nextCount);
        }}
      />
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
    color: '#991B1B',
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
    backgroundColor: colors.primary,
  },
  retryLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
