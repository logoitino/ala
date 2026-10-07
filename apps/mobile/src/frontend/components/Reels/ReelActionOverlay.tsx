/**
 * Highlights overlay on top of each clip: athlete name and school, "Filmed by" credit, caption, and the right-hand
 * rail (Seki / Aura / Flex / donate / more). Photo stories add the current photo's description above the name.
 * Only Aura plays a burst; Seki swaps its emoji briefly; Flex lights up;
 * removing a vote never animates.
 */

import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useRef, useState } from 'react';

import { HypeBurst } from '@/components/Effects/HypeBurst';
import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors } from '@/constants/theme';
import { formatCompactCount } from '@/lib/hype';
import { formatTipDollars, type ReelHype } from '@/lib/reels';
import type { PlayReactionId } from '@/data/players';
import { maloAthleteCta } from '@/data/malo';
import { HYPE_FX } from '@/theme/hypeFx';
import { FOCAL, SPRING_BOUNCE } from '@/theme/motion';
import { useAppRuntime } from '@/context/AppRuntimeContext';

export const REEL_REACTIONS = [
  { id: 'seki' as const, emoji: '🤙', label: 'Seki' },
  { id: 'aura' as const, emoji: '⚡', label: 'Aura' },
  { id: 'flex' as const, emoji: '💪', label: 'Flex' },
];

