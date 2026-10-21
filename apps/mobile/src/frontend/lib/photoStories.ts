/**
 * Photo stories data layer (PHOTO_STORIES_DESIGN.md): publish a story of 1–10 photos, read a story's
 * photos for the feed, and probe whether the photo-story SQL exists yet. Screens call this, not Supabase.
 * Rule: a story is never half-published. The `reels` row is inserted exactly like a video's
 * (`insertReelRow`), but stays at `photo_count = 0` — hidden by the feed — until every photo has
 * uploaded and `set_reel_photos` has validated and stored the ordered list. That RPC is publish-once
 * (it only succeeds while `photo_count = 0`), and `PhotoStoryPublishError` carries a failed row id. Before retry, owner cleanup removes its
 * files and hidden row, then a fresh insert publishes the preserved local draft.
 * Security rule (QA, 2026-10-07): the database stores Storage PATHS (`{uid}/stories/{reel_id}/…jpg`),
 * never URLs; `storyPhotoPublicUrl` turns a path into a displayable URL on the client.
 * @sideEffects `reels` INSERT, owner cleanup RPCs/Storage removal and local cleanup intent, Storage `reels/{uid}/stories/…`, RPC `set_reel_photos`, view `reel_photos_feed`.
 */

import {
  PHOTO_DESCRIPTION_MAX,
  PHOTO_STORY_MAX_PHOTOS,
  parseReelCategory,
  type ReelCategory,
  type StoryPhoto,
} from '@/data/highlights';
import { publicMediaUrl } from '@/lib/media';
import { cleanupFailedPhotoStory } from '@/lib/photoStoryCleanup';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { insertReelRow, uploadStoryPhoto } from '@/services/MediaUploadService';
import type { Reel } from '@/types/database';
import { isMissingFunction, isMissingRelation } from '@/lib/dbErrors';

/**
 * A publish attempt failed after the story's reel row existed. `reelId` lets the caller retire the earlier
 * row before creating a clean retry. A failed response may also need a committed-story check.
 */
export class PhotoStoryPublishError extends Error {
  readonly reelId: string;
  constructor(message: string, reelId: string) {
    super(message);
    this.name = 'PhotoStoryPublishError';
    this.reelId = reelId;
  }
}

/** A previous publish committed; its stored story is recovered separately from the edited local draft. */
export class PhotoStoryAlreadyPublishedError extends Error {
  readonly reel: Reel;
  constructor(reel: Reel) {
    super('Your earlier photo story was already shared. Your current draft has not been published.');
    this.name = 'PhotoStoryAlreadyPublishedError';
    this.reel = reel;
  }
}

/** Public bucket that holds story photos (STATE §5: public; v1 stories are public only). */
const STORY_BUCKET = 'reels';

/** One picked photo in the upload draft, in story order. */
export type PhotoStoryDraftPhoto = { uri: string; width?: number; height?: number; description?: string };

type PostgrestErrorLike = { code?: string; message?: string } | null | undefined;
type LooseResult = PromiseLike<{ data: unknown; error: PostgrestErrorLike }>;

/**
 * `reel_photos_feed`, `reels.media_type` and `set_reel_photos` arrive with migration
 * `20261007230000_photo_stories.sql` and may not be listed in the generated `Database` type yet,
 * so only these calls go through a narrow untyped view of the same client.
 */
type PhotoStoryClient = {
  from: (relation: 'reel_photos_feed' | 'reel_photos' | 'reels') => {
    select: (columns: string, options?: { head?: boolean; count?: 'exact' }) => {
      in: (column: string, values: string[]) => { order: (column: string, options: { ascending: boolean }) => LooseResult };
      limit: (count: number) => LooseResult;
      eq: (column: string, value: unknown) => { eq: (column: string, value: unknown) => { maybeSingle: () => LooseResult } };
    };
  };
  rpc: (fn: 'set_reel_photos', args: { p_reel_id: string; p_photos: unknown[] }) => LooseResult;
};
const db = supabase as unknown as PhotoStoryClient;

/** Null errors stay false. The same code-plus-message string is what every probe matches. */
function errorMatches(error: PostgrestErrorLike, pattern: RegExp): boolean {
  if (!error) return false;
  return pattern.test(`${error.code ?? ''} ${error.message ?? ''}`);
}


