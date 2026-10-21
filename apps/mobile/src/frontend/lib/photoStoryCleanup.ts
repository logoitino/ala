/**
 * Retire an unfinished owner photo story through the Storage API before deleting its hidden row.
 * The server claim prevents late uploads/publication; per-owner local intent survives app restarts.
 * Only owner/story IDs are stored, until the server confirms deletion or publication.
 * @sideEffects Owner cleanup RPCs, Storage reels list/remove, authenticated user verification, AsyncStorage cleanup intent keys.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isMissingFunction } from '@/lib/dbErrors';
import { mediaStorage, type MediaStorageAdapter } from '@/lib/mediaStorage';
import { untypedRpc } from '@/lib/rpc';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHOTO_NAME = /^[0-9]{1,2}-[0-9]{10,16}[.]jpg$/;
const BATCH_SIZE = 100;
const MAX_BATCHES = 25;
const QUEUE_PREFIX = '@tapuai/photo-cleanup/';

function cleanupKey(reelId: string, ownerId: string): string {
  if (!UUID.test(ownerId)) throw new Error('Choose a valid signed-in account.');
  if (!UUID.test(reelId)) throw new Error('Choose a valid unfinished story.');
  return `${QUEUE_PREFIX}${ownerId.toLowerCase()}/${reelId.toLowerCase()}`;
}

// Serialize only local key writes, never network work: offline cleanup cannot block dismissal.
const keyWrites = new Map<string, Promise<unknown>>();
const revisions = new Map<string, number>();
let nextRevision = 0;
async function writeKey<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = keyWrites.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  keyWrites.set(key, next);
  try { return await next; }
  finally { if (keyWrites.get(key) === next) keyWrites.delete(key); }
}
async function saveIntent(key: string): Promise<number> {
  return writeKey(key, async () => {
    await AsyncStorage.setItem(key, '1');
    const revision = ++nextRevision;
    revisions.set(key, revision);
    return revision;
  });
}
async function finishIntent(key: string, revision: number): Promise<void> {
  await writeKey(key, async () => {
    // A later Close/retry may have renewed intent while the older network request was running.
    if (revisions.get(key) !== revision) return;
    await AsyncStorage.removeItem(key);
    revisions.delete(key);
  });
}

/** Store removal intent before dismissal; independent keys prevent overlapping stories losing intent. */
export async function rememberPhotoStoryCleanup(reelId: string, ownerId: string): Promise<void> {
  await saveIntent(cleanupKey(reelId, ownerId));
}

/** Load a bounded batch for this owner; malformed keys and other accounts are never resumed. */
export async function queuedPhotoStoryCleanups(ownerId: string): Promise<string[]> {
  if (!UUID.test(ownerId)) return [];
  const prefix = `${QUEUE_PREFIX}${ownerId.toLowerCase()}/`;
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((key) => key.startsWith(prefix) && UUID.test(key.slice(prefix.length)))
    .slice(0, MAX_BATCHES).map((key) => key.slice(prefix.length).toLowerCase());
}

type CleanupReply = { status?: unknown; prefix?: unknown };

async function cleanupRpc(fn: string, reelId: string): Promise<CleanupReply> {
  const { data, error } = await untypedRpc<CleanupReply>(fn, { p_reel_id: reelId });
  if (error) throw new Error(isMissingFunction(error)
    ? 'Removing unfinished photo stories needs the latest app database update. Removal will retry when you reopen Upload.'
    : error.message || 'The unfinished story could not be removed. Try again.');
  if (!data || typeof data !== 'object') throw new Error('Could not confirm the unfinished story was removed. Try again.');
  return data;
}

async function accountId(expected?: string): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (error || !id) throw new Error('Sign in to remove your unfinished story.');
  if (expected && id !== expected) throw new Error('The account changed. Open your upload again before removing it.');
  return id;
}

/**
 * @purpose Remove every retry leftover from a claimed, unpublished story; preserve published stories.
 * @param reelId Failed story id, never an arbitrary Storage path.
 * @param expectedUserId Optional originating account; changing accounts stops further requests.
 * @param storage Transport for claimed file listing/removal only; account checks and cleanup RPCs stay unchanged.
 * @returns discarded only after the server confirms the hidden row is gone; published means no deletion.
 * @throws On missing SQL, account/ownership errors, invalid paths or incomplete deletion. Keep the id to retry.
 */
export async function cleanupFailedPhotoStory(reelId: string, expectedUserId?: string, storage: MediaStorageAdapter = mediaStorage): Promise<'discarded' | 'published'> {
  const id = reelId.trim().toLowerCase();
  if (!UUID.test(id)) throw new Error('Choose a valid unfinished story.');
  if (!isSupabaseConfigured) throw new Error('Photo-story cleanup is unavailable.');
  // Save known-owner intent even when authentication is temporarily offline.
  const knownRevision = expectedUserId ? await saveIntent(cleanupKey(id, expectedUserId)) : undefined;
  const userId = await accountId(expectedUserId);
  const key = cleanupKey(id, userId);
  const revision = knownRevision ?? await saveIntent(key);
  const begin = await cleanupRpc('begin_failed_photo_story_cleanup', id);
  await accountId(userId);
  if (begin.status === 'discarded' || begin.status === 'published') {
    await finishIntent(key, revision);
    return begin.status;
  }
  const prefix = `${userId}/stories/${id}/`;
  if (begin.status !== 'pending' || begin.prefix !== prefix) {
    throw new Error('Could not confirm which unfinished photos belong to this story.');
  }
  // Drain offset zero: removing a page shifts every later file towards the start of the listing.
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    await accountId(userId);
    const { data: files, error } = await storage.list('reels', prefix.slice(0, -1), {
      limit: BATCH_SIZE, offset: 0, sortBy: { column: 'name', order: 'asc' },
    });
    if (error || !Array.isArray(files)) throw new Error('The unfinished photos could not load. Try removing the story again.');
    if (files.some((file) => !file.id || !PHOTO_NAME.test(file.name))) {
      throw new Error('Could not confirm an unfinished photo path. The story was kept for another cleanup attempt.');
    }
    if (files.length) {
      await accountId(userId);
      const removed = await storage.remove('reels', files.map((file) => prefix + file.name));
      if (removed.error) throw new Error('Some unfinished photos could not be removed. Try again; removal remains queued.');
    }
    if (files.length < BATCH_SIZE) {
      await accountId(userId);
      const finish = await cleanupRpc('finish_failed_photo_story_cleanup', id);
      if (finish.status !== 'discarded') throw new Error('Could not confirm the unfinished story was removed. Try again.');
      await accountId(userId);
      await finishIntent(key, revision);
      return 'discarded';
    }
  }
  throw new Error('More unfinished photos need removing. Try again to continue cleanup; removal remains queued.');
}
