import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { GearCard } from '@/components/Drip/GearCard';
import { ProductSheet } from '@/components/Drip/ProductSheet';
import { ScrollFxItem, ScrollFxParallax, ScrollFxScrollView } from '@/components/Effects/ScrollFx';
import { RuntimePaused } from '@/components/RuntimePaused';
import { ScreenHeading } from '@/components/ScreenHeading';
import { TabScreen } from '@/components/TabScreen';
import { EmptyState } from '@/components/UI/EmptyState';
import { FilterPills } from '@/components/UI/FilterPills';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { DRIP_FILTERS, type DripFilter, type DripItem } from '@/data/shop';
import { useDripCatalog } from '@/hooks/useDripCatalog';
import { useSurfaceUsage } from '@/hooks/useSurfaceUsage';
import { FOCAL, TAB_ACCENTS } from '@/theme/motion';

/**
 * @purpose Drip marketplace: category pills, GearCard 0.96 press, ProductSheet checkout. Cards zig-zag in from
 * alternating sides as the rack scrolls (`ScrollFxItem`), heading drifts with parallax.
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
      <ScrollFxScrollView contentContainerStyle={styles.content} onScroll={onScroll}>
        <ScrollFxParallax fadeOver={120}>
          <ScreenHeading
            compact
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
          accent={FOCAL.emberInk}
          mist={FOCAL.mistEmber}
        />
        {items.length === 0 ? (
          <EmptyState
            kicker="Drip"
            title={live.copy.dripEmpty}
            lede="Add SKUs on the Drip desk, then they land on this rack after Save."
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
    paddingTop: 4,
    paddingBottom: 28,
    gap: 12,
  },
});
