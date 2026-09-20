import { Platform } from 'react-native';

import {
  HIGHLIGHT_MAX_MS,
  HIGHLIGHT_OPTIMIZING,
  HIGHLIGHT_TOO_LONG,
} from '@/data/media';
import { parseReelCategory, type ReelCategory } from '@/data/highlights';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Reel } from '@/types/database';

export const REELS_BUCKET = 'reels';
export const HIGHLIGHTS_FALLBACK_BUCKET = 'game_highlights';
export const AVATARS_BUCKET = 'avatars';

/** 1080p vertical, ~2.5 Mbps — fits a 45s Seki clip without crushing jade edges. */
const VERTICAL_1080_BITRATE = 2_500_000;
const VERTICAL_MAX_EDGE = 1080;

export type CompressProgress = (ratio: number) => void;

export type PickedHighlight = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  durationMs?: number | null;
  compressed?: boolean;
};

export type UploadHighlightInput = PickedHighlight & {
  title: string;
  playerId: string;
  /** Optional — a Highlight does not need to be linked to a specific live matchup. */
  gameId?: string | null;
  isExclusive?: boolean;
  category?: ReelCategory;
  onProgress?: CompressProgress;
  onStatus?: (message: string) => void;
};

/**
 * @purpose ImagePicker `duration` is milliseconds; some camera apps report seconds. Normalize to ms.
 * @param duration Raw `ImagePickerAsset.duration`.
 */
export function assetDurationMs(duration: number | null | undefined): number {
  if (!duration || duration <= 0) return 0;
  return duration > 1000 ? duration : duration * 1000;
}

/**
 * @purpose True when a camera-roll clip is longer than the 45s Highlight cap.
 */
export function isHighlightTooLong(duration: number | null | undefined): boolean {
  const ms = assetDurationMs(duration);
  return ms > HIGHLIGHT_MAX_MS;
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message.trim() ? caught.message : fallback;
}

async function sessionUserId(): Promise<string> {
  if (!isSupabaseConfigured) return 'guest';
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? 'guest';
}

async function blobFromUri(uri: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(uri);
  } catch (caught) {
    throw new Error(
      `Could not read this file from disk. Pick it again. (${errorMessage(caught, 'fetch failed')})`,
    );
  }

  try {
    const blob = await response.blob();
    if (blob && blob.size > 0) return blob;
  } catch {
    // Native file:// often needs ArrayBuffer.
  }

  try {
    const retry = await fetch(uri);
    const buffer = await retry.arrayBuffer();
    if (!buffer.byteLength) throw new Error('The selected file is empty.');
    return new Blob([buffer], { type: 'application/octet-stream' });
  } catch (caught) {
    throw new Error(`Could not convert this file. (${errorMessage(caught, 'blob conversion failed')})`);
  }
}

/**
 * @purpose Client-side 1080p vertical compress via `react-native-compressor`. Expo Go / web skip native compress.
 * @param uri Local `file://` or `ph://` video URI.
 * @param onProgress 0–1 while the native encoder runs.
 * @returns Compressed `file://` URI, or the original URI when the native module is missing.
 * @sideEffects Native ffmpeg-style encode on a development build; no-op in Expo Go.
 */
export async function compressHighlight(uri: string, onProgress?: CompressProgress): Promise<string> {
  if (!uri || Platform.OS === 'web') {
    onProgress?.(1);
    return uri;
  }

  try {
    const { Video } = await import('react-native-compressor');
    const next = await Video.compress(
      uri,
      {
        compressionMethod: 'manual',
        maxSize: VERTICAL_MAX_EDGE,
        bitrate: VERTICAL_1080_BITRATE,
      },
      (progress) => {
        const ratio = typeof progress === 'number' ? progress : 0;
        onProgress?.(ratio > 1 ? ratio / 100 : ratio);
      },
    );
    return typeof next === 'string' && next.trim() ? next : uri;
  } catch {
    onProgress?.(1);
    return uri;
  }
}

async function uploadToBucket(
  buckets: string[],
  path: string,
  blob: Blob,
  contentType: string,
): Promise<{ bucket: string; publicUrl: string }> {
  let lastError = 'Upload failed.';
  for (const bucket of buckets) {
    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      contentType,
      upsert: true,
    });
    if (!error) {
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(path);
      if (publicUrl) return { bucket, publicUrl };
      lastError = 'Upload succeeded but no public URL was returned.';
      continue;
    }
    lastError = error.message.includes('Bucket not found')
      ? `Storage bucket ${bucket} is missing. Run supabase/media_upload.sql in the SQL editor.`
      : error.message;
  }
  throw new Error(lastError);
}

