import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { isReelUuid } from '@/lib/reels';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

function storageKey(reelId: string, userId?: string | null) {
  return userId ? `tapuai.savedReel.${userId}.${reelId}` : `tapuai.savedReel.guest.${reelId}`;
}

/**
 * @purpose Bookmark a Reel. Signed-in UUID clips sync to `saved_reels`; guests and seeded ids stay on device.
 * @param reelId `reels.id` (uuid) or a seeded highlight id such as `hl-1`.
 * @returns `{ saved, toggling, toggle }` — `toggle` flips local state immediately then persists.
 * @sideEffects Supabase `saved_reels` insert/delete; AsyncStorage `tapuai.savedReel.*`; OfflineQueue when `NetInfo.isConnected === false`.
 */
export function useSavedReel(reelId: string | undefined) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [toggling, setToggling] = useState(false);

  const refresh = useCallback(async () => {
    if (!reelId) {
      setSaved(false);
      return;
    }

    try {
      if (user?.id && isSupabaseConfigured && isReelUuid(reelId)) {
        const { data, error } = await supabase
          .from('saved_reels')
          .select('reel_id')
          .eq('user_id', user.id)
          .eq('reel_id', reelId)
          .maybeSingle();

        if (!error) {
          setSaved(Boolean(data));
          await AsyncStorage.setItem(storageKey(reelId, user.id), data ? '1' : '0');
          return;
        }
      }

      const local = await AsyncStorage.getItem(storageKey(reelId, user?.id));
      setSaved(local === '1');
    } catch {
      setSaved(false);
    }
  }, [reelId, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * @purpose Optimistic bookmark toggle, then insert/delete `saved_reels` in the background.
   * @sideEffects Local `saved` flip; AsyncStorage write; Supabase insert or delete when signed in with a uuid reel.
   */
  const toggle = useCallback(async () => {
    if (!reelId || toggling) return;
    const next = !saved;
    setSaved(next);
    setToggling(true);
    await AsyncStorage.setItem(storageKey(reelId, user?.id), next ? '1' : '0');

    try {
      if (user?.id && isSupabaseConfigured && isReelUuid(reelId)) {
        const payload = {
          type: 'bookmark' as const,
          reelId,
          userId: user.id,
          saved: next,
        };
        const { offlineQueue, shouldQueueOffline } = await import('@/services/OfflineQueue');
        if (!(await offlineQueue.isOnline())) {
          await offlineQueue.enqueue(payload);
          return;
        }
        if (next) {
          const { error } = await supabase.from('saved_reels').insert({
            user_id: user.id,
            reel_id: reelId,
          });
          if (error && !/duplicate|unique/i.test(error.message)) {
            if (shouldQueueOffline(error, offlineQueue.getIsConnected())) {
              await offlineQueue.enqueue(payload);
              return;
            }
            setSaved(false);
            await AsyncStorage.setItem(storageKey(reelId, user.id), '0');
          }
        } else {
          const { error } = await supabase
            .from('saved_reels')
            .delete()
            .eq('user_id', user.id)
            .eq('reel_id', reelId);
          if (error) {
            if (shouldQueueOffline(error, offlineQueue.getIsConnected())) {
              await offlineQueue.enqueue(payload);
              return;
            }
            setSaved(true);
            await AsyncStorage.setItem(storageKey(reelId, user.id), '1');
          }
        }
      }
    } finally {
      setToggling(false);
    }
  }, [reelId, saved, toggling, user?.id]);

  return { saved, toggling, toggle };
}
