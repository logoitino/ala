/**
 * Bookmark state for one Highlight: local-first for guests and seeded clips, synced to `saved_reels` through
 * `lib/savedReels` for signed-in fans, with the offline queue catching dropped connections.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { isReelUuid } from '@/lib/reels';
import { fetchReelSaved, removeReelBookmark, saveReelBookmark } from '@/lib/savedReels';
import { isSupabaseConfigured } from '@/lib/supabase';
import { createOfflineActorClient, isOfflineActorChanged } from '@/lib/offlineActor';
import { offlineQueue, shouldQueueOffline } from '@/services/OfflineQueue';

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
  const viewKey = storageKey(reelId ?? '', user?.id);
  const view = useRef({ key: viewKey, generation: 0 });
  if (view.current.key !== viewKey) view.current = { key: viewKey, generation: view.current.generation + 1 };
  const generation = view.current.generation;
  const revision = useRef(0);

  const refresh = useCallback(async () => {
    const readRevision = ++revision.current;
    const isCurrent = () => view.current.generation === generation && revision.current === readRevision;
    if (!reelId) {
      setSaved(false);
      return;
    }

    try {
      if (user?.id && isSupabaseConfigured && isReelUuid(reelId)) {
        const { saved: onServer, error } = await fetchReelSaved(user.id, reelId);
        if (!isCurrent()) return;

        if (!error) {
          setSaved(onServer);
          await AsyncStorage.setItem(storageKey(reelId, user.id), onServer ? '1' : '0');
          return;
        }
      }

      const local = await AsyncStorage.getItem(storageKey(reelId, user?.id));
      if (!isCurrent()) return;
      setSaved(local === '1');
    } catch {
      if (isCurrent()) setSaved(false);
    }
  }, [generation, reelId, user?.id]);

  useEffect(() => {
    setSaved(false);
    setToggling(false);
    void refresh();
  }, [refresh]);

  /**
   * @purpose Optimistic bookmark toggle, then insert/delete `saved_reels` in the background.
   * @sideEffects Local `saved` flip; AsyncStorage write; Supabase insert or delete when signed in with a uuid reel.
   */
  const toggle = useCallback(async () => {
    if (!reelId || toggling || view.current.generation !== generation) return;
    ++revision.current;
    const actor = offlineQueue.captureActor(user?.id ?? null);
    const next = !saved;
    setSaved(next);
    setToggling(true);
    try {
      await AsyncStorage.setItem(storageKey(reelId, user?.id), next ? '1' : '0');
      if (actor && user?.id && isSupabaseConfigured && isReelUuid(reelId)) {
        const payload = {
          type: 'bookmark' as const,
          reelId,
          userId: user.id,
          saved: next,
        };
        if (!(await offlineQueue.isOnline())) {
          await offlineQueue.enqueue(payload, actor);
          return;
        }
        const client = await createOfflineActorClient(actor);
        if (next) {
          const { error } = await saveReelBookmark(user.id, reelId, client);
          if (!actor.isCurrent() || view.current.generation !== generation) return;
          if (error) {
            if (shouldQueueOffline(error, offlineQueue.getIsConnected())) {
              await offlineQueue.enqueue(payload, actor);
              return;
            }
            setSaved(false);
            await AsyncStorage.setItem(storageKey(reelId, user.id), '0');
          }
        } else {
          const { error } = await removeReelBookmark(user.id, reelId, client);
          if (!actor.isCurrent() || view.current.generation !== generation) return;
          if (error) {
            if (shouldQueueOffline(error, offlineQueue.getIsConnected())) {
              await offlineQueue.enqueue(payload, actor);
              return;
            }
            setSaved(true);
            await AsyncStorage.setItem(storageKey(reelId, user.id), '1');
          }
        }
      }
    } catch (error) {
      if (!isOfflineActorChanged(error)) throw error;
    } finally {
      if (view.current.generation === generation) setToggling(false);
    }
  }, [generation, reelId, saved, toggling, user?.id]);

  return { saved, toggling, toggle };
}
