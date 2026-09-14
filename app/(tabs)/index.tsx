import { useRouter } from 'expo-router';
import { clearVideoCacheAsync } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeSearchOverlay } from '@/components/Reels/HomeSearchOverlay';
import { LiveMatchBanner } from '@/components/Reels/LiveMatchBanner';
import { ReelCard } from '@/components/Reels/ReelCard';
import { SpotlightModal } from '@/components/Spotlight/SpotlightModal';
import { SlangGuideBanner } from '@/components/Onboarding/SlangGuideBanner';
import { MaloTipModal } from '@/components/TipSheetModal';
import { TabScreen } from '@/components/TabScreen';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useUploadSheet } from '@/context/UploadSheetContext';
import {
  HIGHLIGHT_CLIPS,
  HIGHLIGHT_FEED_ALL,
  HIGHLIGHT_FEED_HOME,
  HIGHLIGHT_FEED_SEKI,
  isSekiHighlight,
  rankHomeFeed,
  type HighlightClip,
  type HighlightFeedFilter,
} from '@/data/highlights';
import { useActiveSpotlight } from '@/hooks/useActiveSpotlight';
import { useFanTipHistory } from '@/hooks/useFanTipHistory';
import { useLiveGame } from '@/hooks/useLiveGame';
import { useReels } from '@/hooks/useReels';
import { useRoster } from '@/hooks/useRoster';
import { fetchSquadAthleteIds } from '@/lib/crew';
import { playerFromReel, readHiddenReelIds, reelHiddenForUser, reelToClip } from '@/lib/reels';
import { userProfileHref } from '@/lib/navigation';
import type { Player, Reel } from '@/types/database';

type FeedItem = {
  clip: HighlightClip;
  player: Player | null;
};

const FEED_PILLS: { id: HighlightFeedFilter; label: string }[] = [
  { id: 'home', label: HIGHLIGHT_FEED_HOME },
  { id: 'all', label: HIGHLIGHT_FEED_ALL },
  { id: 'seki', label: HIGHLIGHT_FEED_SEKI },
];

/**
 * @purpose Full-screen Home feed: For You mix, All / Seki switch, clip + athlete search, Exclusive mute/Aura gestures, live score banner, Mālo ⚡ sheet, Player of the Week spotlight.
 * @sideEffects `useReels` fetch; `crew_follows` for Home ranking; `clearVideoCacheAsync` on mount; `get_active_spotlight_award` launch popup; `MaloTipModal` PaymentSheet; hide list after Report.
 */
