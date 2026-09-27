import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScrollFxItem, ScrollFxScrollView } from '@/components/Effects/ScrollFx';
import { CheerPollCard } from '@/components/Local/CheerPollCard';
import { SearchResultsOverlay } from '@/components/Local/SearchResultsOverlay';
import { SponsorshipModal } from '@/components/Local/SponsorshipModal';
import { GameCard } from '@/components/GameCard';
import { ScreenHeading } from '@/components/ScreenHeading';
import { TabScreen } from '@/components/TabScreen';
import { TopAuraBoosters } from '@/components/TopAuraBoosters';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { EmptyState } from '@/components/UI/EmptyState';
import { FilterPills } from '@/components/UI/FilterPills';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import {
  UTAH_REGIONS,
  gameInRegion,
  isRivalryGame,
} from '@/data/regions';
import { initialsForBusiness, sponsorTierById } from '@/data/sponsorships';
import { useLiveScores } from '@/hooks/useLiveScores';
import { usePublishedCheerPolls } from '@/hooks/useCheerPoll';
import { useSponsorships } from '@/hooks/useSponsorships';
import { useSurfaceUsage } from '@/hooks/useSurfaceUsage';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { localGameHref, userProfileHref } from '@/lib/navigation';
import { FOCAL, TAB_ACCENTS } from '@/theme/motion';
import type { Game, LocalSearchHit, Sponsorship } from '@/types/database';

type LocalHubId = 'matches' | 'polls' | 'boosters';

const LOCAL_HUB_IDS: LocalHubId[] = ['matches', 'polls', 'boosters'];

const TYPE_HAPTIC_MS = 110;

const MASCOTS: Record<string, string> = {
  westlake: 'Thunder',
  'lone peak': 'Knights',
};

function withMascot(name: string | null | undefined): string {
  const value = typeof name === 'string' ? name.trim() : '';
  if (!value) return '';
  const lower = value.toLowerCase();
  for (const [key, mascot] of Object.entries(MASCOTS)) {
    if (lower.includes(key) && !lower.includes(mascot.toLowerCase())) {
      return `${value} ${mascot}`;
    }
  }
  return value;
}

function isWestlakeLonePeak(home: string, away: string, homeSchool: string, awaySchool: string) {
  const blob = `${home} ${away} ${homeSchool} ${awaySchool}`.toLowerCase();
  return blob.includes('westlake') && blob.includes('lone peak');
}

function schoolOptionsFromGames(games: Game[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const game of games) {
    for (const raw of [game.home_team, game.away_team, game.home_school, game.away_school]) {
      const name = withMascot(raw);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
  }
  return names;
}

function sponsorsForGame(game: Game, sponsors: Sponsorship[]): Sponsorship[] {
  const blob = `${game.home_team} ${game.away_team} ${game.home_school} ${game.away_school}`.toLowerCase();
  return sponsors.filter((sponsor) => {
    const tag = sponsor.school_team.trim().toLowerCase();
    if (!tag) return false;
    if (blob.includes(tag)) return true;
    return tag.split(/\s+/).some((token) => token.length > 3 && blob.includes(token));
  });
}

function lightImpact() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Simulator / web may not expose haptics.
  }
}

function blobMatchesSchool(blob: string, school: string): boolean {
  const hay = blob.toLowerCase();
  const needle = school.trim().toLowerCase();
  if (!needle) return false;
  if (hay.includes(needle) || needle.includes(hay)) return true;
  return needle.split(/\s+/).some((token) => token.length > 3 && hay.includes(token));
}

function extraLocalHits(query: string, sponsors: Sponsorship[], schools: string[]): LocalSearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length <= 1) return [];
  const hits: LocalSearchHit[] = [];
  for (const school of schools) {
    if (!school.toLowerCase().includes(needle)) continue;
    hits.push({
      entity_type: 'school',
      entity_id: school,
      title: school,
      subtitle: 'High school',
    });
  }
  for (const sponsor of sponsors) {
    if (
      !sponsor.business_name.toLowerCase().includes(needle) &&
      !sponsor.school_team.toLowerCase().includes(needle)
    ) {
      continue;
    }
    hits.push({
      entity_type: 'booster',
      entity_id: sponsor.id,
      title: sponsor.business_name,
      subtitle: sponsor.school_team,
    });
  }
  return hits;
}

function SponsorRailCard({
  sponsor,
  highlighted,
  onLayoutX,
  onPress,
}: {
  sponsor: Sponsorship;
  highlighted: boolean;
  onLayoutX: (x: number) => void;
  onPress: () => void;
}) {
  const pack = sponsorTierById(sponsor.tier);
  return (
    <View onLayout={(event) => onLayoutX(event.nativeEvent.layout.x)}>
      <AnimatedButton
        accessibilityRole="button"
        accessibilityLabel={`${sponsor.business_name}, ${pack.badge}, ${sponsor.school_team}`}
        haptic="selection"
        onPress={onPress}
        contentStyle={[
          styles.sponsorCard,
          sponsor.tier === 'gold' || sponsor.tier === 'platinum' ? styles.sponsorCardGold : undefined,
          highlighted ? styles.sponsorCardOn : undefined,
        ]}
      >
        <View style={styles.sponsorLogo}>
          {sponsor.logo_url ? (
            <Image source={{ uri: sponsor.logo_url }} style={styles.sponsorLogoImage} />
          ) : (
            <Text style={styles.sponsorInitials}>{initialsForBusiness(sponsor.business_name)}</Text>
          )}
        </View>
        <Text style={styles.sponsorName} numberOfLines={2}>
          {sponsor.business_name}
        </Text>
        {sponsor.school_team ? (
          <Text style={styles.sponsorSchool} numberOfLines={1}>
            {sponsor.school_team}
          </Text>
        ) : null}
        <View style={[styles.tierBadge, { borderColor: pack.accent }]}>
          <Text style={[styles.tierBadgeLabel, { color: pack.accent }]}>{pack.badge}</Text>
        </View>
      </AnimatedButton>
    </View>
  );
}

