/**
 * The Home pill row: Home / Beyond feed tabs with clip counts, the sliding jade indicator, and the Local jump
 * (split out of app/(tabs)/index.tsx for R4-03; behaviour unchanged). The route keeps the filter state, the pill
 * layout measurements and the indicator animation, so hook order in the route is unchanged; this file renders them.
 * Local is a destination, not a filter, so it navigates instead of switching the feed.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 * UX-16 removes excess framing around44pt actions; measured indicator geometry and readable counts remain.
 * Constrained tab content lets enlarged labels wrap inside their measured slots rather than overlap.
 * UX-18 paints the outline over the same44pt controls instead of adding height around them.
 */
import type { RefObject } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { useRouter } from 'expo-router';
import Animated, { type useAnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors } from '@/constants/theme';
import type { HighlightFeedFilter } from '@/data/highlights';
import type { AppRuntimeConfig } from '@/lib/runtime';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

/**
 * @purpose Render the Home feed switch and Local jump from the route's state.
 * @param feedPills Pills on the bar (Home, plus Beyond while `tabs.beyond` is on).
 * @param feedFilter Selected pill. @param feedCounts Clip count badge per pill.
 * @param feedLayouts / feedReady / placeFeedPill The route's pill measurements and indicator placement.
 * @param feedIndicatorStyle Animated indicator style from the route.
 * @param switchFeed Selects a pill. @param trackFeature Surface usage tap logging. @param router Opens `/local`.
 */
export function HomeFeedSwitch({
  feedIndicatorStyle,
  feedPills,
  feedFilter,
  feedCounts,
  feedLayouts,
  feedReady,
  placeFeedPill,
  switchFeed,
  runtime,
  trackFeature,
  router,
}: {
  feedIndicatorStyle: ReturnType<typeof useAnimatedStyle<ViewStyle>>;
  feedPills: { id: HighlightFeedFilter; label: string }[];
  feedFilter: HighlightFeedFilter;
  feedCounts: Record<HighlightFeedFilter, number>;
  feedLayouts: RefObject<Partial<Record<HighlightFeedFilter, { x: number; width: number }>>>;
  feedReady: RefObject<boolean>;
  placeFeedPill: (id: HighlightFeedFilter, animate: boolean) => void;
  switchFeed: (id: HighlightFeedFilter) => void;
  runtime: AppRuntimeConfig;
  trackFeature: (feature: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <View style={styles.feedSwitch} accessibilityRole="tablist" accessibilityLabel="Home feed">
      <View pointerEvents="none" style={styles.feedOutline} />
      <Animated.View pointerEvents="none" style={[styles.feedIndicator, feedIndicatorStyle]} />
      {feedPills.map((item) => {
        const on = feedFilter === item.id;
        const count = feedCounts[item.id];
        return (
          <View
            key={item.id}
            style={styles.feedPillSlot}
            onLayout={(event) => {
              const { x, width } = event.nativeEvent.layout;
              feedLayouts.current[item.id] = { x, width };
              if (item.id === feedFilter) placeFeedPill(item.id, feedReady.current);
            }}
          >
          <AnimatedButton
            haptic="selection"
            accessibilityRole="tab"
            accessibilityLabel={`${item.label}, ${count} ${count === 1 ? 'clip' : 'clips'}`}
            accessibilityState={{ selected: on }}
            style={styles.feedPillSlot}
            contentStyle={[styles.feedPill, styles.feedTabContent]}
            onPress={() => switchFeed(item.id)}
          >
            <Text style={[styles.feedPillLabel, on && styles.feedPillLabelOn]}>{item.label}</Text>
            {count > 0 ? (
              <Text style={[styles.feedPillCount, on && styles.feedPillCountOn]}>{count}</Text>
            ) : null}
          </AnimatedButton>
          </View>
        );
      })}
      {/* Local is a destination, not a feed filter — the divider and chevron say so. */}
      {runtime.tabs.local ? (
        <>
          <View style={styles.feedDivider} />
          <AnimatedButton
            haptic="selection"
            accessibilityRole="button"
            accessibilityLabel="Open Local: live matches, school polls and boosters"
            contentStyle={[styles.feedPill, styles.localPill]}
            onPress={() => {
              trackFeature('feed.local_jump');
              router.push('/local');
            }}
          >
            <Ionicons name="location" size={13} allowFontScaling={false} color={FOCAL.neonJade} />
            <Text style={[styles.feedPillLabel, styles.localPillLabel]}>Local</Text>
            <Ionicons name="chevron-forward" size={12} allowFontScaling={false} color={FOCAL.neonJade} />
          </AnimatedButton>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  feedSwitch: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.videoScrim,
    borderRadius: 999,
    padding: 0,
  },
  feedOutline: {
    // SDK 58's generated RN types expose no absoluteFillObject; explicit edges keep the same overlay geometry.
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${FOCAL.neonJade}66`,
  },
  feedPill: {
    flexGrow: 0,
    minHeight: 44,
    paddingHorizontal: 6,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedTabContent: { width: '100%', minWidth: 0 },
  feedPillSlot: {
    flex: 1,
    minWidth: 0,
    zIndex: 1,
  },
  feedIndicator: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    left: 0,
    borderRadius: 999,
    backgroundColor: FOCAL.jadeInk,
  },
  feedPillCount: {
    flexShrink: 0,
    color: colors.onVideoMuted,
    ...TYPE.caption,
    includeFontPadding: false,
    ...figtree('800'),
    opacity: 0.75,
  },
  feedPillCountOn: {
    // Count text needs the same contrast as the selected label on the dark jade fill.
    color: colors.onVideo,
    opacity: 1,
  },
  feedDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 6,
    marginHorizontal: 2,
    backgroundColor: colors.onVideoMuted,
    opacity: 0.35,
  },
  localPill: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 6,
  },
  localPillLabel: {
    color: FOCAL.neonJade,
  },
  feedPillLabel: {
    color: colors.onVideoMuted,
    ...TYPE.button,
    includeFontPadding: false,
    ...figtree('700'),
    flexShrink: 1,
    minWidth: 0,
  },
  feedPillLabelOn: {
    color: '#FFFFFF',
  },
});
