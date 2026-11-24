/**
 * Highlights overlay on top of each clip: athlete name and school, "Filmed by" credit, caption, and the right-hand
 * rail (Seki / Aura / Flex / give / more). Photo stories add the current photo's description above the name.
 * Only Aura plays a burst; Seki swaps its emoji briefly; Flex lights up.
 * Selecting springs the rail chip up a little. Clearing dips it, then the fill drains.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 * UX-21 keeps reaction stories off the identity block because the existing rail already owns those actions.
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

import { SportIcon } from '@/components/UI/SportIcon';
import { HypeBurst } from '@/components/Effects/HypeBurst';
import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, SCOREBOARD_DIGITS } from '@/constants/theme';
import { formatCompactCount } from '@/lib/hype';
import { formatTipDollars, type ReelHype } from '@/lib/reels';
import type { PlayReactionId } from '@/data/players';
import { maloAthleteCta } from '@/data/malo';
import { HYPE_FX } from '@/theme/hypeFx';
import { FOCAL, SPRING_BOUNCE, SPRING_SHEET } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';
import { useAppRuntime } from '@/context/AppRuntimeContext';

export const REEL_REACTIONS = [
  { id: 'seki' as const, emoji: '🤙', label: 'Seki' },
  { id: 'aura' as const, emoji: '⚡', label: 'Aura' },
  { id: 'flex' as const, emoji: '💪', label: 'Flex' },
];

type ReelActionOverlayProps = {
  athleteName: string;
  sport?: string | null;
  /**
   * The athlete tag's state (PRIV-01): an approved tag shows a solid ✓ chip, a pending one a grey dashed "Tag
   * pending" chip, so viewers can tell them apart. Omitted: no chip.
   */
  tagState?: 'approved' | 'pending';
  schoolName?: string;
  /** Actual roster context only; unknown jersey/position values remain absent. */
  jerseyNumber?: number | null;
  position?: string | null;
  caption?: string;
  /** Photo stories: the current photo's optional description, shown above the name and caption. */
  storyNote?: string | null;
  /** FEED-01 signed-in "Why this clip" line. Guests omit. Never shows a score number. */
  whyThisClip?: string | null;
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
  /** Clip is already on the Seki pill even before three Seki taps. */
  sekiPlay?: boolean;
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
  sport,
  tagState,
  schoolName,
  jerseyNumber,
  position,
  caption,
  storyNote,
  whyThisClip,
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
  // Video chrome must retain bright contrast even when Look publishes a light-page palette.
  const jade = FOCAL.neonJade;
  const ink = FOCAL.videoBase;
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
        ? `Sent a gift to ${athleteName}, ${formatTipDollars(hype.total_tips_cents)} total`
        : maloReady
          ? `${maloAthleteCta(athleteName)}, ${formatTipDollars(hype.total_tips_cents)} total`
          : `Confirm ${athleteName} on this clip before giving`;
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
            { backgroundColor: userTipped ? jade : colors.onVideo, borderColor: userTipped ? jade : colors.onVideo },
            (!canTip || tipping || !maloReady) && styles.disabled,
          ]}
        >
          <Text style={[styles.maloLabel, { color: ink }]}>
            {userTipped ? 'Gift sent' : 'Give'}
          </Text>
          <Text style={[styles.maloTotal, { color: ink }]} numberOfLines={1}>
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
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.onVideo} />
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
          <SportIcon sport={sport} color={FOCAL.neonJade} size={18} />
          <Text style={styles.athleteName}>
            {athleteName}
          </Text>
        </Pressable>
        {tagState ? (
          <View style={[styles.tagChip, tagState === 'approved' ? styles.tagChipApproved : styles.tagChipPending]}
            accessibilityLabel={tagState === 'approved' ? `${athleteName} approved this tag` : 'Tag waiting for the athlete to approve'}>
            <Text style={[styles.tagChipLabel, tagState === 'pending' && styles.tagChipLabelPending]}>
              {tagState === 'approved' ? '✓ Tagged' : 'Tag pending'}
            </Text>
          </View>
        ) : null}
        {rosterDetails ? <Text style={styles.rosterDetails} numberOfLines={2}>{rosterDetails}</Text> : null}
        {rail.showSchool && schoolName ? (
          <Text style={styles.school}>
            {schoolName}
          </Text>
        ) : null}
        {whyThisClip ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Why this clip: ${whyThisClip}`}
            haptic="selection"
            hitSlop={6}
            style={styles.whyHit}
            onPress={() => undefined}
          >
            <Text style={styles.whyLine} numberOfLines={2}>
              {whyThisClip}
            </Text>
          </Pressable>
        ) : null}
        {filmedBy ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Filmed by ${filmedBy}. Open filmer`}
            disabled={!onOpenFilmer}
            haptic="selection"
            hitSlop={6}
            style={styles.filmerHit}
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

const HALO_RINGS = [
  { size: 58, opacity: 0.16 },
  { size: 52, opacity: 0.28 },
  { size: 48, opacity: 0.4 },
] as const;

