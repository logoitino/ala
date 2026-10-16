/**
 * FUN-01 private media handlers. Every request reauthorizes exact media, responses are no-store,
 * uploads validate/sanitize on the server, and removal completion follows successful object deletion.
 * @sideEffects Caller RPCs; server-only Storage access and service-only verify/removal receipt RPCs.
 */
import { createHash } from 'node:crypto';
import { FAN_ZONE_MEDIA_LIMITS } from '@shared/fanZone';
import { downloadFanMedia, fanMediaAccess, fanMediaBody, fanMediaClients, FanMediaError, UUID_PATTERN } from '../services/fanZoneMedia';
import type { FanMediaAccess } from '../services/fanZoneMedia';
import { sanitizeFanZoneMp4 } from '../services/fanZoneMp4';

const PRIVATE_HEADERS = { 'Cache-Control': 'no-store', 'Vary': 'Authorization', 'X-Content-Type-Options': 'nosniff' };
function json(data: unknown, status = 200): Response { return Response.json(data, { status, headers: PRIVATE_HEADERS }); }
function failed(caught: unknown): Response {
  if (caught instanceof FanMediaError) return json({ error: caught.message }, caught.status);
  const code = caught instanceof Error && /^FUN_MEDIA_(FORMAT|DURATION|SIZE)$/.test(caught.message) ? caught.message : 'FUN_MEDIA_UNAVAILABLE';
  return json({ error: code }, code === 'FUN_MEDIA_UNAVAILABLE' ? 503 : 400);
}
function mediaQuery(request: Request) {
  const url = new URL(request.url), entry = url.searchParams.get('entry'), revision = Number(url.searchParams.get('revision'));
  if (!entry || !UUID_PATTERN.test(entry) || !Number.isSafeInteger(revision) || revision < 1) throw new FanMediaError('FUN_MEDIA_REQUEST');
  return { entry, revision };
}
function range(raw: string | null, size: number): { start: number; end: number; status: number } {
  if (!raw) return { start: 0, end: size - 1, status: 200 };
  const match = /^bytes=(\d*)-(\d*)$/.exec(raw);
  if (!match || (!match[1] && !match[2])) throw new FanMediaError('FUN_MEDIA_RANGE', 416);
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] ? (match[2] ? Math.min(size - 1, Number(match[2])) : size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start || (!match[1] && Number(match[2]) === 0)) throw new FanMediaError('FUN_MEDIA_RANGE', 416);
  return { start, end, status: 206 };
}

