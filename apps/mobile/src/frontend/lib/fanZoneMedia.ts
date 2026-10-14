/**
 * FUN-01 media API client. Web fetches authenticated bounded bytes because Expo Video web ignores source
 * headers; native uses bearer headers. Object URLs must be released by the consuming player on exit/replacement.
 * @sideEffects Session reads, authenticated API calls, and explicitly owned browser object URL allocation/release.
 */
import { Platform } from 'react-native';
import type { VideoSource } from 'expo-video';
import { FAN_ZONE_MEDIA_LIMITS } from '@shared/fanZone';
import { requireAccessToken } from '@/lib/sessionToken';

type MediaReply = { ok: true; revision: number; digest?: string; bytes?: number; duration_ms?: number; completed?: boolean; status?: string };
function mediaUrl(path: string): string {
  const origin = process.env.EXPO_PUBLIC_API_ORIGIN?.trim().replace(/\/+$/, '');
  if (!origin) {
    if (Platform.OS === 'web') return path;
    throw new Error('Fan videos are not set up in this build yet.');
  }
  let parsed: URL;
  try { parsed = new URL(origin); } catch { throw new Error('Fan videos are not set up in this build yet.'); }
  const local = __DEV__ && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if ((parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('Fan videos are not set up in this build yet.');
  return `${origin}${path}`;
}
function mediaError(code?: string): Error {
  if (code === 'FUN_SIGN_IN') return new Error('Sign in again to use fan videos.');
  if (code === 'FUN_MEDIA_DENIED') return new Error('Video permission changed. Refresh before trying again.');
  if (code === 'FUN_MEDIA_FORMAT') return new Error('Choose a supported MP4 video. This file could not be safely prepared.');
  if (code === 'FUN_MEDIA_DURATION') return new Error('Choose a video between 1 and 30 seconds.');
  if (code === 'FUN_MEDIA_SIZE') return new Error('Choose a video under 20 MiB.');
  return new Error('Fan video service is unavailable. Your entry stays private.');
}
async function post(route: 'upload' | 'remove', entry: string, revision: number): Promise<MediaReply> {
  const url = mediaUrl(`/api/fan-zone-${route}`);
  const token = await requireAccessToken('Sign in to use fan videos.');
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ entry, revision }), cache: 'no-store' });
  const body = await response.json() as MediaReply & { error?: string };
  if (!response.ok || body.ok !== true) throw mediaError(body.error);
  return body;
}

/** @purpose Ask server to sanitize and verify this reserved private upload; never supplies paths/digests. */
export function verifyFanZoneUpload(entry: string, revision: number): Promise<MediaReply> { return post('upload', entry, revision); }
/** @purpose Remove one authorized media revision; completed is true only after all revisions are absent. */
export function removeFanZoneMedia(entry: string, revision: number): Promise<MediaReply> { return post('remove', entry, revision); }

/** @purpose Prepare one explicitly requested private video; consumer must call release on exit or replacement. */
export async function loadFanZoneVideo(entry: string, revision: number, signal?: AbortSignal): Promise<{ source: VideoSource; release: () => void }> {
  const url = mediaUrl(`/api/fan-zone-media?entry=${encodeURIComponent(entry)}&revision=${revision}`);
  const token = await requireAccessToken('Sign in to watch fan videos.');
  if (Platform.OS !== 'web') return { source: { uri: url, headers: { Authorization: `Bearer ${token}` }, contentType: 'progressive' }, release: () => undefined };
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw mediaError(body.error);
  }
  if (response.headers.get('Content-Type')?.split(';')[0] !== 'video/mp4' || Number(response.headers.get('Content-Length') ?? 0) > FAN_ZONE_MEDIA_LIMITS.maxBytes) throw mediaError();
  const blob = await response.blob();
  if (blob.size > FAN_ZONE_MEDIA_LIMITS.maxBytes || signal?.aborted) throw mediaError();
  const objectUrl = URL.createObjectURL(blob); let released = false;
  return { source: { uri: objectUrl, contentType: 'progressive' }, release: () => { if (!released) { released = true; URL.revokeObjectURL(objectUrl); } } };
}
