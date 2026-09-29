import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, FadeOutUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { TipCheckout } from '@/components/TipCheckout';
import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
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
import { HYPE_FX } from '@/theme/hypeFx';
import { FOCAL, SPRING_CARD } from '@/theme/motion';

type PlayCardProps = {
  event: GameEventWithPlayer;
  onBacked?: (playerId: string, nextCount: number) => void;
  onOpenAthlete?: (playerId: string) => void;
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

function compactStat(player: Player | null, time: string): string {
  const bits: string[] = [];
  if (player?.position) bits.push(player.position);
  if (time) bits.push(time);
  if (player) bits.push(`${player.backer_count} donors`);
  return bits.join('  ·  ');
}

/**
 * @purpose Local play-by-play card. The athlete and the play stay in front; a chevron enlarges the same card to Seki / Aura / Flex and Mālo.
 * @param event `game_events` row with optional joined player.
 * @param onBacked Fires after a compact Mālo on this athlete.
 * @param onOpenAthlete Opens `/user/[id]` when the athlete name is tapped.
 * @returns Collapsed play row, or the same card opened downward.
 * @sideEffects Optimistic local counts plus `bumpPlayerHype` RPC when a player is tagged. Mālo uses `TipCheckout`.
 */
export function PlayCard({ event, onBacked, onOpenAthlete }: PlayCardProps) {
  const player = resolveEventPlayer(event);
  const [counts, setCounts] = useState(() => getCounts(event.id));
  const [sekiHint, setSekiHint] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [open, setOpen] = useState(false);
  const chevron = useSharedValue(0);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tone = actionTone(event.event_type);
  const playTitle = event.event_type.trim() || 'Play';
  const time = formatPlayTime(event.created_at);
  const stat = compactStat(player, time);
  const detail = event.description?.trim() ?? '';
  const showDetail = detail.length > 0 && detail.toLowerCase() !== playTitle.toLowerCase();

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevron.value * 180}deg` }],
  }));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    chevron.value = withSpring(next ? 1 : 0, SPRING_CARD);
  };

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
          <Pressable
            accessibilityRole={player && onOpenAthlete ? 'button' : undefined}
            accessibilityLabel={player ? `Open ${player.name} profile` : undefined}
            disabled={!player || !onOpenAthlete}
            haptic="selection"
            onPress={() => {
              if (player && onOpenAthlete) onOpenAthlete(player.id);
            }}
            style={styles.nameHit}
          >
            <Text style={styles.name} numberOfLines={1}>
              {displayValue(player?.name, 'Unknown player')}
            </Text>
          </Pressable>
          <Text style={[styles.play, tagText[tone]]} numberOfLines={1}>
            {playTitle}
          </Text>
          {stat ? (
            <Text style={styles.stat} numberOfLines={1}>
              {stat}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? 'Hide Donate and reactions' : 'Show Donate and reactions'}
          haptic="selection"
          onPress={toggle}
          style={styles.chevronHit}
        >
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-down" size={28} color={FOCAL.goldInk} />
          </Animated.View>
        </Pressable>
      </View>

      {open ? (
        <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOutUp.duration(160)} style={styles.drawer}>
          {showDetail ? <Text style={styles.headline}>{detail}</Text> : null}
          <View style={[styles.tag, tagStyles[tone], styles.tagInline]}>
            <Text style={styles.tagLabel}>{formatActionTag(event.event_type)}</Text>
          </View>
      <View style={styles.reactions}>
        {PLAY_REACTIONS.map((reaction) => {
          const fx = HYPE_FX[reaction.id];
          const tapped = counts[reaction.id] > 0;
          return (
            <AnimatedPressable
              key={reaction.id}
              accessibilityLabel={`${reaction.label} ${reaction.emoji}, ${counts[reaction.id]} taps`}
              accessibilityState={{ disabled: reacting }}
              disabled={reacting}
              haptic="medium"
              scaleTo={0.92}
              overshoot
              onPress={() => bump(reaction.id)}
              style={styles.reactionHit}
              contentStyle={[
                styles.reaction,
                { borderColor: fx.color },
                tapped && { backgroundColor: `${fx.color}22` },
              ]}
            >
              {reaction.id === 'seki' && sekiHint ? (
                <View style={styles.tooltip} pointerEvents="none">
                  <Text style={styles.tooltipLabel}>Awesome</Text>
                </View>
              ) : null}
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              <Text style={[styles.reactionLabel, { color: fx.color }]}>{reaction.label}</Text>
              <Text
                style={[
                  styles.reactionCount,
                  { color: fx.color },
                  reaction.id === 'seki' && sekiHint && styles.reactionHint,
                ]}
              >
                {reaction.id === 'seki' && sekiHint ? 'Awesome' : counts[reaction.id]}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {player ? (
        <TipCheckout
          player={player}
          compact
          origin="live"
          onBacked={(nextCount) => onBacked?.(player.id, nextCount)}
        />
      ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const tagStyles = StyleSheet.create({
  td: { backgroundColor: colors.accent },
  tackle: { backgroundColor: colors.primary },
  sack: { backgroundColor: FOCAL.ember },
  play: { backgroundColor: colors.primaryMuted },
});

const tagText = StyleSheet.create({
  td: { color: colors.accent },
  tackle: { color: colors.primary },
  sack: { color: FOCAL.ember },
  play: { color: colors.deepGreen },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: FOCAL.mistGold,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
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
    backgroundColor: FOCAL.goldInk,
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
  nameHit: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  play: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  stat: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chevronHit: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawer: {
    gap: 12,
  },
  tagInline: {
    alignSelf: 'flex-start',
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
  reactionHit: {
    flex: 1,
  },
  reaction: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 2,
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
