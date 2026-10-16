/**
 * Fan bookmarks on Highlights (`saved_reels`), shared by the bookmark hook and the offline queue so both write the
 * table the same way (PORT-01: app code reaches the backend through lib/). Callers decide when a reel id is a real
 * uuid and when to queue offline; these helpers only talk to the database and hand back its error.
 * @sideEffects `saved_reels` SELECT, INSERT and DELETE.
 */
import { supabase } from '@/lib/supabase';

/**
 * @purpose Ask the database whether this fan has bookmarked this reel.
 * @param userId Signed-in `auth.uid()`.
 * @param reelId `reels.id` (uuid).
 * @returns `saved` true when a row exists; `error` set when the read failed (then `saved` means nothing).
 */
export async function fetchReelSaved(userId: string, reelId: string) {
  const { data, error } = await supabase
    .from('saved_reels')
    .select('reel_id')
    .eq('user_id', userId)
    .eq('reel_id', reelId)
    .maybeSingle();
  return { saved: Boolean(data), error };
}

/**
 * @purpose Bookmark a reel for this fan.
 * @param userId Signed-in `auth.uid()`.
 * @param reelId `reels.id` (uuid).
 * @returns `error` null on success. A duplicate row also counts as success: the reel is saved either way, and a
 *   replayed offline tap or a double tap must not read as a failure.
 */
export async function saveReelBookmark(userId: string, reelId: string) {
  const { error } = await supabase.from('saved_reels').insert({ user_id: userId, reel_id: reelId });
  if (error && /duplicate|unique/i.test(error.message)) return { error: null };
  return { error };
}

/**
 * @purpose Remove this fan's bookmark on a reel.
 * @param userId Signed-in `auth.uid()`.
 * @param reelId `reels.id` (uuid).
 * @returns `error` null on success (including when there was nothing to remove).
 */
export async function removeReelBookmark(userId: string, reelId: string) {
  const { error } = await supabase.from('saved_reels').delete().eq('user_id', userId).eq('reel_id', reelId);
  return { error };
}
