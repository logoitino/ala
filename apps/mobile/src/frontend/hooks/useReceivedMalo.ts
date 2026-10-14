import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { telemetry } from '@/services/TelemetryManager';
import type { ReceivedMalo } from '@/types/database';

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asCents(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function parseRow(row: Record<string, unknown>): ReceivedMalo | null {
  const id = asText(row.id);
  if (!id) return null;
  const reel = asText(row.reel_id);
  const item = asText(row.wishlist_item_id);
  return {
    id,
    amount_cents: asCents(row.amount_cents),
    aura_points: asCents(row.aura_points),
    created_at: asText(row.created_at, new Date().toISOString()),
    origin: asText(row.origin, 'profile'),
    entry: asText(row.entry, 'in_app'),
    source_label: asText(row.source_label),
    reel_id: reel || null,
    wishlist_item_id: item || null,
    fan_name: asText(row.fan_name, 'Fan'),
    family_cents: row.family_cents == null ? null : asCents(row.family_cents),
  };
}

/**
 * @purpose Gifts fans sent to this athlete: amount, who gave it, and where it started.
 * @param playerId `players.id` for the athlete (or the child a guardian is linked to).
 * @returns `{ rows, totalCents, loading, error }` — empty when nobody has donated, the viewer is not that athlete, or the ledger call failed.
 *   A missing function or a down database stays `$0` on screen. `error` is not set for those; the failure is logged for staff.
 * @sideEffects Supabase RPC `get_received_malo`. `telemetry.trackIssue` when that call fails.
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
    const { data, error: rpcError } = await supabase.rpc('get_received_malo', { target_player_id: playerId });
    if (rpcError || !Array.isArray(data)) {
      // Missing SQL and a failed call both look like an empty ledger. The athlete sees $0, not a database message.
      telemetry.trackIssue('received_malo_unavailable', 'profile');
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    setError(null);
    setRows(
      data
        .map((row) => (row && typeof row === 'object' ? parseRow(row as Record<string, unknown>) : null))
        .filter((row): row is ReceivedMalo => Boolean(row)),
    );
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
