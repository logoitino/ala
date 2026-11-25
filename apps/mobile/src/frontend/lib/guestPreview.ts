/** GUEST-ACCESS-01 has one bounded guest data source; unavailable or widened results never fall back to member feeds/rosters. */
import { GUEST_PREVIEW_HIGHLIGHTS, type GuestHighlightPreview } from '@tapuai/shared-types';
import { getGuestPreviewClient, isSupabaseConfigured } from '@/lib/supabase';
import { untypedRpc } from '@/lib/rpc';
import { resolvePlaybackUrl } from '@/lib/reels';
const UNAVAILABLE = 'The preview is unavailable. Please try again.';
/** @purpose Read only the explicit safe guest window. @sideEffects One guest_highlights_preview RPC; resolve allowed free media references. */
export async function fetchGuestHighlightPreview(): Promise<GuestHighlightPreview[]> {
  if (!isSupabaseConfigured) throw new Error(UNAVAILABLE);
  const { data, error } = await untypedRpc('guest_highlights_preview', {}, getGuestPreviewClient());
  if (error || !Array.isArray(data) || data.length > GUEST_PREVIEW_HIGHLIGHTS) throw new Error(UNAVAILABLE);
  const ids = new Set<string>();
  const rows: GuestHighlightPreview[] = [];
  for (const row of data) {
    if (!row || typeof row !== 'object' || Object.keys(row).some(key => !['id','title','video_url','created_at'].includes(key))
      || typeof row.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(row.id) || ids.has(row.id)
      || typeof row.title !== 'string' || typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))
      || typeof row.video_url !== 'string' || !row.video_url.trim() || /^vault:/i.test(row.video_url)) throw new Error(UNAVAILABLE);
    ids.add(row.id);
    const url = await resolvePlaybackUrl(row.video_url);
    if (!url) throw new Error(UNAVAILABLE);
    rows.push({ id: row.id, title: row.title, video_url: url, created_at: row.created_at });
  }
  return rows;
}
