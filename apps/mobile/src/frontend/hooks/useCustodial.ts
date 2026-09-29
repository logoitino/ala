import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  cancelWithdrawal,
  decideWithdrawal,
  fetchCustodialSummary,
  requestWithdrawal,
  setupCustodialAccount,
  type CustodialSummary,
} from '@/lib/custodial';

/**
 * @purpose One athlete's custodial account for whoever is looking — the athlete, their guardian,
 * or an admin: who holds the money, the handover date, and withdrawal requests.
 * @param playerId `players.id`, or null to stay idle.
 * @returns `summary` (null when the viewer has no say over this athlete's money), `available`
 * (false until `supabase/custodial_money.sql` is applied), and actions that refetch on success.
 * @sideEffects `get_custodial_summary` on focus; the action RPCs in `lib/custodial.ts`.
 */
export function useCustodial(playerId: string | null | undefined) {
  const [summary, setSummary] = useState<CustodialSummary | null>(null);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(Boolean(playerId));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await fetchCustodialSummary(playerId);
    if (result.state === 'unavailable') {
      setAvailable(false);
      setSummary(null);
      setError(null);
    } else if (result.state === 'error') {
      setError(result.message);
    } else {
      setAvailable(true);
      setSummary(result.summary);
      setError(null);
    }
    setLoading(false);
  }, [playerId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      try {
        await action();
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [busy, refresh],
  );

  return {
    summary,
    available,
    loading,
    error,
    busy,
    refresh,
    setup: (birthDate: string | null, bankInAthleteName: boolean | null) =>
      run(() => setupCustodialAccount(String(playerId), birthDate, bankInAthleteName)),
    request: (amountCents: number, note?: string) =>
      run(() => requestWithdrawal(String(playerId), amountCents, note)),
    decide: (requestId: string, approve: boolean) => run(() => decideWithdrawal(requestId, approve)),
    cancel: (requestId: string) => run(() => cancelWithdrawal(requestId)),
  };
}
