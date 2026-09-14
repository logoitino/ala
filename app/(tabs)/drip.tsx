import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { GearCard } from '@/components/Drip/GearCard';
import { ProductSheet } from '@/components/Drip/ProductSheet';
import { RuntimePaused } from '@/components/RuntimePaused';
import { ScreenHeading } from '@/components/ScreenHeading';
import { TabScreen } from '@/components/TabScreen';
import { FilterPills } from '@/components/UI/FilterPills';
import { colors } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { DRIP_FILTERS, type DripFilter, type DripItem } from '@/data/shop';
import { useDripCatalog } from '@/hooks/useDripCatalog';
import { useSurfaceUsage } from '@/hooks/useSurfaceUsage';

/**
 * @purpose Drip marketplace: category pills, GearCard 0.96 press, ProductSheet checkout.
 * @sideEffects `shop_products` via `useDripCatalog`; ProductSheet `useTipCheckout` PaymentSheet + `add_user_aura`.
 */
export default function DripTab() {
  const { live } = useAppRuntime();
  const { items: catalog } = useDripCatalog();
  const { onScroll, trackFeature } = useSurfaceUsage('drip');
  const [filter, setFilter] = useState<DripFilter>('all');
  const [selected, setSelected] = useState<DripItem | null>(null);

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

  if (!live.tabs.drip) {
    return <RuntimePaused title="Drip is paused" lede="Turn Drip back on in Admin → Features, then Publish to app." />;
  }

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.content} onScroll={onScroll} scrollEventThrottle={400}>
        <ScreenHeading compact kicker={live.copy.dripKicker} title="Drip" lede={live.copy.dripLede} />
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
        {items.length === 0 ? (
          <Text style={styles.empty}>{live.copy.dripEmpty}</Text>
        ) : (
          items.map((item) => (
            <GearCard
              key={item.id}
              item={item}
              onPress={(next) => {
                trackFeature('drip_item');
                setSelected(next);
              }}
            />
          ))
        )}
      </ScrollView>
      <ProductSheet item={selected} onClose={() => setSelected(null)} />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 28,
    gap: 12,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