/** Soft selected glow, painted in rings so the rail cannot clip a shadow against the circle. */
function HypeHalo({ kind, color }: { kind: PlayReactionId; color: string }) {
  return (
    <View pointerEvents="none" testID={`hype-halo-${kind}`} style={styles.haloSlot}>
      {HALO_RINGS.map((ring) => (
        <View
          key={ring.size}
          style={{
            position: 'absolute',
            width: ring.size,
            height: ring.size,
            borderRadius: ring.size / 2,
            backgroundColor: color,
            opacity: ring.opacity,
            top: (48 - ring.size) / 2,
            left: (48 - ring.size) / 2,
          }}
        />
      ))}
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
  const settle = useSharedValue(1);
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

  const settleStyle = useAnimatedStyle(() => ({ transform: [{ scale: settle.value }] }));

  const fire = () => {
    if (disabled) return;
    if (!reduceMotion) {
      if (!selected) {
        settle.value = withSequence(withTiming(1.08, { duration: 90 }), withSpring(1, SPRING_BOUNCE));
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
      } else {
        settle.value = withSequence(withTiming(0.86, { duration: 90 }), withSpring(1, SPRING_SHEET));
      }
    }
    onPress();
  };

  return (
    <Animated.View style={[styles.chipWrap, settleStyle]} onLayout={({ nativeEvent }) => { chipY.current = nativeEvent.layout.y; }}>
      {kind === 'aura' ? (
        <Animated.Text pointerEvents="none" style={[styles.plusOne, { color: fx.color }, shoutStyle]}>
          {fx.shout}
        </Animated.Text>
      ) : null}
      <View style={styles.face}>
        {selected ? <HypeHalo kind={kind} color={fx.color} /> : null}
        <AnimatedPressable
          accessibilityLabel={selected ? `Remove ${label}` : `${label} ${count}`}
          accessibilityState={{ disabled, selected }}
          disabled={disabled}
          haptic={kind === 'aura' ? 'medium' : 'light'}
          scaleTo={0.88}
          onPress={fire}
          contentStyle={[
            styles.react,
            selected
              ? { backgroundColor: fx.color, borderWidth: 0 }
              : { borderColor: `${fx.color}99` },
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
      </View>
      <Text style={[styles.reactLabel, selected && { color: fx.color }]}>{label}</Text>
    </Animated.View>
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
    borderRadius: 999,
    minHeight: 44,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
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
    ...TYPE.section,
    flexShrink: 1,
    ...figtree('900'),
    letterSpacing: -0.4,
  },
  rosterDetails: {
    color: colors.onVideo,
    ...TYPE.caption,

    ...figtree('800'),
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tagChip: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  tagChipApproved: { backgroundColor: 'rgba(0,115,60,0.92)', borderColor: 'rgba(0,115,60,0.92)' },
  tagChipPending: { backgroundColor: 'rgba(0,0,0,0.35)', borderColor: 'rgba(243,251,247,0.7)', borderStyle: 'dashed' },
  tagChipLabel: { color: '#FFFFFF', ...TYPE.caption, ...figtree('800') },
  tagChipLabelPending: { color: 'rgba(243,251,247,0.9)' },
  school: {
    color: 'rgba(243,251,247,0.82)',
    ...TYPE.caption,
    ...figtree('700'),
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  whyHit: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', maxWidth: '92%' },
  whyLine: {
    color: 'rgba(243,251,247,0.72)',
    ...TYPE.caption,
    ...figtree('600'),
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  filmerHit: { minHeight: 44, justifyContent: 'center' },
  filmedBy: {
    color: 'rgba(243,251,247,0.82)',
    ...TYPE.caption,
    ...figtree('700'),
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  storyNote: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    color: colors.onVideo,
    ...TYPE.body,
    ...figtree('600'),
    backgroundColor: colors.videoScrimSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 2,
  },
  caption: {
    color: colors.onVideo,
    ...TYPE.body,
    ...figtree('600'),
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  rail: {
    gap: 6,
    alignItems: 'center',
    minWidth: 56,
    paddingVertical: 6,
  },
  railScroll: { maxHeight: '100%', flexGrow: 0, flexShrink: 0, minWidth: 56, maxWidth: '42%' },
  chipWrap: {
    minWidth: 56,
    maxWidth: '100%',
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
    ...TYPE.body,
    ...figtree('900'),
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // Decorative halo stays small; content grows vertically with accessible text sizing.
  face: {
    minWidth: 48,
    maxWidth: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloSlot: {
    position: 'absolute',
    width: 48,
    height: 48,
    top: '50%',
    left: '50%',
    marginTop: -24,
    marginLeft: -24,
  },
  // Glass rail buttons (2026-11 Lovable refresh): translucent light over the clip, neon when chosen.
  react: {
    minWidth: 44,
    maxWidth: '100%',
    minHeight: 44,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 22,
    backgroundColor: 'rgba(244,247,245,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(244,247,245,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
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
    ...TYPE.caption,
    ...figtree('800'),
    textAlign: 'center',
    marginTop: 2,
  },
  reactCount: { ...figtree('400'),
    ...SCOREBOARD_DIGITS,
    color: colors.onVideo,
    ...TYPE.caption,
    maxWidth: '100%',
    textAlign: 'center',
    marginTop: -2,
  },
  reactCountOn: {
    color: FOCAL.ink,
  },
  malo: {
    minWidth: 48,
    minHeight: 48,
    maxWidth: '100%',
    borderRadius: 24,
    backgroundColor: colors.onVideo,
    borderWidth: 2,
    borderColor: colors.onVideo,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  maloLabel: {
    color: FOCAL.videoBase,
    ...TYPE.button,
    ...figtree('800'),
    textAlign: 'center',
  },
  maloTotal: { ...figtree('400'),
    ...SCOREBOARD_DIGITS,
    color: FOCAL.videoBase,
    ...TYPE.caption,
  },
  maloTipped: {
    backgroundColor: FOCAL.neonJade,
    borderColor: FOCAL.neonJade,
  },
  maloLabelTipped: {
    color: FOCAL.ink,
  },
  more: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 22,
    backgroundColor: 'rgba(244,247,245,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(244,247,245,0.22)',
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
