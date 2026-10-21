/**
 * Provider-neutral media references (PORT-01, first slice of SCALE-02). The one place that knows how a stored file
 * becomes a viewable URL, so a storage or video host change re-points this file instead of every screen and row.
 * References: `sb:<bucket>/<path>` (Supabase Storage), `reelvault:<path>` (Vault clips, signed per viewer), or a plain URL.
 * Rows written before this still hold full Supabase public URLs; those are recognised and rebuilt from bucket and path,
 * so they follow a host move too. Every avatar and booster-logo display reads through `mediaUri` (SCALE-02 expand step);
 * uploads keep writing full URLs while `MEDIA_WRITE_REFERENCES` is false, until enough app builds read references
 * (expand, then contract — docs/engineering/PORTABILITY.md §4 row 1).
 */
import { isSupabaseConfigured } from '@/lib/supabase';
import { mediaStorage, type MediaStorageAdapter } from '@/lib/mediaStorage';

/**
 * SCALE-02 writer switch. False (now): avatar and booster-logo uploads store the full public URL, as before.
 * True: they store `sb:<bucket>/<path>`. Flip only after a build with the `mediaUri` readers is on testers' phones
 * (owner-gated; PORTABILITY.md §4 row 1). Video readers accept references; video writers remain unchanged.
 */
export const MEDIA_WRITE_REFERENCES = false;

export type MediaRef =
  | { host: 'supabase'; bucket: string; path: string }
  | { host: 'reelvault'; path: string }
  | { host: 'url'; url: string };

const PUBLIC_PATH = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;
// Only these buckets are public in the canonical schema. Private features own separate authorized readers.
const PUBLIC_BUCKETS = new Set(['avatars', 'reels', 'game_highlights']);

