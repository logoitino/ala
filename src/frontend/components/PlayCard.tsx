import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { TipCheckout } from '@/components/TipCheckout';
import { cardShadow, colors, radii } from '@/constants/theme';
import {
  PLAY_REACTIONS,
  displayValue,
  emptyReactionCounts,
  formatActionTag,
  type Player,
  type PlayReactionId,
} from '@/data/players';
import { bumpPlayerHype } from '@/lib/hype';
import type { GameEventWithPlayer } from '@/types/database';

type PlayCardProps = {
  event: GameEventWithPlayer;
  onBacked?: (playerId: string, nextCount: number) => void;
};

export function resolveEventPlayer(event: GameEventWithPlayer): Player | null {
  if (!event.players) return null;
  return Array.isArray(event.players) ? (event.players[0] ?? null) : event.players;
}

const reactionStore = new Map<string, Record<PlayReactionId, number>>();

function getCounts(eventId: string): Record<PlayReactionId, number> {
  return reactionStore.get(eventId) ?? emptyReactionCounts();
}

function formatPlayTime(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function actionTone(eventType: string): 'td' | 'tackle' | 'sack' | 'play' {
  const value = eventType.toLowerCase();
  if (value.includes('touchdown') || value === 'td') return 'td';
  if (value.includes('tackle')) return 'tackle';
  if (value.includes('sack')) return 'sack';
  return 'play';
}

export function PlayCard({ event, onBacked }: PlayCardProps) {
  const player = resolveEventPlayer(event);
  const [counts, setCounts] = useState(() => getCounts(event.id));
  const [sekiHint, setSekiHint] = useState(false);
  const [reacting, setReacting] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tone = actionTone(event.event_type);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  const revealSekiHint = (persist = false) => {
    setSekiHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    if (persist) return;
    hintTimer.current = setTimeout(() => setSekiHint(false), 1800);
  };

  const bump = (id: PlayReactionId) => {
    if (reacting) return;
    const current = getCounts(event.id);
    const next = { ...current, [id]: current[id] + 1 };
    reactionStore.set(event.id, next);
    setCounts(next);
    if (id === 'seki') revealSekiHint();
    if (player) {
      setReacting(true);
      void bumpPlayerHype(player, id).finally(() => setReacting(false));
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.jersey}>
          <Text style={styles.jerseyHash}>#</Text>
          <Text style={styles.jerseyNumber}>
            {displayValue(player?.jersey_number, '—')}
          </Text>
        </View>
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>
            {displayValue(player?.name, 'Unknown player')}
          </Text>
          <Text style={styles.meta}>
            {displayValue(player?.position)}
            {event.created_at ? `  ·  ${formatPlayTime(event.created_at)}` : ''}
          </Text>
        </View>
        <View style={[styles.tag, tagStyles[tone]]}>
          <Text style={styles.tagLabel}>{formatActionTag(event.event_type)}</Text>
        </View>
      </View>

      <Text style={styles.headline}>
        {displayValue(
          event.description,
          player
            ? `#${displayValue(player.jersey_number)} ${displayValue(player.name)}`
            : 'Play',
        )}
      </Text>

      <View style={styles.reactions}>
        {PLAY_REACTIONS.map((reaction) => (
          <Pressable
            key={reaction.id}
            accessibilityRole="button"
            accessibilityLabel={`${reaction.label} ${reaction.emoji}, ${counts[reaction.id]} taps`}
            accessibilityHint={reaction.id === 'seki' ? 'Awesome' : undefined}
            onPress={() => bump(reaction.id)}
            disabled={reacting}
            onHoverIn={() => {
              if (reaction.id === 'seki') revealSekiHint(true);
            }}
            onHoverOut={() => {
              if (reaction.id === 'seki') setSekiHint(false);
            }}
            style={({ pressed }) => [
              styles.reaction,
              reaction.id === 'seki' && styles.sekiReaction,
              pressed && styles.reactionPressed,
            ]}
          >
            {reaction.id === 'seki' && sekiHint ? (
              <View style={styles.tooltip} pointerEvents="none">
                <Text style={styles.tooltipLabel}>Awesome</Text>
              </View>
            ) : null}
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            <Text style={styles.reactionLabel}>{reaction.label}</Text>
            <Text
              style={[
                styles.reactionCount,
                reaction.id === 'seki' && sekiHint && styles.reactionHint,
              ]}
            >
              {reaction.id === 'seki' && sekiHint ? 'Awesome' : counts[reaction.id]}
            </Text>
          </Pressable>
        ))}
      </View>

      {player ? (
        <TipCheckout
          player={player}
          compact
          onBacked={(nextCount) => onBacked?.(player.id, nextCount)}
        />
      ) : null}
    </View>
  );
}

const tagStyles = StyleSheet.create({
  td: { backgroundColor: colors.accent },
  tackle: { backgroundColor: colors.primary },
  sack: { backgroundColor: '#7C2D12' },
  play: { backgroundColor: colors.primaryMuted },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    ...cardShadow,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  jersey: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyHash: {
    color: colors.onAccent,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: -4,
  },
  jerseyNumber: {
    color: colors.onAccent,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  identity: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tag: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tagLabel: {
    color: colors.onAccent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headline: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.text,
  },
  reactions: {
    flexDirection: 'row',
    gap: 8,
  },
  reaction: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 2,
    overflow: 'visible',
  },
  reactionPressed: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.primary,
    transform: [{ scale: 0.98 }],
  },
  sekiReaction: {
    borderColor: colors.gold,
    backgroundColor: colors.accentSoft,
    overflow: 'visible',
  },
  tooltip: {
    position: 'absolute',
    top: -28,
    alignSelf: 'center',
    backgroundColor: colors.deepGreen,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 2,
  },
  tooltipLabel: {
    color: colors.onAccent,
    fontSize: 11,
    fontWeight: '800',
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  reactionCount: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
  },
  reactionHint: {
    color: colors.deepGreen,
    fontSize: 11,
  },
});
