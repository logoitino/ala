/**
 * Local tab (game day): Matches, School Polls and Top Boosters hubs, plus search (`SearchResultsOverlay`).
 * Booster logos display through `mediaUri` in `Local/SponsorRailCard` (legacy full URL or `sb:` reference, SCALE-02).
 * Matching helpers live in `data/localHub.ts`; the rail card and loading skeleton in `components/Local/` (R4-03).
 * Reached from the Home pill, not the tab bar. The `tabs.local` runtime flag can pause it (`RuntimePaused`).
 * UX-07 keeps school/actor labels readable and directs fans through existing filters without desk instructions.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';

import { ScrollFxItem, ScrollFxScrollView } from '@/components/Effects/ScrollFx';
import { CheerPollCard } from '@/components/Local/CheerPollCard';
import { SearchResultsOverlay } from '@/components/Local/SearchResultsOverlay';
import { SponsorshipModal } from '@/components/Local/SponsorshipModal';
import { GameCard } from '@/components/Local/GameCard';
import { MatchupSkeleton } from '@/components/Local/MatchupSkeleton';
import { SponsorRailCard } from '@/components/Local/SponsorRailCard';
import { RuntimePaused } from '@/components/RuntimePaused';
import { ScreenHeading } from '@/components/ScreenHeading';
import { TabScreen } from '@/components/TabScreen';
import { TopAuraBoosters } from '@/components/Local/TopAuraBoosters';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { EmptyState } from '@/components/UI/EmptyState';
import { FilterPills } from '@/components/UI/FilterPills';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { cardShadow, colors, radii } from '@/constants/theme';
import {
  UTAH_REGIONS,
  gameInRegion,
  isRivalryGame,
} from '@/data/regions';
import {
  blobMatchesSchool,
  extraLocalHits,
  isWestlakeLonePeak,
  schoolOptionsFromGames,
  sponsorsForGame,
  withMascot,
} from '@/data/localHub';
import { useLiveScores } from '@/hooks/useLiveScores';
import { usePublishedCheerPolls } from '@/hooks/useCheerPoll';
import { useSponsorships } from '@/hooks/useSponsorships';
import { useSurfaceUsage } from '@/hooks/useSurfaceUsage';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { localGameHref, userProfileHref } from '@/lib/navigation';
import { TAB_ACCENTS } from '@/theme/motion';

type LocalHubId = 'matches' | 'polls' | 'boosters';

const LOCAL_HUB_IDS: LocalHubId[] = ['matches', 'polls', 'boosters'];

const TYPE_HAPTIC_MS = 110;

function lightImpact() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Simulator / web may not expose haptics.
  }
}

/**
 * @purpose Local Discovery hub: persistent Explore search, Live Matches, rivalry School Polls, and Top Aura Boosters. Game cards tilt up and polls zig-zag in as the hub scrolls (`ScrollFxItem`).
 * @sideEffects `useLiveScores` Realtime; `search_local_entities` via overlay; `CheerPollCard` votes; `SponsorshipModal` PaymentSheet; Light `impactAsync` on search focus/type. Game taps push `/local/game/[id]` so `FanTabBar` stays visible.
 */
