import { Platform, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useState } from 'react';

import { HypeBurst } from '@/components/Effects/HypeBurst';
import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors } from '@/constants/theme';
import { formatCompactCount } from '@/lib/hype';
import { formatTipDollars, type ReelHype } from '@/lib/reels';
import type { PlayReactionId } from '@/data/players';
import { maloAthleteCta } from '@/data/malo';
import { HYPE_FX } from '@/theme/hypeFx';
import { FOCAL } from '@/theme/motion';
import { useAppRuntime } from '@/context/AppRuntimeContext';

export const REEL_REACTIONS = [
  { id: 'seki' as const, emoji: '🤙', label: 'Seki' },
  { id: 'aura' as const, emoji: '⚡', label: 'Aura' },
  { id: 'flex' as const, emoji: '💪', label: 'Flex' },
];

type ReelActionOverlayProps = {
  athleteName: string;
  schoolName?: string;
  caption?: string;
  auraColor: string;
  auraGlow?: string;
  auraLabel: string;
  hype: ReelHype;
  voted?: { seki: boolean; aura: boolean; flex: boolean };
  userTipped?: boolean;
  tipping?: boolean;
  canTip?: boolean;
  /** When false, Mālo still taps (open profile / toast) but PaymentSheet is not ready. */
  maloReady?: boolean;
  canOpenAthlete?: boolean;
  reacting?: boolean;
  onOpenAthlete?: () => void;
  onTip?: () => void;
  onReact?: (kind: PlayReactionId) => void;
  onOpenMore?: () => void;
};

/**
 * @purpose TikTok-style Highlights chrome: name + school + caption bottom-left (7-tier color on the name), right rail Seki / Aura / Flex / Mālo / ⋯. Mālo is athlete-named; pending tags stay tappable but do not open PaymentSheet.
 * @param hype Live clip counters (optimistic local state).
 * @param onReact Toggles the tapped hype kind immediately; `reels` updates in the background. A second tap clears it.
 * @returns Overlay copy + action rail. Pointer-events box-none so video taps pass through.
 * @sideEffects Chip springs (0.88 → 1.15 → 1.0) plus `HypeBurst` particles; ⋯ opens `ReelMoreSheet`.
 */