/** @purpose Serve authenticated, currently authorized private bytes; no bearer storage URL. */
export async function fanZoneMediaHandler(request: Request): Promise<Response> {
  try {
    const { entry, revision } = mediaQuery(request);
    const { caller, service } = await fanMediaClients(request);
    const access = await fanMediaAccess(caller, entry, revision, 'read');
    if (!access.digest || !/^[a-f0-9]{64}$/.test(access.digest)) throw new FanMediaError('FUN_MEDIA_DENIED', 403);
    const bytes = await downloadFanMedia(service, access);
    if (createHash('sha256').update(bytes).digest('hex') !== access.digest) throw new FanMediaError('FUN_MEDIA_UNAVAILABLE', 503);
    const selected = range(request.headers.get('Range'), bytes.length);
    const headers: Record<string, string> = { ...PRIVATE_HEADERS, 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': String(selected.end - selected.start + 1) };
    if (selected.status === 206) headers['Content-Range'] = `bytes ${selected.start}-${selected.end}/${bytes.length}`;
    const body = new Uint8Array(selected.end - selected.start + 1);
    body.set(bytes.subarray(selected.start, selected.end + 1));
    return new Response(body.buffer, { status: selected.status, headers });
  } catch (caught) { return failed(caught); }
}

/** @purpose Check a previously committed immutable receipt against bytes without rewriting the object. */
function existingReceipt(access: FanMediaAccess, bytes: Uint8Array) {
  if (!access.digest || !/^[a-f0-9]{64}$/.test(access.digest)
    || !Number.isSafeInteger(access.bytes) || access.bytes !== bytes.length || bytes.length < 1 || bytes.length > FAN_ZONE_MEDIA_LIMITS.maxBytes
    || !Number.isSafeInteger(access.duration_ms) || Number(access.duration_ms) < FAN_ZONE_MEDIA_LIMITS.minDurationMs
    || Number(access.duration_ms) > FAN_ZONE_MEDIA_LIMITS.maxDurationMs
    || createHash('sha256').update(bytes).digest('hex') !== access.digest) throw new FanMediaError('FUN_MEDIA_UNAVAILABLE', 503);
  return { ok: true, revision: access.revision, digest: access.digest, bytes: access.bytes, duration_ms: access.duration_ms };
}

/** @purpose Sanitize a reserved draft or acknowledge its exact verified receipt; never overwrite committed media on retry. */
export async function fanZoneUploadHandler(request: Request): Promise<Response> {
  try {
    const { entry, revision } = await fanMediaBody(request);
    const { caller, service } = await fanMediaClients(request);
    const access = await fanMediaAccess(caller, entry, revision, 'verify');
    const downloaded = await downloadFanMedia(service, access);
    if (access.digest !== null && access.digest !== undefined) {
      const receipt = existingReceipt(access, downloaded);
      const again = await fanMediaAccess(caller, entry, revision, 'verify');
      if (again.path !== access.path || again.digest !== access.digest || again.bytes !== access.bytes || again.duration_ms !== access.duration_ms) throw new FanMediaError('FUN_MEDIA_DENIED', 403);
      return json(receipt);
    }
    const sanitized = sanitizeFanZoneMp4(downloaded);
    const again = await fanMediaAccess(caller, entry, revision, 'verify');
    if (again.path !== access.path) throw new FanMediaError('FUN_MEDIA_DENIED', 403);
    // A concurrent verifier may have committed while this request read/sanitized its original bytes.
    if (again.digest !== null && again.digest !== undefined) return json(existingReceipt(again, sanitized.bytes));
    const digest = createHash('sha256').update(sanitized.bytes).digest('hex');
    const { error: uploadError } = await service.storage.from('fan_zone').upload(access.path, sanitized.bytes, { contentType: 'video/mp4', cacheControl: '0', upsert: true });
    if (uploadError) throw new FanMediaError('FUN_MEDIA_UNAVAILABLE', 503);
    const { data, error } = await service.rpc('fun_verify_media', { p_entry_id: entry, p_revision: revision, p_digest: digest, p_bytes: sanitized.bytes.length, p_duration_ms: sanitized.durationMs });
    if (error || !data?.ok) throw new FanMediaError('FUN_MEDIA_DENIED', 403);
    return json({ ok: true, revision, digest, bytes: sanitized.bytes.length, duration_ms: sanitized.durationMs });
  } catch (caught) { return failed(caught); }
}

/** @purpose Remove an authorized object and mark the receipt complete only after successful Storage deletion. */
export async function fanZoneRemoveHandler(request: Request): Promise<Response> {
  try {
    const { entry, revision } = await fanMediaBody(request);
    const { caller, service } = await fanMediaClients(request);
    const access = await fanMediaAccess(caller, entry, revision, 'remove');
    const { error: removeError } = await service.storage.from('fan_zone').remove([access.path]);
    if (removeError) throw new FanMediaError('FUN_MEDIA_UNAVAILABLE', 503);
    const { data, error } = await service.rpc('fun_complete_removal', { p_entry_id: entry, p_revision: revision });
    if (error || !data?.ok) throw new FanMediaError('FUN_MEDIA_UNAVAILABLE', 503);
    return json({ ok: true, entry, revision, completed: data.completed === true, status: data.completed === true ? 'removed' : 'revision_removed' });
  } catch (caught) { return failed(caught); }
}
