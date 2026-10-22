/** Compact Local cheer cards retain their legal notice, full team names and existing vote authority.
 * @sideEffects Existing useCheerPoll votes, usage telemetry and haptic feedback.
 */
import { useEffect, useRef, useState } from 'react';
import { type GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { cardShadow, colors, radii } from '@/constants/theme';
import { COMPLIANCE_POLL } from '@/data/legal';
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
 * @purpose Live community cheer poll (Westlake Thunder vs Lone Peak Knights). The share bar stays jade and cyan. A chosen side is a white button with that color as a border, so it does not blend into the bar. A tap springs the bar from 0% to the new share, fires Medium haptics, floats +1 Vote ⚡ from the press point (+60px), and persists via `cast_cheer_vote`.
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
    replayFromZero.current = true;
    telemetry.trackFeature('cheer_poll', 'local');
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Web / simulator may not expose a haptics engine.
    }
    const id = floatSeq.current + 1;
    floatSeq.current = id;
    const x = event?.nativeEvent.locationX ?? 48;
    const y = event?.nativeEvent.locationY ?? 18;
    setFloats((current) => [...current, { id, side, x, y }]);
    void vote(side);
  };

  const dropFloat = (id: number) => {
    setFloats((current) => current.filter((item) => item.id !== id));
  };

  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel="Cheer poll">
      <View style={styles.top}>
        <Text style={styles.kicker}>Live cheer poll</Text>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveLabel}>LIVE</Text>
        </View>
      </View>
      <Text style={styles.title}>Who are you riding with?</Text>
      <Text style={styles.matchup}>{COMPLIANCE_POLL}</Text>
      <Text style={styles.matchup}>
        {homeLabel} vs {awayLabel}
      </Text>

      <View
        style={styles.track}
        onLayout={(event) => setTrackW(event.nativeEvent.layout.width)}
      >
        <Animated.View style={[styles.homeFill, homeBar]} />
        <Animated.View style={[styles.awayFill, awayBar]} />
      </View>

      <View style={styles.pctRow}>
        <Text style={[styles.homePct, leading === 'home' && styles.pctLeading]}>{homePct}%</Text>
        <Text style={styles.voteCount}>{total.toLocaleString()} cheers</Text>
        <Text style={[styles.awayPct, leading === 'away' && styles.pctLeading]}>{awayPct}%</Text>
      </View>

      <View style={styles.actions}>
        <TeamVoteButton
          side="home"
          label={homeLabel}
          selected={myVote === 'home'}
          floats={floats}
          onDropFloat={dropFloat}
          onPress={(event) => handleVote('home', event)}
        />
        <TeamVoteButton
          side="away"
          label={awayLabel}
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
  selected,
  floats,
  onDropFloat,
  onPress,
}: {
  side: CheerSide;
  label: string;
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
        accessibilityLabel={`Cheer ${label}`}
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
        <Text style={[styles.teamBtnLabel, selected && (side === 'home' ? styles.homeLabelOn : styles.awayLabelOn)]} numberOfLines={2}>
          {label}
        </Text>
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
    padding: 12,
    gap: 10,
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
    fontSize: 16,
    fontWeight: '800',
  },
  matchup: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  track: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  homeFill: {
    height: 12,
    backgroundColor: FOCAL.jadeInk,
  },
  awayFill: {
    height: 12,
    backgroundColor: FOCAL.islandCyan,
  },
  pctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homePct: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  awayPct: {
    color: FOCAL.cyanInk,
    fontSize: 16,
    fontWeight: '800',
  },
  pctLeading: {
    fontSize: 19,
  },
  voteCount: {
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
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  teamDotHome: {
    backgroundColor: FOCAL.jadeInk,
  },
  teamDotAway: {
    backgroundColor: FOCAL.cyanInk,
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
    borderColor: FOCAL.islandCyan,
    backgroundColor: FOCAL.mistCyan,
  },
  homeChosen: {
    backgroundColor: colors.surface,
    borderColor: FOCAL.jadeInk,
    borderWidth: 2.5,
  },
  awayChosen: {
    backgroundColor: colors.surface,
    borderColor: FOCAL.cyanInk,
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
    color: FOCAL.cyanInk,
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
