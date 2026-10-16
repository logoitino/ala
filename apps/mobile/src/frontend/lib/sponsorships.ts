/**
 * Local Team Boosters data: reads active `sponsorships`, records a new one, and uploads a booster logo to Storage
 * `avatars/sponsors/`. Moved out of `hooks/useSponsorships` (PORT-01) so a host change rewrites lib/, not the hook.
 * The stored logo goes through `mediaValueToStore` (SCALE-02 switch in lib/media, off for now); screens show it via `mediaUri`.
 * @sideEffects `sponsorships` SELECT and INSERT; Storage upload; reads the signed-in user.
 */

import { AVATARS_BUCKET, bytesFromUri, imageContentType } from '@/services/MediaUploadService';
import { mediaValueToStore, publicMediaUrl } from '@/lib/media';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Sponsorship, SponsorshipTierId } from '@/types/database';

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function parseSponsorship(row: Record<string, unknown>): Sponsorship | null {
  const id = asText(row.id);
  const businessName = asText(row.business_name);
  if (!id || !businessName) return null;
  const tierRaw = asText(row.tier, 'silver').toLowerCase();
  const tier: SponsorshipTierId =
    tierRaw === 'gold' || tierRaw === 'platinum' ? tierRaw : 'silver';
  const cents = Number(row.amount_cents);
  const aura = Number(row.aura_points);
  return {
    id,
    sponsor_user_id: asText(row.sponsor_user_id) || null,
    business_name: businessName,
    logo_url: asText(row.logo_url),
    school_team: asText(row.school_team),
    tier,
    amount_cents: Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0,
    aura_points: Number.isFinite(aura) ? Math.max(0, Math.round(aura)) : 0,
    billing_interval: asText(row.billing_interval, 'month') || 'month',
    status: asText(row.status, 'active') || 'active',
    created_at: asText(row.created_at) || undefined,
  };
}

function parseRows(rows: unknown): Sponsorship[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => (row && typeof row === 'object' ? parseSponsorship(row as Record<string, unknown>) : null))
    .filter((row): row is Sponsorship => Boolean(row));
}

/**
 * @purpose Upload a booster logo to Storage `avatars` under `sponsors/{user id}/`.
 * `game_highlights` only allows video MIME types, and a React Native Blob is `text/plain`.
 * @param localUri Image picker URI.
 * @returns The value to store (public URL today; `sb:avatars/...` once `MEDIA_WRITE_REFERENCES` is on), or the
 *   original URI when Storage is missing.
 * @sideEffects Supabase Storage upload.
 */
export async function uploadSponsorLogo(localUri: string): Promise<string> {
  if (!isSupabaseConfigured) return localUri;
  if (/^https?:\/\//i.test(localUri)) return localUri;
  try {
    const contentType = imageContentType(localUri);
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const body = await bytesFromUri(localUri);
    // Own folder: Storage only lets a user overwrite files under sponsors/{their id}/ (20261013230000).
    const { data: auth } = await supabase.auth.getUser();
    const path = auth.user?.id ? `sponsors/${auth.user.id}/${Date.now()}.${ext}` : `sponsors/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(path, body, {
      contentType,
      upsert: true,
    });
    if (error) return localUri;
    const publicUrl = publicMediaUrl(AVATARS_BUCKET, path);
    return publicUrl ? mediaValueToStore(AVATARS_BUCKET, path, publicUrl) : localUri;
  } catch {
    return localUri;
  }
}

/**
 * @purpose Load the newest 24 active boosters.
 * @returns Parsed rows (possibly empty), or null when the read failed so the caller can show the demo rail.
 * @sideEffects `sponsorships` SELECT.
 */
export async function fetchActiveSponsorships(): Promise<Sponsorship[] | null> {
  const { data, error } = await supabase
    .from('sponsorships')
    .select(
      'id, sponsor_user_id, business_name, logo_url, school_team, tier, amount_cents, aura_points, billing_interval, status, created_at',
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(24);
  if (error || !data) return null;
  return parseRows(data);
}

/**
 * @purpose Record a booster after payment.
 * @param payload Row to insert (tier, amount and Aura already resolved by the caller).
 * @returns `ok: false` when the write failed; otherwise the saved row, or null when it came back unreadable.
 * @sideEffects `sponsorships` INSERT.
 */
export async function insertSponsorship(
  payload: Omit<Sponsorship, 'id' | 'created_at'>,
): Promise<{ ok: false } | { ok: true; sponsorship: Sponsorship | null }> {
  const { data, error } = await supabase.from('sponsorships').insert(payload).select('*').maybeSingle();
  if (error || !data) return { ok: false };
  return { ok: true, sponsorship: parseSponsorship(data as Record<string, unknown>) };
}
