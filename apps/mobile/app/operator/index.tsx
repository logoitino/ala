/**
 * Operator console home: PIN claim, GPS check-in, the list of live games to score, and pending player tags.
 * Check-in only reports success after `operator_checkins` saves.
 */

import * as Location from 'expo-location';
import { Stack, type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { DashboardPanel } from '@/components/DashboardPanel';
import { PINClaimModal } from '@/components/Operator/PINClaimModal';
import { ScreenHeading } from '@/components/ScreenHeading';
import { FamilyFunDiscovery } from '@/components/FamilyFun/FamilyFunDiscovery';
import { ScreenShell } from '@/components/ScreenShell';
import { TagConfirmList } from '@/components/Spotlight/TagConfirmList';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import { telemetry } from '@/services/TelemetryManager';
import { displayValue } from '@/data/players';
import { usePendingPlayerTags } from '@/hooks/usePendingPlayerTags';
import {
  OPERATOR_TEST_PIN,
  claimOperatorGame,
  fetchOperatorGames,
  saveOperatorCheckIn,
  subscribeOperatorGames,
} from '@/lib/operator';
import type { Game } from '@/types/database';

export default function OperatorPortalScreen() {
  const router = useRouter();
  const { live } = useAppRuntime();
  const { profile } = useAuth();
  const pending = usePendingPlayerTags();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState('Not checked in');
  const [claiming, setClaiming] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) ?? null,
    [games, selectedGameId],
  );

  const fetchGames = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    const result = await fetchOperatorGames();
    setGames(result.games);
    setError(result.error);
    if (result.games.length === 0) {
      console.error('[operator] Active games list is empty after fetch.');
    }
    setLoading(false);
  }, []);

  const refresh = useCallback(() => fetchGames(true), [fetchGames]);

  useEffect(() => {
    void fetchGames();
    return subscribeOperatorGames(() => {
      void fetchGames(false);
    });
  }, [fetchGames]);

  const claimGame = async () => {
    if (!selectedGame) return;
    setClaiming(true);
    try {
      telemetry.trackFeature('operator_claim', 'operator');
      await claimOperatorGame(selectedGame.id, profile?.id);
      const id = selectedGame.id;
      setSelectedGameId(null);
      router.push(`/operator/${id}` as Href);
    } finally {
      setClaiming(false);
    }
  };

  const gpsCheckIn = async () => {
    if (checkingIn) return;
    setCheckingIn(true);
    try {
      telemetry.trackFeature('operator_checkin', 'operator');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location needed', 'Enable location to check in at the field.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const label = `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
      const result = await saveOperatorCheckIn(position.coords.latitude, position.coords.longitude);
      if (!result.ok) {
        Alert.alert('Check-in not saved', result.message);
        return;
      }
      setCheckIn(`Checked in at ${label}`);
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <ScreenShell>
      <Stack.Screen options={{ title: 'Field Operator' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeading
          kicker="Tapua'i operator"
          title="Field Operator Portal"
          lede={live.copy.operatorLede}
        />
        <FamilyFunDiscovery />
        <TagConfirmList
          tags={pending.tags}
          busyId={pending.busyId}
          error={pending.error}
          emptyText="No pending tags for your school's athletes."
          onConfirm={(id) => void pending.resolve(id, 'confirm')}
          onReject={(id) => void pending.resolve(id, 'reject')}
        />

        <DashboardPanel title="Active games" body="Claim one game at a time from the sideline.">
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.muted}>Loading live games…</Text>
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>Couldn’t load active games.</Text>
              <Text style={styles.muted}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void refresh()}
                style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
              >
                <Text style={styles.retryLabel}>Retry</Text>
              </Pressable>
            </View>
          ) : games.length === 0 ? (
            <Text style={styles.muted}>No active games. Seed games in Supabase, then reload.</Text>
          ) : (
            <View style={styles.list}>
              {games.map((game) => {
                const selected = game.id === selectedGameId;
                return (
                  <Pressable
                    key={game.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${game.home_team} versus ${game.away_team} at ${game.venue}`}
                    onPress={() => {
                      setSelectedGameId(game.id);
                    }}
                    style={({ pressed }) => [
                      styles.game,
                      selected && styles.gameOn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.gameTitle, selected && styles.gameTitleOn]}>
                      {displayValue(game.home_team)} vs {displayValue(game.away_team)}
                    </Text>
                    <Text style={[styles.muted, selected && styles.gameMetaOn]}>
                      {displayValue(game.venue)} · {displayValue(game.home_score, '0')}-
                      {displayValue(game.away_score, '0')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Operator PIN"
          body={`Tap a live game, then enter PIN ${OPERATOR_TEST_PIN} to claim scoring rights.`}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open PIN keypad"
            disabled={!selectedGame || claiming}
            onPress={() => {
              if (selectedGame) setSelectedGameId(selectedGame.id);
            }}
            style={({ pressed }) => [
              styles.claim,
              pressed && styles.pressed,
              (!selectedGame || claiming) && styles.disabled,
            ]}
          >
            <Text style={styles.claimLabel}>
              {selectedGame ? 'Enter PIN to claim' : 'Select a game first'}
            </Text>
          </Pressable>
        </DashboardPanel>

        <DashboardPanel title="GPS check-in" body={checkIn}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Check in at venue"
            disabled={checkingIn}
            onPress={() => void gpsCheckIn()}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed, checkingIn && styles.disabled]}
          >
            <Text style={styles.secondaryLabel}>{checkingIn ? 'Checking in…' : 'Check in at venue'}</Text>
          </Pressable>
        </DashboardPanel>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open player-tagged sideline scorer"
          onPress={() => {
            telemetry.trackFeature('operator_scorer', 'operator');
            router.push('/operator/scorer' as Href);
          }}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <Text style={styles.linkLabel}>Open player-tagged macros</Text>
        </Pressable>
      </ScrollView>
      <PINClaimModal
        game={selectedGame}
        claiming={claiming}
        onClose={() => setSelectedGameId(null)}
        onUnlock={() => void claimGame()}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 14,
  },
  list: {
    gap: 8,
  },
  game: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    backgroundColor: colors.background,
    minHeight: 64,
    gap: 4,
  },
  gameOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  gameTitleOn: {
    color: colors.onAccent,
  },
  gameMetaOn: {
    color: colors.onAccent,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  centered: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  pinLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  pinDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  pinDotOn: {
    backgroundColor: colors.primary,
  },
  errorText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  padKey: {
    width: '31%',
    minHeight: 56,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padLabel: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  claim: {
    minHeight: 56,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimLabel: {
    color: colors.onAccent,
    fontSize: 18,
    fontWeight: '800',
  },
  retry: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    color: colors.onAccent,
    fontWeight: '800',
    fontSize: 16,
  },
  secondary: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 16,
  },
  link: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabel: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.55,
  },
});
