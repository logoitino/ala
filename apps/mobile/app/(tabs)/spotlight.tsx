/** UX-07: Spotlight presents published athlete recognition without declaring a pending board empty; UX-13 close delays cannot navigate after leaving the route. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ScrollFxItem, ScrollFxParallax, ScrollFxScrollView } from '@/components/Effects/ScrollFx';
import { ScreenHeading } from '@/components/ScreenHeading';
import { LeaderboardsBoard } from '@/components/Spotlight/LeaderboardsBoard';
import { SpotlightAwardCard } from '@/components/Spotlight/SpotlightAwardCard';
import { SpotlightModal } from '@/components/Spotlight/SpotlightModal';
import { ReelViewModal } from '@/components/Reels/ReelViewModal';
import { RuntimePaused } from '@/components/RuntimePaused';
import { TabScreen } from '@/components/TabScreen';
import { MaloTipModal } from '@/components/TipSheetModal';
import { EmptyState } from '@/components/UI/EmptyState';
import { colors, space } from '@/constants/theme';
import { TYPE } from '@/theme/fonts';
import { useAuth } from '@/context/AuthContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { displayValue } from '@/data/players';
import type { HighlightClip } from '@/data/highlights';
import { useLeaderboards } from '@/hooks/useLeaderboards';
import { useRoster } from '@/hooks/useRoster';
import { useSpotlightBoard } from '@/hooks/useSpotlightBoard';
import { useSurfaceUsage } from '@/hooks/useSurfaceUsage';
import { isAuraUuid } from '@/lib/aura';
import { userProfileHref } from '@/lib/navigation';
import { FOCAL } from '@/theme/motion';
import type { Player, SpotlightAward } from '@/types/database';

/**
 * @purpose Fan-bar Spotlight tab: reopen Player of the Week/Month after the Highlights launch popup is dismissed. The featured card zooms in, past awards tilt up as the board scrolls, heading drifts with parallax.
 * @sideEffects `useSpotlightBoard` + `useLeaderboards` (Boards, `layouts.leaderboards`) on focus; `SpotlightModal` replay; `ReelViewModal` for Watch Full Highlight; `MaloTipModal` PaymentSheet; `useSurfaceUsage` dwell / taps.
 */
