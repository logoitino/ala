/**
 * Received-gift reads accept the originating client so private amounts cannot use a later session.
 * Gift ledgers read by two screens: what an athlete received (`get_received_malo`) and a fan's own
 * receipts (`get_fan_tip_history`, with a `tips` SELECT fallback for databases without that function).
 * Rows are parsed defensively here so a missing column never reaches the UI as `undefined`.
 * The calls live here (PORT-01) so a host change rewrites this file, not the hooks. Code name `tip` / `malo` = gift.
 * @sideEffects Supabase RPCs `get_received_malo` / `get_fan_tip_history`; `tips` SELECT joined to `players`.
 */

import { supabase } from '@/lib/supabase';
import type { FanTipReceipt, ReceivedMalo } from '@/types/database';

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asCents(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function parseReceived(row: Record<string, unknown>): ReceivedMalo | null {
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
 * @purpose Donations one athlete received, newest first as the server returns them.
 * @param playerId `players.id` (the athlete, or the child a guardian is linked to).
 * @returns Parsed rows, or null when the call failed or the function is missing (the caller offers Retry rather than a false zero total).
 * @sideEffects RPC `get_received_malo`.
 */
export async function fetchReceivedMalo(playerId: string, client = supabase): Promise<ReceivedMalo[] | null> {
  const { data, error } = await client.rpc('get_received_malo', { target_player_id: playerId });
  if (error || !Array.isArray(data)) return null;
  return data
    .map((row) => (row && typeof row === 'object' ? parseReceived(row as Record<string, unknown>) : null))
    .filter((row): row is ReceivedMalo => Boolean(row));
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

/**
 * @purpose One fan's own donation receipts.
 * @param userId The fan's auth user id.
 * @returns Receipts, or an empty list plus a message when every read failed.
 * @sideEffects RPC `get_fan_tip_history`; when it is missing, `tips` SELECT joined to `players`
 *   (the richer column set first, then the columns every database has).
 */
export async function fetchFanTipHistory(userId: string): Promise<{ receipts: FanTipReceipt[]; error: string | null }> {
  const rpc = await supabase.rpc('get_fan_tip_history', { fan_user_id: userId });
  if (!rpc.error) return { receipts: parseReceipts(rpc.data), error: null };

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
    return { receipts: [], error: fallback.error?.message ?? 'Could not load your gift receipts.' };
  }
  return {
    receipts: parseReceipts(
      fallback.data.map((row) => {
        const record = row as Record<string, unknown>;
        return { ...record, ...playerJoinName(record.players) };
      }),
    ),
    error: null,
  };
}
