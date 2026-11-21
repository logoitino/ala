/**
 * Sideline scorer: pick a game and a side, then tap score steps and plays; plays are saved as `game_events`.
 * Labels and actions come from `useSportConfigs`; Retry shows when games fail to load.
 */

import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { GameScoreControls } from '@/components/Operator/GameScoreControls';
import { PlaySentBanner } from '@/components/Operator/PlaySentBanner';
import { ScorerControls } from '@/components/Operator/ScorerControls';
import { ScreenShell } from '@/components/ScreenShell';
import { cardShadow, colors, radii } from '@/constants/theme';
import { displayValue, type Player, type ScorerAction } from '@/data/players';
import { useSportConfigs } from '@/hooks/useSportConfigs';
import type { Game } from '@/types/database';
import {
  fetchOperatorPlayers,
  fetchScorerGames,
  insertScorerPlayEvent,
  patchScorerGame,
  subscribeScorerGames,
} from '@/lib/operator';
import { useAuth } from '@/context/AuthContext';
import { offlineQueue } from '@/services/OfflineQueue';
import { assertCurrent, createOfflineActorClient, OfflineActorChangedError, type OfflineActor, type OfflineActorClient } from '@/lib/offlineActor';
import { isSupabaseConfigured } from '@/lib/supabase';

const CONFIG_ERROR =
  'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.';

