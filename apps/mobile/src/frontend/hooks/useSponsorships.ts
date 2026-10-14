/**
 * Local Team Boosters: loads active sponsorships (a demo rail when there are none) and uploads a booster logo to
 * Storage `avatars/sponsors/`.
 * @sideEffects `sponsorships` read; Storage upload.
 */

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { DEMO_SPONSORSHIPS, sponsorTierById } from '@/data/sponsorships';
import { AVATARS_BUCKET, bytesFromUri, imageContentType } from '@/services/MediaUploadService';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Sponsorship, SponsorshipTierId } from '@/types/database';

export type RecordSponsorshipInput = {
  businessName: string;
  logoUrl: string;
  schoolTeam: string;
  tier: SponsorshipTierId;
};

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
 * @returns Public URL, or the original URI when Storage is missing.
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
    return supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl || localUri;
  } catch {
    return localUri;
  }
}

/**
 * @purpose Load active Local Team Boosters from `sponsorships` (demo rail when empty / RPC missing).
 * @returns `{ sponsors, loading, refresh, recordSponsorship }`.
 * @sideEffects Supabase SELECT on focus; INSERT after PaymentSheet; Storage logo upload.
 */
export function useSponsorships() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Sponsorship[]>(DEMO_SPONSORSHIPS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRows(DEMO_SPONSORSHIPS);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('sponsorships')
      .select(
        'id, sponsor_user_id, business_name, logo_url, school_team, tier, amount_cents, aura_points, billing_interval, status, created_at',
      )
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(24);

    if (error || !data) {
      setRows(DEMO_SPONSORSHIPS);
      setLoading(false);
      return;
    }

    const next = parseRows(data);
    setRows(next.length > 0 ? next : DEMO_SPONSORSHIPS);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const recordSponsorship = useCallback(
    async ({ businessName, logoUrl, schoolTeam, tier }: RecordSponsorshipInput) => {
      const pack = sponsorTierById(tier);
      const payload = {
        sponsor_user_id: user?.id ?? null,
        business_name: businessName.trim(),
        logo_url: logoUrl.trim(),
        school_team: schoolTeam.trim(),
        tier: pack.id,
        amount_cents: Math.round(pack.dollars * 100),
        aura_points: pack.auraPoints,
        billing_interval: 'month',
        status: 'active',
      };

      if (!isSupabaseConfigured) {
        setRows((current) => [
          {
            id: `local-${Date.now()}`,
            ...payload,
            created_at: new Date().toISOString(),
          },
          ...current,
        ]);
        return;
      }

      const { data, error } = await supabase.from('sponsorships').insert(payload).select('*').maybeSingle();
      if (error || !data) {
        setRows((current) => [
          {
            id: `local-${Date.now()}`,
            ...payload,
            created_at: new Date().toISOString(),
          },
          ...current.filter((row) => !row.id.startsWith('demo-')),
        ]);
        return;
      }
      const parsed = parseSponsorship(data as Record<string, unknown>);
      if (parsed) {
        setRows((current) => [parsed, ...current.filter((row) => row.id !== parsed.id && !row.id.startsWith('demo-'))]);
      } else {
        void refresh();
      }
    },
    [refresh, user?.id],
  );

  const sponsors = useMemo(
    () => rows.filter((row) => (row.status ?? 'active') === 'active'),
    [rows],
  );

  return { sponsors, loading, refresh, recordSponsorship };
}
