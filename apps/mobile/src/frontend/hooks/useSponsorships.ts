/**
 * Local Team Boosters: loads active sponsorships (a demo rail when there are none) and records new ones. The database
 * and Storage calls (including the logo upload) live in `lib/sponsorships`.
 * @sideEffects `sponsorships` read and insert through lib/.
 */

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { DEMO_SPONSORSHIPS, sponsorTierById } from '@/data/sponsorships';
import { fetchActiveSponsorships, insertSponsorship } from '@/lib/sponsorships';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { Sponsorship, SponsorshipTierId } from '@/types/database';

export type RecordSponsorshipInput = {
  businessName: string;
  logoUrl: string;
  schoolTeam: string;
  tier: SponsorshipTierId;
};

/**
 * @purpose Load active Local Team Boosters from `sponsorships` (demo rail when empty / RPC missing).
 * @returns `{ sponsors, loading, refresh, recordSponsorship }`.
 * @sideEffects `sponsorships` SELECT on focus and INSERT after PaymentSheet, both through `lib/sponsorships`.
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
    const next = await fetchActiveSponsorships();

    if (!next) {
      setRows(DEMO_SPONSORSHIPS);
      setLoading(false);
      return;
    }

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

      const saved = await insertSponsorship(payload);
      if (!saved.ok) {
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
      const parsed = saved.sponsorship;
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
