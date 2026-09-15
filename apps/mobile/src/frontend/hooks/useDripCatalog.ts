import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { DRIP_ITEMS, type DripItem } from '@/data/shop';
import { fetchLiveDripItems } from '@/lib/adminCatalog';

/**
 * @purpose Production Drip rack from `shop_products`, with seeded `DRIP_ITEMS` when the table is missing.
 * @returns `{ items, loading, refresh }`.
 * @sideEffects `shop_products` SELECT on focus.
 */
export function useDripCatalog() {
  const [items, setItems] = useState<DripItem[]>(DRIP_ITEMS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchLiveDripItems());
    } catch {
      setItems(DRIP_ITEMS);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { items, loading, refresh };
}
