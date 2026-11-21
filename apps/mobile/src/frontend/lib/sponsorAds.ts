/**
 * Sponsor HQ data uses an optional initiating-account client; ad writes require stored confirmation before success.
 */

import { supabase } from '@/lib/supabase';
import type { SponsorAd } from '@/types/database';

export type SponsorAdWriteResult = { ok: true } | { ok: false; message: string };

/**
 * @purpose Load every placement managed by Sponsor Studio.
 * @returns Ads plus friendly load failure copy.
 * @sideEffects `sponsor_ads` SELECT.
 */
export async function fetchSponsorAds(client = supabase): Promise<{ ads: SponsorAd[]; error: string | null }> {
  try {
    const { data, error } = await client.from('sponsor_ads').select('*').order('title');
    if (error) return { ads: [], error: 'Could not load live placements. Try again.' };
    return { ads: (data as SponsorAd[] | null) ?? [], error: null };
  } catch {
    return { ads: [], error: 'Could not load live placements. Try again.' };
  }
}

/**
 * @purpose Publish a sideline or rivalry placement from Sponsor Studio.
 * @sideEffects `sponsor_ads` INSERT.
 */
export async function createSponsorAd(input: {
  title: string;
  placement: string;
  rivalry: string | null;
}, client = supabase): Promise<SponsorAdWriteResult> {
  const { data, error } = await client.from('sponsor_ads').insert({ ...input, is_active: true }).select('id').single();
  if (error) return { ok: false, message: error.message };
  return typeof data?.id === 'string' ? { ok: true } : { ok: false, message: 'Ad creation was not confirmed. Refresh before trying again.' };
}

/**
 * @purpose Pause or activate one Sponsor Studio placement.
 * @sideEffects `sponsor_ads` UPDATE.
 */
export async function setSponsorAdActive(id: string, isActive: boolean, client = supabase): Promise<SponsorAdWriteResult> {
  const { data, error } = await client.from('sponsor_ads').update({ is_active: isActive }).eq('id', id).select('id,is_active').single();
  if (error) return { ok: false, message: error.message };
  return data?.id === id && data.is_active === isActive ? { ok: true } : { ok: false, message: 'Ad status was not confirmed.' };
}
