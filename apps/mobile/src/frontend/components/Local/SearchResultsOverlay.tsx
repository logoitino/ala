/** UX-13 existing SearchResultsOverlay.tsx presentation keeps all actions/notices while aligning readable type. */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { FilterPills } from '@/components/UI/FilterPills';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
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
 * @param searchQuery Header value; the sheet is open when trimmed length is greater than 1.
 * @param extraHits Client-side school / booster rows (demo rail) merged with RPC hits.
 * @param onApplyQuery Fills the header from a recent chip.
 * @param onSelectAthlete Opens the public athlete profile (`/user/[id]`).
 * @param onSelectSchool Filters School Polls for that high school.
 * @param onSelectBooster Highlights that sponsor on the Local Boosters rail.
 * @returns Overlay that covers the hub below the persistent search bar.
 * @sideEffects `useLocalSearch` RPC; AsyncStorage recent chips; Light haptics on row / chip press.
 */
export function SearchResultsOverlay({
  searchQuery,
  extraHits,
  onApplyQuery,
  onSelectAthlete,
  onSelectSchool,
  onSelectBooster,
}: SearchResultsOverlayProps) {
  const visible = searchQuery.trim().length > 1;
  const [kind, setKind] = useState<LocalSearchKind>('all');
  const { hits, loading } = useLocalSearch(visible ? searchQuery : '', kind);
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
    if (visible) {
      if (reduceMotion) {
        translateY.value = withTiming(0, { duration: SHEET_REDUCED_MS });
        opacity.value = withTiming(1, { duration: SHEET_REDUCED_MS });
        return;
      }
      translateY.value = withSpring(0, SPRING_SHEET);
      opacity.value = withTiming(1, { duration: 160 });
      return;
    }
    translateY.value = withTiming(24, { duration: reduceMotion ? SHEET_REDUCED_MS : 140 });
    opacity.value = withTiming(0, { duration: reduceMotion ? SHEET_REDUCED_MS : 120 });
  }, [opacity, reduceMotion, translateY, visible]);

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
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[styles.wrap, sheetStyle]}
    >
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.kicker}>Explore</Text>
        <FilterPills
          items={KIND_PILLS}
          value={kind}
          onChange={(id) => {
            if (id) setKind(id);
          }}
          accessibilityLabel="Search entity filters"
        />

        {recent.length > 0 ? (
          <View style={styles.recentBlock}>
            <View style={styles.recentHead}>
              <Text style={styles.recentLabel}>Recent</Text>
              <Pressable style={styles.clearHit} accessibilityLabel="Clear recent searches" onPress={() => void clearRecent()}>
                <Text style={styles.recentClear}>Clear</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentRail}
            >
              {recent.map((item) => (
                <AnimatedButton
                  key={item}
                  accessibilityLabel={`Search ${item}`}
                  onPress={() => onApplyQuery(item)}
                  contentStyle={styles.recentChip}
                >
                  <Text style={styles.recentChipLabel}>
                    {item}
                  </Text>
                </AnimatedButton>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {loading && mergedHits.length === 0 ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.emptyCopy}>Searching Local…</Text>
          </View>
        ) : mergedHits.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyCopy}>Try an athlete, high school, or booster name.</Text>
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.results}
            contentContainerStyle={styles.list}
          >
            {mergedHits.map((hit, index) => (
              <Animated.View
                key={`${hit.entity_type}:${hit.entity_id}`}
                entering={FadeInUp.delay(Math.min(index, 6) * 22).duration(140)}
              >
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
                    <Text style={styles.rowTitle}>
                      {hit.title}
                    </Text>
                    {hit.subtitle ? (
                      <Text style={styles.rowSub}>
                        {hit.subtitle}
                      </Text>
                    ) : null}
                  </View>
                </AnimatedButton>
              </Animated.View>
            ))}
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
  },
  sheet: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  kicker: {
    color: colors.primary,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  recentBlock: {
    gap: 6,
  },
  recentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentLabel: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  clearHit: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  recentClear: {
    color: colors.primary,
    ...TYPE.caption,
    ...figtree('800'),
  },
  recentRail: {
    gap: 8,
    paddingRight: 8,
  },
  recentChip: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  recentChipLabel: {
    color: colors.text,
    ...TYPE.caption,
    ...figtree('700'),
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