export default function HighlightsTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<FeedItem>>(null);
  const pendingClipId = useRef<string | null>(null);
  const { user, profile, loading: authLoading } = useAuth();
  const { live: runtime } = useAppRuntime();
  const { subscribeUploaded } = useUploadSheet();
  const { players, applyBackerCount } = useRoster();
  const { reels, refresh, setReels, applyReelHype, applyReelTips } = useReels();
  const { receipts } = useFanTipHistory();
  const liveGame = useLiveGame();
  const liveGameId = liveGame.gameId;
  const spotlight = useActiveSpotlight(user?.id, players, { enabled: !authLoading && runtime.layouts.spotlightModal });
  const [pageHeight, setPageHeight] = useState(0);
  const [chromeHeight, setChromeHeight] = useState(96);
  const [activeIndex, setActiveIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  const [tipTarget, setTipTarget] = useState<{ player: Player; reelId?: string } | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [feedFilter, setFeedFilter] = useState<HighlightFeedFilter>('home');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [crewIds, setCrewIds] = useState<Set<string>>(() => new Set());
  const [localTipped, setLocalTipped] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void readHiddenReelIds().then((ids) => {
      if (active) setHiddenIds(ids);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchSquadAthleteIds(user?.id).then((ids) => {
      if (active) setCrewIds(new Set(ids));
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const clips = useMemo<FeedItem[]>(() => {
    const uploaded = reels.map((reel) => {
      const player = playerFromReel(reel, players);
      return { clip: reelToClip(reel, player), player };
    });
    const seeded = HIGHLIGHT_CLIPS.map((clip, index) => ({
      clip,
      player:
        players.find((item) => item.name.toLowerCase() === clip.athleteName.toLowerCase()) ??
        players[index % Math.max(players.length, 1)] ??
        null,
    }));
    return [...uploaded, ...seeded].filter((item) => {
      const uploadedReel = reels.find((reel) => reel.id === item.clip.id);
      return !reelHiddenForUser(uploadedReel ?? { id: item.clip.id }, user?.id, hiddenIds);
    });
  }, [hiddenIds, players, reels, user?.id]);

  const homeContext = useMemo(
    () => ({
      crewIds,
      school: profile?.team?.name?.trim() || '',
    }),
    [crewIds, profile?.team?.name],
  );

  const feed = useMemo(() => {
    if (feedFilter === 'seki') return clips.filter((item) => isSekiHighlight(item.clip));
    if (feedFilter === 'home') return rankHomeFeed(clips, homeContext);
    return clips;
  }, [clips, feedFilter, homeContext]);

  const tippedIds = useMemo(() => {
    const ids = new Set(localTipped);
    for (const receipt of receipts) {
      if (receipt.reel_id) ids.add(receipt.reel_id);
    }
    return ids;
  }, [localTipped, receipts]);

  const hideClip = useCallback((reelId: string) => {
    setHiddenIds((current) => (current.includes(reelId) ? current : [reelId, ...current]));
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
  }, []);

  useEffect(() => {
    if (activeIndex >= feed.length) setActiveIndex(Math.max(0, feed.length - 1));
  }, [activeIndex, feed.length]);

  useEffect(() => {
    const clipId = pendingClipId.current;
    if (!clipId) return;
    const index = feed.findIndex((item) => item.clip.id === clipId);
    if (index < 0) return;
    pendingClipId.current = null;
    setActiveIndex(index);
    const offset = pageHeight * index;
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({ index, animated: true });
      } catch {
        listRef.current?.scrollToOffset({ offset, animated: true });
      }
    });
  }, [feed, pageHeight]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const next = viewableItems[0]?.index;
      if (typeof next === 'number') setActiveIndex(next);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  useEffect(() => {
    let cancelled = false;
    const ready = () => {
      if (!cancelled) setCacheReady(true);
    };
    try {
      const result = clearVideoCacheAsync();
      void Promise.resolve(result).catch(() => undefined).finally(ready);
    } catch {
      ready();
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUploaded = useCallback(
    async (reel: Reel) => {
      const tagged = players.find((item) => item.id === reel.player_id) ?? null;
      setReels((current) => [
        { ...reel, players: tagged },
        ...current.filter((row) => row.id !== reel.id),
      ]);
      setActiveIndex(0);
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
      await refresh();
    },
    [players, refresh, setReels],
  );

  useEffect(() => subscribeUploaded((reel) => void handleUploaded(reel)), [handleUploaded, subscribeUploaded]);

  const tipPlayer = useCallback(async (player: Player | null, reelId?: string) => {
    if (!player) return;
    setTipTarget({ player, reelId });
  }, []);

  const switchFeed = useCallback((id: HighlightFeedFilter) => {
    closeSearch();
    setFeedFilter(id);
    setActiveIndex(0);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [closeSearch]);

  const jumpToClip = useCallback((clipId: string) => {
    pendingClipId.current = clipId;
    closeSearch();
    setFeedFilter('all');
  }, [closeSearch]);

  const jumpToSpotlightClip = useCallback(
    (reelId?: string | null, playerId?: string) => {
      const athleteName = spotlight.award?.player?.name?.trim().toLowerCase();
      const index = feed.findIndex((item) => {
        if (reelId && item.clip.id === reelId) return true;
        if (playerId && item.player?.id === playerId) return true;
        if (athleteName && item.clip.athleteName.toLowerCase() === athleteName) return true;
        return false;
      });
      if (index < 0) return;
      setActiveIndex(index);
      const offset = pageHeight * index;
      requestAnimationFrame(() => {
        try {
          listRef.current?.scrollToIndex({ index, animated: true });
        } catch {
          listRef.current?.scrollToOffset({ offset, animated: true });
        }
      });
    },
    [feed, pageHeight, spotlight.award?.player?.name],
  );

  const dismissSpotlight = spotlight.dismiss;
  const afterSpotlightHide = useCallback(
    (next?: () => void) => {
      void dismissSpotlight();
      if (!next) return;
      setTimeout(next, 320);
    },
    [dismissSpotlight],
  );

  const onPullRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      const ids = await fetchSquadAthleteIds(user?.id);
      setCrewIds(new Set(ids));
    } finally {
      setRefreshing(false);
    }
  };

  const emptyCopy =
    feedFilter === 'seki'
      ? 'No Seki plays in the feed yet.'
      : feedFilter === 'home'
        ? 'Your Home mix is quiet. Follow athletes in Crew, or switch to All.'
        : runtime.copy.homeEmpty;

  return (
    <TabScreen dark>
      <View
        style={styles.fill}
        onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
      >
        {pageHeight === 0 || !cacheReady ? (
          <View style={styles.boot}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : feed.length === 0 ? (
          <View style={styles.boot}>
            <Text style={styles.empty}>{emptyCopy}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={feed}
            extraData={`${feedFilter}:${activeIndex}:${hiddenIds.join(',')}:${[...tippedIds].join(',')}:${reels
              .map(
                (reel) =>
                  `${reel.id}:${reel.seki_count}:${reel.aura_count}:${reel.flex_count}:${reel.total_tips_cents}`,
              )
              .join(',')}`}
            keyExtractor={(item) => item.clip.id}
            pagingEnabled
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            snapToInterval={pageHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            getItemLayout={(_, index) => ({
              length: pageHeight,
              offset: pageHeight * index,
              index,
            })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            windowSize={2}
            maxToRenderPerBatch={1}
            removeClippedSubviews={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onPullRefresh()}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.surface}
              />
            }
            renderItem={({ item, index }) => (
              <ReelCard
                clip={{
                  ...item.clip,
                  gameId: item.clip.gameId ?? liveGameId,
                }}
                player={item.player}
                active={index === activeIndex}
                height={pageHeight}
                tipping={Boolean(tipTarget) || spotlight.visible}
                playbackActive={!spotlight.visible && !tipTarget}
                sekiPlay={item.clip.sekiPlay}
                userTipped={tippedIds.has(item.clip.id)}
                onTip={() => void tipPlayer(item.player, item.clip.id)}
                onOpenProfile={
                  item.player
                    ? () => router.push(userProfileHref(item.player!.id))
                    : undefined
                }
                onReelHypeChange={applyReelHype}
                onHide={hideClip}
              />
            )}
          />
        )}
        <View
          pointerEvents="box-none"
          style={[styles.topChrome, { paddingTop: Math.max(insets.top, 8) }]}
          onLayout={(event) => setChromeHeight(event.nativeEvent.layout.height)}
        >
          {runtime.layouts.liveMatches ? <LiveMatchBanner live={liveGame} playToasts={false} /> : null}
          {runtime.copy.homeBannerTitle.trim() ? (
            <View style={[styles.campaign, { borderColor: runtime.theme.jade }]}>
              <Text style={[styles.campaignTitle, { color: runtime.theme.jade }]}>{runtime.copy.homeBannerTitle}</Text>
              {runtime.copy.homeBannerBody.trim() ? (
                <Text style={[styles.campaignBody, { color: runtime.theme.text }]}>{runtime.copy.homeBannerBody}</Text>
              ) : null}
            </View>
          ) : null}
          {runtime.copy.homeKicker.trim() || runtime.copy.homeLede.trim() ? (
            <View style={styles.homeCopy}>
              {runtime.copy.homeKicker.trim() ? (
                <Text style={[styles.homeKicker, { color: runtime.theme.jade }]}>{runtime.copy.homeKicker}</Text>
              ) : null}
              {runtime.copy.homeLede.trim() ? (
                <Text style={[styles.homeLede, { color: runtime.theme.text }]}>{runtime.copy.homeLede}</Text>
              ) : null}
            </View>
          ) : null}
          <View style={styles.chromeRow}>
            {runtime.layouts.homeSearch ? (
            <AnimatedButton
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={searchOpen ? 'Close search' : 'Search clips and athletes'}
              contentStyle={[styles.searchBtn, searchOpen && styles.searchBtnOn]}
              onPress={() => {
                if (searchOpen) {
                  closeSearch();
                  return;
                }
                setSearchOpen(true);
              }}
            >
              <Ionicons name={searchOpen ? 'close' : 'search'} size={18} color={searchOpen ? colors.onAccent : colors.text} />
            </AnimatedButton>
            ) : null}
            {searchOpen && runtime.layouts.homeSearch ? (
              <TextInput
                autoFocus
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search clips & athletes"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search clips and athletes"
                style={styles.searchField}
              />
            ) : (
              <View style={styles.feedSwitch} accessibilityRole="tablist" accessibilityLabel="Home feed">
                {FEED_PILLS.map((item) => {
                  const on = feedFilter === item.id;
                  return (
                    <AnimatedButton
                      key={item.id}
                      haptic="selection"
                      accessibilityRole="tab"
                      accessibilityLabel={item.label}
                      accessibilityState={{ selected: on }}
                      contentStyle={[styles.feedPill, on && styles.feedPillOn]}
                      onPress={() => switchFeed(item.id)}
                    >
                      <Text style={[styles.feedPillLabel, on && styles.feedPillLabelOn]}>{item.label}</Text>
                    </AnimatedButton>
                  );
                })}
              </View>
            )}
          </View>
          <SlangGuideBanner />
        </View>
        <HomeSearchOverlay
          open={searchOpen && runtime.layouts.homeSearch}
          query={searchQuery}
          offsetTop={chromeHeight + 8}
          clips={clips}
          onApplyQuery={setSearchQuery}
          onSelectAthlete={(playerId) => {
            closeSearch();
            router.push(userProfileHref(playerId));
          }}
          onSelectClip={jumpToClip}
        />
      </View>
      <SpotlightModal
        award={spotlight.award}
        visible={cacheReady && spotlight.visible}
        onDismiss={() => {
          void spotlight.dismiss();
        }}
        onSupport={(player, reelId) => {
          afterSpotlightHide(() => {
            void tipPlayer(player, reelId);
          });
        }}
        onWatch={(reelId, playerId) => {
          afterSpotlightHide(() => jumpToSpotlightClip(reelId, playerId));
        }}
      />
      <MaloTipModal
        player={tipTarget?.player ?? null}
        reelId={tipTarget?.reelId}
        onClose={() => setTipTarget(null)}
        onBacked={(nextCount) => {
          if (tipTarget) applyBackerCount(tipTarget.player.id, nextCount);
        }}
        onTipped={(amountCents) => {
          if (tipTarget?.reelId) {
            applyReelTips(tipTarget.reelId, amountCents);
            setLocalTipped((current) =>
              current.includes(tipTarget.reelId!) ? current : [tipTarget.reelId!, ...current],
            );
          }
        }}
      />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  topChrome: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    zIndex: 24,
    gap: 8,
  },
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  campaign: {
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(15,20,22,0.86)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  campaignTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  campaignBody: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  homeCopy: {
    gap: 2,
  },
  homeKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  homeLede: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.86,
  },
  searchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,20,22,0.78)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  searchField: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(15,20,22,0.86)',
    borderWidth: 1,
    borderColor: colors.primary,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  feedSwitch: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(15,20,22,0.78)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  feedPill: {
    flex: 1,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedPillOn: {
    backgroundColor: colors.primary,
  },
  feedPillLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  feedPillLabelOn: {
    color: colors.onAccent,
  },
});
