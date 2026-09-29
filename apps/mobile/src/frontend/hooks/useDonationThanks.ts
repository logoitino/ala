import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  fetchDonationsToThank,
  fetchMyDonationThanksResult,
  thankDonation,
  type DonationToThank,
  type ThankResult,
  type ThanksKey,
  type ThanksReceived,
} from '@/lib/donationThanks';

/**
 * @purpose Athlete / guardian side: recent donations and a `thank(tipId, key)` that marks the row
 *   thanked right away.
 * @param playerId `players.id`. Nothing is fetched when empty.
 * @sideEffects `get_donations_to_thank`, `thank_donation`.
 */
export function useDonationsToThank(playerId: string | null | undefined) {
  const [rows, setRows] = useState<DonationToThank[]>([]);
  const [loading, setLoading] = useState(Boolean(playerId));

  const refresh = useCallback(async () => {
    if (!playerId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setRows(await fetchDonationsToThank(playerId));
    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const thank = useCallback(async (tipId: string, key: ThanksKey): Promise<ThankResult> => {
    const result = await thankDonation(tipId, key);
    if (result.ok) {
      setRows((prev) => prev.map((row) => (row.tipId === tipId ? { ...row, thankedKey: key } : row)));
    }
    return result;
  }, []);

  return { rows, loading, refresh, thank };
}

/**
 * @purpose Donor side: thank-yous athletes have sent the signed-in fan (Activity).
 * @sideEffects `get_my_donation_thanks` once signed in.
 */
export function useMyDonationThanks() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [rows, setRows] = useState<ThanksReceived[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchMyDonationThanksResult();
      setRows(result.rows);
      setError(result.error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, loading, error, refresh };
}