type ReelActionOverlayProps = {
  athleteName: string;
  schoolName?: string;
  /** Actual roster context only; unknown jersey/position values remain absent. */
  jerseyNumber?: number | null;
  position?: string | null;
  caption?: string;
  /** Photo stories: the current photo's optional description, shown above the name and caption. */
  storyNote?: string | null;
  /** Confirmed account mentions, already joined for one line. */
  withAccounts?: string;
  /** Fan who filmed the clip ("🎥 Filmed by …"). Null when the athlete posted it. */
  filmedBy?: string | null;
  /** Tap on the filmer credit (opens `FilmerSheet`). */
  onOpenFilmer?: () => void;
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
 * @purpose TikTok-style Highlights chrome: name + school + filmer credit + caption bottom-left (7-tier color on the name), right rail Seki / Aura / Flex / Mālo / ⋯. Mālo is athlete-named; pending tags stay tappable but do not open PaymentSheet.
 * @param hype Live clip counters (optimistic local state).
 * @param onReact Toggles the tapped hype kind immediately; `reels` updates in the background. A second tap clears it.
 * @returns Overlay copy + action rail. Pointer-events box-none so video taps pass through.
 * @sideEffects Chip press spring. Aura adds `HypeBurst` + shout; Seki's 🤙 briefly turns into a 🏈; Flex just lights up. ⋯ opens `ReelMoreSheet`.
 */
export function ReelActionOverlay({
  athleteName,
  schoolName,
  jerseyNumber,
  position,
  caption,
  storyNote,
  withAccounts,
  filmedBy,
  onOpenFilmer,
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
  const [auraBurst, setAuraBurst] = useState<{ x: number; y: number; key: number } | null>(null);
  const railFrame = useRef({ x: 0, y: 0, width: 56 });
  const railScrollY = useRef(0);

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
          onAuraBurst={(chipY) => setAuraBurst({
            x: railFrame.current.x + railFrame.current.width / 2 - 110,
            y: railFrame.current.y + chipY - railScrollY.current + 24 - 110,
            key: Date.now(),
          })}
          onPress={() => onReact?.(reaction.id)}
        />
      );
    }
    if (id === 'malo' && live.buttons.malo) {
      const tipLabel = userTipped
        ? `Donated to ${athleteName}, ${formatTipDollars(hype.total_tips_cents)} total`
        : maloReady
          ? `${maloAthleteCta(athleteName)}, ${formatTipDollars(hype.total_tips_cents)} total`
          : `Confirm ${athleteName} on this clip before donating`;
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
            {userTipped ? 'Donated' : 'Donate'}
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

  const rosterDetails = [
    typeof jerseyNumber === 'number' && Number.isFinite(jerseyNumber) && jerseyNumber >= 0 ? `#${jerseyNumber}` : '',
    position?.trim() || '',
  ].filter(Boolean).join(' · ');
  const copy = (
    <View style={styles.copy}>
      <ScrollView style={styles.copyScroll} contentContainerStyle={styles.copyContent} nestedScrollEnabled>
        {storyNote ? (
          <Text style={styles.storyNote} numberOfLines={4}>
            {storyNote}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${athleteName} profile, ${auraLabel}${rosterDetails ? `, ${rosterDetails}` : ''}`}
          accessibilityState={{ disabled: !canOpenAthlete || !onOpenAthlete }}
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
          <Text style={styles.athleteName} numberOfLines={2}>
            {athleteName}
          </Text>
        </Pressable>
        {rosterDetails ? <Text style={styles.rosterDetails} numberOfLines={2}>{rosterDetails}</Text> : null}
        {rail.showSchool && schoolName ? (
          <Text style={styles.school} numberOfLines={2}>
            {schoolName}
          </Text>
        ) : null}
        {filmedBy ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Filmed by ${filmedBy}. Open filmer`}
            disabled={!onOpenFilmer}
            haptic="selection"
            hitSlop={6}
            onPress={onOpenFilmer}
          >
            <Text style={styles.filmedBy} numberOfLines={1}>
              🎥 Filmed by {filmedBy}
            </Text>
          </Pressable>
        ) : null}
        {withAccounts ? (
          <Text style={styles.caption} numberOfLines={1}>
            With {withAccounts}
          </Text>
        ) : null}
        {rail.showCaption && caption ? (
          <Text style={styles.caption} numberOfLines={2}>
            {caption}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );

  const railCol = <ScrollView
    style={styles.railScroll}
    contentContainerStyle={styles.rail}
    nestedScrollEnabled
    onLayout={({ nativeEvent }) => { railFrame.current = nativeEvent.layout; }}
    onScroll={({ nativeEvent }) => { railScrollY.current = nativeEvent.contentOffset.y; }}
    scrollEventThrottle={16}
  >{railNodes}</ScrollView>;

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
      {auraBurst ? (
        // Effects live beside the scroll viewport so its clipping cannot cut off the Aura burst.
        <View pointerEvents="none" style={[styles.burstLayer, { left: auraBurst.x, top: auraBurst.y }]}>
          <HypeBurst key={auraBurst.key} kind="aura" scale={1.35} onDone={() => setAuraBurst(null)} />
        </View>
      ) : null}
    </View>
  );
}

// Seki's little moment, like YouTube's themed like button: the 🤙 turns into a football for a beat,
// then turns back. Aura is the only chip with the full burst; Flex just lights up.
const SEKI_BALL = '🏈';

function ReactionChip({
  kind,
  emoji,
  label,
  count,
  selected,
  disabled,
  ink,
  onPress,
  onAuraBurst,
}: {
  kind: PlayReactionId;
  emoji: string;
  label: string;
  count: number;
  selected: boolean;
  disabled: boolean;
  ink: string;
  onPress: () => void;
  onAuraBurst: (chipY: number) => void;
}) {
  const fx = HYPE_FX[kind];
  const reduceMotion = useReducedMotion();
  const chipY = useRef(0);
  const rise = useSharedValue(0);
  const fade = useSharedValue(0);
  // 0 = hand showing, 1 = football showing.
  const ball = useSharedValue(0);
  const ballPop = useSharedValue(1);
  const ballSpin = useSharedValue(0);
  const shoutStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: rise.value }],
  }));
  const handStyle = useAnimatedStyle(() => ({
    opacity: 1 - ball.value,
    transform: [{ scale: 1 - ball.value * 0.5 }],
  }));
  const ballStyle = useAnimatedStyle(() => ({
    opacity: ball.value,
    transform: [{ scale: ballPop.value }, { rotate: `${ballSpin.value}deg` }],
  }));

  const fire = () => {
    if (disabled) return;
    // Only an adding tap animates. Removing is instant, so a quick un-tap never fights an effect.
    if (!selected && !reduceMotion) {
      if (kind === 'aura') {
        rise.value = 0;
        fade.value = 1;
        rise.value = withTiming(-36, { duration: 520 });
        fade.value = withTiming(0, { duration: 520 });
        onAuraBurst(chipY.current);
      } else if (kind === 'seki') {
        cancelAnimation(ball);
        ball.value = withSequence(withTiming(1, { duration: 110 }), withDelay(520, withTiming(0, { duration: 180 })));
        ballPop.value = withSequence(withTiming(1.35, { duration: 140 }), withSpring(1, SPRING_BOUNCE));
        ballSpin.value = withSequence(withTiming(-35, { duration: 0 }), withSpring(0, SPRING_BOUNCE));
      }
    }
    onPress();
  };

  return (
    <View style={styles.chipWrap} onLayout={({ nativeEvent }) => { chipY.current = nativeEvent.layout.y; }}>
      {kind === 'aura' ? (
        <Animated.Text pointerEvents="none" style={[styles.plusOne, { color: fx.color }, shoutStyle]}>
          {fx.shout}
        </Animated.Text>
      ) : null}
      <AnimatedPressable
        accessibilityLabel={selected ? `Remove ${label}` : `${label} ${count}`}
        accessibilityState={{ disabled, selected }}
        disabled={disabled}
        haptic={kind === 'aura' ? 'medium' : 'light'}
        scaleTo={0.88}
        onPress={fire}
        contentStyle={[
          styles.react,
          { borderColor: selected ? fx.color : `${fx.color}55` },
          selected && { backgroundColor: fx.color, shadowColor: fx.color },
          disabled && !selected && styles.disabled,
        ]}
      >
        <View style={styles.emojiSlot}>
          <Animated.Text style={[styles.reactEmoji, kind === 'seki' && handStyle]}>{emoji}</Animated.Text>
          {kind === 'seki' ? (
            <Animated.Text
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={[styles.reactEmoji, styles.ballEmoji, ballStyle]}
            >
              {SEKI_BALL}
            </Animated.Text>
          ) : null}
        </View>
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
    maxHeight: '100%',
    flexGrow: 1,
  },
  copyScroll: { maxHeight: '100%', flexGrow: 0 },
  // When text grows, scroll inside the available clip area instead of covering the scoreboard.
  copyContent: {
    gap: 4,
    paddingBottom: 4,
    paddingRight: 4,
  },
  athleteHit: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderWidth: 2,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
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
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  rosterDetails: {
    color: colors.onVideo,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  school: {
    color: 'rgba(243,251,247,0.82)',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  filmedBy: {
    color: 'rgba(243,251,247,0.82)',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  storyNote: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    color: colors.onVideo,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    backgroundColor: colors.videoScrimSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 2,
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
    minWidth: 56,
  },
  railScroll: { maxHeight: '100%', flexGrow: 0, flexShrink: 0, minWidth: 56, maxWidth: '40%' },
  chipWrap: {
    minWidth: 56,
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
    minWidth: 48,
    minHeight: 48,
    paddingVertical: 4,
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
  emojiSlot: {
    minWidth: 26,
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  ballEmoji: {
    position: 'absolute',
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
    minWidth: 48,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: FOCAL.videoBase,
    borderWidth: 2,
    borderColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
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
