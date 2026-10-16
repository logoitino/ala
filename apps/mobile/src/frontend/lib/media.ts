/**
 * Provider-neutral media references (PORT-01, first slice of SCALE-02). The one place that knows how a stored file
 * becomes a viewable URL, so a storage or video host change re-points this file instead of every screen and row.
 * References: `sb:<bucket>/<path>` (Supabase Storage), `reelvault:<path>` (Vault clips, signed per viewer), or a plain URL.
 * Rows written before this still hold full Supabase public URLs; those are recognised and rebuilt from bucket and path,
 * so they follow a host move too. Every avatar and booster-logo display reads through `mediaUri` (SCALE-02 expand step);
 * uploads keep writing full URLs while `MEDIA_WRITE_REFERENCES` is false, until enough app builds read references
 * (expand, then contract — docs/engineering/PORTABILITY.md §4 row 1).
 */
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * SCALE-02 writer switch. False (now): avatar and booster-logo uploads store the full public URL, as before.
 * True: they store `sb:<bucket>/<path>`. Flip only after a build with the `mediaUri` readers is on testers' phones
 * (owner-gated; PORTABILITY.md §4 row 1). Videos are not covered (lib/reels.ts, PLAY-01).
 */
export const MEDIA_WRITE_REFERENCES = false;

export type MediaRef =
  | { host: 'supabase'; bucket: string; path: string }
  | { host: 'reelvault'; path: string }
  | { host: 'url'; url: string };

const PUBLIC_PATH = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;

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
    return { host: 'supabase', bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
  }
  if (clean.startsWith('reelvault:')) {
    const path = clean.slice('reelvault:'.length);
    return path ? { host: 'reelvault', path } : null;
  }
  if (/^https?:\/\//i.test(clean)) {
    const match = clean.split(/[?#]/)[0].match(PUBLIC_PATH);
    if (match) return { host: 'supabase', bucket: decodeURIComponent(match[1]), path: decodeURIComponent(match[2]) };
    return { host: 'url', url: clean };
  }
  return null;
}

/** @purpose The public URL for a file in a public Storage bucket (the only call to the storage host's URL builder). */
export function publicMediaUrl(bucket: string, path: string): string | null {
  try {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl || null;
  } catch {
    return null;
  }
}

/**
 * @purpose A viewable URL for a stored value: Storage references and legacy Supabase URLs are rebuilt for the current
 *   host; other URLs pass through; Vault clips return null (they need a signed URL from lib/vault).
 */
export function resolveMediaUrl(value: string | null | undefined): string | null {
  const ref = parseMediaRef(value);
  if (!ref) return null;
  if (ref.host === 'url') return ref.url;
  if (ref.host === 'reelvault') return null;
  return publicMediaUrl(ref.bucket, ref.path);
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
export function mediaUri(value: string | null | undefined): string | undefined {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (!clean) return undefined;
  if (LOCAL_URI.test(clean)) return clean;
  const ref = parseMediaRef(clean);
  if (!ref) return undefined;
  if (ref.host === 'url') return ref.url;
  if (ref.host === 'reelvault') return undefined;
  if (clean.startsWith('sb:')) return publicMediaUrl(ref.bucket, ref.path) ?? undefined;
  if (!isSupabaseConfigured) return clean;
  const rebuilt = publicMediaUrl(ref.bucket, ref.path);
  // Keep any query or fragment the stored URL carried, so on today's host the result is byte-for-byte the stored URL.
  return rebuilt ? rebuilt + clean.slice(clean.split(/[?#]/)[0].length) : clean;
}