function MatchupSkeleton() {
  return (
    <View style={styles.skeleton}>
      <View style={styles.skeletonChip} />
      <View style={styles.skeletonRow}>
        <View style={styles.skeletonLogo} />
        <View style={styles.skeletonScore} />
        <View style={styles.skeletonLogo} />
      </View>
      <View style={styles.skeletonCta} />
    </View>
  );
}

/**
 * @purpose Local Discovery hub: persistent Explore search, Live Matches, rivalry School Polls, and Top Aura Boosters. Game cards tilt up and polls zig-zag in as the hub scrolls (`ScrollFxItem`).
 * @sideEffects `useLiveScores` Realtime; `search_local_entities` via overlay; `CheerPollCard` votes; `SponsorshipModal` PaymentSheet; Light `impactAsync` on search focus/type. Game taps push `/local/game/[id]` so `FanTabBar` stays visible.
 */
export default function LocalTab() {
  const router = useRouter();
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
  const sponsorRailRef = useRef<ScrollView>(null);
  const sponsorX = useRef<Record<string, number>>({});

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
              <Pressable accessibilityLabel="Clear search" onPress={closeExplore} hitSlop={8}>
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
              accent={FOCAL.goldInk}
              mist={FOCAL.mistGold}
            />
            {hubs.length === 0 ? (
              <EmptyState
                kicker="Local"
                title="Local boards are paused"
                lede="Turn Live Matches, School Polls, or Top Boosters on in Features, then Publish to app."
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
                accent={FOCAL.cyanInk}
                mist={FOCAL.mistCyan}
              />

              <Text style={styles.sectionTitle}>Live matchups</Text>

              {loading ? (
                <View style={styles.loadingBlock}>
                  <ActivityIndicator color={colors.deepGreen} size="large" />
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
                      ? 'Publish a match on Live games so Friday night lands here.'
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
              <Text style={styles.sectionTitle}>Local Team Boosters & Sponsors 🏆</Text>
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
                {sponsors.map((sponsor) => (
                  <SponsorRailCard
                    key={sponsor.id}
                    sponsor={sponsor}
                    highlighted={highlightedSponsorId === sponsor.id}
                    onLayoutX={(x) => {
                      sponsorX.current[sponsor.id] = x;
                    }}
                    onPress={() => selectBooster(sponsor.id)}
                  />
                ))}
              </ScrollView>

              <View style={styles.pollHead}>
                <Text style={styles.sectionTitle}>School polls</Text>
                {schoolFilter ? (
                  <View style={styles.schoolChip}>
                    <Text style={styles.schoolChipLabel} numberOfLines={1}>
                      Polls for {schoolFilter}
                    </Text>
                    <Pressable accessibilityLabel="Clear school poll filter" onPress={() => setSchoolFilter(null)}>
                      <Text style={styles.schoolChipClear}>✕</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
              <Text style={styles.hubCopy}>Tap a side to lock in your cheer. Bars spring to the live share.</Text>
              {visiblePolls.length === 0 ? (
                <EmptyState
                  kicker="School polls"
                  title={schoolFilter ? `No polls for ${schoolFilter}` : 'No school polls yet'}
                  lede={
                    schoolFilter
                      ? 'Clear the school chip or search another high school.'
                      : 'Create a cheer matchup on the Polls desk to fill this board.'
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
              <TopAuraBoosters hideTitle />
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
    paddingBottom: 24,
    gap: 14,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    backgroundColor: FOCAL.mistGold,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    borderRadius: radii.md,
  },
  searchGlyph: {
    fontSize: 16,
  },
  search: {
    flex: 1,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: FOCAL.electricGold,
    paddingLeft: 10,
  },
  hubCopy: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  pollStack: {
    gap: 12,
  },
  pollHead: {
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
  sponsorCard: {
    width: 168,
    backgroundColor: FOCAL.mistCyan,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  sponsorCardGold: {
    backgroundColor: FOCAL.mistGold,
    borderColor: FOCAL.electricGold,
  },
  sponsorCardOn: {
    borderWidth: 2,
    borderColor: FOCAL.electricGold,
    shadowColor: FOCAL.electricGold,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  sponsorLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.photoPlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sponsorLogoImage: {
    width: 48,
    height: 48,
  },
  sponsorInitials: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  sponsorName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  sponsorSchool: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  tierBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tierBadgeLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  ctaCard: {
    width: 168,
    minHeight: 168,
    backgroundColor: FOCAL.mistGold,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    padding: 12,
    gap: 6,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  ctaPlus: {
    color: FOCAL.goldInk,
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
  skeleton: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
  },
  skeletonChip: {
    width: 72,
    height: 18,
    borderRadius: 999,
    backgroundColor: colors.photoPlaceholder,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skeletonLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.photoPlaceholder,
  },
  skeletonScore: {
    width: 64,
    height: 18,
    borderRadius: 8,
    backgroundColor: colors.photoPlaceholder,
  },
  skeletonCta: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.photoPlaceholder,
  },
});
