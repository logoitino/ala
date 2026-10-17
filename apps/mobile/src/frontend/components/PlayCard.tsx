/**
 * A live game play in the Local feed: who made it and what happened, with a hype tap for that athlete.
 * `resolveEventPlayer` picks the athlete a play event belongs to; `onBacked` reports the new count after a tap.
 * @sideEffects The first select of each kind calls `bumpPlayerHype`. A second tap clears it and does not add another point.
 */

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { TipCheckout } from '@/components/TipCheckout';
import { SheetRise } from '@/components/UI/SheetRise';
import { maloAthleteCta } from '@/data/malo';
import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { cardShadow, colors, radii } from '@/constants/theme';
import {
  PLAY_REACTIONS,
  displayValue,
  formatActionTag,
  type Player,
  type PlayReactionId,
} from '@/data/players';
import { bumpPlayerHype } from '@/lib/hype';
import {
  emptyPlayVotes,
  loadPlayVotes,
  savePlayVotes,
  togglePlayVote,
  type PlayReactionVotes,
} from '@/lib/playVotes';
import type { GameEventWithPlayer } from '@/types/database';
import { HYPE_FX } from '@/theme/hypeFx';
import { FOCAL, SPRING_BOUNCE, SPRING_SHEET } from '@/theme/motion';

type PlayCardProps = {
  event: GameEventWithPlayer;
  onBacked?: (playerId: string, nextCount: number) => void;
  onOpenAthlete?: (playerId: string) => void;
};

export function resolveEventPlayer(event: GameEventWithPlayer): Player | null {
  if (!event.players) return null;
  return Array.isArray(event.players) ? (event.players[0] ?? null) : event.players;
}

const playVoteStore = new Map<string, PlayReactionVotes>();

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

function LiveReaction({
  id,
  emoji,
  label,
  color,
  selected,
  onPress,
}: {
  id: PlayReactionId;
  emoji: string;
  label: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const wasSelected = useRef(selected);

  useEffect(() => {
    if (wasSelected.current === selected) return;
    const clearing = wasSelected.current && !selected;
    wasSelected.current = selected;
    if (reduce) return;
    scale.value = withSequence(
      withTiming(clearing ? 0.86 : 1.08, { duration: 90 }),
      withSpring(1, clearing ? SPRING_SHEET : SPRING_BOUNCE),
    );
  }, [reduce, scale, selected]);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.reactionHit, scaleStyle]}>
      <AnimatedPressable
        accessibilityLabel={selected ? `Remove ${label}` : label}
        accessibilityState={{ selected }}
        haptic="medium"
        scaleTo={0.92}
        onPress={onPress}
        style={styles.reactionHit}
        contentStyle={[
          styles.reaction,
          { borderColor: color },
          selected && { backgroundColor: color },
        ]}
      >
        {id === 'seki' && selected ? (
          <View style={styles.tooltip} pointerEvents="none">
            <Text style={styles.tooltipLabel}>Awesome</Text>
          </View>
        ) : null}
        <Text style={styles.reactionEmoji}>{emoji}</Text>
        <Text style={[styles.reactionLabel, { color: selected ? FOCAL.ink : color }]}>{label}</Text>
        <Text style={[styles.reactionCount, { color: selected ? FOCAL.ink : color }]}>{selected ? 1 : 0}</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

/**
 * @purpose Local play-by-play card. Opening the card celebrates the play with Seki, Aura and Flex. Donate is a button that opens the donation only after that tap.
 * @param event `game_events` row with optional joined player.
 * @param onBacked Fires after a donation on this athlete.
 * @param onOpenAthlete Opens `/user/[id]` when the athlete name is tapped.
 * @returns Collapsed play row, or the same card opened downward.
 * @sideEffects One `bumpPlayerHype` per kind the first time it is selected. Later taps only select and clear. Donation uses `TipCheckout` after Donate.
 */
export function PlayCard({ event, onBacked, onOpenAthlete }: PlayCardProps) {
  const player = resolveEventPlayer(event);
  const [votes, setVotes] = useState<PlayReactionVotes>(() => playVoteStore.get(event.id) ?? emptyPlayVotes());
  const [open, setOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const chevron = useSharedValue(0);
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
    if (!next) setDonateOpen(false);
    chevron.value = withSpring(next ? 1 : 0, SPRING_SHEET);
  };

  useEffect(() => {
    let live = true;
    void loadPlayVotes(event.id).then((stored) => {
      if (!live) return;
      playVoteStore.set(event.id, stored);
      setVotes(stored);
    });
    return () => {
      live = false;
    };
  }, [event.id]);

  const bump = (id: PlayReactionId) => {
    const current = playVoteStore.get(event.id) ?? votes;
    const result = togglePlayVote(current, id);
    playVoteStore.set(event.id, result.next);
    setVotes(result.next);
    void savePlayVotes(event.id, result.next);
    if (result.credit && player) void bumpPlayerHype(player, id);
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
          accessibilityLabel={open ? 'Hide reactions' : 'Show reactions'}
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
        <SheetRise style={styles.drawer}>
          {showDetail ? <Text style={styles.headline}>{detail}</Text> : null}
          <View style={[styles.tag, tagStyles[tone], styles.tagInline]}>
            <Text style={styles.tagLabel}>{formatActionTag(event.event_type)}</Text>
          </View>
          <View style={styles.reactions}>
            {PLAY_REACTIONS.map((reaction) => (
              <LiveReaction
                key={reaction.id}
                id={reaction.id}
                emoji={reaction.emoji}
                label={reaction.label}
                color={HYPE_FX[reaction.id].color}
                selected={votes.selected[reaction.id]}
                onPress={() => bump(reaction.id)}
              />
            ))}
          </View>
          <Text style={styles.celebrate}>Tap Aura, Flex, or Seki to celebrate this play.</Text>

          {player && !donateOpen ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={maloAthleteCta(player.name)}
              haptic="medium"
              onPress={() => setDonateOpen(true)}
              style={styles.donate}
            >
              <Text style={styles.donateLabel}>{maloAthleteCta(player.name)}</Text>
            </Pressable>
          ) : null}
          {player && donateOpen ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to celebrating"
                haptic="selection"
                onPress={() => setDonateOpen(false)}
                style={styles.donateBack}
              >
                <Text style={styles.donateBackLabel}>Back to celebrating</Text>
              </Pressable>
              <TipCheckout
                player={player}
                compact
                origin="live"
                onBacked={(nextCount) => onBacked?.(player.id, nextCount)}
              />
            </>
          ) : null}
        </SheetRise>
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
  celebrate: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  donate: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: FOCAL.jadeInk,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  donateLabel: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '800',
  },
  donateBack: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donateBackLabel: {
    color: FOCAL.jadeInk,
    fontSize: 15,
    fontWeight: '700',
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
});
