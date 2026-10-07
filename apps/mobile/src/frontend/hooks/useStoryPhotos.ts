/**
 * Photos for one Highlights photo story (PHOTO_STORIES_DESIGN.md, "Screens: Feed"). `ReelCard` calls this
 * only for photo stories and only while the card is on screen, so a mounted off-screen card never fetches.
 * Results are cached per story for the session so swiping back does not refetch; failures are not cached.
 * @sideEffects `fetchStoryPhotos` (`reel_photos_feed` read in `lib/photoStories.ts`).
 */

import { useEffect, useState } from 'react';

import { isPhotoStory, type HighlightClip, type StoryPhoto } from '@/data/highlights';
import { fetchStoryPhotos } from '@/lib/photoStories';

/** Stories kept in memory. URLs only (no image bytes), so this stays small. */
const CACHE_LIMIT = 60;
const cache = new Map<string, StoryPhoto[]>();

function remember(reelId: string, photos: StoryPhoto[]) {
  cache.delete(reelId);
  cache.set(reelId, photos);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

/** Test hook: forget cached stories between cases. */
export function resetStoryPhotoCache() {
  cache.clear();
}

export type StoryPhotosState = { photos: StoryPhoto[]; loading: boolean; error: boolean };

/**
 * @purpose Load a photo story's photos in order (`position` 0 first).
 * @param clip The feed clip. Videos and `null` never fetch.
 * @param enabled True while the card is current. Turning it off keeps what already loaded.
 * @returns `photos` (empty until loaded, or when the database has none), `loading`, and `error` when
 *   the fetch threw. Callers fall back to `clip.coverUrl` while empty.
 * @sideEffects `fetchStoryPhotos([clip.id])`. A result that lands after unmount or a clip change is dropped.
 */
export function useStoryPhotos(clip: HighlightClip | null, enabled: boolean): StoryPhotosState {
  const reelId = clip && isPhotoStory(clip) ? clip.id : null;
  const [state, setState] = useState<StoryPhotosState & { reelId: string | null }>(() => ({
    reelId,
    photos: (reelId && cache.get(reelId)) || [],
    loading: false,
    error: false,
  }));

  // A different clip in the same card: never show the previous story's photos, even for a frame.
  const current =
    state.reelId === reelId
      ? state
      : { reelId, photos: (reelId && cache.get(reelId)) || [], loading: false, error: false };
  if (current !== state) setState(current);

  const hasPhotos = current.photos.length > 0;

  useEffect(() => {
    if (!reelId || !enabled || hasPhotos) return;
    let live = true;
    setState({ reelId, photos: [], loading: true, error: false });
    fetchStoryPhotos([reelId])
      .then((byReel) => {
        if (!live) return;
        const photos = [...(byReel[reelId] ?? [])].sort((left, right) => left.position - right.position);
        if (photos.length > 0) remember(reelId, photos);
        setState({ reelId, photos, loading: false, error: false });
      })
      .catch(() => {
        if (!live) return;
        setState({ reelId, photos: [], loading: false, error: true });
      });
    return () => {
      live = false;
    };
  }, [reelId, enabled, hasPhotos]);

  return { photos: current.photos, loading: current.loading, error: current.error };
}
