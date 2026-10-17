/**
 * Picking-to-upload pipeline for media: names the Storage buckets (`reels`, `game_highlights`, `avatars`, `reel_vault`),
 * enforces the 45 s Highlight cap (normalising picker durations that arrive in seconds or milliseconds), compresses
 * video with `react-native-compressor`, and uploads Highlights, photo-story photos and avatars. Also owns the one
 * `reels` insert path shared by videos and photo stories (`insertReelRow`) and the JPEG metadata stripper that keeps
 * GPS / camera data out of public photos (PHOTO_STORIES_DESIGN.md "Privacy and safety"). Process-wide helper, so it
 * lives in services/ (PascalCase) rather than lib/.
 * Avatar uploads write through `mediaValueToStore` (SCALE-02 switch in lib/media, off for now).
 * @sideEffects Reads device media; writes Supabase Storage; inserts `reels` rows.
 */

import { Platform, TurboModuleRegistry } from 'react-native';

import { RIGHTS_VERSION } from '@/data/contentRights';
import {
  HIGHLIGHT_MAX_MS,
  HIGHLIGHT_OPTIMIZING } from '@/data/media';
import { parseReelCategory, type HighlightMediaType, type ReelCategory } from '@/data/highlights';
import { mediaValueToStore, publicMediaUrl } from '@/lib/media';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Database, Reel } from '@/types/database';

export const REELS_BUCKET = 'reels';
export const HIGHLIGHTS_FALLBACK_BUCKET = 'game_highlights';
export const AVATARS_BUCKET = 'avatars';
/** Private bucket for Vault / Exclusive clips. `video_url` stores `reelvault:{path}`, never a public URL. */
export const REEL_VAULT_BUCKET = 'reel_vault';
export const REEL_VAULT_PREFIX = 'reelvault:';

/** Longest edge for a story photo: sharp on a phone feed, a fraction of a 12 MP original's upload size. */
const STORY_PHOTO_MAX_EDGE = 1600;
const STORY_PHOTO_QUALITY = 0.85;

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
  playerId?: string | null;
  /** Optional — a Highlight does not need to be linked to a specific live matchup. */
  gameId?: string | null;
  isExclusive?: boolean;
  category?: ReelCategory;
  coachLevel?: boolean;
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

/**
 * @purpose Read a local picker URI as raw bytes. React Native's `fetch().blob()` stamps
 * `text/plain`, and Storage then rejects the avatar/reel upload (`allowed_mime_types`).
 * An ArrayBuffer has no MIME of its own, so `upload()` uses the `contentType` we pass.
 */
export async function bytesFromUri(uri: string): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetch(uri);
  } catch (caught) {
    throw new Error(
      `Could not read this file from disk. Pick it again. (${errorMessage(caught, 'fetch failed')})`,
    );
  }

  try {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength) return buffer;
  } catch (caught) {
    throw new Error(`Could not convert this file. (${errorMessage(caught, 'read failed')})`);
  }

  throw new Error('The selected file is empty.');
}

