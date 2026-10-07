/**
 * Public roster lookup and claimed-player badges shared by athlete sheets and team rosters.
 * Guest player lookup preserves database errors so the screen can offer a retry.
 * @sideEffects Supabase SELECT on `players` and `profiles`.
 */

import type { Player } from '@/data/players';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

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
 * @purpose True when this sheet is the signed-in person's claimed / named roster row — hide Join Crew, Mālo, Subscribe.
 */
export function isOwnAthleteSheet(
  profile: Pick<Profile, 'player_id' | 'full_name'> | null | undefined,
  player: { id: string; name: string } | null | undefined,
): boolean {
  if (!profile || !player?.id) return false;
  if (profile.player_id && profile.player_id === player.id) return true;
  const name = profile.full_name?.trim().toLowerCase();
  return Boolean(name && name === player.name.trim().toLowerCase());
}

/**
 * @purpose Which roster rows are claimed (`profiles.player_id` → `players.id`) for athlete Claimed/Unclaimed badges.
 * @param playerIds `players.id` values on the Active Team Roster.
 * @returns Set of claimed player ids.
 * @sideEffects `profiles` SELECT on `player_id`.
 */
export async function fetchClaimedPlayerIds(playerIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(playerIds.filter(Boolean))];
  if (ids.length === 0 || !isSupabaseConfigured) return new Set();

  const { data, error } = await supabase.from('profiles').select('player_id').in('player_id', ids);
  if (error || !Array.isArray(data)) return new Set();

  const claimed = new Set<string>();
  for (const row of data) {
    if (typeof row.player_id === 'string' && row.player_id) claimed.add(row.player_id);
  }
  return claimed;
}
