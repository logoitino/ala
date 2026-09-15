import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SwipeableBannerWrapper } from '@/components/Common/SwipeableBannerWrapper';
import { colors, palette, radii } from '@/constants/theme';
import { displayValue, getQuarterCode } from '@/data/players';
import { useLiveGame } from '@/hooks/useLiveGame';
import { useSportConfigs } from '@/hooks/useSportConfigs';
import { localGameHref } from '@/lib/navigation';
import { telemetry } from '@/services/TelemetryManager';
import { SPRING_BOUNCE, SPRING_CARD, FOCAL } from '@/theme/motion';

type LiveMatchBannerProps = {
  gameId?: string | null;
  overlay?: boolean;
  playToasts?: boolean;
  /** Parent-owned `useLiveGame()` snapshot so the Reel feed does not open a second Realtime channel. */
  live?: ReturnType<typeof useLiveGame>;
};

/** Games the fan has swiped away this session. Cleared when that game’s score changes. */
const dismissedLiveGames = new Set<string>();

const TOAST_MS = 2200;

/**
 * @purpose Top-floating Obsidian live-match badge for the Reel feed: score, quarter, pulse, and operator play toasts.
 * @param gameId Optional `games.id`. When omitted, `useLiveGame` follows the featured live match.
 * @param overlay Absolutely positions over highlight video.
 * @param playToasts When false, skip the postgres play toast (Reel uses `ReelCard` Broadcast banners).
 * @param live Optional parent snapshot; when set, this banner does not open its own Realtime channel.
 * @returns Compact live banner plus an optional play-by-play toast, both swipe-up dismissible. Tap the scoreboard to open the Local game.
 * @sideEffects `useLiveGame` Realtime unless `live` is passed; `Haptics.notificationAsync(Success)` when a play lands; Light impact on banner dismiss; `feature_tap` live_banner on open.
 */
export function LiveMatchBanner({
  gameId,
  overlay = false,
  playToasts = true,
  live: liveFromParent,
}: LiveMatchBannerProps) {
  const router = useRouter();
  const hooked = useLiveGame(gameId, { enabled: !liveFromParent });
  const {
    game,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    clockLabel,
    isLive,
    lastPlay,
    clearLastPlay,
  } = liveFromParent ?? hooked;
  const { configFor } = useSportConfigs();
  const insets = useSafeAreaInsets();
  const [isDismissed, setIsDismissed] = useState(false);

  const scoreScale = useSharedValue(1);
  const pulse = useSharedValue(1);
  const prevHome = useRef<number | null>(null);
  const prevAway = useRef<number | null>(null);
  const prevGameId = useRef<string | null>(null);

  useEffect(() => {
    const id = game?.id ?? null;
    if (id !== prevGameId.current) {
      prevGameId.current = id;
      prevHome.current = homeScore;
      prevAway.current = awayScore;
      setIsDismissed(id ? dismissedLiveGames.has(id) : false);
      return;
    }
    const homeUp = prevHome.current !== null && homeScore > prevHome.current;
    const awayUp = prevAway.current !== null && awayScore > prevAway.current;
    prevHome.current = homeScore;
    prevAway.current = awayScore;
    if (!homeUp && !awayUp) return;
    if (id) dismissedLiveGames.delete(id);
    setIsDismissed(false);
    scoreScale.value = withSequence(withSpring(1.18, SPRING_BOUNCE), withSpring(1, SPRING_CARD));
  }, [awayScore, game?.id, homeScore, scoreScale]);

  useEffect(() => {
    if (!isLive) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(0.35, { duration: 640, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [isLive, pulse]);

  useEffect(() => {
    if (!playToasts || !lastPlay) return;
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Web / simulator may not expose a haptics engine.
    }
    const timer = setTimeout(() => clearLastPlay(), TOAST_MS);
    return () => clearTimeout(timer);
  }, [clearLastPlay, lastPlay, playToasts]);

  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.85 + (1 - pulse.value) * 0.35 }],
  }));

  if (!game) return null;
  if (isDismissed && !(playToasts && lastPlay)) return null;

  const quarterLabel = getQuarterCode(game);
  const callout = lastPlay
    ? configFor(game.sport).callouts.find((item) => item.eventType === lastPlay.eventType)
    : null;
  const toastTitle = callout
    ? `${callout.emoji} ${callout.label}`
    : lastPlay
      ? lastPlay.eventType
      : '';

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, overlay && styles.overlay, overlay && { paddingTop: Math.max(insets.top, 8) }]}
    >
      {isDismissed ? null : (
        <SwipeableBannerWrapper
          accessibilityLabel="Dismiss live scoreboard"
          onPress={() => {
            if (!game.id) return;
            telemetry.trackFeature('live_banner', 'home');
            router.push(localGameHref(game.id));
          }}
          onDismiss={() => {
            if (game.id) dismissedLiveGames.add(game.id);
            setIsDismissed(true);
          }}
        >
          <View style={styles.badge} accessibilityRole="summary" accessibilityLabel="Live match">
            <View style={styles.metaRow}>
              <View style={styles.liveChip}>
                <Animated.View style={[styles.pulse, !isLive && styles.pulseIdle, pulseStyle]} />
                <Text style={styles.liveLabel}>{isLive ? 'LIVE' : quarterLabel}</Text>
              </View>
              <Text style={styles.quarter}>
                {quarterLabel} · {clockLabel}
              </Text>
            </View>
            <Text style={styles.matchup} numberOfLines={1}>
              {displayValue(homeTeam)} vs {displayValue(awayTeam)}
            </Text>
            <Animated.Text style={[styles.scoreline, scoreStyle]} numberOfLines={1}>
              {displayValue(homeTeam)} {homeScore} - {awayScore} {displayValue(awayTeam)}
            </Animated.Text>
          </View>
        </SwipeableBannerWrapper>
      )}

      {playToasts && lastPlay ? (
        <SwipeableBannerWrapper accessibilityLabel="Dismiss play toast" onDismiss={clearLastPlay}>
          <PlayToast title={toastTitle} detail={lastPlay.description} />
        </SwipeableBannerWrapper>
      ) : null}
    </View>
  );
}

function PlayToast({ title, detail }: { title: string; detail: string }) {
  const opacity = useSharedValue(0);
  const rise = useSharedValue(-12);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 160 });
    rise.value = withSpring(0, SPRING_CARD);
    scale.value = withSpring(1, SPRING_BOUNCE);
  }, [opacity, rise, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: rise.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.toast, style]} accessibilityLiveRegion="assertive">
      <Text style={styles.toastTitle}>{title}</Text>
      {detail ? (
        <Text style={styles.toastDetail} numberOfLines={2}>
          {detail}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    zIndex: 24,
  },
  badge: {
    alignSelf: 'stretch',
    backgroundColor: colors.videoScrim,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.45)',
    paddingHorizontal: 12,
    paddingRight: 36,
    paddingVertical: 10,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: FOCAL.ember,
  },
  pulseIdle: {
    backgroundColor: colors.onVideoMuted,
  },
  liveLabel: {
    color: FOCAL.ember,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  quarter: {
    color: colors.onVideoMuted,
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  matchup: {
    color: colors.onVideoMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  scoreline: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  toast: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: palette.midnightObsidian,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: 14,
    paddingRight: 36,
    paddingVertical: 12,
    gap: 2,
  },
  toastTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  toastDetail: {
    color: colors.onVideo,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
