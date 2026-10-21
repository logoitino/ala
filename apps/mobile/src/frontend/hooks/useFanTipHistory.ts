/**
 * A signed-in fan's own donation history, with totals (donated, athletes supported, Aura earned).
 * Feeds the Activity tab through `hooks/useActivityFeed`. Reloads whenever the screen regains focus and returns
 * `error` so the screen can offer Retry instead of an empty list. (Code name `tip` = donation.)
 * @sideEffects Reads the fan's donation rows from Supabase.
 */

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { fetchFanTipHistory } from '@/lib/donationHistory';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { FanTipReceipt } from '@/types/database';

export type FanTipHistorySummary = {
  totalTippedCents: number;
  athletesSupported: number;
  totalAuraEarned: number;
};

function summarize(rows: FanTipReceipt[]): FanTipHistorySummary {
  const athletes = new Set(rows.map((row) => row.player_id));
  return {
    totalTippedCents: rows.reduce((sum, row) => sum + Math.max(0, row.amount_cents), 0),
    athletesSupported: athletes.size,
    totalAuraEarned: rows.reduce((sum, row) => sum + Math.max(0, row.aura_points), 0),
  };
}

/**
 * @purpose Load this fan's Mālo receipts via `get_fan_tip_history` for the Tip History screen.
 * @returns `{ receipts, summary, loading, error, signedIn, refresh }` — summary is Total Tipped, Athletes Supported, Aura Earned.
 * @sideEffects `lib/donationHistory.fetchFanTipHistory` (RPC `get_fan_tip_history`, `tips` SELECT fallback).
 */
export function useFanTipHistory() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [receipts, setReceipts] = useState<FanTipReceipt[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      setReceipts([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await fetchFanTipHistory(userId);
    setReceipts(result.receipts);
    setError(result.error);
    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const summary = useMemo(() => summarize(receipts), [receipts]);

  return {
    receipts,
    summary,
    loading,
    error,
    signedIn: Boolean(userId),
    refresh,
  };
}