export default function LocalTab() {
  const router = useRouter();
  const params = useLocalSearchParams<{ hub?: string }>();
  const { games, loading, error, refresh } = useLiveScores();
  const { sponsors, recordSponsorship } = useSponsorships();
  const publishedPolls = usePublishedCheerPolls();
  const { live } = useAppRuntime();
  const { onScroll, trackFeature } = useSurfaceUsage('local');
  const [hub, setHub] = useState<LocalHubId>('matches');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterId, setFilterId] = useState<string | null>(null);
  const [sponsorSheetOpen, setSponsorSheetOpen] = useState(false);
  const [highlightedSponsorId, setHighlightedSponsorId] = useState<string | null>(null);
  const [schoolFilter, setSchoolFilter] = useState<string | null>(null);
  const lastTypeHaptic = useRef(0);
  const sponsorRailRef = useRef<ScrollViewInstance>(null);
  const sponsorX = useRef<Record<string, number>>({});

  useEffect(() => {
    if (params.hub && LOCAL_HUB_IDS.includes(params.hub as LocalHubId)) {
      setHub(params.hub as LocalHubId);
    }
  }, [params.hub]);

  const hubs = useMemo(
    () =>
      LOCAL_HUB_IDS.filter((id) => {
        if (id === 'matches') return live.layouts.liveMatches;
        if (id === 'polls') return live.layouts.cheerPolls;
        if (id === 'boosters') return live.layouts.topBoosters;
        return true;
      }).map((id) => ({
        id,
        label:
          id === 'matches'
            ? live.copy.localMatchesLabel
            : id === 'polls'
              ? live.copy.localPollsLabel
              : live.copy.localBoostersLabel,
      })),
    [
      live.copy.localBoostersLabel,
      live.copy.localMatchesLabel,
      live.copy.localPollsLabel,
      live.layouts.cheerPolls,
      live.layouts.liveMatches,
      live.layouts.topBoosters,
    ],
  );

  const regionPills = useMemo(
    () => live.catalog.localFilters.map((filter) => ({ id: filter.id, label: filter.label })),
    [live.catalog.localFilters],
  );

  useEffect(() => {
    if (hubs.length > 0 && !hubs.some((item) => item.id === hub)) {
      setHub(hubs[0].id);
    }
  }, [hub, hubs]);

  const extraHits = useMemo(
    () => extraLocalHits(searchQuery, sponsors, schoolOptionsFromGames(games)),
    [games, searchQuery, sponsors],
  );

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      if (filterId === 'rivalry') return isRivalryGame(game);
      if (filterId) {
        const region = UTAH_REGIONS.find((item) => item.id === filterId);
        return region ? gameInRegion(game, region) : true;
      }
      return true;
    });
  }, [filterId, games]);

  const schoolPolls = useMemo(() => {
    const rivalry = games.find((game) =>
      isWestlakeLonePeak(game.home_team, game.away_team, game.home_school, game.away_school),
    );
    const featured = {
      slug: 'westlake-lone-peak',
      homeLabel: rivalry ? withMascot(rivalry.home_team) : 'Westlake Thunder',
      awayLabel: rivalry ? withMascot(rivalry.away_team) : 'Lone Peak Knights',
    };
    const extras = games
      .filter(
        (game) => !isWestlakeLonePeak(game.home_team, game.away_team, game.home_school, game.away_school),
      )
      .slice(0, 3)
      .map((game) => ({
        slug: `game-${game.id}`,
        homeLabel: withMascot(game.home_team),
        awayLabel: withMascot(game.away_team),
      }));
    if (publishedPolls.length === 0) return [featured, ...extras];
    const seen = new Set(publishedPolls.map((poll) => poll.slug));
    const rest = [featured, ...extras].filter((poll) => !seen.has(poll.slug));
    return [...publishedPolls, ...rest];
  }, [games, publishedPolls]);

  const visiblePolls = useMemo(() => {
    if (!schoolFilter) return schoolPolls;
    return schoolPolls.filter((poll) => blobMatchesSchool(`${poll.homeLabel} ${poll.awayLabel}`, schoolFilter));
  }, [schoolFilter, schoolPolls]);

  const schoolOptions = useMemo(() => schoolOptionsFromGames(games), [games]);

  const onSearchChange = (text: string) => {
    setSearchQuery(text);
    const now = Date.now();
    if (now - lastTypeHaptic.current < TYPE_HAPTIC_MS) return;
    lastTypeHaptic.current = now;
    lightImpact();
  };

  const openSponsorSheet = () => {
    if (!live.layouts.sponsorshipModal) return;
    lightImpact();
    trackFeature('sponsorship');
    setSponsorSheetOpen(true);
  };

  const openGame = (gameId: string) => {
    trackFeature('live_game');
    router.push(localGameHref(gameId));
  };

  const closeExplore = () => {
    setSearchQuery('');
    Keyboard.dismiss();
  };

  const selectAthlete = (playerId: string) => {
    closeExplore();
    router.push(userProfileHref(playerId));
  };

  const selectSchool = (school: string) => {
    setSchoolFilter(school);
    setHighlightedSponsorId(null);
    setHub('polls');
    closeExplore();
  };

  const selectBooster = (sponsorId: string) => {
    setHighlightedSponsorId(sponsorId);
    setSchoolFilter(null);
    setHub('polls');
    closeExplore();
    setTimeout(() => {
      const x = sponsorX.current[sponsorId];
      if (typeof x !== 'number') return;
      sponsorRailRef.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
    }, 120);
  };

  // Local left the fan bar for a Home pill, so this guard is now what `tabs.local` enforces.
  if (!live.tabs.local) {
    return <RuntimePaused title="Local is paused" lede="Turn Local back on in Admin → Features, then Publish to app." />;
  }

  return (
    <TabScreen>
      <View style={styles.page}>
        <View style={styles.topChrome}>
          <ScreenHeading
            compact
            kicker={live.copy.localKicker}
            title="Local"
            lede={live.copy.localLede}
            accent={TAB_ACCENTS.local.color}
          />
          {live.layouts.localSearch ? (
          <View style={styles.searchWrap}>
            <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.searchGlyph}>
              🔍
            </Text>
            <TextInput
              value={searchQuery}
              onChangeText={onSearchChange}
              onFocus={lightImpact}
              placeholder="Search players, schools, or sponsors..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search players, schools, or sponsors"
              style={styles.search}
            />
            {searchQuery.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={closeExplore} style={styles.clearButton}>
                <Text style={styles.searchClear}>✕</Text>
              </Pressable>
            ) : null}
          </View>
          ) : null}
        </View>

        <View style={styles.hubFrame}>
          <ScrollFxScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} onScroll={onScroll}>
            <FilterPills
              items={hubs}
              value={hub}
              onChange={(id) => {
                if (id) {
                  trackFeature(`hub.${id}`);
                  setHub(id);
                }
              }}
              accessibilityLabel="Local hub"
            />
            {hubs.length === 0 ? (
              <EmptyState
                kicker="Local"
                title="Local boards are paused"
                lede="Local matchups, polls and booster boards are unavailable right now."
                adminHref="/admin/features"
                adminLabel="Open Features"
                accent={TAB_ACCENTS.local.color}
              />
            ) : null}

            <View
              style={[styles.matchesPane, hub !== 'matches' ? styles.hubPaneHidden : undefined]}
              pointerEvents={hub === 'matches' ? 'auto' : 'none'}
            >
              <FilterPills
                items={regionPills}
                value={filterId}
                allowDeselect
                onChange={setFilterId}
                accessibilityLabel="Region filters"
              />

              <Text accessibilityRole="header" style={styles.sectionTitle}>Live matchups</Text>

              {loading ? (
                <View style={styles.loadingBlock}>
                  <ActivityIndicator color={TAB_ACCENTS.local.color} size="large" />
                  <Text style={styles.muted}>Loading live scores…</Text>
                  <MatchupSkeleton />
                  <MatchupSkeleton />
                </View>
              ) : error ? (
                <EmptyState
                  kicker="Local"
                  title="Couldn’t load games"
                  lede={error}
                  actionLabel="Try again"
                  onAction={() => void refresh()}
                  adminHref="/admin/games"
                  adminLabel="Open Live games"
                  accent={TAB_ACCENTS.local.color}
                />
              ) : filteredGames.length === 0 ? (
                <EmptyState
                  kicker="Live matchups"
                  title={games.length === 0 ? live.copy.localEmpty : 'No games in this region'}
                  lede={
                    games.length === 0
                      ? 'Games appear here when a matchup is available.'
                      : 'Try another regional tag, or clear the chip.'
                  }
                  adminHref="/admin/games"
                  adminLabel="Open Live games"
                  accent={TAB_ACCENTS.local.color}
                />
              ) : (
                <View style={styles.list}>
                  {filteredGames.map((game, index) => (
                    <ScrollFxItem key={game.id} index={index} variant="tilt">
                      <GameCard
                        game={game}
                        sponsors={sponsorsForGame(game, sponsors)}
                        onPress={() => openGame(game.id)}
                      />
                    </ScrollFxItem>
                  ))}
                </View>
              )}
            </View>

            <View
              style={[styles.pollStack, hub !== 'polls' ? styles.hubPaneHidden : undefined]}
              pointerEvents={hub === 'polls' ? 'auto' : 'none'}
            >
              <Text accessibilityRole="header" style={styles.sectionTitle}>Team boosters & sponsors</Text>
              <ScrollView
                ref={sponsorRailRef}
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sponsorRail}
              >
                {live.layouts.sponsorshipModal ? (
                <AnimatedButton
                  accessibilityLabel="+ Become a Team Sponsor"
                  haptic="none"
                  onPress={openSponsorSheet}
                  contentStyle={styles.ctaCard}
                >
                  <Text style={styles.ctaPlus}>+</Text>
                  <Text style={styles.ctaTitle}>Become a Team Sponsor</Text>
                  <Text style={styles.ctaLede}>Silver · Gold · Platinum</Text>
                </AnimatedButton>
                ) : null}
                {sponsors.map((sponsor, index) => (
                  <ScrollFxItem key={sponsor.id} index={index} variant="zoom">
                    <SponsorRailCard
                      sponsor={sponsor}
                      highlighted={highlightedSponsorId === sponsor.id}
                      onLayoutX={(x) => {
                        sponsorX.current[sponsor.id] = x;
                      }}
                      onPress={() => selectBooster(sponsor.id)}
                    />
                  </ScrollFxItem>
                ))}
              </ScrollView>

              <View style={styles.pollHead}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>School polls</Text>
                {schoolFilter ? (
                  <View style={styles.schoolChip}>
                    <Text style={styles.schoolChipLabel}>
                      Polls for {schoolFilter}
                    </Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="Clear school poll filter" onPress={() => setSchoolFilter(null)} style={styles.clearButton}>
                      <Text style={styles.schoolChipClear}>✕</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
              <Text style={styles.hubCopy}>Choose a team to add your cheer and see the community’s support.</Text>
              {visiblePolls.length === 0 ? (
                <EmptyState
                  kicker="School polls"
                  title={schoolFilter ? `No polls for ${schoolFilter}` : 'No school polls yet'}
                  lede={
                    schoolFilter
                      ? 'Clear the school chip or search another high school.'
                      : 'School matchups appear here when a poll is available.'
                  }
                  adminHref="/admin/polls"
                  adminLabel="Open Polls"
                  accent={TAB_ACCENTS.local.color}
                />
              ) : (
                visiblePolls.map((poll, index) => (
                  <ScrollFxItem key={poll.slug} index={index} variant={index % 2 === 0 ? 'slide-left' : 'slide-right'}>
                    <CheerPollCard
                      slug={poll.slug}
                      homeLabel={poll.homeLabel}
                      awayLabel={poll.awayLabel}
                    />
                  </ScrollFxItem>
                ))
              )}
            </View>

            <View
              style={[styles.boosterStack, hub !== 'boosters' ? styles.hubPaneHidden : undefined]}
              pointerEvents={hub === 'boosters' ? 'auto' : 'none'}
            >
              <Text style={styles.hubCopy}>
                Top Aura Boosters — Slate Silver through Celestial Prism. Tap a card to peek the profile.
              </Text>
              <ScrollFxItem variant="rise">
                <TopAuraBoosters hideTitle />
              </ScrollFxItem>
            </View>
          </ScrollFxScrollView>

          <SearchResultsOverlay
            searchQuery={live.layouts.localSearch ? searchQuery : ''}
            extraHits={extraHits}
            onApplyQuery={setSearchQuery}
            onSelectAthlete={(playerId) => selectAthlete(playerId)}
            onSelectSchool={selectSchool}
            onSelectBooster={(sponsorId) => selectBooster(sponsorId)}
          />
        </View>
      </View>
      <SponsorshipModal
        visible={sponsorSheetOpen}
        schoolOptions={schoolOptions}
        onClose={() => setSponsorSheetOpen(false)}
        onSponsored={recordSponsorship}
      />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  topChrome: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  hubFrame: {
    flex: 1,
    position: 'relative',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 20,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    backgroundColor: TAB_ACCENTS.local.mist,
    borderWidth: 1.5,
    borderColor: TAB_ACCENTS.local.color,
    borderRadius: radii.md,
  },
  searchGlyph: {
    fontSize: 16,
  },
  search: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 12,
  },
  searchClear: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  clearButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: TAB_ACCENTS.local.color,
    paddingLeft: 10,
  },
  hubCopy: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  pollStack: {
    gap: 16,
  },
  pollHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  schoolChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  schoolChipLabel: {
    flexShrink: 1,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  schoolChipClear: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  sponsorRail: {
    gap: 10,
    paddingRight: 8,
    paddingBottom: 4,
  },
  ctaCard: {
    width: 168,
    minHeight: 168,
    backgroundColor: TAB_ACCENTS.local.mist,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: TAB_ACCENTS.local.color,
    padding: 12,
    gap: 6,
    alignItems: 'flex-start',
    justifyContent: 'center',
    ...cardShadow,
  },
  ctaPlus: {
    color: TAB_ACCENTS.local.color,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  ctaTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  ctaLede: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  boosterStack: {
    gap: 8,
  },
  hubPaneHidden: {
    display: 'none',
  },
  list: {
    gap: 12,
  },
  matchesPane: {
    gap: 14,
  },
  loadingBlock: {
    gap: 12,
    alignItems: 'center',
    paddingTop: 8,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  empty: {
    gap: 8,
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  retry: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: colors.deepGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '800',
  },
});
