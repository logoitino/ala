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

/**
 * @purpose Drip marketplace: category pills, GearCard 0.96 press, ProductSheet checkout.
 * @sideEffects `shop_products` via `useDripCatalog`; ProductSheet `useTipCheckout` PaymentSheet + `add_user_aura`.
 */
export default function DripTab() {
  const { live } = useAppRuntime();
  const { items: catalog } = useDripCatalog();
  const [filter, setFilter] = useState<DripFilter>('all');
  const [selected, setSelected] = useState<DripItem | null>(null);

  const items = useMemo(
    () => (filter === 'all' ? catalog : catalog.filter((item) => item.category === filter)),
    [catalog, filter],
  );

  if (!live.tabs.drip) {
    return <RuntimePaused title="Drip is paused" lede="Turn Drip back on in Admin → Features, then Publish to app." />;
  }

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeading compact kicker="Marketplace" title="Drip" />
        <FilterPills
          items={DRIP_FILTERS}
          value={filter}
          onChange={(id) => setFilter(id ?? 'all')}
          accessibilityLabel="Drip categories"
        />
        {items.length === 0 ? (
          <Text style={styles.empty}>Nothing in this rack yet.</Text>
        ) : (
          items.map((item) => <GearCard key={item.id} item={item} onPress={setSelected} />)
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
