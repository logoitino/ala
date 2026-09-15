import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { SPORT_CONFIG_SEEDS, sportConfigFor, type SportConfig } from '@/data/sports';
import { fetchSportConfigs } from '@/lib/sports';

/**
 * @purpose Share the sport playbooks (`sport_configs`) with the operator console, Stats 📊, onboarding, and `/admin/sports`.
 * @returns `{ configs, loading, refresh, configFor }` — `configFor` never returns null, unknown sports inherit the generic console.
 * @sideEffects `get_sport_configs` RPC on focus; seeded catalog when the table is missing.
 */
export function useSportConfigs() {
  const [configs, setConfigs] = useState<SportConfig[]>(SPORT_CONFIG_SEEDS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setConfigs(await fetchSportConfigs());
    } catch {
      setConfigs(SPORT_CONFIG_SEEDS);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const configFor = useCallback(
    (sport: string | null | undefined): SportConfig => sportConfigFor(sport, configs),
    [configs],
  );

  return { configs, loading, refresh, configFor };
}