export default function SpotlightTab() {
  const router = useRouter();
  const { isSessionCurrent } = useAuth();
  const navigation = useRef<{ mounted: boolean; generation: number; timer: ReturnType<typeof setTimeout> | null }>({ mounted: true, generation: 0, timer: null });
  const cancelNavigation = useCallback(() => {
    navigation.current.generation += 1;
    if (navigation.current.timer) clearTimeout(navigation.current.timer);
    navigation.current.timer = null;
  }, []);
  const current = () => navigation.current.mounted && (!isSessionCurrent || isSessionCurrent());
  const afterClose = (work: () => void, delay: number) => {
    cancelNavigation(); const generation = navigation.current.generation;
    navigation.current.timer = setTimeout(() => {
      if (current() && navigation.current.generation === generation) work();
    }, delay);
  };
  useEffect(() => {
    navigation.current.mounted = true;
    return () => { navigation.current.mounted = false; cancelNavigation(); };
  }, [cancelNavigation, isSessionCurrent]);
  const { live } = useAppRuntime();
  const { requireAuth } = useSoftWall();
  const { players, applyBackerCount } = useRoster();
  const { awards, loading, refresh } = useSpotlightBoard(players);
  const leaderboards = useLeaderboards('week', live.layouts.leaderboards);
  const showBoards = live.layouts.leaderboards && !leaderboards.unavailable;
  const { onScroll, trackFeature } = useSurfaceUsage('spotlight');
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<SpotlightAward | null>(null);
  const [watchClip, setWatchClip] = useState<HighlightClip | null>(null);
  const [tipTarget, setTipTarget] = useState<{ player: Player; reelId?: string } | null>(null);
  const watchPlayer = useMemo(
    () => (watchClip?.playerId ? players.find((player) => player.id === watchClip.playerId) ?? null : null),
    [players, watchClip?.playerId],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refresh(), live.layouts.leaderboards ? leaderboards.refresh() : Promise.resolve()]);
    } finally {
      setRefreshing(false);
    }
  }, [refresh, leaderboards.refresh, live.layouts.leaderboards]);

  const featured = awards[0] ?? null;
  const rest = awards.slice(1);

  if (!live.tabs.spotlight) {
    return (
      <TabScreen><RuntimePaused title="Spotlight is paused" lede="Turn Spotlight back on in Admin → Features, then Publish to app." /></TabScreen>
    );
  }

  return (
    <TabScreen>
      <ScrollFxScrollView
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <ScrollFxParallax>
          <ScreenHeading
            kicker={live.copy.spotlightKicker}
            title="Spotlight"
            lede={live.copy.spotlightLede}
            accent={FOCAL.goldInk}
          />
        </ScrollFxParallax>
        {loading && awards.length === 0 ? (
          <View style={styles.boot} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingLabel}>Loading Spotlights…</Text>
          </View>
        ) : null}
        {featured ? (
          <ScrollFxItem variant="zoom" exitFade={false}>
            <SpotlightAwardCard featured award={featured} onPress={() => {
              cancelNavigation();
              trackFeature('spotlight_card');
              setSelected(featured);
            }} />
          </ScrollFxItem>
        ) : !loading ? (
          <EmptyState
            compact
            kicker="Spotlight"
            title={live.copy.spotlightEmpty}
            lede="When an athlete is featured, their Spotlight and Highlight appear here."
            adminHref="/admin/spotlight"
            adminLabel="Open Spotlight desk"
            accent={FOCAL.goldInk}
          />
        ) : null}
        {showBoards ? (
          <LeaderboardsBoard
            boards={leaderboards.boards}
            loading={leaderboards.loading}
            error={leaderboards.error}
            onRetry={() => {
              trackFeature('leaderboards');
              void leaderboards.refresh();
            }}
            onTabChange={() => trackFeature('leaderboards')}
            onOpenAthlete={(playerId) => {
              trackFeature('leaderboards');
              if (isAuraUuid(playerId)) router.push(userProfileHref(playerId));
            }}
          />
        ) : null}
        {rest.length > 0 ? (
          <View style={styles.list}>
            <Text accessibilityRole="header" style={styles.section}>Recent Spotlights</Text>
            {rest.map((award, index) => (
              <ScrollFxItem key={award.id} index={index + 1} variant="tilt">
                <SpotlightAwardCard award={award} onPress={() => {
                  cancelNavigation();
              trackFeature('spotlight_card');
                  setSelected(award);
                }} />
              </ScrollFxItem>
            ))}
          </View>
        ) : null}
      </ScrollFxScrollView>
      <SpotlightModal
        award={selected}
        visible={Boolean(selected)}
        replay
        onDismiss={() => { cancelNavigation(); setSelected(null); }}
        onSupport={(player, reelId) => {
          const generation = navigation.current.generation;
          requireAuth({
            kind: 'malo',
            athleteName: player.name,
            athleteId: player.id,
            resume: () => {
              if (!current() || navigation.current.generation !== generation) return;
              trackFeature('malo');
              setSelected(null);
              afterClose(() => setTipTarget({ player, reelId }), 320);
            },
          });
        }}
        onWatch={(reelId, playerId) => {
          if (!current()) return;
          cancelNavigation();
          const award = selected;
          setSelected(null);
          const videoUrl = award?.video_url?.trim();
          const id = [playerId, award?.player?.id, award?.player_id].find(
            (value): value is string => typeof value === 'string' && isAuraUuid(value),
          );
          if (videoUrl) {
            setWatchClip({
              id: reelId || award?.reel_id || award?.id || 'spotlight-clip',
              athleteName: displayValue(award?.player?.name, 'Spotlight athlete'),
              school: award?.school_name ?? '',
              tag: award?.headline ?? 'Spotlight',
              videoUrl,
              sekiPlay: true,
              playerId: id ?? null,
            });
            return;
          }
          if (id) {
            afterClose(() => router.push(userProfileHref(id)), 280);
            return;
          }
          afterClose(() => router.push('/'), 280);
        }}
      />
      <ReelViewModal
        clips={watchClip ? [watchClip] : []}
        initialClipId={watchClip?.id ?? null}
        player={watchPlayer}
        onClose={() => setWatchClip(null)}
        onOpenAthlete={(nextId) => {
          setWatchClip(null);
          if (isAuraUuid(nextId)) router.push(userProfileHref(nextId));
        }}
      />
      <MaloTipModal
        player={tipTarget?.player ?? null}
        reelId={tipTarget?.reelId}
        onClose={() => setTipTarget(null)}
        onBacked={(nextCount) => {
          if (tipTarget) applyBackerCount(tipTarget.player.id, nextCount);
        }}
      />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
    paddingBottom: space.md,
    gap: space.sm,
  },
  boot: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.xl,
  },
  loadingLabel: {
    color: colors.textMuted,
    ...TYPE.body,
  },
  list: {
    gap: space.xs,
  },
  section: {
    color: FOCAL.goldInk,
    ...TYPE.section,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
