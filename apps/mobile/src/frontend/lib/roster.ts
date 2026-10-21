/**
 * Public roster lookup and claimed-player badges shared by athlete sheets and team rosters.
 * Guest player lookup preserves database errors so the screen can offer a retry.
 * @sideEffects Supabase SELECT on `players`, `profiles`, and `profiles_public`.
 */

import type { Player } from '@/data/players';
import { isMissingFunction } from '@/lib/dbErrors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type {  ProfilePublic } from '@/types/database';
import { getPublicProfiles } from '@/lib/privacy';
import { untypedRpc } from '@/lib/rpc';

/**
 * @purpose Load every roster row for tagging, donations and the athlete sheet (`players` including `vault_locked`).
 * @returns Players, or an empty list plus the database message when the read fails.
 * @sideEffects `players` SELECT.
 */
export async function fetchRosterPlayers(): Promise<{ players: Player[]; error: string | null }> {
  const { data, error } = await supabase.from('players').select('*');
  if (error) return { players: [], error: error.message };
  return { players: (data as Player[] | null) ?? [], error: null };
}

/**
 * @purpose Load one public athlete for the guest profile without needing a signed-in session.
 * @param playerId Public roster id from the route.
 * @returns Athlete or the existing configuration, database, or missing-player error.
 * @sideEffects `players` SELECT.
 */
export async function fetchGuestPlayer(playerId: string): Promise<{ player: Player | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { player: null, error: 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.' };
  }
  const { data, error } = await supabase.from('players').select('*').eq('id', playerId).single();
  return {
    player: error ? null : (data as Player | null),
    error: error?.message ?? (data ? null : 'Player not found.'),
  };
}

/**
 * @purpose Which roster rows are claimed (`profiles.player_id` → `players.id`) for athlete Claimed/Unclaimed badges.
 * @param playerIds `players.id` values on the Active Team Roster.
 * @returns Set of claimed player ids.
 * @sideEffects `claimed_player_ids` RPC (direct `profiles` read on databases without it).
 */
export async function fetchClaimedPlayerIds(playerIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(playerIds.filter(Boolean))];
  if (ids.length === 0 || !isSupabaseConfigured) return new Set();

  // Other people's profiles are not directly readable (PRIV-01); this RPC returns only which ids are claimed.
  const viaRpc = await untypedRpc('claimed_player_ids', { target_player_ids: ids });
  if (!viaRpc.error && Array.isArray(viaRpc.data)) {
    return new Set(viaRpc.data.map((row) => (typeof row === 'string' ? row : (row as { claimed_player_ids?: unknown })?.claimed_player_ids)).filter((id): id is string => typeof id === 'string' && Boolean(id)));
  }
  if (!isMissingFunction(viaRpc.error)) return new Set();
  const { data, error } = await supabase.from('profiles').select('player_id').in('player_id', ids);
  if (error || !Array.isArray(data)) return new Set();

  const claimed = new Set<string>();
  for (const row of data) {
    if (typeof row.player_id === 'string' && row.player_id) claimed.add(row.player_id);
  }
  return claimed;
}

/**
 * @purpose Public account row for an athlete sheet. Missing SQL or a missing row is an empty profile, not a failed athlete.
 * @param playerId `players.id`.
 * @returns The `profiles_public` row, or null when the read fails.
 * @sideEffects `profiles_public` SELECT.
 */
export async function fetchPublicProfileForPlayer(playerId: string): Promise<ProfilePublic | null> {
  if (!playerId || !isSupabaseConfigured) return null;
  const rows = await getPublicProfiles({ playerIds: [playerId] });
  return rows[0] ?? null;
}
