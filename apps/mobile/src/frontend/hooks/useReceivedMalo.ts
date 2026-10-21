import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { fetchReceivedMalo } from '@/lib/donationHistory';
import { isSupabaseConfigured } from '@/lib/supabase';
import { telemetry } from '@/services/TelemetryManager';
import type { ReceivedMalo } from '@/types/database';

/**
 * @purpose Gifts fans sent to this athlete: amount, who gave it, and where it started.
 * @param playerId `players.id` for the athlete (or the child a guardian is linked to).
 * @returns `{ rows, totalCents, loading, error }` — empty when nobody has donated, the viewer is not that athlete, or the ledger call failed.
 *   A missing function or a down database stays `$0` on screen. `error` is not set for those; the failure is logged for staff.
 * @sideEffects RPC `get_received_malo` through `lib/donationHistory`. `telemetry.trackIssue` when that call fails.
 */
export function useReceivedMalo(playerId: string | null | undefined) {
  const [rows, setRows] = useState<ReceivedMalo[]>([]);
  const [loading, setLoading] = useState(Boolean(playerId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!playerId || !isSupabaseConfigured) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const received = await fetchReceivedMalo(playerId);
    if (!received) {
      // Missing SQL and a failed call both look like an empty ledger. The athlete sees $0, not a database message.
      telemetry.trackIssue('received_malo_unavailable', 'profile');
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    setError(null);
    setRows(received);
    setLoading(false);
  }, [playerId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const totalCents = rows.reduce((sum, row) => sum + row.amount_cents, 0);
  // Known only when every row carries the books' family share (the database has 20261013231000).
  const familyCents = rows.length > 0 && rows.every((row) => row.family_cents != null)
    ? rows.reduce((sum, row) => sum + (row.family_cents ?? 0), 0)
    : null;
  return { rows, totalCents, familyCents, loading, error, refresh };
}
