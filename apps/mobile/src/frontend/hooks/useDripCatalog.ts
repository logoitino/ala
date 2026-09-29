import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { DRIP_ITEMS, type DripItem } from '@/data/shop';
import { fetchLiveDripItems } from '@/lib/adminCatalog';

/**
 * @purpose Production Drip rack from `shop_products`, with seeded `DRIP_ITEMS` when the table is missing.
 * @returns `{ items, loading, error, refresh }`; a real empty catalog stays empty.
 * @sideEffects `shop_products` SELECT on focus.
 */
export function useDripCatalog() {
  const [items, setItems] = useState<DripItem[]>(DRIP_ITEMS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchLiveDripItems());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not load the Drip rack. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { items, loading, error, refresh };
}
