/** UX-07: published Drip category labels guide browsing; empty filters stay distinct from an empty catalog. */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { GearCard } from '@/components/Drip/GearCard';
import { ProductSheet } from '@/components/Drip/ProductSheet';
import { ScrollFxItem, ScrollFxParallax, ScrollFxScrollView } from '@/components/Effects/ScrollFx';
import { RuntimePaused } from '@/components/RuntimePaused';
import { ScreenHeading } from '@/components/ScreenHeading';
import { TabScreen } from '@/components/TabScreen';
import { EmptyState } from '@/components/UI/EmptyState';
import { FilterPills } from '@/components/UI/FilterPills';
import { colors } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { DRIP_FILTERS, type DripFilter, type DripItem } from '@/data/shop';
import { useDripCatalog } from '@/hooks/useDripCatalog';
import { useSurfaceUsage } from '@/hooks/useSurfaceUsage';
import { TAB_ACCENTS } from '@/theme/motion';

/**
 * @purpose Drip marketplace: category pills, GearCard 0.96 press, ProductSheet checkout. Cards zig-zag in from
 * alternating sides as the rack scrolls (`ScrollFxItem`), heading drifts with parallax.
 * @sideEffects `shop_products` via `useDripCatalog`; ProductSheet `useTipCheckout` PaymentSheet + `add_user_aura`.
 */
export default function DripTab() {
  const { live } = useAppRuntime();
  const { items: catalog, loading, error, refresh } = useDripCatalog();
  const { onScroll, trackFeature } = useSurfaceUsage('drip');
  const [filter, setFilter] = useState<DripFilter>('all');
  const [selected, setSelected] = useState<DripItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const items = useMemo(
    () => (filter === 'all' ? catalog : catalog.filter((item) => item.category === filter)),
    [catalog, filter],
  );

  const categoryPills = useMemo(
    () =>
      DRIP_FILTERS.map((item) => ({
        id: item.id,
        label:
          item.id === 'all'
            ? live.copy.dripAllLabel
            : item.id === 'apparel'
              ? live.copy.dripApparelLabel
              : item.id === 'aura_cards'
                ? live.copy.dripAuraCardsLabel
                : live.copy.dripMerchLabel,
      })),
    [live.copy.dripAllLabel, live.copy.dripApparelLabel, live.copy.dripAuraCardsLabel, live.copy.dripMerchLabel],
  );
  const filteredEmpty = catalog.length > 0 && filter !== 'all';
  const categoryLabel = categoryPills.find((item) => item.id === filter)?.label ?? '';

  if (!live.tabs.drip) {
    return <RuntimePaused title="Drip is paused" lede="Turn Drip back on in Admin → Features, then Publish to app." />;
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
            tintColor={TAB_ACCENTS.drip.color}
            colors={[TAB_ACCENTS.drip.color]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <ScrollFxParallax fadeOver={120}>
          <ScreenHeading
            kicker={live.copy.dripKicker}
            title="Drip"
            lede={live.copy.dripLede}
            accent={TAB_ACCENTS.drip.color}
          />
        </ScrollFxParallax>
        <FilterPills
          items={categoryPills}
          value={filter}
          onChange={(id) => {
            const next = id ?? 'all';
            trackFeature(`filter.${next}`);
            setFilter(next);
          }}
          accessibilityLabel="Drip categories"
        />
        {loading && catalog.length === 0 ? (
          <View style={styles.loading} accessibilityLiveRegion="polite">
            <ActivityIndicator color={TAB_ACCENTS.drip.color} />
            <Text style={styles.loadingLabel}>Loading the rack…</Text>
          </View>
        ) : null}
        {!loading && error ? (
          <EmptyState
            kicker="Drip"
            title="Could not load the rack"
            lede={error}
            actionLabel="Retry"
            onAction={() => void onRefresh()}
            accent={TAB_ACCENTS.drip.color}
          />
        ) : !loading && items.length === 0 ? (
          <EmptyState
            kicker="Drip"
            title={filteredEmpty ? `No items in ${categoryLabel}` : live.copy.dripEmpty}
            lede={filteredEmpty
              ? 'Choose another category above to explore the rack.'
              : 'The rack is empty right now. Check back for available Drip.'}
            adminHref="/admin/drip"
            adminLabel="Open Drip desk"
            accent={TAB_ACCENTS.drip.color}
          />
        ) : (
          items.map((item, index) => (
            <ScrollFxItem key={item.id} index={index} variant={index % 2 === 0 ? 'slide-left' : 'slide-right'}>
              <GearCard
                item={item}
                onPress={(next) => {
                  trackFeature('drip_item');
                  setSelected(next);
                }}
              />
            </ScrollFxItem>
          ))
        )}
      </ScrollFxScrollView>
      <ProductSheet item={selected} onClose={() => setSelected(null)} />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 20,
  },
  loading: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  loadingLabel: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
