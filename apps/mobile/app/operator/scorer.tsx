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
import {
  displayValue,
  type Player,
  type ScorerAction,
  buildPlayEventPayload,
} from '@/data/players';
import { useSportConfigs } from '@/hooks/useSportConfigs';
import type { Game } from '@/types/database';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const CONFIG_ERROR =
  'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.';

export default function ScorerScreen() {
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setGames([]);
      setPlayers([]);
      setSelectedGameId('');
      setSelectedPlayerId('');
      setError(CONFIG_ERROR);
      setLoading(false);
      return;
    }

    const [gamesResult, playersResult] = await Promise.all([
      supabase.from('games').select('*').eq('is_active', true).order('home_team', { ascending: true }),
      supabase.from('players').select('*'),
    ]);

    if (gamesResult.error) {
      setGames([]);
      setPlayers([]);
      setError(gamesResult.error.message);
      setLoading(false);
      return;
    }

    if (playersResult.error) {
      setGames((gamesResult.data as Game[] | null) ?? []);
      setPlayers([]);
      setError(playersResult.error.message);
      setLoading(false);
      return;
    }

    const nextGames = (gamesResult.data as Game[] | null) ?? [];
    const nextPlayers = (playersResult.data as Player[] | null) ?? [];
    setGames(nextGames);
    setPlayers(nextPlayers);
    setSelectedGameId((current) =>
      nextGames.some((game) => game.id === current) ? current : (nextGames[0]?.id ?? ''),
    );
    setSelectedPlayerId((current) =>
      nextPlayers.some((player) => player.id === current)
        ? current
        : (nextPlayers[0]?.id ?? ''),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('scorer_games')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        (payload) => {
          const next = payload.new as Game | undefined;
          if (!next?.id) return;
          setGames((current) => {
            const without = current.filter((game) => game.id !== next.id);
            if (next.is_active === false) return without;
            return [next, ...without];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, []);

  const flashSentBanner = () => {
    setShowSentBanner(true);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setShowSentBanner(false), 2500);
  };

  const insertPlayEvent = async (action: string, player: Player) => {
    if (sending) return;

    setSending(true);
    setSendError(null);

    const { error: insertError } = await supabase
      .from('game_events')
      .insert(buildPlayEventPayload(action, player, selectedGame?.id));

    setSending(false);

    if (insertError) {
      setSendError(insertError.message);
      return;
    }

    flashSentBanner();
  };

  const updateGame = async (patch: Partial<Game>) => {
    if (!selectedGame || sending) return;

    setSending(true);
    setSendError(null);

    const { error: updateError } = await supabase
      .from('games')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', selectedGame.id);

    setSending(false);

    if (updateError) {
      setSendError(updateError.message);
      return;
    }

    flashSentBanner();
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

        <PlaySentBanner visible={showSentBanner} />

        {sendError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{sendError}</Text>
          </View>
        ) : null}

        <View style={styles.panel}>
          {loading ? (
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
