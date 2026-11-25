/** Local shows the shared recent list until typing and renders only visible search results. */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { FilterPills } from '@/components/UI/FilterPills';
import { RecentSearchList } from '@/components/UI/RecentSearchList';
import { colors, radii } from '@/constants/theme';
import { useLocalSearch, useRecentLocalSearches } from '@/hooks/useLocalSearch';
import type { LocalSearchHit, LocalSearchKind } from '@/types/database';
import { SHEET_REDUCED_MS, SPRING_SHEET } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

const KIND_PILLS: { id: LocalSearchKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'athlete', label: 'Athletes' },
  { id: 'school', label: 'Schools' },
  { id: 'booster', label: 'Boosters' },
];

type SearchResultsOverlayProps = {
  searchQuery: string;
  extraHits?: LocalSearchHit[];
  onApplyQuery: (query: string) => void;
  onSelectAthlete: (playerId: string, title: string) => void;
  onSelectSchool: (school: string) => void;
  onSelectBooster: (sponsorId: string, title: string) => void;
};

function kindIcon(kind: LocalSearchHit['entity_type']): keyof typeof Ionicons.glyphMap {
  if (kind === 'athlete') return 'flash-outline';
  if (kind === 'booster') return 'trophy-outline';
  return 'school-outline';
}

function kindLabel(kind: LocalSearchHit['entity_type']): string {
  if (kind === 'athlete') return 'Athlete';
  if (kind === 'booster') return 'Booster';
  return 'School';
}

/**
 * @purpose Sliding Local Explore drawer: kind chips, recent queries, and live `search_local_entities` hits.
 * @param searchQuery Header value; the route mounts the sheet once search starts.
 * @param extraHits Client-side school / booster rows (demo rail) merged with RPC hits.
 * @param onApplyQuery Fills the header from a recent row.
 * @param onSelectAthlete Opens the public athlete profile (`/user/[id]`).
 * @param onSelectSchool Filters School Polls for that high school.
 * @param onSelectBooster Highlights that sponsor on the Local Boosters rail.
 * @returns Overlay that covers the hub below the persistent search bar.
 * @sideEffects `useLocalSearch` RPC; AsyncStorage recent rows; Light haptics on row / chip press.
 */
export function SearchResultsOverlay({
  searchQuery,
  extraHits,
  onApplyQuery,
  onSelectAthlete,
  onSelectSchool,
  onSelectBooster,
}: SearchResultsOverlayProps) {
  const searching = searchQuery.trim().length > 1;
  const [kind, setKind] = useState<LocalSearchKind>('all');
  const { hits, loading } = useLocalSearch(searching ? searchQuery : '', kind);
  const { recent, remember, clearRecent } = useRecentLocalSearches();
  const mergedHits = useMemo(() => {
    const seen = new Set(hits.map((hit) => `${hit.entity_type}:${hit.entity_id.toLowerCase()}`));
    const extras = (extraHits ?? []).filter((hit) => {
      if (kind !== 'all' && hit.entity_type !== kind) return false;
      const key = `${hit.entity_type}:${hit.entity_id.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [...hits, ...extras];
  }, [extraHits, hits, kind]);
  const reduceMotion = useReducedMotion() === true;
  const translateY = useSharedValue(28);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = reduceMotion ? withTiming(0, { duration: SHEET_REDUCED_MS }) : withSpring(0, SPRING_SHEET);
    opacity.value = withTiming(1, { duration: reduceMotion ? SHEET_REDUCED_MS : 160 });
  }, [opacity, reduceMotion, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const openHit = (hit: LocalSearchHit) => {
    void remember(searchQuery);
    if (hit.entity_type === 'athlete') {
      onSelectAthlete(hit.entity_id, hit.title);
      return;
    }
    if (hit.entity_type === 'booster') {
      onSelectBooster(hit.entity_id, hit.title);
      return;
    }
    onSelectSchool(hit.title);
  };

  return (
    <Animated.View
      style={[styles.wrap, sheetStyle]}
    >
      <View style={[styles.sheet, searching ? styles.results : styles.recentSheet]}>
        {searching ? <>
          <Text style={styles.kicker}>Explore</Text>
          <FilterPills items={KIND_PILLS} value={kind}
            onChange={(id) => { if (id) setKind(id); }} accessibilityLabel="Search entity filters" />
          <FlatList
            data={mergedHits}
            keyExtractor={(hit) => `${hit.entity_type}:${hit.entity_id}`}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.results}
            contentContainerStyle={styles.list}
            initialNumToRender={8}
            ListEmptyComponent={loading ? (
                <View style={styles.empty}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.emptyCopy}>Searching Local…</Text>
                </View>
              ) : (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>No matches</Text>
                  <Text style={styles.emptyCopy}>Try an athlete, high school, or booster name.</Text>
                </View>
              )}
            renderItem={({ item: hit }) => (
              <AnimatedButton
                accessibilityLabel={`${kindLabel(hit.entity_type)} ${hit.title}`}
                onPress={() => openHit(hit)}
                contentStyle={styles.row}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name={kindIcon(hit.entity_type)} size={18} color={colors.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowKind}>{kindLabel(hit.entity_type)}</Text>
                  <Text style={styles.rowTitle}>{hit.title}</Text>
                  {hit.subtitle ? <Text style={styles.rowSub}>{hit.subtitle}</Text> : null}
                </View>
              </AnimatedButton>
            )}
          />
        </> : (
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.recentBody} showsVerticalScrollIndicator={false}>
            {recent.length > 0
              ? <RecentSearchList items={recent} onSelect={onApplyQuery} onClear={() => void clearRecent()} />
              : <Text style={[styles.emptyCopy, styles.recentHint]}>Search for an athlete, school or booster.</Text>}
          </ScrollView>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    paddingTop: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.background,
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 10,
  },
  recentSheet: {
    flexShrink: 1,
    backgroundColor: colors.surface,
    paddingVertical: 4,
  },
  recentBody: { flexGrow: 0, flexShrink: 1 },
  recentHint: { paddingVertical: 12 },
  kicker: {
    color: colors.primary,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  results: {
    flex: 1,
  },
  list: {
    gap: 8,
    paddingBottom: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowKind: {
    color: colors.primary,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  rowTitle: {
    color: colors.text,
    ...TYPE.section,
    ...figtree('800'),
  },
  rowSub: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('600'),
  },
  empty: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    ...TYPE.section,
    ...figtree('800'),
  },
  emptyCopy: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('600'),
    textAlign: 'center',
  },
});
