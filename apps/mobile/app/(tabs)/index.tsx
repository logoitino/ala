/**
 * Athlete discovery fills the shell behind the floating dock, with measured unobstructed chrome.
 * Pager, media, snap and resized active offsets use one page height; single-video ownership stays intact.
 * R4-03 split (behaviour unchanged): the empty feed, campaign copy and pill row render from `components/Reels/`
 * (`HomeFeedEmpty`, `HomeCampaignCopy`, `HomeFeedSwitch`); this route keeps every hook, state and callback.
 */
import { useRouter } from 'expo-router';
import { clearVideoCacheAsync } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeCampaignCopy } from '@/components/Reels/HomeCampaignCopy';
import { HomeFeedEmpty } from '@/components/Reels/HomeFeedEmpty';
import { HomeFeedSwitch } from '@/components/Reels/HomeFeedSwitch';
import { HomeSearchOverlay } from '@/components/Reels/HomeSearchOverlay';
import { RivalryWeekBanner } from '@/components/Local/RivalryWeekBanner';
import { RallyMeter } from '@/components/Rally/RallyMeter';
import { LiveMatchBanner } from '@/components/Reels/LiveMatchBanner';
import { ReelCard } from '@/components/Reels/ReelCard';
import { useScreenMountTime } from '@/hooks/useScreenMountTime';
import { ReelPage } from '@/components/Reels/ReelPage';
import { SpotlightModal } from '@/components/Spotlight/SpotlightModal';
import { SlangGuideBanner } from '@/components/Onboarding/SlangGuideBanner';
import { MaloTipModal } from '@/components/TipSheetModal';
import { TabScreen } from '@/components/TabScreen';
import { FamilyFunDiscovery } from '@/components/FamilyFun/FamilyFunDiscovery';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { useUploadSheet } from '@/context/UploadSheetContext';
import { useFanDockHeight } from '@/context/FanNavigationContext';
import { FOCAL, SPRING_SHEET } from '@/theme/motion';
import { FeedPicksSheet } from '@/components/Reels/FeedPicksSheet';
import {
  HIGHLIGHT_CLIPS,
  HIGHLIGHT_FEED_BEYOND,
  HIGHLIGHT_FEED_HOME,
  homePagerClips,
  isBeyondHighlight,
  isSekiHighlight,
  measureHomeFeedTop,
  pinFeedOrder,
  rankHomeFeed,
  rankHomeFeedWithReasons,
  whyThisClipLine,
  type FeedReasonCode,
  type HighlightClip,
  type HighlightFeedFilter,
} from '@/data/highlights';
import { useActiveSpotlight } from '@/hooks/useActiveSpotlight';
import { useFeedPrefs } from '@/hooks/useFeedPrefs';
import { adjacentStoryClips, prefetchStoryPhotos } from '@/hooks/useStoryPhotos';
import { useFanTipHistory } from '@/hooks/useFanTipHistory';
import { useLiveGame } from '@/hooks/useLiveGame';
import { useReels } from '@/hooks/useReels';
import { useRoster } from '@/hooks/useRoster';
import { useSurfaceUsage } from '@/hooks/useSurfaceUsage';
import { isAuraUuid } from '@/lib/aura';
import { fetchSquadAthleteIds } from '@/lib/crew';
import { playerFromReel, readHiddenReelIds, reelHiddenForUser, reelToClip } from '@/lib/reels';
import { guestBrowseNeedsAccount } from '@/data/guestBrowse';
import { userProfileHref } from '@/lib/navigation';
import type { Player, Reel } from '@/types/database';

type FeedItem = {
  clip: HighlightClip;
  player: Player | null;
};

const HOME_PILL: { id: HighlightFeedFilter; label: string } = { id: 'home', label: HIGHLIGHT_FEED_HOME };
/** Beyond sits beside Home (owner 2026-10-16): athletes' workout and service Highlights in the same pager. */
const BEYOND_PILL: { id: HighlightFeedFilter; label: string } = { id: 'beyond', label: HIGHLIGHT_FEED_BEYOND };

