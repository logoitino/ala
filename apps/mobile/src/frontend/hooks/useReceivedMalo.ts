import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
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
  };
}

/**
 * @purpose Gifts fans sent to this athlete: amount, who gave it, and where it started.
 * @param playerId `players.id` for the athlete (or the child a guardian is linked to).
 * @returns `{ rows, totalCents, loading }` — empty when the viewer is not that athlete, their guardian, or an admin.
 * @sideEffects Supabase RPC `get_received_malo`.
 */
export function useReceivedMalo(playerId: string | null | undefined) {
  const [rows, setRows] = useState<ReceivedMalo[]>([]);
  const [loading, setLoading] = useState(Boolean(playerId));

  const refresh = useCallback(async () => {
    if (!playerId || !isSupabaseConfigured) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('get_received_malo', { target_player_id: playerId });
    if (error || !Array.isArray(data)) {
      setRows([]);
      setLoading(false);
      return;
    }
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
  return { rows, totalCents, loading, refresh };
}
