/** Compact Local cheer cards retain their legal notice, full team names and existing vote authority.
 * @sideEffects Existing useCheerPoll votes, usage telemetry and haptic feedback.
 */
import { useEffect, useRef, useState } from 'react';
import { type GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { cardShadow, colors, radii, SCOREBOARD_DIGITS } from '@/constants/theme';
import { COMPLIANCE_POLL } from '@/data/legal';
import { useSoftWall } from '@/context/SoftWallContext';
import { useCheerPoll, type CheerSide } from '@/hooks/useCheerPoll';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL, SPRING_CARD } from '@/theme/motion';

type CheerPollCardProps = {
  slug?: string;
  homeLabel?: string;
  awayLabel?: string;
};

type VoteFloat = {
  id: number;
  side: CheerSide;
  x: number;
  y: number;
};

const DEFAULT_HOME = 'Westlake Thunder';
const DEFAULT_AWAY = 'Lone Peak Knights';
const FLOAT_MS = 720;
const FLOAT_RISE = -60;

/**
 * @purpose Live community cheer poll (Westlake Thunder vs Lone Peak Knights). The share bar uses jade primary (ember only for LIVE heat on the away share). A chosen side is a white button with that color as a border, so it does not blend into the bar. A tap springs the bar from 0% to the new share, fires Medium haptics, floats +1 Vote ⚡ from the press point (+60px), and persists via `cast_cheer_vote`.
 * @param slug `cheer_polls.slug` (featured rivalry is `westlake-lone-peak`).
 * @param homeLabel Home school display name.
 * @param awayLabel Away school display name.
 * @returns Interactive poll card with AnimatedPressable options.
 * @sideEffects `useCheerPoll` Realtime + `cast_cheer_vote`, AsyncStorage vote side, `Haptics.impactAsync(Medium)`.
 */
export function CheerPollCard({
  slug = 'westlake-lone-peak',
  homeLabel = DEFAULT_HOME,
  awayLabel = DEFAULT_AWAY,
}: CheerPollCardProps) {
  const { poll, myVote, vote } = useCheerPoll(slug, homeLabel, awayLabel);
  const { requireAuth } = useSoftWall();
  const rawTotal = poll.home_votes + poll.away_votes;
  const homePct = rawTotal === 0 ? 50 : Math.round((poll.home_votes / rawTotal) * 100);
  const awayPct = rawTotal === 0 ? 50 : 100 - homePct;
  const total = rawTotal;
  const leading: CheerSide | null = homePct === awayPct ? null : homePct > awayPct ? 'home' : 'away';
  const homeWidth = useSharedValue(0);
  const awayWidth = useSharedValue(0);
  const replayFromZero = useRef(false);
  const [trackW, setTrackW] = useState(0);
  const [floats, setFloats] = useState<VoteFloat[]>([]);
  const floatSeq = useRef(0);

  useEffect(() => {
    if (replayFromZero.current) {
      homeWidth.value = 0;
      awayWidth.value = 0;
      replayFromZero.current = false;
    }
    homeWidth.value = withSpring(homePct, SPRING_CARD);
    awayWidth.value = withSpring(awayPct, SPRING_CARD);
  }, [awayPct, awayWidth, homePct, homeWidth]);

  const homeBar = useAnimatedStyle(() => ({
    width: trackW > 0 ? (homeWidth.value / 100) * trackW : 0,
  }));
  const awayBar = useAnimatedStyle(() => ({
    width: trackW > 0 ? (awayWidth.value / 100) * trackW : 0,
  }));

  const handleVote = (side: CheerSide, event?: GestureResponderEvent) => {
    if (myVote === side) return;
    const x = event?.nativeEvent.locationX ?? 48;
    const y = event?.nativeEvent.locationY ?? 18;
    // One cheer per account (20261022130000): guests sign in first, then the vote lands; signed-in fans vote at once.
    requireAuth({ kind: 'signin', resume: () => castVote(side, x, y) });
  };

  const castVote = (side: CheerSide, x: number, y: number) => {
    replayFromZero.current = true;
    telemetry.trackFeature('cheer_poll', 'local');
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Web / simulator may not expose a haptics engine.
    }
    const id = floatSeq.current + 1;
    floatSeq.current = id;
    setFloats((current) => [...current, { id, side, x, y }]);
    void vote(side);
  };

  const dropFloat = (id: number) => {
    setFloats((current) => current.filter((item) => item.id !== id));
  };

  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel="Cheer poll">
      {/* Compact: count joins the header; percentages live on the vote buttons. The policy line stays visible. */}
      <View style={styles.top}>
        <Text style={styles.kicker}>Live cheer poll</Text>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveLabel}>LIVE</Text>
        </View>
        <Text style={styles.voteCount}>{total.toLocaleString()} cheers</Text>
      </View>
      <Text style={styles.title}>
        Who are you riding with? <Text style={styles.matchup}>{homeLabel} vs {awayLabel}</Text>
      </Text>
      <Text style={styles.policy}>{COMPLIANCE_POLL}</Text>

      <View
        style={styles.track}
        onLayout={(event) => setTrackW(event.nativeEvent.layout.width)}
      >
        <Animated.View style={[styles.homeFill, homeBar]} />
        <Animated.View style={[styles.awayFill, awayBar]} />
      </View>

      <View style={styles.actions}>
        <TeamVoteButton
          side="home"
          label={homeLabel}
          pct={homePct}
          leading={leading === 'home'}
          selected={myVote === 'home'}
          floats={floats}
          onDropFloat={dropFloat}
          onPress={(event) => handleVote('home', event)}
        />
        <TeamVoteButton
          side="away"
          label={awayLabel}
          pct={awayPct}
          leading={leading === 'away'}
          selected={myVote === 'away'}
          floats={floats}
          onDropFloat={dropFloat}
          onPress={(event) => handleVote('away', event)}
        />
      </View>
    </View>
  );
}

