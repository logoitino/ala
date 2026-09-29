import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  claimAthlete,
  fetchMyVerification,
  startSchoolCheck,
  type MyVerification,
  type SchoolCheckCode,
} from '@/lib/verification';
import { fetchMyPayoutStatus, type MyPayoutStatus } from '@/lib/payoutGate';

/**
 * @purpose The signed-in account's own place on the verification ladder, plus the in-person school
 * code. Drives `AthleteVerificationCard` on Activity (owner decision 2026-09-29: gifts are held until
 * the school confirms, and the athlete must be able to see that in the app).
 * @returns `verification` (null when signed out or the ladder SQL is not applied), `payout` (the
 * payout gate — school, or the family's Stripe ID check with a cap; design §9), the freshly minted
 * `code` (shown once — the server keeps only a hash), and `claim` / `showCode` actions.
 * @sideEffects `get_my_verification` + `get_my_payout_status` on focus; `start_school_check`; `claim_athlete`.
 */
export function useMyVerification(enabled: boolean) {
  const [verification, setVerification] = useState<MyVerification | null>(null);
  const [payout, setPayout] = useState<MyPayoutStatus | null>(null);
  const [code, setCode] = useState<SchoolCheckCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setVerification(null);
      setPayout(null);
      return;
    }
    try {
      const [nextVerification, nextPayout] = await Promise.all([fetchMyVerification(), fetchMyPayoutStatus()]);
      setVerification(nextVerification);
      setPayout(nextPayout);
    } catch {
      // Keep the last good state; the card is informational.
    }
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        await action();
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Try again.');
      } finally {
        setBusy(false);
      }
    },
    [busy, refresh],
  );

  const showCode = useCallback(() => run(async () => setCode(await startSchoolCheck())), [run]);
  const claim = useCallback(
    () =>
      run(async () => {
        await claimAthlete(null);
      }),
    [run],
  );

  return { verification, payout, code, error, busy, refresh, showCode, claim };
}
