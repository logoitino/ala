/**
 * Public athlete detail for guests (no sign-in): loads one player by id and shows the donor badge, hype counts
 * and basic details through `lib/roster`. Give opens Soft-Wall then TipCheckout (same gate as `/user/[id]`).
 * Reads and retained hype/gift callbacks belong to one route lifetime, so old work cannot replace the next player.
 * @sideEffects Player lookup through roster and hype hydration through lib/hype; Soft-Wall for Give.
 */

import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { FanBackerBadge } from '@/components/Profile/FanBackerBadge';
import { HypeBoard } from '@/components/Profile/HypeBoard';
import { ScreenShell } from '@/components/ScreenShell';
import { TipCheckout } from '@/components/TipCheckout';
import { useSoftWall } from '@/context/SoftWallContext';
import { cardShadow, colors, radii } from '@/constants/theme';
import { maloAthleteCta } from '@/data/malo';
import { displayValue, type PlayReactionId, type Player } from '@/data/players';
import { bumpPlayerHype, hydratePlayerHype, hypeFromPlayer } from '@/lib/hype';
import { fetchGuestPlayer } from '@/lib/roster';

export default function PlayerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playerId = Array.isArray(id) ? id[0] : id;
  const { requireAuth } = useSoftWall();

  const lifetime = useRef({ playerId, generation: 0 });
  if (lifetime.current.playerId !== playerId) lifetime.current = { playerId, generation: lifetime.current.generation + 1 };
  const generation = lifetime.current.generation;
  const mounted = useRef(false), read = useRef(0);
  const [frame, setFrame] = useState<{ generation: number; player: Player | null; loading: boolean; error: string | null }>({ generation, player: null, loading: true, error: null });
  const shown = frame.generation === generation ? frame : { generation, player: null, loading: true, error: null };
  const { player, loading, error } = shown;
  const [giveGeneration, setGiveGeneration] = useState<number | null>(null);
  const giveOpen = giveGeneration === generation;
  const currentRoute = () => mounted.current && lifetime.current.generation === generation;
  const setCurrentPlayer = (update: (current: Player) => Player) => {
    if (!currentRoute() || !player) return;
    setFrame(previous => previous.generation === generation && previous.player?.id === player.id
      ? { ...previous, player: update(previous.player) } : previous);
  };

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; ++read.current; }; }, []);

  const fetchPlayer = useCallback(async () => {
    if (!mounted.current || lifetime.current.generation !== generation) return;
    const request = ++read.current;
    const current = () => mounted.current && lifetime.current.generation === generation && read.current === request;
    const publish = (nextPlayer: Player | null, nextError: string | null) => {
      if (current()) setFrame({ generation, player: nextPlayer, error: nextError, loading: false });
    };
    if (!playerId) {
      publish(null, 'Missing player id.');
      return;
    }

    setFrame({ generation, player: null, loading: true, error: null });
    try {
      const { player: nextPlayer, error: queryError } = await fetchGuestPlayer(playerId);
      if (!current()) return;
      if (queryError || !nextPlayer || nextPlayer.id !== playerId) {
        publish(null, queryError ?? 'Player not found.');
        return;
      }
      const hydrated = await hydratePlayerHype(nextPlayer);
      publish(hydrated, null);
    } catch {
      publish(null, 'Could not load player. Please try again.');
    }
  }, [generation, playerId]);

  useEffect(() => {
    void fetchPlayer();
  }, [fetchPlayer]);

  if (loading) {
    return (
      <ScreenShell>
        <View style={styles.missing}>
          <ActivityIndicator size="large" color={colors.deepGreen} />
          <Text style={styles.missingText}>Loading player…</Text>
        </View>
      </ScreenShell>
    );
  }

  if (error || !player) {
    return (
      <ScreenShell>
        <View style={styles.missing}>
          <Text style={styles.missingTitle}>Couldn’t load player.</Text>
          <Text style={styles.missingText}>{error ?? 'Player not found.'}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void fetchPlayer()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  const initials = player.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoInitials}>{initials || '?'}</Text>
          </View>
          <Text style={styles.name}>{displayValue(player.name, 'Unknown player')}</Text>
          <Text style={styles.jersey}>#{displayValue(player.jersey_number)}</Text>
          <FanBackerBadge player={player} />
        </View>

        <HypeBoard
          hype={hypeFromPlayer(player)}
          interactive
          onBump={(kind: PlayReactionId) => {
            if (!currentRoute()) return;
            void bumpPlayerHype(player, kind).then((hype) => setCurrentPlayer(current => ({ ...current, ...hype }))).catch(() => undefined);
          }}
        />

        <View style={styles.details}>
          <DetailRow label="Position" value={displayValue(player.position)} />
          <DetailRow label="Height" value={displayValue(player.height)} />
          <DetailRow label="School" value={displayValue(player.school_name)} isLast />
        </View>

        {!giveOpen ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={maloAthleteCta(player.name)}
            onPress={() => {
              if (!currentRoute()) return;
              requireAuth({
                kind: 'malo',
                athleteName: player.name,
                athleteId: player.id,
                resume: () => { if (currentRoute()) setGiveGeneration(generation); },
              });
            }}
            style={({ pressed }) => [styles.giveButton, pressed && styles.pressed]}
          >
            <Text style={styles.giveLabel}>{maloAthleteCta(player.name)}</Text>
          </Pressable>
        ) : (
          <TipCheckout
            player={player}
            origin="profile"
            entry="in_app"
            onBacked={(nextCount) => setCurrentPlayer(current => ({ ...current, backer_count: nextCount }))}
          />
        )}

        <Text style={styles.disclaimer}>
          Independent Fan Support • Unaffiliated with UHSAA or official school athletic departments.
        </Text>
      </ScrollView>
    </ScreenShell>
  );
}

function DetailRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 24,
    paddingBottom: 16,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  missingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  missingText: {
    fontSize: 15,
    color: colors.textMuted,
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
  giveButton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    backgroundColor: colors.deepGreen,
    alignItems: 'center',
  },
  giveLabel: {
    color: colors.onAccent,
    fontWeight: '800',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.85,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
  },
  photoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.photoPlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  photoInitials: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  jersey: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  details: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    ...cardShadow,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 15,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