/** The request never reached PostgREST (offline, DNS, timeout): worth re-checking on the next open. */
function transportFailure(error: PostgrestErrorLike): boolean {
  return errorMatches(
    error,
    /network request failed|failed to fetch|fetch failed|load failed|timed? ?out|aborted|ECONN|ENOTFOUND|EAI_AGAIN/i,
  );
}

function errorText(caught: unknown): string {
  return caught instanceof Error && caught.message.trim() ? caught.message : 'Unknown error';
}

function cleanDescription(value: string | null | undefined): string | null {
  const text = (value ?? '').trim().slice(0, PHOTO_DESCRIPTION_MAX);
  return text || null;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

/**
 * @purpose Turn a stored story-photo Storage path into a public URL for display (feed pager, grid posters).
 * @param path `reel_photos.image_path` / `reels_feed.cover_path`. The feed view returns '' when the viewer may
 *   not see the photo.
 * @returns HTTPS URL, or null for a blank/hidden path.
 */
export function storyPhotoPublicUrl(path: string | null | undefined): string | null {
  const clean = typeof path === 'string' ? path.trim() : '';
  if (!clean) return null;
  return publicMediaUrl(STORY_BUCKET, clean);
}

/**
 * @purpose Pure reorder for the upload strip's Move earlier / Move later buttons.
 * @param list Current order.
 * @param from Index to move.
 * @param to Destination index (clamped into the list).
 * @returns A new array; the input is untouched. Out-of-range `from` returns a copy unchanged.
 */
export function movePhoto<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) return next;
  const target = Math.max(0, Math.min(next.length - 1, to));
  if (target === from) return next;
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/**
 * @purpose Load the photos for a set of stories, for the feed pager and grid posters.
 * @param reelIds Story `reels.id`s (duplicates and blanks ignored).
 * @returns Map reel id → photos ordered by `position`, with `imageUrl` built from the stored path. `{}` when the
 *   view is not deployed yet, so the feed treats stories as empty rather than erroring. Rows whose path the view
 *   hides ('' / null) are skipped.
 * @throws On other read failures, so the caller can show a retry state.
 * @sideEffects Reads view `reel_photos_feed`.
 */
export async function fetchStoryPhotos(reelIds: string[]): Promise<Record<string, StoryPhoto[]>> {
  const ids = [...new Set(reelIds.filter((id) => typeof id === 'string' && id.trim()))];
  if (ids.length === 0 || !isSupabaseConfigured) return {};
  const { data, error } = await db
    .from('reel_photos_feed')
    .select('id, reel_id, position, description, width, height, image_path')
    .in('reel_id', ids)
    .order('position', { ascending: true });
  if (error) {
    if (isMissingRelation(error)) return {};
    throw new Error('Photos could not load. Check your connection and try again.');
  }
  const byReel: Record<string, StoryPhoto[]> = {};
  for (const raw of (data as Record<string, unknown>[] | null) ?? []) {
    const reelId = typeof raw.reel_id === 'string' ? raw.reel_id : '';
    const imageUrl = storyPhotoPublicUrl(typeof raw.image_path === 'string' ? raw.image_path : null);
    const id = typeof raw.id === 'string' ? raw.id : '';
    if (!reelId || !imageUrl || !id) continue;
    (byReel[reelId] ??= []).push({
      id,
      position: typeof raw.position === 'number' ? raw.position : Number(raw.position) || 0,
      imageUrl,
      description: typeof raw.description === 'string' && raw.description.trim() ? raw.description : null,
      width: finiteOrNull(raw.width),
      height: finiteOrNull(raw.height),
    });
  }
  for (const photos of Object.values(byReel)) photos.sort((a, b) => a.position - b.position);
  return byReel;
}

/**
 * @purpose Store a story's ordered photo list (publish-once: succeeds only while `photo_count = 0`). The database
 *   checks ownership, 1–10 items, each `image_path` against `^<auth.uid>/stories/<reel_id>/N-TIMESTAMP.jpg$` and
 *   description length, then sets `reels.photo_count`.
 * @param reelId The caller's own `photo_story` reel.
 * @param photos Uploaded photos in story order (Storage paths from `uploadStoryPhoto`).
 * @returns Stored photo count.
 * @throws When the RPC is missing or rejects the list.
 * @sideEffects RPC `set_reel_photos`.
 */
