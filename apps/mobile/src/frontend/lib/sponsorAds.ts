/**
 * Sponsor HQ data: list, publish and switch off sideline and rivalry banners. Used by app/(sponsor).
 */

import { supabase } from '@/lib/supabase';
import type { SponsorAd } from '@/types/database';

export type SponsorAdWriteResult = { ok: true } | { ok: false; message: string };

/**
 * @purpose Load every placement managed by Sponsor Studio.
 * @returns Ads plus friendly load failure copy.
 * @sideEffects `sponsor_ads` SELECT.
 */
export async function fetchSponsorAds(): Promise<{ ads: SponsorAd[]; error: string | null }> {
  try {
    const { data, error } = await supabase.from('sponsor_ads').select('*').order('title');
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
}): Promise<SponsorAdWriteResult> {
  const { error } = await supabase.from('sponsor_ads').insert({ ...input, is_active: true });
  return error ? { ok: false, message: error.message } : { ok: true };
}

/**
 * @purpose Pause or activate one Sponsor Studio placement.
 * @sideEffects `sponsor_ads` UPDATE.
 */
export async function setSponsorAdActive(id: string, isActive: boolean): Promise<SponsorAdWriteResult> {
  const { error } = await supabase.from('sponsor_ads').update({ is_active: isActive }).eq('id', id);
  return error ? { ok: false, message: error.message } : { ok: true };
}
