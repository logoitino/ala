/** Fan menu presentation uses shared Daylight chrome; feature data and confirmation rules stay with the parent.
 * Search orders recent terms in a shared list and mounts only visible result rows.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { FilterPills } from '@/components/UI/FilterPills';
import { RecentSearchList } from '@/components/UI/RecentSearchList';
import { colors, MENU_METRICS, radii } from '@/constants/theme';
import { useLocalSearch, useRecentLocalSearches } from '@/hooks/useLocalSearch';
import type { HighlightClip } from '@/data/highlights';
import type { LocalSearchHit, Player } from '@/types/database';
import { SPRING_CARD } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

type SearchKind = 'all' | 'highlight' | 'athlete';

const KIND_PILLS: { id: SearchKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'highlight', label: 'Highlights' },
  { id: 'athlete', label: 'Athletes' },
];

type HomeSearchOverlayProps = {
  open: boolean;
  query: string;
  offsetTop?: number;
  clips: { clip: HighlightClip; player: Player | null }[];
  onApplyQuery: (query: string) => void;
  onClose: () => void;
  onSelectAthlete: (playerId: string) => void;
  onSelectClip: (clipId: string) => void;
};

type HomeHit = {
  id: string;
  kind: 'highlight' | 'athlete';
  title: string;
  subtitle: string;
  clipId?: string;
  playerId?: string;
};

function needleMatch(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

/**
 * @purpose Home search drawer: Highlight titles + athlete profiles from the live feed and `search_local_entities`.
 * @param open Header search field is expanded.
 * @param query Header value; sheet lists recents until two characters, then live hits.
 * @param clips Current Home/All/Seki feed rows for title / school / name matching.
 * @returns Overlay covering the feed below the Home search field.
 * @sideEffects `useLocalSearch` RPC for athletes; AsyncStorage recent rows.
 */
export function HomeSearchOverlay({
  open,
  query,
  offsetTop = 8,
  clips,
  onApplyQuery,
  onClose,
  onSelectAthlete,
  onSelectClip,
}: HomeSearchOverlayProps) {
  const needle = query.trim();
  const searching = needle.length > 1;
  const [kind, setKind] = useState<SearchKind>('all');
  const { hits, loading } = useLocalSearch(open && searching && kind !== 'highlight' ? needle : '', 'athlete');
  const { recent, remember, clearRecent } = useRecentLocalSearches();
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(reducedMotion ? 0 : 28);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  const localHits = useMemo<HomeHit[]>(() => {
    const normalized = needle.toLowerCase();
    if (!open || normalized.length < 2) return [];
    const rows: HomeHit[] = [];
    const seenAthletes = new Set<string>();
    for (const item of clips) {
      const hay = `${item.clip.tag} ${item.clip.athleteName} ${item.clip.school}`;
      if (!needleMatch(hay, normalized)) continue;
      rows.push({
        id: `hl:${item.clip.id}`,
        kind: 'highlight',
        title: item.clip.tag || 'Highlight',
        subtitle: [item.clip.athleteName, item.clip.school].filter(Boolean).join(' · '),
        clipId: item.clip.id,
      });
      const playerId = item.player?.id ?? item.clip.playerId ?? '';
      if (playerId && !seenAthletes.has(playerId) && needleMatch(`${item.clip.athleteName} ${item.clip.school}`, normalized)) {
        seenAthletes.add(playerId);
        rows.push({
          id: `ath:${playerId}`,
          kind: 'athlete',
          title: item.clip.athleteName,
          subtitle: item.clip.school || 'Athlete',
          playerId,
        });
      }
    }
    return rows;
  }, [clips, needle, open]);

  const merged = useMemo(() => {
    const rows: HomeHit[] = [];
    const seen = new Set<string>();
    const push = (hit: HomeHit) => {
      const key =
        hit.kind === 'athlete'
          ? `athlete:${hit.playerId ?? hit.id}`
          : `highlight:${hit.clipId ?? hit.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(hit);
    };
    if (kind !== 'athlete') localHits.filter((hit) => hit.kind === 'highlight').forEach(push);
    if (kind !== 'highlight') {
      localHits.filter((hit) => hit.kind === 'athlete').forEach(push);
      hits.forEach((hit: LocalSearchHit) => {
        if (hit.entity_type !== 'athlete') return;
        push({
          id: `rpc:${hit.entity_id}`,
          kind: 'athlete',
          title: hit.title,
          subtitle: hit.subtitle || 'Athlete',
          playerId: hit.entity_id,
        });
      });
    }
    return rows;
  }, [hits, kind, localHits]);

  useEffect(() => {
    if (open && !reducedMotion) {
      translateY.value = withSpring(0, SPRING_CARD);
      opacity.value = withTiming(1, { duration: 160 });
    }
  }, [opacity, open, reducedMotion, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const openHit = (hit: HomeHit) => {
    void remember(query);
    if (hit.kind === 'athlete' && hit.playerId) {
      onSelectAthlete(hit.playerId);
      return;
    }
    if (hit.clipId) onSelectClip(hit.clipId);
  };

  if (!open) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: offsetTop }, !searching && styles.recentBackdrop, sheetStyle]}
    >
      <View pointerEvents="auto" style={[styles.sheet, searching && styles.resultsSheet]}>
        <MenuBackdrop accent="jade" />
        <SheetHandle onDismiss={onClose} />
        <Text style={styles.kicker}>Search Home</Text>
        <FilterPills
          items={KIND_PILLS}
          value={kind}
          onChange={(id) => setKind(id ?? 'all')}
          accessibilityLabel="Search kind"
        />
        <FlatList
          data={searching ? merged : []}
          keyExtractor={(hit) => hit.id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          style={!searching ? styles.recentBody : undefined}
          ListEmptyComponent={searching
            ? (loading ? undefined : <Text style={styles.empty}>No clips or athletes match that yet.</Text>)
            : (recent.length > 0
              ? <RecentSearchList items={recent} onSelect={onApplyQuery} onClear={() => void clearRecent()} />
              : <Text style={styles.empty}>Search clips, athletes, and schools.</Text>)}
          ListFooterComponent={searching && loading ? <ActivityIndicator color={colors.primary} /> : undefined}
          renderItem={({ item: hit }) => (
            <AnimatedButton haptic="light" onPress={() => openHit(hit)} contentStyle={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons
                  name={hit.kind === 'highlight' ? 'play-circle-outline' : 'flash-outline'}
                  size={20}
                  color={colors.primary}
                />
                <View pointerEvents="none" style={styles.rowIconGloss} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{hit.title}</Text>
                <Text style={styles.rowMeta}>
                  {hit.kind === 'highlight' ? 'Highlight' : 'Athlete'} · {hit.subtitle}
                </Text>
              </View>
            </AnimatedButton>
          )}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    paddingHorizontal: 12,
  },
  recentBackdrop: { backgroundColor: colors.videoScrim },
  sheet: {
    flexShrink: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  resultsSheet: { flex: 1 },
  recentBody: { flexGrow: 0, flexShrink: 1 },
  kicker: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  empty: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('600'),
    paddingVertical: 12,
  },
  row: {
    minHeight: 52,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowIconGloss: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 20,
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ rotate: '-18deg' }],
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    ...TYPE.section,
    ...figtree('800'),
  },
  rowMeta: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('600'),
  },
});