export function ReelActionOverlay({
  athleteName,
  schoolName,
  caption,
  auraColor,
  auraGlow,
  auraLabel,
  hype,
  voted,
  userTipped = false,
  tipping = false,
  canTip = true,
  maloReady = true,
  canOpenAthlete = false,
  reacting = false,
  onOpenAthlete,
  onTip,
  onReact,
  onOpenMore,
}: ReelActionOverlayProps) {
  const { live } = useAppRuntime();
  const reactions = REEL_REACTIONS.filter((reaction) => live.buttons[reaction.id]);
  const rail = live.highlights;
  const jade = live.theme.jade;
  const ink = live.theme.background;

  const railNodes = rail.railOrder.map((id) => {
    if (id === 'seki' || id === 'aura' || id === 'flex') {
      const reaction = reactions.find((item) => item.id === id);
      if (!reaction) return null;
      const value =
        reaction.id === 'seki' ? hype.seki_count : reaction.id === 'aura' ? hype.aura_count : hype.flex_count;
      return (
        <ReactionChip
          key={reaction.id}
          kind={reaction.id}
          emoji={reaction.emoji}
          label={reaction.label}
          count={value}
          selected={Boolean(voted?.[reaction.id])}
          disabled={reacting || !onReact}
          ink={ink}
          onPress={() => onReact?.(reaction.id)}
        />
      );
    }
    if (id === 'malo' && live.buttons.malo) {
      const tipLabel = userTipped
        ? `Mālo sent to ${athleteName}, ${formatTipDollars(hype.total_tips_cents)} total`
        : maloReady
          ? `${maloAthleteCta(athleteName)}, ${formatTipDollars(hype.total_tips_cents)} total`
          : `Confirm ${athleteName} on this clip before Mālo`;
      return (
        <AnimatedPressable
          key="malo"
          accessibilityLabel={tipLabel}
          accessibilityState={{ disabled: !canTip || tipping || !onTip }}
          disabled={!canTip || tipping || !onTip}
          scaleTo={0.88}
          overshoot
          onPress={onTip}
          contentStyle={[
            styles.malo,
            { backgroundColor: userTipped ? jade : ink, borderColor: jade },
            userTipped ? null : { shadowColor: jade },
            (!canTip || tipping || !maloReady) && styles.disabled,
          ]}
        >
          <Text style={[styles.maloLabel, { color: userTipped ? ink : jade }]}>
            {userTipped ? "Mālo'd" : 'Mālo'}
          </Text>
          <Text style={[styles.maloTotal, { color: userTipped ? ink : jade }]} numberOfLines={1}>
            {maloReady || userTipped ? formatTipDollars(hype.total_tips_cents) : 'Tag'}
          </Text>
        </AnimatedPressable>
      );
    }
    if (id === 'more' && live.buttons.more) {
      return (
        <AnimatedPressable
          key="more"
          accessibilityLabel="More options"
          accessibilityState={{ disabled: !onOpenMore }}
          disabled={!onOpenMore}
          scaleTo={0.88}
          overshoot
          onPress={onOpenMore}
          contentStyle={styles.more}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.onVideo} />
        </AnimatedPressable>
      );
    }
    return null;
  });

  const copy = (
    <View style={styles.copy}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${athleteName} profile, ${auraLabel}`}
        disabled={!canOpenAthlete || !onOpenAthlete}
        onPress={onOpenAthlete}
        style={({ pressed }) => [
          styles.athleteHit,
          {
            borderColor: auraColor,
            shadowColor: auraColor,
            ...Platform.select({
              web: auraGlow ? { boxShadow: `0 0 10px ${auraGlow}` } : {},
              default: {},
            }),
          },
          pressed && styles.pressed,
          (!canOpenAthlete || !onOpenAthlete) && styles.disabled,
        ]}
      >
        <Text style={styles.athleteName} numberOfLines={1}>
          {athleteName}
        </Text>
      </Pressable>
      {rail.showSchool && schoolName ? (
        <Text style={styles.school} numberOfLines={1}>
          {schoolName}
        </Text>
      ) : null}
      {rail.showCaption && caption ? (
        <Text style={styles.caption} numberOfLines={2}>
          {caption}
        </Text>
      ) : null}
    </View>
  );

  const railCol = <View style={styles.rail}>{railNodes}</View>;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        rail.namePlacement === 'top' && styles.wrapTop,
        rail.railSide === 'left' && styles.wrapFlip,
      ]}
      accessibilityLabel={`${athleteName} highlight`}
    >
      {copy}
      {railCol}
    </View>
  );
}

function ReactionChip({
  kind,
  emoji,
  label,
  count,
  selected,
  disabled,
  ink,
  onPress,
}: {
  kind: PlayReactionId;
  emoji: string;
  label: string;
  count: number;
  selected: boolean;
  disabled: boolean;
  ink: string;
  onPress: () => void;
}) {
  const fx = HYPE_FX[kind];
  const [burstKey, setBurstKey] = useState(0);
  const rise = useSharedValue(0);
  const fade = useSharedValue(0);
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: rise.value }],
  }));

  const fire = () => {
    if (disabled) return;
    // Tapping a selected chip removes the vote, so only an adding tap earns the burst and shout.
    if (!selected) {
      rise.value = 0;
      fade.value = 1;
      rise.value = withTiming(-36, { duration: 520 });
      fade.value = withTiming(0, { duration: 520 });
      setBurstKey((current) => current + 1);
    }
    onPress();
  };

  return (
    <View style={styles.chipWrap}>
      {burstKey > 0 ? (
        <View pointerEvents="none" style={styles.burstLayer}>
          <HypeBurst key={burstKey} kind={kind} scale={1.35} onDone={() => setBurstKey(0)} />
        </View>
      ) : null}
      <Animated.Text pointerEvents="none" style={[styles.plusOne, { color: fx.color }, badgeStyle]}>
        {fx.shout}
      </Animated.Text>
      <AnimatedPressable
        accessibilityLabel={selected ? `Remove ${label}` : `${label} ${count}`}
        accessibilityState={{ disabled, selected }}
        disabled={disabled}
        haptic="medium"
        scaleTo={0.84}
        overshoot
        onPress={fire}
        contentStyle={[
          styles.react,
          { borderColor: selected ? fx.color : `${fx.color}55` },
          selected && { backgroundColor: fx.color, shadowColor: fx.color },
          disabled && !selected && styles.disabled,
        ]}
      >
        <Text style={styles.reactEmoji}>{emoji}</Text>
        <Text style={[styles.reactCount, selected && { color: ink }]}>{formatCompactCount(count)}</Text>
      </AnimatedPressable>
      <Text style={[styles.reactLabel, selected && { color: fx.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 10,
    overflow: 'visible',
  },
  wrapTop: {
    justifyContent: 'flex-start',
    paddingTop: 12,
  },
  wrapFlip: {
    flexDirection: 'row-reverse',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingBottom: 4,
    paddingRight: 4,
  },
  athleteHit: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.videoScrim,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  athleteName: {
    color: colors.onVideo,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  school: {
    color: 'rgba(243,251,247,0.82)',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  caption: {
    color: colors.onVideo,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  rail: {
    gap: 6,
    alignItems: 'center',
    width: 56,
  },
  chipWrap: {
    width: 56,
    alignItems: 'center',
    overflow: 'visible',
    zIndex: 2,
  },
  burstLayer: {
    // Deliberately much wider than the 56pt chip so the burst can clear the button.
    // `chipWrap`/`wrap` both set overflow:'visible' so this is allowed to spill.
    position: 'absolute',
    width: 220,
    height: 220,
    left: -82,
    top: -86,
    zIndex: 4,
  },
  plusOne: {
    position: 'absolute',
    top: -10,
    zIndex: 5,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  react: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.videoScrim,
    borderWidth: 1.5,
    borderColor: 'rgba(243,251,247,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.85,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  reactOn: {
    backgroundColor: FOCAL.neonJade,
    borderColor: FOCAL.neonJade,
  },
  reactEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  reactLabel: {
    color: 'rgba(243,251,247,0.88)',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  reactCount: {
    color: colors.onVideo,
    fontSize: 10,
    fontWeight: '800',
    marginTop: -2,
  },
  reactCountOn: {
    color: FOCAL.ink,
  },
  malo: {
    width: 48,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: FOCAL.videoBase,
    borderWidth: 2,
    borderColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  maloLabel: {
    color: FOCAL.neonJade,
    fontSize: 10,
    fontWeight: '800',
  },
  maloTotal: {
    color: FOCAL.neonJade,
    fontSize: 11,
    fontWeight: '800',
  },
  maloTipped: {
    backgroundColor: FOCAL.neonJade,
    borderColor: FOCAL.neonJade,
  },
  maloLabelTipped: {
    color: FOCAL.ink,
  },
  more: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.videoScrim,
    borderWidth: 1,
    borderColor: 'rgba(243,251,247,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.5,
  },
});