/** Bucket allow-list is jpeg / png / webp. Edited Camera Roll crops are jpeg when the URI has no extension. */
export function imageContentType(uri: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const path = uri.split('?')[0]?.toLowerCase() ?? '';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * @purpose True when this binary actually linked Nitro. Expo Go does not, and importing
 * `react-native-compressor` there throws an uncaught NitroModules redbox.
 */
function compressorNativeReady(): boolean {
  if (Platform.OS === 'web') return false;
  return TurboModuleRegistry.get('NitroModules') != null;
}

/**
 * @purpose Client-side 1080p vertical compress via `react-native-compressor`. Expo Go / web skip native compress and upload the original file.
 * @param uri Local `file://` or `ph://` video URI.
 * @param onProgress 0–1 while the native encoder runs.
 * @returns Compressed `file://` URI, or the original URI when NitroModules is not in this binary.
 * @sideEffects Native encode on a development build that includes `react-native-compressor`. No-op in Expo Go.
 */
export async function compressHighlight(uri: string, onProgress?: CompressProgress): Promise<string> {
  if (!uri || !compressorNativeReady()) {
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
  body: ArrayBuffer,
  contentType: string,
  // Story photos pass false: each path is new (timestamped), so an existing object means something is wrong
  // and must not be silently replaced. Videos and avatars keep their existing upsert behaviour.
  upsert = true,
): Promise<{ bucket: string; publicUrl: string }> {
  let lastError = 'Upload failed.';
  for (const bucket of buckets) {
    const { error } = await supabase.storage.from(bucket).upload(path, body, {
      contentType,
      upsert,
    });
    if (!error) {
      const publicUrl = publicMediaUrl(bucket, path);
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

export type ReelInsertRow = {
  video_url: string;
  title: string;
  player_id: string | null;
  game_id: string | null;
  is_exclusive: boolean;
  is_vault_only: boolean;
  category: ReelCategory;
  attested_at?: string;
  rights_version?: string;
  /** Omitted for videos (column default `video`); `photo_story` rows store `video_url = ''`. */
  media_type?: HighlightMediaType;
  safety_label?: 'none' | 'coach_level';
};

/**
 * @purpose The single `reels` insert used by videos and photo stories, so both get the same insert policy, the
 *   `reels_apply_tag_defaults` trigger (`uploaded_by` = caller, tag status pending unless the athlete posts),
 *   the rights attestation and the category.
 * @param baseRow Row to insert. Optional columns an older database lacks (`attested_at`, `rights_version`,
 *   `category`, `is_vault_only`) are dropped and retried, as before.
 * @returns The inserted reel. A photo story comes back with `photo_count: 0` until `set_reel_photos` runs.
 * @throws When `media_type` is rejected: dropping it would publish a broken *video* row with an empty URL.
 * @sideEffects `reels` INSERT.
 */
export async function insertReelRow(baseRow: ReelInsertRow): Promise<Reel> {
  type InsertRow = Database['public']['Tables']['reels']['Insert'] & { media_type?: HighlightMediaType; safety_label?: 'none' | 'coach_level' };
  let row: InsertRow = { ...baseRow };
  if (!row.media_type) delete row.media_type;
  let lastError: { message: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const withCategory = await supabase
      .from('reels')
      .insert(row as Database['public']['Tables']['reels']['Insert'])
      .select('id, video_url, title, player_id, game_id, created_at, is_exclusive, is_vault_only, category')
      .single();
    if (!withCategory.error && withCategory.data) {
      const inserted: Reel = {
        ...(withCategory.data as Reel),
        is_exclusive: Boolean(row.is_exclusive),
        is_vault_only: Boolean(row.is_vault_only),
        category: (row.category as ReelCategory) ?? baseRow.category,
      };
      return row.media_type === 'photo_story'
        ? ({ ...inserted, media_type: 'photo_story', photo_count: 0 } as Reel)
        : inserted;
    }
    lastError = withCategory.error;
    const message = withCategory.error?.message ?? '';
    if (row.media_type && message.includes('media_type')) {
      throw new Error('Photo stories need the latest database update. Share a video instead for now.');
    }
    const drop = (['attested_at', 'rights_version', 'category', 'is_vault_only', 'safety_label'] as const).find(
      (column) => column in row && message.includes(column),
    );
    if (!drop) break;
    const next = { ...row };
    delete next[drop];
    row = next;
  }

  const insertError = lastError;
  if (insertError) {
    throw new Error(
      insertError.message.includes('Could not find the table')
        ? 'The reels table is missing. Run supabase/reels.sql in the SQL editor.'
        : insertError.message.includes('is_exclusive')
          ? 'The reels.is_exclusive column is missing. Run supabase/subscriptions.sql in the SQL editor.'
          : insertError.message.includes('category')
            ? 'The reels.category column is missing. Run supabase/reel_category.sql in the SQL editor.'
            : insertError.message || 'Could not save that Highlight.',
    );
  }
  throw new Error('Could not save that Highlight.');
}

/**
 * @purpose Compress a Seki clip and insert `public.reels`. Free clips go to public Storage `reels`. Vault / Exclusive clips go to private `reel_vault` and store `reelvault:{path}`.
 * @param input Local URI + caption + tagged player/game. `compressed` skips a second encode after the picker overlay. `isExclusive` locks the file.
 * @returns Inserted reel row. A locked clip's `video_url` on this object is a one-hour signed URL for immediate playback; the database keeps the `reelvault:` token.
 * @sideEffects `react-native-compressor`; Storage `reels` or `reel_vault`; `reels` INSERT; signed URL for exclusive playback.
 */
export async function uploadHighlight({
  uri,
  title,
  playerId,
  gameId,
  isExclusive = false,
  category = 'game_play',
  coachLevel = false,
  compressed = false,
  onProgress,
  onStatus,
}: UploadHighlightInput): Promise<Reel> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add EXPO_PUBLIC keys to .env.local.');
  }

  const caption = title.trim();
  if (!caption) throw new Error('Add a title / hype caption.');
  if (!uri) throw new Error('Pick or record a clip before uploading.');
  const taggedPlayerId = playerId?.trim() || null;
  if (isExclusive && !taggedPlayerId) throw new Error('Tag an athlete before one-time Exclusive.');

  let localUri = uri;
  if (!compressed) {
    onStatus?.(HIGHLIGHT_OPTIMIZING);
    onProgress?.(0.04);
    localUri = await compressHighlight(uri, (ratio) => onProgress?.(0.04 + ratio * 0.28));
  }

  onStatus?.("Uploading to Tapua'i…");
  onProgress?.(0.36);

  const owner = await sessionUserId();
  if (isExclusive && owner === 'guest') {
    throw new Error('Sign in before uploading a Vault clip.');
  }
  const body = await bytesFromUri(localUri);
  onProgress?.(0.48);

  let videoUrl: string;
  let vaultPath = '';
  if (isExclusive) {
    vaultPath = `${owner}/${Date.now()}.mp4`;
    await uploadToBucket([REEL_VAULT_BUCKET], vaultPath, body, 'video/mp4');
    videoUrl = `${REEL_VAULT_PREFIX}${vaultPath}`;
  } else {
    const filePath = `reels/${owner}/${Date.now()}.mp4`;
    const uploaded = await uploadToBucket(
      [REELS_BUCKET, HIGHLIGHTS_FALLBACK_BUCKET],
      filePath,
      body,
      'video/mp4',
    );
    videoUrl = uploaded.publicUrl;
  }

  onProgress?.(0.82);
  onStatus?.('Saving reel…');

  const nextCategory = parseReelCategory(category);
  const reel = await insertReelRow({
    video_url: videoUrl,
    title: caption,
    player_id: taggedPlayerId,
    game_id: gameId || null,
    is_exclusive: isExclusive,
    is_vault_only: isExclusive,
    category: nextCategory,
    ...(coachLevel && nextCategory === 'train_like_me' ? { safety_label: 'coach_level' as const } : {}),
    attested_at: new Date().toISOString(),
    rights_version: RIGHTS_VERSION,
  });

  onProgress?.(1);
  onStatus?.('Seki play uploaded.');
  if (!vaultPath) return reel;
  const signed = await supabase.storage.from(REEL_VAULT_BUCKET).createSignedUrl(vaultPath, 60 * 60);
  if (signed.error || !signed.data?.signedUrl) return reel;
  return { ...reel, video_url: signed.data.signedUrl };
}

// ---------------------------------------------------------------------------------------------
// Photo stories. Rule (PHOTO_STORIES_DESIGN.md "Privacy and safety"; LEGAL_BRIEFING minor-safety rows):
// photos of minors must never reach the public `reels` bucket carrying GPS or camera metadata.
// The picker asks for `exif: false` and re-encodes, but neither is a guarantee on every platform,
// so the bytes are walked and cleaned here, after the last re-encode and right before upload.
// ---------------------------------------------------------------------------------------------

type JpegParse = {
  ranges: [number, number][];
  width?: number;
  height?: number;
  /** EXIF Orientation (tag 0x0112, 1–8) from the first EXIF APP1, if one was readable. */
  orientation?: number;
  /** Index in `ranges` after which the minimal orientation APP1 goes (after SOI, or after APP0 when present). */
  insertAfter: number;
};

/** APP1–APP13, APP15 (EXIF/GPS, XMP, ICC, MPF, Photoshop IRB/IPTC, vendor blobs) and COM. APP0 (JFIF) and
 *  APP14 (Adobe colour transform — removing it can flip colours on CMYK/YCCK files) stay. */
function isMetadataMarker(marker: number): boolean {
  return (marker >= 0xe1 && marker <= 0xed) || marker === 0xef || marker === 0xfe;
}

/** SOF0–SOF15 carry the frame size; C4 (DHT), C8 (reserved JPG) and CC (DAC) share the range but are not frames. */
function isFrameMarker(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

/**
 * Read EXIF Orientation from an APP1 segment ("Exif\0\0" + TIFF). Only IFD0 tag 0x0112 is read; every other
 * field (GPS IFD, camera make/model, timestamps) is ignored because the whole segment is dropped afterwards.
 * @returns 1–8, or undefined when absent or malformed (bounds are checked against the segment end).
 */
function readExifOrientation(bytes: Uint8Array, payloadStart: number, segmentEnd: number): number | undefined {
  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  if (payloadStart + 14 > segmentEnd) return undefined;
  for (let k = 0; k < exifHeader.length; k += 1) if (bytes[payloadStart + k] !== exifHeader[k]) return undefined;
  const tiff = payloadStart + 6;
  const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  const big = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;
  if (!little && !big) return undefined;
  const u16 = (at: number) => (little ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1]);
  const u32 = (at: number) => (little
    ? (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)) + bytes[at + 3] * 0x1000000
    : bytes[at] * 0x1000000 + ((bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]));
  if (u16(tiff + 2) !== 42) return undefined;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > segmentEnd) return undefined;
  const entries = u16(ifd);
  for (let e = 0; e < entries; e += 1) {
    const entry = ifd + 2 + e * 12;
    if (entry + 12 > segmentEnd) return undefined;
    if (u16(entry) !== 0x0112) continue;
    // SHORT (type 3), count 1: the value sits in the first two bytes of the value field.
    if (u16(entry + 2) !== 3 || u32(entry + 4) !== 1) return undefined;
    const value = u16(entry + 8);
    return value >= 1 && value <= 8 ? value : undefined;
  }
  return undefined;
}

/**
 * Walk JPEG segments and list the byte ranges to keep. Returns null when the bytes are not a JPEG or the
 * structure is broken before the image ends — callers then refuse to treat the file as cleaned.
 */
function parseJpeg(bytes: Uint8Array): JpegParse | null {
  const length = bytes.length;
  if (length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const parsed: JpegParse = { ranges: [[0, 2]], insertAfter: 0 };
  let i = 2;
  while (i < length) {
    if (bytes[i] !== 0xff) return null;
    // Any number of 0xFF fill bytes may precede a marker.
    let markerAt = i;
    while (markerAt + 1 < length && bytes[markerAt + 1] === 0xff) markerAt += 1;
    if (markerAt + 1 >= length) return null;
    const marker = bytes[markerAt + 1];
    const segmentStart = markerAt;
    if (marker === 0xd9) {
      // EOI. Anything after it (MPF secondary images, vendor trailers) can embed a full EXIF block: drop it.
      parsed.ranges.push([segmentStart, segmentStart + 2]);
      return parsed;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parsed.ranges.push([segmentStart, segmentStart + 2]);
      i = segmentStart + 2;
      continue;
    }
    if (marker === 0xd8 || marker === 0x00) return null;
    if (segmentStart + 4 > length) return null;
    const segmentLength = (bytes[segmentStart + 2] << 8) | bytes[segmentStart + 3];
    const segmentEnd = segmentStart + 2 + segmentLength;
    if (segmentLength < 2 || segmentEnd > length) return null;
    if (isFrameMarker(marker) && segmentLength >= 7) {
      parsed.height = (bytes[segmentStart + 5] << 8) | bytes[segmentStart + 6];
      parsed.width = (bytes[segmentStart + 7] << 8) | bytes[segmentStart + 8];
    }
    if (marker === 0xe1 && parsed.orientation === undefined) {
      parsed.orientation = readExifOrientation(bytes, segmentStart + 4, segmentEnd);
    }
    if (marker !== 0xda) {
      if (!isMetadataMarker(marker)) parsed.ranges.push([segmentStart, segmentEnd]);
      // JFIF readers expect APP0 directly after SOI, so the orientation APP1 goes after it.
      if (marker === 0xe0 && parsed.ranges.length === 2) parsed.insertAfter = 1;
      i = segmentEnd;
      continue;
    }
    // SOS: keep the header and the entropy-coded data verbatim, up to the next real marker. Inside scan data
    // 0xFF00 is a stuffed byte and 0xFFD0–D7 are restart markers, so neither ends the scan.
    let j = segmentEnd;
    while (j + 1 < length && !(bytes[j] === 0xff && bytes[j + 1] !== 0x00 && !(bytes[j + 1] >= 0xd0 && bytes[j + 1] <= 0xd7))) {
      j += 1;
    }
    if (j + 1 >= length) return null; // No EOI: truncated file.
    parsed.ranges.push([segmentStart, j]);
    i = j;
  }
  return null;
}

/**
 * Minimal APP1 carrying only the Orientation tag: "Exif\0\0", big-endian TIFF header, IFD0 with one SHORT
 * entry (0x0112), next-IFD 0. Without it, a phone photo whose pixels were never rotated (picker or compressor
 * kept the sensor orientation) would display sideways once the original EXIF block is removed.
 */
function orientationSegment(orientation: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xe1, 0x00, 0x22, // APP1, length 34
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // "MM", 42, IFD0 at offset 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // Orientation SHORT ×1
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ]);
}