async function insertReelRow(baseRow: {
  video_url: string;
  title: string;
  player_id: string;
  game_id: string | null;
  is_exclusive: boolean;
  is_vault_only: boolean;
  category: ReelCategory;
}): Promise<Reel> {
  const withCategory = await supabase
    .from('reels')
    .insert(baseRow)
    .select('id, video_url, title, player_id, game_id, created_at, is_exclusive, is_vault_only, category')
    .single();

  if (!withCategory.error && withCategory.data) {
    return {
      ...(withCategory.data as Reel),
      is_exclusive: baseRow.is_exclusive,
      is_vault_only: baseRow.is_vault_only,
      category: baseRow.category,
    };
  }

  const insertError = withCategory.error;
  if (insertError?.message.includes('category') || insertError?.message.includes('is_vault_only')) {
    const { category: _dropped, ...withoutCategory } = baseRow;
    const retry = await supabase
      .from('reels')
      .insert(withoutCategory)
      .select('id, video_url, title, player_id, game_id, created_at, is_exclusive, is_vault_only')
      .single();
    if (!retry.error && retry.data) {
      return { ...(retry.data as Reel), is_exclusive: baseRow.is_exclusive, is_vault_only: baseRow.is_vault_only, category: baseRow.category };
    }
    if (retry.error?.message.includes('is_vault_only') || insertError.message.includes('is_vault_only')) {
      const vaultless = await supabase
        .from('reels')
        .insert({
          video_url: baseRow.video_url,
          title: baseRow.title,
          player_id: baseRow.player_id,
          game_id: baseRow.game_id,
          is_exclusive: baseRow.is_exclusive,
        })
        .select('id, video_url, title, player_id, game_id, created_at, is_exclusive')
        .single();
      if (!vaultless.error && vaultless.data) {
        return {
          ...(vaultless.data as Reel),
          is_exclusive: baseRow.is_exclusive,
          is_vault_only: baseRow.is_vault_only,
          category: baseRow.category,
        };
      }
    }
  }

  throw new Error(
    insertError?.message.includes('Could not find the table')
      ? 'The reels table is missing. Run supabase/reels.sql in the SQL editor.'
      : insertError?.message.includes('is_exclusive')
        ? 'The reels.is_exclusive column is missing. Run supabase/subscriptions.sql in the SQL editor.'
        : insertError?.message.includes('category')
          ? 'The reels.category column is missing. Run supabase/reel_category.sql in the SQL editor.'
          : insertError?.message ?? 'Could not save that Highlight.',
  );
}

/**
 * @purpose Compress a Seki clip, upload to Storage `reels/{user_id}/{timestamp}.mp4`, insert `public.reels`.
 * @param input Local URI + caption + tagged player/game. `compressed` skips a second encode after the picker overlay.
 * @returns Inserted reel row (vault flags + category).
 * @sideEffects `react-native-compressor`; Storage `reels` (fallback `game_highlights`); `reels` INSERT.
 */
export async function uploadHighlight({
  uri,
  title,
  playerId,
  gameId,
  isExclusive = false,
  category = 'game_play',
  compressed = false,
  onProgress,
  onStatus,
}: UploadHighlightInput): Promise<Reel> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add EXPO_PUBLIC keys to .env.local.');
  }

  const caption = title.trim();
  if (!caption) throw new Error('Add a title / hype caption.');
  if (!playerId) throw new Error('Tag a player before uploading.');
  if (!uri) throw new Error('Pick or record a clip before uploading.');

  let localUri = uri;
  if (!compressed) {
    onStatus?.(HIGHLIGHT_OPTIMIZING);
    onProgress?.(0.04);
    localUri = await compressHighlight(uri, (ratio) => onProgress?.(0.04 + ratio * 0.28));
  }

  onStatus?.("Uploading to Tapua'i…");
  onProgress?.(0.36);

  const owner = await sessionUserId();
  const filePath = `reels/${owner}/${Date.now()}.mp4`;
  const blob = await blobFromUri(localUri);
  onProgress?.(0.48);

  const { publicUrl } = await uploadToBucket(
    [REELS_BUCKET, HIGHLIGHTS_FALLBACK_BUCKET],
    filePath,
    blob,
    'video/mp4',
  );

  onProgress?.(0.82);
  onStatus?.('Saving reel…');

  const nextCategory = parseReelCategory(category);
  const reel = await insertReelRow({
    video_url: publicUrl,
    title: caption,
    player_id: playerId,
    game_id: gameId || null,
    is_exclusive: isExclusive,
    is_vault_only: isExclusive,
    category: nextCategory,
  });

  onProgress?.(1);
  onStatus?.('Seki play uploaded.');
  return reel;
}

/**
 * @purpose Upload a 1:1 cropped profile photo to `avatars/{user_id}/{timestamp}.jpg` and stamp `profiles.avatar_url`.
 * @param uri Local ImagePicker image URI.
 * @returns Public HTTPS URL written to the signed-in profile.
 * @sideEffects Storage `avatars` upload; `profiles` UPDATE on `user_id = auth.uid()`.
 */
export async function uploadAvatar(uri: string, onProgress?: CompressProgress): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add EXPO_PUBLIC keys to .env.local.');
  }
  if (!uri) throw new Error('Pick a photo first.');

  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error('Sign in to set a profile photo.');

  onProgress?.(0.15);
  const blob = await blobFromUri(uri);
  onProgress?.(0.4);

  const path = `${userId}/${Date.now()}.jpg`;
  const { publicUrl } = await uploadToBucket([AVATARS_BUCKET], path, blob, 'image/jpeg');
  onProgress?.(0.8);

  const { error } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('user_id', userId);
  if (error) {
    throw new Error(
      error.message.includes('avatar_url')
        ? 'profiles.avatar_url is missing. Run supabase/media_upload.sql in the SQL editor.'
        : error.message,
    );
  }

  onProgress?.(1);
  return publicUrl;
}

export const MediaUploadService = {
  compressHighlight,
  uploadHighlight,
  uploadAvatar,
  isHighlightTooLong,
  assetDurationMs,
  HIGHLIGHT_TOO_LONG,
};
