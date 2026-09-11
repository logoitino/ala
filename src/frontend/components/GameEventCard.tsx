import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TipCheckout } from '@/components/TipCheckout';
import { cardShadow, colors, radii } from '@/constants/theme';
import { displayValue, type Player } from '@/data/players';
import type { GameEventWithPlayer } from '@/types/database';

type GameEventCardProps = {
  event: GameEventWithPlayer;
  onBacked?: (playerId: string, nextCount: number) => void;
  onPressPlayer?: (player: Player) => void;
};

export function resolveEventPlayer(event: GameEventWithPlayer): Player | null {
  if (!event.players) return null;
  return Array.isArray(event.players) ? (event.players[0] ?? null) : event.players;
}

function formatPlayTime(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function EventCardBody({
  event,
  player,
  onBacked,
  onPressPlayer,
}: {
  event: GameEventWithPlayer;
  player: Player | null;
  onBacked?: (playerId: string, nextCount: number) => void;
  onPressPlayer?: (player: Player) => void;
}) {
  return (
    <>
      <View style={styles.header}>
        <View style={styles.actionBadge}>
          <Text style={styles.actionLabel}>{displayValue(event.event_type, 'Play')}</Text>
        </View>
        <Text style={styles.time}>{formatPlayTime(event.created_at)}</Text>
      </View>

      <Text style={styles.headline}>
        {displayValue(
          event.description,
          player
            ? `#${displayValue(player.jersey_number)} ${displayValue(player.name)}`
            : 'Unknown player',
        )}
      </Text>
      {player ? <Text style={styles.meta}>{displayValue(player.position)}</Text> : null}

      {player && !onPressPlayer ? (
        <TipCheckout
          player={player}
          compact
          onBacked={(nextCount) => onBacked?.(player.id, nextCount)}
        />
      ) : player && onPressPlayer ? (
        <Text style={styles.tipHint}>Tap to send a $3 / $5 / $10 tip</Text>
      ) : null}
    </>
  );
}

export function GameEventCard({ event, onBacked, onPressPlayer }: GameEventCardProps) {
  const player = resolveEventPlayer(event);

  if (onPressPlayer && player) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onPressPlayer(player)}
        style={styles.card}
      >
        <EventCardBody
          event={event}
          player={player}
          onBacked={onBacked}
          onPressPlayer={onPressPlayer}
        />
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <EventCardBody event={event} player={player} onBacked={onBacked} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
    ...cardShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionBadge: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  time: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  headline: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 14,
    color: colors.textMuted,
  },
  tipHint: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
});
