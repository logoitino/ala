/** UX-13 keeps private received-gift amounts in one viewer/athlete frame and rejects outgoing reads. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { offlineQueue } from '@/services/OfflineQueue';
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
  const { user, isSessionCurrent } = useAuth();
  const userId = user?.id ?? null;
  const holder = useRef({ userId, playerId, guard: isSessionCurrent, active: false, read: 0 });
  if (holder.current.userId !== userId || holder.current.playerId !== playerId || holder.current.guard !== isSessionCurrent) {
    holder.current = { userId, playerId, guard: isSessionCurrent, active: false, read: 0 };
  }
  const scope = holder.current;
  const current = useCallback(() => holder.current === scope && scope.active && (scope.guard?.() ?? true), [scope]);
  useEffect(() => { scope.active = true; return () => { scope.active = false; ++scope.read; }; }, [scope]);
  const [frame, setFrame] = useState<{ owner: typeof scope; rows: ReceivedMalo[]; loading: boolean } | null>(null);
  const shown = frame?.owner === scope && current() ? frame : null;
  const rows = shown?.rows ?? [];
  const refresh = useCallback(async () => {
    if (!current()) return;
    const read = ++scope.read;
    const actor = userId ? offlineQueue.captureActor(userId) : null;
    const accepted = () => current() && read === scope.read && (!userId || Boolean(actor?.isCurrent()));
    if (!userId || !playerId || !isSupabaseConfigured) {
      setFrame({ owner: scope, rows: [], loading: false });
      return;
    }
    if (!actor) return;
    setFrame(previous => ({ owner: scope, rows: previous?.owner === scope ? previous.rows : [], loading: true }));
    try {
      const received = await fetchReceivedMalo(playerId);
      if (!accepted()) return;
      if (!received) telemetry.trackIssue('received_malo_unavailable', 'profile');
      setFrame({ owner: scope, rows: received ?? [], loading: false });
    } catch {
      if (accepted()) {
        telemetry.trackIssue('received_malo_unavailable', 'profile');
        setFrame({ owner: scope, rows: [], loading: false });
      }
    }
  }, [current, playerId, scope, userId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const totalCents = rows.reduce((sum, row) => sum + row.amount_cents, 0);
  const familyCents = rows.length > 0 && rows.every((row) => row.family_cents != null)
    ? rows.reduce((sum, row) => sum + (row.family_cents ?? 0), 0) : null;
  return { rows, totalCents, familyCents, loading: shown?.loading ?? Boolean(userId && playerId), error: null, refresh };
}
