/** UX-07: Spotlight presents published athlete recognition without declaring a pending board empty. */
import { useCallback, useMemo, useState } from 'react';
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
import { colors } from '@/constants/theme';
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
import { TAB_ACCENTS, FOCAL } from '@/theme/motion';
import type { Player, SpotlightAward } from '@/types/database';

/**
 * @purpose Fan-bar Spotlight tab: reopen Player of the Week/Month after the Highlights launch popup is dismissed. The featured card zooms in, past awards tilt up as the board scrolls, heading drifts with parallax.
 * @sideEffects `useSpotlightBoard` + `useLeaderboards` (Boards, `layouts.leaderboards`) on focus; `SpotlightModal` replay; `ReelViewModal` for Watch Full Highlight; `MaloTipModal` PaymentSheet; `useSurfaceUsage` dwell / taps.
 */
export default function SpotlightTab() {
  const router = useRouter();
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
            accent={TAB_ACCENTS.spotlight.color}
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
            accent={TAB_ACCENTS.spotlight.color}
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
        onDismiss={() => setSelected(null)}
        onSupport={(player, reelId) => {
          requireAuth({
            kind: 'malo',
            athleteName: player.name,
            athleteId: player.id,
            resume: () => {
              trackFeature('malo');
              setSelected(null);
              setTimeout(() => setTipTarget({ player, reelId }), 320);
            },
          });
        }}
        onWatch={(reelId, playerId) => {
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
            setTimeout(() => router.push(userProfileHref(id)), 280);
            return;
          }
          setTimeout(() => router.push('/'), 280);
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
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
  },
  boot: {
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  loadingLabel: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  list: {
    gap: 8,
  },
  section: {
    color: FOCAL.goldInk,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
