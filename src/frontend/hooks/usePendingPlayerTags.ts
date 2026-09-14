import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { confirmReelPlayerTag, fetchPendingPlayerTags } from '@/lib/tags';
import type { PendingPlayerTag } from '@/types/database';

/**
 * @purpose Pending That's me / That's our player queue for Athlete HQ, Parent, Operator, and Spotlight admin.
 * @returns Pending clips plus confirm / reject actions.
 * @sideEffects `get_pending_player_tags` on focus; `confirm_reel_player_tag` on action.
 */
export function usePendingPlayerTags() {
  const [tags, setTags] = useState<PendingPlayerTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTags(await fetchPendingPlayerTags());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load pending tags.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const resolve = useCallback(async (reelId: string, action: 'confirm' | 'reject') => {
    setBusyId(reelId);
    setError(null);
    try {
      await confirmReelPlayerTag(reelId, action);
      setTags((current) => current.filter((row) => row.id !== reelId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update that tag.');
      throw caught;
    } finally {
      setBusyId(null);
    }
  }, []);

  return { tags, loading, error, busyId, refresh, resolve };
}
