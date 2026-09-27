import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { FanTipReceipt } from '@/types/database';

export type FanTipHistorySummary = {
  totalTippedCents: number;
  athletesSupported: number;
  totalAuraEarned: number;
};

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asCents(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function parseReceipt(row: Record<string, unknown>): FanTipReceipt | null {
  const id = asText(row.id);
  const playerId = asText(row.player_id);
  if (!id || !playerId) return null;
  const reelRaw = row.reel_id;
  return {
    id,
    player_id: playerId,
    reel_id: typeof reelRaw === 'string' && reelRaw.trim() ? reelRaw.trim() : null,
    amount_cents: asCents(row.amount_cents),
    aura_points: asCents(row.aura_points),
    created_at: asText(row.created_at, new Date().toISOString()),
    athlete_name: asText(row.athlete_name, 'Athlete'),
    school_name: asText(row.school_name),
    origin: asText(row.origin, 'profile'),
    entry: asText(row.entry, 'in_app'),
    wishlist_item_id: asText(row.wishlist_item_id) || null,
    source_label: asText(row.source_label),
  };
}

function parseReceipts(rows: unknown): FanTipReceipt[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => (row && typeof row === 'object' ? parseReceipt(row as Record<string, unknown>) : null))
    .filter((row): row is FanTipReceipt => Boolean(row));
}

function playerJoinName(players: unknown): { athlete_name: string; school_name: string } {
  const row = Array.isArray(players) ? players[0] : players;
  if (!row || typeof row !== 'object') return { athlete_name: 'Athlete', school_name: '' };
  const record = row as Record<string, unknown>;
  return {
    athlete_name: asText(record.name, 'Athlete'),
    school_name: asText(record.school_name),
  };
}

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
 * @returns `{ receipts, summary, loading, signedIn, refresh }` — summary is Total Tipped, Athletes Supported, Aura Earned.
 * @sideEffects Supabase RPC `get_fan_tip_history`; falls back to a `tips` SELECT joined to `players` if the RPC is missing.
 */
export function useFanTipHistory() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [receipts, setReceipts] = useState<FanTipReceipt[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));

  const refresh = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      setReceipts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const rpc = await supabase.rpc('get_fan_tip_history', { fan_user_id: userId });
    if (!rpc.error) {
      setReceipts(parseReceipts(rpc.data));
      setLoading(false);
      return;
    }

    const rich = await supabase
      .from('tips')
      .select(
        'id, player_id, reel_id, amount_cents, aura_points, created_at, origin, entry, wishlist_item_id, source_label, players(name, school_name)',
      )
      .eq('fan_id', userId)
      .order('created_at', { ascending: false });
    const plain = rich.error
      ? await supabase
          .from('tips')
          .select('id, player_id, reel_id, amount_cents, aura_points, created_at, players(name, school_name)')
          .eq('fan_id', userId)
          .order('created_at', { ascending: false })
      : null;
    const fallback = plain ?? rich;

    if (fallback.error || !fallback.data) {
      setReceipts([]);
      setLoading(false);
      return;
    }

    setReceipts(
      parseReceipts(
        fallback.data.map((row) => {
          const record = row as Record<string, unknown>;
          const names = playerJoinName(record.players);
          return { ...record, ...names };
        }),
      ),
    );
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
    signedIn: Boolean(userId),
    refresh,
  };
}