export default function ScorerScreen() {
  const { user, isSessionCurrent } = useAuth();
  const holder = useRef({ owner: user?.id, guard: isSessionCurrent, active: true, read: 0 });
  if (holder.current.owner !== user?.id || holder.current.guard !== isSessionCurrent) holder.current = { owner: user?.id, guard: isSessionCurrent, active: true, read: 0 };
  const scope = holder.current;
  const current = useCallback(() => holder.current === scope && scope.active && (scope.guard?.() ?? true), [scope]);
  const capture = (): OfflineActor => {
    const actor = offlineQueue.captureActor(user?.id);
    if (!actor || !current()) throw new OfflineActorChangedError();
    return { userId: actor.userId, isCurrent: () => current() && actor.isCurrent() };
  };
  const clientFor = async (actor: OfflineActor) => { assertCurrent(actor); const client = await createOfflineActorClient(actor); assertCurrent(actor); return client; };
  const writeFlight = useRef<object | null>(null);
  const [dataScope, setDataScope] = useState<typeof scope | null>(null);
  const { configFor } = useSportConfigs();
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState('');
  const [scoreSide, setScoreSide] = useState<'home' | 'away'>('home');
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showSentBanner, setShowSentBanner] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedGame = games.find((game) => game.id === selectedGameId) ?? games[0] ?? null;
  const playbook = configFor(selectedGame?.sport);

  useEffect(() => {
    scope.active = true;
    writeFlight.current = null;
    setSending(false); setSendError(null); setShowSentBanner(false);
    setGames([]); setPlayers([]); setSelectedGameId(''); setSelectedPlayerId('');
    return () => { scope.active = false; ++scope.read; if (bannerTimer.current) clearTimeout(bannerTimer.current); };
  }, [scope]);

  const fetchData = useCallback(async () => {
    const request = ++scope.read;
    setLoading(true); setError(null);
    try {
      if (!isSupabaseConfigured) throw new Error(CONFIG_ERROR);
      const actor = capture(); const client = await clientFor(actor);
      const [gamesResult, playersResult] = await Promise.all([fetchScorerGames(client), fetchOperatorPlayers(client)]);
      assertCurrent(actor);
      if (request !== scope.read) return;
      if (gamesResult.error || playersResult.error) throw new Error(gamesResult.error ?? playersResult.error ?? 'Could not load scorer tools.');
      setGames(gamesResult.games); setPlayers(playersResult.players); setDataScope(scope);
      setSelectedGameId(id => gamesResult.games.some(game => game.id === id) ? id : (gamesResult.games[0]?.id ?? ''));
      setSelectedPlayerId(id => playersResult.players.some(player => player.id === id) ? id : (playersResult.players[0]?.id ?? ''));
    } catch (caught) {
      if (current() && request === scope.read) { setGames([]); setPlayers([]); setError(caught instanceof Error ? caught.message : 'Could not load scorer tools.'); }
    } finally { if (current() && request === scope.read) setLoading(false); }
  }, [current, scope]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => subscribeScorerGames(next => {
    if (!current()) return;
    setGames(games => { const without = games.filter(game => game.id !== next.id); return next.is_active === false ? without : [next, ...without]; });
  }), [current]);

  const flashSentBanner = () => {
    if (!current()) return;
    setShowSentBanner(true);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => { if (current()) setShowSentBanner(false); }, 2500);
  };

  async function write(request: (client: OfflineActorClient) => Promise<string | null>) {
    if (writeFlight.current || !current() || dataScope !== scope) return;
    const operation = {}; writeFlight.current = operation;
    let actor: OfflineActor | undefined;
    setSending(true); setSendError(null);
    try {
      actor = capture(); const client = await clientFor(actor);
      const failure = await request(client); assertCurrent(actor);
      if (failure) setSendError(failure); else flashSentBanner();
    } catch (caught) {
      if (current() && (!actor || actor.isCurrent())) setSendError(caught instanceof Error ? caught.message : 'Could not save this scorer action.');
    } finally {
      if (writeFlight.current === operation) { writeFlight.current = null; if (current()) setSending(false); }
    }
  }
  const insertPlayEvent = (action: string, player: Player) => {
    const gameId = selectedGame?.id;
    return write(client => insertScorerPlayEvent(action, player, gameId, client));
  };
  const updateGame = (patch: Partial<Game>) => {
    const gameId = selectedGame?.id;
    if (!gameId) return;
    return write(client => patchScorerGame(gameId, patch, client));
  };

  const handleAddPoints = (points: number) => {
    if (!selectedGame) return;
    const field = scoreSide === 'home' ? 'home_score' : 'away_score';
    void updateGame({ [field]: selectedGame[field] + points });
  };

  const handleAction = (action: ScorerAction | string, player: Player) => {
    void insertPlayEvent(action as ScorerAction, player);
  };

  const handlePushLiveAlert = (player: Player) => {
    void insertPlayEvent('Live Alert', player);
  };

  return (
    <ScreenShell>
      <Stack.Screen options={{ title: 'Sideline Scorer' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.heading}>Sideline Scorer Portal</Text>
          <Text style={styles.subheading}>
            Update the live scoreboard, then push player plays to the fan feed.
          </Text>
        </View>

        <PlaySentBanner visible={current() && dataScope === scope && showSentBanner} />

        {current() && dataScope === scope && sendError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{sendError}</Text>
          </View>
        ) : null}

        <View style={styles.panel}>
          {!current() || loading || (!error && dataScope !== scope) ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.deepGreen} />
              <Text style={styles.statusText}>Loading scorer tools…</Text>
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>Couldn’t load the scorer portal.</Text>
              <Text style={styles.statusText}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void fetchData()}
                style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
              >
                <Text style={styles.retryLabel}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.stack}>
              <Text style={styles.label}>Active game</Text>
              {selectedGame ? (
                <View style={styles.choiceList}>
                  {games.map((game) => {
                    const selected = game.id === selectedGame.id;
                    return (
                      <Pressable
                        key={game.id}
                        accessibilityRole="button"
                        onPress={() => setSelectedGameId(game.id)}
                        style={[styles.choice, selected && styles.choiceActive]}
                      >
                        <Text style={[styles.choiceLabel, selected && styles.choiceLabelActive]}>
                          {displayValue(game.home_team)} vs {displayValue(game.away_team)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.statusText}>
                  No active games. Run src/backend/db/schema.sql, then reload.
                </Text>
              )}

              {selectedGame ? (
                <GameScoreControls
                  game={selectedGame}
                  side={scoreSide}
                  disabled={sending}
                  macros={playbook.scoring}
                  statuses={[...playbook.periods, 'Final']}
                  periodLabel={playbook.periodLabel}
                  onSelectSide={setScoreSide}
                  onAddPoints={handleAddPoints}
                  onSetStatus={(status) =>
                    void updateGame(
                      status === 'Final'
                        ? { quarter: 'Final', status: 'final' }
                        : status === 'Halftime'
                          ? { quarter: 'Halftime', status: 'live' }
                          : { quarter: status, status: 'live' },
                    )
                  }
                />
              ) : null}

              <ScorerControls
                actions={playbook.callouts.map((callout) => callout.eventType)}
                players={players}
                selectedPlayerId={selectedPlayerId}
                sending={sending}
                onSelectPlayer={setSelectedPlayerId}
                onAction={handleAction}
                onPushLiveAlert={handlePushLiveAlert}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 16,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    gap: 8,
  },
  heading: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
  },
  subheading: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    ...cardShadow,
  },
  stack: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  choiceList: {
    gap: 8,
  },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.background,
  },
  choiceActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choiceLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  choiceLabelActive: {
    color: colors.onAccent,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
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
  retry: {
    marginTop: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryPressed: {
    opacity: 0.82,
  },
  retryLabel: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '800',
  },
  errorBanner: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: 12,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
