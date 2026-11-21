/**
 * Field operator control center for one claimed game: score buttons, period chips, clock and callouts from the sport
 * playbook. Database reads and live channels go through `lib/operator` so this screen holds no Supabase client.
 * The scoreboard column and callout buttons live in `components/Operator/ScoreColumn` / `CalloutButton` (R4-03).
 */

import * as Haptics from 'expo-haptics';
import { type Href, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CalloutButton } from '@/components/Operator/CalloutButton';
import { OperatorRosterModal } from '@/components/Operator/OperatorRosterModal';
import { PlaySentBanner } from '@/components/Operator/PlaySentBanner';
import { ScoreColumn } from '@/components/Operator/ScoreColumn';
import { ScreenShell } from '@/components/ScreenShell';
import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { displayValue, formatClock, type Player } from '@/data/players';
import { useSportConfigs } from '@/hooks/useSportConfigs';
import {
  clockSeconds,
  fetchOperatorGame,
  fetchOperatorPlayers,
  hasOperatorClaim,
  insertOperatorCallout,
  insertOperatorEvent,
  openGameEventsBroadcaster,
  rosterForScoringSide,
  sendGameEventBroadcast,
  subscribeOperatorGame,
  updateGameScore,
  updateOperatorQuarter,
  type GameEventsBroadcaster,
  type OperatorAction,
  type OperatorCallout,
} from '@/lib/operator';
import { useAuth } from '@/context/AuthContext';
import { offlineQueue } from '@/services/OfflineQueue';
import { assertCurrent, createOfflineActorClient, OfflineActorChangedError, type OfflineActor, type OfflineActorClient } from '@/lib/offlineActor';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { Game } from '@/types/database';

const CONFIG_ERROR =
  'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.';

/**
 * @purpose Field Operator Control Center. Score buttons, period chips, clock, and callouts all come from the game's sport playbook (`sport_configs` via `/admin/sports`), so any sport is scoreable.
 * @returns Live scorekeeper for one claimed game.
 * @sideEffects Supabase `games` Realtime, Broadcast on `game_events_${gameId}`, optional `game_events` INSERT, `update_game_score` RPC, `get_sport_configs`, 1s clock interval, `Haptics.notificationAsync`.
 */
