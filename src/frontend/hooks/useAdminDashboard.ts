import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useRoster } from '@/hooks/useRoster';
import {
  defaultSpotlightWindow,
  dismissTelemetryIncident,
  fetchAdminFlags,
  fetchAdminPlatformMetrics,
  fetchAdminSpotlightAwards,
  moderateFlaggedReel,
  publishSpotlightAward,
  type AdminFlagRow,
  type AdminPlatformMetrics,
  type PublishSpotlightInput,
} from '@/lib/admin';
import type { SpotlightAward } from '@/types/database';

/**
 * @purpose Web Admin Dashboard data: Spotlight awards, open flags, and platform metrics.
 * @param enabled Skip network when Access Restricted (`profiles.is_admin` / admin role is false).
 * @returns Flags, metrics, awards, and publish / dismiss / remove actions.
 * @sideEffects `publish_spotlight_award`, `moderate_flagged_reel`, `get_admin_platform_metrics`; `spotlight_awards` / flagged `reels` / `telemetry_logs` SELECTs.
 */
export function useAdminDashboard(enabled = true) {
  const { players, loading: rosterLoading } = useRoster();
  const [awards, setAwards] = useState<SpotlightAward[]>([]);
  const [flags, setFlags] = useState<AdminFlagRow[]>([]);
  const [metrics, setMetrics] = useState<AdminPlatformMetrics>({
    highlightCount: 0,
    engagementCount: 0,
    maloCents: 0,
    openFlags: 0,
    telemetryEvents24h: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextAwards, nextFlags, nextMetrics] = await Promise.all([
        fetchAdminSpotlightAwards(),
        fetchAdminFlags(),
        fetchAdminPlatformMetrics(),
      ]);
      setAwards(nextAwards);
      setFlags(nextFlags);
      setMetrics(nextMetrics);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the admin dashboard.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const publish = useCallback(
    async (input: PublishSpotlightInput) => {
      setBusyId('publish');
      try {
        const award = await publishSpotlightAward(input);
        setAwards((current) => [award, ...current.filter((row) => row.id !== award.id)]);
        await refresh();
        return award;
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const moderate = useCallback(async (row: AdminFlagRow, action: 'dismiss' | 'remove') => {
    setBusyId(row.id);
    try {
      if (row.kind === 'telemetry') {
        const logId = row.id.startsWith('tel:') ? row.id.slice(4) : row.id;
        await dismissTelemetryIncident(logId);
      } else {
        await moderateFlaggedReel(row.id, action);
      }
      setFlags((current) => current.filter((item) => item.id !== row.id));
      if (action === 'remove' || row.kind === 'highlight') {
        await refresh();
      }
    } finally {
      setBusyId(null);
    }
  }, [refresh]);

  return {
    players,
    rosterLoading,
    awards,
    flags,
    metrics,
    loading,
    error,
    busyId,
    refresh,
    publish,
    moderate,
    defaultWindow: defaultSpotlightWindow,
  };
}
