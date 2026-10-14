/**
 * FUN-01 private media boundary. Validates bearer auth with Supabase before calling caller-scoped RPCs;
 * only then uses a server service key for the fixed private bucket. Never returns signed storage URLs.
 * @sideEffects Auth validation, narrow SQL RPCs and bounded private storage download/upload/removal.
 */
import { createClient } from '@supabase/supabase-js';
import { FAN_ZONE_MAX_BYTES } from './fanZoneMp4';

export type FanMediaAccess = { ok: true; bucket: 'fan_zone'; path: string; revision: number; digest?: string | null };
export class FanMediaError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @purpose Authenticate caller and construct bound caller/service clients without exporting credentials. */
export async function fanMediaClients(request: Request) {
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) throw new FanMediaError('FUN_SIGN_IN', 401);
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !serviceKey) throw new FanMediaError('FUN_MEDIA_UNAVAILABLE', 503);
  const caller = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await caller.auth.getUser(token);
  if (error || !data.user) throw new FanMediaError('FUN_SIGN_IN', 401);
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { caller, service };
}

/** @purpose Check current SQL owner/guardian/admin or pilot-candidate permission for this exact media revision. */
export async function fanMediaAccess(caller: Awaited<ReturnType<typeof fanMediaClients>>['caller'], entry: string, revision: number, intent: 'read' | 'verify' | 'remove'): Promise<FanMediaAccess> {
  const { data, error } = await caller.rpc('fun_media_access', { p_entry_id: entry, p_revision: revision, p_intent: intent });
  if (error) {
    if (['PGRST202', '42883', '42P01', '57014'].includes(error.code)) throw new FanMediaError('FUN_MEDIA_UNAVAILABLE', 503);
    throw new FanMediaError('FUN_MEDIA_DENIED', 403);
  }
  const access = data as FanMediaAccess | null;
  if (!access?.ok || access.bucket !== 'fan_zone' || access.revision !== revision || !access.path || access.path.startsWith('/') || access.path.split('/').includes('..')) throw new FanMediaError('FUN_MEDIA_DENIED', 403);
  return access;
}

/** @purpose Read only the authorized private object with a strict local size bound. */
export async function downloadFanMedia(service: Awaited<ReturnType<typeof fanMediaClients>>['service'], access: FanMediaAccess): Promise<Uint8Array> {
  const { data, error } = await service.storage.from('fan_zone').download(access.path);
  if (error || !data) throw new FanMediaError('FUN_MEDIA_UNAVAILABLE', 503);
  if (data.size > FAN_ZONE_MAX_BYTES) throw new FanMediaError('FUN_MEDIA_SIZE', 400);
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength > FAN_ZONE_MAX_BYTES) throw new FanMediaError('FUN_MEDIA_SIZE', 400);
  return bytes;
}

/** @purpose Parse bounded JSON media identifiers; never accept a client storage path or digest. */
export async function fanMediaBody(request: Request): Promise<{ entry: string; revision: number }> {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new FanMediaError('FUN_MEDIA_REQUEST');
  // Read progressively to avoid buffering an unbounded attacker-supplied request body.
  const reader = request.body?.getReader();
  if (!reader) throw new FanMediaError('FUN_MEDIA_REQUEST');
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > 2048) { await reader.cancel(); throw new FanMediaError('FUN_MEDIA_REQUEST'); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let input: { entry?: unknown; revision?: unknown };
  try { input = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new FanMediaError('FUN_MEDIA_REQUEST'); }
  if (!input || typeof input.entry !== 'string' || !UUID_PATTERN.test(input.entry) || !Number.isSafeInteger(input.revision) || Number(input.revision) < 1) throw new FanMediaError('FUN_MEDIA_REQUEST');
  return { entry: input.entry, revision: Number(input.revision) };
}