export async function setStoryPhotos(
  reelId: string,
  photos: { imagePath: string; description: string | null; width?: number | null; height?: number | null }[],
): Promise<number> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured. Add EXPO_PUBLIC keys to .env.local.');
  const { data, error } = await db.rpc('set_reel_photos', {
    p_reel_id: reelId,
    p_photos: photos.map((photo) => ({
      image_path: photo.imagePath,
      description: cleanDescription(photo.description),
      width: finiteOrNull(photo.width),
      height: finiteOrNull(photo.height),
    })),
  });
  if (error) {
    // 55000 = already published. If an earlier attempt committed but its reply was lost, the story is
    // live: confirm from the row and treat it as success instead of trapping the user in retries.
    if (error.code === '55000') {
      const published = await confirmedPublishedStory(reelId);
      if (published) throw new PhotoStoryAlreadyPublishedError(published);
    }
    throw new Error(isMissingFunction(error) ? 'Photo stories are not available yet.' : error.message || 'Could not save the photos.');
  }
  const count = typeof data === 'number' ? data : Number(data);
  if (!Number.isInteger(count) || count < 1 || count > PHOTO_STORY_MAX_PHOTOS) {
    throw new Error('Could not confirm the photos were saved.');
  }
  return count;
}

/** Read only the owner-visible committed story and its stored position-zero path after a lost reply. */
async function confirmedPublishedStory(reelId: string): Promise<Reel | null> {
  const { data, error } = await supabase.from('reels').select('*').eq('id', reelId).maybeSingle();
  const row = data as Reel & { media_type?: string; photo_count?: number; is_removed?: boolean } | null;
  const count = Number(row?.photo_count ?? 0);
  if (error || !row || row.media_type !== 'photo_story' || row.is_removed || !Number.isInteger(count) || count < 1 || count > PHOTO_STORY_MAX_PHOTOS) return null;
  const cover = await db.from('reel_photos').select('image_path').eq('reel_id', reelId).eq('position', 0).maybeSingle();
  const path = (cover.data as { image_path?: unknown } | null)?.image_path;
  if (cover.error || typeof path !== 'string' || !path.trim()) return null;
  return { ...row, cover_path: path } as Reel;
}

let availability: Promise<boolean> | null = null;

/** Nil reel id: the probe call can only fail validation, so it never writes anything. */
const PROBE_REEL_ID = '00000000-0000-0000-0000-000000000000';

async function probePhotoStories(): Promise<{ available: boolean; definitive: boolean }> {
  if (!isSupabaseConfigured) return { available: false, definitive: true };
  try {
    const column = await db.from('reels').select('media_type', { head: true, count: 'exact' }).limit(1);
    // A HEAD request has no body, so a missing column often arrives with an empty message. Anything except a
    // transport failure therefore counts as "not deployed" for the session (QA, 2026-10-07).
    if (column.error) return { available: false, definitive: !transportFailure(column.error) };
    const rpc = await db.rpc('set_reel_photos', { p_reel_id: PROBE_REEL_ID, p_photos: [] });
    if (rpc.error) {
      if (transportFailure(rpc.error)) return { available: false, definitive: false };
      if (isMissingFunction(rpc.error)) return { available: false, definitive: true };
      // An error with no code and no message cannot prove the function exists.
      if (!rpc.error.code && !rpc.error.message?.trim()) return { available: false, definitive: true };
    }
    // Any other answer (ownership / item-count rejection, permission) proves the function exists.
    return { available: true, definitive: true };
  } catch {
    return { available: false, definitive: false };
  }
}

/**
 * @purpose Whether the upload sheet may offer Photos: `reels.media_type` and `set_reel_photos` both exist.
 * @returns False before the photo-story SQL is applied (same graceful pattern as Rally / account tags).
 *   The answer is cached for the session, including "unavailable" from an empty or unknown error; only a
 *   network/transport failure is left uncached, so the next open re-checks.
 * @sideEffects One `reels` head read and one validation-only `set_reel_photos` call per session.
 */
export function photoStoriesAvailable(): Promise<boolean> {
  if (!availability) {
    availability = probePhotoStories().then(({ available, definitive }) => {
      if (!definitive) availability = null;
      return available;
    });
  }
  return availability;
}

/** Test hook: forget the cached probe result. */
export function resetPhotoStoriesProbe(): void {
  availability = null;
}