/**
 * @purpose Full-screen Home feed: Home mix, a Beyond switch (workout + service Highlights, with a link to the Beyond the Game page for fan posts), clip + athlete search, and a Local jump. All and Seki stay off the bar until a later pass. Exclusive mute/Aura gestures, live score banner, donation sheet, Player of the Week spotlight. A guest can watch the opened Highlight and two more swipes, then the account sheet. Pages ride `ReelPage` for card-deck depth on vertical paging and swipe left / right to peek the athlete who owns the clip.
 * @sideEffects `useReels` fetch; `crew_follows` for Home ranking; `clearVideoCacheAsync` on mount; `get_active_spotlight_award` launch popup; `MaloTipModal` PaymentSheet; hide list after Report; Reanimated scroll handler feeds the pager depth math.
 */
export default function HighlightsTab() {
  useScreenMountTime('home');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dockHeight = useFanDockHeight();
  const listRef = useRef<FlatList<FeedItem>>(null);
  const guestSeen = useRef(new Set<string>());
  const guestAllowedIndex = useRef(0);
  const { user, profile, loading: authLoading, isGuest } = useAuth();
  const { live: runtime } = useAppRuntime();
  const { requireAuth, visible: accountSheetOpen } = useSoftWall();
  const { subscribeUploaded, openUpload } = useUploadSheet();
  const { players, applyBackerCount } = useRoster();
  const { reels, refresh, setReels, applyReelHype, applyReelTips } = useReels();
  const { receipts } = useFanTipHistory();
  const feedPrefs = useFeedPrefs();
  const liveGame = useLiveGame();
  const liveGameId = liveGame.gameId;
  const { noteScrollPct, trackFeature } = useSurfaceUsage('home');
  const spotlight = useActiveSpotlight(user?.id, players, { enabled: !authLoading && runtime.layouts.spotlightModal });
  const [pageHeight, setPageHeight] = useState(0);
  const [chromeHeight, setChromeHeight] = useState(96);
  const [activeIndex, setActiveIndex] = useState(0);
  const activePage = useRef(0);
  activePage.current = activeIndex;
  const previousHeight = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  // Web server render and the first browser paint share this shell. The feed mounts after that.
  const [clientFeed, setClientFeed] = useState(Platform.OS !== 'web');
  const [extrasReady, setExtrasReady] = useState(false);
  const [tipTarget, setTipTarget] = useState<{ player: Player; reelId?: string } | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [feedFilter, setFeedFilter] = useState<HighlightFeedFilter>('home');
  const feedPills = useMemo(() => (runtime.tabs.beyond ? [HOME_PILL, BEYOND_PILL] : [HOME_PILL]), [runtime.tabs.beyond]);
  // A published pause of Beyond drops a fan on the Beyond switch back to Home.
  useEffect(() => {
    if (!runtime.tabs.beyond && feedFilter === 'beyond') setFeedFilter('home');
  }, [feedFilter, runtime.tabs.beyond]);
  useEffect(() => {
    setClientFeed(true);
    setExtrasReady(true);
  }, []);
  const [pendingClipId, setPendingClipId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [crewIds, setCrewIds] = useState<Set<string>>(() => new Set());
  const [localTipped, setLocalTipped] = useState<string[]>([]);
  const [peekOpen, setPeekOpen] = useState(false);
  const pagerY = useSharedValue(0);
  const feedLayouts = useRef<Partial<Record<HighlightFeedFilter, { x: number; width: number }>>>({});
  const feedReady = useRef(false);
  const feedX = useSharedValue(0);
  const feedW = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const onPagerScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      pagerY.value = event.contentOffset.y;
    },
  });
  useEffect(() => {
    const before = previousHeight.current;
    previousHeight.current = pageHeight;
    if (before <= 0 || pageHeight <= 0 || before === pageHeight) return;
    // Rotation/resizing changes every page offset. Re-anchor the current clip after new rows lay out.
    const frame = requestAnimationFrame(() => {
      const offset = activePage.current * pageHeight;
      pagerY.value = offset;
      listRef.current?.scrollToOffset({ offset, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [pageHeight, pagerY]);

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
    return homePagerClips(uploaded, seeded).filter((item) => {
      const uploadedReel = reels.find((reel) => reel.id === item.clip.id);
      return !reelHiddenForUser(uploadedReel ?? { id: item.clip.id }, user?.id, hiddenIds);
    });
  }, [hiddenIds, players, reels, user?.id]);

  const homeContext = useMemo(
    () => ({
      crewIds,
      school: profile?.team?.name?.trim() || '',
      prefs: isGuest ? null : feedPrefs.prefs,
      implicit: isGuest ? null : feedPrefs.implicit,
    }),
    [crewIds, feedPrefs.implicit, feedPrefs.prefs, isGuest, profile?.team?.name],
  );

  const pickSportOptions = useMemo(() => {
    const out: string[] = [];
    for (const item of clips) {
      const sport = item.clip.sport?.trim();
      if (!sport) continue;
      if (out.some((row) => row.toLowerCase() === sport.toLowerCase())) continue;
      out.push(sport);
    }
    return out;
  }, [clips]);

  const pickSchoolOptions = useMemo(() => {
    const out: string[] = [];
    const own = profile?.team?.name?.trim();
    if (own) out.push(own);
    for (const item of clips) {
      const school = (item.player?.school_name || item.clip.school || '').trim();
      if (!school) continue;
      if (out.some((row) => row.toLowerCase() === school.toLowerCase())) continue;
      out.push(school);
    }
    return out;
  }, [clips, profile?.team?.name]);

  // Rank when the set of clips, the pill, the viewer's context or a pull-to-refresh changes — never
  // on a hype tap. Ranking and the Seki filter read hype counts, so re-ranking per tap moved the
  // clip being watched and slid another video under the fan's finger (see `pinFeedOrder`).
  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  const clipIdsKey = useMemo(() => clips.map((item) => item.clip.id).join('|'), [clips]);
  const [rankEpoch, setRankEpoch] = useState(0);
  const homeRanked = useMemo(() => {
    const current = clipsRef.current;
    if (feedFilter !== 'home') return null;
    const ranked = rankHomeFeedWithReasons(current, homeContext);
    if (__DEV__) {
      // Phase 0 local measurement only — never ships to users / never leaves the device.
      // eslint-disable-next-line no-console
      console.log('[FEED-01 Phase 0]', measureHomeFeedTop(ranked.map((row) => row.item), homeContext));
    }
    return ranked;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `clips` is read through the ref on purpose.
  }, [clipIdsKey, feedFilter, homeContext, rankEpoch]);
  const feedReasons = useMemo(() => {
    if (!homeRanked || isGuest) return new Map<string, FeedReasonCode[]>();
    return new Map(homeRanked.map((row) => [row.item.clip.id, row.reasons]));
  }, [homeRanked, isGuest]);
  const feedOrder = useMemo(() => {
    const current = clipsRef.current;
    if (feedFilter === 'seki') {
      return current.filter((item) => isSekiHighlight(item.clip)).map((item) => item.clip.id);
    }
    if (feedFilter === 'beyond') {
      return current.filter((item) => isBeyondHighlight(item.clip)).map((item) => item.clip.id);
    }
    if (feedFilter === 'home' && homeRanked) {
      return homeRanked.map((row) => row.item.clip.id);
    }
    return current.map((item) => item.clip.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `clips` is read through the ref on purpose.
  }, [clipIdsKey, feedFilter, homeRanked, rankEpoch]);
  const feed = useMemo(() => pinFeedOrder(feedOrder, clips), [clips, feedOrder]);

  /** Pill badges: "All 24" / "Seki 8" reads as a promise about what is behind the tab. */
  const feedCounts = useMemo<Record<HighlightFeedFilter, number>>(
    () => ({
      home: rankHomeFeed(clips, homeContext).length,
      beyond: clips.filter((item) => isBeyondHighlight(item.clip)).length,
      all: clips.length,
      seki: clips.filter((item) => isSekiHighlight(item.clip)).length,
    }),
    [clips, homeContext],
  );

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

  // The next card is mounted but does not fetch until it is focused. Warming the photo cache
  // here avoids starting another video player just to have the next story ready.
  useEffect(() => {
    prefetchStoryPhotos(adjacentStoryClips(feed.map((item) => item.clip), activeIndex));
  }, [activeIndex, feed]);

  useEffect(() => {
    if (!pendingClipId) return;
    const index = feed.findIndex((item) => item.clip.id === pendingClipId);
    if (index < 0) return;
    setPendingClipId(null);
    setActiveIndex(index);
    const offset = pageHeight * index;
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({ index, animated: true });
      } catch {
        listRef.current?.scrollToOffset({ offset, animated: true });
      }
    });
  }, [feed, pageHeight, pendingClipId]);

  useEffect(() => {
    if (!isGuest) {
      guestSeen.current.clear();
      return;
    }
    const clipId = feed[activeIndex]?.clip.id;
    if (!clipId) return;
    guestSeen.current.add(clipId);
    if (!guestBrowseNeedsAccount(guestSeen.current.size)) {
      guestAllowedIndex.current = activeIndex;
      return;
    }
    if (activeIndex === guestAllowedIndex.current) return;
    if (!accountSheetOpen) {
      requireAuth({
        kind: 'browse',
        resume: () => undefined,
      });
    }
    const back = guestAllowedIndex.current;
    setActiveIndex(back);
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({ index: back, animated: true });
      } catch {
        listRef.current?.scrollToOffset({ offset: pageHeight * back, animated: true });
      }
    });
  }, [accountSheetOpen, activeIndex, feed, isGuest, pageHeight, requireAuth]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index?: number | null }> }) => {
      const next = viewableItems[0]?.index;
      if (typeof next === 'number') setActiveIndex(next);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  // Views are counted inside `ReelCard` from real playback (3 s played), so every surface that
  // plays a Highlight — Home, profile grids, Spotlight — counts the same way.

  useEffect(() => {
    if (feed.length <= 1) {
      if (feed.length === 1) noteScrollPct(100);
      return;
    }
    noteScrollPct((activeIndex / (feed.length - 1)) * 100);
  }, [activeIndex, feed.length, noteScrollPct]);

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
    requireAuth({
      kind: 'malo',
      athleteName: player.name,
      athleteId: player.id,
      resume: () => {
        trackFeature('malo');
        setTipTarget({ player, reelId });
      },
    });
  }, [requireAuth, trackFeature]);

  const placeFeedPill = useCallback((id: HighlightFeedFilter, animate: boolean) => {
    const box = feedLayouts.current[id];
    if (!box) return;
    if (!animate || !feedReady.current || reduceMotion) {
      feedX.value = box.x;
      feedW.value = box.width;
      feedReady.current = true;
      return;
    }
    feedX.value = withSpring(box.x, SPRING_SHEET);
    feedW.value = withSpring(box.width, SPRING_SHEET);
  }, [feedW, feedX, reduceMotion]);

  useEffect(() => {
    placeFeedPill(feedFilter, true);
  }, [feedFilter, placeFeedPill]);

  const feedIndicatorStyle = useAnimatedStyle(() => ({
    width: feedW.value,
    transform: [{ translateX: feedX.value }],
  }));

  const switchFeed = useCallback((id: HighlightFeedFilter) => {
    closeSearch();
    trackFeature(`feed.${id}`);
    setPendingClipId(null);
    setFeedFilter(id);
    setActiveIndex(0);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [closeSearch, trackFeature]);

  const jumpToClip = useCallback((clipId: string) => {
    setPendingClipId(clipId);
    closeSearch();
    trackFeature('home_search_clip');
    setFeedFilter('home');
  }, [closeSearch, trackFeature]);

  const jumpToSpotlightClip = useCallback(
    (reelId?: string | null, playerId?: string) => {
      const athleteName = spotlight.award?.player?.name?.trim().toLowerCase();
      const matches = (item: FeedItem) => {
        if (reelId && item.clip.id === reelId) return true;
        if (playerId && item.player?.id === playerId) return true;
        if (athleteName && item.clip.athleteName.toLowerCase() === athleteName) return true;
        return false;
      };
      const index = feed.findIndex(matches);
      if (index >= 0) {
        setActiveIndex(index);
        const offset = pageHeight * index;
        requestAnimationFrame(() => {
          try {
            listRef.current?.scrollToIndex({ index, animated: true });
          } catch {
            listRef.current?.scrollToOffset({ offset, animated: true });
          }
        });
        return;
      }
      // Home already includes every clip. Land it there if this page was on another mix.
      const unfiltered = clips.find(matches);
      if (unfiltered) {
        setPendingClipId(unfiltered.clip.id);
        setFeedFilter('home');
        return;
      }
      // No clip in the feed at all: fall back to the athlete's profile, same as the
      // Spotlight tab's own onWatch chain.
      const profileId = [playerId, spotlight.award?.player?.id, spotlight.award?.player_id].find(
        (value): value is string => typeof value === 'string' && isAuraUuid(value),
      );
      if (profileId) router.push(userProfileHref(profileId));
    },
    [
      clips,
      feed,
      pageHeight,
      router,
      spotlight.award?.player?.id,
      spotlight.award?.player?.name,
      spotlight.award?.player_id,
    ],
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
      setRankEpoch((current) => current + 1);
    } finally {
      setRefreshing(false);
    }
  };

  const emptyCopy =
    feedFilter === 'beyond'
      ? 'No workout or service clips yet. Share one, or post your own moment on Beyond the Game.'
      : feedFilter === 'seki'
      ? 'No Seki plays in the feed yet.'
      : feedFilter === 'home'
        ? runtime.layouts.homeSearch
          ? 'Your Home mix is quiet. Find an athlete with search, then follow their story in Crew.'
          : 'Your Home mix is quiet. New Highlights from athletes you follow will appear here.'
        : runtime.copy.homeEmpty;

  return (
    <TabScreen dark>
      <View
        testID="home-pager-viewport"
        style={styles.fill}
        onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
      >
        {pageHeight === 0 || !cacheReady || !clientFeed ? (
          <View style={styles.boot}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : feed.length === 0 ? (
          <View style={styles.boot}>
            <HomeFeedEmpty emptyCopy={emptyCopy} feedFilter={feedFilter} runtime={runtime} openUpload={openUpload} router={router} />
          </View>
        ) : (
          <Animated.FlatList
            ref={listRef}
            data={feed}
            onScroll={onPagerScroll}
            scrollEventThrottle={16}
            scrollEnabled={!peekOpen}
            extraData={`${feedFilter}:${activeIndex}:${searchOpen ? 1 : 0}${tipTarget ? 1 : 0}${spotlight.visible ? 1 : 0}:${hiddenIds.join(',')}:${[...tippedIds].join(',')}:${reels
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
            // 2026-09 fix: RN's default (10) meant the first render mounted up to 10 `ReelCard`s at
            // once — see ReelCard.tsx's `videoPlayer` comment for what that caused on a real device.
            // `windowSize`/`maxToRenderPerBatch` below only bound growth after the initial render.
            // The neighbor stays mounted as a poster. ReelVideoLayer releases its file until it is on screen.
            initialNumToRender={2}
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
            renderItem={({ item, index }) => {
              const openProfile = item.player
                ? () => router.push(userProfileHref(item.player!.id))
                : undefined;
              const liveReel = reels.find((reel) => reel.id === item.clip.id);
              return (
                <ReelPage
                  index={index}
                  height={pageHeight}
                  scrollY={pagerY}
                  active={index === activeIndex}
                  clip={item.clip}
                  player={item.player}
                  totalTipsCents={liveReel?.total_tips_cents ?? item.clip.totalTipsCents ?? 0}
                  peekEnabled={!tipTarget && !spotlight.visible && !searchOpen}
                  peekInsetTop={chromeHeight + 12}
                  peekInsetBottom={dockHeight + 12}
                  onOpenProfile={openProfile}
                  onTip={item.player ? () => void tipPlayer(item.player, item.clip.id) : undefined}
                  onPeekChange={setPeekOpen}
                >
                  <ReelCard
                    clip={{
                      ...item.clip,
                      gameId: item.clip.gameId ?? liveGameId,
                    }}
                    player={item.player}
                    active={index === activeIndex}
                    height={pageHeight}
                    overlayInsetTop={chromeHeight + 8}
                    overlayInsetBottom={dockHeight + 8}
                    tipping={Boolean(tipTarget) || spotlight.visible}
                    playbackActive={!spotlight.visible && !tipTarget}
                    sekiPlay={item.clip.sekiPlay}
                    userTipped={tippedIds.has(item.clip.id)}
                    onTip={() => void tipPlayer(item.player, item.clip.id)}
                    onOpenProfile={openProfile}
                    onReelHypeChange={applyReelHype}
                    onHide={hideClip}
                    whyThisClip={
                      isGuest || feedFilter !== 'home'
                        ? null
                        : whyThisClipLine(feedReasons.get(item.clip.id) ?? [], {
                            athleteName: item.player?.name ?? item.clip.athleteName,
                            sport: item.clip.sport,
                            school: item.player?.school_name ?? item.clip.school,
                          })
                    }
                  />
                </ReelPage>
              );
            }}
          />
        )}
        {!isGuest ? (
          <FeedPicksSheet
            visible={feedPrefs.promptOpen}
            prefs={{
              ...feedPrefs.prefs,
              schools:
                feedPrefs.prefs.schools.length > 0
                  ? feedPrefs.prefs.schools
                  : profile?.team?.name?.trim()
                    ? [profile.team.name.trim()]
                    : [],
            }}
            sportOptions={pickSportOptions}
            schoolOptions={pickSchoolOptions}
            busy={feedPrefs.loading}
            error={feedPrefs.error}
            allowSkip
            onClose={() => void feedPrefs.skipPrompt()}
            onSkip={() => void feedPrefs.skipPrompt()}
            onSave={(next) => feedPrefs.save(next)}
          />
        ) : null}
        <View
          pointerEvents="box-none"
          style={[styles.topChrome, { paddingTop: Math.max(insets.top, 8) }]}
          onLayout={(event) => setChromeHeight(event.nativeEvent.layout.height)}
        >
          {runtime.layouts.liveMatches ? <LiveMatchBanner live={liveGame} playToasts={false} /> : null}
          {runtime.layouts.cheerPolls ? (
            <RivalryWeekBanner game={liveGame.game} onOpen={() => trackFeature('rivalry_week')} />
          ) : null}
          <RallyMeter
            player={feed[activeIndex]?.player ?? null}
            onOpenClip={(reelId) => {
              const index = feed.findIndex((item) => item.clip.id === reelId);
              if (index >= 0) {
                setActiveIndex(index);
                requestAnimationFrame(() => {
                  try {
                    listRef.current?.scrollToIndex({ index, animated: true });
                  } catch {
                    listRef.current?.scrollToOffset({ offset: pageHeight * index, animated: true });
                  }
                });
                return;
              }
              jumpToClip(reelId);
            }}
          />
          <HomeCampaignCopy runtime={runtime} />
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
                trackFeature('home_search');
                setSearchOpen(true);
              }}
            >
              <Ionicons name={searchOpen ? 'close' : 'search'} size={18} color={searchOpen ? '#FFFFFF' : FOCAL.electricGold} />
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
              <HomeFeedSwitch
                feedIndicatorStyle={feedIndicatorStyle}
                feedPills={feedPills}
                feedFilter={feedFilter}
                feedCounts={feedCounts}
                feedLayouts={feedLayouts}
                feedReady={feedReady}
                placeFeedPill={placeFeedPill}
                switchFeed={switchFeed}
                runtime={runtime}
                trackFeature={trackFeature}
                router={router}
              />
            )}
          </View>
          {feedFilter === 'beyond' && runtime.tabs.beyond && !searchOpen ? (
            <AnimatedButton
              haptic="selection"
              accessibilityRole="link"
              accessibilityLabel="Open Beyond the Game: fan workouts, service, learning and stories"
              contentStyle={styles.beyondLink}
              onPress={() => {
                trackFeature('feed.beyond_page');
                router.push('/beyond');
              }}
            >
              <Text style={styles.beyondLinkLabel}>Fan workouts, service, learning and stories</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.onVideo} />
            </AnimatedButton>
          ) : null}
          <SlangGuideBanner />
          {extrasReady ? <FamilyFunDiscovery surface="home" /> : null}
        </View>
        <HomeSearchOverlay
          open={searchOpen && runtime.layouts.homeSearch}
          query={searchQuery}
          offsetTop={chromeHeight + 8}
          clips={clips}
          onApplyQuery={setSearchQuery}
          onClose={closeSearch}
          onSelectAthlete={(playerId) => {
            closeSearch();
            trackFeature('athlete_profile');
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
    gap: 6,
  },
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.videoScrim,
    borderWidth: 1,
    borderColor: FOCAL.electricGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnOn: {
    backgroundColor: FOCAL.ember,
    borderColor: FOCAL.ember,
  },
  searchField: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: colors.videoScrim,
    borderWidth: 1,
    borderColor: FOCAL.electricGold,
    color: colors.onVideo,
    paddingHorizontal: 14,
    fontSize: 13,
    fontWeight: '700',
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  beyondLink: {
    alignSelf: 'flex-start',
    minHeight: 44,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.videoScrim,
  },
  beyondLinkLabel: {
    color: colors.onVideo,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
});