export default function OperatorScorekeeperScreen() {
  const router = useRouter();
  const { gameId: rawId } = useLocalSearchParams<{ gameId: string }>();
  const gameId = Array.isArray(rawId) ? rawId[0] : rawId;
  const { user, isSessionCurrent } = useAuth();
  const holder = useRef({ owner: user?.id, guard: isSessionCurrent, gameId, active: true, read: 0 });
  if (holder.current.owner !== user?.id || holder.current.guard !== isSessionCurrent || holder.current.gameId !== gameId) holder.current = { owner: user?.id, guard: isSessionCurrent, gameId, active: true, read: 0 };
  const scope = holder.current;
  const current = useCallback(() => holder.current === scope && scope.active && (scope.guard?.() ?? true), [scope]);
  const capture = (): OfflineActor => {
    const actor = offlineQueue.captureActor(user?.id);
    if (!actor || !current()) throw new OfflineActorChangedError();
    return { userId: actor.userId, isCurrent: () => current() && actor.isCurrent() };
  };
  const clientFor = async (actor: OfflineActor) => { assertCurrent(actor); const client = await createOfflineActorClient(actor); assertCurrent(actor); return client; };
  const [dataScope, setDataScope] = useState<typeof scope | null>(null);
  const admitted = useRef<typeof scope | null>(null);
  const writeFlight = useRef<object | null>(null);
  const pendingStop = useRef<typeof scope | null>(null);
  const rosterRead = useRef(0);
  useEffect(() => {
    scope.active = true; writeFlight.current = null; pendingStop.current = null;
    setSending(false); setSendError(null); setPendingAction(null); setShowSent(false);
    runningRef.current = false; setRunning(false);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    return () => { scope.active = false; ++scope.read; ++rosterRead.current; pendingStop.current = null; };
  }, [scope]);

  const { configFor } = useSportConfigs();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [side, setSide] = useState<'home' | 'away'>('home');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<OperatorAction | null>(null);
  const [toast, setToast] = useState('Play Event Sent!');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showSent, setShowSent] = useState(false);
  const [remaining, setRemaining] = useState(12 * 60);
  const [running, setRunning] = useState(false);

  const remainingRef = useRef(remaining);
  const runningRef = useRef(running);
  const gameRef = useRef(game);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastRef = useRef<GameEventsBroadcaster | null>(null);

  remainingRef.current = remaining;
  runningRef.current = running;
  gameRef.current = game;

  const sport = configFor(game?.sport);
  // Scoring plays tag a player for the box score; callouts tag one for the highlight feed.
  const tagActions: OperatorAction[] = [
    ...sport.scoring.map((action) => ({
      id: action.id,
      label: action.label,
      eventType: action.eventType,
      points: action.points,
    })),
    ...sport.callouts.map((callout) => ({
      id: `callout-${callout.id}`,
      label: `${callout.emoji} ${callout.label}`,
      eventType: callout.eventType,
      points: 0,
    })),
  ];

  useEffect(() => {
    setAllowed(null);
    void hasOperatorClaim(gameId || '').then((next) => { if (current()) { admitted.current = scope; setAllowed(Boolean(gameId && next)); } }, () => { if (current()) { admitted.current = scope; setAllowed(false); } });
  }, [current, scope, gameId]);

  const loadGame = useCallback(async () => {
    const request = ++scope.read;
    setLoading(true); setError(null);
    try {
      if (!gameId) throw new Error('Missing game id.');
      if (!isSupabaseConfigured) throw new Error(CONFIG_ERROR);
      const actor = capture(); const client = await clientFor(actor);
      const [gameResult, playersResult] = await Promise.all([fetchOperatorGame(gameId, client), fetchOperatorPlayers(client)]);
      assertCurrent(actor);
      if (scope.read !== request) return;
      if (!gameResult.game) throw new Error(gameResult.error ?? 'Game not found.');
      if (playersResult.error) throw new Error(playersResult.error);
      const nextGame = gameResult.game;
      setGame(nextGame); setPlayers(playersResult.players); setDataScope(scope);
      const playbook = configFor(nextGame.sport);
      const seconds = clockSeconds(nextGame, playbook.clockSeconds);
      remainingRef.current = seconds; runningRef.current = Boolean(nextGame.is_clock_running);
      setRemaining(seconds); setRunning(Boolean(nextGame.is_clock_running));
      setSelectedQuarter(nextGame.quarter?.trim() || playbook.periods[0] || '');
    } catch (caught) { if (current() && scope.read === request) { setGame(null); setError(caught instanceof Error ? caught.message : 'Could not load this game.'); } }
    finally { if (current() && scope.read === request) setLoading(false); }
  }, [configFor, current, scope, gameId]);

  useEffect(() => {
    if (allowed && admitted.current === scope) void loadGame();
  }, [allowed, loadGame, scope]);

  useEffect(() => {
    if (!gameId || !allowed) return;
    return subscribeOperatorGame(gameId, (next) => {
      if (!current() || next.id !== gameId) return;
      setGame(next);
      if (!runningRef.current) setRemaining(clockSeconds(next, configFor(next.sport).clockSeconds));
      setRunning(Boolean(next.is_clock_running));
      if (next.quarter?.trim()) setSelectedQuarter(next.quarter.trim());
    });
  }, [allowed, configFor, current, gameId]);

  useEffect(() => {
    if (!gameId || !allowed || admitted.current !== scope) return;
    let live = true; let broadcaster: GameEventsBroadcaster | null = null;
    void (async () => {
      const actor = capture(); const client = await clientFor(actor);
      if (!live || !actor.isCurrent()) return;
      broadcaster = openGameEventsBroadcaster(gameId, client, actor); broadcastRef.current = broadcaster;
    })().catch(() => { /* The guarded transient sender remains available for a current operator. */ });
    return () => { live = false; broadcastRef.current = null; broadcaster?.close(); };
  }, [allowed, current, gameId, scope]);

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      if (!current()) return;
      const next = Math.max(0, remainingRef.current - 1); remainingRef.current = next; setRemaining(next);
      if (next === 0) {
        runningRef.current = false; setRunning(false);
        pendingStop.current = scope;
        if (!writeFlight.current) stopClock();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [current, running, scope]);

  useEffect(() => {
    return () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, []);

  const flashToast = (message: string) => {
    if (!current()) return;
    setToast(message);
    setShowSent(true);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => { if (current()) setShowSent(false); }, 2200);
  };

  const pingSuccess = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };

  async function write<T>(request: (client: OfflineActorClient, actor: OfflineActor) => Promise<T>, saved: (result: T) => void, failed?: () => void) {
    if (writeFlight.current || !current()) return;
    const operation = {}; writeFlight.current = operation;
    let actor: OfflineActor | undefined;
    setSending(true); setSendError(null);
    try {
      actor = capture(); const client = await clientFor(actor);
      const result = await request(client, actor); assertCurrent(actor); saved(result);
    } catch (caught) {
      if (current() && (!actor || actor.isCurrent())) { setSendError(caught instanceof Error ? caught.message : 'Could not save this game action.'); failed?.(); }
    } finally {
      if (writeFlight.current === operation) {
        writeFlight.current = null;
        if (current()) { setSending(false); if (pendingStop.current === scope) stopClock(); }
      }
    }
  }
  function stopClock() {
    if (pendingStop.current !== scope || writeFlight.current || !current()) return;
    pendingStop.current = null;
    const snapshot = gameRef.current;
    if (!snapshot || snapshot.id !== gameId) return;
    void write(client => updateGameScore({ game: snapshot, clockRunning: false, clock: formatClock(0) }, client), next => { gameRef.current = next; setGame(next); });
  }
  const bumpScore = (target: 'home' | 'away', points: number) => {
    const snapshot = gameRef.current;
    if (!snapshot || snapshot.id !== gameId || points <= 0) return;
    void write(client => updateGameScore({ game: snapshot, homeDelta: target === 'home' ? points : 0, awayDelta: target === 'away' ? points : 0 }, client), next => {
      gameRef.current = next; setGame(next); pingSuccess(); flashToast(`${target === 'home' ? snapshot.home_team : snapshot.away_team} +${points}`);
    }, () => void loadGame());
  };
  const toggleClock = () => {
    const snapshot = gameRef.current;
    if (!snapshot || snapshot.id !== gameId) return;
    const nextRunning = !runningRef.current;
    void write(client => updateGameScore({ game: snapshot, clockRunning: nextRunning, clock: formatClock(remainingRef.current) }, client), next => {
      gameRef.current = next; setGame(next); runningRef.current = nextRunning; setRunning(nextRunning); flashToast(nextRunning ? 'Clock running' : 'Clock paused');
    });
  };
  const broadcast = (callout: OperatorCallout) => {
    const snapshot = gameRef.current;
    if (!snapshot || snapshot.id !== gameId) return;
    const team = side === 'home' ? snapshot.home_team : snapshot.away_team;
    void write(async (client, actor) => {
      const payload = { type: callout.eventType, timestamp: new Date().toISOString(), team };
      const live = broadcastRef.current;
      if (live) await live.send(payload); else await sendGameEventBroadcast(snapshot.id, payload, client, actor);
      assertCurrent(actor);
      try { await insertOperatorCallout({ gameId: snapshot.id, callout, teamName: team }, client); }
      catch (error) { if (!actor.isCurrent()) throw error; /* History remains best-effort after a delivered Broadcast. */ }
    }, () => { pingSuccess(); flashToast(`${callout.emoji} ${callout.label}`); });
  };
  const selectQuarter = (quarter: string) => {
    if (!gameId) return;
    void write(client => updateOperatorQuarter(gameId, quarter, client), next => {
      gameRef.current = next; setGame(next); setSelectedQuarter(quarter); runningRef.current = false; setRunning(false); flashToast(`${sport.periodLabel} set to ${quarter}`);
    });
  };
  const openRoster = async (action: OperatorAction) => {
    const read = ++rosterRead.current;
    setPendingAction(action); setSendError(null);
    try {
      const actor = capture(); const client = await clientFor(actor);
      const roster = await fetchOperatorPlayers(client); assertCurrent(actor);
      if (read !== rosterRead.current) return;
      if (roster.error) throw new Error(roster.error);
      setPlayers(roster.players);
    } catch (caught) { if (current() && read === rosterRead.current) setSendError(caught instanceof Error ? caught.message : 'Could not load this roster.'); }
  };
  const tagPlayer = (player: Player) => {
    if (!game || game.id !== gameId || !pendingAction) return;
    const action = pendingAction;
    const teamName = side === 'home' ? game.home_team || 'Home' : game.away_team || 'Away';
    void write(client => insertOperatorEvent({ gameId: game.id, player, action, teamName }, client), () => {
      setPendingAction(null); pingSuccess(); flashToast(`${action.eventType} · ${displayValue(player.name)}`);
    });
  };

  if (admitted.current === scope && allowed === false) {
    return <Redirect href={'/operator' as Href} />;
  }

  if (admitted.current !== scope || allowed === null || loading || (!error && dataScope !== scope)) {
    return (
      <ScreenShell edges={['top', 'left', 'right']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.muted}>Opening control center…</Text>
        </View>
      </ScreenShell>
    );
  }

  if (error || !game) {
    return (
      <ScreenShell edges={['top', 'left', 'right']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Game not found.'}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/operator' as Href)} style={styles.back}>
            <Text style={styles.backLabel}>Back to PIN gate</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  const homeTeam = game.home_team || 'Home';
  const awayTeam = game.away_team || 'Away';
  const roster = rosterForScoringSide(players, game, side);

  return (
    <ScreenShell edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leave console"
            onPress={() => router.replace('/operator' as Href)}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Text style={styles.backLabel}>Leave</Text>
          </Pressable>
          <Text style={styles.kicker}>OPERATOR CONTROL CENTER</Text>
        </View>

        <Text style={styles.matchup} numberOfLines={2}>
          {displayValue(homeTeam)} vs {displayValue(awayTeam)}
        </Text>
        <Text style={styles.venue}>
          {displayValue(game.venue)} · {sport.emoji} {sport.sport}
        </Text>

        <View style={styles.scoreboard}>
          <ScoreColumn
            label="HOME"
            team={homeTeam}
            value={Number(game.home_score) || 0}
            disabled={sending}
            steps={sport.scoring}
            onBump={(points) => void bumpScore('home', points)}
          />
          <View style={styles.clockCol}>
            <Text style={styles.quarterMark}>{selectedQuarter}</Text>
            {sport.usesClock ? (
              <>
                <Text style={styles.clock}>{formatClock(remaining)}</Text>
                <AnimatedPressable
                  haptic="medium"
                  scaleTo={0.96}
                  overshoot={false}
                  disabled={sending}
            accessibilityLabel={running ? 'Pause clock' : 'Start clock'}
                  onPress={() => void toggleClock()}
                  contentStyle={[styles.clockToggle, running && styles.clockToggleOn]}
                >
                  <Text style={[styles.clockToggleLabel, running && styles.clockToggleLabelOn]}>
                    {running ? 'Pause Clock' : 'Start Clock'}
                  </Text>
                </AnimatedPressable>
              </>
            ) : (
              <Text style={styles.venue}>{sport.periodLabel} play · no clock</Text>
            )}
          </View>
          <ScoreColumn
            label="AWAY"
            team={awayTeam}
            value={Number(game.away_score) || 0}
            disabled={sending}
            steps={sport.scoring}
            onBump={(points) => void bumpScore('away', points)}
          />
        </View>

        <Text style={styles.label}>Broadcast to fans</Text>
        <View style={styles.callouts}>
          {sport.callouts.map((callout) => (
            <CalloutButton
              key={callout.id}
              label={`${callout.emoji} ${callout.label}`}
              disabled={sending}
              onPress={() => void broadcast(callout)}
            />
          ))}
        </View>

        <Text style={styles.label}>{sport.periodLabel}</Text>
        <View style={styles.row}>
          {sport.periods.map((item) => {
            const selected = selectedQuarter === item;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Set ${sport.periodLabel.toLowerCase()} ${item}`}
                onPress={() => void selectQuarter(item)}
                style={({ pressed }) => [styles.quarter, selected && styles.quarterOn, pressed && styles.pressed]}
              >
                <Text style={[styles.quarterLabel, selected && styles.quarterLabelOn]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Tag a player</Text>
        <View style={styles.row}>
          {(['home', 'away'] as const).map((value) => {
            const selected = side === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSide(value)}
                style={({ pressed }) => [styles.side, selected && styles.sideOn, pressed && styles.pressed]}
              >
                <Text style={[styles.sideLabel, selected && styles.sideLabelOn]}>
                  {value === 'home' ? 'HOME' : 'AWAY'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.actions}>
          {tagActions.map((action) => (
            <Pressable
              key={action.id}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              disabled={sending}
              onPress={() => void openRoster(action)}
              style={({ pressed }) => [styles.action, pressed && styles.pressed, sending && styles.disabled]}
            >
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <PlaySentBanner visible={showSent} message={toast} />
        {sendError ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {sendError}
          </Text>
        ) : null}
      </ScrollView>
      <OperatorRosterModal
        visible={pendingAction !== null}
        title={pendingAction ? `Tag ${pendingAction.eventType}` : 'Tag player'}
        subtitle={`Select a ${side === 'home' ? homeTeam : awayTeam} player for the live feed.`}
        players={roster}
        busy={sending}
        onSelect={(player) => void tagPlayer(player)}
        onClose={() => setPendingAction(null)}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  matchup: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  venue: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
    marginTop: -6,
  },
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.videoSurface,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: 12,
    gap: 8,
  },
  clockCol: {
    alignItems: 'center',
    minWidth: 96,
    gap: 8,
    paddingTop: 18,
  },
  quarterMark: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  clock: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  clockToggle: {
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockToggleOn: {
    backgroundColor: colors.surface,
  },
  clockToggleLabel: {
    color: colors.onAccent,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  clockToggleLabelOn: {
    color: colors.primary,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  callouts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quarter: {
    flexGrow: 1,
    minWidth: 56,
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quarterOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quarterLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  quarterLabelOn: {
    color: colors.onAccent,
  },
  side: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sideLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  sideLabelOn: {
    color: colors.onAccent,
  },
  actions: {
    gap: 8,
  },
  action: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  errorText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  back: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.55,
  },
});
