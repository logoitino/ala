/**
 * A signed-in fan's own donation history, with totals (donated, athletes supported, Aura earned).
 * Feeds the Activity tab through `hooks/useActivityFeed`. Reloads whenever the screen regains focus and returns
 * `error` so the screen can offer Retry instead of an empty list. (Code name `tip` = donation.)
 * UX-13 frames private receipts by the Auth lifetime, masks outgoing amounts immediately, and rejects late reads.
 * @sideEffects Reads the fan's donation rows from Supabase.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { fetchFanTipHistory } from '@/lib/donationHistory';
import { isSupabaseConfigured } from '@/lib/supabase';
import { offlineQueue } from '@/services/OfflineQueue';
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
  const { user, isSessionCurrent } = useAuth();
  const userId = user?.id ?? null;
  const holder = useRef({ userId, guard: isSessionCurrent, active: false, read: 0 });
  if (holder.current.userId !== userId || holder.current.guard !== isSessionCurrent) {
    holder.current = { userId, guard: isSessionCurrent, active: false, read: 0 };
  }
  const scope = holder.current;
  const current = useCallback(() => holder.current === scope && scope.active && (scope.guard?.() ?? true), [scope]);
  useEffect(() => { scope.active = true; return () => { scope.active = false; ++scope.read; }; }, [scope]);
  const [frame, setFrame] = useState<{ owner: typeof scope; receipts: FanTipReceipt[]; loading: boolean; error: string | null } | null>(null);
  const shown = frame?.owner === scope && current() ? frame : null;
  const receipts = shown?.receipts ?? [];
  const refresh = useCallback(async () => {
    if (!current()) return;
    const read = ++scope.read;
    const actor = userId ? offlineQueue.captureActor(userId) : null;
    const accepted = () => current() && read === scope.read && (!userId || Boolean(actor?.isCurrent()));
    if (!userId || !isSupabaseConfigured) {
      setFrame({ owner: scope, receipts: [], loading: false, error: null });
      return;
    }
    if (!actor) return;
    setFrame(previous => ({ owner: scope, receipts: previous?.owner === scope ? previous.receipts : [], loading: true, error: null }));
    try {
      const result = await fetchFanTipHistory(userId);
      if (accepted()) setFrame({ owner: scope, receipts: result.receipts, loading: false, error: result.error });
    } catch {
      if (accepted()) setFrame({ owner: scope, receipts: [], loading: false, error: 'Could not load your gift receipts. Check your connection and try again.' });
    }
  }, [current, scope, userId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const summary = useMemo(() => summarize(receipts), [receipts]);
  return { receipts, summary, loading: shown?.loading ?? Boolean(userId), error: shown?.error ?? null, signedIn: Boolean(userId), refresh };
}
