import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

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
