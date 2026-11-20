/** Compact Local cheer cards retain their legal notice, full team names and existing vote authority.
 * UX-12: names wrap, scaled text can stack choices, and smaller decorative dots free room for copy.
 * Vibrant Daylight rivalry chrome (Lovable Friday Night Lights): jade home, cyan away, ember LIVE.
 * @sideEffects Existing useCheerPoll votes, usage telemetry and haptic feedback.
 */
import { useEffect, useRef, useState } from 'react';
import { type GestureResponderEvent, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { cardShadow, colors, radii, SCOREBOARD_DIGITS } from '@/constants/theme';
import { COMPLIANCE_POLL } from '@/data/legal';
import { useSoftWall } from '@/context/SoftWallContext';
import { useCheerPoll, type CheerSide } from '@/hooks/useCheerPoll';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL, SPRING_CARD } from '@/theme/motion';
import { DISPLAY_TEXT, figtree, TYPE } from '@/theme/fonts';

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
 * @purpose Live community cheer poll (Westlake Thunder vs Lone Peak Knights). Share bar: jade home /
 *   island cyan away; LIVE heat stays ember. Chosen side is a white button with that color border.
 *   Tap springs the bar, Medium haptics, floats +1 Vote ⚡, persists via `cast_cheer_vote`.
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
      <View style={styles.ribbon} />
      <View style={styles.top}>
        <Text style={styles.kicker}>Live cheer poll</Text>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveLabel}>LIVE</Text>
        </View>
        <Text style={styles.voteCount}>{total.toLocaleString()} cheers</Text>
      </View>
      <Text style={styles.title}>Who are you riding with?</Text>
      <Text style={styles.matchup}>
        <Text style={styles.homeName}>{homeLabel}</Text>
        {'  vs  '}
        <Text style={styles.awayName}>{awayLabel}</Text>
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
  const { fontScale } = useWindowDimensions();
  return (
    // Large native text gets the whole row rather than squeezing the team name beside its percentage.
    <View style={[styles.actionFlex, fontScale > 1.3 && styles.actionFull]}>
      {floats
        .filter((item) => item.side === side)
        .map((item) => (
          <CheerVoteFloat key={item.id} x={item.x} y={item.y} side={side} onDone={() => onDropFloat(item.id)} />
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
        <Text style={[styles.teamBtnLabel, selected && (side === 'home' ? styles.homeLabelOn : styles.awayLabelOn)]}>
          {label}
        </Text>
        <Text style={[side === 'home' ? styles.homePct : styles.awayPct, leading && styles.pctLeading]}>{pct}%</Text>
      </AnimatedPressable>
    </View>
  );
}

function CheerVoteFloat({ x, y, side, onDone }: { x: number; y: number; side: CheerSide; onDone: () => void }) {
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
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.floatBadge,
        side === 'home' ? styles.floatHome : styles.floatAway,
        { left: x - 42, top: y - 12 },
        style,
      ]}
    >
      +1 Vote ⚡
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: FOCAL.islandCyan,
    padding: 12,
    gap: 8,
    overflow: 'visible',
    ...cardShadow,
  },
  ribbon: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: FOCAL.neonJade,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  kicker: {
    color: FOCAL.jadeInk,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: FOCAL.ember,
    backgroundColor: FOCAL.mistEmber,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: FOCAL.ember,
  },
  liveLabel: {
    color: FOCAL.emberInk,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.8,
  },
  title: {
    color: colors.text,
    ...TYPE.title,
    ...DISPLAY_TEXT,
    letterSpacing: -0.2,
  },
  matchup: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('600'),
  },
  homeName: {
    color: FOCAL.jadeInk,
    ...figtree('900'),
  },
  awayName: {
    color: FOCAL.cyanInk,
    ...figtree('900'),
  },
  // Required policy stays fully visible at the same readable size as the matchup copy.
  policy: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('600'),
  },
  track: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: FOCAL.mistViolet,
    borderWidth: 1,
    borderColor: colors.border,
  },
  homeFill: {
    height: 8,
    backgroundColor: FOCAL.neonJade,
  },
  awayFill: {
    height: 8,
    backgroundColor: FOCAL.islandCyan,
  },
  homePct: {
    ...SCOREBOARD_DIGITS,
    color: FOCAL.jadeInk,
    fontSize: 15,
  },
  awayPct: {
    ...SCOREBOARD_DIGITS,
    color: FOCAL.cyanInk,
    fontSize: 15,
  },
  pctLeading: {
    fontSize: 17,
  },
  voteCount: {
    marginLeft: 'auto',
    color: FOCAL.violetInk,
    ...TYPE.caption,
    ...figtree('800'),
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    overflow: 'visible',
  },
  // 140pt minimum stacks the choices on a 320pt phone; wider phones keep the compact pair.
  actionFull: { flexBasis: '100%' },
  actionFlex: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 140,
    overflow: 'visible',
  },
  teamBtn: {
    minHeight: 48,
    flexDirection: 'row',
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  teamDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  teamDotHome: {
    backgroundColor: FOCAL.neonJade,
  },
  teamDotAway: {
    backgroundColor: FOCAL.islandCyan,
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
    borderColor: FOCAL.cyanInk,
    backgroundColor: FOCAL.mistCyan,
  },
  homeChosen: {
    backgroundColor: colors.surface,
    borderColor: FOCAL.neonJade,
    borderWidth: 2.5,
  },
  awayChosen: {
    backgroundColor: colors.surface,
    borderColor: FOCAL.islandCyan,
    borderWidth: 2.5,
  },
  teamDotChosen: {
    borderWidth: 2,
    borderColor: colors.surface,
  },
  teamBtnLabel: {
    color: colors.text,
    ...TYPE.button,
    ...figtree('800'),
    textAlign: 'center',
    flex: 1,
    minWidth: 0,
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
    fontSize: 13,
    ...figtree('800'),
  },
  floatHome: {
    color: FOCAL.jadeInk,
  },
  floatAway: {
    color: FOCAL.cyanInk,
  },
});