/** Assemble the cleaned file: kept ranges, plus the orientation-only APP1 when the photo is not upright (≠ 1). */
function buildCleanJpeg(bytes: Uint8Array, parsed: JpegParse): Uint8Array<ArrayBuffer> {
  const extra = parsed.orientation && parsed.orientation !== 1 ? orientationSegment(parsed.orientation) : null;
  const total = parsed.ranges.reduce((sum, [start, end]) => sum + (end - start), 0) + (extra?.length ?? 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parsed.ranges.forEach(([start, end], index) => {
    out.set(bytes.subarray(start, end), offset);
    offset += end - start;
    if (extra && index === parsed.insertAfter) {
      out.set(extra, offset);
      offset += extra.length;
    }
  });
  return out;
}

/**
 * @purpose Remove location, camera and other metadata segments from a JPEG without touching the image data.
 *   Keeps SOI, APP0, APP14, DQT / SOF / DHT / DRI / SOS and all scan data; drops APP1–APP13, APP15, COM and any
 *   bytes after EOI. If the original EXIF said the photo is rotated (Orientation ≠ 1), a new APP1 holding only
 *   that one tag is written after SOI/APP0 so the photo still displays upright; GPS and everything else stay gone.
 * @param bytes Encoded image.
 * @returns A new, cleaned copy — or the same `bytes` object unchanged when the input is not a well-formed JPEG
 *   (callers that need a guarantee compare identity; see `uploadStoryPhoto`).
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  const parsed = parseJpeg(bytes);
  if (!parsed) return bytes;
  return buildCleanJpeg(bytes, parsed);
}

/**
 * @purpose Downscale and re-encode a picked photo to JPEG on a development build (`react-native-compressor`).
 *   Expo Go / web have no Nitro module, so they rely on the picker's own `quality: 0.85` re-encode.
 * @returns A `file://` JPEG URI, or the original URI when native compression is unavailable or fails.
 * @sideEffects Native image encode on development builds only.
 */
async function compressStoryPhoto(uri: string): Promise<string> {
  if (!compressorNativeReady()) return uri;
  try {
    const { Image } = await import('react-native-compressor');
    const next = await Image.compress(uri, {
      compressionMethod: 'manual',
      maxWidth: STORY_PHOTO_MAX_EDGE,
      maxHeight: STORY_PHOTO_MAX_EDGE,
      quality: STORY_PHOTO_QUALITY,
      input: 'uri',
      output: 'jpg',
      returnableOutputType: 'uri',
    });
    return typeof next === 'string' && next.trim() ? next : uri;
  } catch {
    return uri;
  }
}

/**
 * @purpose Prepare and upload one photo of a story: re-encode (when the native compressor exists), strip JPEG
 *   metadata (keeping only orientation), then upload to the caller's own folder in public bucket `reels`.
 *   The database stores the Storage *path*, never a URL, and `set_reel_photos` checks it against
 *   `^<auth.uid>/stories/<reel_id>/[0-9]{1,2}-[0-9]{10,16}\.jpg$`, so the path shape here must not drift.
 * @param uri Local picker URI.
 * @param reelId The story's `reels.id` (its Storage folder).
 * @param position 0-based order (0–9), kept in the file name; the timestamp keeps retries from colliding.
 * @returns Storage path, its public URL (for immediate display), and the displayed pixel size read from the
 *   JPEG frame header — swapped for orientations 5–8, where viewers rotate the image a quarter turn.
 * @throws When signed out, when the file is not a JPEG we could clean (we never upload uncleaned bytes), on a bad
 *   position, or on Storage errors.
 * @sideEffects Native image encode; Storage `reels/{auth.uid}/stories/{reelId}/{position}-{ts}.jpg`.
 */
export async function uploadStoryPhoto(
  uri: string,
  reelId: string,
  position: number,
): Promise<{ imagePath: string; imageUrl: string; width?: number; height?: number }> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add EXPO_PUBLIC keys to .env.local.');
  }
  if (!uri) throw new Error('Pick a photo first.');
  if (!reelId.trim()) throw new Error('This story has no id yet. Try again.');
  if (!Number.isInteger(position) || position < 0 || position > 9) throw new Error('A story holds up to 10 photos.');
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error('Sign in to share photos.');

  const localUri = await compressStoryPhoto(uri);
  const raw = new Uint8Array(await bytesFromUri(localUri));
  const parsed = parseJpeg(raw);
  if (!parsed) {
    // PNG / HEIC / broken files can carry metadata we cannot remove here, so they are refused, not uploaded as-is.
    throw new Error('This photo could not be prepared for sharing. Choose a different photo.');
  }
  const cleaned = buildCleanJpeg(raw, parsed);
  const imagePath = `${userId}/stories/${reelId}/${position}-${Date.now()}.jpg`;
  const { publicUrl } = await uploadToBucket([REELS_BUCKET], imagePath, cleaned.buffer, 'image/jpeg', false);
  const quarterTurn = (parsed.orientation ?? 1) >= 5;
  return {
    imagePath,
    imageUrl: publicUrl,
    width: quarterTurn ? parsed.height : parsed.width,
    height: quarterTurn ? parsed.width : parsed.height,
  };
}

/**
 * @purpose Upload a 1:1 cropped profile photo to `avatars/{user_id}/{timestamp}.jpg` and stamp `profiles.avatar_url`.
 * @param uri Local ImagePicker image URI.
 * @returns The value written to the signed-in profile: the public HTTPS URL today, or an `sb:avatars/...` reference
 *   once `MEDIA_WRITE_REFERENCES` is on (SCALE-02). Display it through `mediaUri` from lib/media.
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
  const body = await bytesFromUri(uri);
  onProgress?.(0.4);

  const path = `${userId}/${Date.now()}.jpg`;
  const { bucket, publicUrl } = await uploadToBucket([AVATARS_BUCKET], path, body, imageContentType(uri));
  const stored = mediaValueToStore(bucket, path, publicUrl);
  onProgress?.(0.8);

  const { error } = await supabase.from('profiles').update({ avatar_url: stored }).eq('user_id', userId);
  if (error) {
    throw new Error(
      error.message.includes('avatar_url')
        ? 'profiles.avatar_url is missing. Run supabase/media_upload.sql in the SQL editor.'
        : error.message,
    );
  }

  onProgress?.(1);
  return stored;
}