function TeamVoteButton({
  side,
  label,
  pct,
  leading,
  selected,
  floats,
  onDropFloat,
  onPress,
}: {
  side: CheerSide;
  label: string;
  pct: number;
  leading: boolean;
  selected: boolean;
  floats: VoteFloat[];
  onDropFloat: (id: number) => void;
  onPress: (event: GestureResponderEvent) => void;
}) {
  return (
    <View style={styles.actionFlex}>
      {floats
        .filter((item) => item.side === side)
        .map((item) => (
          <CheerVoteFloat key={item.id} x={item.x} y={item.y} onDone={() => onDropFloat(item.id)} />
        ))}
      <AnimatedPressable
        haptic="none"
        scaleTo={0.94}
        accessibilityLabel={`Cheer ${label}, ${pct}%`}
        accessibilityState={{ selected }}
        onPress={onPress}
        contentStyle={[
          styles.teamBtn,
          side === 'home' ? styles.homeBtn : styles.awayBtn,
          selected && (side === 'home' ? styles.homeChosen : styles.awayChosen),
        ]}
      >
        <View style={[styles.teamDot, side === 'home' ? styles.teamDotHome : styles.teamDotAway, selected && styles.teamDotChosen]}>
          <View pointerEvents="none" style={styles.teamDotGloss} />
        </View>
        <Text style={[styles.teamBtnLabel, selected && (side === 'home' ? styles.homeLabelOn : styles.awayLabelOn)]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[side === 'home' ? styles.homePct : styles.awayPct, leading && styles.pctLeading]}>{pct}%</Text>
      </AnimatedPressable>
    </View>
  );
}

function CheerVoteFloat({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const rise = useSharedValue(0);
  const fade = useSharedValue(1);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const style = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: rise.value }],
  }));

  useEffect(() => {
    rise.value = withTiming(FLOAT_RISE, { duration: FLOAT_MS });
    fade.value = withTiming(0, { duration: FLOAT_MS });
    const timer = setTimeout(() => doneRef.current(), FLOAT_MS + 40);
    return () => clearTimeout(timer);
  }, [fade, rise]);

  return (
    <Animated.Text pointerEvents="none" style={[styles.floatBadge, { left: x - 42, top: y - 12 }, style]}>
      +1 Vote ⚡
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: FOCAL.mistGold,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    padding: 10,
    gap: 6,
    overflow: 'visible',
    ...cardShadow,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kicker: {
    color: FOCAL.goldInk,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: FOCAL.ember,
    backgroundColor: FOCAL.mistEmber,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: FOCAL.ember,
  },
  liveLabel: {
    color: FOCAL.emberInk,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  matchup: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  // Policy line: smaller than before but never clamped or muted into the background.
  policy: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  track: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  homeFill: {
    height: 6,
    backgroundColor: FOCAL.jadeInk,
  },
  awayFill: {
    height: 6,
    backgroundColor: colors.primaryMuted,
  },
  homePct: {
    ...SCOREBOARD_DIGITS,
    color: colors.primary,
    fontSize: 14,
  },
  awayPct: {
    ...SCOREBOARD_DIGITS,
    color: colors.primary,
    fontSize: 14,
  },
  pctLeading: {
    fontSize: 16,
  },
  voteCount: {
    marginLeft: 'auto',
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    overflow: 'visible',
  },
  actionFlex: {
    flex: 1,
    overflow: 'visible',
  },
  teamBtn: {
    minHeight: 44,
    flexDirection: 'row',
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  teamDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  teamDotHome: {
    backgroundColor: FOCAL.jadeInk,
  },
  teamDotAway: {
    backgroundColor: colors.primary,
  },
  teamDotGloss: {
    position: 'absolute',
    top: -6,
    left: -5,
    width: 20,
    height: 13,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ rotate: '-18deg' }],
  },
  homeBtn: {
    borderColor: FOCAL.jadeInk,
    backgroundColor: FOCAL.mistJade,
  },
  awayBtn: {
    borderColor: colors.border,
    backgroundColor: FOCAL.mistJade,
  },
  homeChosen: {
    backgroundColor: colors.surface,
    borderColor: FOCAL.jadeInk,
    borderWidth: 2.5,
  },
  awayChosen: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 2.5,
  },
  teamDotChosen: {
    borderWidth: 2,
    borderColor: colors.surface,
  },
  teamBtnLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
  homeLabelOn: {
    color: FOCAL.jadeInk,
  },
  awayLabelOn: {
    color: colors.primary,
  },
  floatBadge: {
    position: 'absolute',
    width: 84,
    zIndex: 4,
    textAlign: 'center',
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});