function validObjectPath(path: string): boolean {
  if (!path || /[\\\\?#\u0000-\u001f\u007f]/.test(path)) return false;
  return path.split('/').every((segment) => {
    // Stored object names may contain a literal percent. URL parsing separately rejects invalid URL escapes.
    let decoded = segment;
    try { decoded = decodeURIComponent(segment); } catch { /* Literal percent in an already decoded key. */ }
    return !!decoded && decoded !== '.' && decoded !== '..' && !/[\/\\\\?#\u0000-\u001f\u007f]/.test(decoded);
  });
}

function storageRef(bucket: string, path: string): MediaRef | null {
  return /^[a-z0-9_-]+$/.test(bucket) && validObjectPath(path) ? { host: 'supabase', bucket, path } : null;
}

/** @purpose The reference string to store for a file in a Storage bucket. */
export function toMediaRef(bucket: string, path: string): string {
  return `sb:${bucket}/${path.replace(/^\/+/, '')}`;
}

/** @purpose Read a stored value (reference or legacy URL) into its parts; null for blank or unreadable values. */
export function parseMediaRef(value: string | null | undefined): MediaRef | null {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (!clean) return null;
  if (clean.startsWith('sb:')) {
    const rest = clean.slice(3);
    const slash = rest.indexOf('/');
    if (slash <= 0 || slash === rest.length - 1) return null;
    return storageRef(rest.slice(0, slash), rest.slice(slash + 1));
  }
  if (clean.startsWith('reelvault:')) {
    const path = clean.slice('reelvault:'.length);
    return validObjectPath(path) ? { host: 'reelvault', path } : null;
  }
  if (/^https?:\/\//i.test(clean)) {
    try {
      const url = new URL(clean);
      if (!url.hostname || url.username || url.password || /[\\\\\u0000-\u001f\u007f]/.test(clean)) return null;
      // Inspect the stored path before URL normalization can erase dot segments.
      const match = clean.split(/[?#]/)[0].match(PUBLIC_PATH);
      if (match) return storageRef(decodeURIComponent(match[1]), decodeURIComponent(match[2]));
      return { host: 'url', url: clean };
    } catch { return null; }
  }
  return null;
}

/** @purpose The public URL for a file in a public Storage bucket (the only call to the storage host's URL builder). */
export function publicMediaUrl(bucket: string, path: string, storage: MediaStorageAdapter = mediaStorage): string | null {
  if (!PUBLIC_BUCKETS.has(bucket) || !validObjectPath(path)) return null;
  try {
    return storage.publicUrl(bucket, path) || null;
  } catch {
    return null;
  }
}

/**
 * @purpose A viewable URL for a stored value: Storage references and legacy Supabase URLs are rebuilt for the current
 *   host; other URLs pass through; Vault clips return null (they need a signed URL from lib/vault).
 */
export function resolveMediaUrl(value: string | null | undefined, storage: MediaStorageAdapter = mediaStorage): string | null {
  const ref = parseMediaRef(value);
  if (!ref) return null;
  if (ref.host === 'url') return ref.url;
  if (ref.host === 'reelvault') return null;
  return publicMediaUrl(ref.bucket, ref.path, storage);
}

/**
 * @purpose Resolve stored Highlight video media on a bound host. Vault tokens sign through the caller's
 *   authorized transport for one hour; private Beyond/Fan Zone media must use their feature readers.
 * @sideEffects Authorized Storage signing. No signature cache, public fallback or database write.
 */
export async function resolveVideoMediaUrl(value: string | null | undefined, storage: MediaStorageAdapter = mediaStorage): Promise<string> {
  const ref = parseMediaRef(value);
  if (!ref) return '';
  if (ref.host === 'url') return ref.url;
  const raw = value?.trim() ?? '';
  const vault = ref.host === 'reelvault' || (ref.host === 'supabase' && ref.bucket === 'reel_vault' && raw.startsWith('sb:'));
  if (storage === mediaStorage && !isSupabaseConfigured) {
    // Offline/unconfigured previews preserve only existing public URLs, never private-looking legacy URLs.
    return ref.host === 'supabase' && PUBLIC_BUCKETS.has(ref.bucket) && /^https?:/i.test(raw) ? raw : '';
  }
  if (vault) {
    try {
      const { data, error } = await storage.sign('reel_vault', ref.path, 60 * 60);
      return error ? '' : data || '';
    } catch { return ''; }
  }
  if (ref.host !== 'supabase') return '';
  const rebuilt = publicMediaUrl(ref.bucket, ref.path, storage);
  if (!rebuilt) return '';
  // Legacy video URLs previously passed through unchanged. Keep cache/playback suffixes across a host move.
  return /^https?:/i.test(raw) ? rebuilt + raw.slice(raw.split(/[?#]/)[0].length) : rebuilt;
}

/**
 * @purpose The value an upload writes to its row: `sb:<bucket>/<path>` when `MEDIA_WRITE_REFERENCES` is on,
 *   otherwise the full public URL it already built (today's behaviour).
 * @param writeReferences Defaults to the switch; tests pass it explicitly.
 */
export function mediaValueToStore(
  bucket: string,
  path: string,
  publicUrl: string,
  writeReferences: boolean = MEDIA_WRITE_REFERENCES,
): string {
  return writeReferences ? toMediaRef(bucket, path) : publicUrl;
}

/** Device-local picks and inline images (file:, content:, ph:, assets-library:, data:) shown as given. */
const LOCAL_URI = /^(file|content|ph|assets-library|data):/i;

/**
 * @purpose The `<Image source={{ uri }}>` value for a stored avatar or logo: legacy full URLs and `sb:` references
 *   both work; undefined for blank, unreadable or Vault values so the caller shows its placeholder.
 *   A legacy Supabase URL is rebuilt for the current host only when a host is configured and the rebuild succeeds;
 *   otherwise it is shown exactly as stored (query kept). Device-local URIs (a just-picked photo) pass through unchanged.
 */
export function mediaUri(value: string | null | undefined, storage: MediaStorageAdapter = mediaStorage): string | undefined {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (!clean) return undefined;
  if (LOCAL_URI.test(clean)) return clean;
  const ref = parseMediaRef(clean);
  if (!ref) return undefined;
  if (ref.host === 'url') return ref.url;
  if (ref.host === 'reelvault') return undefined;
  if (!PUBLIC_BUCKETS.has(ref.bucket)) return undefined;
  if (clean.startsWith('sb:')) return publicMediaUrl(ref.bucket, ref.path, storage) ?? undefined;
  if (storage === mediaStorage && !isSupabaseConfigured) return clean;
  const rebuilt = publicMediaUrl(ref.bucket, ref.path, storage);
  // Keep any query or fragment the stored URL carried, so on today's host the result is byte-for-byte the stored URL.
  return rebuilt ? rebuilt + clean.slice(clean.split(/[?#]/)[0].length) : clean;
}