/**
 * @purpose Publish a photo story: insert the reel row like a video (`media_type = 'photo_story'`,
 *   `video_url = ''`), upload each photo (metadata stripped, orientation kept), then store the ordered paths with
 *   `set_reel_photos`. With `existingReelId` (a retry), retire the earlier hidden row and its files first, then create a fresh
 *   row from the preserved draft. A committed earlier story is recovered without replacing it.
 * @param input Photos in story order, caption, tagged athlete, optional game, category, the rights version the
 *   uploader confirmed, and `existingReelId` from a previous `PhotoStoryPublishError`. The earlier id is passed even if the athlete or game changed, so abandoned uploads are retired.
 *   `onProgress(done, total)` fires before and after each photo.
 * @returns The reel with `photo_count` and `cover_path` filled in.
 * @throws `PhotoStoryPublishError` (carrying `reelId`) when cleanup, a photo or the RPC fails — the caller
 *   keeps the draft/id for a retry; an uncertain save reply can follow a successful commit. A plain `Error` when the insert
 *   itself fails (a lost insert reply can leave an unknown hidden row) or input is invalid.
 * @sideEffects `reels` INSERT; owner cleanup and local intent on retry; Storage uploads; RPC `set_reel_photos`.
 */
export async function createPhotoStory(input: {
  photos: PhotoStoryDraftPhoto[];
  title: string;
  playerId: string;
  gameId?: string | null;
  category: ReelCategory;
  rightsVersion: string;
  existingReelId?: string | null;
  expectedUserId?: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<Reel> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured. Add EXPO_PUBLIC keys to .env.local.');
  const photos = input.photos.filter((photo) => photo.uri);
  const caption = input.title.trim();
  if (photos.length === 0) throw new Error('Choose at least one photo.');
  if (photos.length > PHOTO_STORY_MAX_PHOTOS) throw new Error(`A story holds up to ${PHOTO_STORY_MAX_PHOTOS} photos.`);
  if (!caption) throw new Error('Add a caption.');
  if (!input.playerId) throw new Error('Tag the athlete before sharing.');
  const category = parseReelCategory(input.category);

  const existingId = input.existingReelId?.trim();
  if (existingId) {
    let status: 'discarded' | 'published';
    try {
      status = input.expectedUserId ? await cleanupFailedPhotoStory(existingId, input.expectedUserId) : await cleanupFailedPhotoStory(existingId);
    } catch (caught) {
      throw new PhotoStoryPublishError(errorText(caught), existingId);
    }
    if (status === 'published') {
      const stored = await confirmedPublishedStory(existingId);
      if (stored) throw new PhotoStoryAlreadyPublishedError(stored);
      throw new PhotoStoryPublishError('The earlier story may already be shared. Check your connection and try again; it was not removed.', existingId);
    }
  }
  if (input.expectedUserId) {
    const current = await supabase.auth.getUser();
    if (current.error || current.data.user?.id !== input.expectedUserId) {
      throw new Error('The account changed. Open your upload again before sharing.');
    }
  }
  // Every retry retires its old row and all attempt files first. Timestamped leftovers cannot
  // survive on a successfully published replacement; the local draft and rights remain intact.
  const reel = await insertReelRow({
    video_url: '', title: caption, player_id: input.playerId, game_id: input.gameId || null,
    is_exclusive: false, is_vault_only: false, category, attested_at: new Date().toISOString(),
    rights_version: input.rightsVersion, media_type: 'photo_story',
  });

  const total = photos.length;
  input.onProgress?.(0, total);
  const uploaded: { imagePath: string; description: string | null; width: number | null; height: number | null }[] = [];
  for (let index = 0; index < total; index += 1) {
    const photo = photos[index];
    try {
      const result = await uploadStoryPhoto(photo.uri, reel.id, index);
      uploaded.push({
        imagePath: result.imagePath,
        description: cleanDescription(photo.description),
        width: finiteOrNull(result.width) ?? finiteOrNull(photo.width),
        height: finiteOrNull(result.height) ?? finiteOrNull(photo.height),
      });
    } catch (caught) {
      throw new PhotoStoryPublishError(`Photo ${index + 1} of ${total} did not upload, so nothing was published. Try again. (${errorText(caught)})`, reel.id);
    }
    input.onProgress?.(index + 1, total);
  }

  let count: number;
  try {
    count = await setStoryPhotos(reel.id, uploaded);
  } catch (caught) {
    if (caught instanceof PhotoStoryAlreadyPublishedError) throw caught;
    throw new PhotoStoryPublishError(`We could not confirm whether your story was shared. Try again and we’ll check before replacing it. (${errorText(caught)})`, reel.id);
  }
  return { ...reel, media_type: 'photo_story', photo_count: count, cover_path: uploaded[0]?.imagePath ?? null } as Reel;
}
